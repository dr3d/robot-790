const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const router = require('../web/sts/note-brains.js');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');
const note = { filename: 'test.txt', content: 'ordinary body', brain_context: {
  version: 1, revision: 'rev1', shared: 'shared purpose',
  brains: { b1: 'speak', b2: 'notice', b3: 'third secret', b4: 'fourth secret' }
} };

test('each brain receives only its own guidance and shared purpose', () => {
  for (const target of ['b1', 'b2', 'b3', 'b4']) {
    const packet = router.forBrain([note], target);
    assert.equal(packet[0].guidance, note.brain_context.brains[target]);
    assert.equal(packet[0].shared, 'shared purpose');
    assert.equal(packet[0].revision, 'rev1');
    assert.equal(JSON.stringify(packet).includes('ordinary body'), false);
    assert.equal(packet[0].brains, undefined);
  }
  assert.throws(() => router.forBrain([note], 'b5'));
});

test('plain notes stay B1-only; shared does not opt other brains in', () => {
  assert.equal(router.b1Content({ content: 'plain' }), 'plain');
  assert.deepEqual(router.forBrain([{ content: 'plain' }], 'b2'), []);
  const sharedOnly = { ...note, brain_context: { ...note.brain_context, brains: {} } };
  assert.deepEqual(router.forBrain([sharedOnly], 'b2'), []);
  assert.deepEqual(router.forBrain([sharedOnly], 'b3'), []);
  assert.match(router.b1Content(sharedOnly), /shared purpose/);
});

test('B1 file result does not leak other brains or metadata', () => {
  const result = router.b1Result({ ...note, status: 'ok' });
  assert.equal(result.status, 'ok');
  assert.equal(result.brain_context, undefined);
  assert.match(result.content, /ordinary body/);
  assert.match(result.content, /shared purpose/);
  assert.match(result.content, /speak/);
  assert.doesNotMatch(result.content, /notice|secret/);
  assert.match(page, /Robot790NoteBrains.b1Result\(await readTextFile\(args\)\)/);
});

test('stable order, unpin and reload invalidate old advice', () => {
  const other = { ...note, filename: 'other.txt' };
  assert.deepEqual(router.forBrain([note, other], 'b2'), router.forBrain([other, note], 'b2'));
  const advice = { noteGuidanceKey: JSON.stringify(router.forBrain([note], 'b2')) };
  assert.equal(router.isCurrent(advice, [note], 'b2'), true);
  assert.equal(router.isCurrent(advice, [], 'b2'), false);
  assert.equal(router.isCurrent(advice, [{ ...note, brain_context: { ...note.brain_context, revision: 'rev2' } }], 'b2'), false);
});

test('direct pinning and continuity restoration retain the snapshot', () => {
  const c = vm.createContext({
    loadedNoteContexts: [], loadEricMemoriesEnabled: () => false,
    noteFilenameIsCurrentContinuitySession: () => false, maxLoadedNotes: 8,
    log: () => {}, events: {}, updateLoadedNoteControls: () => {}, contextPanel: null,
    ericMemoryNoteContexts: () => [], loadedNoteContextDirty: false,
  });
  for (const name of ['rememberLoadedNoteContext', 'setLoadedNoteContextsForContinuity']) {
    const start = page.indexOf(`    function ${name}(`);
    const end = page.indexOf('\n    }\n', start);
    vm.runInContext(page.slice(start, end + 6), c);
  }
  c.rememberLoadedNoteContext({ ...note, status: 'ok' });
  assert.equal(c.loadedNoteContexts[0].brain_context.revision, 'rev1');
  c.setLoadedNoteContextsForContinuity([{ ...note, status: 'ok' }]);
  assert.equal(c.loadedNoteContexts[0].brain_context.brains.b4, 'fourth secret');
  c.rememberLoadedNoteContext({ ...note, content: '', status: 'ok' });
  assert.equal(c.loadedNoteContexts.length, 1);
  c.setLoadedNoteContextsForContinuity([{ ...note, content: '', status: 'ok' }]);
  assert.equal(c.loadedNoteContexts.length, 1);
});

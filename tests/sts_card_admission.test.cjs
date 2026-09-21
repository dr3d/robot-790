const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const router = require('../web/sts/note-brains.js');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');
const card = (name = 'card', size = 5000) => ({ status: 'ok', filename: `${name}.txt`, content: 'x'.repeat(size) + 'END',
  brain_context: { version: 1, revision: name, shared: 'SHARED', brains: { b2: 'PRIVATE B2', b3: 'PRIVATE B3' } } });

function fixture(notes = []) {
  const c = vm.createContext({
    loadedNoteContexts: notes, maxLoadedNoteChars: 64000, maxLoadedNoteCharsPerFile: 4500,
    maxTranscriptNoteChars: 64000, runtimeConfig: {},
    baseStartupNoteFilenames: [], loadEricMemoriesEnabled: () => true, ericMemoryNoteContexts: () => [],
    Robot790NoteBrains: router, textTail: (text, length) => text.slice(-length), loadedNoteRestoreEnvelope: () => '',
    noteFilenameIsCurrentContinuitySession: () => false, log() {}, events: {},
    updateLoadedNoteControls() {}, contextPanel: null,
  });
  for (const name of ['noteFilenameSet', 'noteFilenameInSet', 'loadedNotePromptContent',
    'loadedNoteLooksLikeTranscript', 'loadedNoteLooksLikeSessionNote', 'transcriptContextViewForPrompt',
    'clippedLoadedNoteContent', 'clippedTranscriptContextContent', 'clippedLoadedNotePromptContent',
    'formatLoadedNoteContextsForInstructions', 'loadedNoteAdmissionReport',
    'rememberLoadedNoteContext', 'setLoadedNoteContextsForContinuity', 'loadCurrentContinuitySession']) {
    const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    vm.runInContext(page.slice(start, page.indexOf('\n    }\n', start) + 6), c);
  }
  return c;
}

test('routed cards have complete bounded B1 views, private isolation and stable order', () => {
  const a = card('a'), b = card('b');
  const result = router.admit([a, b]);
  assert.match(result.text, /xEND/);
  assert.match(result.text, /SHARED/);
  assert.doesNotMatch(result.text, /PRIVATE/);
  assert.equal(result.text, router.admit([b, a]).text);
  assert.equal(result.characters, result.text.length);
  assert.deepEqual(router.forBrain(result.cards, 'b2').map(note => note.revision), ['a', 'b']);
});

test('exact rendered budget, eight-card bound and Unicode use explicit units', () => {
  const note = card(); note.content = '\u{1f680}'.repeat(100);
  const size = router.admit([note]).characters;
  assert.equal(router.admit([note], { b1_characters: size }).characters, size);
  assert.throws(() => router.admit([note], { b1_characters: size - 1 }), /budget/);
  const many = Array.from({ length: 9 }, (_, i) => card(`${i}`, 10));
  assert.throws(() => router.admit(many), /eight|8/);
  assert.throws(() => router.forBrain(many, 'b2'), /eight|8/);
  assert.throws(() => router.admit([note, note]), /Duplicate/);
  note.brain_context.shared = '\u{1f680}'.repeat(1200);
  assert.doesNotThrow(() => router.admit([note]));
  note.brain_context.shared += 'x';
  assert.throws(() => router.admit([note]), /1200/);
});

test('history cannot crowd out cards and cards do not reduce the admitted history', () => {
  const history = { filename: 'session.txt', content: 'STS Session Note\n[10:00] Robot 790: ' + 'h'.repeat(90000) };
  const c = fixture([history, card()]);
  const without = c.formatLoadedNoteContextsForInstructions([history]);
  const withCard = c.formatLoadedNoteContextsForInstructions(c.loadedNoteContexts);
  assert.ok(withCard.startsWith(without));
  assert.match(withCard, /xEND/);
  const report = c.loadedNoteAdmissionReport();
  assert.equal(report.notes.find(note => note.filename === 'card.txt').status, 'full');
  assert.equal(report.instruction_warnings, 0);
  assert.equal(report.assembled_characters, withCard.length);
});

test('ordinary pin additions preserve cards and all ordinary notes', () => {
  const note = card();
  const c = fixture([note, ...Array.from({ length: 8 }, (_, i) => ({ filename: `plain${i}`, content: 'ordinary' }))]);
  c.rememberLoadedNoteContext({ status: 'ok', filename: 'new', content: 'ordinary' });
  assert.equal(c.loadedNoteContexts.length, 10);
  assert.ok(c.loadedNoteContexts.includes(note));
  assert.equal(c.loadedNoteContexts.some(item => item.filename === 'plain7'), true);
});

test('failed direct and restored card sets preserve the previous snapshots and B2 packet', () => {
  const c = fixture([card('working')]);
  const before = c.loadedNoteContexts;
  const packet = JSON.stringify(router.forBrain(before, 'b2'));
  const huge = card('working', 40000);
  assert.throws(() => c.rememberLoadedNoteContext(huge), /budget/);
  assert.equal(c.loadedNoteContexts, before);
  assert.throws(() => c.setLoadedNoteContextsForContinuity([huge]), /budget/);
  assert.equal(c.loadedNoteContexts, before);
  assert.equal(JSON.stringify(router.forBrain(c.loadedNoteContexts, 'b2')), packet);
  c.rememberLoadedNoteContext(card('working', 100));
  assert.equal(c.loadedNoteContexts.length, 1);
  assert.equal(c.loadedNoteContexts[0].content.length, 103);
});

test('empty and unmarked notes create no card packet; B2-only declared notes are valid', () => {
  assert.equal(router.admit([]).text, '');
  assert.equal(router.admit([{ filename: 'setup-cards/plain.txt', content: '## B2\nnot a directive' }]).text, '');
  const note = card('private-only', 0); note.content = ''; note.brain_context.shared = '';
  const admitted = router.admit([note]);
  assert.equal(admitted.text, '');
  assert.equal(admitted.cards.length, 1);
  assert.equal(router.forBrain(admitted.cards, 'b2')[0].guidance, 'PRIVATE B2');
});

test('direct and restored ninth cards fail without evicting a working card', () => {
  const c = fixture(Array.from({ length: 8 }, (_, i) => card(`${i}`, 10)));
  const before = c.loadedNoteContexts;
  assert.throws(() => c.rememberLoadedNoteContext(card('ninth', 10)), /At most 8/);
  assert.throws(() => c.setLoadedNoteContextsForContinuity([...before, card('ninth', 10)]), /At most 8/);
  assert.equal(c.loadedNoteContexts, before);
  c.runtimeConfig = { note_cards: { max_cards: 2, b1_characters: 100 } };
  assert.throws(() => c.setLoadedNoteContextsForContinuity([card('small', 200)]), /budget/);
  assert.equal(c.loadedNoteContexts, before);
});

test('failed thread restoration keeps the prior cards and lineage, including malformed pins', async () => {
  for (const auto of [true, false]) {
    const c = fixture([card('working')]);
    const before = c.loadedNoteContexts;
    Object.assign(c, {
      currentContinuitySessionFilename: 'prior.txt', continuityParentForCurrentRun: 'prior.txt',
      readTextFile: async ({ filename }) => {
        if (filename === 'bad.txt') throw Object.assign(new Error('Invalid card'), { code: 'invalid_note_directives' });
        return { status: 'ok', filename, content: 'saved conversation' };
      },
    });
    const metadata = { session_filename: 'next.txt', pinned_notes: [{ filename: 'bad.txt', status: 'ok' }] };
    if (auto) metadata.history_notes = [card('too-large', 40000)];
    await assert.rejects(c.loadCurrentContinuitySession({ sessionMetadata: metadata, preflightComplete: true, resumeForm: 'raw' }), /budget|Invalid card/);
    assert.equal(c.loadedNoteContexts, before);
    assert.equal(c.currentContinuitySessionFilename, 'prior.txt');
    assert.equal(c.continuityParentForCurrentRun, 'prior.txt');
  }
});

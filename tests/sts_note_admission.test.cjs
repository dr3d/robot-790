const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { test } = require('node:test');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

function setup(notes, source = page) {
  const c = vm.createContext({
    loadedNoteContexts: notes, maxLoadedNoteChars: 64000,
    maxLoadedNoteCharsPerFile: 4500, maxTranscriptNoteChars: 64000,
    baseStartupNoteFilenames: ['core/erics_memories.txt'], loadEricMemoriesEnabled: () => true,
    Robot790NoteBrains: require('../web/sts/note-brains.js'),
    textTail: (text, length) => text.slice(-length), loadedNoteRestoreEnvelope: () => '',
  });
  for (const name of ['noteFilenameSet', 'noteFilenameInSet', 'loadedNotePromptContent',
    'loadedNoteLooksLikeTranscript', 'loadedNoteLooksLikeSessionNote', 'transcriptContextViewForPrompt',
    'clippedLoadedNoteContent', 'clippedTranscriptContextContent', 'clippedLoadedNotePromptContent',
    'formatLoadedNoteContextsForInstructions', 'loadedNoteAdmissionReport', 'listPinnedNotes',
    'rememberLoadedNoteContext', 'renderMemory']) {
    const start = source.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    if (start < 0) continue;
    const end = source.indexOf('\n    }\n', start);
    vm.runInContext(source.slice(start, end + 6), c);
  }
  return c;
}

const card = { filename: 'setup-cards/companion.txt', content: 'a'.repeat(5000) + 'IMPORTANT END',
  brain_context: { version: 1, revision: 'v1', shared: 'SHARED', brains: { b2: 'PRIVATE B2' } } };
const history = { filename: 'sessions/session.txt', content: 'STS Session Note\n[10:00] Robot 790: ' + 'h'.repeat(90000) };

test('admission reports actual per-file clipping, including declared instructions', () => {
  const c = setup([card]);
  const report = c.loadedNoteAdmissionReport();
  assert.equal(report.notes[0].status, 'partial');
  assert.equal(report.notes[0].instruction_bearing, true);
  assert.ok(report.notes[0].reasons.includes('per_file_limit'));
  assert.equal(report.instruction_warnings, 1);
  assert.equal(report.notes[0].source_characters, card.content.length);
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE B2|IMPORTANT END/);
  assert.equal(report.assembled_characters, c.formatLoadedNoteContextsForInstructions([card]).length);
});

test('aggregate omissions are not reported as admitted pins', () => {
  const c = setup([history, { filename: 'short.txt', content: 'WAS OMITTED' }]);
  const report = c.loadedNoteAdmissionReport();
  assert.equal(report.notes[0].status, 'partial');
  assert.equal(report.notes[1].status, 'omitted');
  assert.equal(report.notes[1].assembled_block_characters, 0);
  assert.equal(report.omitted_notes, 1);
  const pins = c.listPinnedNotes();
  assert.equal(pins.notes[1].b1_admission.status, 'omitted');
  assert.match(pins.meaning, /not guaranteed/);
});

test('disabled core memory, whole small notes and empty context report truthfully', () => {
  const c = setup([{ filename: 'core/erics_memories.txt', content: 'disabled' }, { filename: 'small.txt', content: 'whole' }]);
  c.loadEricMemoriesEnabled = () => false;
  const report = c.loadedNoteAdmissionReport();
  assert.equal(report.notes[0].status, 'disabled');
  assert.equal(report.notes[1].status, 'full');
  assert.equal(report.notes[1].source_characters, 5);
  assert.equal(setup([]).loadedNoteAdmissionReport().assembled_characters, 0);
});

test('the memory panel names partial admission without showing private brain guidance', () => {
  const c = setup([card]);
  Object.assign(c, {
    loadMemoryFacts: () => [], loadedNoteContextsForCurrentPrompt: () => [card],
    loadedNoteContextLine: filename => filename, updateLoadedNoteControls: () => {},
    memoryStatus: {}, memoryPreview: {}, location: { origin: 'http://localhost' }, memoryStorageKey: 'test',
  });
  c.renderMemory();
  assert.match(c.memoryStatus.textContent, /1 partial/);
  assert.match(c.memoryPreview.value, /companion.txt \[B1 partial\]/);
  assert.doesNotMatch(c.memoryPreview.value, /PRIVATE B2/);
});

test('existing pin-limit eviction is announced without changing its selection policy', () => {
  const notes = Array.from({ length: 8 }, (_, i) => ({ filename: `note${i}.txt`, content: `Note ${i}` }));
  const c = setup(notes);
  const logs = [];
  Object.assign(c, {
    maxLoadedNotes: 8, noteFilenameIsCurrentContinuitySession: () => false,
    events: {}, log: (_pane, text) => logs.push(text), contextPanel: null, updateLoadedNoteControls: () => {},
  });
  c.rememberLoadedNoteContext({ status: 'ok', filename: 'new.txt', content: 'New note' });
  assert.equal(c.loadedNoteContexts.length, 8);
  assert.equal(c.loadedNoteContexts.at(-1).filename, 'note6.txt');
  assert.ok(logs.some(line => /pin limit removed.*note7.txt/.test(line)));
});

// Baseline hashes are captured before instrumentation; prompt wording/order/budgets must not change.
const cases = [[], [card], [history, card, { filename: 'core/erics_memories.txt', content: 'CORE' }]];
const hashes = [
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  '9f76bc572fa875084f721aeb4ebd55b88904fe4d6d753062fab73aec911c6cd8',
  'd3df29bbadf0f641d6c75074817a8c8f4505bd8d5502e6a8e62efacd8eb88c59',
];
cases.forEach((notes, i) => test(`prompt bytes remain unchanged for admission case ${i}`, () => {
  const c = setup(notes);
  const text = c.formatLoadedNoteContextsForInstructions(notes);
  assert.equal(createHash('sha256').update(text).digest('hex'), hashes[i]);
}));

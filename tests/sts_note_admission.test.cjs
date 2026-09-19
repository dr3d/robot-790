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

test('admission reports declared instructions as complete in their separate allowance', () => {
  const c = setup([card]);
  const report = c.loadedNoteAdmissionReport();
  assert.equal(report.notes[0].status, 'full');
  assert.equal(report.notes[0].instruction_bearing, true);
  assert.equal(report.notes[0].reasons.length, 0);
  assert.equal(report.instruction_warnings, 0);
  assert.equal(report.routed_cards.count, 1);
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
  const plain = { ...card, brain_context: undefined };
  const c = setup([plain]);
  Object.assign(c, {
    loadMemoryFacts: () => [], loadedNoteContextsForCurrentPrompt: () => [plain],
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

// Empty is unchanged; routed-card goldens intentionally include the complete instructions.
const cases = [[], [card], [history, card, { filename: 'core/erics_memories.txt', content: 'CORE' }]];
const hashes = [
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  '4d7fd536d441b1dcd17f74ea2b8208e35d9d11dbb9f7b02341aea9c043d6f933',
  'fdce27046626b1dd37f65a7dd4eb793bdc295054c99ae6465fa43b35eded2547',
];
cases.forEach((notes, i) => test(`prompt golden for admission case ${i}`, () => {
  const c = setup(notes);
  const text = c.formatLoadedNoteContextsForInstructions(notes);
  assert.equal(createHash('sha256').update(text).digest('hex'), hashes[i]);
}));

// Compared byte-for-byte with the pre-repair formatter at 6c3c262.
const legacyCases = [
  [{ filename: 'plain.txt', content: 'Ordinary note' }],
  [{ filename: 'session.txt', content: 'STS Session Note\n[10:00] Robot 790: ' + 'h'.repeat(90000) },
    { filename: 'core/erics_memories.txt', content: 'CORE' }, { filename: 'last.txt', content: 'last' }],
];
const legacyHashes = [
  '2c179fbd9c25e93b1e0bc22a295be1af31e6bcead75354e6af4cb5206643748b',
  '3288b46975d8d74fef6249c7f0571d7598c010bd10254ec7511683a51c856ff1',
];
legacyCases.forEach((notes, i) => test(`unmarked-note prompt remains identical to the baseline ${i}`, () => {
  const text = setup(notes).formatLoadedNoteContextsForInstructions(notes);
  assert.equal(createHash('sha256').update(text).digest('hex'), legacyHashes[i]);
}));

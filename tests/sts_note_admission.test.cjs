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

test('complete ordinary pins are not omitted by the old aggregate character cap', () => {
  const c = setup([history, { filename: 'short.txt', content: 'WAS OMITTED' }]);
  const report = c.loadedNoteAdmissionReport();
  assert.equal(report.notes[0].status, 'partial');
  assert.equal(report.notes[1].status, 'full');
  assert.ok(report.notes[1].assembled_block_characters > 0);
  assert.equal(report.omitted_notes, 0);
  const pins = c.listPinnedNotes();
  assert.equal(pins.notes[1].b1_admission.status, 'full');
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

test('ordinary note tails are complete, without leaking private brain guidance', () => {
  const plain = { ...card, brain_context: undefined };
  const c = setup([plain]);
  Object.assign(c, {
    loadMemoryFacts: () => [], loadedNoteContextsForCurrentPrompt: () => [plain],
    loadedNoteContextLine: filename => filename, updateLoadedNoteControls: () => {},
    memoryStatus: {}, memoryPreview: {}, location: { origin: 'http://localhost' }, memoryStorageKey: 'test',
  });
  c.renderMemory();
  assert.doesNotMatch(c.memoryStatus.textContent, /1 partial/);
  assert.doesNotMatch(c.memoryPreview.value, /companion.txt \[B1 partial\]/);
  assert.match(c.formatLoadedNoteContextsForInstructions([plain]), /IMPORTANT END/);
  assert.doesNotMatch(c.memoryPreview.value, /PRIVATE B2/);
});

test('adding an ordinary note preserves every existing pin beyond eight files', () => {
  const notes = Array.from({ length: 8 }, (_, i) => ({ filename: `note${i}.txt`, content: `Note ${i}` }));
  const c = setup(notes);
  const logs = [];
  Object.assign(c, {
    events: {}, log: (_pane, text) => logs.push(text), contextPanel: null, updateLoadedNoteControls: () => {},
  });
  c.rememberLoadedNoteContext({ status: 'ok', filename: 'new.txt', content: 'New note' });
  assert.equal(c.loadedNoteContexts.length, 9);
  assert.deepEqual(Array.from(c.loadedNoteContexts.slice(1)), notes);
  assert.deepEqual(logs, ['loaded note pinned: new.txt']);
});

test('saved session reload preserves restored history, manifest, comparison and core pins', () => {
  const notes = [
    ...Array.from({ length: 6 }, (_, i) => ({ filename: `sessions/session${i}.txt`, content: `History ${i}` })),
    { filename: 'one-year-trip-manifest.txt', content: 'YEAR MANIFEST' },
    { filename: 'next-trip-comparison.txt', content: 'TRIP COMPARISON' },
    { filename: 'core/erics_memories.txt', content: 'CORE' },
  ];
  const c = setup(notes);
  Object.assign(c, { events: {}, log() {}, contextPanel: null, updateLoadedNoteControls() {} });
  c.rememberLoadedNoteContext({ status: 'ok', filename: 'sessions/new.txt', content: 'New session' });
  assert.equal(c.loadedNoteContexts.length, 10);
  assert.deepEqual(Array.from(c.loadedNoteContexts.slice(1)), notes);
  assert.match(c.formatLoadedNoteContextsForInstructions(c.loadedNoteContexts), /YEAR MANIFEST/);
  assert.match(c.formatLoadedNoteContextsForInstructions(c.loadedNoteContexts), /TRIP COMPARISON/);
  c.rememberLoadedNoteContext({ status: 'ok', filename: 'one-year-trip-manifest.txt', content: 'UPDATED MANIFEST' });
  assert.equal(c.loadedNoteContexts.length, 10);
  assert.equal(c.loadedNoteContexts[0].content, 'UPDATED MANIFEST');
  assert.equal(c.loadedNoteContexts.filter(note => note.filename === 'one-year-trip-manifest.txt').length, 1);
  assert.ok(c.loadedNoteContexts.some(note => note.filename === 'sessions/new.txt'));
});

// Empty is unchanged; routed-card goldens intentionally include the complete instructions.
const cases = [[], [card], [history, card, { filename: 'core/erics_memories.txt', content: 'CORE' }]];
const hashes = [
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  '4d7fd536d441b1dcd17f74ea2b8208e35d9d11dbb9f7b02341aea9c043d6f933',
  '13ce8b200785af65c62b5eb650d7a9445d920d9d54df301bc84a478e17550bf4',
];
cases.forEach((notes, i) => test(`prompt golden for admission case ${i}`, () => {
  const c = setup(notes);
  const text = c.formatLoadedNoteContextsForInstructions(notes);
  assert.equal(createHash('sha256').update(text).digest('hex'), hashes[i]);
}));

// Small ordinary notes are unchanged; aggregate clipping is intentionally gone.
const legacyCases = [
  [{ filename: 'plain.txt', content: 'Ordinary note' }],
  [{ filename: 'session.txt', content: 'STS Session Note\n[10:00] Robot 790: ' + 'h'.repeat(90000) },
    { filename: 'core/erics_memories.txt', content: 'CORE' }, { filename: 'last.txt', content: 'last' }],
];
const legacyHashes = [
  '2c179fbd9c25e93b1e0bc22a295be1af31e6bcead75354e6af4cb5206643748b',
  '2f16aafacd117d03022343a690f5e91787fa9e56ea353d73fbfa71a65186cc22',
];
legacyCases.forEach((notes, i) => test(`unmarked-note prompt complete-admission golden ${i}`, () => {
  const text = setup(notes).formatLoadedNoteContextsForInstructions(notes);
  assert.equal(createHash('sha256').update(text).digest('hex'), legacyHashes[i]);
}));

test('frame ten survives ordinary note assembly and connection measurement', () => {
  const trail = { filename: 'mars-return-trail.txt', content: 'Frame five\n' + 'x'.repeat(8000) + '\nFRAME TEN HOME SAFE' };
  const c = setup([trail]);
  const text = c.formatLoadedNoteContextsForInstructions([trail]);
  assert.ok(text.includes(trail.content));
  assert.doesNotMatch(text, /Note clipped/);
  assert.equal(c.loadedNoteAdmissionReport().notes[0].status, 'full');
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

function source(name) {
  const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
  const end = page.indexOf('\n    }\n', start);
  assert.ok(start >= 0 && end > start, name);
  return page.slice(start, end + 6);
}

function fixture() {
  const saved = [], beacons = [], storage = new Map();
  const c = vm.createContext({
    conversationLines: [], conversationLineMetadata: [], conversationProsodyByIndex: {},
    inputDraft: '', transcriptControlDetails: { checked: false },
    transcriptControlDetailsStorageKey: 'details', transcriptProsodyMode: null, eventLogFilter: null,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    formatProsodyForTranscript: value => value || '',
    renderConversation() {}, renderEvents() {}, noteConversationActivity() {},
    recordLogSnapshot: async (kind, text) => { saved.push({ kind, text }); return { filename: 'test' }; },
    lastAutosavedLogText: new Map(), events: {}, log() {}, setTimeout() {},
    navigator: { sendBeacon: (url, blob) => beacons.push(blob) }, Blob, URL,
    location: { href: 'http://localhost/' },
    logSnapshotHeader: () => 'Snapshot',
  });
  for (const name of ['conversationDisplayTextRange', 'conversationDisplayText',
    'conversationVisibleText', 'conversationLineMetadataFromDate', 'conversationLine',
    'addConversation', 'replaceConversation', 'transcriptToken',
    'addSensingEyeVisualNoteTranscriptMarker', 'recordingSnapshotPaneText',
    'recordLogPane', 'autosaveLogPane', 'beaconLogSnapshot',
    'loadLogDisplayControls', 'saveLogDisplayControls', 'logSnapshotText',
    'conversationTranscriptSinceCleanConnect']) vm.runInContext(source(name), c);
  c.addConversation('You: Show the picture.');
  c.addSensingEyeVisualNoteTranscriptMarker('recalled into eye', {
    id: 'eye-1', name: 'harbor', savedFilename: 'harbor.png', createdAt: '2026-09-12',
  });
  c.addConversation('Robot 790: Here is harbor.png from my sensing-eye notes.');
  c.conversationProsodyByIndex[2] = 'v: warm';
  return { c, saved, beacons, storage };
}

test('only explicitly tagged receipts hide; speech and original prosody indices survive', () => {
  const { c } = fixture();
  assert.equal(c.conversationLineMetadata[1].channel, 'control');
  const visible = c.conversationVisibleText();
  assert.doesNotMatch(visible, /System:|logs\/sensing-eye/);
  assert.match(visible, /Robot 790: Here is harbor.png from my sensing-eye notes\.\n  v: warm/);
  assert.match(c.conversationDisplayText(), /System:.*eye-1/);
  const before = JSON.stringify(c.conversationLines);
  c.transcriptControlDetails.checked = true;
  assert.equal(c.conversationVisibleText(), c.conversationDisplayText());
  c.transcriptControlDetails.checked = false;
  assert.equal(c.conversationVisibleText(), visible);
  assert.equal(JSON.stringify(c.conversationLines), before);
});

test('text-note receipts also hide, drafts remain visible, replacement preserves metadata', () => {
  const { c } = fixture();
  c.addSensingEyeVisualNoteTranscriptMarker('opened', { id: 'text-1', kind: 'text', name: 'note', characters: 400 });
  assert.doesNotMatch(c.conversationVisibleText(), /text-1/);
  assert.match(c.conversationDisplayText(), /text note opened.*text-1/);
  c.replaceConversation(1, 'System: [updated receipt]');
  assert.equal(c.conversationLineMetadata[1].channel, 'control');
  c.inputDraft = 'You: still speaking';
  assert.match(c.conversationVisibleText(), /You: still speaking\n$/);
  assert.doesNotMatch(c.conversationVisibleText(), /updated receipt/);
});

test('Copy uses the clean pane; every recording and continuity path keeps receipts', async () => {
  const { c, saved, beacons } = fixture();
  const target = { textContent: c.conversationVisibleText() };
  assert.doesNotMatch(c.logSnapshotText(target, 'conversation'), /System:/);
  assert.match(c.recordingSnapshotPaneText('conversation'), /System:/);
  assert.match(c.conversationTranscriptSinceCleanConnect(), /System:/);
  await c.recordLogPane({ textContent: 'Record' }, target, 'conversation');
  await c.autosaveLogPane(target, 'conversation');
  c.lastAutosavedLogText.clear();
  c.beaconLogSnapshot(target, 'conversation');
  assert.equal(saved.length, 2);
  for (const snapshot of saved) assert.match(snapshot.text, /System:.*eye-1/);
  assert.match(JSON.parse(await beacons[0].text()).content, /System:.*eye-1/);
  assert.match(source('formatSessionNote'), /conversationDisplayText\(\)\.trimEnd\(\)/);
  assert.match(source('firstContactReportText'), /conversationDisplayText\(\)/);
  assert.match(source('deliberateContextSnapshot'), /conversationDisplayText\(\)/);
});

test('details default off, persist independently, and both visible surfaces use the filter', () => {
  const { c, storage } = fixture();
  c.transcriptControlDetails.checked = true;
  c.loadLogDisplayControls();
  assert.equal(c.transcriptControlDetails.checked, false);
  c.transcriptControlDetails.checked = true;
  c.saveLogDisplayControls();
  assert.equal(storage.get('details'), 'true');
  c.transcriptControlDetails.checked = false;
  c.loadLogDisplayControls();
  assert.equal(c.transcriptControlDetails.checked, true);
  assert.match(source('renderConversation'), /conversationVisibleText\(\)/);
  assert.match(source('logPanePopoutConfig'), /conversationVisibleText\(\)/);
});

const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { loadFunctions, page } = require('./helpers/sts_tool_harness.cjs');

function fixture() {
  const saved = [], sent = [];
  const c = vm.createContext({
    conversationLines: ['[11:59:59 PM] You: A thought?', '[12:00:01 AM] Robot 790: A reply.'],
    conversationLineMetadata: [
      { iso: '2026-09-20T03:59:59.000Z', channel: 'dialogue' },
      { iso: '2026-09-20T04:00:01.000Z', channel: 'dialogue' }
    ],
    brain2AuditEntries: [{ at: '2026-09-20T04:00:00.000Z', kind: 'note for Eric', text: 'PRIVATE' }],
    brain2Log: { textContent: 'B2 original' }, events: { textContent: 'events' },
    conversation: {}, eventLogLines: ['events'], log() {}, updateBrain2Status() {},
    conversationDisplayText: () => 'original conversation',
    lastAutosavedLogText: new Map(),
    recordLogSnapshot: async (source, content) => { saved.push({ source, content }); return { filename: source }; },
    recordingStopReportText: () => 'report',
    navigator: { sendBeacon: (url, body) => { sent.push({ url, body }); return true; } },
    location: { href: 'http://localhost:8790/' }, URL, Blob,
  });
  loadFunctions(c, ['companionAuditText', 'logBrain2', 'recordingSnapshotPaneText',
    'recordThreePaneSnapshots', 'recordAudioStopSnapshots', 'autosaveLogPane', 'autosaveSessionLogs',
    'beaconLogSnapshot', 'beaconAllLogSnapshots']);
  return { c, saved, sent };
}

test('combined audit orders across midnight and labels private versus transcript lanes without mutating memory', () => {
  const { c } = fixture();
  const before = JSON.stringify([c.conversationLines, c.conversationLineMetadata, c.brain2AuditEntries]);
  const text = c.companionAuditText();
  assert.ok(text.indexOf('You:') < text.indexOf('PRIVATE'));
  assert.ok(text.indexOf('PRIVATE') < text.indexOf('Robot 790:'));
  assert.match(text, /\[B2 \/ note for Eric\] PRIVATE/);
  assert.match(text, /not proof that audio was heard/);
  assert.equal(JSON.stringify([c.conversationLines, c.conversationLineMetadata, c.brain2AuditEntries]), before);
});

test('audit uses final transcript replacements and retains complete private notes', () => {
  const { c } = fixture();
  const advice = 'n'.repeat(1000);
  c.logBrain2('note for Eric', advice);
  c.conversationLines[1] = '[12:00:01 AM] Robot 790: Corrected reply.';
  c.conversationLineMetadata[1].channel = 'control';
  const text = c.companionAuditText();
  assert.ok(text.includes(advice));
  assert.match(text, /Conversation \/ control.*Corrected reply/);
  assert.doesNotMatch(text, /Robot 790: A reply/);
});

test('manual/exit and recording-stop snapshots add audit without replacing original panes', async () => {
  const { c, saved } = fixture();
  await c.recordThreePaneSnapshots();
  assert.deepEqual(saved.map(x => x.source), ['conversation', 'events', 'brain2_mulling', 'companion_audit']);
  assert.equal(saved[0].content, 'original conversation');
  saved.length = 0;
  await c.recordAudioStopSnapshots();
  assert.deepEqual(saved.map(x => x.source), ['conversation', 'brain2_mulling', 'events', 'companion_audit', 'recording_stop_report']);
});

test('autosave deduplicates unchanged audit and includes new B2 evidence', async () => {
  const { c, saved } = fixture();
  await c.autosaveLogPane(null, 'companion_audit');
  await c.autosaveLogPane(null, 'companion_audit');
  assert.equal(saved.length, 1);
  c.logBrain2('voice started', 'heard only if output works');
  await c.autosaveLogPane(null, 'companion_audit');
  assert.equal(saved.length, 2);
  assert.match(saved[1].content, /B2 \/ voice started/);
});

test('periodic and unload wiring include audit without an audio recording', async () => {
  const { c, saved, sent } = fixture();
  c.autosaveSessionLogs();
  await Promise.resolve();
  assert.ok(saved.some(entry => entry.source === 'companion_audit'));
  c.lastAutosavedLogText.clear();
  c.beaconAllLogSnapshots();
  const payloads = await Promise.all(sent.map(async entry => JSON.parse(await entry.body.text())));
  assert.ok(payloads.some(entry => entry.source === 'companion_audit' && entry.content.includes('PRIVATE')));
});

test('both B2 pane reset paths reset audit history too', () => {
  const resets = [...page.matchAll(/brain2Log\.textContent = "";/g)];
  assert.equal(resets.length, 2);
  assert.match(page, /conversationLineMetadata = \[\];\s+brain2AuditEntries = \[\];/);
  assert.match(page, /brain2Log\.textContent = "";\s+brain2AuditEntries = \[\];/);
});

test('1000-character advice reaches the existing private B1 admission boundary intact', () => {
  const note = 'n'.repeat(1000), sent = [];
  const c = vm.createContext({
    brain2NoteCandidates: [{ text: note, at: 200, b1OutputId: 'reply-1' }],
    brain2RevisionCandidates: [], brain2QuestionCandidates: [], lastUserTurnActivityAt: 100,
    ws: {}, lastBrain2AdvisorySocket: null, lastBrain2AdvisoryText: '',
    realtimeConnected: () => true, performanceModeEnabled: () => false,
    send: event => sent.push(event), rememberPromptLedger() {}, logBrain2() {},
  });
  loadFunctions(c, ['formatBrain2AdvisoryContent', 'appendBrain2AdvisoryToConversation']);
  assert.equal(c.appendBrain2AdvisoryToConversation(), true);
  assert.ok(sent[0].item.content[0].text.includes(note));
  assert.equal(c.appendBrain2AdvisoryToConversation(), false);
  assert.equal(sent.length, 1);
});

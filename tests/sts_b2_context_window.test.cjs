const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

test('B2 can retain an old request after its completion leaves the transcript window', () => {
  const request = '[6:37:05 AM] You: Draw forgetting.';
  const receipt = '[6:37:21 AM] System: [sensing-eye visual note opened into B1 context: id eye-2]';
  const rows = [request, receipt, '[6:37:23 AM] Robot 790: There it is.'];
  rows.push(...Array.from({ length: 24 }, (_, i) => `[8:00:00 AM] Robot 790: Later thought ${i}.`));
  const c = vm.createContext({
    Robot790Brain2Evidence: require('../web/sts/brain2-evidence.js'),
    Date, conversationLines: rows, conversationLineMetadata: [], conversationProsodyByIndex: {},
    realtimeSessionGeneration: 2, brain2EvidenceGeneration: 1, brain2LastEvidence: null,
    micRuntimeLabel: () => 'on', audioRecordingActive: () => false,
    visionImageUrl: 'new.jpg', visionImageName: 'a later image', sensingTextContent: '', sensingTextName: '',
    imageTaskReceipt: { generated: 'a later image' }, fileWriteReceipts: [], visionCameraActive: () => false,
    idleHardBrakeActive: () => false, conversationAttentionEnabled: () => false,
    searchContextReceipts: [], brain2SetupCards: () => [], loadedNoteContexts: [],
    Robot790NoteBrains: { forBrain: () => [] },
    conversationLinesForCurrentPromptContext: n => rows.slice(-n),
  });
  for (const name of ['brain2EvidenceSnapshot', 'brain2ConversationContext']) {
    const start = page.indexOf(`    function ${name}(`);
    const end = page.indexOf('\n    }\n', start);
    assert.ok(start >= 0 && end > start);
    require('./helpers/sts_connection_harness.cjs').installRealtimeConnection(c);
    vm.runInContext(page.slice(start, end + 6), c);
  }
  const snapshot = c.brain2EvidenceSnapshot();
  assert.equal(snapshot.latest_user_utterance.text, request);
  assert.equal(snapshot.conversation.length, 18);
  assert.ok(!snapshot.conversation.some(row => row.text === receipt));
  assert.ok(!c.brain2ConversationContext().includes('eye-2'));
  // This records the current information gap, not a desired permanent policy.
  assert.equal(snapshot.runtime.sensing_eye_image, 'a later image');
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync('web/sts/index.html', 'utf8').replace(/\r\n/g, '\n');

function fixture() {
  const calls = [];
  const logs = [];
  const timers = new Map();
  let timerId = 0;
  let now = 100000;
  const c = vm.createContext({
    llmTools: { checked: true }, matchingConfiguredEmbodimentKey: () => 'reachy_mini',
    normalizeFaceBaseUrl: () => 'http://127.0.0.1:8792/',
    faceVisualHoldRevision: 2, realtimeStopRequested: false, realtimeConnected: () => true,
    brain2MouthBrainEnabled: () => true, userSpeechActive: false, userTurnPending: () => false,
    responseActive: false, outputAudioActive: () => false, pendingToolCalls: 0, toolFollowupNeeded: false,
    faceVisualHoldActive: () => false, gazeHoldActive: () => false, brain2LastBodyCueAt: 0,
    brain2EvidenceSnapshot: () => ({ user_key: 'u1', last_assistant_output_id: 'a1' }),
    Date: { now: () => now }, AbortSignal, rememberBrain2Output: () => {},
    brain2PendingBodyCue: null, brain2BodyCueTimer: null, realtimeSessionGeneration: 1,
    currentPromptContextModeKey: () => 'normal',
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id),
    logBrain2: (...args) => logs.push(args), withFaceVisualHold: (_, fn) => fn(),
    postFaceTo: async (...args) => { calls.push(args); return { status: 'accepted', ok: true }; },
  });
  for (const name of ['brain2BodyContext', 'clearBrain2BodyCue', 'brain2BodyCueBlockedReason', 'scheduleBrain2BodyCue', 'surfaceBrain2BodyCue']) {
    const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    const end = page.indexOf('\n    }\n', start);
    assert.ok(start > 0 && end > start);
    vm.runInContext(page.slice(start, end + 6), c);
  }
  return { c, calls, logs, timers, time: value => { now = value; }, result: { body_beat: 'thoughtful',
    observed_body: { url: 'http://127.0.0.1:8792/', revision: 2 },
    observed_evidence: { user_key: 'u1', last_assistant_output_id: 'a1' } } };
}

test('B2 uses one low-priority gesture, no speech or extra model request', async () => {
  const { c, calls, result } = fixture();
  await c.surfaceBrain2BodyCue(result);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], 'beat');
  assert.equal(calls[0][2].source, 'brain2');
  await c.surfaceBrain2BodyCue(result);
  assert.equal(calls.length, 1); // real-time cooldown, never compressed by lab speed
});

for (const reason of ['speech', 'held', 'turn', 'body', 'tools', 'revision', 'disconnected', 'brain2off', 'assistant', 'user', 'unknown']) {
  test(`B2 drops ${reason} cue without queuing it`, async () => {
    const { c, calls, logs, result } = fixture();
    if (reason === 'speech') c.userSpeechActive = true;
    if (reason === 'held') c.faceVisualHoldActive = () => true;
    if (reason === 'turn') c.userTurnPending = () => true;
    if (reason === 'body') c.matchingConfiguredEmbodimentKey = () => 'browser_face';
    if (reason === 'tools') c.llmTools.checked = false;
    if (reason === 'revision') c.faceVisualHoldRevision++;
    if (reason === 'disconnected') c.realtimeConnected = () => false;
    if (reason === 'brain2off') c.brain2MouthBrainEnabled = () => false;
    if (reason === 'assistant') result.observed_evidence.last_assistant_output_id = 'older';
    if (reason === 'user') result.observed_evidence.user_key = 'older';
    if (reason === 'unknown') result.body_beat = 'wake';
    await c.surfaceBrain2BodyCue(result);
    assert.equal(calls.length, 0);
    assert.equal(c.brain2PendingBodyCue, null);
    assert.ok(logs.length);
  });
}

test('playback defers a fresh cue once, without extending its deadline', async () => {
  const { c, calls, logs, result, time } = fixture();
  c.outputAudioActive = () => true;
  await c.surfaceBrain2BodyCue(result);
  assert.equal(calls.length, 0);
  assert.equal(c.brain2PendingBodyCue.expiresAt, 115000);
  time(109000);
  await c.surfaceBrain2BodyCue(result, { deferred: true });
  assert.equal(c.brain2PendingBodyCue.expiresAt, 115000);
  c.outputAudioActive = () => false;
  await c.surfaceBrain2BodyCue(result, { deferred: true });
  assert.equal(calls.length, 1);
  assert.equal(c.brain2PendingBodyCue, null);
  assert.ok(logs.some(row => row[0] === 'body cue deferred'));
});

for (const change of ['user', 'assistant', 'session', 'context', 'expiry', 'body', 'hold', 'stop']) {
  test(`deferred cue cannot outlive ${change}`, async () => {
    const { c, calls, result, timers, time } = fixture();
    c.outputAudioActive = () => true;
    await c.surfaceBrain2BodyCue(result);
    c.outputAudioActive = () => false;
    if (change === 'user') c.userSpeechActive = true;
    if (change === 'assistant') c.brain2EvidenceSnapshot = () => ({ user_key: 'u1', last_assistant_output_id: 'a2' });
    if (change === 'session') c.realtimeSessionGeneration++;
    if (change === 'context') c.currentPromptContextModeKey = () => 'first-contact';
    if (change === 'expiry') time(115001);
    if (change === 'body') c.faceVisualHoldRevision++;
    if (change === 'hold') c.gazeHoldActive = () => true;
    if (change === 'stop') c.realtimeStopRequested = true;
    [...timers.values()][0]();
    await Promise.resolve();
    assert.equal(calls.length, 0);
    assert.equal(c.brain2PendingBodyCue, null);
  });
}

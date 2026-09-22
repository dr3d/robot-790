const assert = require('node:assert/strict');
const { test } = require('node:test');
const { closeFixture, installClosingMic } = require('./helpers/sts_close_harness.cjs');
const { deferred, settle } = require('./helpers/sts_save_harness.cjs');

test('current socket closure keeps accepted words, eye assets and parent without inventing a save', async () => {
  const f = await closeFixture(), { c } = f;
  const parent = c.continuityParentForCurrentRun, notes = [...c.loadedNoteContexts];
  f.socket.close();
  await settle();
  assert.deepEqual([...c.conversationLines], ['Keep this unsaved exchange.']);
  assert.deepEqual([...c.eyeAssets], ['retained.jpg']);
  assert.equal(c.continuityParentForCurrentRun, parent);
  assert.deepEqual([...c.loadedNoteContexts], notes);
  assert.equal(c.continuitySaveHalted, false);
  assert.equal(f.requests.length, 0, 'pane snapshots are not a continuity save');
  assert.equal(f.calls.filter(call => call === 'pane snapshots').length, 1);
  assert(!f.calls.includes('clear old transcript'));
});

test('current close disables live controls and clears idle, B2 and image-protection work', async () => {
  const { c, calls, socket } = await closeFixture();
  socket.close();
  for (const name of ['disconnectButton', 'startMicButton', 'stopMicButton',
    'resetMicButton', 'faceIdleButton', 'faceBeatButton', 'idlePonderNowButton']) {
    assert.equal(c[name].disabled, true, name);
  }
  for (const name of ['idleTimer', 'imageToolProtectionTimer']) assert.equal(c[name], null, name);
  for (const name of ['idleTimerFireAt', 'imageToolProtectionUntil', 'assistantFinishArmedAt']) assert.equal(c[name], 0, name);
  for (const name of ['responseActive', 'idleInFlight', 'brain2InFlight', 'gpuWatchInFlight',
    'standingRoutineInFlight', 'imageToolProtectionEnabled', 'assistantFinishPending',
    'assistantFinishWasIdle', 'micMutedForNarration', 'visionImageStaged']) assert.equal(c[name], false, name);
  for (const call of ['browser camera stop', 'network camera stop', 'release preparation lease',
    'clearBrain2Timer', 'clearBrain2SurfaceTimer', 'cancelBrain2MonitorSpeech',
    'clearAssistantFinishTimer', 'clearMicFreshnessTimer', 'clearUserTurnPending',
    'GPU watch stop', 'standing routine stop', 'mic stop', 'clear audio queue']) assert(calls.includes(call), call);
  assert.equal(c.realtimeConnected(), false);
});

test('obsolete close and error callbacks cannot stop newer resources or touch its UI', async () => {
  const f = await closeFixture(), newer = { readyState: 1 };
  f.c.realtimeConnection.adopt(newer);
  f.socket.listeners.close();
  f.socket.listeners.error();
  await settle();
  assert.deepEqual(f.calls, []);
  assert.equal(f.c.realtimeConnected(), true);
  assert.equal(f.c.micStream !== null, true);
});

test('socket error alone does not claim a save, reconnect, or perform close cleanup', async () => {
  const f = await closeFixture();
  f.socket.listeners.error();
  assert.deepEqual(f.calls, ['state: Socket error', 'websocket error']);
  assert.equal(f.requests.length, 0);
  assert.equal(f.sockets.length, 1);
  assert.deepEqual([...f.c.conversationLines], ['Keep this unsaved exchange.']);
});

test('failed opening with no dialogue creates no continuity session and releases the lease', async () => {
  const f = await closeFixture();
  f.c.conversationLines = [];
  f.socket.readyState = 0;
  f.socket.close();
  await settle();
  assert(f.calls.includes('release preparation lease'));
  assert.equal(f.requests.length, 0);
  assert.equal(f.c.connectButton.disabled, false);
});

test('intentional close leaves async mic, recording and snapshot cleanup with its caller', async () => {
  const f = await closeFixture();
  f.c.intentionalExitCleanupInProgress = true;
  f.c.audioRecordingActive = () => true;
  f.socket.close();
  await settle();
  assert(!f.calls.includes('mic stop'));
  assert(!f.calls.includes('recording stop'));
  assert(!f.calls.includes('pane snapshots'));
  assert(f.calls.includes('browser camera stop'));
  assert.equal(f.requests.length, 0);
});

test('normal Disconnect composes the real close callback without duplicate cleanup or saving', async () => {
  const f = await closeFixture();
  const result = await f.c.disconnectRealtime();
  await settle();
  assert.equal(result.status, 'ok');
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].body, 'Keep this unsaved exchange.');
  assert.equal(f.calls.filter(call => call === 'mic stop').length, 1);
  assert.equal(f.calls.filter(call => call === 'pane snapshots').length, 1);
  assert.equal(f.c.realtimeConnection.transition, null);
  assert.equal(f.c.continuitySaveHalted, true);
});

for (const state of ['recording', 'finalizing', 'pending stop']) {
  test(`unexpected close requests recording finalization when ${state}`, async () => {
    const f = await closeFixture();
    f.c.audioRecordingActive = () => state === 'recording';
    f.c.audioRecordFinalizing = state === 'finalizing';
    f.c.audioRecordStopPromise = state === 'pending stop' ? Promise.resolve() : null;
    f.socket.close();
    await settle();
    assert.equal(f.calls.filter(call => call === 'recording stop').length, 1);
    assert(f.calls.includes('audio recording stopped for disconnect: ok'));
    assert.equal(f.requests.length, 0);
  });
}

test('asynchronous close cleanup failures remain visible without an unhandled rejection', async () => {
  const f = await closeFixture();
  f.c.audioRecordingActive = () => true;
  f.c.stopAudioRecording = async () => { throw new Error('recording fixture failure'); };
  f.c.stopMic = async () => { throw new Error('mic fixture failure'); };
  f.c.recordExitPaneSnapshots = async () => { throw new Error('snapshot fixture failure'); };
  f.socket.close();
  await settle();
  assert(f.calls.includes('audio recording stop after disconnect error: recording fixture failure'));
  assert(f.calls.includes('mic stop after disconnect error: mic fixture failure'));
  assert(f.calls.includes('disconnect snapshots error: snapshot fixture failure'));
  assert.equal(f.requests.length, 0);
});

test('real mic teardown stops old tracks before awaiting AudioContext closure', async () => {
  const f = await closeFixture(), gate = deferred();
  installClosingMic(f, gate);
  f.socket.close();
  try {
    assert(f.calls.indexOf('old track stopped') < f.calls.indexOf('old context closing'));
    assert(f.calls.includes('old processor detached'));
    assert(f.calls.includes('old source detached'));
  } finally { gate.resolve(); await settle(); }
  assert.equal(f.c.micStream, null);
  assert.equal(f.c.micContext, null);
});

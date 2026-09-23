const assert = require('node:assert/strict');
const { test } = require('node:test');
const { exitFixture, holdExitStep } = require('./helpers/sts_exit_harness.cjs');
const { deferred, settle } = require('./helpers/sts_save_harness.cjs');
const { installClosePlayback, installClosingMic } = require('./helpers/sts_close_harness.cjs');

for (const method of ['stopAudioRecording', 'stopMic', 'recordExitPaneSnapshots']) {
  for (const reject of [false, true]) {
    test(`old Restart cannot affect a replacement session after ${method} ${reject ? 'rejects' : 'finishes'}`, async () => {
      const f = await exitFixture();
      f.c.audioRecordingActive = () => true;
      const gate = holdExitStep(f, method);
      const restarting = f.c.restartRealtimeServer();
      await gate.started;
      const replacement = { readyState: 1, close() { throw new Error('closed newer socket'); } };
      f.c.realtimeConnection.adopt(replacement);
      const newMic = f.c.micStream = {};
      f.c.conversationLines = ['New session words.'];
      f.c.eyeAssets = ['new-eye.jpg'];
      const before = f.calls.length;
      if (reject) gate.reject(new Error('old cleanup failed'));
      else gate.resolve();
      await restarting;
      await settle();
      assert.equal(f.backendRequests.length, 0, 'an expired Restart must not reach the backend');
      assert.equal(f.c.micStream, newMic);
      assert.ok(!f.calls.slice(before).includes('clear audio queue'));
      assert.ok(!f.calls.slice(before).includes('pane snapshots'));
      assert.ok(!f.calls.slice(before).some(call => call.startsWith('state:')));
      assert.deepEqual([...f.c.conversationLines], ['New session words.']);
      assert.deepEqual([...f.c.eyeAssets], ['new-eye.jpg']);
      assert.equal(f.c.realtimeConnection.busy, false);
      assert.equal(f.c.restartServerButton.disabled, false);
    });
  }

  test(`Restart owns the connection transition while ${method} is pending`, async () => {
    const f = await exitFixture();
    f.c.audioRecordingActive = () => true;
    const gate = holdExitStep(f, method);
    const restarting = f.c.restartRealtimeServer();
    await gate.started;
    assert.equal(f.c.realtimeConnection.transition?.kind, 'restart');
    const before = f.calls.length;
    await f.c.restartRealtimeServer();
    await f.c.connect();
    await f.c.disconnectRealtime();
    assert.equal(f.sockets.length, 1);
    assert.equal(f.requests.length, 0, 'a competing Disconnect cannot start a save');
    assert.ok(!f.calls.slice(before).includes('recording stop'));
    gate.resolve();
    await restarting;
    await settle();
    assert.equal(f.backendRequests.length, 1);
    assert.equal(f.c.realtimeConnection.busy, false);
    f.fireStatusTimer('restart');
    assert.equal(f.c.connectButton.disabled, false);
    assert.equal(f.c.restartServerButton.disabled, false);
  });

  test(`Restart still completes after current-session ${method} failure`, async () => {
    const f = await exitFixture();
    f.c.audioRecordingActive = () => true;
    const gate = holdExitStep(f, method);
    const restarting = f.c.restartRealtimeServer();
    await gate.started;
    gate.reject(new Error('fixture device failure'));
    await restarting;
    await settle();
    assert.equal(f.backendRequests.length, 1);
    assert.equal(f.backendRequests[0].pathname, '/api/realtime/restart');
    assert.equal(f.calls.filter(call => call === 'socket close').length, 1);
    assert.equal(f.calls.filter(call => call === 'pane snapshots').length, 1);
    assert.equal(f.c.realtimeConnection.busy, false);
    assert.equal(f.requests.length, 0);
  });
}

test('Restart cannot interrupt connection preparation or a pending continuity save', async () => {
  for (const saving of [false, true]) {
    const f = await exitFixture(), gate = deferred(), fetch = f.c.fetch;
    f.c.fetch = async (...args) => {
      if (new URL(args[0]).pathname === '/api/continuity/save-transaction') await gate.promise;
      return fetch(...args);
    };
    const pending = saving ? f.c.disconnectRealtime()
      : f.c.runConnectionTransition('connect', () => gate.promise);
    await settle();
    const before = f.calls.length, cleanupGeneration = f.c.intentionalExitCleanupGeneration;
    await f.c.restartRealtimeServer();
    assert.equal(f.backendRequests.length, 0);
    assert.equal(f.c.intentionalExitCleanupGeneration, cleanupGeneration);
    assert.ok(!f.calls.slice(before).includes('mic stop'));
    assert.ok(!f.calls.slice(before).includes('socket close'));
    gate.resolve();
    await pending;
    assert.equal(f.requests.length, saving ? 1 : 0);
  }
});

test('Restart captures the requested model settings before delayed cleanup', async () => {
  const f = await exitFixture(), gate = holdExitStep(f, 'recordExitPaneSnapshots');
  const restarting = f.c.restartRealtimeServer();
  await gate.started;
  f.c.currentModelRestartPayload = () => ({ preset: 'later-selection', context: 65536 });
  gate.resolve();
  await restarting;
  assert.deepEqual(JSON.parse(f.backendRequests[0].body), { preset: 'fixture-model', context: 131072 });
});

test('Restart remains exclusive during HTTP dispatch, without retrying an uncertain request', async () => {
  const f = await exitFixture(), gate = deferred(), fetch = f.c.fetch;
  f.c.fetch = async (...args) => { await fetch(...args); await gate.promise; throw new Error('receipt lost'); };
  const restarting = f.c.restartRealtimeServer();
  await settle();
  assert.equal(f.c.realtimeConnection.transition?.kind, 'restart');
  await f.c.restartRealtimeServer();
  assert.equal(f.backendRequests.length, 1);
  gate.resolve();
  await restarting;
  assert.equal(f.backendRequests.length, 1, 'no automatic backend retry');
  assert.equal(f.c.realtimeConnection.busy, false);
  assert.equal(f.c.restartServerButton.disabled, false);
  assert.ok(f.calls.includes('state: Restart failed'));
});

test('newer intentional cleanup cancels Restart before backend dispatch', async () => {
  const f = await exitFixture(), gate = holdExitStep(f, 'recordExitPaneSnapshots');
  const restarting = f.c.restartRealtimeServer();
  await gate.started;
  f.c.beginIntentionalExitCleanup();
  const before = f.calls.length;
  gate.resolve();
  await restarting;
  assert.equal(f.backendRequests.length, 0);
  assert.ok(!f.calls.slice(before).includes('socket close'));
  assert.ok(!f.calls.slice(before).includes('clear audio queue'));
});

test('a lost restart receipt releases the transition; late success cannot touch a replacement session', async () => {
  const f = await exitFixture(), gate = deferred(), fetch = f.c.fetch;
  f.c.fetch = async (...args) => { const response = await fetch(...args); await gate.promise; return response; };
  const restarting = f.c.restartRealtimeServer();
  await settle();
  f.fireTimer(30000);
  await restarting;
  assert.equal(f.c.realtimeConnection.busy, false);
  assert.equal(f.c.restartServerButton.disabled, false);
  assert.equal(f.c.disconnectButton.disabled, false, 'retained words can still be saved');
  assert.ok(f.calls.includes('realtime restart receipt missing: backend outcome unknown; no automatic retry'));
  f.c.realtimeConnection.adopt({ readyState: 1 });
  const before = [...f.calls];
  gate.resolve();
  await settle();
  assert.deepEqual(f.calls, before);
  assert.equal(f.backendRequests.length, 1);
});

test('Restart closes its own connecting socket and keeps unsaved words available for Disconnect', async () => {
  const f = await exitFixture();
  f.socket.readyState = 0;
  await f.c.restartRealtimeServer();
  await settle();
  f.fireStatusTimer('restart');
  assert.equal(f.socket.readyState, 3);
  assert.equal(f.backendRequests.length, 1);
  assert.equal(f.c.disconnectButton.disabled, false);
  await f.c.connect();
  assert.equal(f.sockets.length, 1, 'unsaved transcript still blocks reconnect');
  const result = await f.c.disconnectRealtime();
  assert.equal(result.status, 'ok');
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].body, 'Keep this unsaved exchange.');
});

test('Restart defers to current unexpected-close cleanup', async () => {
  const f = await exitFixture(), gate = holdExitStep(f, 'stopMic');
  f.socket.close();
  await gate.started;
  const before = f.calls.length;
  await f.c.restartRealtimeServer();
  assert.equal(f.backendRequests.length, 0);
  assert.ok(!f.calls.slice(before).includes('pane snapshots'));
  gate.resolve();
  await settle();
  assert.equal(f.c.realtimeConnection.busy, false);
  assert.equal(f.c.disconnectButton.disabled, false);
});

test('Restart rechecks ownership inside the deferred HTTP step', async () => {
  const f = await exitFixture(), setState = f.c.setState;
  f.c.setState = value => {
    setState(value);
    if (value === 'Restarting realtime') f.c.realtimeConnection.adopt({ readyState: 1 });
  };
  await f.c.restartRealtimeServer();
  assert.equal(f.backendRequests.length, 0);
  assert.ok(f.calls.includes('realtime restart canceled before dispatch: session or cleanup ownership changed'));
});

test('timed-out mic closure cannot clear newer mic or playback resources', async () => {
  const f = await exitFixture(), gate = deferred();
  installClosingMic(f, gate);
  const restarting = f.c.restartRealtimeServer();
  await settle();
  f.fireTimer(6000);
  await restarting;
  await settle();
  assert.equal(f.backendRequests.length, 1);
  f.c.realtimeConnection.adopt({ readyState: 1 });
  const newMic = f.c.micStream = {}, newContext = f.c.micContext = {};
  const audio = installClosePlayback(f);
  await audio.playback.play(audio.pcm(1));
  gate.resolve();
  await settle();
  assert.equal(f.c.micStream, newMic);
  assert.equal(f.c.micContext, newContext);
  assert.equal(audio.sources[0].stops, 0);
  assert.equal(f.backendRequests.length, 1);
  audio.playback.stop();
});

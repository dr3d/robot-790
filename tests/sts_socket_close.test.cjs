const assert = require('node:assert/strict');
const { test } = require('node:test');
const { closeFixture, installClosingMic, installClosePlayback } = require('./helpers/sts_close_harness.cjs');
const { deferred, settle } = require('./helpers/sts_save_harness.cjs');
const { loadFunctions } = require('./helpers/sts_tool_harness.cjs');

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
    'GPU watch stop', 'standing routine stop', 'mic stop', 'stop playback']) assert(calls.includes(call), call);
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
  f.c.beginIntentionalExitCleanup();
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

for (const state of ['running', 'suspended']) {
  test(`socket loss stops scheduled audio with a ${state} audio clock`, async () => {
    const f = await closeFixture(), a = installClosePlayback(f);
    try {
      await a.playback.play(a.pcm(30));
      await a.playback.play(a.pcm(15));
      a.playback.enqueue(a.pcm(0.05));
      f.c.audioContext.state = state;
      assert.equal(a.playback.isActive(), true);
      f.socket.close();
      assert.equal(a.playback.isActive(), false);
      assert(a.sources.every(source => source.stops === 1));
      assert(f.calls.includes('stop speech mouth'));
      assert.equal(f.requests.length, 0, 'audio cleanup does not invent a continuity save');
    } finally { a.playback.stop(); }
  });
}

test('socket loss invalidates pending audio setup without blocking fresh audio after reconnect', async () => {
  const f = await closeFixture(), a = installClosePlayback(f), gate = deferred();
  f.c.ensurePlayback = () => gate.promise;
  const pending = a.playback.play(a.pcm(3));
  try {
    f.socket.close();
    assert.equal(a.playback.isActive(), false);
    gate.resolve();
    await pending;
    assert.equal(a.sources.length, 0, 'old setup cannot start speech after close');
    f.c.realtimeConnection.adopt({ readyState: 1 });
    f.c.ensurePlayback = async () => {};
    await a.playback.play(a.pcm(1));
    assert.equal(a.sources.length, 1);
    assert.equal(a.playback.isActive(), true);
    assert.equal(a.sources[0].startAt, f.c.audioContext.currentTime + 0.03);
  } finally { gate.resolve(); await pending; a.playback.stop(); }
});

test('old socket close cannot silence audio belonging to the new connection', async () => {
  const f = await closeFixture(), a = installClosePlayback(f);
  f.c.realtimeConnection.adopt({ readyState: 1 });
  try {
    await a.playback.play(a.pcm(3));
    f.socket.listeners.close();
    assert.equal(a.playback.isActive(), true);
    assert.equal(a.sources[0].stops, 0);
    assert(!f.calls.includes('stop speech mouth'));
  } finally { a.playback.stop(); }
});

test('close after normal playback stop is harmless and retains the accepted transcript', async () => {
  const f = await closeFixture(), a = installClosePlayback(f);
  await a.playback.play(a.pcm(3));
  f.c.stopPlaybackNow();
  f.c.beginIntentionalExitCleanup();
  f.socket.close();
  f.socket.listeners.close();
  assert.equal(a.playback.isActive(), false);
  assert.equal(a.sources[0].stops, 1);
  assert.deepEqual([...f.c.conversationLines], ['Keep this unsaved exchange.']);
  assert.equal(f.requests.length, 0);
});

test('socket error without closure does not cancel current playback', async () => {
  const f = await closeFixture(), a = installClosePlayback(f);
  try {
    await a.playback.play(a.pcm(3));
    f.socket.listeners.error();
    assert.equal(a.playback.isActive(), true);
    assert.equal(a.sources[0].stops, 0);
  } finally { a.playback.stop(); }
});

test('lost connection retains unsaved dialogue until Disconnect saves it, then permits Connect', async () => {
  const f = await closeFixture();
  f.socket.close();
  await settle();
  assert.equal(f.c.realtimeConnection.stopped, true);
  assert.equal(f.c.disconnectButton.disabled, false, 'existing Disconnect is the save/retry action');
  await f.c.connect();
  await f.c.connect({ coreNotesOnly: true });
  assert.equal(f.sockets.length, 1);
  assert.deepEqual([...f.c.conversationLines], ['Keep this unsaved exchange.']);
  assert.equal(f.requests.length, 0, 'no automatic save on transport loss');
  assert.equal((await f.c.disconnectRealtime()).status, 'ok');
  assert.equal(f.requests.length, 1);
  await f.c.connect();
  assert.equal(f.sockets.length, 2);
});

for (const stage of ['stopMic', 'stopAudioRecording', 'recordExitPaneSnapshots']) {
  test(`unexpected close owns cleanup until ${stage} settles`, async () => {
    const f = await closeFixture(), gate = deferred();
    f.c.audioRecordingActive = () => true;
    f.c[stage] = () => gate.promise;
    f.socket.close();
    try {
      assert.equal(f.c.connectButton.disabled, true);
      assert.equal(f.c.disconnectButton.disabled, true);
      await f.c.connect();
      await f.c.disconnectRealtime();
      assert.equal(f.sockets.length, 1);
      assert.equal(f.requests.length, 0);
    } finally { gate.resolve(); await settle(); }
    assert.equal(f.c.connectButton.disabled, false);
    assert.equal(f.c.disconnectButton.disabled, false);
  });
}

test('duplicate close callbacks share cleanup instead of finalizing resources twice', async () => {
  const f = await closeFixture(), gate = deferred();
  f.c.stopMic = async () => { f.calls.push('mic stop'); await gate.promise; };
  f.socket.close();
  f.socket.listeners.close();
  try { assert.equal(f.calls.filter(call => call === 'mic stop').length, 1); }
  finally { gate.resolve(); await settle(); }
  assert.equal(f.calls.filter(call => call === 'pane snapshots').length, 1);
});

test('late mic close completion cannot clear fresh resources or reset fresh UI', async () => {
  const f = await closeFixture(), gate = deferred();
  installClosingMic(f, gate);
  const stopping = f.c.stopMic();
  const stream = {}, context = {}, source = {}, processor = {};
  Object.assign(f.c, { micStream: stream, micContext: context, micSource: source, micProcessor: processor });
  f.c.startMicButton.disabled = true;
  f.c.stopMicButton.disabled = false;
  gate.resolve();
  await stopping;
  assert.equal(f.c.micStream, stream);
  assert.equal(f.c.micContext, context);
  assert.equal(f.c.micSource, source);
  assert.equal(f.c.micProcessor, processor);
  assert.equal(f.c.startMicButton.disabled, true);
  assert.equal(f.c.stopMicButton.disabled, false);
});

test('rejected mic context close still detaches stopped resources', async () => {
  const f = await closeFixture(), gate = deferred();
  installClosingMic(f, gate);
  const stopping = f.c.stopMic();
  const rejected = assert.rejects(stopping, /context failed/);
  gate.reject(new Error('context failed'));
  await rejected;
  assert.equal(f.c.micStream, null);
  assert.equal(f.c.micContext, null);
  assert.equal(f.c.stopMicButton.disabled, true);
});

test('previous exit grace period cannot suppress cleanup of a newly adopted socket', async () => {
  const f = await closeFixture();
  await f.c.disconnectRealtime();
  assert.equal(f.c.intentionalExitCleanupInProgress, true);
  await f.c.connect();
  const next = f.sockets.at(-1);
  f.c.micStream = {};
  const before = f.calls.filter(call => call === 'mic stop').length;
  next.readyState = 3;
  next.listeners.close();
  await settle();
  assert.equal(f.calls.filter(call => call === 'mic stop').length, before + 1);
});

for (const failSave of [false, true]) {
  test(`loss during a pending save preserves its transaction (${failSave ? 'failure and retry' : 'success'})`, async () => {
    const f = await closeFixture(), gate = deferred(), fetch = f.c.fetch;
    f.c.audioRecordingActive = () => true;
    f.c.fetch = async (...args) => { await gate.promise; return fetch(...args); };
    const stopping = f.c.disconnectRealtime();
    await settle();
    f.socket.close();
    await settle();
    assert(f.calls.includes('recording stop'), 'transport loss still finalizes recording if the save cannot finish');
    assert.equal(f.c.connectButton.disabled, true);
    await f.c.connect();
    assert.equal(f.sockets.length, 1);
    if (failSave) gate.reject(new Error('page service unavailable'));
    else gate.resolve();
    const result = await stopping;
    assert.equal(result.status, failSave ? 'error' : 'ok');
    if (failSave) {
      assert.equal(f.c.disconnectButton.disabled, false);
      assert.deepEqual([...f.c.conversationLines], ['Keep this unsaved exchange.']);
      f.c.fetch = fetch;
      assert.equal((await f.c.disconnectRealtime()).status, 'ok');
    }
    assert.equal(f.requests.length, 1);
    await f.c.connect();
    assert.equal(f.sockets.length, 2);
  });
}

test('loss immediately after a failed save still performs device cleanup', async () => {
  const f = await closeFixture(), fetch = f.c.fetch;
  f.c.fetch = async () => { throw new Error('offline'); };
  assert.equal((await f.c.disconnectRealtime()).status, 'error');
  f.c.audioRecordingActive = () => true;
  f.socket.close();
  await settle();
  assert(f.calls.includes('recording stop'));
  assert.equal(f.c.disconnectButton.disabled, false);
  f.c.fetch = fetch;
  assert.equal((await f.c.disconnectRealtime()).status, 'ok');
});

test('failed save does not unlock retry while loss cleanup is still finalizing recording', async () => {
  const f = await closeFixture(), write = deferred(), recording = deferred();
  f.c.fetch = () => write.promise;
  f.c.audioRecordingActive = () => true;
  f.c.stopAudioRecording = () => recording.promise;
  const stopping = f.c.disconnectRealtime();
  await settle();
  f.socket.close();
  write.reject(new Error('offline'));
  try {
    assert.equal((await stopping).status, 'error');
    assert.equal(f.c.disconnectButton.disabled, true);
    assert.equal(f.c.connectButton.disabled, true);
  } finally { recording.resolve(); await settle(); }
  assert.equal(f.c.disconnectButton.disabled, false);
});

test('all context replacement entry points preserve unsaved words after loss', async () => {
  const f = await closeFixture();
  loadFunctions(f.c, ['connectPrevious', 'connectSelectedContinuityFilename', 'loadPreviousContinuityContext']);
  Object.assign(f.c, {
    currentContinuityScrubMode: () => 'auto', normalizeContinuityScrubMode: value => value,
    continuityScrubMode: null,
    rewindContinuitySessionToPrevious: async () => ({ restored_session_filename: 'sessions/previous.txt' }),
    fetchContinuitySessionMetadata: async filename => ({ session_filename: filename }),
  });
  f.socket.close();
  await settle();
  await f.c.connectPrevious();
  await assert.rejects(f.c.connectSelectedContinuityFilename('sessions/other.txt'), /not saved/);
  assert.equal(f.sockets.length, 1);
  assert(!f.calls.includes('clear old transcript'));
  assert.equal(f.requests.length, 0);
});

for (const stage of ['permission', 'device refresh']) {
  test(`late mic ${stage} cannot install resources into a newer session`, async () => {
    const f = await closeFixture(), gate = deferred();
    let stops = 0;
    const oldStream = { getTracks: () => [{ stop() { stops++; } }] };
    Object.assign(f.c, {
      micStream: null, resetInputAudioBuffer() {}, selectedMicDeviceId: () => '',
      navigator: { mediaDevices: { getUserMedia: () => stage === 'permission' ? gate.promise : Promise.resolve(oldStream) } },
      refreshMicDevices: () => stage === 'device refresh' ? gate.promise : Promise.resolve(),
      AudioContext: class { constructor() { throw new Error('Stale setup must not create an audio context'); } },
    });
    loadFunctions(f.c, ['startMic']);
    const starting = f.c.startMic();
    await settle();
    f.socket.close();
    await settle();
    const newStream = {}, newContext = {};
    f.c.realtimeConnection.adopt({ readyState: 1 });
    f.c.micStream = newStream;
    f.c.micContext = newContext;
    gate.resolve(oldStream);
    await starting;
    assert(stops > 0);
    assert.equal(f.c.micStream, newStream);
    assert.equal(f.c.micContext, newContext);
  });
}

test('current microphone setup still streams audio and ignores callbacks after replacement', async () => {
  const f = await closeFixture();
  let constraints;
  const stream = { getTracks: () => [] }, processor = { connect() {} };
  Object.assign(f.c, {
    micStream: null, resetInputAudioBuffer() {}, selectedMicDeviceId: () => 'fixture-mic',
    navigator: { mediaDevices: { getUserMedia: async options => { constraints = options; return stream; } } },
    refreshMicDevices: async () => {}, attachMicToRecording() {}, syncMicPanelToMic() {},
    micDeviceReportLabel: () => 'fixture', autoAudioRecordEnabled: () => false,
    audioRecordStatus: {}, scheduleMicFreshnessCheck() {}, updateMicLevelMeters() {},
    brain2MonitorAudioShouldMuteMic: () => false, maybeBargeInFromMicFrame() {},
    resample: input => input, float32ToPcm16: input => input, bytesToB64: () => 'fixture-pcm',
    AudioContext: class {
      sampleRate = 16000;
      createMediaStreamSource(input) { assert.equal(input, stream); return { connect() {} }; }
      createScriptProcessor() { return processor; }
    },
  });
  loadFunctions(f.c, ['startMic']);
  await f.c.startMic();
  assert.deepEqual(JSON.parse(JSON.stringify(constraints)), { audio: {
    echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1,
    deviceId: { exact: 'fixture-mic' },
  } });
  assert.equal(f.c.startMicButton.disabled, true);
  assert.equal(f.c.stopMicButton.disabled, false);
  f.c.micMutedForNarration = false;
  const event = { inputBuffer: { getChannelData: () => new Float32Array([0.1, -0.1]) } };
  processor.onaudioprocess(event);
  assert.equal(f.calls.filter(call => call === 'input_audio_buffer.append').length, 1);
  f.c.realtimeConnection.adopt({ readyState: 1 });
  processor.onaudioprocess(event);
  assert.equal(f.calls.filter(call => call === 'input_audio_buffer.append').length, 1);
});

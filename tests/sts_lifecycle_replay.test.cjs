const assert = require('node:assert/strict');
const { test } = require('node:test');
const { fixture, loadFunctions } = require('./helpers/sts_tool_harness.cjs');
const { fixture: imageFixture } = require('./helpers/sts_image_harness.cjs');
const { installAudioPlayback } = require('./helpers/sts_audio_harness.cjs');

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

// Compose production handoffs; network, DOM, audio hardware and durable saving are fake.
function replay() {
  const f = fixture();
  const { c } = f;
  const images = imageFixture(c);
  const timers = new Map(), sources = [], transcripts = [];
  let timerId = 0;
  const socket = () => ({ readyState: 1, send: text => f.sent.push(JSON.parse(text)) });
  Object.assign(c, {
    WebSocket: { OPEN: 1 }, ws: socket(), realtimeStopRequested: false,
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: id => timers.delete(id),
    performance: { now: () => 0 }, llmRunOverview: null, observeContextUsage() {},
    responseOutputSuppressed: event => c.suppressedResponseIds.has(event.response_id),
    gpuWatchInFlight: false, standingRoutineInFlight: false,
    gpuWatchRoutine: null, standingRoutine: null, sessionMapRequestEpoch: 0,
    clearLabGoalAfterOneShotResponse() {}, updateLanePressure() {},
    updateIdleSchedulerStatus() {}, scheduleFaceIdle() {},
    assistantFinishPending: false, assistantFinishTimer: null,
    assistantFinishWasIdle: false, assistantFinishArmedAt: 0,
    noteConversationActivity() {},
    recordingDestination: null, ensurePlayback: async () => {}, ensureEricPlaybackGain: () => null,
    pcm16ToFloat32: bytes => new Float32Array(bytes.length / 2),
    resetMicInterruptCandidate() {}, stopSpeechMouthCue() {},
    audioContext: {
      currentTime: 0, state: 'running', destination: {},
      createBuffer: (_, size, rate) => ({ duration: size / rate, copyToChannel() {} }),
      createBufferSource() {
        const source = { connect() {}, start(at) { this.startAt = at; }, stop() { this.stopped = true; } };
        sources.push(source);
        return source;
      },
    },
    continuitySaveHalted: true, conversationLines: [],
    idleArt: { reset() {}, assertCanRender() {}, history: [] }, cancelBrain2MonitorSpeech() {},
    clearHotConversationState() { c.conversationLines = []; },
    clearSensingEyeState: async () => { c.sensingEyeGeneration++; c.visionImageUrl = ''; },
    clearInputDraft() {},
    recordUserTranscript(text) { transcripts.push(text); return { accepted: true, index: 0 }; },
    rememberConversationProsody() {},
  });
  loadFunctions(c, ['activeRealtimeSession', 'send', 'handleEvent',
    'resetSessionContextForConnection', 'clearAssistantFinishTimer',
    'armAssistantUtteranceFinished', 'checkAssistantUtteranceFinished',
    'clearAudioQueue', 'outputAudioActive', 'stopPlaybackNow', 'playPcm16Bytes', 'flushAudioQueue']);
  installAudioPlayback(c);
  c.executeTool = async (name, args) => {
    f.calls.push({ name, args });
    if (name === 'generate_image') return c.generateImage(args);
    if (name === 'move_generated_image_to_sensing_eye') return c.moveGeneratedImageToSensingEye(args);
    return { status: 'ok' };
  };
  const event = (type, extra = {}, owner) => c.handleEvent({ type, ...extra }, owner);
  const done = (status = 'completed', owner) => event('response.done', {
    response_id: 'response', response: { status },
  }, owner);
  const tick = () => {
    const pending = [...timers.entries()];
    for (const [id, callback] of pending) {
      if (timers.delete(id)) callback();
    }
  };
  const reconnect = async () => {
    c.realtimeStopRequested = true;
    c.stopPlaybackNow();
    await c.resetSessionContextForConnection('replay reconnect');
    c.ws = socket();
    c.realtimeStopRequested = false;
  };
  const receipts = () => f.sent.filter(e => e.item?.type === 'function_call_output')
    .map(e => JSON.parse(e.item.output));
  return { ...f, images, sources, timers, transcripts, event, done, tick, reconnect, receipts };
}

test('image completes after user activity, retains receipt, then retrieval waits for actual speech drain', async () => {
  const f = replay(), { c } = f;
  const gate = deferred(), fetch = c.fetch;
  c.fetch = async (url, options) => {
    if (options?.method === 'POST') await gate.promise;
    return fetch(url, options);
  };
  const drawing = f.tool('generate_image', { prompt: 'Harbor' });
  f.done();
  assert.equal(f.responses().length, 0);
  c.lastUserTurnActivityAt++;
  gate.resolve(); await drawing;
  const receipt = f.receipts()[0];
  assert.equal(receipt.retained, true, JSON.stringify(receipt));
  assert.equal(c.generatedImageUrl, '');
  assert.equal(c.visionImageUrl, '/operator.jpg');
  assert.equal(f.responses().length, 0, 'old turn must not speak over the new user turn');
  await c.playPcm16Bytes(new Uint8Array(16000 * 2 * 5));
  await f.tool(receipt.retrieval.tool, receipt.retrieval.arguments);
  f.done(); f.tick();
  assert.equal(f.images.staged.length, 1);
  assert.equal(f.receipts()[1].source_image, receipt.filename);
  assert.equal(f.responses().length, 0, 'response.done is not playback done');
  c.audioContext.currentTime = 5.04;
  f.tick(); f.tick();
  assert.equal(f.responses().length, 1);
  assert.equal(f.images.requests.filter(r => r.options?.method === 'POST').length, 1);
  await f.reconnect();
  f.tick();
  assert.equal(c.imageTaskReceipt, null);
  assert.equal(c.toolFollowupNeeded, false);
  assert.equal(c.outputAudioActive(), false);
  assert.equal(f.responses().length, 1);
});

test('response completion and tool receipt may arrive in either order without duplicate continuation', async () => {
  for (const responseFirst of [false, true]) {
    const f = replay(), gate = deferred();
    f.c.executeTool = () => gate.promise;
    const pending = f.tool('search_web');
    if (responseFirst) f.done();
    gate.resolve({ status: 'ok' }); await pending;
    if (!responseFirst) f.done();
    f.done(); f.tick();
    assert.equal(f.receipts().length, 1);
    assert.equal(f.responses().length, 1);
    assert.equal(f.c.pendingToolCalls, 0);
  }
});

test('old socket completion cannot decrement new work or release its followup', async () => {
  const f = replay(), oldGate = deferred(), newGate = deferred();
  const oldOwner = { socket: f.c.ws, generation: f.c.realtimeSessionGeneration };
  f.c.executeTool = () => oldGate.promise;
  const oldWork = f.tool('search_web'); f.done();
  await f.reconnect();
  f.c.executeTool = () => newGate.promise;
  const newWork = f.tool('read_text_file'); f.done();
  oldGate.resolve({ status: 'ok', old: true }); await oldWork;
  f.done('completed', oldOwner);
  assert.equal(f.c.pendingToolCalls, 1);
  assert.equal(f.receipts().length, 0);
  assert.equal(f.responses().length, 0);
  newGate.resolve({ status: 'ok', current: true }); await newWork;
  assert.equal(f.c.pendingToolCalls, 0);
  assert.equal(f.receipts().length, 1);
  assert.equal(f.receipts()[0].current, true);
  assert.equal(f.responses().length, 1);
});

test('canceled response retains a late artifact but cannot stage it or resume speech', async () => {
  const f = replay(), gate = deferred(), fetch = f.c.fetch;
  f.c.fetch = async (...args) => { await gate.promise; return fetch(...args); };
  const work = f.tool('generate_image', { prompt: 'Harbor' });
  f.done('cancelled');
  gate.resolve(); await work; f.tick();
  assert.equal(f.receipts()[0].retained, true, JSON.stringify(f.receipts()[0]));
  assert.equal(f.images.staged.length, 0);
  assert.equal(f.c.generatedImageUrl, '');
  assert.equal(f.responses().length, 0);
});

test('stopped session accepts final user transcription but ignores response and tool events', async () => {
  const f = replay();
  f.c.realtimeStopRequested = true;
  f.event('conversation.item.input_audio_transcription.completed', { transcript: 'Save this last thought.' });
  f.event('response.function_call_arguments.done', {
    name: 'generate_image', arguments: '{"prompt":"late"}', call_id: 'late',
  });
  f.event('response.output_audio.delta', { delta: 'late audio' });
  f.done(); f.tick();
  assert.deepEqual(f.transcripts, ['Save this last thought.']);
  assert.equal(f.calls.length, 0);
  assert.equal(f.sources.length, 0);
  assert.equal(f.responses().length, 0);
});

test('failed save blocks reconnect reset without discarding the stopped conversation', async () => {
  const f = replay(), { c } = f;
  c.realtimeStopRequested = true;
  c.continuitySaveHalted = false;
  c.conversationLines = ['Unsaved final thought.'];
  const generation = c.realtimeSessionGeneration;
  await assert.rejects(c.resetSessionContextForConnection('retry'), /not saved/);
  assert.equal(c.realtimeSessionGeneration, generation);
  assert.deepEqual(c.conversationLines, ['Unsaved final thought.']);
});

test('audio setup and a pending drain callback cannot survive reconnect', async () => {
  const f = replay(), gate = deferred(), { c } = f;
  c.ensurePlayback = () => gate.promise;
  const audio = c.playPcm16Bytes(new Uint8Array(32000));
  await f.tool('search_web'); f.done();
  const staleCallback = f.timers.get(c.toolFollowupDrainTimer);
  assert.equal(typeof staleCallback, 'function');
  await f.reconnect();
  gate.resolve(); await audio;
  staleCallback();
  assert.equal(f.sources.length, 0);
  assert.equal(f.responses().length, 0);
  assert.equal(c.pendingToolCalls, 0);
  assert.equal(c.outputAudioActive(), false);
});

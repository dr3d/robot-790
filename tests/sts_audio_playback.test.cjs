const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { installAudioPlayback } = require('./helpers/sts_audio_harness.cjs');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

function fixture() {
  let wall = 100000;
  const sources = [];
  const timers = new Map(), errors = [];
  let timerId = 0;
  let released = 0;
  const c = vm.createContext({
    Date: { now: () => wall },
    setTimeout: (callback, ms) => { timers.set(++timerId, { callback, ms }); return timerId; },
    clearTimeout: id => timers.delete(id),
    atob: text => Buffer.from(text, 'base64').toString('binary'),
    events: {}, log: (_, text) => errors.push(text),
    assistantFinishTimer: null, assistantFinishPending: true,
    assistantFinishWasIdle: false, assistantFinishArmedAt: 100000,
    lastAssistantResponseDoneAt: 0, responseActive: false,
    realtimeSessionGeneration: 1, realtimeStopRequested: false,
    recordingDestination: null, ensurePlayback: async () => {},
    ensureEricPlaybackGain: () => null,
    resetMicInterruptCandidate() {}, stopSpeechMouthCue() {},
    noteConversationActivity: () => released++,
    audioContext: {
      currentTime: 100, state: 'running', destination: {},
      createBuffer: (channels, n, rate) => ({ duration: n / rate, channels, rate,
        copyToChannel(samples) { this.samples = samples; } }),
      createBufferSource() {
        const source = { targets: [], connect(target) { this.targets.push(target); },
          start(at) { this.startAt = at; }, stop() { this.stopped = true; } };
        sources.push(source);
        return source;
      }
    }
  });
  for (const name of ['clearAssistantFinishTimer', 'checkAssistantUtteranceFinished',
    'clearAudioQueue', 'outputAudioActive', 'stopPlaybackNow', 'playPcm16Bytes',
    'pcm16ToFloat32', 'b64ToBytes', 'queueAudioDelta', 'flushAudioQueue', 'outputAudioPlaying']) {
    const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    assert(start >= 0, name);
    const end = page.indexOf('\n    }\n', start);
    vm.runInContext(page.slice(start, end + 6), c, { filename: name });
  }
  const playback = installAudioPlayback(c);
  return { c, playback, sources, timers, errors, wall: value => { wall = value; }, released: () => released };
}
const pcm = seconds => new Uint8Array(seconds * 16000 * 2);

test('long playback survives the old timeout and subsequent audio is serialized', async () => {
  const { c, sources, wall, released } = fixture();
  await c.playPcm16Bytes(pcm(150));
  wall(240000);
  c.audioContext.currentTime = 240;
  c.checkAssistantUtteranceFinished();
  assert.equal(released(), 0);
  assert.equal(c.assistantFinishPending, true);
  assert.equal(sources.length, 1);
  assert.equal(c.outputAudioActive(), true);
  await c.playPcm16Bytes(pcm(5));
  assert.equal(sources[1].startAt, sources[0].startAt + 150);
  c.audioContext.currentTime = 255.04;
  c.checkAssistantUtteranceFinished();
  assert.equal(released(), 1);
  assert.equal(c.outputAudioActive(), false);
});

test('suspended audio is not declared finished by wall time', async () => {
  const { c, wall, released } = fixture();
  await c.playPcm16Bytes(pcm(100));
  c.audioContext.state = 'suspended';
  wall(1000000);
  c.checkAssistantUtteranceFinished();
  assert.equal(released(), 0);
  assert.equal(c.outputAudioActive(), true);
});

test('last 80 milliseconds remain busy and missed onended recovers at the actual endpoint', async () => {
  const { c, sources } = fixture();
  await c.playPcm16Bytes(pcm(1));
  c.audioContext.currentTime = sources[0].startAt + 0.95;
  assert.equal(c.outputAudioActive(), true);
  c.audioContext.currentTime = sources[0].startAt + 1;
  assert.equal(c.outputAudioActive(), false);
  assert.equal(c.outputAudioPlaying(), false);
});

test('onended releases activity once after all chunks drain', async () => {
  const { c, sources, released } = fixture();
  await c.playPcm16Bytes(pcm(1));
  await c.playPcm16Bytes(pcm(1));
  c.audioContext.currentTime = 101.03;
  sources[0].onended();
  assert.equal(released(), 0);
  c.audioContext.currentTime = 102.04;
  sources[1].onended();
  c.checkAssistantUtteranceFinished();
  assert.equal(released(), 1);
});

test('Stop still owns and stops every scheduled source after a long wait', async () => {
  const { c, sources, wall } = fixture();
  await c.playPcm16Bytes(pcm(100));
  await c.playPcm16Bytes(pcm(100));
  wall(300000);
  c.checkAssistantUtteranceFinished();
  c.stopPlaybackNow();
  assert(sources.every(source => source.stopped));
  assert.equal(c.outputAudioActive(), false);
});

test('pending browser setup is busy and Stop invalidates it without blocking new audio', async () => {
  const { c, sources } = fixture();
  let ready;
  c.ensurePlayback = () => new Promise(resolve => { ready = resolve; });
  const pending = c.playPcm16Bytes(pcm(10));
  assert.equal(c.outputAudioActive(), true);
  c.checkAssistantUtteranceFinished();
  assert.equal(c.assistantFinishPending, true);
  c.stopPlaybackNow();
  assert.equal(c.outputAudioActive(), false);
  c.ensurePlayback = async () => {};
  await c.playPcm16Bytes(pcm(1));
  ready();
  await pending;
  assert.equal(sources.length, 1);
  assert.equal(c.outputAudioActive(), true);
});

test('pending setup failures release the busy marker', async () => {
  const { c, released } = fixture();
  c.ensurePlayback = async () => { throw new Error('unavailable'); };
  await assert.rejects(c.playPcm16Bytes(pcm(1)), /unavailable/);
  assert.equal(c.outputAudioActive(), false);
  assert.equal(released(), 1);
});

test('pending setup from an old connection cannot reach a new connection', async () => {
  const { c, sources } = fixture();
  let ready;
  c.ensurePlayback = () => new Promise(resolve => { ready = resolve; });
  const pending = c.playPcm16Bytes(pcm(1));
  c.realtimeSessionGeneration++;
  ready();
  await pending;
  assert.equal(sources.length, 0);
  assert.equal(c.outputAudioActive(), false);
});

test('unscheduled bytes and active generation independently prevent finish', () => {
  const { c, playback, released } = fixture();
  playback.enqueue(new Uint8Array(100));
  c.checkAssistantUtteranceFinished();
  assert.equal(released(), 0);
  c.clearAudioQueue();
  c.responseActive = true;
  c.checkAssistantUtteranceFinished();
  assert.equal(released(), 0);
});

test('sub-threshold chunks share a 120ms timer and retain PCM order and format', async () => {
  const { c, sources, timers } = fixture();
  c.assistantFinishPending = false;
  c.queueAudioDelta(Buffer.from([0, 128, 255, 127]).toString('base64'));
  c.queueAudioDelta(Buffer.from([0, 0, 0, 64]).toString('base64'));
  assert.equal(timers.size, 1);
  assert.equal([...timers.values()][0].ms, 120);
  assert.equal(c.outputAudioActive(), true);
  assert.equal(c.outputAudioPlaying(), false);
  [...timers.values()][0].callback();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(timers.size, 0);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].buffer.rate, 16000);
  assert.equal(sources[0].buffer.channels, 1);
  assert.deepEqual(Array.from(sources[0].buffer.samples), [-1, 32767 / 32768, 0, 0.5]);
  assert.equal(sources[0].startAt, 100.03);
});

test('9600 bytes flush immediately, cancel the pending timer and schedule only once', async () => {
  const { c, playback, sources, timers } = fixture();
  c.assistantFinishPending = false;
  playback.enqueue(new Uint8Array(9598));
  assert.equal(sources.length, 0);
  assert.equal(timers.size, 1);
  playback.enqueue(new Uint8Array(2));
  assert.equal(timers.size, 0);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sources.length, 1);
  assert.equal(sources[0].buffer.duration, 0.3);
  await c.flushAudioQueue();
  assert.equal(sources.length, 1);
});

test('explicit response-end flush delivers short tails without waiting for the timer', async () => {
  const { c, playback, sources, timers } = fixture();
  playback.enqueue(new Uint8Array(320));
  await c.flushAudioQueue();
  assert.equal(timers.size, 0);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].buffer.duration, 0.01);
});

test('live playback uses gain and a separate current recording tap', async () => {
  const { c, sources } = fixture();
  const gain = {}, firstRecording = {}, secondRecording = {};
  c.ensureEricPlaybackGain = () => gain;
  c.recordingDestination = firstRecording;
  await c.playPcm16Bytes(pcm(1));
  c.recordingDestination = secondRecording;
  await c.playPcm16Bytes(pcm(1));
  c.recordingDestination = null;
  await c.playPcm16Bytes(pcm(1));
  assert.deepEqual(sources.map(source => source.targets), [
    [gain, firstRecording], [gain, secondRecording], [gain],
  ]);
});

test('without gain playback connects to the context destination', async () => {
  const { c, sources } = fixture();
  await c.playPcm16Bytes(pcm(1));
  assert.deepEqual(sources[0].targets, [c.audioContext.destination]);
});

test('queued and suspended sources are busy but not currently playing', async () => {
  const { c, sources } = fixture();
  await c.playPcm16Bytes(pcm(1));
  assert.equal(c.outputAudioActive(), true);
  assert.equal(c.outputAudioPlaying(), false);
  c.audioContext.currentTime = sources[0].startAt;
  assert.equal(c.outputAudioPlaying(), true);
  c.audioContext.state = 'suspended';
  assert.equal(c.outputAudioPlaying(), false);
  assert.equal(c.outputAudioActive(), true);
  c.audioContext.state = 'running';
  c.audioContext.currentTime = sources[0].startAt + 1;
  assert.equal(c.outputAudioPlaying(), false);
  assert.equal(c.outputAudioActive(), false);
});

test('clearing buffered bytes does not stop already scheduled speech', async () => {
  const { c, playback, sources, timers } = fixture();
  await c.playPcm16Bytes(pcm(1));
  playback.enqueue(new Uint8Array(100));
  c.clearAudioQueue();
  assert.equal(timers.size, 0);
  assert.equal(c.outputAudioActive(), true);
  assert.equal(sources[0].stopped, undefined);
  await c.flushAudioQueue();
  assert.equal(sources.length, 1);
});

test('Stop clears both buffered and scheduled audio while preserving microphone and mouth hooks', async () => {
  const { c, playback, sources, timers } = fixture();
  const hooks = [];
  c.resetMicInterruptCandidate = () => hooks.push('mic');
  c.stopSpeechMouthCue = () => hooks.push('mouth');
  await c.playPcm16Bytes(pcm(1));
  playback.enqueue(new Uint8Array(100));
  c.stopPlaybackNow();
  assert.equal(timers.size, 0);
  assert.equal(sources[0].stopped, true);
  assert.equal(c.outputAudioActive(), false);
  assert.deepEqual(hooks, ['mic', 'mouth']);
});

test('automatic flush reports setup errors once and clears its pending work', async () => {
  const { c, playback, sources, errors } = fixture();
  c.assistantFinishPending = false;
  c.ensurePlayback = async () => { throw new Error('autoplay blocked'); };
  playback.enqueue(new Uint8Array(9600));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(errors, ['audio playback error: autoplay blocked']);
  assert.equal(sources.length, 0);
  assert.equal(c.outputAudioActive(), false);
});

test('late onended from stopped speech cannot release a new pending playback', async () => {
  const { c, sources, released } = fixture();
  await c.playPcm16Bytes(pcm(1));
  c.stopPlaybackNow();
  let ready;
  c.ensurePlayback = () => new Promise(resolve => { ready = resolve; });
  const pending = c.playPcm16Bytes(pcm(1));
  sources[0].onended();
  assert.equal(released(), 0);
  assert.equal(c.outputAudioActive(), true);
  ready(); await pending;
  assert.equal(sources.length, 2);
  assert.equal(released(), 0);
});

test('the page has one audio owner and no duplicate playback state', () => {
  assert.match(page, /<script src="audio-playback\.js"><\/script>/);
  assert.equal((page.match(/Robot790AudioPlayback\.create\(/g) || []).length, 1);
  assert.doesNotMatch(page, /\b(?:audioChunks|audioChunkBytes|audioFlushTimer|activeAudioSources|pendingAudioPlaybacks|audioPlaybackGeneration|audioPlaybackWindows|playbackTime)\b/);
});

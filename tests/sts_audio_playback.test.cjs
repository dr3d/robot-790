const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

function fixture() {
  let wall = 100000;
  const sources = [];
  let released = 0;
  const c = vm.createContext({
    Date: { now: () => wall }, setTimeout: () => 1, clearTimeout() {},
    assistantFinishTimer: null, assistantFinishPending: true,
    assistantFinishWasIdle: false, assistantFinishArmedAt: 100000,
    lastAssistantResponseDoneAt: 0, responseActive: false,
    audioFlushTimer: null, audioChunks: [], audioChunkBytes: 0,
    activeAudioSources: new Set(), pendingAudioPlaybacks: new Set(),
    audioPlaybackWindows: new WeakMap(), audioPlaybackGeneration: 0,
    playbackTime: 0, realtimeSessionGeneration: 1, realtimeStopRequested: false,
    recordingDestination: null, ensurePlayback: async () => {},
    ensureEricPlaybackGain: () => null, pcm16ToFloat32: bytes => new Float32Array(bytes.length / 2),
    resetMicInterruptCandidate() {}, stopSpeechMouthCue() {},
    noteConversationActivity: () => released++,
    audioContext: {
      currentTime: 100, state: 'running', destination: {},
      createBuffer: (_, n, rate) => ({ duration: n / rate, copyToChannel() {} }),
      createBufferSource() {
        const source = { connect() {}, start(at) { this.startAt = at; }, stop() { this.stopped = true; } };
        sources.push(source);
        return source;
      }
    }
  });
  for (const name of ['clearAssistantFinishTimer', 'checkAssistantUtteranceFinished',
    'clearAudioQueue', 'outputAudioActive', 'stopPlaybackNow', 'playPcm16Bytes']) {
    const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    assert(start >= 0, name);
    const end = page.indexOf('\n    }\n', start);
    vm.runInContext(page.slice(start, end + 6), c, { filename: name });
  }
  return { c, sources, wall: value => { wall = value; }, released: () => released };
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
  assert.equal(c.activeAudioSources.size, 1);
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
  assert.equal(c.activeAudioSources.size, 1);
});

test('last 80 milliseconds remain busy and missed onended recovers at the actual endpoint', async () => {
  const { c, sources } = fixture();
  await c.playPcm16Bytes(pcm(1));
  c.audioContext.currentTime = sources[0].startAt + 0.95;
  assert.equal(c.outputAudioActive(), true);
  c.audioContext.currentTime = sources[0].startAt + 1;
  assert.equal(c.outputAudioActive(), false);
  assert.equal(c.activeAudioSources.size, 0);
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
  assert.equal(c.activeAudioSources.size, 1);
});

test('pending setup failures release the busy marker', async () => {
  const { c, released } = fixture();
  c.ensurePlayback = async () => { throw new Error('unavailable'); };
  await assert.rejects(c.playPcm16Bytes(pcm(1)), /unavailable/);
  assert.equal(c.pendingAudioPlaybacks.size, 0);
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
  const { c, released } = fixture();
  c.audioChunkBytes = 100;
  c.checkAssistantUtteranceFinished();
  assert.equal(released(), 0);
  c.audioChunkBytes = 0;
  c.responseActive = true;
  c.checkAssistantUtteranceFinished();
  assert.equal(released(), 0);
});

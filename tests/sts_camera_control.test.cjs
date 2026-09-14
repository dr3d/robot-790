const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../web/sts/index.html'), 'utf8').replace(/\r\n/g, '\n');
function source(name) {
  const start = html.search(new RegExp(`    (?:async )?function ${name}\\(`));
  const end = html.indexOf('\n    }', start);
  assert.ok(start >= 0 && end > start, name);
  return html.slice(start, end + 6);
}
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function stream() {
  const tracks = [0, 1].map(() => ({ readyState: 'live', stop() { this.readyState = 'ended'; },
    addEventListener(_, listener) { this.ended = listener; } }));
  return { tracks, getTracks: () => tracks, getVideoTracks: () => tracks };
}
function setup(getMedia = async () => stream()) {
  const c = vm.createContext({
    visionCameraStream: null, visionCameraStartPromise: null, visionCameraGeneration: 0,
    visionCameraHint: {}, visionCameraStartButton: {}, visionCameraStopButton: {}, visionCameraFrameButton: {},
    visionBrowserFaceFrameButton: null, visionCameraCard: { classList: { toggle() {} } }, contextPanel: null,
    visionCameraPreview: { srcObject: null, play: async () => {}, pause() {}, removeAttribute() {} },
    navigator: { mediaDevices: { getUserMedia: getMedia } },
    updateSessionTools() {}, events: {}, log() {}, recordUiEvent() {},
    captures: 0, parseToolArguments: JSON.parse
  });
  c.captureSensingEyeFrame = async () => { c.captures++; return { status: 'ok', filename: 'test.jpg' }; };
  for (const name of ['visionCameraActive', 'updateVisionCameraButtons', 'startVisionCamera', 'stopVisionCamera', 'setLiveCamera', 'executeTool']) {
    vm.runInContext(source(name), c);
  }
  return c;
}

test('camera verb opens without capturing, supports explicit capture and stops all tracks', async () => {
  let requests = 0;
  const media = stream();
  const c = setup(async options => { requests++; assert.equal(options.audio, false); return media; });
  const on = await c.executeTool('set_live_camera', '{"enabled":true}');
  assert.equal(on.status, 'ok'); assert.equal(on.enabled, true); assert.equal(c.captures, 0);
  assert.equal(c.visionCameraPreview.srcObject, media);
  const captured = await c.setLiveCamera({ enabled: true, capture_frame: true });
  assert.equal(captured.capture.status, 'ok'); assert.equal(c.captures, 1); assert.equal(requests, 1);
  const off = await c.setLiveCamera({ enabled: false });
  assert.equal(off.enabled, false); assert.equal(c.visionCameraPreview.srcObject, null);
  assert.ok(media.tracks.every(t => t.readyState === 'ended'));
});

test('camera start is single-flight and pending permission can be stopped', async () => {
  const gate = defer(), media = stream(); let requests = 0;
  const c = setup(() => { requests++; return gate.promise; });
  const a = c.setLiveCamera({ enabled: true }), b = c.setLiveCamera({ enabled: true });
  assert.equal(requests, 1); assert.equal(c.visionCameraStartButton.disabled, true);
  assert.equal(c.visionCameraStopButton.disabled, false);
  c.stopVisionCamera(); gate.resolve(media);
  assert.equal((await a).status, 'error'); assert.equal((await b).status, 'error');
  assert.equal(c.visionCameraStream, null); assert.equal(c.visionCameraPreview.srcObject, null);
  assert.ok(media.tracks.every(t => t.readyState === 'ended'));
});

test('late permission from an old request cannot replace or stop a newer stream', async () => {
  const gate = defer(), old = stream(), current = stream(); let n = 0;
  const c = setup(() => ++n === 1 ? gate.promise : Promise.resolve(current));
  const pending = c.setLiveCamera({ enabled: true });
  c.stopVisionCamera(); await c.setLiveCamera({ enabled: true }); gate.resolve(old);
  assert.equal((await pending).status, 'error'); assert.equal(c.visionCameraStream, current);
  assert.ok(old.tracks.every(t => t.readyState === 'ended'));
  assert.ok(current.tracks.every(t => t.readyState === 'live'));
  current.tracks[0].ended(); assert.equal(c.visionCameraStream, null);
});

test('disconnect during preview startup cannot report success or capture', async () => {
  const c = setup(), gate = defer(); c.visionCameraPreview.play = () => gate.promise;
  const pending = c.setLiveCamera({ enabled: true, capture_frame: true });
  await new Promise(setImmediate);
  const media = c.visionCameraStream; c.stopVisionCamera(); gate.resolve();
  assert.equal((await pending).status, 'error'); assert.equal(c.captures, 0);
  assert.ok(media.tracks.every(t => t.readyState === 'ended'));
});

test('permission and capture failures are explicit; invalid arguments never activate camera', async () => {
  const c = setup(async () => { throw new Error('Permission denied'); });
  const denied = await c.setLiveCamera({ enabled: true });
  assert.equal(denied.status, 'error'); assert.match(denied.error, /Permission denied/);
  assert.equal(c.visionCameraStartPromise, null); assert.equal(c.visionCameraStartButton.disabled, false);
  for (const args of [{}, { enabled: 'true' }, { enabled: false, capture_frame: true }]) {
    assert.equal((await c.setLiveCamera(args)).status, 'error');
  }
  const d = setup(); d.captureSensingEyeFrame = async () => ({ status: 'error', error: 'No frame' });
  const result = await d.setLiveCamera({ enabled: true, capture_frame: true });
  assert.equal(result.status, 'error'); assert.equal(result.enabled, true); assert.equal(result.error, 'No frame');
});

test('camera control is available while off; Disconnect stops it before a failing save', async () => {
  assert.match(source('enabledToolList'), /\.\.\.liveCameraTools,/);
  assert.match(source('enabledToolList'), /visionCameraActive\(\) \? sensingEyeTools : \[\]/);
  const c = setup(); await c.setLiveCamera({ enabled: true }); const media = c.visionCameraStream;
  Object.assign(c, {
    continuitySaveBusy: false, continuitySaveHalted: false, disconnectButton: {},
    realtimeConnected: () => true, beginIntentionalExitCleanup() {}, quiesceRealtimeForSave() {},
    ws: null, WebSocket: { CLOSED: 3 }, micStream: null, conversationLines: ['keep'],
    waitForPendingUserTranscriptBeforeSessionSave: async () => {
      assert.equal(c.visionCameraStream, null);
      assert.ok(media.tracks.every(t => t.readyState === 'ended'));
    },
    runtimeStep: async (_, run) => run(), saveEricContinuitySnapshot: async () => { throw new Error('disk full'); },
    setState() {}, updateSaveAndHaltButton() {}, endIntentionalExitCleanupSoon() {}
  });
  vm.runInContext(source('disconnectRealtime'), c);
  assert.equal((await c.disconnectRealtime()).status, 'error');
  assert.equal(c.visionCameraStream, null); assert.equal(c.conversationLines[0], 'keep');
});

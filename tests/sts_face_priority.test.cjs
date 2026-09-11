const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const page = fs.readFileSync(path.join(__dirname, '../web/sts/index.html'), 'utf8').replace(/\r\n/g, '\n');

function fixture() {
  const requests = [];
  const c = vm.createContext({
    faceVisualHoldUntil: 0, faceVisualHoldIndefinite: false, faceVisualHoldRevision: 0,
    faceVisualRequestsInFlight: 0, faceMode: 'idle', faceIdleTimer: null,
    clearTimeout: () => {}, log: () => {}, events: {},
    setFaceMode: async payload => { requests.push(payload); },
  });
  for (const name of ['noteFaceVisualHold', 'clearFaceVisualHold', 'withFaceVisualHold', 'faceVisualHoldActive',
    'faceVisualHoldRemainingMs', 'playFaceBeat', 'cueFaceMode']) {
    const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    const end = page.indexOf('\n    }\n', start);
    assert.ok(start > 0 && end > start, name);
    vm.runInContext(page.slice(start, end + 6), c);
  }
  return { c, requests };
}

test('beat reserves priority before HTTP completes, including against forced microphone/speech cues', async () => {
  const { c, requests } = fixture();
  let finish;
  c.postFace = () => new Promise(resolve => { finish = resolve; });
  const beat = c.playFaceBeat({ name: 'confused' });
  assert.equal(c.faceVisualHoldRemainingMs(), Infinity);
  for (const mode of ['speaking', 'listening', 'thinking', 'idle']) c.cueFaceMode(mode, 0.5, { force: true });
  assert.equal(requests.length, 0);
  finish({ ok: true });
  await beat;
  assert.ok(c.faceVisualHoldRemainingMs() > 5500);
  c.cueFaceMode('speaking', 0.5, { force: true });
  assert.equal(requests.length, 0);
  c.clearFaceVisualHold();
  c.cueFaceMode('speaking', 0.5, { force: true });
  assert.equal(requests[0].automatic, true);
});

test('failed or concurrent failed requests do not strand an indefinite hold', async () => {
  const { c } = fixture();
  const failures = [];
  c.postFace = () => new Promise((resolve, reject) => failures.push(reject));
  const a = c.playFaceBeat({ name: 'confused' });
  const b = c.playFaceBeat({ name: 'drowsy' });
  failures[0](new Error('offline'));
  await assert.rejects(a, /offline/);
  assert.equal(c.faceVisualHoldActive(), true);
  failures[1](new Error('offline'));
  await assert.rejects(b, /offline/);
  assert.equal(c.faceVisualHoldActive(), false);
  assert.equal(c.faceVisualRequestsInFlight, 0);
});

test('explicit release during an outstanding request cannot be undone by its late reply', async () => {
  const { c } = fixture();
  let finish;
  c.postFace = () => new Promise(resolve => { finish = resolve; });
  const beat = c.playFaceBeat({ name: 'confused' });
  c.clearFaceVisualHold();
  finish({ ok: true });
  await beat;
  assert.equal(c.faceVisualHoldActive(), false);
});

test('real mode payloads distinguish automatic lifecycle cues from explicit tools', async () => {
  const { c } = fixture();
  const sent = [];
  Object.assign(c, {
    normalizeFaceTintColor: () => '', gazeHoldActive: () => false,
    thinkingGazeSide: 1, speechMouthSeq: 0, stopSpeechMouthCue: () => {}, clearGazeHold: () => {},
    normalizeFaceBaseUrl: () => 'http://127.0.0.1:8792/', matchingConfiguredEmbodimentKey: () => 'reachy_mini',
    postFace: async (route, payload) => { sent.push({ route, payload }); return { ok: true }; },
  });
  const start = page.indexOf('    async function setFaceMode(');
  const end = page.indexOf('\n    }\n', start);
  vm.runInContext(page.slice(start, end + 6), c);
  for (const mode of ['speaking', 'listening', 'thinking', 'idle']) {
    await c.setFaceMode({ mode, automatic: true });
    assert.equal(sent.at(-1).payload.source, 'lifecycle');
  }
  await c.setFaceMode({ mode: 'speaking' });
  assert.equal(sent.at(-1).payload.source, undefined);
  await c.setFaceMode({ mode: 'idle', wake: true });
  assert.equal(sent.at(-1).route, 'wake');
  assert.equal(sent.at(-1).payload.source, undefined);
});

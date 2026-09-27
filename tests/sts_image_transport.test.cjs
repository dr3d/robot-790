const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

test('image staging carries marked provenance, not a repeated instruction script or a new response', () => {
  const sent = [], receipts = [];
  let note = { id: 'eye-1', source: 'generated image' };
  const c = vm.createContext({
    visionImageUrl: 'data:image/png;base64,first', visionImageName: 'first.png', visionImageStaged: false,
    realtimeConnected: () => true, visionHint: {}, updateVisionButtons() {},
    currentSensingEyeHistoryItem: () => note,
    send: event => sent.push(event), events: {}, log() {},
    addSensingEyeVisualNoteTranscriptMarker: (...args) => receipts.push(args),
    updateSessionTools() {}, scheduleIdlePonder() {},
  });
  const start = page.indexOf('    function stageVisionImage()');
  vm.runInContext(page.slice(start, page.indexOf('\n    }\n', start) + 6), c);
  c.stageVisionImage();
  const first = JSON.stringify(sent[0]);
  c.stageVisionImage();
  assert.equal(sent.length, 1);
  c.visionImageUrl = 'data:image/png;base64,second';
  c.visionImageName = 'second.png';
  c.visionImageStaged = false;
  note = { id: 'eye-2', source: 'file drop' };
  c.stageVisionImage();
  assert.equal(JSON.stringify(sent[0]), first);
  assert.equal(sent.length, 2);
  for (const [i, event] of sent.entries()) {
    assert.equal(event.type, 'conversation.item.create');
    assert.equal(event.item.role, 'user');
    const text = event.item.content[0].text;
    assert.match(text, /^\[STS sensing image\]\n/);
    assert.match(text, /\n\[End STS sensing image\]$/);
    const metadata = JSON.parse(text.split('\n')[1]);
    assert.equal(metadata.id, `eye-${i + 1}`);
    assert.equal(metadata.source, i ? 'file drop' : 'generated image');
    assert.equal(metadata.media, 'still_image');
    assert.doesNotMatch(text, /Do not answer|The user has placed|Later idle thoughts|salience/);
    assert.equal(event.item.content[1].type, 'input_image');
  }
  assert.equal(receipts.length, 2);
});

function fixture() {
  const requests = [], renders = [];
  const element = () => ({ classList: { add() {}, remove() {} }, removeAttribute() {} });
  const c = vm.createContext({
    URL, location: { href: 'http://127.0.0.1:8790/' }, events: {}, log() {},
    llmImageTools: { checked: true },
    Robot790FileLookup: require('../web/sts/file-lookup.js'),
    generatedImageStatusState: 'empty', generatedImageRequestGeneration: 0,
    generatedImageStatusLabel: '', generatedImageUrl: '', generatedImageName: '',
    generatedImageHint: {}, generatedImageCard: element(), generatedImagePreview: element(),
    updateGeneratedImageButtons() {}, currentImageModel: () => 'model', currentImageQuality: () => 'low',
    imageSettingLabel: () => 'model / low', visionImageUrl: '', audioRecordingActive: () => false,
    rolloverAudioRecordingForVisualChange() {},
    idleArt: { busy: false, assertCanRender() {}, renderRequested: async (proposal, options) => {
      renders.push({ proposal, options }); return { status: 'ok', filename: 'idle.png', url: '/idle.png' };
    } },
    fetch: async (url, options) => { requests.push({ url, options }); return {
      ok: true, json: async () => ({ status: 'ok', filename: 'draw.png', url: '/draw.png', files: [], next_offset: 20 }),
    }; },
  });
  require('./helpers/sts_preview_owner.cjs').installGeneratedPreview(c, page);
  require('./helpers/sts_image_request_owner.cjs').installImageRequest(c, page);
  for (const name of ['generateImage', 'showGeneratedImage', 'clearGeneratedImage', 'listTextFiles']) {
    const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    const end = page.indexOf('\n    }\n', start);
    assert.ok(start >= 0 && end > start);
    vm.runInContext(page.slice(start, end + 6), c);
  }
  return { c, requests, renders };
}

test('image routes preserve foreground settings and use the idle permission service only when requested', async () => {
  const f = fixture();
  assert.equal((await f.c.generateImage({ prompt: 'A harbor' })).displayed, true);
  assert.equal(JSON.parse(f.requests[0].options.body).model, 'model');
  const result = await f.c.generateImage({ prompt: 'A lighthouse', _idleArt: true, size: '1536x1024' });
  assert.equal(result.filename, 'idle.png');
  assert.equal(f.requests.length, 1);
  assert.equal(f.renders[0].options.size, '1536x1024');
});

test('retained idle result can show its preview without staging; foreground failure releases progress', async () => {
  const f = fixture();
  f.c.idleArt.renderRequested = async () => ({ status: 'ok', filename: 'late.png', url: '/late.png', retained: true });
  const retained = await f.c.generateImage({ prompt: 'A harbor', _idleArt: true });
  assert.equal(retained.displayed, true);
  assert.equal(retained.staged, false);
  assert.equal(retained.retained, true);
  assert.equal(f.c.generatedImageStatusState, 'ready');
  f.c.fetch = async () => { throw new Error('network failure'); };
  await assert.rejects(f.c.generateImage({ prompt: 'Another harbor' }), /network failure/);
  assert.equal(f.c.generatedImageStatusState, 'failed');
});

test('late success or failure cannot replace a newer preview or undo a manual clear', async () => {
  for (const fails of [false, true]) {
    const f = fixture(); let release;
    f.c.fetch = () => new Promise((resolve, reject) => { release = () => fails
      ? reject(new Error('late error')) : resolve({ ok: true, json: async () => ({ status: 'ok', url: '/old.png' }) }); });
    const pending = f.c.generateImage({ prompt: 'Old drawing' });
    f.c.showGeneratedImage({ filename: 'new.png', url: '/new.png' });
    release();
    if (fails) await assert.rejects(pending, /late error/);
    else assert.equal((await pending).displayed, false);
    assert.equal(f.c.generatedImageStatusState, 'ready');
    assert.equal(f.c.generatedImageName, 'new.png');
  }
  const f = fixture(); let release;
  f.c.idleArt.renderRequested = () => new Promise(resolve => { release = resolve; });
  const pending = f.c.generateImage({ prompt: 'Old drawing', _idleArt: true });
  f.c.clearGeneratedImage();
  release({ status: 'ok', url: '/old.png' });
  assert.equal((await pending).displayed, false);
  assert.equal(f.c.generatedImageStatusState, 'empty');
});

test('foreground request waits for idle render and submits once with original settings', async () => {
  const f = fixture(); f.c.idleArt.busy = true; let wake;
  f.c.setTimeout = (callback, ms) => { assert.equal(ms, 250); wake = callback; };
  const pending = f.c.generateImage({ prompt: 'A harbor', size: '1536x1024' });
  assert.equal(f.requests.length, 0);
  f.c.idleArt.busy = false; wake();
  const result = await pending;
  assert.equal(result.displayed, true);
  assert.equal(f.requests.length, 1);
  assert.equal(JSON.parse(f.requests[0].options.body).size, '1536x1024');
});

test('waiting image request submits nothing after supersession, preview clear or tool disable', async () => {
  for (const change of ['session-or-user', 'clear', 'disabled']) {
    const f = fixture(); f.c.idleArt.busy = true; let wake, current = true;
    f.c.setTimeout = callback => { wake = callback; };
    const pending = f.c.generateImage({ prompt: 'Old request', _isCurrent: () => current });
    if (change === 'session-or-user') current = false;
    if (change === 'clear') f.c.clearGeneratedImage();
    if (change === 'disabled') f.c.llmImageTools.checked = false;
    wake();
    await assert.rejects(pending, error => error.generationSubmitted === false);
    assert.equal(f.requests.length, 0);
  }
});

test('two waiting requests cannot both acquire the image renderer', async () => {
  const f = fixture(); f.c.idleArt.busy = true;
  const wakes = [];
  f.c.setTimeout = callback => { wakes.push(callback); };
  const first = f.c.generateImage({ prompt: 'First' });
  const second = f.c.generateImage({ prompt: 'Second' });
  f.c.idleArt.busy = false;
  wakes.forEach(wake => wake());
  await first;
  await assert.rejects(second, error => error.generationSubmitted === false);
  assert.equal(f.requests.length, 1);
});

test('idle requests and already active foreground renders still reject duplicate generation', async () => {
  const f = fixture(); f.c.idleArt.busy = true;
  await assert.rejects(f.c.generateImage({ prompt: 'Idle', _idleArt: true }), error => error.generationSubmitted === false);
  f.c.idleArt.busy = false; f.c.generatedImageStatusState = 'generating';
  await assert.rejects(f.c.generateImage({ prompt: 'Duplicate' }), error => error.generationSubmitted === false);
  assert.equal(f.requests.length, 0);
});

test('note lookup always requests a bounded page and carries Unicode filters and pagination', async () => {
  const f = fixture();
  const result = await f.c.listTextFiles();
  assert.equal(f.requests[0].url.searchParams.get('limit'), '5');
  assert.equal(result.next_offset, 20);
  await f.c.listTextFiles({ query: '\u65e5\u8a18', directory: 'core', offset: 20, limit: 5 });
  const params = f.requests[1].url.searchParams;
  assert.equal(params.get('query'), '\u65e5\u8a18');
  assert.equal(params.get('directory'), 'core');
  assert.equal(params.get('offset'), '20');
  assert.equal(params.get('limit'), '5');
});

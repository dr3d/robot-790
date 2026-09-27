const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { Controller } = require('../web/sts/idle-art.js');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

async function fixture() {
  const receipts = [], shown = [], calls = [];
  const state = { connected: true, eligible: true, blocked: false, quietMs: 100000,
    minimumQuietMs: 90000, userKey: 'user', eyeKey: 'eye' };
  const element = () => ({ classList: { remove() {} }, removeAttribute() {} });
  const c = vm.createContext({
    generatedImageStatusState: 'ready', generatedImageStatusLabel: 'Previous picture',
    generatedImageRequestGeneration: 0, generatedImageUrl: '/old.png', generatedImageName: 'old.png',
    generatedImageHint: { textContent: 'Previous picture' }, generatedImageCard: element(),
    generatedImagePreview: element(), updateGeneratedImageButtons() {},
    currentImageModel: () => 'fake', currentImageQuality: () => 'low', imageSettingLabel: () => 'fake',
    log() {}, events: {}, sensingEyeGeneration: 1,
  });
  let next = 0;
  const controller = new Controller({
    api: async (action, payload) => {
      calls.push(action);
      return action === 'arm' ? { token: 'test', run_id: payload.run_id }
        : { status: 'ok', filename: 'completed.png', url: '/completed.png', idle_art_job: payload.job_id };
    }, context: () => ({ ...state, mediaKey: c.generatedImageUrl }),
    deliver: async (result, current) => {
      assert.equal(current(), true);
      shown.push(result.filename);
      return { status: 'ok', staged: true, source_image: result.filename, saved_filename: 'eye.jpg' };
    }, receipt: row => receipts.push({ ...row }), id: () => `test-${++next}`, now: () => 100000,
  });
  c.idleArt = controller;
  require('./helpers/sts_preview_owner.cjs').installGeneratedPreview(c, page);
  require('./helpers/sts_image_request_owner.cjs').installImageRequest(c, page);
  require('./helpers/sts_image_handoff_owner.cjs').installImageHandoff(c, page);
  for (const name of ['generateImage', 'moveGeneratedImageToSensingEye']) {
    vm.runInContext(require('./helpers/sts_completion_harness.cjs').extract(page,name), c);
  }
  await controller.arm({});
  controller.offer({ title: 'Background picture', prompt: 'No network in tests' });
  await controller.tick();
  return { c, controller, state, receipts, shown, calls };
}

test('ready image rejects another render before any preview mutation, then auto-delivers', async () => {
  for (const idle of [true, false]) {
    const f = await fixture();
    await assert.rejects(f.c.generateImage({ prompt: 'Different picture', _idleArt: idle }), error => {
      assert.equal(error.generationSubmitted, false);
      assert.match(error.message, /completed.png/);
      return true;
    });
    assert.equal(f.c.generatedImageUrl, '/old.png');
    assert.equal(f.c.generatedImageStatusState, 'ready');
    assert.equal(f.c.generatedImageHint.textContent, 'Previous picture');
    assert.equal(f.controller.ready.result.filename, 'completed.png');
    await f.controller.tick();
    assert.deepEqual(f.shown, ['completed.png']);
    assert.equal(f.controller.history[0].status, 'staged');
    assert.equal(f.calls.filter(action => action === 'render').length, 1);
  }
});

test('model move claims the ready artifact once even while its own tool blocks automatic delivery', async () => {
  const f = await fixture();
  f.state.blocked = true;
  const result = await f.c.moveGeneratedImageToSensingEye({ _usePending: true });
  assert.equal(result.source_image, 'completed.png');
  assert.equal(result.staged, true);
  assert.equal(f.controller.ready, null);
  f.state.blocked = false;
  await f.controller.tick();
  assert.deepEqual(f.shown, ['completed.png']);
});

test('explicit filename uses pending-image ownership and never substitutes a different ready image', async () => {
  const f = await fixture();
  await assert.rejects(f.c.moveGeneratedImageToSensingEye({ filename: 'different.png', _usePending: true }), /changed/);
  assert.equal(f.controller.ready.result.filename, 'completed.png');
  const moved = await f.c.moveGeneratedImageToSensingEye({ filename: 'completed.png', _usePending: true });
  assert.equal(moved.source_image, 'completed.png');
  assert.equal(f.controller.ready, null);
  assert.deepEqual(f.shown, ['completed.png']);
});

test('superseded ready artifacts are retained, not shown or left misleadingly complete', async () => {
  for (const field of ['userKey', 'eyeKey', 'mediaKey']) {
    const f = await fixture();
    if (field === 'mediaKey') f.c.generatedImageUrl = '/replacement.png';
    else f.state[field] = 'replacement';
    await assert.rejects(f.c.moveGeneratedImageToSensingEye({ _usePending: true }), /superseded/);
    assert.equal(f.controller.history[0].status, 'retained');
    assert.equal(f.controller.ready, null);
    assert.equal(f.shown.length, 0);
  }
});

test('canceled move leaves a ready result available; a mismatched expected identity cannot consume it', async () => {
  const f = await fixture();
  await assert.rejects(f.c.moveGeneratedImageToSensingEye({ _usePending: true, _isCurrent: () => false }), /superseded/);
  await assert.rejects(f.c.moveGeneratedImageToSensingEye({ _usePending: true, _expectedFilename: 'different.png' }), /changed/);
  assert.equal(f.controller.ready.result.filename, 'completed.png');
  assert.equal(f.shown.length, 0);
});

test('delivery failure records artifact identity and releases ownership without regenerating', async () => {
  const f = await fixture();
  f.controller.deliver = async () => { throw new Error('image fetch failed'); };
  await f.controller.tick();
  assert.equal(f.controller.history[0].status, 'display_failed');
  assert.equal(f.receipts.at(-1).filename, 'completed.png');
  assert.equal(f.controller.busy, false);
  assert.equal(f.controller.ready, null);
  assert.equal(f.calls.filter(action => action === 'render').length, 1);
});

test('disconnect during claimed delivery invalidates the continuation and preserves the artifact', async () => {
  const f = await fixture();
  let finish, current;
  f.controller.deliver = (_result, guard) => { current = guard; return new Promise(resolve => { finish = resolve; }); };
  const pending = f.controller.stageReady();
  f.controller.disarm();
  assert.equal(current(), false);
  finish();
  await assert.rejects(pending, /superseded/);
  assert.equal(f.controller.busy, false);
  assert.equal(f.controller.history[0].status, 'retained');
});

test('a second model move cannot enter a delivery already claimed by the automatic tick', async () => {
  const f = await fixture();
  let finish;
  f.controller.deliver = () => new Promise(resolve => { finish = resolve; });
  const pending = f.controller.tick();
  assert.equal(f.controller.busy, true);
  await assert.rejects(f.c.moveGeneratedImageToSensingEye({ _usePending: true }), /already in progress/);
  finish({ staged: true });
  await pending;
});

test('revoking permission while ready records retention rather than leaving a ready receipt', async () => {
  const f = await fixture();
  f.controller.disarm();
  assert.equal(f.controller.history[0].status, 'retained');
  assert.equal(f.controller.ready, null);
  assert.equal(f.shown.length, 0);
});

function usePageDelivery(f) {
  const c = f.c;
  Object.assign(c, {
    URL, location: new URL('http://localhost/'), lastUserTurnActivityAt: 1,
    visionImageUrl: '/previous-eye.jpg', sensingTextContent: '',
    idleArtEnabled: { checked: true }, llmImageTools: { checked: true },
    showGeneratedImage: result => { c.generatedImageUrl = result.url; c.generatedImageName = result.filename; },
    blobToDataUrl: async () => 'data:image/png;base64,test', loadImage: async () => ({}),
    noteAloneActivity() {}, appendRuntimeContextToConversation() {}, noteIdleDiscovery() {}, scheduleIdlePonder() {},
    setVisionImageFromDrawable: async (_image, name, options) => {
      assert.equal(options.isCurrent(), true);
      c.visionImageUrl = '/staged.jpg'; c.visionImageName = name; c.visionImageStaged = true;
      f.shown.push(name);
      return { savedFilename: 'eye.jpg', openUrl: '/eye.jpg' };
    },
    fetch: async () => ({ ok: true, blob: async () => ({}) }),
  });
  const start = page.indexOf('      deliver: async (result, sameSession) => {') + '      deliver: '.length;
  const end = page.indexOf('\n      },\n      receipt:', start);
  assert.ok(start > 0 && end > start);
  f.controller.deliver = vm.runInContext(`(${page.slice(start, end)}\n})`, c);
}

test('actual page delivery stages the claimed artifact through the normal eye path', async () => {
  const f = await fixture();
  usePageDelivery(f);
  await f.controller.tick();
  assert.deepEqual(f.shown, ['completed.png']);
  assert.equal(f.controller.history[0].status, 'staged');
  assert.equal(f.c.visionImageName, 'completed.png');
});

test('actual page delivery cannot overwrite an eye or user change during image fetching', async () => {
  for (const field of ['visionImageUrl', 'sensingTextContent', 'lastUserTurnActivityAt']) {
    const f = await fixture();
    usePageDelivery(f);
    let finish;
    f.c.fetch = () => new Promise(resolve => { finish = resolve; });
    const pending = f.controller.tick();
    f.c[field] = 'replacement';
    finish({ ok: true, blob: async () => ({}) });
    await pending;
    assert.equal(f.shown.length, 0);
    assert.notEqual(f.controller.history[0].status, 'staged');
    assert.equal(f.c[field], 'replacement');
  }
});

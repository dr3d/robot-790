const assert = require('node:assert/strict');
const vm = require('node:vm');
const { test } = require('node:test');
const { page } = require('./helpers/sts_tool_harness.cjs');
const { fixture } = require('./helpers/sts_image_harness.cjs');


test('interrupted generation stays off screen and can be retrieved from its receipt without another render', async () => {
  const { c, requests, staged } = fixture();
  let current = true, finish;
  const fetch = c.fetch;
  c.fetch = (url, options) => options?.method === 'POST'
    ? new Promise(resolve => { finish = async () => resolve(await fetch(url, options)); })
    : fetch(url, options);
  const pending = c.generateImage({ prompt: 'Mars canyon', _isCurrent: () => current });
  current = false;
  await finish();
  const receipt = await pending;
  assert.equal(receipt.displayed, false);
  assert.equal(receipt.staged, false);
  assert.equal(receipt.retained, true);
  assert.equal(receipt.retrieval.tool, 'move_generated_image_to_sensing_eye');
  assert.equal(receipt.retrieval.arguments.filename, receipt.filename);
  assert.equal(c.generatedImageUrl, '');
  assert.equal(c.visionImageUrl, '/operator.jpg');
  const moved = await c.moveGeneratedImageToSensingEye({ ...receipt.retrieval.arguments, _usePending: true });
  assert.equal(moved.source_image, 'retained.png');
  assert.equal(moved.staged, true);
  assert.equal(staged.length, 1);
  assert.equal(requests.filter(r => r.options?.method === 'POST').length, 1);
  assert.equal(requests.at(-1).url, 'http://127.0.0.1:8790/generated-images/retained.png');
});

test('exact retrieval needs no in-memory ledger and leaves a different preview untouched', async () => {
  const { c, requests } = fixture();
  c.showGeneratedImage({ filename: 'newer.png', url: '/generated-images/newer.png' });
  const hint = c.generatedImageHint.textContent;
  const result = await c.moveGeneratedImageToSensingEye({ filename: 'older.png', _usePending: true });
  assert.equal(result.source_image, 'older.png');
  assert.equal(c.generatedImageName, 'newer.png');
  assert.equal(c.generatedImageHint.textContent, hint);
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /\/generated-images\/older.png$/);
});

test('omitting filename still moves the current preview, not a guessed historical artifact', async () => {
  const { c, requests } = fixture();
  await assert.rejects(c.moveGeneratedImageToSensingEye(), /filename/);
  assert.equal(requests.length, 0);
  c.showGeneratedImage({ filename: 'visible.png', url: '/generated-images/visible.png' });
  assert.equal((await c.moveGeneratedImageToSensingEye()).source_image, 'visible.png');
});

test('missing and invalid filenames never generate, fall back to another image, or stage anything', async () => {
  for (const filename of ['../x.png', 'dir/x.png', 'dir\\x.png', 'https://host/x.png', 'x.png?other', 'x.json', '%2e%2e%2fx.png', `${'a'.repeat(157)}.png`]) {
    const { c, requests, staged } = fixture();
    await assert.rejects(c.moveGeneratedImageToSensingEye({ filename }), /filename/);
    assert.equal(requests.length, 0);
    assert.equal(staged.length, 0);
  }
  const { c, staged } = fixture();
  c.showGeneratedImage({ filename: 'visible.png', url: '/generated-images/visible.png' });
  c.fetch = async () => ({ ok: false, status: 404, statusText: 'Not Found' });
  await assert.rejects(c.moveGeneratedImageToSensingEye({ filename: 'missing.png' }), /404/);
  assert.equal(staged.length, 0);
  assert.equal(c.generatedImageName, 'visible.png');
});

test('new user, eye, preview, or session activity during retrieval prevents staging', async () => {
  for (const mutation of [
    c => { c.current = false; },
    c => { c.sensingEyeGeneration++; },
    c => { c.visionImageUrl = '/new-eye.jpg'; },
    c => { c.sensingTextContent = 'new text'; },
    c => { c.generatedImageRequestGeneration++; },
  ]) {
    const { c, staged } = fixture();
    let finish;
    c.current = true;
    c.fetch = () => new Promise(resolve => { finish = resolve; });
    const pending = c.moveGeneratedImageToSensingEye({ filename: 'retained.png', _isCurrent: () => c.current });
    pending.catch(() => {});
    assert.equal(typeof finish, 'function');
    mutation(c);
    finish({ ok: true, blob: async () => ({}) });
    await assert.rejects(pending, /superseded|canceled/);
    assert.equal(staged.length, 0);
  }
});

test('retrieval freshness guard remains active through asynchronous eye saving', async () => {
  const { c, staged } = fixture();
  let options, finish;
  c.setVisionImageFromDrawable = (_image, _name, opts) => {
    options = opts;
    return new Promise(resolve => { finish = () => {
      assert.equal(options.isCurrent(), false);
      resolve(null);
    }; });
  };
  const pending = c.moveGeneratedImageToSensingEye({ filename: 'retained.png' });
  pending.catch(() => {});
  for (let i = 0; !options && i < 20; i++) await new Promise(resolve => setImmediate(resolve));
  assert.ok(options, 'retrieval should reach eye saving');
  c.visionImageUrl = '/replacement.jpg';
  finish();
  await assert.rejects(pending, /staging was not completed/);
  assert.equal(staged.length, 0);
  assert.equal(c.visionImageUrl, '/replacement.jpg');
});

test('model tool schema exposes exact artifact retrieval as an optional filename', () => {
  const start = page.indexOf('    const imageTools =');
  assert.ok(start >= 0);
  const source = page.slice(start, page.indexOf('\n    ];', start) + 7);
  const tools = vm.runInNewContext(`${source}\nimageTools;`);
  const tool = tools.find(t => t.name === 'move_generated_image_to_sensing_eye');
  assert.equal(tool.parameters.properties.filename.type, 'string');
  assert.ok(!tool.parameters.required?.includes('filename'));
  assert.match(tool.description, /retained/);
});

test('supported saved image extensions use the same bounded generated-images route', async () => {
  for (const extension of ['png', 'jpg', 'jpeg', 'webp', 'svg']) {
    const { c, requests } = fixture();
    const filename = `saved.${extension}`;
    assert.equal((await c.moveGeneratedImageToSensingEye({ filename })).source_image, filename);
    assert.equal(requests.length, 1);
    assert.ok(requests[0].url.endsWith(`/generated-images/${filename}`));
  }
});

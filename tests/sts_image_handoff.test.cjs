const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const { test } = require('node:test');
const { characterize } = require('./helpers/sts_image_handoff_harness.cjs');
const { installImageHandoff } = require('./helpers/sts_image_handoff_owner.cjs');
const baseline = require('./fixtures/sts-image-handoff.json');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

test('image handoff preserves complete baseline receipts, errors, state and ordered effects', async () => {
  assert.deepEqual(await characterize(page, installImageHandoff), baseline.cases);
});

test('eye persistence, staging, clearing, idle delivery and prompts stay unchanged', () => {
  const { extract } = require('./helpers/sts_completion_harness.cjs');
  const original = cp.execFileSync('git', ['show', `${baseline.baseline}:web/sts/index.html`], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
  for (const name of ['saveSensingEyeVisualNote', 'saveSensingEyeTextNote', 'setVisionImageFromDrawable',
    'stageVisionImage', 'clearSensingEyeState', 'selectSensingEyeImage', 'buildSessionInstructions',
    'handleFunctionCall', 'triggerIdlePonder', 'generateImage']) {
    assert.equal(extract(page, name), extract(original, name), name);
  }
  const delivery = source => source.slice(source.indexOf('      deliver: async (result, sameSession) => {'),
    source.indexOf('\n      receipt:', source.indexOf('      deliver: async (result, sameSession) => {')));
  assert.ok(delivery(original).length > 100);
  assert.equal(delivery(page), delivery(original));
  for (const name of ['generated-preview.js', 'image-request.js', 'idle-art.js']) {
    const before = cp.execFileSync('git', ['show', `${baseline.baseline}:web/sts/${name}`], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
    assert.equal(fs.readFileSync(`${__dirname}/../web/sts/${name}`, 'utf8').replace(/\r\n/g, '\n'), before, name);
  }
  assert.match(page, /function moveGeneratedImageToSensingEye\(args = \{\}\) \{\s+return generatedImageHandoff\.move\(args\);\s+\}/);
});

test('frozen image handoff cases reproduce independently from committed code', async () => {
  const original = cp.execFileSync('git', ['show', `${baseline.baseline}:web/sts/index.html`], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
  assert.deepEqual(await characterize(original), baseline.cases);
});

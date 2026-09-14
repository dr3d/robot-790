const assert = require('node:assert/strict');
const { test } = require('node:test');
const flow = require('../web/sts/image-task.js');

test('ordinary research can search again without being forced into drawing', () => {
  const task = flow.create('Research three new jokes', 1);
  assert.equal(flow.reserve(task, 'search_web', true), true);
  flow.record(task, 'search_web', { status: 'ok' });
  assert.deepEqual(flow.permitted(task), ['search_web', 'generate_image']);
  assert.equal(flow.reserve(task, 'read_note'), false);
  assert.equal(flow.reserve(task, 'search_web'), true);
  flow.record(task, 'search_web', { status: 'ok' });
  const instructions = flow.instructions(task, flow.permitted(task));
  assert.match(instructions, /ordinary search is research, not an image task/);
  assert.match(instructions, /Search alone does not authorize drawing/);
  assert.equal(task.generationAttempted, false);
  assert.equal(flow.reserve(task, 'search_web'), true);
  flow.record(task, 'search_web', { status: 'ok' });
  assert.deepEqual(flow.permitted(task), []);
});

test('failed or unknown outcomes cannot authorize another paid generation', () => {
  const task = flow.create('Draw', 1);
  assert.equal(flow.reserve(task, 'generate_image', true), true);
  flow.record(task, 'generate_image', { status: 'error', error: 'Unknown result' });
  assert.deepEqual(flow.permitted(task), []);
  assert.equal(flow.reserve(task, 'generate_image', true), false);
});

test('artifact mismatches and missing staged receipts are not completion', () => {
  for (const result of [{ status: 'ok', staged: true, source_image: 'old.png' }, { status: 'ok', source_image: 'new.png' }]) {
    const task = flow.create('Draw and stage', 1);
    flow.reserve(task, 'generate_image', true);
    flow.record(task, 'generate_image', { status: 'ok', filename: 'new.png' });
    flow.reserve(task, 'move_generated_image_to_sensing_eye');
    const receipt = flow.record(task, 'move_generated_image_to_sensing_eye', result);
    assert.equal(receipt.receipts.at(-1).status, 'error');
    assert.equal(receipt.receipts.at(-1).staged, false);
    assert.deepEqual(flow.permitted(task), []);
  }
});

test('wall clock and step limits terminate eligibility without a scheduler or retry', () => {
  const task = flow.create('Draw', 1, { max_steps: 1 });
  flow.reserve(task, 'search_web', true);
  flow.record(task, 'search_web', { status: 'ok' });
  assert.deepEqual(flow.permitted(task), []);
  const expired = flow.create('Draw', 2);
  flow.reserve(expired, 'search_web', true);
  flow.record(expired, 'search_web', { status: 'ok' });
  expired.deadline = Date.now() - 1;
  assert.deepEqual(flow.permitted(expired), []);
  assert.equal(flow.reserve(expired, 'generate_image'), false);
});

test('receipts are snapshots and do not inherit mutation from subsequent actions', () => {
  const task = flow.create('Draw and stage', 1);
  flow.reserve(task, 'generate_image', true);
  const old = flow.record(task, 'generate_image', { status: 'ok', filename: 'new.png' });
  flow.reserve(task, 'move_generated_image_to_sensing_eye');
  flow.record(task, 'move_generated_image_to_sensing_eye', { status: 'ok', staged: true, source_image: 'new.png' });
  assert.equal(old.receipts.length, 1);
  assert.equal(old.receipts[0].staged, false);
});

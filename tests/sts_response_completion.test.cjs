const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { characterize } = require('./helpers/sts_completion_harness.cjs');
const { installResponseCompletion } = require('./helpers/sts_completion_owner.cjs');
const baseline = require('./fixtures/sts-response-completion.json');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');
const { create } = require('../web/sts/response-completion.js');

test('completion owner preserves complete baseline state and ordered effects', async () => {
  assert.deepEqual(await characterize(page, installResponseCompletion), baseline.cases);
});

test('completion state is no longer mirrored in page globals', () => {
  for (const name of ['responseActive', 'assistantFinishTimer', 'assistantFinishPending', 'assistantFinishWasIdle', 'assistantFinishArmedAt']) {
    assert.doesNotMatch(page, new RegExp(`\\b(?:let|const|var) ${name}\\b`));
  }
});

test('independent completion owners cannot release or clear each other', () => {
  const finished = [], timers = new Map();
  let id = 0;
  const owner = label => create({ now: () => 100, audioActive: () => false,
    setTimeout: fn => { timers.set(++id, fn); return id; }, clearTimeout: key => timers.delete(key),
    finished: wasIdle => finished.push([label, wasIdle]) });
  const first = owner('first'), second = owner('second');
  first.arm({ wasIdle: true }); second.arm(); first.clearPending(); first.clearTimer();
  first.check(); assert.equal(second.pending, true); second.check();
  assert.deepEqual(finished, [['second', false]]); assert.equal(timers.size, 0);
});

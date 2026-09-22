const assert = require('node:assert/strict');
const { test } = require('node:test');
const { create } = require('../web/sts/backend-control-feedback.js');

function fixture() {
  const timers = new Map(), pending = [], applied = [];
  let next = 0, valid = true;
  const owner = create({
    setTimer(callback, delay) { timers.set(++next, { callback, delay }); return next; },
    clearTimer(id) { timers.delete(id); },
    onPending: kind => pending.push(kind),
  });
  const begin = kind => owner.begin({ kind, isCurrent: () => valid });
  return { timers, pending, applied, begin, invalidate() { valid = false; } };
}

test('feedback completion releases controls exactly once and clears its timer', () => {
  const f = fixture(), operation = f.begin('restart');
  operation.defer(() => f.applied.push('ready'), 5000);
  const timer = [...f.timers.values()][0];
  assert.equal(timer.delay, 5000);
  timer.callback();
  timer.callback();
  operation.complete(() => assert.fail('already completed'));
  assert.deepEqual(f.pending, ['restart', null]);
  assert.deepEqual(f.applied, ['ready']);
  assert.equal(f.timers.size, 0);
});

test('superseding feedback clears its timer and invalidates captured callbacks and late failures', () => {
  const f = fixture(), old = f.begin('restart');
  old.defer(() => assert.fail('old timer'), 5000);
  const timer = [...f.timers.values()][0];
  const halt = f.begin('halt');
  assert.equal(f.timers.size, 0);
  timer.callback();
  old.complete(() => assert.fail('old failure'));
  old.update(() => assert.fail('old progress'));
  old.defer(() => assert.fail('late old response'), 5000);
  assert.deepEqual(f.pending, ['restart', 'halt']);
  halt.complete();
  assert.deepEqual(f.pending, ['restart', 'halt', null]);
  assert.equal(f.timers.size, 0);
});

test('scope changes suppress connection updates but still release the last backend controls', () => {
  const f = fixture(), operation = f.begin('unload');
  operation.update(() => f.applied.push('Unloading'));
  f.invalidate();
  operation.update(() => assert.fail('stale progress'));
  operation.complete(() => assert.fail('stale status'));
  assert.deepEqual(f.applied, ['Unloading']);
  assert.deepEqual(f.pending, ['unload', null]);
});

test('replacing a completion timer invalidates its already captured callback', () => {
  const f = fixture(), operation = f.begin('restart');
  operation.defer(() => assert.fail('replaced timer'), 5000);
  const old = [...f.timers.values()][0];
  operation.defer(() => f.applied.push('ready'), 4000);
  old.callback();
  assert.deepEqual(f.pending, ['restart']);
  [...f.timers.values()][0].callback();
  assert.deepEqual(f.applied, ['ready']);
});

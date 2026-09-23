const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const { create } = require('../web/sts/realtime-readiness.js');
const { loadFunctions } = require('./helpers/sts_tool_harness.cjs');
const { deferred } = require('./helpers/sts_save_harness.cjs');

test('readiness starts closed, follows availability, and recovers after an unavailable probe', async () => {
  let result = true, checks = 0, updates = 0;
  const owner = create({ canCheck: () => true, onChange: () => updates++,
    probe: async () => { checks++; if (result instanceof Error) throw result; return result; } });
  assert.equal(owner.ready, false);
  for (const value of [true, true, false, new Error('timeout'), true, 'true']) {
    result = value;
    await owner.check();
    assert.equal(owner.ready, value === true);
  }
  assert.equal(checks, 6);
  assert.equal(updates, 4, 'no repeated UI updates for an unchanged state');
});

test('a probe before Restart or connection acquisition cannot reopen the controls', async () => {
  const gate = deferred();
  let allowed = true, checks = 0;
  const owner = create({ canCheck: () => allowed, onChange() {},
    probe: async () => { checks++; return gate.promise; } });
  const pending = owner.check();
  await owner.check();
  assert.equal(checks, 1, 'no overlapping probes');
  owner.invalidate();
  gate.resolve(true);
  await pending;
  assert.equal(owner.ready, false);
  allowed = false;
  await owner.check();
  assert.equal(checks, 1, 'no polling during session/transition/backend control');
  allowed = true;
  await owner.check();
  assert.equal(owner.ready, true);
});

test('becoming busy while a probe waits discards its response', async () => {
  const gate = deferred();
  let allowed = true;
  const owner = create({ canCheck: () => allowed, onChange() {}, probe: () => gate.promise });
  const pending = owner.check();
  allowed = false;
  gate.resolve(true);
  await pending;
  assert.equal(owner.ready, false);
});

test('actual page gates all Connect buttons without locking archive or overriding lifecycle locks', () => {
  const c = vm.createContext({
    connectionButtonsLocked: false, realtimeConnection: { busy: false, socket: null },
    realtimeReadiness: { ready: false }, WebSocket: { OPEN: 1, CONNECTING: 0 },
    connectButton: {}, previousConnectButton: {}, emptyConnectButton: {},
    connectSelectedContinuitySessionButton: {}, archiveContinuitySessionButton: {},
    selectedContinuitySessionFilename: () => 'selected.txt', continuitySessions: [{}, {}]
  });
  loadFunctions(c, ['setConnectionButtonsDisabled', 'updateContinuitySessionActionButtons']);
  const buttons = [c.connectButton, c.previousConnectButton, c.emptyConnectButton, c.connectSelectedContinuitySessionButton];
  c.setConnectionButtonsDisabled(false);
  assert(buttons.every(button => button.disabled));
  assert.equal(c.archiveContinuitySessionButton.disabled, false);
  c.realtimeReadiness.ready = true;
  c.setConnectionButtonsDisabled(false);
  assert(buttons.every(button => !button.disabled));
  c.setConnectionButtonsDisabled(true);
  assert(buttons.every(button => button.disabled));
  c.realtimeConnection.busy = true;
  c.setConnectionButtonsDisabled(false);
  assert(buttons.every(button => button.disabled));
});

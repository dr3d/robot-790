const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

function fixture() {
  const sent = [];
  const c = vm.createContext({
    interruptSensitivity: { value: '6' }, interruptSensitivityValue: {},
    imageToolProtectionEnabled: false, connected: true,
    realtimeConnected: () => c.connected, send: event => sent.push(event),
    saveInterruptSensitivity() {}, events: {}, log() {},
  });
  for (const name of ['currentInterruptSensitivity', 'realtimeInterruptEnabled',
    'syncRealtimeInterruptPolicy', 'updateInterruptSensitivityUi', 'updateRealtimeInterruptProtection']) {
    const start = page.search(new RegExp(`^    function ${name}\\(`, 'm'));
    const end = page.indexOf('\n    }\n', start);
    assert.ok(start >= 0 && end > start, name);
    vm.runInContext(page.slice(start, end + 6), c);
  }
  return { c, sent };
}

test('Off disables backend interruptions immediately, including after image protection ends', () => {
  const { c, sent } = fixture();
  c.interruptSensitivity.value = '0';
  c.updateInterruptSensitivityUi();
  assert.equal(c.interruptSensitivityValue.textContent, 'Off');
  assert.equal(sent.at(-1).session.turn_detection.interrupt_response, false);
  c.updateRealtimeInterruptProtection(true);
  c.updateRealtimeInterruptProtection(false);
  assert.ok(sent.every(e => e.session.turn_detection.interrupt_response === false));
});

test('nonzero sensitivity restores interruption except while image work is protected', () => {
  const { c, sent } = fixture();
  c.updateRealtimeInterruptProtection(true);
  c.interruptSensitivity.value = '8';
  c.updateInterruptSensitivityUi();
  assert.equal(sent.at(-1).session.turn_detection.interrupt_response, false);
  c.updateRealtimeInterruptProtection(false);
  assert.equal(sent.at(-1).session.turn_detection.interrupt_response, true);
});

test('disconnected changes remain local; session setup uses the same effective policy', () => {
  const { c, sent } = fixture();
  c.connected = false;
  c.interruptSensitivity.value = '0';
  c.updateInterruptSensitivityUi();
  assert.equal(sent.length, 0);
  assert.equal(c.realtimeInterruptEnabled(), false);
  const start = page.indexOf('    function updateSessionTools(');
  const end = page.indexOf('\n    }\n', start);
  assert.match(page.slice(start, end), /interrupt_response: realtimeInterruptEnabled\(\)/);
});

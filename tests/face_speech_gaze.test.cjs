const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync(`${__dirname}/../web/face-sim/index.html`, 'utf8').replace(/\r\n/g, '\n');

test('speech glances hold, return toward center, and respect manual gaze and silence', () => {
  const c = vm.createContext({ state: { gaze: {} }, speechEyeLevel: () => 1,
    lastSpeechEyeAt: 0, easedSpeechEyeX: 0, easedSpeechEyeY: 0,
    clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)),
    easeToward: (x, target, amount) => x + (target - x) * amount });
  const start = page.indexOf('    function speakingEyeOffset(');
  const end = page.indexOf('\n    }', start);
  vm.runInContext(page.slice(start, end + 6), c);
  function settle(start) {
    let result;
    for (let t = start; t < start + 1500; t += 16) result = c.speakingEyeOffset(t, true);
    return result;
  }
  assert.ok(settle(4500).x < -20);
  assert.ok(Math.abs(settle(8500).x) < 2);
  assert.ok(settle(12700).x > 18);
  c.state.gaze.manual = true;
  assert.equal(c.speakingEyeOffset(15000, false).x, 0);
  c.state.gaze.manual = false;
  c.speechEyeLevel = () => 0;
  assert.equal(c.speakingEyeOffset(16000, true).y, 0);
  assert.equal(c.lastSpeechEyeAt, 0);
});

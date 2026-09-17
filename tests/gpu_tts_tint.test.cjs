const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

function source(page, name) {
  const start = page.indexOf(`    function ${name}(`);
  assert.ok(start >= 0);
  return page.slice(start, page.indexOf('\n    }', start) + 6);
}

for (const surface of ['sts', 'face-sim']) {
  const page = fs.readFileSync(`${__dirname}/../web/${surface}/index.html`, 'utf8').replace(/\r\n/g, '\n');
  test(`${surface}: intervals annotate samples, including earlier work and clock offsets`, () => {
    const c = vm.createContext({ gpuHistoryBucketMs: 1000 });
    vm.runInContext(source(page, 'markGpuTtsHistory'), c);
    const history = [10000, 11000, 12000, 13000].map(t => ({ t, value: 80 }));
    c.markGpuTtsHistory(history, { status: 'ok', sampled_at_ms: 4000,
      intervals: [{ start_ms: 1800, end_ms: 2300 }] }, 14000);
    assert.deepEqual(history.map(x => x.tts), [false, true, true, false]);
    assert.deepEqual(history.map(x => x.value), [80, 80, 80, 80]);
    c.markGpuTtsHistory(history, undefined, 15000);
    assert.ok(history.every(x => !x.tts));
    c.markGpuTtsHistory([40, null, ...history], { status: 'ok', intervals: [{ start_ms: 'bad' }] }, 15000);
    assert.ok(history.every(x => !x.tts));
  });

  test(`${surface}: purple total trace plus amber synthesis overlay, no extra labels`, () => {
    const samples = [{ value: 0 }, { value: 80, tts: true }, { value: 70, tts: false }];
    const strokes = [];
    const ctx = { save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {},
      stroke() { strokes.push(this.strokeStyle); }, fillText() {} };
    const c = vm.createContext({ ctx, faceLayout: { width: 768 }, gpuUtilHistory: samples,
      gpuHistoryValue: x => x.value, boundedPercent: x => Math.max(0, Math.min(100, x)),
      gpuTelemetry: { status: 'ok', lastOkAt: 1000 }, performance: { now: () => 1000 },
      state: {}, fitCanvasText: x => x });
    if (surface === 'sts') {
      vm.runInContext(source(page, 'renderGpuBars'), c);
      const container = { dataset: {} };
      c.renderGpuBars(container, samples);
      assert.match(container.innerHTML, /gpu-trace.*points=/);
      assert.match(container.innerHTML, /stroke: #ffc56e/);
      assert.match(container.innerHTML, /d="M 0.00,100.00 L 50.00,20.00 /);
      assert.doesNotMatch(container.innerHTML, /<text/);
    } else {
      vm.runInContext(source(page, 'drawGpuStrip'), c);
      c.drawGpuStrip(0);
      assert.deepEqual(strokes, ['#e05cff', '#ffc56e']);
    }
  });
}

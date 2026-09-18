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

  test(`${surface}: purple and amber fills follow their trace intervals, no extra labels`, () => {
    const samples = [{ value: 0 }, { value: 80, tts: true }, { value: 70, tts: false }];
    const strokes = [], fills = [];
    let path = [];
    const ctx = { save() {}, restore() {}, beginPath() { path = []; },
      moveTo(x, y) { path.push([x, y]); }, lineTo(x, y) { path.push([x, y]); }, closePath() {},
      fill() { fills.push({ color: this.fillStyle, points: path.map(point => point.map(n => Number(n.toFixed(4)))) }); },
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
      assert.match(container.innerHTML, /d="M 0.00,100.00 L 50.00,20.00"/);
      assert.match(container.innerHTML, /class="gpu-tts-area" d="M 0.00,100 L 0.00,100.00 L 50.00,20.00 L 50.00,100 Z"/);
      assert.match(container.innerHTML, /class="gpu-area" d="M 50.00,100 L 50.00,20.00 L 100.00,30.00 L 100.00,100 Z"/);
      assert.match(page, /\.gpu-tts-area\s*\{\s*fill: rgba\(255, 181, 58, 0\.24\)/);
      assert.doesNotMatch(container.innerHTML, /<text/);
    } else {
      vm.runInContext(source(page, 'drawGpuStrip'), c);
      c.drawGpuStrip(0);
      assert.deepEqual(strokes, ['#d85df1', '#ffc56e']);
      assert.deepEqual(fills, [
        { color: 'rgba(100, 12, 116, 0.74)', points: [[384, 54], [384, 31.6], [744, 34.4], [744, 54]] },
        { color: 'rgba(255, 181, 58, 0.24)', points: [[24, 54], [24, 54], [384, 31.6], [384, 54]] }
      ]);
    }
  });

  test(`${surface}: empty, single, separated speech and stale histories keep bounded fills`, () => {
    for (const history of [[], [40], [{ value: 80, tts: true }],
      [{ value: 80 }, { value: 90, tts: true }, { value: 20 }, { value: 70, tts: true }]]) {
      const hasSpeech = (history.length > 1 ? history.slice(1) : history).some(sample => sample?.tts);
      const fills = [], points = [];
      const ctx = { save() {}, restore() {}, beginPath() {}, closePath() {}, stroke() {}, fillText() {},
        moveTo(x, y) { points.push([x, y]); }, lineTo(x, y) { points.push([x, y]); },
        fill() { fills.push(this.fillStyle); } };
      const c = vm.createContext({ ctx, faceLayout: { width: 768 }, gpuUtilHistory: history,
        gpuHistoryValue: x => typeof x === 'number' ? x : x.value,
        boundedPercent: x => Math.max(0, Math.min(100, x)),
        gpuTelemetry: { status: 'unavailable', lastOkAt: 0 }, performance: { now: () => 10000 },
        state: {}, fitCanvasText: x => x });
      if (surface === 'sts') {
        vm.runInContext(source(page, 'renderGpuBars'), c);
        const container = { dataset: {} };
        c.renderGpuBars(container, history);
        const amber = /class="gpu-tts-area" d="([^"]*)"/.exec(container.innerHTML)[1];
        assert.equal(Boolean(amber), hasSpeech);
        assert.doesNotMatch(container.innerHTML, /NaN|Infinity/);
        if (history.length === 1 && hasSpeech) assert.match(container.innerHTML, /class="gpu-area" d=""/);
      } else {
        vm.runInContext(source(page, 'drawGpuStrip'), c);
        c.drawGpuStrip(0);
        assert.equal(fills.includes('rgba(255, 181, 58, 0.10)'), hasSpeech);
        if (history.length === 1 && hasSpeech) assert.equal(fills.length, 1);
        assert.ok(points.every(([x, y]) => Number.isFinite(x) && x >= 24 && x <= 744 && y >= 26 && y <= 54));
      }
    }
  });
}

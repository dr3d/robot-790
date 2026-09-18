const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const page = fs.readFileSync(path.join(__dirname, '../web/face-sim/index.html'), 'utf8');
const start = page.indexOf('    function drawGpuStrip(');
const end = page.indexOf('    function fitCanvasText(', start);

test('browser face draws a filled full-width nerve trace without telemetry labels', () => {
  for (const samples of [[], [40], [0, 100, 20]]) {
    const points = [], labels = [], strokes = [], fills = [];
    const ctx = { save() {}, restore() {}, beginPath() {},
      moveTo: (x, y) => points.push([x, y]), lineTo: (x, y) => points.push([x, y]),
      closePath() {}, fill() { fills.push(this.fillStyle); },
      stroke() { strokes.push(this.strokeStyle); }, fillText: text => labels.push(text) };
    const context = vm.createContext({ ctx, faceLayout: { width: 768 }, gpuUtilHistory: samples,
      gpuHistoryValue: value => value, boundedPercent: value => Math.min(100, Math.max(0, value)),
      gpuTelemetry: { status: 'ok', lastOkAt: 1000 }, performance: { now: () => 1000 },
      state: { status_line: 'tools: idle' }, fitCanvasText: text => text });
    assert.ok(start > 0 && end > start);
    vm.runInContext(page.slice(start, end), context);
    context.drawGpuStrip(0);
    assert.deepEqual(strokes, ['#d85df1']);
    assert.deepEqual(fills, ['rgba(100, 12, 116, 0.74)']);
    assert.deepEqual(labels, ['tools: idle']);
    assert.equal(points[0][0], 24);
    assert.equal(points.at(-1)[0], 744);
    assert.ok(points.every(([x, y]) => Number.isFinite(x) && y >= 26 && y <= 54));
  }
});

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../web/sts/index.html'), 'utf8');
const source = html.slice(html.indexOf('    function initializeLiveCameraResizer()'), html.indexOf('    function currentSensingEyePreviewHeight()'));

function setup(saved = null) {
  const target = () => ({
    listeners: new Map(), attributes: {},
    addEventListener(name, fn) { this.listeners.set(name, fn); },
    removeEventListener(name) { this.listeners.delete(name); },
    setAttribute(name, value) { this.attributes[name] = value; },
    fire(name, extra = {}) { this.listeners.get(name)?.({type: name, button: 0, pointerId: 1, clientY: 100, preventDefault() {}, ...extra}); }
  });
  const handle = target(), window = target(), classes = new Set();
  let stored = saved, css;
  const context = {
    document: {querySelector: () => handle, body: {classList: {add: x => classes.add(x), remove: x => classes.delete(x)}},
      documentElement: {style: {setProperty: (_, value) => { css = value; }}}},
    visionCameraPreview: {}, window,
    getComputedStyle: () => ({height: '72px'}),
    localStorage: {getItem: () => stored, setItem: (_, value) => { stored = value; }},
    clampNumber: (value, min, max, fallback) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback,
    scheduleLogPaneHeightUpdate() {}
  };
  vm.runInNewContext(`${source}\ninitializeLiveCameraResizer();`, context);
  return {handle, window, classes, height: () => Number(handle.attributes['aria-valuenow']), stored: () => stored, css: () => css};
}

test('camera resizer preserves default size and restores bounded saved heights', () => {
  assert.equal(setup().height(), 72);
  assert.equal(setup('bad').height(), 72);
  assert.equal(setup('Infinity').height(), 72);
  assert.equal(setup('340').height(), 340);
  assert.equal(setup('900').height(), 600);
  assert.equal(setup('-5').height(), 72);
  assert.match(html, /id="visionCameraPreviewHandle"[^>]*role="separator"[^>]*aria-controls="visionCameraPreview"/);
  assert.match(html, /\.camera-card\.live \.vision-preview-handle/);
});

test('camera pointer drag persists on completion and ignores unrelated pointers', () => {
  const ui = setup();
  ui.handle.fire('pointerdown', {button: 2});
  assert.equal(ui.window.listeners.size, 0);
  ui.handle.fire('pointerdown');
  ui.window.fire('pointermove', {clientY: 280, pointerId: 2});
  assert.equal(ui.height(), 72);
  ui.window.fire('pointermove', {clientY: 280});
  assert.equal(ui.height(), 252);
  assert.equal(ui.stored(), null);
  ui.window.fire('pointerup');
  assert.equal(ui.stored(), '252');
  assert.equal(ui.css(), '252px');
  assert.equal(ui.window.listeners.size, 0);
  assert.equal(ui.classes.size, 0);
});

test('camera resize cancellation restores height and keyboard/reset are bounded', () => {
  const ui = setup('200');
  ui.handle.fire('pointerdown');
  ui.window.fire('pointermove', {clientY: 800});
  assert.equal(ui.height(), 600);
  ui.window.fire('pointercancel');
  assert.equal(ui.height(), 200);
  ui.handle.fire('keydown', {key: 'ArrowDown', shiftKey: true});
  assert.equal(ui.height(), 240);
  ui.handle.fire('keydown', {key: 'ArrowUp'});
  assert.equal(ui.height(), 224);
  ui.handle.fire('keydown', {key: 'End'});
  assert.equal(ui.height(), 600);
  ui.handle.fire('keydown', {key: 'Home'});
  assert.equal(ui.height(), 72);
  ui.handle.fire('dblclick');
  assert.equal(ui.stored(), '72');
});

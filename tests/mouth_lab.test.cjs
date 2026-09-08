const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const rig = require('../web/mouth-lab/rig.js');

const track = cues => rig.validateTrack({ metadata: { duration: 2 }, mouthCues: cues });

test('Rhubarb cue validation rejects malformed input and fills gaps with rest', () => {
  const result = track([{ start: .2, end: .8, value: 'F' }]);
  assert.deepEqual(result.mouthCues.map(c => c.value), ['X', 'F', 'X']);
  assert.equal(result.mouthCues[2].end, 2);
  for (const cue of [
    { start: -.1, end: .2, value: 'A' },
    { start: 0, end: Infinity, value: 'A' },
    { start: 0, end: 0, value: 'A' },
    { start: 0, end: 2.1, value: 'A' },
    { start: 0, end: 1, value: 'AA' },
    { start: 0, end: 1, value: '__proto__' },
    { start: '0', end: 1, value: 'A' }
  ]) assert.throws(() => track([cue]));
  assert.throws(() => track([{ start: 0, end: 1, value: 'A' }, { start: .9, end: 2, value: 'F' }]));
  assert.throws(() => rig.validateTrack({ metadata: { duration: 121 }, mouthCues: [] }));
  assert.throws(() => rig.validateTrack({ metadata: { duration: 2 }, mouthCues: Array(10001).fill({}) }));
});

test('all short bilabials reach a sealed center, even with maximum transition and lip lead', () => {
  for (const duration of [.025, .05, .09, .15]) {
    const data = track([
      { start: 0, end: .5, value: 'D' },
      { start: .5, end: .5 + duration, value: 'A' },
      { start: .5 + duration, end: 2, value: 'F' }
    ]);
    const pose = rig.poseAt(data, .5 + duration / 2, { transition: 180, anticipation: 100 });
    const g = rig.geometry(pose, { jaw: 1.5, smile: .8 });
    assert.equal(pose.seal, 1);
    assert.equal(g.bottom - g.top, 0);
  }
});

test('rounding anticipates without opening a closed consonant', () => {
  const data = track([{ start: 0, end: 1, value: 'A' }, { start: 1, end: 2, value: 'F' }]);
  const early = rig.poseAt(data, .95, { transition: 60, anticipation: 100 });
  assert.ok(early.round > .9);
  assert.equal(early.seal, 1);
  assert.equal(rig.geometry(early).bottom, 0);
});

test('every pair blends continuously with bounded finite geometry', () => {
  for (const left of Object.keys(rig.poses)) for (const right of Object.keys(rig.poses)) {
    const data = track([{ start: 0, end: 1, value: left }, { start: 1, end: 2, value: right }]);
    const before = rig.poseAt(data, 1 - .000001);
    const after = rig.poseAt(data, 1 + .000001);
    for (const key of Object.keys(before)) assert.ok(Math.abs(before[key] - after[key]) < .001, `${left}-${right}: ${key}`);
    for (let t = 0; t <= 2; t += 1 / 60) {
      const pose = rig.poseAt(data, t);
      for (const value of Object.values(pose)) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
      const g = rig.geometry(pose);
      assert.ok(g.bottom >= g.top);
    }
  }
});

test('sampling is seekable, frame-rate independent, and returns rest outside the clip', () => {
  const data = rig.studies.contacts;
  const expected = rig.poseAt(data, 1.07);
  for (let t = 0; t < 2; t += 1 / 30) rig.poseAt(data, t);
  assert.deepEqual(rig.poseAt(data, 1.07), expected);
  assert.deepEqual(rig.poseAt(data, -1), rig.poses.X);
  assert.deepEqual(rig.poseAt(data, data.metadata.duration), rig.poses.X);
});

test('zero transition and zero lead exactly match the hard cue targets', () => {
  for (const cue of rig.studies.inventory.mouthCues) {
    assert.deepEqual(rig.poseAt(rig.studies.inventory, cue.start + .01, { transition: 0, anticipation: 0 }), rig.poses[cue.value]);
  }
});

test('one drawing routine handles every pose without nonfinite canvas arguments', () => {
  const numbers = [];
  let balance = 0;
  const ctx = new Proxy({}, {
    get(_, key) {
      if (key === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (key === 'save') return () => balance++;
      if (key === 'restore') return () => balance--;
      return (...args) => numbers.push(...args.flat().filter(arg => typeof arg === 'number'));
    },
    set() { return true; }
  });
  for (const pose of Object.values(rig.poses)) rig.draw(ctx, pose);
  assert.equal(balance, 0);
  assert.ok(numbers.length > 500);
  assert.ok(numbers.every(Number.isFinite));
});

function bootLab() {
  const root = path.join(__dirname, '../web/mouth-lab');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const noop = () => {};
  const context = new Proxy({}, { get: (_, key) => key === 'createLinearGradient' ? () => ({ addColorStop: noop }) : noop, set: () => true });
  function element() {
    return {
      value: '', checked: true, children: [], listeners: {}, files: [], dataset: {}, style: {}, attributes: {},
      append(item) { this.children.push(item); },
      addEventListener(type, fn) { this.listeners[type] = fn; },
      setAttribute(key, value) { this.attributes[key] = value; },
      removeAttribute: noop, querySelector: () => ({}), replaceChildren: noop,
      pause: noop, load: noop, click: noop, getContext: () => context
    };
  }
  const nodes = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m => [m[1], element()]));
  nodes.speed.value = '1';
  nodes.study.value = 'contacts';
  const frames = new Map();
  let sequence = 0;
  const doc = { hidden: false, listeners: {}, getElementById: id => nodes[id], createElement: element, createDocumentFragment: element,
    addEventListener(type, fn) { this.listeners[type] = fn; } };
  const sandbox = { window: { MouthRig: rig, addEventListener: noop }, document: doc,
    performance: { now: () => 0 }, requestAnimationFrame: fn => { frames.set(++sequence, fn); return sequence; },
    cancelAnimationFrame: id => frames.delete(id), setTimeout: noop,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: noop }, Blob, console };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'lab.js'), 'utf8'), sandbox);
  return { nodes, frames, doc };
}

test('lab boots without network access, has no paused animation loop, and stops when hidden', async () => {
  const { nodes, frames, doc } = bootLab();
  assert.equal(nodes.sourceState.textContent, 'Silent rig study');
  assert.equal(nodes.poses.children.length, 9);
  assert.equal(frames.size, 0);
  await nodes.play.listeners.click();
  assert.equal(frames.size, 1);
  await nodes.play.listeners.click();
  assert.equal(frames.size, 0);
  await nodes.play.listeners.click();
  doc.hidden = true;
  doc.listeners.visibilitychange();
  assert.equal(frames.size, 0);
});

test('audio import refuses playback without its cue track', async () => {
  const { nodes, frames } = bootLab();
  nodes.audioFile.files = [{ name: 'example.wav', size: 12 }];
  nodes.audioFile.listeners.change();
  nodes.audio.duration = 1;
  nodes.audio.listeners.loadedmetadata();
  await nodes.play.listeners.click();
  assert.match(nodes.error.textContent, /Rhubarb JSON/);
  assert.equal(frames.size, 0);
});

test('mismatched media and cue durations cannot start playback', async () => {
  const { nodes, frames } = bootLab();
  nodes.cueFile.files = [{ name: 'line.json', size: 50, text: async () => JSON.stringify(rig.studies.contacts) }];
  await nodes.cueFile.listeners.change();
  nodes.audioFile.files = [{ name: 'wrong.wav', size: 12 }];
  nodes.audioFile.listeners.change();
  nodes.audio.duration = 10;
  nodes.audio.listeners.loadedmetadata();
  await nodes.play.listeners.click();
  assert.match(nodes.error.textContent, /durations differ/);
  assert.equal(frames.size, 0);
});

test('Stop wins over an in-flight audio play promise', async () => {
  const { nodes, frames } = bootLab();
  nodes.cueFile.files = [{ name: 'line.json', size: 50, text: async () => JSON.stringify(rig.studies.contacts) }];
  await nodes.cueFile.listeners.change();
  nodes.audioFile.files = [{ name: 'line.wav', size: 12 }];
  nodes.audioFile.listeners.change();
  nodes.audio.duration = rig.studies.contacts.metadata.duration;
  nodes.audio.listeners.loadedmetadata();
  let finish;
  nodes.audio.play = () => new Promise(resolve => { finish = resolve; });
  const start = nodes.play.listeners.click();
  nodes.stop.listeners.click();
  finish();
  await start;
  assert.equal(frames.size, 0);
  assert.equal(nodes.play.attributes['aria-label'], 'Play');
});

test('changing study invalidates an in-flight cue import', async () => {
  const { nodes } = bootLab();
  let finish;
  nodes.cueFile.files = [{ name: 'old.json', size: 50, text: () => new Promise(resolve => { finish = resolve; }) }];
  const loading = nodes.cueFile.listeners.change();
  nodes.study.value = 'rounding';
  nodes.study.listeners.change();
  finish(JSON.stringify(rig.studies.contacts));
  await loading;
  assert.equal(nodes.sourceState.textContent, 'Silent rig study');
  assert.equal(nodes.position.max, rig.studies.rounding.metadata.duration);
});

test('lab ships with local assets and never assigns canvas dimensions during playback', () => {
  const root = path.join(__dirname, '../web/mouth-lab');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const source = fs.readFileSync(path.join(root, 'lab.js'), 'utf8');
  for (const [, asset] of html.matchAll(/(?:src|href)="([^"]+)"/g)) assert.ok(fs.existsSync(path.resolve(root, asset)), asset);
  assert.doesNotMatch(source, /fetch\(|WebSocket|ResizeObserver|canvas\.(width|height)\s*=/);
  new vm.Script(source);
});

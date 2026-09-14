const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const context = vm.createContext({});
for (const file of ['mouth-contract.js', 'mouth-renderer.js']) {
  vm.runInContext(fs.readFileSync(`${__dirname}/../web/face-sim/${file}`, 'utf8'), context);
}
const contract = context.Robot790MouthContract;
const Renderer = context.Robot790HumanMouth;

test('every human pose and speech blend draws finite geometry without mutating the pose', () => {
  let depth = 0, paths = 0;
  const canvas = new Proxy({}, {
    get(_, name) {
      if (name === 'save') return () => depth++;
      if (name === 'restore') return () => depth--;
      return (...args) => {
        paths++;
        for (const arg of args) if (typeof arg === 'number') assert(Number.isFinite(arg), `${name}: ${arg}`);
        if (name === 'ellipse') assert(args[2] >= 0 && args[3] >= 0);
      };
    }, set() { return true; }
  });
  const renderer = new Renderer(canvas);
  for (const shape of contract.mouthShapes) {
    const pose = contract.mouthPoseFor(shape), original = JSON.stringify(pose);
    for (const talk of [0, 0.01, 0.5, 1]) {
      for (const t of [1000, 1250, 1700]) renderer.draw(shape, pose, talk, 0.6, t, { x: 0, y: 605, width: 720, height: 320 });
    }
    assert.equal(JSON.stringify(pose), original);
    assert.equal(depth, 0);
  }
  assert(paths > 1000);
});

test('browser owns one renderer and consumes generated poses rather than a second pose table', () => {
  const html = fs.readFileSync(`${__dirname}/../web/face-sim/index.html`, 'utf8');
  assert.match(html, /new Robot790HumanMouth\(ctx\)/);
  assert.match(html, /return Robot790MouthContract.mouthPoseFor\(shape\)/);
  assert.doesNotMatch(html, /smile: \{ open:/);
  assert(html.indexOf('src="mouth-contract.js"') < html.indexOf('new Robot790HumanMouth'));
});

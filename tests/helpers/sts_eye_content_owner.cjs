const fs = require('node:fs');
const vm = require('node:vm');
const cp = require('node:child_process');
const { extract } = require('./sts_completion_harness.cjs');
const fields = {
  sensingEyeGeneration: 'generation', sensingEyeInboxClearInFlight: 'clearInFlight',
  visionImageUrl: 'imageUrl', visionImageName: 'imageName', visionImageStaged: 'imageStaged', visionImageOpenUrl: 'imageOpenUrl',
  sensingTextContent: 'text', sensingTextName: 'textName', sensingTextOpenUrl: 'textOpenUrl', sensingTextSavedFilename: 'textSavedFilename',
};
const installed = new WeakMap(), aliases = new WeakSet();
let legacyModule;

function installEyeContent(c, page = fs.readFileSync(`${__dirname}/../../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n')) {
  require('./sts_eye_inbox_state_owner.cjs').installInboxState(c, page);
  require('./sts_eye_history_owner.cjs').installEyeHistory(c, page);
  if (!page.includes('function createSensingEyeContent(')) return;
  const factory = extract(page, 'createSensingEyeContent');
  if (factory.includes('get sensingEyeGeneration()')) {
    legacyModule ??= cp.execFileSync('git', ['show', '3823d81:web/sts/sensing-eye-content.js'], { encoding: 'utf8' });
    vm.runInContext(legacyModule, c);
    vm.runInContext(factory, c);
    c.sensingEyeContent = c.createSensingEyeContent();
    return;
  }
  if (installed.get(c) === c.sensingEyeContent && c.sensingEyeContent) return;
  const descriptors = Object.fromEntries(Object.keys(fields).map(key => [key, Object.getOwnPropertyDescriptor(c, key)]));
  const initial = Object.fromEntries(Object.keys(fields).map(key => [key, c[key]]));
  let state;
  // White-box VM fixtures can seed/mutate races and trace private writes. The
  // shipped module has no such hook; direct-module and browser tests use it intact.
  c.__createFixtureEyeState = defaults => {
    for (const [key, value] of Object.entries(initial)) if (value !== undefined) defaults[key] = value;
    state = new Proxy(defaults, { set(target, key, value) {
      target[key] = value;
      const setter = descriptors[key]?.set;
      if (setter && !aliases.has(setter)) setter.call(c, value);
      return true;
    } });
    return state;
  };
  const source = fs.readFileSync(`${__dirname}/../../web/sts/sensing-eye-content.js`, 'utf8');
  if (!source.includes('const s = createState();')) throw Error('Eye fixture state hook missing');
  vm.runInContext(source.replace('const s = createState();', 'const s = __createFixtureEyeState(createState());'), c);
  vm.runInContext(factory, c);
  c.sensingEyeContent = c.createSensingEyeContent();
  installed.set(c, c.sensingEyeContent);
  for (const key of Object.keys(fields)) {
    const setter = value => { state[key] = value; };
    aliases.add(setter);
    Object.defineProperty(c, key, { configurable: true, enumerable: true, get: () => state[key], set: setter });
  }
}

function normalizeEyeAccess(source) {
  source = require('./sts_policy_compat.cjs').normalizeLaterPolicyAdditions(source);
  source = require('./sts_eye_history_owner.cjs').normalizeHistoryAccess(source);
  source = source.replace(/sensingEyeContent\.markStaged\(\)/g, 'visionImageStaged = true')
    .replace(/sensingEyeContent\.resetStaging\(\)/g, 'visionImageStaged = false')
    .replace(/sensingEyeContent\.restoreImage\(item\);/g, [
      'sensingTextContent = "";', '      sensingTextName = "";', '      sensingTextOpenUrl = "";',
      '      sensingTextSavedFilename = "";', '      visionImageUrl = item.dataUrl;',
      '      visionImageName = item.name || "sensing-eye image";', '      visionImageStaged = false;',
      '      visionImageOpenUrl = item.openUrl || "";'].join('\n'));
  for (const [legacy, field] of Object.entries(fields)) source = source.replace(new RegExp(`\\bsensingEyeContent\\.${field}\\b`, 'g'), legacy);
  return source;
}

module.exports = { installEyeContent, normalizeEyeAccess, fields };

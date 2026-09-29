const fs = require('node:fs');
const vm = require('node:vm');
const cp = require('node:child_process');
const { extract } = require('./sts_completion_harness.cjs');
const installed = new WeakMap();
const fields = { sensingEyeImageHistory: 'images', sensingEyeTextHistory: 'texts',
  sensingEyeImageHistorySeq: 'imageSeq', sensingEyeTextHistorySeq: 'textSeq' };
let baseline;

function installEyeHistory(c, page) {
  if (!page.includes('function createSensingEyeHistory(')) return;
  if (installed.get(c) === c.sensingEyeHistory && c.sensingEyeHistory) return;
  let state;
  const initial = Object.fromEntries(Object.entries(fields).map(([old, key]) => [key, c[old]]));
  c.maxSensingEyeImageHistory ??= 5;
  // Legacy VM fixtures seed private state here; browser/direct-module checks
  // load the shipped module intact, without exposing these arrays in production.
  c.__createFixtureHistory = defaults => {
    for (const [key, value] of Object.entries(initial)) if (value !== undefined) defaults[key] = value;
    return state = defaults;
  };
  const source = fs.readFileSync(`${__dirname}/../../web/sts/sensing-eye-history.js`, 'utf8');
  if (!source.includes('const s = createState();')) throw Error('History fixture state hook missing');
  vm.runInContext(source.replace('const s = createState();', 'const s = __createFixtureHistory(createState());'), c);
  vm.runInContext(extract(page, 'createSensingEyeHistory'), c);
  c.sensingEyeHistory = c.createSensingEyeHistory();
  installed.set(c, c.sensingEyeHistory);
  for (const [old, key] of Object.entries(fields)) Object.defineProperty(c, old, {
    configurable: true, enumerable: true, get: () => state[key], set: value => { state[key] = value; }
  });
}

function normalizeHistoryAccess(source) {
  source = require('./sts_eye_assets_owner.cjs').normalizeAssetAccess(source);
  baseline ??= cp.execFileSync('git', ['show', 'df44692:web/sts/index.html'], { encoding: 'utf8', maxBuffer: 4e6 }).replace(/\r\n/g, '\n');
  for (const [name, method, args] of [
    ['rememberSensingEyeImage', 'rememberImage', 'options'], ['rememberSensingEyeText', 'rememberText', 'options'],
    ['sensingEyeImageHistoryList', 'imageList', ''], ['sensingEyeTextHistoryList', 'textList', ''],
    ['sensingEyeImageHistoryContextLine', 'contextLine', ''],
  ]) source = source.replace(`    function ${name}(${args}) {\n      return sensingEyeHistory.${method}(${args});\n    }`, extract(baseline, name));
  return source.replaceAll('sensingEyeHistory.imageCount', 'sensingEyeImageHistory.length')
    .replaceAll('sensingEyeHistory.textCount', 'sensingEyeTextHistory.length')
    .replaceAll('sensingEyeHistory.imageFor(sensingEyeContent.imageUrl)', 'sensingEyeImageHistory.find((item) => item.dataUrl === sensingEyeContent.imageUrl) || null')
    .replaceAll('sensingEyeHistory.textById(listedItem.history_id || listedItem.id)', 'sensingEyeTextHistory.find((candidate) => candidate.id === (listedItem.history_id || listedItem.id))')
    .replaceAll('sensingEyeHistory.imageById(listedItem.history_id || listedItem.id)', 'sensingEyeImageHistory.find((candidate) => candidate.id === (listedItem.history_id || listedItem.id))')
    .replaceAll('sensingEyeHistory.imageIndex(item)', 'sensingEyeImageHistory.indexOf(item)');
}

module.exports = { installEyeHistory, normalizeHistoryAccess };

const fs = require('node:fs');
const cp = require('node:child_process');
const vm = require('node:vm');
const { extract } = require('./sts_completion_harness.cjs');
const names = ['rememberSensingEyeSessionAsset', 'sensingEyeSessionAssetFilenamesForSave',
  'persistSensingEyeSessionAssets', 'loadSensingEyeSessionAssets', 'clearSensingEyeSessionAssets'];
let baseline;

function installEyeAssets(c, page) {
  if (page.includes('function createSensingEyeSessionAssets(')) {
    vm.runInContext(fs.readFileSync(`${__dirname}/../../web/sts/sensing-eye-assets.js`, 'utf8'), c);
    vm.runInContext(extract(page, 'createSensingEyeSessionAssets'), c);
    c.sensingEyeSessionAssets = c.createSensingEyeSessionAssets();
  } else c.sensingEyeSessionAssetFilenames = new Set();
  for (const name of names) vm.runInContext(extract(page, name), c);
}

function normalizeAssetAccess(source) {
  source = require('./sts_generated_catalogue_scope.cjs').normalizeGeneratedCatalogue(source);
  baseline ??= cp.execFileSync('git', ['show', '97d0721:web/sts/index.html'],
    { encoding: 'utf8', maxBuffer: 4e6 }).replace(/\r\n/g, '\n');
  for (const [i, method] of ['remember', 'filenames', 'persist', 'load', 'clear'].entries()) {
    const args = i ? '' : 'filename';
    source = source.replace(`    function ${names[i]}(${args}) {\n      return sensingEyeSessionAssets.${method}(${args});\n    }`, extract(baseline, names[i]));
  }
  return source;
}

module.exports = { names, installEyeAssets, normalizeAssetAccess };

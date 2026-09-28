const fs = require('node:fs');
const vm = require('node:vm');
const { extract } = require('./sts_completion_harness.cjs');

function installEyeContent(c, page = fs.readFileSync(`${__dirname}/../../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n')) {
  if (!page.includes('function createSensingEyeContent(')) return;
  // Fixtures may copy globals from another VM; bind accessors to this VM each time.
  vm.runInContext(fs.readFileSync(`${__dirname}/../../web/sts/sensing-eye-content.js`, 'utf8'), c);
  vm.runInContext(extract(page, 'createSensingEyeContent'), c);
  c.sensingEyeContent = c.createSensingEyeContent();
}

module.exports = { installEyeContent };

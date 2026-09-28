const fs = require('node:fs');
const vm = require('node:vm');
const { extract } = require('./sts_completion_harness.cjs');

function installEyePersistence(c, page = fs.readFileSync(`${__dirname}/../../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n')) {
  require('./sts_eye_content_owner.cjs').installEyeContent(c, page);
  if (c.sensingEyePersistence || !page.includes('function createSensingEyePersistence(')) return;
  vm.runInContext(fs.readFileSync(`${__dirname}/../../web/sts/sensing-eye-persistence.js`, 'utf8'), c);
  vm.runInContext(extract(page, 'createSensingEyePersistence'), c);
  c.sensingEyePersistence = c.createSensingEyePersistence();
}

module.exports = { installEyePersistence };

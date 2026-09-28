const fs = require('node:fs');
const vm = require('node:vm');
const { extract } = require('./sts_completion_harness.cjs');

function installImageHandoff(c, page = fs.readFileSync(`${__dirname}/../../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n')) {
  require('./sts_eye_content_owner.cjs').installEyeContent(c, page);
  if (c.generatedImageHandoff || !page.includes('function createGeneratedImageHandoff(')) return;
  vm.runInContext(fs.readFileSync(`${__dirname}/../../web/sts/generated-image-handoff.js`, 'utf8'), c);
  vm.runInContext(extract(page, 'createGeneratedImageHandoff'), c);
  c.generatedImageHandoff = c.createGeneratedImageHandoff();
}

module.exports = { installImageHandoff };

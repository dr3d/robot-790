const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const page = fs.readFileSync(`${__dirname}/../../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

function installBrain2Surface(context) {
  if (context.brain2Surface) return context.brain2Surface;
  context.Robot790Brain2Surface = require('../../web/sts/brain2-surface.js');
  const start = page.indexOf('    function createBrain2SurfaceOwner() {');
  const end = page.indexOf('\n    }\n', start);
  assert.ok(start >= 0 && end > start, 'production deferred surface wiring');
  vm.runInContext(page.slice(start, end + 6), context);
  return context.brain2Surface = context.createBrain2SurfaceOwner();
}

module.exports = { installBrain2Surface };

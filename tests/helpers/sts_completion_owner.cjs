const fs = require('node:fs');
const vm = require('node:vm');
const { extract } = require('./sts_completion_harness.cjs');

function installResponseCompletion(c, page = fs.readFileSync(`${__dirname}/../../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n')) {
  if (c.responseCompletion || !page.includes('function createResponseCompletionOwner(')) return;
  const names = { responseActive: 'active', assistantFinishPending: 'pending', assistantFinishWasIdle: 'wasIdle',
    assistantFinishArmedAt: 'armedAt', assistantFinishTimer: 'timer' };
  const initial = Object.fromEntries(Object.keys(names).map(name => [name, c[name]]));
  c.Robot790ResponseCompletion = require('../../web/sts/response-completion.js');
  vm.runInContext(extract(page, 'createResponseCompletionOwner'), c);
  c.responseCompletion = c.createResponseCompletionOwner();
  // Old fixture controls point at real owner state, never a parallel store.
  for (const [name, field] of Object.entries(names)) {
    if (initial[name] !== undefined) c.responseCompletion[field] = initial[name];
    Object.defineProperty(c, name, { configurable: true, enumerable: true,
      get: () => c.responseCompletion[field], set: value => { c.responseCompletion[field] = value; } });
  }
}

module.exports = { installResponseCompletion };

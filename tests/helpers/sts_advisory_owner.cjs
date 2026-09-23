const fs = require('node:fs');
const vm = require('node:vm');
const { functionSource } = require('./sts_advisory_harness.cjs');
const page = fs.readFileSync(`${__dirname}/../../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

function installBrain2Advisories(c, source = page) {
  if (c.brain2Advisories || !source.includes('function createBrain2AdvisoryOwner(')) return;
  c.Robot790Brain2Advisories = require('../../web/sts/brain2-advisories.js');
  vm.runInContext(functionSource(source, 'createBrain2AdvisoryOwner'), c);
  c.brain2Advisories = c.createBrain2AdvisoryOwner();
  for (const [legacy, key] of [['brain2NoteCandidates', 'notes'],
    ['brain2QuestionCandidates', 'questions'], ['brain2RevisionCandidates', 'revisions']]) {
    const seed = c[legacy] || [];
    // Old fixture knobs address the real owner, not a second state store.
    Object.defineProperty(c, legacy, { configurable: true,
      get: () => c.brain2Advisories[key],
      set: value => { const items = c.brain2Advisories[key]; items.splice(0, items.length, ...value); }
    });
    c[legacy] = seed;
  }
}
module.exports = { installBrain2Advisories };

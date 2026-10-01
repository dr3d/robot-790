const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const page = fs.readFileSync(`${__dirname}/../../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

function installBrain2Work(context, source = page) {
  context.brain2History ||= require('../../web/sts/brain2-history.js').create();
  // Legacy scenarios have no archived input; dedicated history tests install real candidates.
  context.brain2HistoryCandidate ||= () => null;
  context.brain2HistoryEnabled ||= () => false;
  if (context.brain2Work) return context.brain2Work;
  const busy = !!context.brain2InFlight, headlines = !!context.brain2HeadlinesInFlight;
  context.Robot790Brain2Work = require('../../web/sts/brain2-work.js');
  const initializer = source.match(/^    const brain2Work = (.*);$/m);
  assert(initializer, 'production B2 work initializer');
  vm.runInContext(`globalThis.brain2Work = ${initializer[1]};`, context);
  const owner = context.brain2Work;
  const session = () => context.realtimeConnection || { socket: context.ws, generation: context.realtimeSessionGeneration };
  // Legacy fixture knobs address the real owner; no parallel busy state.
  Object.defineProperty(context, 'brain2InFlight', { configurable: true,
    get: () => owner.busy,
    set: value => { const reading = owner.headlines; owner.reset(); if (value) owner.begin({ ...session(), headlines: reading }); }
  });
  Object.defineProperty(context, 'brain2HeadlinesInFlight', { configurable: true,
    get: () => owner.headlines,
    set: value => {
      if (!value) owner.clearHeadlines();
      else { owner.reset(); owner.begin({ ...session(), headlines: true }); }
    }
  });
  if (busy || headlines) owner.begin({ ...session(), headlines });
  return owner;
}

module.exports = { installBrain2Work };

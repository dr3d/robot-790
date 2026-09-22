const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const page = fs.readFileSync(`${__dirname}/../../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

function installToolContinuation(context) {
  if (context.toolContinuation) return context.toolContinuation;
  context.Robot790ToolContinuation = require('../../web/sts/tool-continuation.js');
  for (const name of ['createToolContinuationOwner', 'dispatchToolFollowup']) {
    const start = page.indexOf(`    function ${name}(`);
    const end = page.indexOf('\n    }\n', start);
    assert.ok(start >= 0 && end > start, name);
    vm.runInContext(page.slice(start, end + 6), context, { filename: `sts:${name}` });
  }
  vm.runInContext('globalThis.toolContinuation = createToolContinuationOwner();', context);
  // Existing fixtures seed/assert legacy names; aliases target the real owner,
  // never a second copy of production state or a mock continuation implementation.
  const fields = {
    pendingToolCalls: 'pending', toolFollowupNeeded: 'needed', toolFollowupTerminal: 'terminal',
    responseDoneAfterTool: 'responseDone', toolContinuationRounds: 'rounds',
    toolContinuationOrigin: 'origin', toolFollowupUserActivityAt: 'userActivityAt',
    toolFollowupPromptSources: 'sources', toolFollowupDrainTimer: 'drainTimer',
    handledFunctionCallIds: 'handledIds',
  };
  for (const [legacy, field] of Object.entries(fields)) {
    if (context[legacy] !== undefined) context.toolContinuation[field] = context[legacy];
    Object.defineProperty(context, legacy, { configurable: true,
      get: () => context.toolContinuation[field],
      set: value => { context.toolContinuation[field] = value; },
    });
  }
  return context.toolContinuation;
}

module.exports = { installToolContinuation };

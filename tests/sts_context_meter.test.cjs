const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const page = fs.readFileSync(path.join(__dirname, '../web/sts/index.html'), 'utf8');
function meter(limit = 131072) {
  const context = vm.createContext({ contextUsage: {}, lastConversationInputTokens: null,
    contextLimitRefreshAt: 0, refreshCalls: 0, now: 100000,
    latestBrainStatus: { context: { context_window_tokens: limit } } });
  vm.runInContext('Date.now = () => now; function refreshBrainStatusQuietly() { refreshCalls++; }', context);
  const start = page.indexOf('    function renderContextUsage()');
  const end = page.indexOf('    function updateGpuStatus(', start);
  assert.ok(start > 0 && end > start);
  vm.runInContext(page.slice(start, end), context);
  context.renderContextUsage();
  return context;
}
function response(input, extra = {}) {
  return { type: 'response.done', response: { status: 'completed', conversation_id: 'main',
    usage: { input_tokens: input }, ...extra } };
}

test('meter shows latest measured request, not cumulative tokens or session peak', () => {
  const m = meter();
  assert.equal(m.contextUsage.textContent, 'CTX --');
  m.observeContextUsage(response(53634));
  assert.equal(m.contextUsage.textContent, 'CTX 41%');
  assert.match(m.contextUsage.title, /53,634.*131,072/);
  m.observeContextUsage(response(32768));
  assert.equal(m.contextUsage.textContent, 'CTX 25%');
});

test('missing context limit triggers a bounded retry without diagnostic logging', () => {
  const m = meter(null);
  m.refreshContextLimit(true);
  assert.equal(m.refreshCalls, 1);
  m.observeContextUsage(response(32768));
  assert.equal(m.refreshCalls, 1);
  m.now += 30000;
  m.observeContextUsage(response(32768));
  assert.equal(m.refreshCalls, 2);
  m.latestBrainStatus.context.context_window_tokens = 131072;
  m.renderContextUsage();
  assert.equal(m.contextUsage.textContent, 'CTX 25%');
  m.now += 30000;
  m.observeContextUsage(response(32768));
  assert.equal(m.refreshCalls, 2);
  m.refreshContextLimit(true);
  assert.equal(m.refreshCalls, 3, 'reconnect refreshes even a previously known limit');
});

test('isolated calls, cancellations and missing usage do not overwrite conversation usage', () => {
  const m = meter();
  m.observeContextUsage(response(32768));
  for (const event of [response(100, { conversation_id: null }), response(90000, { status: 'cancelled' }),
    response(0), response(null), response('9000'), response(NaN), response(100, { usage: null }),
    { type: 'response.created' }]) m.observeContextUsage(event);
  assert.equal(m.contextUsage.textContent, 'CTX 25%');
});

test('unknown limits stay unknown and a later status snapshot renders retained usage', () => {
  for (const limit of [null, undefined, 0, '131072', NaN]) {
    const m = meter(limit);
    // undefined uses the helper default; explicitly replace it here.
    m.latestBrainStatus.context.context_window_tokens = limit;
    m.observeContextUsage(response(32768));
    assert.equal(m.contextUsage.textContent, 'CTX --');
    assert.match(m.contextUsage.title, /limit unavailable/);
    m.latestBrainStatus.context.context_window_tokens = 65536;
    m.renderContextUsage();
    assert.equal(m.contextUsage.textContent, 'CTX 50%');
  }
});

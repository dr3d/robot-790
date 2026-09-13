const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { LlmOverview } = require('../web/sts/llm-overview.js');

function done(id, input, output, conversation = 'conversation-1', status = 'completed') {
  return { type: 'response.done', response: { id, conversation_id: conversation, status,
    usage: { input_tokens: input, output_tokens: output } } };
}

test('disabled diagnostics clear the overview without collecting prompt or timing data', () => {
  const page = fs.readFileSync(path.join(__dirname, '../web/sts/index.html'), 'utf8').replace(/\r\n/g, '\n');
  const start = page.indexOf('    function beginLlmOverview()');
  const end = page.indexOf('\n    }\n', start);
  assert.ok(start >= 0 && end > start);
  const context = vm.createContext({ llmRunOverview: { stale: true }, contextDiagnosticsEnabled: () => false,
    lastConversationInputTokens: 1234, renderContextUsage: () => {} });
  vm.runInContext(page.slice(start, end + 6), context);
  context.beginLlmOverview();
  assert.equal(context.llmRunOverview, null);
  assert.equal(context.lastConversationInputTokens, null);
});

test('overview uses reported input, separating conversation from isolated idle contexts', () => {
  const overview = new LlmOverview({ context_window_tokens: 10000 });
  assert.equal(overview.observe(done('one', 1000, 10), 500), true);
  assert.equal(overview.observe(done('two', 100, 5, null), 900), false);
  overview.observe(done('three', 1500, 20), 1200);
  const snapshot = overview.snapshot();
  assert.deepEqual(snapshot.context.conversation, { count: 2, first: 1000, last: 1500, peak: 1500, peak_window_percent: 15 });
  assert.equal(snapshot.context.isolated.peak, 100);
  assert.equal(snapshot.total_input_tokens, 2600);
  assert.equal(snapshot.decode_tokens_per_second, null);
  assert.equal(snapshot.prefill_seconds, null);
  assert.equal(snapshot.cached_tokens, null);
  assert.equal(snapshot.response_paced_output_tokens_per_second, null);
});

test('response pacing is explicitly not engine decode or prefill time', () => {
  const overview = new LlmOverview();
  overview.observe({ type: 'response.created', response: { id: 'one' } }, 1000);
  overview.observe({ type: 'response.output_audio.delta', response_id: 'one', delta: 'audio' }, 3000);
  overview.observe(done('one', 1000, 20), 5000);
  const snapshot = overview.snapshot();
  assert.equal(snapshot.mean_first_output_seconds, 2);
  assert.equal(snapshot.response_paced_output_tokens_per_second, 5);
  assert.equal(snapshot.decode_tokens_per_second, null);
  assert.match(overview.text(), /not model decode/);
  assert.match(overview.text(), /not resident KV/);
});

test('duplicates, cancellations, missing usage and zero placeholders do not fake measurements', () => {
  const overview = new LlmOverview();
  overview.observe(done('ok', 100, 4), 100);
  overview.observe(done('ok', 100, 4), 200);
  overview.observe(done('cancelled', 9000, 300, 'conversation-1', 'cancelled'), 200);
  overview.observe(done('missing', null, null), 200);
  overview.observe(done('zero', 0, 0), 200);
  overview.observe(done('string', '100', 4), 200);
  const snapshot = overview.snapshot();
  assert.equal(snapshot.measured_responses, 1);
  assert.equal(snapshot.responses, 5);
  assert.equal(snapshot.incomplete_responses, 1);
  assert.equal(snapshot.context.conversation.last, 100);
});

test('overview has bounded state and new connections start clean', () => {
  const overview = new LlmOverview();
  for (let i = 0; i < 1000; i++) overview.observe(done(String(i), 50 + i, 4), i);
  assert.equal(overview.finished.size, 64);
  assert.equal(overview.snapshot().measured_responses, 1000);
  assert.equal(new LlmOverview().snapshot().measured_responses, 0);
  assert.equal('finished' in overview.snapshot(), false);
  assert.equal('pending' in overview.snapshot(), false);
});

test('unknown conversation identity and unfinished output remain explicit', () => {
  const overview = new LlmOverview();
  overview.observe({ type: 'response.created', response: { id: 'pending' } }, 0);
  assert.equal(overview.snapshot().unfinished_responses, 1);
  const event = done('no-id', 45, 0);
  delete event.response.conversation_id;
  overview.observe(event, 0);
  assert.equal(overview.snapshot().context.unknown.count, 1);
});

test('overview is exported with PM receipts, not injected into creature instructions', () => {
  const page = fs.readFileSync(path.join(__dirname, '../web/sts/index.html'), 'utf8');
  assert.match(page, /<script src="llm-overview\.js"><\/script>/);
  assert.match(page, /function promptLedgerReceiptReportText\(\)[\s\S]*?llmRunOverview\.text\(\)/);
  assert.match(page, /recordLlmOverview\("session overview"\)/);
  assert.match(page, /beginLlmOverview\(\);\s*updateLanePressure\(\{ reason: "realtime connected"/);
  const code = fs.readFileSync(path.join(__dirname, '../web/sts/llm-overview.js'), 'utf8');
  assert.doesNotMatch(code, /fetch\(|setInterval\(|setTimeout\(/);
});

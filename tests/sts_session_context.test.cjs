const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');
const map = fs.readFileSync(`${__dirname}/../web/sts/session-map.html`, 'utf8').replace(/\r\n/g, '\n');

function source(text, name) {
  const start = text.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
  assert.ok(start >= 0, name);
  return text.slice(start, text.indexOf('\n    }\n', start) + 6);
}
function context() {
  const c = vm.createContext({ lastConversationInputTokens: null, lastConversationContextUsage: null,
    latestBrainStatus: { context: { context_window_tokens: 65536 } },
    renderContextUsage() {}, refreshContextLimit() {}, contextDiagnosticsEnabled: () => false, llmRunOverview: null });
  for (const name of ['observeContextUsage', 'contextUsageForSessionSave', 'beginLlmOverview']) {
    vm.runInContext(source(page, name), c);
  }
  vm.runInContext(source(map, 'formatSessionDate') + source(map, 'sessionContextAtSave'), c);
  return c;
}
const usage = (input_tokens, rest = {}) => ({ type: 'robot790.request.usage', conversation_id: 'main', input_tokens, ...rest });

test('save snapshot freezes the measured tokens and original window, not later model settings', () => {
  const c = context();
  c.observeContextUsage(usage(48123, { model: 'qwen-test' }));
  c.latestBrainStatus.context.context_window_tokens = 131072;
  const snapshot = c.contextUsageForSessionSave();
  assert.equal(snapshot.context_window_tokens, 65536);
  assert.equal(snapshot.input_tokens, 48123);
  assert.equal(snapshot.model, 'qwen-test');
  assert.ok(Number.isFinite(Date.parse(snapshot.observed_at)));
  assert.equal(c.sessionContextAtSave({ context_at_save: snapshot }).label, 'CTX 73%');
  snapshot.input_tokens = 1;
  assert.equal(c.contextUsageForSessionSave().input_tokens, 48123);
});

test('only latest B1 request usage is saved; not B2, response totals, estimates or peak usage', () => {
  const c = context();
  c.observeContextUsage(usage(60000));
  c.observeContextUsage(usage(32768));
  for (const event of [usage(10, { conversation_id: null }), usage(0), usage('90000'),
    { type: 'response.done', response: { usage: { input_tokens: 130000 } } }]) c.observeContextUsage(event);
  assert.equal(c.contextUsageForSessionSave().input_tokens, 32768);
  assert.equal(c.sessionContextAtSave({ context_at_save: c.contextUsageForSessionSave() }).label, 'CTX 50%');
});

test('reconnect clears save-time telemetry even with detailed diagnostics disabled', () => {
  const c = context();
  c.observeContextUsage(usage(32768));
  c.beginLlmOverview();
  assert.equal(c.contextUsageForSessionSave(), null);
  assert.equal(c.lastConversationInputTokens, null);
});

test('the measured connection window wins over a stale scan from the prior model', () => {
  const c = context();
  c.latestBrainStatus.context.context_window_tokens = 131072;
  c.connectionContextReceipt = { context_window_tokens: 65536, model: 'new-model' };
  c.observeContextUsage(usage(32768));
  const saved = c.contextUsageForSessionSave();
  assert.equal(saved.context_window_tokens, 65536);
  assert.equal(saved.model, 'new-model');
  assert.equal(c.sessionContextAtSave({ context_at_save: saved }).label, 'CTX 50%');
});

test('missing legacy usage or unknown window never becomes a fabricated percentage', () => {
  const c = context();
  for (const item of [{}, { context_at_save: null }, { context_at_save: { input_tokens: '48123' } }]) {
    assert.equal(c.sessionContextAtSave(item).label, 'CTX --');
  }
  c.latestBrainStatus.context.context_window_tokens = null;
  c.observeContextUsage(usage(32768));
  const formatted = c.sessionContextAtSave({ context_at_save: c.contextUsageForSessionSave() });
  assert.equal(formatted.label, 'CTX --');
  assert.match(formatted.detail, /32,768.*window not recorded/);
});

test('overflow observations are not clamped to 100 percent and detail carries measured provenance', () => {
  const c = context();
  const formatted = c.sessionContextAtSave({ context_at_save: {
    input_tokens: 70000, context_window_tokens: 65536, observed_at: '2026-09-20T12:00:00Z', model: 'qwen-test' } });
  assert.equal(formatted.label, 'CTX 107%');
  assert.match(formatted.detail, /70,000.*65,536/);
  assert.match(formatted.title, /Not peak usage or a resume estimate/);
  assert.match(formatted.title, /qwen-test/);
});

test('shared save request sends measured context, while map list, tree and details all display it', async () => {
  const c = context();
  c.observeContextUsage(usage(32768));
  const payloads = [];
  Object.assign(c, { URL, location: { href: 'http://127.0.0.1:8790' },
    fetch: async (_, options) => { payloads.push(JSON.parse(options.body)); return {
      ok: true, json: async () => ({ status: 'ok', save_request_id: 'fixture-save', session_filename: 'sessions/fixture.txt' }) }; } });
  vm.runInContext(source(page, 'saveContinuitySession'), c);
  await c.saveContinuitySession({ body: 'Conversation.', pinnedFilenames: [], requestId: 'fixture-save' });
  assert.equal(payloads[0].context_at_save.input_tokens, 32768);
  assert.equal(payloads[0].context_at_save.context_window_tokens, 65536);
  for (const name of ['renderList', 'renderNode', 'loadDetails']) {
    assert.match(source(map, name), /sessionContextAtSave\(item\)/);
  }
});

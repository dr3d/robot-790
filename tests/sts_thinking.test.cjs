const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const controls = require('../web/sts/thinking-controls.js');
const page = fs.readFileSync(require('node:path').join(__dirname, '../web/sts/index.html'), 'utf8').replace(/\r\n/g, '\n');
const profile = { status: 'verified', model: 'loaded-nvfp4', identity: 'binary', options: ['off', 'on'],
  can_on: true, can_off: true, manual: 'Off disables thinking. On enables thinking; this model has no depth levels.' };
function controller() {
  const saved = new Map([['robot790.customModelReasoning.v1', 'on']]), changes = [];
  const storage = { getItem: k => saved.get(k), setItem: (k, v) => saved.set(k, v) };
  const c = controls.create({ storage, changed: r => changes.push(r) });
  for (const brain of ['eric', 'brain2']) c.configure(brain, profile);
  return { c, changes, storage };
}
function ui() {
  const { c, changes } = controller();
  const sent = [], socket = { readyState: 1 };
  const g = { thinkingControls: c, thinkingWaiters: new Set(), liveThinkingSessions: new WeakMap(),
    realtimeConnection: { socket, generation: 1 }, WebSocket: { OPEN: 1 }, send: e => sent.push(e),
    setTimeout, clearTimeout, thinkingApiReady: true, latestBrain2ThinkingReceipt: null,
    renderThinkingControls() {}, updateSessionTools() {}, refreshThinkingProfiles() {}, events: {}, log() {}, logBrain2() {},
    userSpeechActive: false, activeRealtimeSession: s => s === socket, brain2EvidenceSnapshot: () => ({ user_key: 'u1' }) };
  const context = vm.createContext(g);
  for (const name of ['thinkingRuntimeConfig', 'updateSessionThinking', 'observeSessionThinking', 'thinkingReport', 'setThinking', 'applyBrain2Thinking', 'thinkingToolList']) {
    const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    const end = page.indexOf('\n    }\n', start);
    vm.runInContext(page.slice(start, end + 6), context);
  }
  context.observeSessionThinking({ type: 'session.created', robot790_live_thinking: true,
    robot790_thinking_profile: profile }, socket);
  const ack = event => context.observeSessionThinking({ type: 'session.updated', robot790_live_thinking: true,
    robot790_thinking_profile: profile, session: event.session }, socket);
  return { context, c, changes, sent, socket, ack };
}

test('both brains default Off, independently persist choices, and ignore the old B1 On setting', () => {
  const { c, storage, changes } = controller();
  assert.equal(c.snapshot('eric').mode, 'none');
  assert.equal(c.snapshot('brain2').mode, 'none');
  c.change('brain2', 'on', { source: 'operator' });
  assert.equal(c.snapshot('eric').mode, 'none');
  assert.equal(c.snapshot('brain2').mode, 'on');
  assert.equal(changes[0].source, 'operator');
  const resumed = controls.create({ storage });
  resumed.configure('brain2', profile);
  assert.equal(resumed.snapshot('brain2').mode, 'on');
});

test('new operator choices, even the same Off choice, invalidate older control snapshots per brain', () => {
  const { c } = controller();
  const observed = c.packet();
  c.change('eric', 'off', { source: 'operator' });
  assert.throws(() => c.change('eric', 'on', { source: 'operator', observed: observed.eric }), /newer choice/);
  c.change('brain2', 'on', { source: 'operator', observed: observed.brain2 });
  assert.equal(c.snapshot('brain2').mode, 'on');
});

test('controller rejects Eric, B2, and unspecified callers without changing settings or persistence', () => {
  const { c, storage, changes } = controller();
  c.change('eric', 'on', { source: 'operator' });
  c.change('brain2', 'on', { source: 'operator' });
  const before = c.packet();
  const saved = ['robot790.ericThinking.v2', 'robot790.brain2Thinking.v1'].map(key => storage.getItem(key));
  for (const brain of ['eric', 'brain2']) {
    for (const source of ['Eric', 'B2', undefined]) {
      assert.throws(() => c.change(brain, 'off', { source, observed: c.snapshot(brain) }), /operator/i);
    }
    assert.throws(() => c.change(brain, 'off'), /operator/i);
  }
  assert.deepEqual(c.packet(), before);
  assert.deepEqual(['robot790.ericThinking.v2', 'robot790.brain2Thinking.v1'].map(key => storage.getItem(key)), saved);
  assert.equal(changes.length, 2);
});

test('switching loaded models resets Off and rejects controls unsupported by the new model', () => {
  const { c } = controller();
  c.change('eric', 'on', { source: 'operator' });
  const observed = c.snapshot('eric');
  c.configure('eric', { ...profile, identity: 'other', model: 'other', can_on: false, manual: 'No Thinking switch.' });
  assert.equal(c.snapshot('eric').mode, 'none');
  assert.throws(() => c.change('eric', 'on', { source: 'operator', observed }), /loaded model/);
  assert.throws(() => c.change('eric', 'on', { source: 'operator' }), /No Thinking switch/);
  assert.throws(() => c.change('brain2', 'high', { source: 'operator' }), /not supported/);
});

test('operator changes to Eric wait for matching acknowledgment before claiming success', async () => {
  const { context, sent, ack, changes } = ui();
  let finished = false;
  const pending = context.setThinking({ brain: 'eric', mode: 'on', reason: 'Compare the possibilities' }, { source: 'operator' }).then(r => { finished = true; return r; });
  await Promise.resolve();
  assert.equal(finished, false);
  assert.equal(sent[0].session.robot790_thinking_model, profile.model);
  assert.equal(sent[0].session.robot790_reasoning_effort, 'on');
  ack({ session: { ...sent[0].session, robot790_thinking_revision: sent[0].session.robot790_thinking_revision - 1 } });
  await Promise.resolve();
  assert.equal(finished, false);
  ack(sent[0]);
  assert.equal((await pending).status, 'ok');
  assert.equal(changes[0].source, 'operator');
});

test('operator can change B2 without changing Eric or launching a request', async () => {
  const { context, c, sent } = ui();
  const result = await context.setThinking({ brain: 'brain2', mode: 'on' }, { source: 'operator' });
  assert.equal(result.applies, 'next scheduled mull');
  assert.equal(c.snapshot('eric').mode, 'none');
  assert.equal(sent.length, 0);
});

test('stale tool setters reject both brains and preserve manual On, even with current snapshots', async () => {
  const { context, c, sent, changes } = ui();
  const stale = c.packet();
  c.change('eric', 'on', { source: 'operator' });
  c.change('brain2', 'on', { source: 'operator' });
  const before = c.packet();
  for (const brain of ['eric', 'brain2']) {
    await assert.rejects(context.setThinking({ brain, mode: 'off' }), /operator/i);
    for (const source of ['Eric', 'B2']) {
      for (const observed of [stale[brain], c.snapshot(brain)]) {
        await assert.rejects(context.setThinking({ brain, mode: 'off' }, { source, observed }), /operator/i);
      }
    }
  }
  assert.deepEqual(c.packet(), before);
  assert.equal(changes.length, 2);
  assert.equal(sent.length, 0);
  assert.equal(context.thinkingWaiters.size, 0);
});

test('legacy B2 intents never mutate either brain, including fresh results, but retain request receipts', async () => {
  const { context, c, socket, sent, changes } = ui();
  for (const mode of ['on', 'off']) {
    for (const brain of ['eric', 'brain2']) c.change(brain, mode, { source: 'operator' });
    const before = c.packet(), count = changes.length;
    const receipt = { mode, model: profile.model, reasoning_effort: mode };
    const result = { thinking: receipt, thinking_changes: { eric: mode === 'on' ? 'off' : 'on', brain2: mode === 'on' ? 'off' : 'on' },
      observed_thinking: before, observed_session: { socket, generation: 1 }, observed_evidence: { user_key: 'u1' } };
    await context.applyBrain2Thinking(result);
    assert.deepEqual(c.packet(), before);
    assert.equal(changes.length, count);
    assert.equal(context.latestBrain2ThinkingReceipt, receipt);
    assert.equal(context.thinkingReport().brain2_last_request, receipt);
  }
  assert.equal(sent.length, 0);
});

test('an old backend echo cannot pass for support or apply an operator change', async () => {
  const { context, c, socket } = ui();
  context.observeSessionThinking({ type: 'session.updated', robot790_live_thinking: true,
    session: { robot790_reasoning_effort: 'on' } }, socket);
  await assert.rejects(context.setThinking({ brain: 'eric', mode: 'on' }, { source: 'operator' }), /Restart realtime once/);
  assert.equal(c.snapshot('eric').mode, 'none');
});

test('only read-only Thinking is advertised, with operator-only instructions and the actual model manuals', () => {
  const { context, c } = ui();
  const tools = context.thinkingToolList();
  assert.deepEqual(Array.from(tools, t => t.name), ['get_thinking']);
  const description = tools[0].description;
  assert.match(description, /operator/i);
  assert.doesNotMatch(description, /own initiative|Return to Off/);
  assert.match(description, /loaded-nvfp4.*no depth levels/);
  c.configure('brain2', { ...profile, identity: 'graded', model: 'graded', manual: 'On uses medium reasoning.' });
  assert.match(context.thinkingToolList()[0].description, /brain2: graded. On uses medium reasoning/);
  const report = context.thinkingReport();
  assert.equal(report.tool, 'get_thinking');
  assert.equal(report.eric.model, profile.model);
  assert.equal(report.brain2.model, 'graded');
});

function capabilityUi() {
  const { context, c, socket } = ui();
  const select = () => ({ options: [], replaceChildren(...children) { this.options = children; } });
  Object.assign(context, {
    customModelReasoning: select(), brain2Thinking: select(), modelThinkingHelp: {}, brain2ThinkingHelp: {},
    thinkingProfileRequest: 0, location: { href: 'http://127.0.0.1:8790/' }, URL, AbortSignal,
    Option: function(text, value) { this.textContent = text; this.value = value; }
  });
  context.liveThinkingSessions.delete(socket);
  for (const name of ['renderThinkingControls', 'refreshThinkingProfiles']) {
    const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    const end = page.indexOf('\n    }\n', start);
    vm.runInContext(page.slice(start, end + 6), context);
  }
  return { context, c, socket };
}

test('missing capability endpoint remains explained after a render and recovers on retry', async () => {
  const { context, c } = capabilityUi();
  context.fetch = async () => ({ ok: false, status: 404 });
  await context.refreshThinkingProfiles();
  context.renderThinkingControls();
  for (const [select, help] of [[context.customModelReasoning, context.modelThinkingHelp], [context.brain2Thinking, context.brain2ThinkingHelp]]) {
    assert.equal(select.disabled, true);
    assert.match(help.textContent, /page server needs an update/);
    assert.doesNotMatch(help.textContent, /Checking/);
  }
  context.fetch = async () => ({ ok: true, json: async () => ({ eric: profile, brain2: profile }) });
  await context.refreshThinkingProfiles();
  assert.equal(context.thinkingApiReady, true);
  assert.equal(context.customModelReasoning.disabled, false);
  assert.equal(context.brain2Thinking.disabled, false);
  assert.equal(c.snapshot('eric').mode, 'none');
  assert.equal(c.snapshot('brain2').mode, 'none');
});

test('page capability failure preserves Eric support confirmed by the live backend', async () => {
  const { context, c, socket } = capabilityUi();
  context.liveThinkingSessions.set(socket, { supported: true });
  context.fetch = async () => { const error = new Error('timeout'); error.name = 'TimeoutError'; throw error; };
  await context.refreshThinkingProfiles();
  assert.equal(c.snapshot('eric').profile.status, 'verified');
  assert.equal(context.customModelReasoning.disabled, false);
  assert.equal(context.brain2Thinking.disabled, true);
  assert.match(context.brain2ThinkingHelp.textContent, /timed out.*reopen Connection Settings/);
});

const graded = { ...profile, model: 'qwen/qwen3.8-27b', identity: 'graded',
  options: ['off', 'low', 'medium', 'xhigh', 'on'], on_option: 'xhigh',
  manual: 'Choose off, low, medium, xhigh, or on. On uses xhigh.' };

test('graded model exposes actual levels while the other brain retains binary controls', () => {
  const { context, c } = capabilityUi();
  c.configure('eric', graded);
  context.renderThinkingControls();
  assert.deepEqual(context.customModelReasoning.options.filter(o => o.value).map(o => o.value), ['none', 'low', 'medium', 'xhigh', 'on']);
  assert.deepEqual(context.brain2Thinking.options.filter(o => o.value).map(o => o.value), ['none', 'on']);
  assert.equal(context.customModelReasoning.options.at(-1).textContent, 'On (Extra high default)');
  assert.match(context.modelThinkingHelp.textContent, /Running: qwen\/qwen3.8-27b/);
  assert.deepEqual(Array.from(context.thinkingToolList(), t => t.name), ['get_thinking']);
  assert.match(context.thinkingToolList()[0].description, /Choose off, low, medium, xhigh, or on/);
});

test('explicit graded choices persist independently and reach the next-session configuration unchanged', () => {
  const { c, storage } = controller();
  c.configure('eric', graded);
  c.change('eric', 'medium', { source: 'operator' });
  const resumed = controls.create({ storage });
  resumed.configure('eric', graded);
  resumed.configure('brain2', profile);
  assert.equal(resumed.snapshot('eric').mode, 'medium');
  assert.equal(resumed.snapshot('brain2').mode, 'none');
  assert.throws(() => resumed.change('brain2', 'xhigh', { source: 'operator' }), /not supported/);
  assert.throws(() => resumed.change('eric', 'high', { source: 'operator' }), /not supported/);
  const { context } = ui();
  context.thinkingControls = resumed;
  assert.equal(context.thinkingRuntimeConfig().robot790_reasoning_effort, 'medium');
});

test('operator can select explicit levels independently with live acknowledgment and next-mull behavior', async () => {
  const { context, c, sent, socket } = ui();
  c.configure('eric', graded);
  const pending = context.setThinking({ brain: 'eric', mode: 'xhigh' }, { source: 'operator' });
  assert.equal(sent[0].session.robot790_reasoning_effort, 'xhigh');
  context.observeSessionThinking({ type: 'session.updated', robot790_live_thinking: true,
    robot790_thinking_profile: graded, session: sent[0].session }, socket);
  assert.equal((await pending).mode, 'xhigh');
  c.configure('brain2', graded);
  const result = await context.setThinking({ brain: 'brain2', mode: 'low' }, { source: 'operator' });
  assert.equal(result.applies, 'next scheduled mull');
  assert.equal(c.snapshot('brain2').mode, 'low');
  assert.equal(c.snapshot('eric').mode, 'xhigh');
  assert.equal(sent.length, 1);
});

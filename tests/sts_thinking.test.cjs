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
  for (const name of ['thinkingRuntimeConfig', 'updateSessionThinking', 'observeSessionThinking', 'setThinking', 'applyBrain2Thinking', 'thinkingToolList']) {
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
  c.change('brain2', 'on', { source: 'B2' });
  assert.equal(c.snapshot('eric').mode, 'none');
  assert.equal(c.snapshot('brain2').mode, 'on');
  assert.equal(changes[0].source, 'B2');
  const resumed = controls.create({ storage });
  resumed.configure('brain2', profile);
  assert.equal(resumed.snapshot('brain2').mode, 'on');
});

test('new operator choices, even the same Off choice, invalidate old B2 decisions per brain', () => {
  const { c } = controller();
  const observed = c.packet();
  c.change('eric', 'off', { source: 'operator' });
  assert.throws(() => c.change('eric', 'on', { source: 'B2', observed: observed.eric }), /newer choice/);
  c.change('brain2', 'on', { source: 'B2', observed: observed.brain2 });
  assert.equal(c.snapshot('brain2').mode, 'on');
});

test('switching loaded models resets Off and rejects controls unsupported by the new model', () => {
  const { c } = controller();
  c.change('eric', 'on', { source: 'Eric' });
  const observed = c.snapshot('eric');
  c.configure('eric', { ...profile, identity: 'other', model: 'other', can_on: false, manual: 'No Thinking switch.' });
  assert.equal(c.snapshot('eric').mode, 'none');
  assert.throws(() => c.change('eric', 'on', { observed }), /loaded model/);
  assert.throws(() => c.change('eric', 'on'), /No Thinking switch/);
  assert.throws(() => c.change('brain2', 'high'), /not supported/);
});

test('Eric tool waits for matching acknowledgment before claiming success', async () => {
  const { context, sent, ack, changes } = ui();
  let finished = false;
  const pending = context.setThinking({ brain: 'eric', mode: 'on', reason: 'Compare the possibilities' }).then(r => { finished = true; return r; });
  await Promise.resolve();
  assert.equal(finished, false);
  assert.equal(sent[0].session.robot790_thinking_model, profile.model);
  assert.equal(sent[0].session.robot790_reasoning_effort, 'on');
  ack(sent[0]);
  assert.equal((await pending).status, 'ok');
  assert.equal(changes[0].source, 'Eric');
});

test('B2 or operator can change B2 without changing Eric or launching a request', async () => {
  const { context, c, sent } = ui();
  const result = await context.setThinking({ brain: 'brain2', mode: 'on' }, { source: 'operator' });
  assert.equal(result.applies, 'next scheduled mull');
  assert.equal(c.snapshot('eric').mode, 'none');
  assert.equal(sent.length, 0);
});

test('B2 autonomous changes require current context and cannot overwrite a newer setting', async () => {
  const { context, c, socket } = ui();
  const result = { thinking_changes: { brain2: 'on' }, observed_thinking: c.packet(),
    observed_session: { socket, generation: 1 }, observed_evidence: { user_key: 'u1' } };
  c.change('brain2', 'off', { source: 'operator' });
  await context.applyBrain2Thinking(result);
  assert.equal(c.snapshot('brain2').mode, 'none');
  result.observed_thinking = c.packet();
  context.userSpeechActive = true;
  await context.applyBrain2Thinking(result);
  assert.equal(c.snapshot('brain2').mode, 'none');
  context.userSpeechActive = false;
  await context.applyBrain2Thinking(result);
  assert.equal(c.snapshot('brain2').mode, 'on');
});

test('an old backend echo cannot pass for support or change Eric via tools', async () => {
  const { context, c, socket } = ui();
  context.observeSessionThinking({ type: 'session.updated', robot790_live_thinking: true,
    session: { robot790_reasoning_effort: 'on' } }, socket);
  await assert.rejects(context.setThinking({ brain: 'eric', mode: 'on' }), /Restart realtime once/);
  assert.equal(c.snapshot('eric').mode, 'none');
});

test('tool instructions use the actual model manual and allow independent self-directed choices', () => {
  const { context, c } = ui();
  const description = context.thinkingToolList().find(t => t.name === 'set_thinking').description;
  assert.match(description, /own initiative/);
  assert.match(description, /loaded-nvfp4.*no depth levels/);
  c.configure('brain2', { ...profile, identity: 'graded', model: 'graded', manual: 'On uses medium reasoning.' });
  assert.match(context.thinkingToolList()[1].description, /brain2: graded. On uses medium reasoning/);
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
  const modes = context.thinkingToolList()[1].parameters.properties.mode.enum;
  assert.deepEqual(Array.from(modes), ['off', 'low', 'medium', 'xhigh', 'on']);
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
  assert.throws(() => resumed.change('brain2', 'xhigh'), /not supported/);
  assert.throws(() => resumed.change('eric', 'high'), /not supported/);
  const { context } = ui();
  context.thinkingControls = resumed;
  assert.equal(context.thinkingRuntimeConfig().robot790_reasoning_effort, 'medium');
});

test('Eric tools and B2 intents can select explicit levels with the same acknowledgment and freshness checks', async () => {
  const { context, c, sent, socket } = ui();
  c.configure('eric', graded);
  const pending = context.setThinking({ brain: 'eric', mode: 'xhigh' });
  assert.equal(sent[0].session.robot790_reasoning_effort, 'xhigh');
  context.observeSessionThinking({ type: 'session.updated', robot790_live_thinking: true,
    robot790_thinking_profile: graded, session: sent[0].session }, socket);
  assert.equal((await pending).mode, 'xhigh');
  c.configure('brain2', graded);
  await context.applyBrain2Thinking({ thinking_changes: { brain2: 'low' }, observed_thinking: c.packet(),
    observed_session: { socket, generation: 1 }, observed_evidence: { user_key: 'u1' } });
  assert.equal(c.snapshot('brain2').mode, 'low');
  assert.equal(c.snapshot('eric').mode, 'xhigh');
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

function fixture() {
  const sent = [], ledger = [], logs = [];
  let now = 1000;
  class Clock extends Date { static now() { return now; } }
  const c = vm.createContext({
    URLSearchParams, location: { search: '' },
    Date: Clock, ws: { readyState: 1 }, WebSocket: { OPEN: 1 }, realtimeStopRequested: false,
    responseActive: false, toolFollowupNeeded: false, pendingToolCalls: 0,
    lastRuntimeContextSocket: null, lastRuntimeContextSections: {},
    lastSessionUpdateSocket: null, lastSessionUpdateFingerprint: '',
    realtimeConnected: () => true, firstContactModeEnabled: () => false, performanceModeEnabled: () => false,
    baseSessionInstructionSections: () => ({ identity: 'ERIC', operating: 'OPERATING RULES' }),
    formatCreatureForInstructions: () => 'CREATURE', formatRuntimeBehaviorRulesForInstructions: () => 'BEHAVIOR',
    wonderSearchPolicyText: () => 'SEARCH POLICY', brain2AdvisoryProtocolInstructions: () => 'B2 PROTOCOL',
    formatMemoryForInstructions: () => 'PINNED FACTS', formatLoadedNotesForInstructions: () => 'PAST SESSION A\nPAST SESSION B',
    formatEmbodimentForInstructions: () => 'BROWSER FACE MANUAL',
    formatRuntimeStateForInstructions: () => 'Microphone on. Eye empty.', formatSensingTextForInstructions: () => '',
    lastAcceptedUserTranscriptAt: 500, lastUserTurnActivityAt: 500,
    aloneActivitiesSinceLastUser: () => [], activeIdleSelfTasks: () => [], currentLabGoal: () => '',
    formatCompletedAloneInterval: () => '', shortDuration: ms => `${Math.round(ms/1000)}s`,
    searchContextReceipts: [], maxSearchContextReceipts: 4, maxSearchContextResults: 3,
    send: e => sent.push(e), rememberPromptLedger: e => ledger.push(e),
    saveToolPrefs() {}, contextPanel: { open: false }, enabledToolList: () => [],
    ttsRuntimeConfig: () => ({}), imageToolProtectionEnabled: false,
    currentInterruptSensitivity: () => 6,
    events: {}, log: (_target, text) => logs.push(text), rememberSessionPromptSnapshot() {},
  });
  for (const name of ['runtimeContextProtocolInstructions', 'buildSessionInstructions', 'buildRuntimeContextSections',
    'formatAloneStateForInstructions', 'formatRecentSearchContextForInstructions', 'appendRuntimeContextToConversation',
    'realtimeInterruptEnabled', 'sessionUpdateFingerprint', 'contextDiagnosticsEnabled', 'sessionPromptChange', 'updateSessionTools']) {
    const start = page.search(new RegExp(`^    function ${name}\\(`, 'm'));
    const end = page.indexOf('\n    }\n', start);
    assert.ok(start >= 0 && end > start, name);
    vm.runInContext(page.slice(start,end+6),c);
  }
  return { c, sent, ledger, logs, clock: value => { now = value; } };
}

test('prompt comparison diagnostics are off unless explicitly requested', () => {
  const { c, logs } = fixture();
  c.updateSessionTools();
  assert.ok(!logs.some(text => text.includes('B1 session prompt change')));
  c.location.search = '?contextDiagnostics=1';
  c.formatEmbodimentForInstructions = () => 'REACHY MANUAL';
  c.updateSessionTools();
  assert.equal(logs.filter(text => text.includes('B1 session prompt change')).length, 1);
});

test('ordinary turns keep stable instructions and emit no ticking runtime snapshots', () => {
  const { c, sent, clock } = fixture();
  assert.equal(c.updateSessionTools(), true);
  assert.equal(sent[0].type, 'session.update');
  assert.equal(sent[1].type, 'conversation.item.create');
  const instructions = sent[0].session.instructions;
  assert.ok(instructions.indexOf('OPERATING RULES') < instructions.indexOf('PAST SESSION A'));
  assert.ok(instructions.indexOf('PAST SESSION B') < instructions.indexOf('BROWSER FACE MANUAL'));
  assert.ok(instructions.endsWith('BROWSER FACE MANUAL'));
  assert.doesNotMatch(instructions, /Microphone on|Last operator turn activity|Eye empty/);
  assert.doesNotMatch(sent[1].item.content[0].text, /Last operator turn activity/);
  clock(2000);
  c.lastUserTurnActivityAt = 2000;
  assert.equal(c.updateSessionTools(), false);
  assert.equal(sent.length, 2);
  clock(180000);
  assert.equal(c.updateSessionTools(), false);
  assert.equal(sent.length, 2);
  assert.match(c.formatAloneStateForInstructions(), /Last operator turn activity: 178s ago/);
});

test('runtime changes append section deltas without rewriting or deleting earlier history', () => {
  const { c, sent, ledger } = fixture();
  c.updateSessionTools();
  const first = JSON.stringify(sent[1]);
  sent.push({ type: 'test dialogue', text: 'human and Eric spoke' });
  c.formatSensingTextForInstructions = () => 'Dropped text: an interesting fact';
  c.updateSessionTools();
  const update = sent.at(-1);
  assert.equal(update.type, 'conversation.item.create');
  assert.equal(update.item.role, 'assistant');
  assert.match(update.item.content[0].text, /\[STS runtime\]/);
  assert.match(update.item.content[0].text, /sensing_text:\nDropped text/);
  assert.doesNotMatch(update.item.content[0].text, /alone_ledger:|runtime:\n/);
  assert.equal(JSON.stringify(sent[1]), first);
  assert.equal(sent.filter(e=>e.type==='session.update').length, 1);
  assert.equal(ledger.at(-1).source, 'STS runtime update');
  c.formatSensingTextForInstructions = () => '';
  c.updateSessionTools();
  assert.match(sent.at(-1).item.content[0].text, /Current sensing-eye text: absent/);
});

test('body changes replace only the manual suffix; old manuals never append to history', () => {
  const { c, sent } = fixture();
  c.updateSessionTools();
  const before = sent[0].session.instructions;
  c.formatEmbodimentForInstructions = () => 'REACHY MANUAL';
  c.updateSessionTools();
  const after = sent.at(-1).session.instructions;
  assert.equal(after, before.replace('BROWSER FACE MANUAL','REACHY MANUAL'));
  assert.doesNotMatch(after, /BROWSER FACE MANUAL/);
  assert.equal(sent.filter(e=>e.type==='conversation.item.create').length, 1);
});

test('runtime updates defer during generation and tools, then flush at a completed tool boundary', () => {
  const { c, sent } = fixture();
  c.responseActive = true;
  c.updateSessionTools();
  assert.equal(sent.length, 1);
  c.responseActive = false;
  c.pendingToolCalls = 1;
  assert.equal(c.appendRuntimeContextToConversation(), false);
  c.pendingToolCalls = 0;
  c.toolFollowupNeeded = true;
  assert.equal(c.appendRuntimeContextToConversation(), false);
  c.toolFollowupNeeded = false;
  assert.equal(c.appendRuntimeContextToConversation({toolBoundary:true}), true);
  assert.equal(sent.length, 2);
});

test('reconnect sends a fresh snapshot; disconnect and first-contact cannot append one', () => {
  const { c, sent } = fixture();
  c.updateSessionTools();
  c.ws = { readyState: 1 };
  c.updateSessionTools();
  assert.equal(sent.filter(e=>e.type==='conversation.item.create').length, 2);
  c.realtimeStopRequested = true;
  c.formatRuntimeStateForInstructions = () => 'Changed';
  assert.equal(c.appendRuntimeContextToConversation(), false);
  c.realtimeStopRequested = false;
  c.firstContactModeEnabled = () => true;
  assert.equal(c.appendRuntimeContextToConversation(), false);
});

test('search receipts use fixed timestamps in live history; relative ages remain available for idle', () => {
  const { c, clock } = fixture();
  c.searchContextReceipts = [{at:1000,source:'idle',query:'News',results:[]}];
  const initial = c.buildRuntimeContextSections().search_receipts;
  assert.match(initial, /1970-01-01T00:00:01.000Z/);
  clock(120000);
  assert.equal(c.buildRuntimeContextSections().search_receipts, initial);
  assert.match(c.formatRecentSearchContextForInstructions(), /2m ago/);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

function fixture() {
  const sent = [], calls = [], timers = [];
  const names = ['search_web', 'generate_image', 'move_generated_image_to_sensing_eye',
    'list_sensing_eye_notes', 'recall_sensing_eye_note', 'list_sensing_eye_images', 'select_sensing_eye_image',
    'read_text_file', 'list_session_map', 'enter_session', 'capture_sensing_eye', 'clear_sensing_eye'];
  const c = vm.createContext({
    toolScopeDenials: new Map(), toolFollowupTerminal: false,
    clearTimeout() {},
    imageToolProtectionEnabled: false, armAssistantUtteranceFinished() {},
    runtimeConfig: { tool_continuation: { max_rounds: 8 } },
    ws: {}, realtimeSessionGeneration: 1, activeRealtimeSession: () => true,
    suppressedResponseIds: new Set(), handledFunctionCallIds: new Set(),
    eventResponseId: e => e.response_id, lastUserTurnActivityAt: 100,
    pendingToolCalls: 0, toolFollowupNeeded: false, responseDoneAfterTool: false,
    toolFollowupUserActivityAt: 0, toolFollowupDrainTimer: null, toolFollowupPromptSources: [],
    toolContinuationRounds: 0, toolContinuationOrigin: 'conversation',
    toolGenerationUncertain: false,
    pendingSessionMapMove: null, imageTaskReceipt: null, loadedNoteContextDirty: false,
    idleInFlight: false, responseActive: false,
    enabledToolList: () => names.map(name => ({ type: 'function', name })),
    idleEnabledToolList: () => [{ name: 'search_web' }, { name: 'read_text_file' }],
    parseToolArguments: JSON.parse, outputAudioActive: () => false,
    setTimeout: callback => { timers.push(callback); return timers.length; },
    executeTool: async (name, args) => { calls.push({ name, args }); return { status: 'ok', filename: 'existing.png' }; },
    send: e => sent.push(e), events: {}, log() {}, beginToolActivity() {}, endToolActivity() {}, toolDetailFromArgs: () => '',
    updateSessionTools() {}, rememberToolFollowupPrompt() {}, rememberPromptLedger() {},
    appendRuntimeContextToConversation() {}, ttsRuntimeConfig: () => ({}),
  });
  for (const name of ['handleFunctionCall', 'maybeCreateToolFollowup']) {
    const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    const end = page.indexOf('\n    }\n', start);
    assert.ok(start >= 0 && end > start, name);
    vm.runInContext(page.slice(start, end + 6), c);
  }
  let id = 0;
  const tool = (name, args = {}, callId = `call-${++id}`) => c.handleFunctionCall({
    name, arguments: JSON.stringify(args), call_id: callId, response_id: 'response',
  });
  const done = () => { c.responseDoneAfterTool = true; c.maybeCreateToolFollowup(); };
  const responses = () => sent.filter(e => e.type === 'response.create').map(e => e.response);
  return { c, sent, calls, timers, tool, done, responses };
}

function useIdlePolicy(f) {
  f.c.firstContactModeEnabled = () => false;
  f.c.performanceModeEnabled = () => false;
  f.c.idleArt = { grant: null, authorized: () => false };
  const policy = page.match(/const idleToolAllowedNames = new Set\(\[[\s\S]*?\]\);/);
  assert.ok(policy);
  vm.runInContext(policy[0], f.c);
  const start = page.indexOf('    function idleEnabledToolList(');
  vm.runInContext(page.slice(start, page.indexOf('\n    }\n', start) + 6), f.c);
  f.c.toolContinuationOrigin = 'idle';
}

test('idle can list and recall existing eye notes with paid art off, preserving the full catalogue', async () => {
  const f = fixture();
  useIdlePolicy(f);
  const names = ['list_sensing_eye_notes', 'recall_sensing_eye_note', 'list_sensing_eye_images', 'select_sensing_eye_image'];
  for (const name of names) {
    await f.tool(name, { note_id: 'file:existing.png', image_id: 'file:existing.png' }); f.done();
    assert.equal(f.calls.at(-1)?.name, name);
    assert.equal(f.c.toolFollowupTerminal, false);
    assert.deepEqual(f.responses().at(-1).tools, f.c.enabledToolList());
    assert.match(f.responses().at(-1).robot790_tool_followup, /Execution scope remains idle/);
  }
  const allowed = Array.from(f.c.idleEnabledToolList(), tool => tool.name);
  for (const name of ['generate_image', 'move_generated_image_to_sensing_eye', 'capture_sensing_eye', 'clear_sensing_eye', 'enter_session']) {
    assert.ok(!allowed.includes(name), name);
  }
  const tools = f.c.enabledToolList();
  f.c.enabledToolList = () => tools.filter(tool => tool.name !== 'recall_sensing_eye_note');
  assert.ok(!f.c.idleEnabledToolList().some(tool => tool.name === 'recall_sensing_eye_note'));
  assert.equal(f.c.idleEnabledToolList({ firstContactActive: true }).length, 0);
  assert.equal(f.c.idleEnabledToolList({ performanceActive: true }).length, 0);
});

for (const name of ['recall_sensing_eye_note', 'select_sensing_eye_image']) {
  test(`${name} freshness is session-bound, not tied to the paid-art grant`, async () => {
    const f = fixture();
    useIdlePolicy(f);
    f.c.idleArt = { grant: {}, authorized: () => true };
    await f.tool(name);
    const current = f.calls[0].args._isCurrent;
    assert.equal(typeof current, 'function');
    assert.equal(current(), true);
    assert.equal(f.calls[0].args._idleArt, undefined);
    f.c.idleArt.grant = null;
    f.c.idleArt.authorized = () => false;
    assert.equal(current(), true);
    f.c.lastUserTurnActivityAt++;
    assert.equal(current(), false);
    f.c.lastUserTurnActivityAt--;
    f.c.suppressedResponseIds.add('response');
    assert.equal(current(), false);
    f.c.suppressedResponseIds.clear();
    f.c.activeRealtimeSession = () => false;
    assert.equal(current(), false);
  });
}

test('search, note consultation, generation and staging use one conversation and stable tools', async () => {
  const f = fixture();
  for (const name of ['search_web', 'read_text_file', 'generate_image', 'move_generated_image_to_sensing_eye']) {
    await f.tool(name);
    assert.equal(f.responses().length, f.calls.length - 1);
    f.done();
    const r = f.responses().at(-1);
    assert.equal(r.tool_choice, 'auto');
    assert.deepEqual(Array.from(r.modalities), ['audio', 'text']);
    assert.equal(r.tools.length, f.c.enabledToolList().length);
    assert.doesNotMatch(r.robot790_tool_followup, /Say exactly|One compact|exactly one|only.*recall/i);
  }
  assert.equal(f.calls.length, 4);
  assert.equal(f.c.imageTaskReceipt.receipts.length, 3);
  assert.equal(f.c.imageTaskReceipt.artifact, 'existing.png');
  assert.equal(f.c.imageTaskReceipt.receipts[1].status, 'ok');
  assert.equal(f.c.imageTaskReceipt.receipts[1].staged, false);
});

test('a catalogue never automatically navigates or loads an image', async () => {
  const f = fixture();
  await f.tool('list_sensing_eye_notes'); f.done();
  assert.deepEqual(f.calls.map(c => c.name), ['list_sensing_eye_notes']);
  await f.tool('read_text_file', { filename: 'clue.txt' }); f.done();
  await f.tool('recall_sensing_eye_note', { note_id: 'file:existing.png' }); f.done();
  assert.equal(f.calls.length, 3);
});

test('an old response.done cannot complete the next tool response early', async () => {
  const f = fixture(); f.c.responseDoneAfterTool = true;
  await f.tool('search_web');
  assert.equal(f.responses().length, 0);
  f.done(); assert.equal(f.responses().length, 1);
});

test('failure is a receipt; recovery stays available without forced speech', async () => {
  const f = fixture();
  f.c.executeTool = async () => { throw new Error('file not found'); };
  await f.tool('recall_sensing_eye_note'); f.done();
  assert.match(f.sent[0].item.output, /file not found/);
  assert.equal(f.responses()[0].tool_choice, 'auto');
  assert.doesNotMatch(f.responses()[0].robot790_tool_followup, /I could not/);
});

test('disabled capabilities and duplicate call IDs cannot execute', async () => {
  const f = fixture();
  await f.tool('disabled_tool');
  assert.equal(f.calls.length, 0);
  assert.match(f.sent[0].item.output, /not enabled/);
  await f.tool('search_web', {}, 'same-id'); await f.tool('search_web', {}, 'same-id');
  assert.equal(f.calls.length, 1);
});

test('scope denial is terminal and structured, including repeated response.done and timer polls', async () => {
  const f = fixture(); f.c.toolContinuationOrigin = 'idle';
  const finished = [];
  f.c.armAssistantUtteranceFinished = value => finished.push(value);
  await f.tool('stop_standing_routine');
  const receipt = JSON.parse(f.sent[0].item.output);
  assert.equal(receipt.code, 'scope_denied');
  assert.equal(receipt.retryable, false);
  assert.equal(receipt.scope, 'idle');
  assert.ok(receipt.allowed_tools.includes('search_web'));
  for (let i = 0; i < 100; i++) f.done();
  assert.equal(f.responses().length, 0);
  assert.equal(f.c.toolFollowupNeeded, false);
  assert.equal(f.calls.length, 0);
  assert.equal(f.c.toolScopeDenials.size, 1);
  assert.equal(finished.length, 1);
  assert.equal(finished[0].wasIdle, true);
});

test('scope denial still delivers successful sibling receipts but cannot restart the denied batch', async () => {
  const f = fixture();
  let complete;
  f.c.executeTool = () => new Promise(resolve => { complete = resolve; });
  const pending = f.tool('search_web');
  await f.tool('disabled_tool'); f.done();
  complete({ status: 'ok', results: ['useful evidence'] }); await pending;
  assert.equal(f.sent.filter(e => e.item?.type === 'function_call_output').length, 2);
  assert.match(f.sent.at(-1).item.output, /useful evidence/);
  assert.equal(f.responses().length, 0);
});

test('retired silent-wait calls are denied without restarting a follow-up loop', async () => {
  const f = fixture();
  await f.tool('wait_silently'); f.done();
  assert.equal(JSON.parse(f.sent[0].item.output).code, 'scope_denied');
  assert.equal(f.responses().length, 0);
});

test('permitted recovery carries execution scope on every turn without changing catalogue', async () => {
  const f = fixture(); f.c.toolContinuationOrigin = 'idle';
  for (const name of ['search_web', 'read_text_file']) {
    await f.tool(name); f.done();
    const response = f.responses().at(-1);
    assert.match(response.robot790_tool_followup, /Execution scope remains idle/);
    assert.match(response.robot790_tool_followup, /allowed tools: search_web, read_text_file/);
    assert.deepEqual(response.tools, f.c.enabledToolList());
  }
});

test('unknown paid-generation outcome cannot trigger an automatic paid retry', async () => {
  const f = fixture(); let attempts = 0;
  f.c.executeTool = async () => { attempts++; throw new Error('connection lost after submission'); };
  await f.tool('generate_image'); f.done();
  await f.tool('generate_image');
  assert.equal(attempts, 1);
  assert.match(f.sent.filter(e => e.item).at(-1).item.output, /outcome is unknown/);
});

test('idle allows model-selected research but not ungranted effects', async () => {
  const f = fixture(); f.c.toolContinuationOrigin = 'idle';
  await f.tool('generate_image'); assert.equal(f.calls.length, 0);
  await f.tool('search_web', { query: 'model chosen question' }); assert.equal(f.calls.length, 1);
});

test('local image rejection before submission does not invent an unknown paid outcome', async () => {
  const f = fixture();
  f.c.executeTool = async () => { throw Object.assign(new Error('busy'), { generationSubmitted: false }); };
  await f.tool('generate_image');
  assert.equal(f.c.toolGenerationUncertain, false);
  assert.equal(f.c.imageTaskReceipt.receipts.at(-1).status, 'error');
});

test('granted B1 idle art routes through permission and retains grant freshness while staging', async () => {
  const f = fixture();
  f.c.idleToolAllowedNames = new Set(['search_web']);
  f.c.firstContactModeEnabled = () => false;
  f.c.performanceModeEnabled = () => false;
  f.c.idleArt = { grant: {}, authorized: () => true, history: [] };
  const start = page.indexOf('    function idleEnabledToolList(');
  vm.runInContext(page.slice(start, page.indexOf('\n    }\n', start) + 6), f.c);
  f.c.toolContinuationOrigin = 'idle';
  await f.tool('generate_image'); f.done();
  assert.equal(f.calls[0].args._idleArt, true);
  assert.equal(f.calls[0].args._isCurrent(), true);
  await f.tool('move_generated_image_to_sensing_eye');
  assert.equal(f.calls.length, 2);
  const current = f.calls[1].args._isCurrent;
  f.c.idleArt.grant = null;
  f.c.idleArt.authorized = () => false;
  assert.equal(current(), false);
  await f.tool('generate_image');
  assert.equal(f.calls.length, 2);
  assert.equal(f.c.idleEnabledToolList().length, 1);
});

test('playback beyond 30 seconds cannot drop work or double dispatch', async () => {
  const f = fixture(); await f.tool('generate_image');
  f.c.outputAudioActive = () => true;
  f.c.toolFollowupDrainStartedAt = Date.now() - 120000;
  f.done(); f.done();
  assert.equal(f.responses().length, 0); assert.equal(f.timers.length, 1);
  assert.equal(f.c.toolFollowupNeeded, true);
  f.c.outputAudioActive = () => false;
  f.timers[0](); f.done(); assert.equal(f.responses().length, 1);
});

test('a new utterance retains the result but cancels automatic old work', async () => {
  const f = fixture(); let finish;
  f.c.executeTool = () => new Promise(resolve => { finish = resolve; });
  const pending = f.tool('generate_image'); f.c.lastUserTurnActivityAt++;
  finish({ status: 'ok', filename: 'retained.png', displayed: false }); await pending; f.done();
  assert.match(f.sent[0].item.output, /retained.png/); assert.equal(f.responses().length, 0);
});

test('a new connection cannot receive an old tool result', async () => {
  const f = fixture(); let finish;
  f.c.executeTool = () => new Promise(resolve => { finish = resolve; });
  const pending = f.tool('search_web');
  f.c.activeRealtimeSession = () => false; f.c.realtimeSessionGeneration++;
  finish({ status: 'ok' }); await pending; assert.equal(f.sent.length, 0);
});

test('suppressed responses cannot execute a late tool', async () => {
  const f = fixture(); f.c.suppressedResponseIds.add('response');
  await f.tool('search_web'); assert.equal(f.calls.length, 0);
});

test('round budget stops tools, not receipts or a prescribed sentence', async () => {
  const f = fixture(); f.c.toolContinuationRounds = 8;
  await f.tool('search_web'); f.done();
  assert.equal(f.responses()[0].tool_choice, 'none');
  assert.match(f.responses()[0].robot790_tool_followup, /budget of 8/);
  assert.equal(f.responses()[0].tools.length, f.c.enabledToolList().length);
});

test('validated session move waits for the audio boundary and dispatches once', async () => {
  const f = fixture(); let moved = 0;
  f.c.executeTool = async () => { f.c.pendingSessionMapMove = { session_id: 'validated' }; return { status: 'queued' }; };
  f.c.performSessionMapMove = () => moved++;
  await f.tool('enter_session'); f.done(); f.done();
  assert.equal(moved, 1); assert.equal(f.responses().length, 0);
});

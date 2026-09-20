const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const page = fs.readFileSync(`${__dirname}/../../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

function fixture() {
  const sent = [], calls = [], timers = [];
  const names = ['search_web', 'generate_image', 'move_generated_image_to_sensing_eye',
    'list_sensing_eye_notes', 'recall_sensing_eye_note', 'list_sensing_eye_images', 'select_sensing_eye_image',
    'read_text_file', 'write_text_file', 'list_session_map', 'enter_session', 'capture_sensing_eye', 'clear_sensing_eye'];
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
  loadFunctions(c, ['handleFunctionCall', 'maybeCreateToolFollowup']);
  let id = 0;
  const tool = (name, args = {}, callId = `call-${++id}`) => c.handleFunctionCall({
    name, arguments: JSON.stringify(args), call_id: callId, response_id: 'response',
  });
  const done = () => { c.responseDoneAfterTool = true; c.maybeCreateToolFollowup(); };
  const responses = () => sent.filter(e => e.type === 'response.create').map(e => e.response);
  return { c, sent, calls, timers, tool, done, responses };
}

function loadFunctions(context, names) {
  for (const name of names) {
    const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    const end = page.indexOf('\n    }\n', start);
    assert.ok(start >= 0 && end > start, name);
    vm.runInContext(page.slice(start, end + 6), context, { filename: `sts:${name}` });
  }
}

module.exports = { fixture, loadFunctions, page };

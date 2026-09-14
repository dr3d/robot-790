const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

function fixture() {
  const sent = [], logs = [], calls = [], transcript = [], audio = [], finishes = [];
  const catalog = { status: 'ok', count: 2, notes: [
    { id: 'file:panda.jpg', kind: 'image' }, { id: 'file:plexi.jpg', kind: 'image' },
  ] };
  const c = vm.createContext({
    runtimeConfig: {}, Robot790ImageTask: require('../web/sts/image-task.js'),
    imageTaskReceipt: null, handledFunctionCallIds: new Set(), toolFollowupDrainTimer: null, toolFollowupDrainStartedAt: 0,
    outputAudioActive: () => false, setTimeout, clearTimeout,
    pendingSessionMapMove: null, sessionMapMoveBusy: false,
    sessionMapRequestEpoch: 0,
    llmRunOverview: null,
    observeContextUsage: () => {},
    ws: { readyState: 1 }, WebSocket: { OPEN: 1 }, realtimeSessionGeneration: 1,
    realtimeStopRequested: false, activeRealtimeSession: () => true,
    suppressedResponseIds: new Set(), unidentifiedOutputSuppressed: false,
    toolFollowupCatalog: null, pendingEyeRecallResponse: null, eyeRecallResponses: new Map(),
    pendingToolCalls: 0, toolFollowupNeeded: false, responseDoneAfterTool: false,
    toolFollowupPromptSources: [], toolFollowupInstructions: '', toolFollowupExactText: '',
    lastUserTurnActivityAt: 100, lastUserText: 'Show me the panda.',
    buildSessionInstructions: () => 'Saved session: panda.jpg is the panda; plexi.jpg is the copper rig.',
    enabledToolList: () => [
      { type: 'function', name: 'recall_sensing_eye_note', description: 'Recall a note.' },
      { type: 'function', name: 'set_chassis', description: 'Move.' },
    ],
    parseToolArguments: JSON.parse, loadedNoteContextDirty: false,
    beginToolActivity() {}, endToolActivity() {}, toolDetailFromArgs: () => '',
    executeTool: async (name, args) => {
      calls.push({ name, args });
      return name.startsWith('list_') ? catalog : { status: 'ok', selected: { staged: true, kind: 'image', id: args.note_id } };
    },
    send: event => sent.push(event), events: {}, log: (_, line) => logs.push(line),
    rememberToolFollowupPrompt() {}, rememberPromptLedger() {}, ttsRuntimeConfig: () => ({}),
    exactSpeechInstruction: text => `Say: ${text}`, responseCreateLedgerCredits: 20,
    responseActive: false, idleInFlight: false, idleExhaustionScoredThisResponse: false,
    reengageInFlight: false, gpuWatchInFlight: false, standingRoutineInFlight: false,
    imageToolProtectionEnabled: false,
    clearImageToolProtection() {},
    imageFollowupText: () => 'I made the image.',
    generatedImageToEyeFollowupText: () => 'I moved the generated image into my sensing eye.',
    searchFollowupInstructions: () => 'Answer from search receipts.',
    updateIdleSchedulerStatus() {}, scheduleFaceIdle() {}, updateLanePressure() {},
    clearUserTurnPending() {}, resetSpeechMouthCue() {}, cueFaceMode() {},
    flushAudioQueue: async () => {}, clearLabGoalAfterOneShotResponse() {},
    armAssistantUtteranceFinished: value => finishes.push(value),
    noteAudioCaption() {}, noteAssistantText() {}, addConversation: text => transcript.push(text),
    queueAudioDelta: value => audio.push(value), cueSpeechMouth() {},
    stopPlaybackNow: () => { throw new Error('Must not erase queued clean audio'); },
    clearConversationReengageTimer() {}, noteUserTurnActivity: () => { c.lastUserTurnActivityAt++; },
    updateSessionTools() {}, appendBrain2AdvisoryToConversation() {}, appendRuntimeContextToConversation() {},
  });
  for (const name of ['containsToolMarkup', 'eventResponseId', 'responseOutputSuppressed',
    'suppressToolMarkupResponse', 'sensingEyeRecallContinuation', 'sensingEyeRecallFollowupInstructions', 'imageTaskContinuation', 'sessionMapContinuation',
    'handleFunctionCall', 'maybeCreateToolFollowup', 'finishSensingEyeChoice', 'handleEvent']) {
    const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    const end = page.indexOf('\n    }\n', start);
    assert.ok(start >= 0 && end > start, name);
    vm.runInContext(page.slice(start, end + 6), c, { filename: name });
  }
  function done(id) { c.handleEvent({ type: 'response.done', response: { id, status: 'completed' } }); }
  function created(id) { c.handleEvent({ type: 'response.created', response: { id } }); }
  let nextCall = 0;
  async function tool(name, args = {}, id = 'initial', callId = `call-${++nextCall}`) {
    c.handleEvent({ type: 'response.function_call_arguments.done', name, arguments: JSON.stringify(args), response_id: id, call_id: callId });
    await new Promise(setImmediate);
  }
  const directions = () => sent.filter(e => e.type === 'response.create').at(-1).response.robot790_tool_followup;
  return { c, sent, logs, calls, transcript, audio, finishes, catalog, done, created, tool, directions };
}

function mapFixture({ total = 1, request = 'Take us to Genius rehearsal.' } = {}) {
  const f = fixture();
  f.c.lastUserText = request;
  f.c.enabledToolList = () => ['list_session_map', 'enter_session', 'read_text_file', 'set_chassis']
    .map(name => ({ type: 'function', name }));
  f.c.performSessionMapMove = move => f.calls.push({ name: 'transition', args: move });
  f.c.executeTool = async (name, args) => {
    f.calls.push({ name, args });
    if (name === 'list_session_map') return { status: 'ok', total, sessions: total ? [
      { session_id: 'sessions/genius.txt', title: 'Genius rehearsal', created: '2026-09-12' },
      ...(total > 1 ? [{ session_id: 'sessions/other.txt', title: 'Genius rehearsal' }] : [])
    ] : [] };
    f.c.pendingSessionMapMove = { session_id: args.destination };
    return { status: 'queued' };
  };
  return f;
}

test('map lookup -> private entry -> transition is one bounded action, with stable schemas', async () => {
  const f = mapFixture();
  await f.tool('list_session_map', { query: 'Genius' });
  f.done('initial');
  assert.equal(f.sent.at(-1).response.tool_choice, 'auto');
  assert.deepEqual(Array.from(f.sent.at(-1).response.modalities), ['text']);
  assert.equal(f.sent.at(-1).response.tools.length, 4);
  assert.match(f.directions(), /Listing sessions does not authorize moving/);
  assert.match(f.directions(), /sessions\/genius.txt/);
  f.created('map-choice');
  await f.tool('read_text_file', { filename: 'sessions/genius.txt' }, 'map-choice');
  await f.tool('enter_session', { destination: 'sessions/not-listed.txt' }, 'map-choice');
  await f.tool('enter_session', { destination: 'sessions/genius.txt' }, 'map-choice');
  await f.tool('enter_session', { destination: 'sessions/genius.txt' }, 'map-choice');
  f.done('map-choice');
  assert.deepEqual(f.calls.map(call => call.name), ['list_session_map', 'enter_session', 'transition']);
  assert.equal(f.transcript.length, 0, 'private decision is not spoken');
});

test('list-only/import request can finish without navigation; no automatic match dispatch', async () => {
  for (const request of ['List the genius sessions.', 'Bring that transcript here as a note.']) {
    const f = mapFixture({ request });
    await f.tool('list_session_map');
    f.done('initial');
    assert.match(f.directions(), /read\/import a single note/);
    f.created('map-choice');
    f.c.handleEvent({ type: 'response.output_text.done', response_id: 'map-choice', text: 'I found Genius rehearsal.' });
    f.done('map-choice');
    assert.deepEqual(f.calls.map(call => call.name), ['list_session_map']);
    assert.equal(f.sent.at(-1).response.tool_choice, 'none');
  }
});

test('missing and ambiguous map results reject even an attempted listed entry', async () => {
  for (const total of [0, 2]) {
    const f = mapFixture({ total });
    await f.tool('list_session_map');
    f.done('initial');
    assert.match(f.directions(), /Do not call any tool/);
    f.created('map-choice');
    await f.tool('enter_session', { destination: 'sessions/genius.txt' }, 'map-choice');
    f.done('map-choice');
    assert.deepEqual(f.calls.map(call => call.name), ['list_session_map']);
    assert.match(f.directions(), /Which saved thread/);
  }
});

test('new activity, cancellation epoch, expiry and completed selection reject late map entry', async () => {
  for (const mode of ['activity', 'epoch', 'expiry', 'completed']) {
    const f = mapFixture();
    await f.tool('list_session_map');
    f.done('initial');
    f.created('map-choice');
    if (mode === 'activity') f.c.lastUserTurnActivityAt++;
    if (mode === 'epoch') f.c.sessionMapRequestEpoch++;
    if (mode === 'expiry') f.c.eyeRecallResponses.get('map-choice').deadline = 0;
    if (mode === 'completed') f.done('map-choice');
    await f.tool('enter_session', { destination: 'sessions/genius.txt' }, 'map-choice');
    assert.deepEqual(f.calls.map(call => call.name), ['list_session_map']);
  }
});

function imageFixture() {
  const f = fixture();
  f.c.runtimeConfig = { image_continuation: { enabled: true } };
  f.c.lastUserText = 'Look up and draw the house, then put it in your eye.';
  f.c.enabledToolList = () => ['search_web', 'generate_image', 'move_generated_image_to_sensing_eye', 'set_chassis']
    .map(name => ({ type: 'function', name }));
  f.c.executeTool = async (name, args) => {
    f.calls.push({ name, args });
    if (name === 'search_web') return { status: 'ok', results: [{ title: 'House' }] };
    if (name === 'generate_image') return { status: 'ok', filename: 'house.png', displayed: true };
    return { status: 'ok', source_image: 'house.png', staged: true };
  };
  return f;
}

test('search -> private generation -> private staging -> speech completes one authorized image chain', async () => {
  const f = imageFixture();
  await f.tool('search_web', { query: 'house' });
  f.done('initial');
  assert.equal(f.sent.at(-1).response.tool_choice, 'auto');
  assert.deepEqual(Array.from(f.sent.at(-1).response.modalities), ['text']);
  assert.equal(f.sent.at(-1).response.tools.length, 4, 'stable complete schema set');
  assert.match(f.directions(), /Search alone does not authorize drawing/);
  f.created('draw-choice');
  await f.tool('generate_image', { prompt: 'The house' }, 'draw-choice');
  f.done('draw-choice');
  assert.equal(f.sent.at(-1).response.tool_choice, 'auto');
  assert.match(f.directions(), /house.png/);
  f.created('eye-choice');
  await f.tool('move_generated_image_to_sensing_eye', {}, 'eye-choice');
  f.done('eye-choice');
  assert.equal(f.sent.at(-1).response.tool_choice, 'none');
  assert.match(f.directions(), /moved the generated image/);
  assert.deepEqual(f.calls.map(call => call.name), ['search_web', 'generate_image', 'move_generated_image_to_sensing_eye']);
  assert.equal(f.calls[2].args._expectedFilename, 'house.png');
  assert.equal(f.c.imageTaskReceipt.receipts.at(-1).staged, true);
  assert.equal(f.finishes.length, 0, 'no idle boundary during the chain');
  f.created('spoken-receipt');
  f.done('spoken-receipt');
  assert.equal(f.finishes.length, 1);
});

test('search-only and draw-only requests may finish without an extra action', async () => {
  for (const initial of ['search_web', 'generate_image']) {
    const f = imageFixture();
    f.c.lastUserText = initial === 'search_web' ? 'How old is the house?' : 'Draw the house; leave the eye alone.';
    await f.tool(initial);
    f.done('initial');
    f.created('choice');
    assert.match(f.directions(), /Generation alone does not authorize staging/);
    f.c.handleEvent({ type: 'response.output_text.done', response_id: 'choice', text: 'Done with the requested step.' });
    f.done('choice');
    assert.equal(f.calls.length, 1);
    assert.equal(f.sent.at(-1).response.tool_choice, 'none');
    assert.match(f.directions(), /Done with the requested step/);
  }
});

test('private image choices reject unrelated tools, double dispatch, extra generations, and late calls', async () => {
  const f = imageFixture();
  await f.tool('search_web', {}, 'initial', 'unique-search');
  await f.tool('search_web', {}, 'initial', 'unique-search');
  f.done('initial');
  f.created('choice');
  await f.tool('set_chassis', {}, 'choice');
  await f.tool('generate_image', { prompt: 'house' }, 'choice', 'unique-image');
  await f.tool('generate_image', { prompt: 'house' }, 'choice', 'unique-image');
  await f.tool('generate_image', { prompt: 'another' }, 'choice');
  f.done('choice');
  await f.tool('generate_image', { prompt: 'late' }, 'choice');
  assert.deepEqual(f.calls.map(call => call.name), ['search_web', 'generate_image']);
});

test('failed generation has one failure confirmation and no retry or staging', async () => {
  const f = imageFixture();
  f.c.executeTool = async name => { f.calls.push(name); throw new Error('Timeout; outcome unknown'); };
  await f.tool('generate_image');
  f.done('initial');
  assert.equal(f.calls.length, 1);
  assert.equal(f.sent.at(-1).response.tool_choice, 'none');
  assert.match(f.directions(), /could not make/);
  assert.equal(f.c.imageTaskReceipt.receipts.at(-1).status, 'error');
});

test('new speech invalidates private image steps and late generation followups', async () => {
  const f = imageFixture();
  await f.tool('search_web');
  f.done('initial');
  f.created('choice');
  f.c.handleEvent({ type: 'input_audio_buffer.speech_started' });
  await f.tool('generate_image', {}, 'choice');
  assert.equal(f.calls.length, 1);
  const g = imageFixture();
  let finish, args;
  g.c.executeTool = (_name, value) => { args = value; return new Promise(resolve => { finish = resolve; }); };
  const pending = g.tool('generate_image');
  g.c.handleEvent({ type: 'input_audio_buffer.speech_started' });
  assert.equal(args._isCurrent(), false);
  finish({ status: 'ok', filename: 'late.png' });
  await pending;
  g.done('initial');
  assert.equal(g.sent.filter(event => event.type === 'response.create').length, 0);
});

test('tool followup waits for queued audio and keeps the task boundary pending', async () => {
  const f = imageFixture();
  const timers = [];
  f.c.setTimeout = callback => { timers.push(callback); return 1; };
  f.c.outputAudioActive = () => true;
  await f.tool('search_web');
  f.done('initial');
  assert.equal(f.sent.filter(event => event.type === 'response.create').length, 0);
  assert.equal(f.c.toolFollowupNeeded, true);
  assert.equal(timers.length, 1);
  f.c.outputAudioActive = () => false;
  timers[0]();
  assert.equal(f.sent.filter(event => event.type === 'response.create').length, 1);
});

test('the rollout switch leaves existing speech-only image followups available for rollback', async () => {
  const f = imageFixture();
  f.c.runtimeConfig.image_continuation.enabled = false;
  await f.tool('generate_image');
  f.done('initial');
  assert.equal(f.sent.at(-1).response.tool_choice, 'none');
  assert.match(f.directions(), /I made the image/);
  assert.equal(f.c.imageTaskReceipt, null);
});

test('a private selection expires without staging or speech after cancellation', async () => {
  const f = imageFixture();
  await f.tool('generate_image');
  f.done('initial');
  f.created('choice');
  const before = f.sent.length;
  f.c.handleEvent({ type: 'response.done', response: { id: 'choice', status: 'cancelled' } });
  await f.tool('move_generated_image_to_sensing_eye', {}, 'choice');
  assert.equal(f.calls.length, 1);
  assert.equal(f.sent.slice(before).filter(event => event.type === 'response.create').length, 0);
});

test('cancellation during a paid call retains its artifact without reviving the continuation', async () => {
  const f = imageFixture();
  let finish, args;
  f.c.executeTool = (_name, value) => { args = value; return new Promise(resolve => { finish = resolve; }); };
  const pending = f.tool('generate_image');
  f.c.handleEvent({ type: 'response.done', response: { id: 'initial', status: 'cancelled' } });
  assert.equal(args._isCurrent(), false);
  finish({ status: 'ok', filename: 'late.png' });
  await pending;
  assert.equal(f.sent.filter(event => event.type === 'response.create').length, 0);
});

test('list -> real recall -> grounded speech keeps session context and never finishes the handoff early', async () => {
  const f = fixture();
  await f.tool('list_sensing_eye_notes');
  assert.equal(f.sent.filter(event => event.type === 'response.create').length, 0);
  f.done('initial');
  const request = f.sent.at(-1).response;
  assert.equal(request.tool_choice, 'auto');
  assert.deepEqual(Array.from(request.output_modalities), ['text']);
  assert.deepEqual(Array.from(request.modalities), ['text']);
  assert.equal(request.tools.length, 2);
  assert.equal(request.tools[0].name, 'recall_sensing_eye_note');
  assert.deepEqual(JSON.parse(JSON.stringify(request.tools)), f.c.enabledToolList());
  assert.equal(request.instructions, undefined);
  assert.equal(typeof request.robot790_tool_followup, 'string');
  assert.match(f.directions(), /Show me the panda/);
  assert.doesNotMatch(f.directions(), /Saved session:/);
  assert.equal(f.sent.filter(e => e.item?.role === 'user').length, 0, 'no synthetic operator turns persisted');
  assert.equal(f.finishes.length, 0);
  assert.equal(f.c.responseActive, true);
  f.created('choice');
  f.c.handleEvent({ type: 'response.output_text.delta', response_id: 'choice', delta: '{"note_id":"file:panda.jpg"}' });
  f.c.handleEvent({ type: 'response.output_audio.delta', response_id: 'choice', delta: 'unexpected-audio' });
  f.c.handleEvent({ type: 'response.output_audio_transcript.done', response_id: 'choice', transcript: 'file:panda.jpg' });
  assert.equal(f.transcript.length, 0);
  assert.equal(f.audio.length, 0);
  await f.tool('recall_sensing_eye_note', { note_id: 'file:panda.jpg' }, 'choice', 'call-2');
  f.done('choice');
  assert.equal(f.finishes.length, 0);
  assert.equal(f.sent.at(-1).response.tool_choice, 'none');
  assert.deepEqual(Array.from(f.sent.at(-1).response.modalities), ['audio', 'text']);
  assert.equal(f.sent.at(-1).response.output_modalities, undefined);
  assert.equal(f.sent.at(-1).response.instructions, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(f.sent.at(-1).response.tools)), f.c.enabledToolList());
  assert.match(f.directions(), /actual staged image/);
  f.created('explanation');
  f.c.handleEvent({ type: 'response.output_audio_transcript.done', response_id: 'explanation', transcript: 'There is the panda.' });
  f.done('explanation');
  assert.equal(f.finishes.length, 1);
  assert.equal(f.transcript[0], 'Robot 790: There is the panda.');
  assert.equal(f.calls.length, 2);
});

test('a text-only choice without a tool speaks its answer or clarification once', async () => {
  for (const text of ['Which panda picture did you mean?', '{"note_id":"file:panda.jpg"}', '<tool_call>recall</tool_call>', '']) {
    const f = fixture();
    await f.tool('list_sensing_eye_notes');
    f.done('initial');
    f.created('choice');
    f.c.handleEvent({ type: 'response.output_text.delta', response_id: 'choice', delta: text });
    f.c.handleEvent({ type: 'response.output_text.done', response_id: 'choice', text });
    assert.equal(f.transcript.length, 0);
    f.done('choice');
    assert.equal(f.calls.length, 1);
    assert.equal(f.sent.at(-1).response.tool_choice, 'none');
    assert.match(f.directions(), text.startsWith('Which') ? /Which panda picture/ : /couldn't identify/);
    const count = f.sent.length;
    f.done('choice');
    assert.equal(f.sent.length, count);
    await f.tool('recall_sensing_eye_note', { note_id: 'file:panda.jpg' }, 'choice');
    assert.equal(f.calls.length, 1, 'a closed choice cannot execute a late action');
  }
});

test('interrupted, cancelled, or failed private choices do not speak a stale clarification', async () => {
  for (const status of ['interrupted', 'cancelled', 'failed']) {
    const f = fixture();
    await f.tool('list_sensing_eye_notes');
    f.done('initial');
    f.created('choice');
    f.c.handleEvent({ type: 'response.output_text.delta', response_id: 'choice', delta: 'Which picture?' });
    if (status === 'interrupted') f.c.handleEvent({ type: 'input_audio_buffer.speech_started' });
    const count = f.sent.length;
    f.c.handleEvent({ type: 'response.done', response: { id: 'choice', status: status === 'interrupted' ? 'completed' : status } });
    assert.equal(f.sent.length, count);
    assert.equal(f.transcript.length, 0);
    assert.equal(f.calls.length, 1);
  }
});

test('listing-only requests retain the choice not to load; empty, failed, or disabled catalogues cannot continue', async () => {
  const f = fixture();
  f.c.lastUserText = 'Which pictures are available?';
  await f.tool('list_sensing_eye_images');
  f.done('initial');
  assert.match(f.directions(), /only asked what is available.*without loading anything/);
  assert.equal(f.calls.length, 1);
  for (const condition of ['empty', 'failed', 'disabled']) {
    const g = fixture();
    if (condition === 'empty') Object.assign(g.catalog, { count: 0, notes: [] });
    if (condition === 'failed') g.c.executeTool = async () => { throw new Error('lookup failed'); };
    if (condition === 'disabled') g.c.enabledToolList = () => [];
    await g.tool('list_sensing_eye_notes');
    g.done('initial');
    assert.equal(g.sent.at(-1).response.tool_choice, 'none', condition);
  }
});

test('a recall continuation rejects unlisted IDs, other verbs, and a second action', async () => {
  const f = fixture();
  await f.tool('list_sensing_eye_notes');
  f.done('initial');
  f.created('choice');
  await f.tool('recall_sensing_eye_note', { note_id: 'file:invented.jpg' }, 'choice');
  await f.tool('recall_sensing_eye_note', null, 'choice');
  await f.tool('set_chassis', { action: 'forward' }, 'choice');
  assert.equal(f.calls.length, 1);
  await f.tool('recall_sensing_eye_note', { note_id: 'file:panda.jpg' }, 'choice');
  await f.tool('recall_sensing_eye_note', { note_id: 'file:plexi.jpg' }, 'choice');
  assert.equal(f.calls.length, 2);
  assert.equal(f.logs.filter(line => line.includes('continuation rejected')).length, 4);
});

test('an actual recall failure reports failure once without retrying or suppressing the next answer', async () => {
  const f = fixture();
  await f.tool('list_sensing_eye_notes');
  f.done('initial');
  f.created('choice');
  f.c.executeTool = async () => { throw new Error('saved image unavailable'); };
  await f.tool('recall_sensing_eye_note', { note_id: 'file:panda.jpg' }, 'choice');
  f.done('choice');
  assert.equal(f.sent.at(-1).response.tool_choice, 'none');
  assert.match(f.directions(), /could not recall/);
  assert.equal(f.sent.filter(e => e.type === 'response.create').length, 2);
  f.c.handleEvent({ type: 'response.output_audio_transcript.done', response_id: 'next-auto', transcript: 'Still here.' });
  assert.deepEqual(f.transcript, ['Robot 790: Still here.']);
});

test('new user activity cancels an old catalogue handoff and old response capabilities', async () => {
  const f = fixture();
  let finish;
  f.c.executeTool = () => new Promise(resolve => { finish = resolve; });
  const task = f.tool('list_sensing_eye_notes');
  f.c.handleEvent({ type: 'input_audio_buffer.speech_started' });
  finish(f.catalog);
  await task;
  f.done('initial');
  assert.equal(f.sent.filter(event => event.type === 'response.create').length, 0);
  const g = fixture();
  await g.tool('list_sensing_eye_notes');
  g.done('initial');
  g.c.handleEvent({ type: 'input_audio_buffer.speech_started' });
  g.created('choice');
  await g.tool('recall_sensing_eye_note', { note_id: 'file:panda.jpg' }, 'choice');
  assert.equal(g.calls.length, 1);
});

test('malformed output suppresses only its response and preserves clean queued audio and later automatic turns', () => {
  const f = fixture();
  f.c.handleEvent({ type: 'response.output_audio.delta', response_id: 'bad', delta: 'clean-prefix' });
  f.c.handleEvent({ type: 'response.output_audio_transcript.done', response_id: 'bad', transcript: '<tool_call>' });
  assert.equal(f.sent.at(-1).type, 'response.cancel');
  f.c.handleEvent({ type: 'response.output_audio.delta', response_id: 'bad', delta: 'reject-this' });
  f.c.handleEvent({ type: 'response.output_audio_transcript.done', response_id: 'next-auto', transcript: 'I can answer normally.' });
  f.c.handleEvent({ type: 'response.output_audio.delta', response_id: 'next-auto', delta: 'new-audio' });
  f.created('later-explicit');
  f.c.handleEvent({ type: 'response.output_audio_transcript.done', response_id: 'bad', transcript: 'Late old text.' });
  f.c.handleEvent({ type: 'response.function_call_arguments.done', response_id: 'bad', name: 'recall_sensing_eye_note', arguments: '{}' });
  assert.deepEqual(f.audio, ['clean-prefix', 'new-audio']);
  assert.deepEqual(f.transcript, ['Robot 790: I can answer normally.']);
  assert.equal(f.calls.length, 0);
  assert.equal(f.sent.filter(event => event.type === 'response.cancel').length, 1);
});

test('legacy output without response IDs recovers on new user speech; response history stays bounded', () => {
  const f = fixture();
  f.c.handleEvent({ type: 'response.output_audio_transcript.done', transcript: '<tool_call>' });
  assert.equal(f.c.unidentifiedOutputSuppressed, true);
  f.c.handleEvent({ type: 'input_audio_buffer.speech_started' });
  f.c.handleEvent({ type: 'response.output_audio_transcript.done', transcript: 'Next turn.' });
  assert.equal(f.transcript.length, 1);
  for (let i = 0; i < 80; i++) f.c.suppressToolMarkupResponse('<tool_call>', { response_id: `bad-${i}` });
  assert.equal(f.c.suppressedResponseIds.size, 64);
});

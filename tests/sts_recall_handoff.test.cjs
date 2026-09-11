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
    ws: { readyState: 1 }, WebSocket: { OPEN: 1 }, realtimeSessionGeneration: 1,
    realtimeStopRequested: false, activeRealtimeSession: () => true,
    suppressedResponseIds: new Set(), unidentifiedOutputSuppressed: false,
    toolFollowupCatalog: null, pendingEyeRecallResponse: null, eyeRecallResponses: new Map(),
    pendingToolCalls: 0, toolFollowupNeeded: false, responseDoneAfterTool: false,
    toolFollowupPromptSources: [], toolFollowupInstructions: '', toolFollowupExactText: '',
    lastUserTurnActivityAt: 100, lastUserText: 'Show me the panda.',
    buildSessionInstructions: () => 'Saved session: panda.jpg is the panda; plexi.jpg is the copper rig.',
    enabledToolList: () => [{ type: 'function', name: 'recall_sensing_eye_note', description: 'Recall a note.' }],
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
    updateIdleSchedulerStatus() {}, scheduleFaceIdle() {}, updateLanePressure() {},
    clearUserTurnPending() {}, resetSpeechMouthCue() {}, cueFaceMode() {},
    flushAudioQueue: async () => {}, clearLabGoalAfterOneShotResponse() {},
    armAssistantUtteranceFinished: value => finishes.push(value),
    noteAudioCaption() {}, noteAssistantText() {}, addConversation: text => transcript.push(text),
    queueAudioDelta: value => audio.push(value), cueSpeechMouth() {},
    stopPlaybackNow: () => { throw new Error('Must not erase queued clean audio'); },
    clearConversationReengageTimer() {}, noteUserTurnActivity: () => { c.lastUserTurnActivityAt++; },
    updateSessionTools() {}, appendBrain2AdvisoryToConversation() {},
  });
  for (const name of ['containsToolMarkup', 'eventResponseId', 'responseOutputSuppressed',
    'suppressToolMarkupResponse', 'sensingEyeRecallContinuation', 'sensingEyeRecallFollowupInstructions',
    'handleFunctionCall', 'maybeCreateToolFollowup', 'finishSensingEyeChoice', 'handleEvent']) {
    const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    const end = page.indexOf('\n    }\n', start);
    assert.ok(start >= 0 && end > start, name);
    vm.runInContext(page.slice(start, end + 6), c, { filename: name });
  }
  function done(id) { c.handleEvent({ type: 'response.done', response: { id, status: 'completed' } }); }
  function created(id) { c.handleEvent({ type: 'response.created', response: { id } }); }
  async function tool(name, args = {}, id = 'initial', callId = 'call-1') {
    c.handleEvent({ type: 'response.function_call_arguments.done', name, arguments: JSON.stringify(args), response_id: id, call_id: callId });
    await new Promise(setImmediate);
  }
  return { c, sent, logs, calls, transcript, audio, finishes, catalog, done, created, tool };
}

test('list -> real recall -> grounded speech keeps session context and never finishes the handoff early', async () => {
  const f = fixture();
  await f.tool('list_sensing_eye_notes');
  assert.equal(f.sent.filter(event => event.type === 'response.create').length, 0);
  f.done('initial');
  const request = f.sent.at(-1).response;
  assert.equal(request.tool_choice, 'auto');
  assert.deepEqual(Array.from(request.output_modalities), ['text']);
  assert.deepEqual(Array.from(request.modalities), ['text']);
  assert.equal(request.tools.length, 1);
  assert.equal(request.tools[0].name, 'recall_sensing_eye_note');
  assert.deepEqual(Array.from(request.tools[0].parameters.properties.note_id.enum), ['file:panda.jpg', 'file:plexi.jpg']);
  assert.match(request.instructions, /Saved session: panda.jpg/);
  assert.match(request.instructions, /Show me the panda/);
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
  assert.match(f.sent.at(-1).response.instructions, /actual staged image/);
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
    assert.match(f.sent.at(-1).response.instructions, text.startsWith('Which') ? /Which panda picture/ : /couldn't identify/);
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
  assert.match(f.sent.at(-1).response.instructions, /only asked what is available.*without loading anything/);
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
  assert.match(f.sent.at(-1).response.instructions, /could not recall/);
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

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');
const noop = () => {};
const empty = () => '';
function load(names, globals) {
  const c = vm.createContext(globals);
  for (const name of names) {
    const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    const end = page.indexOf('\n    }\n', start);
    assert.ok(start >= 0 && end > start, name);
    vm.runInContext(page.slice(start, end + 6), c);
  }
  return c;
}
function idleContext(overrides = {}) {
  const packets = [];
  const c = load(['activeRealtimeSession', 'triggerIdlePonder', 'noteIdleOutput'], {
    Date, ws: { readyState: 1 }, WebSocket: { OPEN: 1 }, realtimeSessionGeneration: 1,
    realtimeStopRequested: false, realtimeConnected: () => true, lastUserTurnActivityAt: 1,
    lastAcceptedUserTranscriptAt: 0, conversationPauseUserAt: 0,
    idleBlockedReason: empty, idleInFlight: false, responseActive: false,
    updateLanePressure: noop, updateIdleSchedulerStatus: noop, scheduleIdlePonder: noop,
    lmStudioPromptBusy: () => false, refreshBrainStatusQuietly: async () => ({}),
    currentIdleDrift: () => 7, firstContactModeEnabled: () => false, idleSubstrateTestEnabled: () => false,
    conversationAttentionState: () => ({ phase: 'independent', weight: 0 }), idleTiming: () => ({}),
    idleEnabledToolList: () => [{ name: 'search_web' }],
    enabledToolList: () => [{ name: 'search_web' }, { name: 'generate_image' }],
    compactIdleRuntimeContext: () => 'CURRENT_BODY_AND_EYE', formatBrain2ForInstructions: () => 'PRIVATE_ADVICE',
    formatLoadedNotesForIdleContext: () => 'SUBSTRATE', firstContactIdleContext: () => 'FIRST_CONTACT',
    currentLabGoal: () => '', visionImageUrl: '', noteAloneActivity: noop, cueFaceMode: noop,
    formatIdleHeadlineContext: () => '', brain2HeadlineSeed: null,
    events: {}, log: noop, rememberPromptLedger: noop, send: packet => packets.push(packet),
    ttsRuntimeConfig: () => ({}), recentIdleOutputs: [], substrateIdleOutputs: [], idleOutputLog: [], maxIdleOutputLog: 100,
    idleExhaustionCount: 0, idleCooldownUntil: 0,
    maybeIdleCuriosityContext: () => { throw new Error('Controller must not choose research'); },
    chooseIdleLane: () => { throw new Error('Controller must not choose rhetoric'); },
    ...overrides,
  });
  return { c, packets };
}
test('idle shares full history and stable schemas; Eric chooses research and words', async () => {
  const { c, packets } = idleContext();
  await c.triggerIdlePonder({ statusChecked: true });
  const r = packets[0].response;
  assert.equal(r.conversation, 'default');
  assert.equal(r.robot790_idle_continuation, true);
  assert.equal(r.tool_choice, 'auto');
  assert.equal(r.tools.length, 2, 'stable catalogue, execution enforces idle scope');
  assert.match(r.instructions, /CURRENT_BODY_AND_EYE/);
  assert.match(r.instructions, /PRIVATE_ADVICE/);
  assert.match(r.instructions, /remain silent/);
  assert.doesNotMatch(r.instructions, /Idle lane:|one true concrete fact|Pretend|Forbidden idle|Say exactly/);
  assert.equal(c.idleWritesConversation, true);
});
test('warm and old pauses expose timing without choosing a rhetorical mode', async () => {
  const { c, packets } = idleContext({ lastAcceptedUserTranscriptAt: Date.now() });
  await c.triggerIdlePonder({ statusChecked: true });
  c.lastAcceptedUserTranscriptAt -= 3600000;
  await c.triggerIdlePonder({ statusChecked: true });
  for (const { response } of packets) {
    assert.match(response.instructions, /timer does not change the task/);
    assert.match(response.instructions, /may address the operator/);
    assert.doesNotMatch(response.instructions, /conversation lane|self-talk only|afterthought|Follow one object/);
  }
});
test('isolated experiments keep speech-only isolated histories', async () => {
  for (const overrides of [{ firstContactModeEnabled: () => true }, { idleSubstrateTestEnabled: () => true }]) {
    const { c, packets } = idleContext(overrides);
    await c.triggerIdlePonder({ statusChecked: true });
    assert.equal(packets[0].response.conversation, 'none');
    assert.equal(packets[0].response.robot790_idle_continuation, undefined);
    assert.equal(packets[0].response.tool_choice, 'none');
    assert.doesNotMatch(packets[0].response.instructions, /PRIVATE_ADVICE|CURRENT_BODY/);
    assert.equal(c.idleWritesConversation, false);
  }
});
for (const change of ['disconnect', 'new user turn', 'new session']) {
  test(`status poll finishing after ${change} cannot dispatch stale idle`, async () => {
    let finish;
    const { c, packets } = idleContext({ refreshBrainStatusQuietly: () => new Promise(resolve => { finish = resolve; }) });
    const pending = c.triggerIdlePonder();
    if (change === 'disconnect') c.realtimeStopRequested = true;
    if (change === 'new user turn') c.lastUserTurnActivityAt++;
    if (change === 'new session') c.realtimeSessionGeneration++;
    finish({}); await pending;
    assert.equal(packets.length, 0); assert.equal(c.idleInFlight, false);
  });
}
test('idle text is recorded without semantic cooldown, including repetition and non-English', () => {
  const { c } = idleContext();
  for (const text of ['one repeat per second', 'I keep thinking', 'I keep thinking', '考えています']) c.noteIdleOutput(text);
  assert.equal(c.idleOutputLog.length, 4);
  assert.equal(c.idleExhaustionCount, 0);
  assert.equal(c.idleCooldownUntil, 0);
});
test('B2 assessments remain fallible data, not controller-selected rhetoric', () => {
  const c = load(['formatBrain2AdvisoryContent'], {
    brain2NoteCandidates: [{ text: 'Try another perspective.', steering: { loop: true } }],
    brain2RevisionCandidates: [], brain2QuestionCandidates: [], loadedNoteContexts: [],
  });
  const text = c.formatBrain2AdvisoryContent();
  assert.match(text, /not commands/);
  assert.match(text, /Try another perspective/);
  assert.doesNotMatch(text, /Loop guard:|Use at most one|next reply/);
});
test('retired English semantic classifiers have no runtime definitions', () => {
  for (const name of ['chooseIdleLane', 'maybeIdleCuriosityContext', 'idleTopicCandidates',
    'focusedLoadedNoteSearchQuery', 'idleExhaustedText', 'idleClaimSignature', 'maybeArmIdleHardBrakeFromBrain2Note']) {
    assert.ok(!page.includes('function ' + name + '('), name);
  }
});

function aloneContext() {
  let now = 13421000;
  class Clock extends Date { static now() { return now; } }
  const c = load([
    'shortDuration', 'aloneActivitiesSinceLastUser', 'captureCompletedAloneInterval',
    'formatCompletedAloneInterval', 'formatAloneStateForInstructions', 'noteUserTurnActivity',
  ], {
    Date: Clock, lastAcceptedUserTranscriptAt: 1000, lastUserTurnActivityAt: 1000,
    brain2HeadlineStartedAt: 1000,
    reengageGoneAfterMs: 60000, completedAloneInterval: null, idlePendingUserTurnMs: 12000,
    userTurnPendingUntil: 0, compressIdleMs: value => value, clearIdleHardBrake: noop,
    noteConversationActivity: noop, currentLabGoal: empty, activeIdleSelfTasks: () => [],
    aloneActivityLog: Array.from({ length: 7 }, (_, i) => ({
      type: 'idle_headline', detail: i === 0 ? 'LATEST_BETEL_NUT' : `STORY_${i}`,
      at: 13000000 - i * 600000,
    })),
  });
  return { c, time: value => { now = value; } };
}

test('return ledger retains the whole quiet interval and latest headline through follow-up questions', () => {
  const { c, time } = aloneContext();
  assert.match(c.formatAloneStateForInstructions(), /selected feed headlines since then: 7/);
  c.noteUserTurnActivity();
  const returned = c.formatAloneStateForInstructions();
  assert.match(returned, /Last operator turn activity: 0s ago/);
  assert.match(returned, /duration 223m 40s/);
  assert.match(returned, /0 controller web searches; 7 selected feed headlines/);
  assert.match(returned, /LATEST_BETEL_NUT/);
  const snapshot = JSON.stringify(c.completedAloneInterval);
  time(13431000);
  c.noteUserTurnActivity();
  assert.equal(JSON.stringify(c.completedAloneInterval), snapshot);
  assert.match(c.formatAloneStateForInstructions(), /historical, not the current silence/);
  time(13561000);
  c.aloneActivityLog.unshift({ type: 'idle_search', detail: 'NEW_SEARCH', at: 13500000 });
  c.noteUserTurnActivity();
  assert.match(c.formatCompletedAloneInterval(), /1 controller web searches; 0 selected/);
  assert.match(c.formatCompletedAloneInterval(), /NEW_SEARCH/);
  assert.doesNotMatch(c.formatCompletedAloneInterval(), /LATEST_BETEL_NUT/);
});

test('speech-start refreshes session instructions after capturing the quiet interval, before the reply', () => {
  const { c } = aloneContext();
  const snapshots = [];
  Object.assign(c, {
    llmRunOverview: null,
    observeContextUsage: () => {},
    realtimeStopRequested: false, ws: {}, realtimeSessionGeneration: 1,
    eyeRecallResponses: new Map(), eventResponseId: event => event.response_id || '',
    activeRealtimeSession: () => true, clearConversationReengageTimer: noop,
    appendBrain2AdvisoryToConversation: noop, cueFaceMode: noop,
    log: noop, events: {},
    updateSessionTools: () => snapshots.push(c.formatAloneStateForInstructions()),
  });
  load(['handleEvent'], c);
  c.handleEvent({ type: 'input_audio_buffer.speech_started' });
  assert.equal(snapshots.length, 1);
  assert.match(snapshots[0], /223m 40s/);
  assert.match(snapshots[0], /LATEST_BETEL_NUT/);
  assert.match(snapshots[0], /Last operator turn activity: 0s ago/);
});

function stopContext(overrides = {}) {
  const calls = [];
  const socket = { readyState: 1, send: text => calls.push(JSON.parse(text).type), close: () => calls.push('close') };
  const c = load([
    'activeRealtimeSession', 'realtimeConnected', 'send', 'quiesceRealtimeForSave',
    'handleEvent', 'disconnectRealtime', 'connect',
  ], {
    ws: socket, WebSocket: { OPEN: 1, CLOSED: 3 }, realtimeSessionGeneration: 1,
    realtimeStopRequested: false, continuitySaveBusy: false, continuitySaveHalted: false,
    conversationLines: ['KEEP THIS TRANSCRIPT'], brain2DeferredSurface: { mouthText: 'OLD' },
    disconnectButton: {}, startMicButton: {}, resetMicButton: {}, idlePonderNowButton: {},
    events: {}, log: (_, text) => calls.push(text), recordUiEvent: noop,
    beginIntentionalExitCleanup: noop, endIntentionalExitCleanupSoon: noop,
    haltRealtimeActivity: () => calls.push('halt'), setState: text => calls.push(text),
    updateTypedInputButtons: noop, updateSaveAndHaltButton: noop,
    runtimeStep: async (_, operation) => operation(), waitForRealtimeClose: async () => {},
    waitForPendingUserTranscriptBeforeSessionSave: async () => {}, micStream: {},
    stopVisionCamera: noop,
    stopMic: async () => { calls.push('stop mic'); c.micStream = null; },
    audioRecordingActive: () => false, audioRecordFinalizing: false, audioRecordStopPromise: null,
    recordExitPaneSnapshots: async () => {},
    clearInputDraft: noop, rememberConversationProsody: noop,
    recordUserTranscript: text => { c.conversationLines.push(text); return { accepted: true, index: 1 }; },
    queueAudioDelta: () => calls.push('BAD audio'), cueFaceMode: () => calls.push('BAD face'),
    handleFunctionCall: () => calls.push('BAD tool'),
    ...overrides,
  });
  return { c, calls };
}

test('failed Disconnect stops immediately, ignores late work, keeps transcript, and can retry saving', async () => {
  let rejectSave;
  const { c, calls } = stopContext({ saveEricContinuitySnapshot: () => new Promise((_, reject) => { rejectSave = reject; }) });
  const stopping = c.disconnectRealtime();
  assert.equal(c.realtimeConnected(), false);
  assert.equal(c.realtimeStopRequested, true);
  assert.equal(c.brain2DeferredSurface, null);
  assert.deepEqual(calls.slice(0, 4), ['response.cancel', 'halt', 'Stopped; saving', 'stop mic']);
  await new Promise(setImmediate);
  c.handleEvent({ type: 'response.output_audio.delta', delta: 'OLD_AUDIO' });
  c.handleEvent({ type: 'response.function_call_arguments.done', name: 'set_embodiment' });
  c.handleEvent({ type: 'response.done' });
  c.handleEvent({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'LAST WORDS' });
  c.send({ type: 'response.create' });
  rejectSave(new Error('Missing parent note'));
  await stopping;
  assert.equal(c.continuitySaveHalted, false);
  assert.equal(c.disconnectButton.disabled, false);
  assert.equal(c.continuitySaveBusy, false);
  assert.equal(c.realtimeConnected(), false);
  assert.deepEqual(Array.from(c.conversationLines), ['KEEP THIS TRANSCRIPT', 'LAST WORDS']);
  assert.ok(!calls.some(text => text.startsWith('BAD') || text === 'response.create' || text === 'close'));
  await c.connect();
  assert.ok(calls.some(text => text.startsWith('connect blocked:')));
  c.saveEricContinuitySnapshot = async () => ({ status: 'ok' });
  await c.disconnectRealtime();
  assert.equal(c.continuitySaveHalted, true);
  assert.ok(calls.includes('close'));
  assert.equal(c.realtimeStopRequested, true);
  assert.equal(calls.filter(text => text === 'response.cancel').length, 1);
});

test('an otherwise empty Disconnect waits for the final user transcription before deciding to save', async () => {
  let settle;
  let saves = 0;
  const { c } = stopContext({
    conversationLines: [], micStream: null,
    waitForPendingUserTranscriptBeforeSessionSave: () => new Promise(resolve => { settle = resolve; }),
    saveEricContinuitySnapshot: async () => { saves += 1; return { status: 'ok' }; },
  });
  const stopping = c.disconnectRealtime();
  c.handleEvent({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'LAST WORDS' });
  settle();
  await stopping;
  assert.equal(saves, 1);
});

test('first operator words after a silent start retain quiet work without inventing a previous turn', () => {
  const { c } = aloneContext();
  c.lastAcceptedUserTranscriptAt = 0;
  c.lastUserTurnActivityAt = 0;
  c.noteUserTurnActivity();
  assert.match(c.formatCompletedAloneInterval(), /no prior operator turn/);
  assert.match(c.formatCompletedAloneInterval(), /7 selected feed headlines/);
});

test('a session-map load cannot erase a stopped unsaved run', async () => {
  const c = load(['resetSessionContextForConnection'], {
    realtimeStopRequested: true, continuitySaveHalted: false, conversationLines: ['UNSAVED'],
  });
  await assert.rejects(c.resetSessionContextForConnection('Session Map'), /stopped session is not saved/);
  assert.deepEqual(Array.from(c.conversationLines), ['UNSAVED']);
});

test('audio already awaiting playback setup cannot start after Disconnect', async () => {
  let finish;
  const c = load(['playPcm16Bytes'], {
    realtimeSessionGeneration: 1, realtimeStopRequested: false,
    audioPlaybackGeneration: 0, pendingAudioPlaybacks: new Set(), assistantFinishPending: false,
    ensurePlayback: () => new Promise(resolve => { finish = resolve; }),
    pcm16ToFloat32: () => assert.fail('stopped audio must not reach the output graph'),
  });
  const pending = c.playPcm16Bytes(new Uint8Array());
  c.realtimeStopRequested = true;
  finish();
  await pending;
});

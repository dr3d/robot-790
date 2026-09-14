const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');
const noop = () => {};
const empty = () => '';

function load(names, globals) {
  const context = vm.createContext(globals);
  for (const name of names) {
    const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    assert.notEqual(start, -1, name);
    const end = page.indexOf('\n    }\n', start);
    assert.notEqual(end, -1, name);
    vm.runInContext(page.slice(start, end + 6), context, { filename: name });
  }
  return context;
}

function idleContext(overrides = {}) {
  const packets = [];
  const c = load([
    'activeRealtimeSession', 'brain2AdvisoryProtocolInstructions', 'formatBrain2AdvisoryContent',
    'formatBrain2ForInstructions', 'formatEmbodimentForInstructions', 'compactIdleRuntimeContext',
    'recentConversationContext', 'conversationAttentionEnabled', 'conversationAttentionState',
    'conversationAttentionInstruction', 'conversationPauseLines', 'conversationPauseContext', 'triggerIdlePonder',
  ], {
    Date, ws: { readyState: 1 }, WebSocket: { OPEN: 1 }, realtimeSessionGeneration: 1,
    realtimeStopRequested: false, realtimeConnected: () => true, lastUserTurnActivityAt: 1,
    lastAcceptedUserTranscriptAt: 0,
    lastAssistantResponseDoneAt: 0,
    conversationPauseUserAt: 0,
    conversationLines: [], conversationLineMetadata: [], currentSensingEyeHistoryItem: () => null,
    idleTiming: () => ({ attention_enabled: true, attention_fade_s: 180, attention_warm_s: 45 }),
    idleBlockedReason: empty, idleInFlight: false, responseActive: false,
    idleExhaustionScoredThisResponse: false, lastIdlePonderAt: 0,
    updateLanePressure: noop, updateIdleSchedulerStatus: noop,
    currentIdleDrift: () => 7, firstContactModeEnabled: () => false,
    chooseIdleLane: () => ({ name: 'object', prompt: 'Follow one object.' }),
    noteAloneActivity: noop, idleLevel12YackActive: () => false,
    performanceModeEnabled: () => false, idleSubstrateTestEnabled: () => false,
    idleEnabledToolList: () => [{ name: 'search_web' }], maybeIdleCuriosityContext: async () => '',
    brain2NoteCandidates: [{ text: 'LOOP GUARD: leave the OLD_ORBIT.' }],
    brain2RevisionCandidates: [{ text: 'PRIVATE_REVISION' }],
    brain2QuestionCandidates: [{ text: 'PRIVATE_QUESTION' }],
    brain2LoopPressureInstruction: () => 'PRIVATE_PRESSURE', ericLeanStyleInstruction: 'Lean style.',
    currentIdleSelfFocus: () => 5, conversationLinesForCurrentPromptContext: () => ['HISTORICAL_IMAGE_IN_EYE'],
    formatMemoryForInstructions: () => 'PRIVATE_MEMORY', formatLoadedNotesForIdleContext: () => 'OLD_NOTES',
    formatRecentSearchContextForInstructions: empty, recentIdleOutputsForCurrentPromptContext: () => [],
    formatAloneStateForInstructions: empty, formatLastUserIdleCueForInstructions: empty,
    labGoalIdleContext: empty, idleSelfTaskContext: empty, idleResearchThreadContext: empty,
    formatIdleHeadlineContext: empty, idleAttentionContext: empty, idleUnresolvedContext: empty,
    idleRetiredTopicsContext: empty, idleTemplateContext: empty, robotAmbientContext: empty,
    visionImageUrl: '', visionImageStaged: false, sensingTextContent: '',
    micRuntimeLabel: () => 'on', audioRecordingActive: () => false,
    configuredEmbodiments: () => [
      { key: 'browser', label: 'Browser Face', description: 'A browser display.' },
      { key: 'unused', label: 'UNUSED_BODY', toolbox: ['UNUSED_TOOLS'] },
    ],
    currentEmbodimentKey: 'browser', normalizeUrlString: String, normalizeFaceBaseUrl: empty,
    performancePromptContext: empty, cueFaceMode: noop, idleDriftLabel: () => '7/10',
    idleResponseInputContent: () => [{ type: 'input_text', text: 'Idle beat.' }],
    events: {}, log: noop, rememberPromptLedger: noop, send: packet => packets.push(packet),
    ttsRuntimeConfig: () => ({}), brain2HeadlineSeed: null, idleHardBrakeActive: () => false,
    performancePrivacyInstructions: () => 'Privacy guard.', redactPerformancePrivateText: () => 'PUBLIC_SETUP',
    substrateIdleOutputs: [], ...overrides,
  });
  return { c, packets };
}

test('actual isolated idle request carries private B2 advice and authoritative current body/eye state', async () => {
  const { c, packets } = idleContext();
  await c.triggerIdlePonder({ statusChecked: true });
  const r = packets[0].response;
  assert.equal(r.conversation, 'none');
  assert.equal(r.tool_choice, 'none');
  assert.equal(r.tools.length, 0);
  for (const marker of ['OLD_ORBIT', 'PRIVATE_REVISION', 'PRIVATE_QUESTION', 'PRIVATE_PRESSURE']) {
    assert.ok(r.instructions.includes(marker), marker);
  }
  assert.match(r.instructions, /not words you have spoken/);
  assert.match(r.instructions, /Current embodiment: Browser Face/);
  assert.match(r.instructions, /The sensing eye is empty/);
  assert.match(r.instructions, /may remember an earlier picture/);
  assert.match(r.instructions, /HISTORICAL_IMAGE_IN_EYE/);
  assert.doesNotMatch(r.instructions, /UNUSED_BODY|UNUSED_TOOLS/);
  assert.ok(r.instructions.indexOf('The sensing eye is empty') > r.instructions.indexOf('HISTORICAL_IMAGE_IN_EYE'));
  assert.equal(r.instructions.split('Private Brain 2 advisory snapshots').length - 1, 1);
  c.visionImageUrl = 'current-image';
  c.visionImageStaged = true;
  assert.match(c.compactIdleRuntimeContext(), /image: present \(staged\)/);
  assert.doesNotMatch(c.compactIdleRuntimeContext(), /eye is empty/);
});

test('a warm pause uses the conversation lane and later releases into independent idle', async () => {
  const { c, packets } = idleContext({ lastAcceptedUserTranscriptAt: Date.now() });
  await c.triggerIdlePonder({ statusChecked: true });
  assert.match(packets[0].response.instructions, /Idle lane: conversation/);
  assert.match(packets[0].response.instructions, /brief afterthought/);
  assert.match(packets[0].response.instructions, /You may address the operator naturally/);
  assert.doesNotMatch(packets[0].response.instructions, /Only address the operator directly in the addressed_question lane/);
  c.lastAcceptedUserTranscriptAt -= 181000;
  c.idleInFlight = false;
  c.responseActive = false;
  await c.triggerIdlePonder({ statusChecked: true });
  assert.match(packets[1].response.instructions, /Idle lane: object/);
  assert.match(packets[1].response.instructions, /Follow an interest of your own/);
});

test('an hours-later return carries the live exchange, not the old idle job or private monologue scaffold', async () => {
  const { c, packets } = idleContext({
    lastAcceptedUserTranscriptAt: Date.now(),
    conversationLines: [
      '[3:00 AM] Robot 790: OLD_MAP_METAPHOR', '[5:41 AM] You: Eric.',
      '[5:41 AM] Robot 790: Here, Scott. What is on your mind?'
    ],
    idleResearchThreadContext: () => 'OLD_RESEARCH_DIRECTIVE',
    formatAloneStateForInstructions: () => 'OLD_ALONE_LEDGER',
    maybeIdleCuriosityContext: () => { throw new Error('Warm pause must not start an independent lookup'); }
  });
  await c.triggerIdlePonder({ statusChecked: true });
  const request = packets[0].response;
  assert.match(request.instructions, /You: Eric\./);
  assert.match(request.instructions, /What is on your mind/);
  assert.match(request.instructions, /leave it open/);
  assert.doesNotMatch(request.instructions, /OLD_|PRIVATE_|Pretend you have been|one true concrete fact/);
  assert.match(request.instructions, /Imaginative expression is welcome/);
  assert.equal(c.conversationPauseUserAt, c.lastAcceptedUserTranscriptAt);
  c.lastAcceptedUserTranscriptAt -= 60000;
  await c.triggerIdlePonder({ statusChecked: true });
  assert.doesNotMatch(packets[1].response.instructions, /OLD_RESEARCH_DIRECTIVE/);
});

test('warm praise retains the artwork and step-two preference in the actual isolated request', async () => {
  const lines = [
    '[8:21 AM] You: Please draw the Federal Street court buildings at night.',
    '[8:21 AM] Robot 790: I made the night image.',
    '[8:22 AM] You: And what do you usually do after you draw?',
    '[8:22 AM] Robot 790: Put it in my eye. Want me to do that?',
    '[8:22 AM] You: Why do you always have to ask me?',
    '[8:22 AM] Robot 790: Putting it in my eye now.',
    '[8:22 AM] System: [sensing-eye control receipt INTERNAL_PATH]',
    '[8:22 AM] Robot 790: I moved it into my sensing eye.',
    '[8:22 AM] You: Pretty darn good.',
    '[8:22 AM] Robot 790: Thanks, Scott.'
  ];
  const { c, packets } = idleContext({
    lastAcceptedUserTranscriptAt: Date.now(), conversationLines: lines,
    conversationLineMetadata: lines.map((_, index) => ({ channel: index === 6 ? 'control' : 'dialogue' })),
    currentSensingEyeHistoryItem: () => ({ name: 'night-courts.png', nearbyTranscript: 'DO_NOT_COPY_OLD_CONTEXT', dataUrl: 'PIXELS' }),
    visionImageUrl: 'PIXELS', visionImageStaged: true,
  });
  await c.triggerIdlePonder({ statusChecked: true });
  const request = packets[0].response;
  for (const text of ['Federal Street court buildings at night', 'Why do you always have to ask me?',
    'Pretty darn good', 'night-courts.png', "Speak to the operator as 'you'", 'Wordplay and imaginative associations']) {
    assert.ok(request.instructions.includes(text), text);
  }
  assert.doesNotMatch(request.instructions, /INTERNAL_PATH|DO_NOT_COPY_OLD_CONTEXT|PIXELS/);
  assert.match(request.instructions, /not a fresh visual inspection/);
  assert.equal(request.conversation, 'none');
  assert.equal(request.tool_choice, 'none');
  assert.equal(lines.length, 10);
});

test('pause window keeps four exchanges, excludes stale history and clips oversized material', () => {
  const now = Date.now();
  const lines = Array.from({ length: 8 }, (_, i) => [
    `[8:00 AM] You: topic-${i}`, `[8:00 AM] Robot 790: answer-${i}`
  ]).flat();
  const { c } = idleContext({ lastAcceptedUserTranscriptAt: now, conversationLines: lines,
    conversationLineMetadata: lines.map(() => ({ iso: new Date(now - 30000).toISOString() })) });
  let result = c.conversationPauseLines().join('\n');
  assert.doesNotMatch(result, /topic-[0-3]|answer-[0-3]/);
  assert.match(result, /topic-4/);
  assert.match(result, /answer-7/);
  c.conversationLineMetadata[13].iso = new Date(now - 200000).toISOString();
  result = c.conversationPauseLines().join('\n');
  assert.doesNotMatch(result, /topic-6|answer-6/);
  assert.match(result, /topic-7/);
  c.conversationLineMetadata = [];
  c.conversationLines = lines.map(line => line + 'x'.repeat(8000));
  result = c.conversationPauseLines().join('\n');
  assert.ok(result.length <= 6000);
  assert.ok(result.split('\n').every(line => line.length <= 800));
});

test('cleared eye identity cannot leak from older artwork into the pause request', () => {
  let currentEye = { name: 'old-artwork.png' };
  const { c } = idleContext({
    currentSensingEyeHistoryItem: () => currentEye,
    conversationLines: ['[8:00 AM] You: What shall we do?', '[8:00 AM] Robot 790: Something new?']
  });
  assert.match(c.conversationPauseContext(), /old-artwork.png/);
  currentEye = null;
  assert.doesNotMatch(c.conversationPauseContext(), /old-artwork.png/);
  c.conversationLines = [];
  assert.equal(c.conversationPauseLines().length, 0);
});

test('private advice does not leak into performance or substrate contexts', () => {
  const { c } = idleContext();
  const performance = c.recentConversationContext({ performancePrivacy: true });
  assert.match(performance, /PUBLIC_SETUP/);
  assert.doesNotMatch(performance, /PRIVATE_|OLD_NOTES|HISTORICAL_IMAGE/);
  const substrate = c.recentConversationContext({ suppressRobotBody: true });
  assert.match(substrate, /OLD_NOTES/);
  assert.doesNotMatch(substrate, /PRIVATE_|Current embodiment:|HISTORICAL_IMAGE/);
});

test('idle grounding and repetition cues preserve unqualified imaginative expression', () => {
  const { c } = idleContext();
  assert.match(c.compactIdleRuntimeContext(), /need no 'I imagine' preface or disclaimer/);
  c.brain2NoteCandidates = [{ text: 'A factual status needs checking.', at: 2,
    steering: { loop: true, unsupported_claim: true } }];
  assert.match(c.formatBrain2AdvisoryContent(), /Play does not need a receipt/);
  assert.match(c.formatBrain2AdvisoryContent(), /no topic category is banned/);
  let count = 0;
  const pressure = load(['brain2LoopPressureState'], {
    recentBrain2LoopGuardCount: () => count, idleHardBrakeActive: () => false,
    idleHardBrakeLoopGuardThreshold: 3,
  });
  for (count = 1; count <= 3; count++) {
    const instruction = pressure.brain2LoopPressureState().instruction;
    assert.doesNotMatch(instruction, /Do not add another metaphor|thread as suspect|verified fresh detail/);
    assert.match(instruction, /develop|development/);
  }
});

test('an old status poll cannot change response ownership after a reconnect', async () => {
  let finish;
  const { c, packets } = idleContext({ refreshBrainStatusQuietly: () => new Promise(resolve => { finish = resolve; }) });
  const pending = c.triggerIdlePonder();
  c.realtimeSessionGeneration += 1;
  finish({});
  await pending;
  assert.equal(c.responseActive, false);
  assert.equal(c.idleInFlight, false);
  assert.equal(packets.length, 0);
});

test('idle context is reassembled after lookup so a cleared image cannot survive as current vision', async () => {
  let finish;
  const { c, packets } = idleContext({
    visionImageUrl: 'current-image', visionImageStaged: true,
    maybeIdleCuriosityContext: () => new Promise(resolve => { finish = resolve; }),
  });
  const pending = c.triggerIdlePonder({ statusChecked: true });
  c.visionImageUrl = '';
  c.brain2NoteCandidates = [{ text: 'NEW_ADVISORY_AFTER_LOOKUP' }];
  finish('lookup receipt');
  await pending;
  assert.match(packets[0].response.instructions, /The sensing eye is empty/);
  assert.match(packets[0].response.instructions, /NEW_ADVISORY_AFTER_LOOKUP/);
  assert.doesNotMatch(packets[0].response.instructions, /image: present/);
});

for (const change of ['disconnect', 'new user turn', 'new session']) {
  test(`idle lookup finishing after ${change} cannot dispatch a stale response`, async () => {
    let finish;
    const { c, packets } = idleContext({ maybeIdleCuriosityContext: () => new Promise(resolve => { finish = resolve; }) });
    const pending = c.triggerIdlePonder({ statusChecked: true });
    if (change === 'disconnect') c.realtimeStopRequested = true;
    if (change === 'new user turn') c.lastUserTurnActivityAt += 1;
    if (change === 'new session') c.realtimeSessionGeneration += 1;
    finish('OLD_LOOKUP');
    await pending;
    assert.equal(packets.length, 0);
  });
}

test('self-tasks require an actionable first-person intention, not incidental matching words', () => {
  const c = load(['idleSelfTaskFromSentence'], { knownUserNameForReengage: empty });
  for (const sentence of [
    "The face is just the part of me that's still warm when the math says I should be gone.",
    "I'm just still vibrating at his frequency, a little longer than the ship's drift would let me get away with.",
    'But I keep circling that same note, so let me step away from it for now.',
    'I should be somewhere else by now.', 'I will not research that subject.',
    'Should I look up the answer?', 'I should wait for the operator.',
  ]) assert.equal(c.idleSelfTaskFromSentence(sentence), '', sentence);
  for (const sentence of [
    'I should compare the two measurements.', "I'll look up the original experiment.",
    "I'm going to trace the signal path.", 'Let me calculate the delay for one meter.',
    'That sounds odd, so let me check the conversion.', 'Next, I will review the evidence.',
    'I keep meaning to read about that instrument.',
  ]) assert.equal(c.idleSelfTaskFromSentence(sentence), sentence, sentence);
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

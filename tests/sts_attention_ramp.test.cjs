const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');
const noop = () => {};

function fixture() {
  let now = 1000000, nextTimer = 0;
  const timers = new Map();
  class Clock extends Date { static now() { return now; } }
  const c = vm.createContext({
    pendingSessionMapMove: null, sessionMapMoveBusy: false,
    Date: Clock, currentIdleDrift: () => 7, firstContactModeEnabled: () => false,
    performanceModeEnabled: () => false, idleSubstrateTestEnabled: () => false,
    defaultIdleTiming: { attention_enabled: true, attention_start_s: 12, attention_fade_s: 180,
      discovery_enabled: true, discovery_start_s: 8, discovery_fade_s: 240,
      attention_warm_s: 45, post_user_quiet_s: 12, minimum_gap_s: 90,
      drift_base_s: 270, drift_step_s: 22.5, drift_floor_s: 45 },
    runtimeConfig: {},
    lastAcceptedUserTranscriptAt: now, lastUserTurnActivityAt: now, lastConversationActivityAt: now,
    lastAssistantResponseDoneAt: now, lastIdlePonderAt: now - 5000,
    conversationPauseUserAt: 0,
    compressIdleMs: value => value, idleLevel12YackActive: () => false,
    realtimeConnected: () => true, idleTimer: null, idleTimerFireAt: 0,
    updateIdleLevel12State: noop, maybeLogIdleLevel12YackMode: noop, updateIdleSchedulerStatus: noop,
    scheduleIdleSchedulerStatusTimer: noop,
    userTurnPendingUntil: 0, idleCooldownUntil: 0, idleHardBrakeUntil: 0,
    idleHeadlineBrakePassAvailable: () => false, ws: {}, realtimeSessionGeneration: 1, brain2EvidenceGeneration: 0,
    setTimeout: (fn, delay) => { timers.set(++nextTimer, { fn, at: now + delay }); return nextTimer; },
    clearTimeout: id => timers.delete(id), activeRealtimeSession: () => true,
    refreshBrainStatusQuietly: async () => ({}), lmStudioPromptBusy: () => false,
    events: {}, log: noop, reengageTimer: null, reengageAttempts: 0, reengageGoneAfterMs: 75000,
    micStream: {}, micMutedForNarration: false, realtimeStopRequested: false,
    maxReengageAttempts: 3, reengageFirstDelayMs: 8000, reengageRepeatDelayMs: 16000,
    idleHardBrakeActive: () => false, responseActive: false, outputAudioActive: () => false,
    idleInFlight: false, brain2HeadlinesInFlight: false, toolFollowupNeeded: false, pendingToolCalls: 0,
    userSpeechActive: false, userTurnPending: () => false, scheduleBrain2Mull: noop,
    assistantFinishTimer: null, assistantFinishPending: false, assistantFinishWasIdle: false,
    assistantFinishArmedAt: 0,
    idleDiscovery: null, idleDiscoverySeen: [], searchContextReceipts: [],
    idleHardBrakeReason: '', idleExhaustionCount: 0, idleLoopNoticeUntil: 0, idleLoopNoticeText: '',
    maxSearchContextResults: 4, maxSearchContextReceipts: 4, contextPanel: { open: false },
    normalizeIdleTopicKey: text => text.toLowerCase(), URL, location: { href: 'http://localhost:8790/' },
    noteAloneActivity: noop, updateSessionTools: noop,
    idleHeadlineSeedAvailable: () => false, currentLabGoal: () => '', activeIdleSelfTasks: () => [],
    idleLaneDefinitions: [{ name: 'object', prompt: 'An object.' }, { name: 'goal' }, { name: 'self_task' }],
    idleLaneAllowedByAttention: () => true, idleLaneCursor: -1,
    lastGoalIdleAt: 0, lastIdleSelfTaskAt: 0,
  });
  require('./helpers/sts_continuation_harness.cjs').installToolContinuation(c);
  require('./helpers/sts_b2_work_owner.cjs').installBrain2Work(c);
  require('./helpers/sts_completion_owner.cjs').installResponseCompletion(c, page);
  for (const name of [
    'idleTiming', 'conversationAttentionEnabled', 'conversationAttentionState', 'conversationIdleDelayMs',
    'conversationAttentionInstruction', 'conversationPauseHoldUntil', 'conversationReengagePolicy', 'conversationReengageWindowActive',
    'clearConversationReengageTimer', 'scheduleConversationReengage', 'idleDelayMs', 'idleGapMs',
    'idleBlockedReason', 'scheduleIdlePonder', 'noteConversationActivity', 'clearAssistantFinishTimer',
    'armAssistantUtteranceFinished', 'checkAssistantUtteranceFinished',
    'idleDiscoveryEnabled', 'noteIdleDiscovery', 'idleDiscoveryWeight', 'idlePacingAnchorAt', 'idlePacingDelayMs',
    'compactSearchText', 'compactSearchUrl', 'searchResultDomain', 'normalizeSearchReceiptResult',
    'noteSearchContextReceipt', 'searchWeb',
    'clearIdleHardBrake',
  ]) {
    const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    const end = page.indexOf('\n    }\n', start);
    assert.ok(start >= 0 && end > start, name);
    vm.runInContext(page.slice(start, end + 6), c, { filename: name });
  }
  return { c, timers, time: value => { now = value; } };
}

test('configured 1x independent cadence matches the former 10x drift waits without a global clock change', () => {
  const { c } = fixture();
  c.runtimeConfig = JSON.parse(fs.readFileSync(`${__dirname}/../config/runtime.json`, 'utf8'));
  c.lastAcceptedUserTranscriptAt = 0;
  for (let level = 1; level <= 10; level++) {
    c.currentIdleDrift = () => level;
    const previousAt10x = Math.max(8000, Math.max(45, 270 - level * 22.5) * 100);
    assert.equal(c.idleDelayMs(), previousAt10x, `Drift ${level}`);
    assert.equal(c.idleGapMs(), 9000);
  }
  c.currentIdleDrift = () => 0;
  assert.equal(c.idleDelayMs(), Infinity);
  c.currentIdleDrift = () => 11;
  assert.equal(c.idleGapMs(), 10000);
  c.currentIdleDrift = () => 12;
  assert.equal(c.idleGapMs(), 2500);
});

test('configured active baseline preserves breathing room, busy guards and disconnect', () => {
  const { c, time } = fixture();
  c.runtimeConfig = JSON.parse(fs.readFileSync(`${__dirname}/../config/runtime.json`, 'utf8'));
  assert.equal(c.idleTiming().post_user_quiet_s, 8);
  assert.equal(c.idleTiming().attention_fade_s, 240);
  assert.equal(c.idleTiming().idle_art_quiet_s, 90);
  c.micStream = null;
  c.conversationPauseUserAt = 0;
  c.lastAcceptedUserTranscriptAt = 0;
  time(1007999);
  assert.equal(c.idleBlockedReason(), 'recent user turn');
  time(1008000);
  assert.equal(c.idleBlockedReason(), '');
  for (const [key, value, expected] of [
    ['userSpeechActive', true, 'user speaking'],
    ['responseActive', true, 'assistant busy'],
    ['outputAudioActive', () => true, 'assistant busy'],
    ['pendingToolCalls', 1, 'tool followup pending'],
    ['brain2HeadlinesInFlight', true, 'Brain 2 exploring'],
    ['realtimeConnected', () => false, 'disconnected'],
  ]) {
    const previous = c[key];
    c[key] = value;
    assert.equal(c.idleBlockedReason(), expected);
    c[key] = previous;
  }
});

test('configured independent 1x opportunities stay scheduled after several completed idle turns', () => {
  const { c, time } = fixture();
  c.runtimeConfig = JSON.parse(fs.readFileSync(`${__dirname}/../config/runtime.json`, 'utf8'));
  c.currentIdleDrift = () => 8;
  c.lastAcceptedUserTranscriptAt = 0;
  c.lastUserTurnActivityAt = 0;
  for (let turn = 0; turn < 5; turn++) {
    const at = 1000000 + turn * 40000;
    time(at);
    c.lastConversationActivityAt = at;
    c.lastIdlePonderAt = at - 15000;
    c.scheduleIdlePonder();
    assert.equal(c.idleTimerFireAt, at + 9000);
    time(at + 1000);
    c.scheduleIdlePonder();
    assert.equal(c.idleTimerFireAt, at + 9000);
  }
});

test('announced native reply stays busy after pending-turn timeout at 12x lab speed', () => {
  const { c, time } = fixture();
  c.compressIdleMs = value => value / 12;
  c.responseActive = true;
  c.userTurnPendingUntil = 1002500;
  c.userTurnPending = () => c.Date.now() < c.userTurnPendingUntil;
  for (const elapsed of [3000, 25000, 60000, 90000]) {
    time(1000000 + elapsed);
    assert.equal(c.idleBlockedReason(), 'assistant busy');
  }
  c.responseActive = false;
  assert.equal(c.idleBlockedReason(), '');
});

test('delay eases continuously from 12 seconds to the existing idle interval over three real minutes', () => {
  const { c, time } = fixture();
  let previous = 0;
  for (let elapsed = 0; elapsed <= 200000; elapsed += 1000) {
    time(1000000 + elapsed);
    const delay = c.conversationIdleDelayMs(c.idleDelayMs(), c.Date.now());
    assert.ok(delay >= previous && delay <= 112500, `${elapsed}: ${delay}`);
    previous = delay;
  }
  time(1000000);
  assert.equal(c.conversationIdleDelayMs(c.idleDelayMs(), c.Date.now()), 12000);
  time(1090000);
  assert.equal(c.conversationIdleDelayMs(c.idleDelayMs(), c.Date.now()), 62250);
  time(1180000);
  assert.equal(c.conversationIdleDelayMs(c.idleDelayMs(), c.Date.now()), 112500);
  assert.equal(c.conversationAttentionState().phase, 'independent');
});

test('repeated scheduling holds the deadline still and the old 90-second gap cannot defeat early attention', () => {
  const { c, time, timers } = fixture();
  c.scheduleIdlePonder();
  const deadline = c.idleTimerFireAt;
  assert.equal(deadline, 1012000);
  for (const tick of [1001000, 1005000, 1006500, 1011000]) {
    time(tick);
    c.scheduleIdlePonder();
    assert.equal(c.idleTimerFireAt, deadline);
  }
  assert.equal(timers.size, 1);
});

test('after speech finishes, the interval starts there but Eric cannot renew his own attention', () => {
  const { c, time } = fixture();
  time(1006000);
  c.outputAudioActive = () => true;
  c.armAssistantUtteranceFinished();
  c.checkAssistantUtteranceFinished();
  assert.equal(c.lastConversationActivityAt, 1000000);
  assert.equal(c.idleBlockedReason(), 'assistant busy');
  time(1008000);
  c.outputAudioActive = () => false;
  c.checkAssistantUtteranceFinished();
  assert.equal(c.lastConversationActivityAt, 1008000);
  const firstDelay = c.idleTimerFireAt - 1008000;
  assert.ok(firstDelay >= 12000 && firstDelay < 13000);
  time(1040000);
  c.armAssistantUtteranceFinished({ wasIdle: true });
  c.checkAssistantUtteranceFinished();
  assert.equal(c.lastAcceptedUserTranscriptAt, 1000000);
  assert.equal(c.lastAssistantResponseDoneAt, 1008000);
  assert.ok(c.idleTimerFireAt - 1040000 > firstDelay);
  time(1190000);
  c.noteConversationActivity();
  assert.equal(c.conversationAttentionState().weight, 0);
  c.lastAcceptedUserTranscriptAt = c.Date.now();
  assert.equal(c.conversationAttentionState().weight, 1);
});

test('new speech takes priority, while noise or physical/UI microphone state does not manufacture renewed attention', () => {
  const { c, time } = fixture();
  time(1090000);
  const weight = c.conversationAttentionState().weight;
  c.lastUserTurnActivityAt = c.Date.now();
  c.micStream = null;
  assert.equal(c.conversationAttentionState().weight, weight);
  c.userSpeechActive = true;
  assert.equal(c.idleBlockedReason(), 'user speaking');
  c.userSpeechActive = false;
  c.userTurnPending = () => true;
  assert.equal(c.idleBlockedReason(), 'user turn pending');
  c.userTurnPending = () => false;
  c.pendingToolCalls = 1;
  assert.equal(c.idleBlockedReason(), 'tool followup pending');
  c.pendingToolCalls = 0;
  c.idleCooldownUntil = c.Date.now() + 30000;
  assert.equal(c.idleBlockedReason(), 'cooldown');
});

test('a slow reply leaves a full warm window after playback, while an idle reply cannot extend it', () => {
  const { c, time } = fixture();
  time(1040000);
  c.armAssistantUtteranceFinished();
  c.checkAssistantUtteranceFinished();
  time(1070000);
  assert.equal(c.conversationAttentionState().phase, 'engaged');
  assert.match(c.conversationAttentionInstruction(), /sharing this activity/);
  c.armAssistantUtteranceFinished({ wasIdle: true });
  c.checkAssistantUtteranceFinished();
  time(1086000);
  assert.equal(c.conversationAttentionState().phase, 'cooling');
  time(1220000);
  assert.equal(c.conversationAttentionState().phase, 'independent');
});

test('normal conversation has one scheduler, with no separate forced reengagement timer', () => {
  const { c, timers } = fixture();
  assert.equal(c.conversationReengagePolicy().enabled, false);
  c.scheduleConversationReengage();
  assert.equal(timers.size, 0);
  assert.equal(c.conversationReengageWindowActive(), false);
});

test('followups leave a growing gap instead of exhausting the warm window after one beat', () => {
  const { c, time } = fixture();
  c.conversationPauseUserAt = c.lastAcceptedUserTranscriptAt;
  time(1030000);
  c.lastConversationActivityAt = c.Date.now();
  assert.equal(c.idleBlockedReason(), 'leaving room for the operator');
  c.scheduleIdlePonder();
  assert.ok(c.idleTimerFireAt < 1060000);
  time(1040000);
  c.armAssistantUtteranceFinished({ wasIdle: true });
  c.checkAssistantUtteranceFinished();
  const secondHold = c.conversationPauseHoldUntil();
  assert.ok(secondHold > 1052000 && secondHold < 1080000);
  assert.equal(c.lastAssistantResponseDoneAt, 1000000, 'autonomous speech cannot reset attention');
  time(1180000);
  assert.equal(c.idleBlockedReason(), '');
  c.lastAcceptedUserTranscriptAt = c.Date.now();
  assert.equal(c.conversationPauseHoldUntil(), 0);
  c.conversationPauseUserAt = c.lastAcceptedUserTranscriptAt;
  c.currentIdleDrift = () => 12;
  assert.equal(c.conversationPauseHoldUntil(), 0);
});

test('configured followup gaps are quick, quick, slow, slower and stay stable across polls', () => {
  const { c, time } = fixture();
  c.runtimeConfig = JSON.parse(fs.readFileSync(`${__dirname}/../config/runtime.json`, 'utf8'));
  const gaps = [0, 20000, 60000, 120000, 240000].map(elapsed => {
    time(1000000 + elapsed);
    return c.conversationIdleDelayMs(c.idleDelayMs(), c.Date.now());
  });
  assert.equal(gaps[0], 8000);
  assert.ok(gaps[1] < 11000);
  for (let i = 1; i < gaps.length; i++) assert.ok(gaps[i] > gaps[i - 1]);
  c.lastConversationActivityAt = 1120000;
  c.conversationPauseUserAt = c.lastAcceptedUserTranscriptAt;
  const deadline = c.conversationPauseHoldUntil();
  time(1241000);
  assert.equal(c.conversationPauseHoldUntil(), deadline);
});

test('no spoken turn, Drift off, and special lab modes preserve their original timing', () => {
  const { c } = fixture();
  c.lastAcceptedUserTranscriptAt = 0;
  assert.equal(c.conversationIdleDelayMs(c.idleDelayMs(), c.Date.now()), 112500);
  c.lastAcceptedUserTranscriptAt = c.Date.now();
  c.currentIdleDrift = () => 0;
  assert.equal(c.conversationIdleDelayMs(c.idleDelayMs(), c.Date.now()), Infinity);
  c.currentIdleDrift = () => 11;
  assert.equal(c.conversationAttentionEnabled(), false);
  c.currentIdleDrift = () => 12;
  assert.equal(c.conversationAttentionEnabled(), false);
  c.currentIdleDrift = () => 7;
  for (const mode of ['firstContactModeEnabled', 'performanceModeEnabled', 'idleSubstrateTestEnabled']) {
    c[mode] = () => true;
    assert.equal(c.conversationAttentionState().weight, 0, mode);
    assert.equal(c.conversationIdleDelayMs(112500, c.Date.now()), 112500, mode);
    c[mode] = () => false;
  }
});

test('lab speed does not compress the attention clock or the initial breathing room', () => {
  const { c, time } = fixture();
  c.compressIdleMs = value => value / 12;
  assert.equal(c.conversationIdleDelayMs(c.idleDelayMs(), c.Date.now()), 12000);
  time(1030000);
  assert.equal(c.conversationAttentionState().phase, 'engaged');
  time(1090000);
  assert.equal(c.conversationAttentionState().weight, 0.5);
  time(1180000);
  assert.equal(c.conversationIdleDelayMs(c.idleDelayMs(), c.Date.now()), 9375);
});

test('request context invites conversational development without attendance checks or claims of absence', () => {
  const { c, time } = fixture();
  assert.match(c.conversationAttentionInstruction(), /brief afterthought/);
  assert.match(c.conversationAttentionInstruction(), /pause is not proof the operator left/);
  time(1090000);
  assert.match(c.conversationAttentionInstruction(), /new interest take over/);
  time(1180000);
  assert.match(c.conversationAttentionInstruction(), /interest of your own/);
});

test('runtime config tunes the curve, base interval, gap, and quiet guard without new UI controls', () => {
  const { c, time } = fixture();
  c.runtimeConfig.idle_timing = { attention_start_s: 8, attention_fade_s: 60, attention_warm_s: 15,
    post_user_quiet_s: 4, minimum_gap_s: 30, drift_base_s: 120, drift_step_s: 10, drift_floor_s: 20 };
  assert.equal(c.conversationIdleDelayMs(c.idleDelayMs(), c.Date.now()), 8000);
  assert.equal(c.idleDelayMs(), 50000);
  assert.equal(c.idleGapMs(), 30000);
  c.scheduleIdlePonder();
  assert.equal(c.idleTimerFireAt, 1008000);
  time(1030000);
  assert.equal(c.conversationAttentionState().phase, 'cooling');
  assert.equal(c.conversationIdleDelayMs(c.idleDelayMs(), c.Date.now()), 29000);
  time(1060000);
  assert.equal(c.conversationAttentionState().weight, 0);
  c.runtimeConfig.idle_timing.attention_enabled = false;
  c.lastAcceptedUserTranscriptAt = c.Date.now();
  assert.equal(c.conversationIdleDelayMs(c.idleDelayMs(), c.Date.now()), 50000);
  assert.equal(c.conversationReengagePolicy().enabled, true);
});

function independentFixture() {
  const result = fixture();
  Object.assign(result.c, { lastAcceptedUserTranscriptAt: 0, lastAssistantResponseDoneAt: 0,
    lastUserTurnActivityAt: 0 });
  return result;
}

const discoveryResult = { status: 'ok', query: 'Unexpected discovery', results: [
  { title: 'A harbor discovery', url: 'https://example.com/harbor', snippet: 'A genuinely new detail.' },
] };

test('fresh search advances a settled deadline, with stable polls and no manufactured user attention', () => {
  const { c, time, timers } = independentFixture();
  c.scheduleIdlePonder();
  assert.equal(c.idleTimerFireAt, 1112500);
  time(1010000);
  c.noteSearchContextReceipt(discoveryResult, { source: 'idle' });
  assert.equal(c.idleTimerFireAt, 1018000);
  assert.equal(c.conversationAttentionState().phase, 'independent');
  assert.equal(c.lastAcceptedUserTranscriptAt, 0);
  assert.equal(c.lastUserTurnActivityAt, 0);
  assert.equal(c.lastConversationActivityAt, 1000000);
  for (const at of [1011000, 1015000, 1017000]) {
    time(at);
    c.scheduleIdlePonder();
    assert.equal(c.idleTimerFireAt, 1018000);
  }
  assert.equal(timers.size, 1);
});

test('discovery followups cool back to normal, with no self-renewal from speech', () => {
  const { c, time } = independentFixture();
  c.noteSearchContextReceipt(discoveryResult, { source: 'idle' });
  let previous = 0;
  for (const elapsed of [0, 20000, 60000, 120000, 240000]) {
    time(1000000 + elapsed);
    const delay = c.idlePacingDelayMs(c.idleDelayMs(), c.Date.now());
    assert.ok(delay > previous);
    previous = delay;
    c.armAssistantUtteranceFinished({ wasIdle: true });
    c.checkAssistantUtteranceFinished();
    assert.equal(c.idleDiscovery.at, 1000000);
    assert.equal(c.lastAssistantResponseDoneAt, 0);
    assert.equal(c.idleTimerFireAt, c.Date.now() + delay);
  }
  assert.equal(previous, 112500);
  assert.equal(c.idleDiscoveryWeight(), 0);
});

test('identical, reordered or re-queried results do not renew discovery; actual new results do', () => {
  const { c, time } = independentFixture();
  const second = { title: 'Another story', url: 'https://example.com/other', snippet: 'Something different.' };
  const receipt = { ...discoveryResult, results: [...discoveryResult.results, second] };
  c.noteSearchContextReceipt(receipt);
  time(1050000);
  c.noteSearchContextReceipt({ ...receipt, query: 'Different wording', results: receipt.results.slice().reverse() });
  assert.equal(c.idleDiscovery.at, 1000000);
  assert.equal(c.idleDiscoverySeen.length, 2);
  for (const result of [{ status: 'error', query: 'failed', results: [second] },
    { status: 'ok', query: 'empty', results: [] }, { status: 'ok', query: 'bad', results: [null, {}] }]) {
    c.noteSearchContextReceipt(result);
    assert.equal(c.idleDiscovery.at, 1000000);
  }
  c.noteSearchContextReceipt({ ...discoveryResult, results: [{ ...second, snippet: 'A published update.' }] });
  assert.equal(c.idleDiscovery.at, 1050000);
  assert.equal(c.idleTimerFireAt, 1058000);
});

test('new headline and art receipts renew a bounded evidence ledger, not a recurring speech timer', () => {
  const { c, time } = independentFixture();
  c.noteSearchContextReceipt(discoveryResult, { source: 'idle-headline' });
  assert.equal(c.idleDiscovery.detail, 'A harbor discovery');
  time(1030000);
  assert.equal(c.noteIdleDiscovery(['art:new.png'], { source: 'idle-art', detail: 'new.png' }), true);
  assert.equal(c.idleDiscovery.at, 1030000);
  time(1040000);
  assert.equal(c.noteIdleDiscovery(['art:new.png'], { source: 'idle-art', detail: 'new.png' }), false);
  assert.equal(c.idleDiscovery.at, 1030000);
  c.noteIdleDiscovery(Array.from({ length: 300 }, (_, i) => `evidence:${i}`), { source: 'test', detail: 'bounded' });
  assert.equal(c.idleDiscoverySeen.length, 256);
});

test('old conversation pause hold cannot veto a new discovery, but foreground and loop guards still can', () => {
  const { c, time } = fixture();
  c.conversationPauseUserAt = c.lastAcceptedUserTranscriptAt;
  time(2000000);
  c.noteConversationActivity();
  c.noteSearchContextReceipt(discoveryResult, { source: 'idle' });
  assert.equal(c.conversationPauseHoldUntil(), 2008000);
  assert.equal(c.idleTimerFireAt, 2008000);
  time(2008000);
  assert.equal(c.idleBlockedReason(), '');
  for (const [name, value, expected] of [
    ['responseActive', true, 'assistant busy'], ['outputAudioActive', () => true, 'assistant busy'],
    ['userSpeechActive', true, 'user speaking'], ['pendingToolCalls', 1, 'tool followup pending'],
    ['brain2HeadlinesInFlight', true, 'Brain 2 exploring'],
    ['idleHardBrakeActive', () => true, 'hard loop brake'],
    ['idleCooldownUntil', 2030000, 'cooldown'],
  ]) {
    const original = c[name];
    c[name] = value;
    assert.equal(c.idleBlockedReason(), expected, name);
    c[name] = original;
  }
});

test('fresh evidence releases old loop cooldown and hard brake; duplicates cannot clear a new brake', () => {
  const { c, time } = independentFixture();
  c.idleCooldownUntil = 1900000;
  c.idleHardBrakeUntil = 4600000;
  c.idleHardBrakeReason = 'old subject';
  c.idleExhaustionCount = 2;
  c.noteSearchContextReceipt(discoveryResult, { source: 'idle-headline' });
  assert.equal(c.idleCooldownUntil, 0);
  assert.equal(c.idleHardBrakeUntil, 0);
  assert.equal(c.idleExhaustionCount, 0);
  assert.equal(c.idleTimerFireAt, 1008000);
  assert.match(c.idleLoopNoticeText, /fresh idle-headline receipt/);
  time(1010000);
  c.idleCooldownUntil = 1910000;
  c.idleHardBrakeUntil = 4610000;
  c.noteSearchContextReceipt(discoveryResult, { source: 'idle-headline' });
  assert.equal(c.idleCooldownUntil, 1910000);
  assert.equal(c.idleHardBrakeUntil, 4610000);
});

test('discovery timing is configurable, never slows faster lab pacing, and excludes special modes', () => {
  const { c, time } = independentFixture();
  c.runtimeConfig.idle_timing = { discovery_start_s: 6, discovery_fade_s: 60 };
  c.noteSearchContextReceipt(discoveryResult);
  assert.equal(c.idlePacingDelayMs(112500, c.Date.now()), 6000);
  c.compressIdleMs = value => value / 5;
  assert.equal(c.idlePacingDelayMs(c.idleDelayMs(), c.Date.now()), 6000);
  c.compressIdleMs = value => value / 100;
  assert.equal(c.idlePacingDelayMs(c.idleDelayMs(), c.Date.now()), 1125);
  time(1060000);
  assert.equal(c.idleDiscoveryWeight(), 0);
  time(1000000);
  for (const mode of ['firstContactModeEnabled', 'performanceModeEnabled', 'idleSubstrateTestEnabled']) {
    c[mode] = () => true;
    assert.equal(c.idleDiscoveryWeight(), 0, mode);
    assert.equal(c.idlePacingDelayMs(112500, c.Date.now()), 112500, mode);
    c[mode] = () => false;
  }
  for (const level of [0, 11, 12]) {
    c.currentIdleDrift = () => level;
    assert.equal(c.idleDiscoveryWeight(), 0);
  }
  c.currentIdleDrift = () => 7;
  c.runtimeConfig.idle_timing.discovery_enabled = false;
  assert.equal(c.idleDiscoveryWeight(), 0);
  assert.equal(c.noteIdleDiscovery(['off'], { source: 'test', detail: 'disabled' }), false);
});

test('discovery renews pacing without prescribing a topic or rhetorical lane', () => {
  const { c } = independentFixture();
  const before = c.lastAcceptedUserTranscriptAt;
  c.noteSearchContextReceipt(discoveryResult);
  assert.ok(c.idleDiscoveryWeight() > 0);
  assert.equal(c.lastAcceptedUserTranscriptAt, before);
  assert.ok(!page.includes('function chooseIdleLane('));
});

for (const change of ['none', 'user', 'reconnect', 'disconnect', 'context-reset']) {
  test(`search completion accepts only current discovery receipts: ${change}`, async () => {
    const { c } = independentFixture();
    c.idleInFlight = true;
    c.activeRealtimeSession = (socket, generation) => socket === c.ws
      && generation === c.realtimeSessionGeneration && !c.realtimeStopRequested;
    let complete;
    c.fetch = () => new Promise(resolve => { complete = () => resolve({ ok: true, json: async () => discoveryResult }); });
    const pending = c.searchWeb({ query: 'Unexpected discovery' });
    if (change === 'user') c.lastUserTurnActivityAt = c.Date.now();
    if (change === 'reconnect') c.realtimeSessionGeneration++;
    if (change === 'context-reset') c.brain2EvidenceGeneration++;
    if (change === 'disconnect') c.realtimeStopRequested = true;
    complete();
    await pending;
    assert.equal(Boolean(c.idleDiscovery), change === 'none');
    assert.equal(c.searchContextReceipts.length, change === 'none' ? 1 : 0);
  });
}

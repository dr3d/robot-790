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
    idleHeadlineBrakePassAvailable: () => false, ws: {}, realtimeSessionGeneration: 1,
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
  });
  for (const name of [
    'idleTiming', 'conversationAttentionEnabled', 'conversationAttentionState', 'conversationIdleDelayMs',
    'conversationAttentionInstruction', 'conversationPauseHoldUntil', 'conversationReengagePolicy', 'conversationReengageWindowActive',
    'clearConversationReengageTimer', 'scheduleConversationReengage', 'idleDelayMs', 'idleGapMs',
    'idleBlockedReason', 'scheduleIdlePonder', 'noteConversationActivity', 'clearAssistantFinishTimer',
    'armAssistantUtteranceFinished', 'checkAssistantUtteranceFinished',
  ]) {
    const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    const end = page.indexOf('\n    }\n', start);
    assert.ok(start >= 0 && end > start, name);
    vm.runInContext(page.slice(start, end + 6), c, { filename: name });
  }
  return { c, timers, time: value => { now = value; } };
}

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

test('one warm beat leaves room for an answer, then independent idle resumes; a new user turn releases the hold', () => {
  const { c, time } = fixture();
  c.conversationPauseUserAt = c.lastAcceptedUserTranscriptAt;
  time(1030000);
  assert.equal(c.idleBlockedReason(), 'leaving room for the operator');
  c.scheduleIdlePonder();
  assert.equal(c.idleTimerFireAt, 1180000);
  time(1040000);
  c.armAssistantUtteranceFinished({ wasIdle: true });
  c.checkAssistantUtteranceFinished();
  assert.equal(c.conversationPauseHoldUntil(), 1180000);
  time(1180000);
  assert.equal(c.idleBlockedReason(), '');
  c.lastAcceptedUserTranscriptAt = c.Date.now();
  assert.equal(c.conversationPauseHoldUntil(), 0);
  c.conversationPauseUserAt = c.lastAcceptedUserTranscriptAt;
  c.currentIdleDrift = () => 12;
  assert.equal(c.conversationPauseHoldUntil(), 0);
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

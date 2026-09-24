const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');
const noop = () => {};
function source(name) {
  const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
  assert.ok(start >= 0, name);
  return page.slice(start, page.indexOf('\n    }\n', start) + 6);
}
function fixture(speed = 5) {
  let now = 1000000, seq = 0;
  const timers = new Map(), logs = [], calls = [], sent = [];
  class Clock extends Date { static now() { return now; } }
  const c = vm.createContext({
    Date: Clock, ws: {}, realtimeSessionGeneration: 1, realtimeStopRequested: false,
    realtimeConnected: () => !c.realtimeStopRequested,
    activeRealtimeSession: (socket, generation) => socket === c.ws && generation === c.realtimeSessionGeneration && !c.realtimeStopRequested,
    setTimeout: (fn, ms) => { timers.set(++seq, { fn, at: now + ms, ms }); return seq; },
    clearTimeout: id => timers.delete(id),
    events: {}, log: (_, text) => logs.push(text),
    idleTimer: null, idleTimerFireAt: 0, updateIdleSchedulerStatus: noop,
    updateIdleLevel12State: noop, maybeLogIdleLevel12YackMode: noop,
    idlePacingAnchorAt: () => c.lastConversationActivityAt,
    idlePacingDelayMs: value => value, idleDelayMs: () => 90000 / speed,
    idleLevel12YackActive: () => false,
    compressIdleMs: (ms, { floorMs = 0 } = {}) => Math.max(ms / speed, floorMs),
    conversationPauseHoldUntil: () => 0, idleTiming: () => ({ post_user_quiet_s: 0 }),
    lastUserTurnActivityAt: 0, userTurnPendingUntil: 0, lastIdlePonderAt: 0,
    idleGapMs: () => 90000 / speed, idleCooldownUntil: 0, idleHardBrakeUntil: 0,
    idleHeadlineBrakePassAvailable: () => false, scheduleIdleSchedulerStatusTimer: noop,
    refreshBrainStatusQuietly: async () => ({}), lmStudioPromptBusy: () => false,
    triggerIdlePonder: async () => { c.lastIdlePonderAt = now; calls.push('idle request'); },
    responseActive: false, outputAudioActive: () => false,
    assistantFinishTimer: null, assistantFinishPending: false, assistantFinishWasIdle: false,
    assistantFinishArmedAt: 0, lastAssistantResponseDoneAt: 0, lastConversationActivityAt: 0,
    scheduleBrain2Mull: () => calls.push('B2 scheduled'), scheduleConversationReengage: noop,
    toolFollowupNeeded: true, pendingToolCalls: 0, responseDoneAfterTool: true,
    toolFollowupTerminal: true, toolFollowupPromptSources: [], toolFollowupDrainTimer: null,
    toolContinuationOrigin: 'idle', imageToolProtectionEnabled: false,
    send: event => sent.push(event),
    brain2MouthBrainEnabled: () => true, brain2VoiceMonitorEnabled: () => true,
    userSpeechActive: false, userTurnPending: () => false,
  });
  require('./helpers/sts_continuation_harness.cjs').installToolContinuation(c);
  require('./helpers/sts_completion_owner.cjs').installResponseCompletion(c, page);
  for (const name of ['scheduleIdlePonder', 'clearAssistantFinishTimer',
    'armAssistantUtteranceFinished', 'checkAssistantUtteranceFinished', 'noteConversationActivity',
    'maybeCreateToolFollowup', 'brain2MouthCanSurface', 'brain2VoiceCanSpeak']) vm.runInContext(source(name), c);
  const fire = async id => {
    const timer = timers.get(id);
    assert.ok(timer, `timer ${id} exists`);
    timers.delete(id); now = timer.at; await timer.fn();
  };
  return { c, timers, logs, calls, sent, fire, advance: ms => { now += ms; } };
}

for (const speed of [1, 5, 7]) test(`terminal tool turns keep scheduling B1 at ${speed}x without user input`, async () => {
  const { c, calls, sent, timers, fire } = fixture(speed);
  for (let turn = 0; turn < 20; turn++) {
    c.toolFollowupNeeded = true; c.responseDoneAfterTool = true; c.toolFollowupTerminal = true;
    c.maybeCreateToolFollowup();
    assert.equal(c.toolFollowupNeeded, false);
    await fire(c.assistantFinishTimer);
    assert.ok(Math.abs(timers.get(c.idleTimer).ms - 90000 / speed) < 0.001);
    await fire(c.idleTimer);
  }
  assert.equal(calls.filter(value => value === 'idle request').length, 20);
  assert.equal(calls.filter(value => value === 'B2 scheduled').length, 20);
  assert.equal(c.lastUserTurnActivityAt, 0);
  assert.deepEqual(sent, []);
});

test('terminal tool turn waits for existing speech to drain before scheduling', async () => {
  const { c, calls, fire, timers } = fixture();
  c.outputAudioActive = () => true;
  c.maybeCreateToolFollowup();
  await fire(c.assistantFinishTimer);
  assert.equal(c.idleTimer, null);
  assert.deepEqual(calls, []);
  c.outputAudioActive = () => false;
  await fire(c.assistantFinishTimer);
  assert.ok(timers.has(c.idleTimer));
});

test('disconnect and session change prevent stale idle callbacks from dispatching', async () => {
  for (const change of [c => { c.realtimeStopRequested = true; }, c => { c.realtimeSessionGeneration++; }]) {
    const { c, calls, fire } = fixture();
    c.maybeCreateToolFollowup();
    await fire(c.assistantFinishTimer);
    change(c); await fire(c.idleTimer);
    assert.ok(!calls.includes('idle request'));
  }
});

test('quiet tool experiment is absent; full-context opportunities remain', () => {
  const start = page.indexOf('    const runtimeWatchTools = [');
  const schema = page.slice(start, page.indexOf('\n    ];', start) + 7);
  const c = vm.createContext({});
  vm.runInContext(schema + '\nglobalThis.tools = runtimeWatchTools;', c);
  assert.equal(c.tools.find(tool => tool.name === 'wait_silently'), undefined);
  assert.match(c.tools.find(tool => tool.name === 'stop_standing_routine').description, /does not stop ordinary idle/);
  assert.match(source('triggerIdlePonder'), /toolContinuation.startTurn\("idle"\)/);
  assert.match(source('triggerIdlePonder'), /robot790_idle_continuation: true/);
  assert.match(source('triggerIdlePonder'), /do not need a new user question/);
  assert.doesNotMatch(page, /wait_silently|waitSilently|silentWaitActive|silentWaitUntil|clearSilentWait/);
});

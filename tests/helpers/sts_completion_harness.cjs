const assert = require('node:assert/strict');
const vm = require('node:vm');

function extract(page, name) {
  const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
  const end = page.indexOf('\n    }\n', start);
  assert.ok(start >= 0 && end > start, name);
  return page.slice(start, end + 6);
}

function fixture(page, install) {
  let now = 1000, seq = 0, audio = false;
  const trace = [], timers = new Map();
  const call = name => (...args) => trace.push([name, ...args]);
  const c = vm.createContext({
    Date: { now: () => now },
    setTimeout(fn, ms) { timers.set(++seq, { fn, ms }); trace.push(['setTimer', seq, ms]); return seq; },
    clearTimeout(id) { timers.delete(id); trace.push(['clearTimer', id]); },
    responseActive: true, assistantFinishTimer: null, assistantFinishPending: false,
    assistantFinishWasIdle: false, assistantFinishArmedAt: 0, lastAssistantResponseDoneAt: 0,
    outputAudioActive: () => audio, noteConversationActivity: call('activity'),
    realtimeConnection: { socket: { id: 'socket' }, generation: 1, stopped: false },
    activeRealtimeSession: (socket, generation) => !c.realtimeConnection.stopped
      && socket === c.realtimeConnection.socket && generation === c.realtimeConnection.generation,
    observeContextUsage: call('usage'), llmRunOverview: null, performance: { now: () => now },
    responseOutputSuppressed: () => false, suppressedResponseIds: new Set(), eventResponseId: e => e.response_id,
    events: {}, log: (_, line) => trace.push(['log', line]),
    flushAudioQueue: () => { trace.push(['flush']); return Promise.resolve(); },
    toolContinuation: {
      needed: false, awaiting: false,
      completeResponse() { trace.push(['completeTools']); return this.awaiting; },
      cancelFollowup() { trace.push(['cancelTools']); this.needed = false; this.awaiting = false; }
    },
    sessionMapRequestEpoch: 5, pendingSessionMapMove: null,
    idleInFlight: false, gpuWatchInFlight: false, standingRoutineInFlight: false,
    idleExhaustionScoredThisResponse: true, reengageInFlight: true,
    gpuWatchRoutine: null, standingRoutine: null, imageToolProtectionEnabled: false,
    clearLabGoalAfterOneShotResponse: call('clearGoal'), clearImageToolProtection: call('clearImage'),
    updateSessionTools: call('sessionTools'), scheduleGpuWatchTick: call('gpuTick'),
    scheduleStandingRoutineTick: call('standingTick'), updateLanePressure: call('pressure'),
    updateIdleSchedulerStatus: call('idleStatus'), maybeCreateToolFollowup: call('followup'),
    scheduleFaceIdle: call('faceIdle'), clearUserTurnPending: call('clearUser'),
    scheduleConversationReengage: call('reengage'), scheduleIdlePonder: call('idleSchedule'),
    addConversation: call('conversation'), unidentifiedOutputSuppressed: true,
    responseCreateLedgerCredits: 1, resetSpeechMouthCue: call('resetMouth'), cueFaceMode: call('face'),
  });
  install?.(c, page);
  for (const name of ['clearAssistantFinishTimer', 'armAssistantUtteranceFinished',
    'checkAssistantUtteranceFinished', 'handleEvent']) vm.runInContext(extract(page, name), c);
  const event = (type, extra = {}, owner) => c.handleEvent({ type, ...extra }, owner);
  const done = (status = 'completed', id = 'r1', owner) => event('response.done', { response_id: id, response: { status } }, owner);
  const fire = () => {
    const id = c.assistantFinishTimer, timer = timers.get(id);
    assert.ok(timer, 'completion timer exists'); timers.delete(id); now += timer.ms; timer.fn();
  };
  const snapshot = () => JSON.parse(JSON.stringify({
    active: c.responseActive, pending: c.assistantFinishPending, idle: c.assistantFinishWasIdle,
    armedAt: c.assistantFinishArmedAt, timer: c.assistantFinishTimer, responseAt: c.lastAssistantResponseDoneAt,
    lanes: [c.idleInFlight, c.gpuWatchInFlight, c.standingRoutineInFlight, c.reengageInFlight, c.idleExhaustionScoredThisResponse],
    suppressed: [...c.suppressedResponseIds], epoch: c.sessionMapRequestEpoch, move: c.pendingSessionMapMove,
    timers: [...timers].map(([id, x]) => [id, x.ms]), trace,
  }));
  return { c, trace, event, done, fire, snapshot, audio: x => { audio = x; }, now: x => { now = x; } };
}

async function characterize(page, install) {
  const results = [];
  async function run(name, action) {
    const f = fixture(page, install); await action(f); await Promise.resolve();
    results.push({ name, ...f.snapshot() });
  }
  await run('text completion', f => { f.done(); f.fire(); });
  await run('audio still draining', f => { f.audio(true); f.done(); f.fire(); f.fire(); });
  await run('audio settlement finishes once', f => {
    f.audio(true); f.done(); f.fire(); f.audio(false); f.now(5000);
    f.c.checkAssistantUtteranceFinished(); f.c.checkAssistantUtteranceFinished();
  });
  await run('audio done is not model done', f => { f.event('response.output_audio.done'); });
  await run('new model response keeps completion waiting', f => {
    f.done(); f.event('response.created'); f.fire(); f.done(); f.fire();
  });
  await run('idle completion preserves human response anchor', f => {
    f.c.lastAssistantResponseDoneAt = 500; f.c.idleInFlight = true; f.done(); f.fire();
  });
  await run('rearm preserves idle provenance', f => {
    f.c.armAssistantUtteranceFinished({ wasIdle: true }); f.c.armAssistantUtteranceFinished();
    f.c.responseActive = false; f.fire();
  });
  await run('tool continuation owns completion', f => {
    f.c.toolContinuation.needed = f.c.toolContinuation.awaiting = true;
    f.c.idleInFlight = true; f.c.imageToolProtectionEnabled = true; f.done();
  });
  await run('idle image protection cleared after response', f => {
    f.c.idleInFlight = true; f.c.imageToolProtectionEnabled = true; f.done(); f.fire();
  });
  for (const kind of ['gpuWatch', 'standing']) await run(`${kind} routine`, f => {
    f.c[`${kind}Routine`] = {}; f.c[`${kind === 'standing' ? 'standingRoutine' : kind}InFlight`] = true; f.done();
  });
  await run('cancel clears tool followup and pending map move', f => {
    f.c.pendingSessionMapMove = { target: 'elsewhere' };
    f.c.toolContinuation.needed = f.c.toolContinuation.awaiting = true;
    f.done('cancelled'); f.fire();
  });
  await run('failed response without id', f => { f.done('failed', ''); f.fire(); });
  await run('suppression set remains bounded', f => {
    f.c.suppressedResponseIds = new Set(Array.from({ length: 64 }, (_, i) => `old${i}`)); f.done('cancelled');
  });
  await run('error clears pending finish', f => {
    f.done(); f.c.gpuWatchRoutine = {}; f.c.standingRoutine = {};
    f.event('error', { error: { type: 'backend', message: 'failure' } });
    f.c.checkAssistantUtteranceFinished();
  });
  await run('stopped session ignores late completion', f => { f.c.realtimeConnection.stopped = true; f.done(); });
  await run('old socket ignored', f => { f.done('completed', 'old', { socket: {}, generation: 0 }); });
  await run('flush error logged without blocking completion', f => {
    f.c.flushAudioQueue = () => Promise.reject(new Error('fixture flush')); f.done(); f.fire();
  });
  await run('clear timer alone preserves pending state', f => {
    f.c.armAssistantUtteranceFinished(); f.c.clearAssistantFinishTimer();
  });
  await run('duplicate model done before playback drain', f => {
    f.audio(true); f.done(); f.done(); f.audio(false); f.fire();
  });
  return results;
}

module.exports = { extract, fixture, characterize };

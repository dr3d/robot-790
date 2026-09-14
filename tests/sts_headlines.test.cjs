const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');
const headline = {
  title: 'A new discovery', url: 'https://example.com/discovery', snippet: 'A publisher reports a discovery.',
  published_at: '2026-09-10T10:00:00+00:00', source: 'BBC News',
};

function setup(overrides = {}, extraFunctions = []) {
  const calls = [];
  const receipts = [];
  const logs = [];
  let now = 120001;
  const context = vm.createContext({
    pendingEyeRecallResponse: null,
    eyeRecallResponses: new Map(),
    pendingSessionMapMove: null, sessionMapMoveBusy: false,
    realtimeStopRequested: false, updateSessionTools: () => {},
    Date: { now: () => now }, URL, AbortSignal, location: { href: 'http://127.0.0.1:8790/' },
    brain2HeadlineStartedAt: 1, brain2HeadlineLastAttemptAt: 0, brain2HeadlineSeen: [], brain2HeadlineSeed: null,
    brain2HeadlineCache: [], brain2HeadlineRefreshRequested: false, brain2HeadlineLastSelectionAt: 0,
    idleHeadlineQuietMs: 120000, idleHeadlineGapMs: 600000, brain2HeadlinesInFlight: false,
    currentIdleDrift: () => 7, currentIdleWonder: () => 5, llmWebSearchTools: { checked: true },
    firstContactModeEnabled: () => false, performanceModeEnabled: () => false, idleSubstrateTestEnabled: () => false,
    realtimeConnected: () => true, userSpeechActive: false, userTurnPending: () => false,
    responseActive: false, outputAudioActive: () => false, idleInFlight: false, pendingToolCalls: 0, toolFollowupNeeded: false,
    currentLabGoal: () => '', activeIdleSelfTasks: () => [], lmStudioPromptBusy: () => false,
    lastUserTurnActivityAt: 0, lastAcceptedUserTranscriptAt: 0,
    brain2InFlight: false, brain2MouthBrainEnabled: () => true, currentBrain2PersonFocus: () => 0,
    conversationLines: [], brain2BackoffUntil: 0, lastBrain2MullAt: 0,
    brain2MinGapMs: 14000, brain2FastClockFloorMs: 14000, brain2FailureStreak: 0,
    compressIdleMs: (ms, { floorMs = 0 } = {}) => Math.max(ms / 12, floorMs),
    brain2LastEvidence: null, brain2EvidenceGeneration: 0, realtimeSessionGeneration: 1, ws: {},
    brain2EvidenceSnapshot: () => ({ fingerprint: 'same', user_key: 'same', evidence_generation: 0 }),
    brain2ConversationContext: () => '', brain2RecentIdleContext: () => '', brain2RecentOutputContext: () => '',
    rememberBrain2Prompt: () => {}, updateBrain2Controls: () => {}, updateLanePressure: () => {},
    scheduleBrain2Mull: () => {}, bumpBrain2Counter: () => {}, scheduleIdlePonder: () => {},
    logBrain2: (...args) => logs.push(args), log: (...args) => logs.push(args), events: {},
    noteSearchContextReceipt: (result, options) => receipts.push({ result, options }), noteAloneActivity: () => {},
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith('/api/headlines')) return {
        ok: true, json: async () => ({ status: 'ok', retrieved_at: '2026-09-10T12:00:00+00:00', results: [headline] }),
      };
      return { ok: true, json: async () => ({
        status: 'ok', headline_url: headline.url, note_for_eric: 'An interesting new direction.', question: 'How does it work?',
        mouth_text: 'Must not be surfaced.', should_surface: true,
      }) };
    },
    ...overrides,
  });
  for (const name of [
    'brain2HeadlinesEnabled', 'brain2HeadlinesDue', 'brain2BlockedReason', 'brain2DelayMs',
    'fetchIdleHeadlines', 'requestBrain2Mull', 'acceptBrain2Headline', 'triggerBrain2Mull',
    'idleHeadlineSeedAvailable', 'formatIdleHeadlineContext', 'chooseIdleLane',
    ...extraFunctions,
  ]) {
    const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    assert.notEqual(start, -1);
    const end = page.indexOf('\n    }\n', start);
    vm.runInContext(page.slice(start, end + 6), context, { filename: name });
  }
  return { context, calls, receipts, logs, time: value => { now = value; } };
}

test('12x lab speed does not compress headline quiet time or fetch cooldown; no Drift 10 requirement', () => {
  const { context: c, time } = setup();
  time(120000);
  assert.equal(c.brain2HeadlinesDue(), false);
  time(120001);
  assert.equal(c.brain2HeadlinesDue(), true);
  c.brain2HeadlineLastAttemptAt = 120001;
  time(720000);
  assert.equal(c.brain2HeadlinesDue(), false);
  time(720001);
  assert.equal(c.brain2HeadlinesDue(), true);
  c.lastUserTurnActivityAt = 720001;
  assert.equal(c.brain2HeadlinesDue(), false);
});

test('headline reading respects switches, special modes, user work, active goals and GPU work', () => {
  for (const overrides of [
    { currentIdleDrift: () => 0 }, { currentIdleWonder: () => 0 }, { llmWebSearchTools: { checked: false } },
    { firstContactModeEnabled: () => true }, { performanceModeEnabled: () => true },
    { idleSubstrateTestEnabled: () => true }, { userSpeechActive: true }, { responseActive: true },
    { userTurnPending: () => true }, { idleInFlight: true }, { outputAudioActive: () => true },
    { pendingToolCalls: 1 }, { toolFollowupNeeded: true }, { brain2MouthBrainEnabled: () => false },
    { currentLabGoal: () => 'An active task' }, { activeIdleSelfTasks: () => [{}] },
    { lmStudioPromptBusy: () => true }, { realtimeConnected: () => false },
  ]) assert.equal(setup(overrides).context.brain2HeadlinesDue(), false, Object.keys(overrides)[0]);
  assert.equal(setup({ brain2MouthBrainEnabled: () => false }).context.brain2BlockedReason(), 'brain 2 off');
});

test('a completely silent connection and person-focus zero can still read headlines', async () => {
  const { context: c, calls, receipts } = setup();
  assert.equal(c.brain2BlockedReason(), '');
  assert.equal(c.brain2DelayMs(), 30000);
  await c.triggerBrain2Mull();
  assert.equal(calls.length, 2);
  const request = JSON.parse(calls[1].options.body);
  assert.equal(request.mode, 'headlines');
  assert.equal(request.conversation, '');
  assert.equal(request.headlines[0].published_at, headline.published_at);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].options.source, 'idle-headline');
  assert.equal(c.brain2HeadlineSeed.headline.url, headline.url);
  assert.match(c.formatIdleHeadlineContext(), /not an operator request/);
  assert.match(c.formatIdleHeadlineContext(), /untrusted external/);
  assert.equal(c.chooseIdleLane(7).name, 'headlines');
  c.brain2HeadlineSeed.delivered = true;
  assert.equal(c.formatIdleHeadlineContext(), '');
  assert.equal(c.brain2HeadlinesInFlight, false);
  assert.equal(c.brain2InFlight, false);
});

test('unchanged headlines do not cause another model call, including after a quiet pass', async () => {
  const { context: c, calls, time, logs } = setup();
  await c.triggerBrain2Mull();
  time(720001);
  await c.triggerBrain2Mull();
  assert.equal(calls.length, 3);
  assert.ok(logs.some(row => row[0] === 'headlines unchanged'));
  c.brain2HeadlineSeen = [];
  c.brain2HeadlineSeed = null;
  c.acceptBrain2Headline({ headline_url: '' }, [headline]);
  assert.equal(c.brain2HeadlineSeed, null);
  assert.ok(c.brain2HeadlineSeen.includes(headline.url));
});

test('a new-subject request can use an unselected cached story without another network fetch', async () => {
  const { context: c, calls, time } = setup();
  const second = { ...headline, title: 'Another subject', url: 'https://example.com/second' };
  await c.triggerBrain2Mull();
  c.brain2HeadlineCache.push(second);
  c.brain2HeadlineRefreshRequested = true;
  time(149999);
  assert.equal(c.brain2HeadlinesDue(), false);
  time(150002);
  assert.equal(c.brain2HeadlinesDue(), true);
  const unused = await c.fetchIdleHeadlines();
  assert.equal(unused.length, 1);
  assert.equal(unused[0].url, second.url);
  assert.equal(calls.length, 2);
  c.acceptBrain2Headline({ headline_url: second.url }, unused);
  assert.equal(c.brain2HeadlineSeed.headline.url, second.url);
  assert.equal(c.brain2HeadlineRefreshRequested, false);
  assert.equal(c.brain2HeadlinesDue(), false);
});

for (const phase of ['fetch', 'mull']) {
  for (const change of ['user', 'reconnect', 'reset', 'disabled', 'disconnect']) {
    test(`headline ${phase} discards results after ${change}`, async () => {
      const { context: c, receipts } = setup();
      const original = c.fetch;
      let complete;
      c.fetch = (url, options) => {
        const isFetch = String(url).endsWith('/api/headlines');
        if (isFetch !== (phase === 'fetch')) return original(url, options);
        return new Promise(resolve => { complete = async () => resolve(await original(url, options)); });
      };
      const pending = c.triggerBrain2Mull();
      await new Promise(setImmediate);
      assert.equal(typeof complete, 'function');
      if (change === 'user') c.lastUserTurnActivityAt = 120001;
      if (change === 'reconnect') { c.ws = {}; c.realtimeSessionGeneration += 1; }
      if (change === 'reset') c.brain2EvidenceGeneration += 1;
      if (change === 'disabled') c.llmWebSearchTools.checked = false;
      if (change === 'disconnect') c.realtimeStopRequested = true;
      await complete();
      await pending;
      assert.equal(receipts.length, 0);
      assert.equal(c.brain2HeadlineSeed, null);
    });
  }
}

test('a feed failure consumes cooldown but releases the private lane', async () => {
  const { context: c } = setup({ fetch: async () => { throw new Error('offline'); } });
  await assert.rejects(c.triggerBrain2Mull(), /offline/);
  assert.equal(c.brain2HeadlineLastAttemptAt, 120001);
  assert.equal(c.brain2HeadlinesDue(), false);
  assert.equal(c.brain2HeadlinesInFlight, false);
});

test('headline seed expires or yields to a new operator turn; idle dispatch consumes it once', () => {
  const { context: c, time } = setup();
  c.acceptBrain2Headline({ headline_url: headline.url }, [headline]);
  time(720001);
  assert.equal(c.idleHeadlineSeedAvailable(), false);
  time(120002);
  c.lastUserTurnActivityAt = 120002;
  assert.equal(c.idleHeadlineSeedAvailable(), false);
  const idleStart = page.indexOf('async function triggerIdlePonder(');
  const idleEnd = page.indexOf('function conversationDisplayTextRange', idleStart);
  const idle = page.slice(idleStart, idleEnd);
  assert.ok(idle.indexOf('brain2HeadlineSeed.delivered = true') > idle.indexOf('send({'));
});

test('fresh headline permits one brake-time beat without clearing the brake or bypassing foreground work', () => {
  const timers = [];
  const { context: c, time } = setup({
    idleHardBrakeUntil: 3660000, idleHardBrakeMs: 3600000, idleCooldownUntil: 0,
    idleTimer: null, idleTimerFireAt: 0, lastConversationActivityAt: 1, lastIdlePonderAt: 1,
    userTurnPendingUntil: 0, idlePostUserQuietMs: 1000,
    conversationReengagePolicy: () => ({ maxAttempts: 1 }), conversationReengageWindowActive: () => false,
    updateIdleLevel12State: () => {}, maybeLogIdleLevel12YackMode: () => {},
    idleDelayMs: () => 1000, idleGapMs: () => 1000, idleLevel12YackActive: () => false,
    conversationIdleDelayMs: value => value,
    conversationPauseHoldUntil: () => 0,
    idleTiming: () => ({ post_user_quiet_s: 12 }),
    updateIdleSchedulerStatus: () => {}, scheduleIdleSchedulerStatusTimer: () => {},
    clearTimeout: () => {}, setTimeout: (fn, ms) => { timers.push(ms); return timers.length; },
  }, ['idleHardBrakeActive', 'idleHeadlineBrakePassAvailable', 'idleBlockedReason', 'scheduleIdlePonder']);
  assert.equal(c.idleBlockedReason(), 'hard loop brake');
  c.scheduleIdlePonder();
  assert.equal(c.idleTimerFireAt, c.idleHardBrakeUntil);
  const until = c.idleHardBrakeUntil;
  c.acceptBrain2Headline({ headline_url: headline.url }, [headline]);
  assert.equal(c.idleHeadlineBrakePassAvailable(), true);
  assert.equal(c.idleBlockedReason(), '');
  assert.equal(c.chooseIdleLane(7).name, 'headlines');
  assert.ok(c.idleTimerFireAt < until);
  assert.equal(c.idleHardBrakeUntil, until);
  c.responseActive = true;
  assert.equal(c.idleBlockedReason(), 'assistant busy');
  c.responseActive = false;
  c.userSpeechActive = true;
  assert.equal(c.idleBlockedReason(), 'user speaking');
  c.userSpeechActive = false;
  c.currentLabGoal = () => 'A foreground task';
  assert.equal(c.idleBlockedReason(), 'hard loop brake');
  c.currentLabGoal = () => '';
  c.brain2HeadlineSeed.delivered = true;
  assert.equal(c.idleBlockedReason(), 'hard loop brake');
  c.scheduleIdlePonder();
  assert.equal(c.idleTimerFireAt, until);
  c.brain2HeadlineSeed.delivered = false;
  time(720001);
  assert.equal(c.idleHeadlineBrakePassAvailable(), false, 'expired seed cannot bypass brake');
  time(120001);
  c.brain2HeadlineSeed.at = 59999;
  assert.equal(c.idleHeadlineBrakePassAvailable(), false, 'a seed from before the brake is not new input');
});

test('accepting a headline refreshes return-state context even without an idle response', () => {
  const steps = [];
  const { context: c } = setup({
    noteAloneActivity: (...args) => steps.push(['activity', ...args]),
    updateSessionTools: () => steps.push(['prompt']), scheduleIdlePonder: () => steps.push(['schedule']),
  });
  c.acceptBrain2Headline({ headline_url: headline.url }, [headline]);
  assert.deepEqual(steps.map(step => step[0]), ['activity', 'prompt', 'schedule']);
  assert.equal(steps[0][1], 'idle_headline');
});

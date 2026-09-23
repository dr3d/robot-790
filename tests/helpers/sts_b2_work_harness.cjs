const assert = require('node:assert/strict');
const vm = require('node:vm');

const scenarios = [
  'quiet', 'advice', 'mouth', 'held', 'deferred-mouth', 'echo', 'revision-mouth',
  'art', 'body', 'manual', 'headlines', 'empty-headlines', 'headline-user',
  'headline-model-user', 'headline-error', 'response-stale', 'request-error',
  'second-error', 'manual-error', 'body-error', 'mouth-error',
  'reconnect-result', 'reconnect-error', 'reconnect-body', 'reconnect-mouth',
  'blocked-tool', 'blocked-flight', 'blocked-user', 'blocked-disconnected',
  'blocked-off', 'blocked-focus', 'blocked-empty', 'blocked-cooldown',
  'blocked-backoff', 'blocked-evidence', 'stopped',
];
const clone = value => JSON.parse(JSON.stringify(value));
const settle = () => new Promise(setImmediate);
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture(name, page, installOwner = null) {
  const trace = [], request = deferred(), feed = deferred(), action = deferred();
  let now = 100000;
  class Clock extends Date { static now() { return now; } }
  const evidence = { fingerprint: 'fresh', user_key: 'user', last_assistant_output_id: 'b1', note_guidance: [] };
  const headline = { title: 'A dated story', url: 'https://example.test/story' };
  const result = { status: 'ok', observed_evidence: evidence };
  const c = vm.createContext({
    Date: Clock, realtimeConnection: { socket: {}, generation: 1, stopped: false },
    pendingSessionMapMove: null, sessionMapMoveBusy: false,
    toolContinuation: { pending: 0, needed: false },
    brain2InFlight: false, brain2HeadlinesInFlight: false,
    brain2EvidenceGeneration: 1, lastUserTurnActivityAt: 50000,
    userSpeechActive: false, brain2BackoffUntil: 0, brain2FailureStreak: 0,
    lastBrain2MullAt: 0, brain2MinGapMs: 14000, brain2FastClockFloorMs: 14000,
    brain2FailureBackoffMs: 60000, brain2LastEvidence: null,
    conversationLines: ['Hello'], brain2QuestionCandidates: [], brain2NoteCandidates: [], brain2RevisionCandidates: [],
    compressIdleMs: ms => ms, realtimeConnected: () => true,
    brain2HeadlinesDue: () => name.startsWith('headline') || name === 'empty-headlines',
    brain2HeadlinesEnabled: () => true, brain2MouthBrainEnabled: () => true,
    currentBrain2PersonFocus: () => 4, userTurnPending: () => false,
    brain2EvidenceSnapshot: () => evidence,
    updateBrain2Controls: () => trace.push(['controls', c.brain2InFlight, c.brain2HeadlinesInFlight]),
    updateLanePressure: detail => trace.push(['pressure', detail.reason, c.brain2InFlight, c.brain2HeadlinesInFlight]),
    bumpBrain2Counter: kind => trace.push(['count', kind]),
    logBrain2: (kind, detail) => trace.push(['log', kind, detail]),
    scheduleBrain2Mull: () => trace.push(['schedule']),
    fetchIdleHeadlines: () => { trace.push(['fetch']); return feed.promise; },
    requestBrain2Mull: options => { trace.push(['request', clone(options)]); return request.promise; },
    acceptBrain2Headline: (r, headlines) => trace.push(['headline', clone(r), clone(headlines)]),
    idleArt: { offer: proposal => trace.push(['art', proposal]) },
    surfaceBrain2BodyCue: () => { trace.push(['body']); return action.promise; },
    surfaceBrain2MouthText: text => { trace.push(['mouth', text]); return action.promise; },
    brain2EchoesRecentVoice: () => name === 'echo' || name === 'revision-mouth',
    brain2EchoesRecentBrain2: () => false, brain2LooksLikeRevision: () => name === 'revision-mouth',
    brain2MouthCanSurface: () => name !== 'deferred-mouth',
    deferBrain2Surface: (text, reason) => trace.push(['defer', text, reason]),
    rememberBrain2Output: (kind, text) => trace.push(['remember', kind, text]),
    brain2UserPresentButBusy: () => false, brain2LoopGuardText: () => false,
    appendBrain2AdvisoryToConversation: options => trace.push(['append', options]),
  });
  if (name === 'advice') Object.assign(result, { note_for_eric: 'Keep the thread.', question: 'What changed?', revision_candidate: 'Check the premise.',
    note_delivery: { original_chars: 16, delivered_chars: 16, truncated: false },
    steering: { status: 'ok', evidence_id: 'b1', loop: false } });
  if (['mouth', 'held', 'deferred-mouth', 'echo', 'revision-mouth', 'mouth-error', 'reconnect-mouth'].includes(name)) result.mouth_text = 'An observation.';
  if (name === 'held') result.should_surface = false;
  if (name === 'revision-mouth') result.revision_candidate = 'A revision.';
  if (['body', 'body-error', 'reconnect-body'].includes(name)) result.body_beat = 'look';
  if (name === 'art') result.art_proposal = { prompt: 'An illustration.' };
  if (name === 'response-stale') result.status = 'stale';
  if (name === 'second-error' || name === 'manual-error') c.brain2FailureStreak = 1;
  if (name === 'blocked-tool') c.toolContinuation.pending = 1;
  if (name === 'blocked-flight') c.brain2InFlight = true;
  if (name === 'blocked-user') c.userSpeechActive = true;
  if (name === 'blocked-disconnected') c.realtimeConnected = () => false;
  if (name === 'blocked-off') c.brain2MouthBrainEnabled = () => false;
  if (name === 'blocked-focus') c.currentBrain2PersonFocus = () => 0;
  if (name === 'blocked-empty') c.conversationLines = [];
  if (name === 'blocked-cooldown') c.lastBrain2MullAt = now - 100;
  if (name === 'blocked-backoff') c.brain2BackoffUntil = now + 60000;
  if (name === 'blocked-evidence') c.brain2LastEvidence = evidence;
  if (name === 'stopped') c.realtimeConnection.stopped = true;
  if (installOwner) installOwner(c, page);
  for (const fn of ['brain2BlockedReason', 'triggerBrain2Mull']) {
    const start = page.indexOf(`    ${fn === 'triggerBrain2Mull' ? 'async ' : ''}function ${fn}(`);
    const end = page.indexOf('\n    }\n', start);
    assert(start >= 0 && end > start, fn);
    vm.runInContext(page.slice(start, end + 6), c);
  }
  function replaceSession() {
    c.realtimeConnection.socket = {};
    c.realtimeConnection.generation++;
    // A replacement session already owns pending work.
    c.brain2InFlight = true;
    c.brain2HeadlinesInFlight = true;
    trace.push(['replaced']);
  }
  async function complete() {
    const pending = c.triggerBrain2Mull({ manual: name === 'manual' || name === 'manual-error' });
    const outcome = pending.then(() => null, error => error.message);
    if (name === 'headline-user') c.lastUserTurnActivityAt++;
    if (name === 'headline-error') feed.reject(new Error('Feed failed'));
    else feed.resolve(name === 'empty-headlines' ? [] : [headline]);
    await settle();
    if (name === 'headline-model-user') c.lastUserTurnActivityAt++;
    if (name === 'reconnect-result' || name === 'reconnect-error') replaceSession();
    now = 101000;
    if (['request-error', 'second-error', 'manual-error', 'reconnect-error'].includes(name)) request.reject(new Error('Request failed'));
    else request.resolve(result);
    await settle();
    if (name === 'reconnect-body' || name === 'reconnect-mouth') replaceSession();
    if (name === 'body-error' || name === 'mouth-error') action.reject(new Error('Surface failed'));
    else action.resolve();
    const error = await outcome;
    return clone({ trace, error, state: { busy: c.brain2InFlight, headlines: c.brain2HeadlinesInFlight,
      last: c.lastBrain2MullAt, failures: c.brain2FailureStreak, backoff: c.brain2BackoffUntil,
      notes: c.brain2NoteCandidates, questions: c.brain2QuestionCandidates, revisions: c.brain2RevisionCandidates } });
  }
  return { c, trace, request, feed, action, complete };
}

module.exports = { fixture, scenarios, settle };

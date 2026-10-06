const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scenarios = [
  'normal', 'manual', 'headlines', 'empty-headlines', 'body', 'art', 'unicode',
  'socket', 'generation', 'evidence-generation', 'setup', 'guidance', 'user',
  'speaking', 'assistant', 'stopped-only', 'http-error', 'result-error',
  'http-fallback', 'invalid-json', 'http-invalid-json', 'stale-http-error',
  'network-error', 'stale-network-error', 'json-user', 'json-socket',
];

function fixture(name, page, { thinking } = {}) {
  const trace = [], posts = [];
  let finish, fail, finishJson, markJsonStarted;
  const jsonStarted = new Promise(resolve => { markJsonStarted = resolve; });
  const evidence = {
    fingerprint: 'private-fingerprint', setup_cards: ['setup-cards/test.txt'],
    note_guidance: [{ filename: 'test.txt', shared: 'Shared', instruction: 'Observe' }],
    evidence_generation: 4, user_key: 'user-1', sampled_at: '2026-09-23T14:00:00.000Z',
    last_assistant_output_id: 'assistant-1', latest_user_utterance: { text: 'Hello', prosody: 'quiet' },
    runtime: { file_write_receipts: [{ filename: 'Trip.txt', status: 'ok', characters: 12 }] },
  };
  if (name === 'unicode') evidence.latest_user_utterance = { text: '\u4f60\u597d', prosody: '' };
  const clone = value => JSON.parse(JSON.stringify(value));
  const context = vm.createContext({
    URL, location: { href: 'http://127.0.0.1:8790/subpage/' },
    realtimeConnection: { socket: {}, generation: 2, stopped: false },
    brain2EvidenceGeneration: 4, brain2LastEvidence: null, userSpeechActive: false,
    loadedNoteContexts: [], faceVisualHoldRevision: 7,
    brain2EvidenceSnapshot: () => evidence,
    thinkingControls: { packet: () => thinking },
    brain2SetupCards: () => evidence.setup_cards,
    Robot790NoteBrains: { forBrain: () => evidence.note_guidance },
    brain2BodyContext: () => {
      trace.push('body');
      return name === 'body' ? { key: 'reachy_mini', pose: 'neutral' } : null;
    },
    normalizeFaceBaseUrl: () => 'http://body.local/',
    currentBrain2PersonFocus: () => 4,
    brain2ConversationContext: () => name === 'unicode' ? '\u4f60\u597d\n\u00e9ric' : 'Conversation',
    brain2RecentIdleContext: () => 'Recent idle',
    brain2RecentOutputContext: () => 'Recent B2',
    rememberBrain2Prompt: value => trace.push({ ledger: clone(value) }),
    logBrain2: (kind, detail) => trace.push({ kind, detail }),
    fetch: (url, options) => {
      posts.push({ url: String(url), method: options.method, headers: options.headers, body: options.body });
      trace.push('fetch');
      return new Promise((resolve, reject) => { finish = resolve; fail = reject; });
    },
  });
  if (name === 'art' || name.includes('headlines')) context.idleArt = {
    proposalContext() { trace.push('art'); return { enabled: true, busy: false }; },
  };
  const moduleFile = path.join(__dirname, '../../web/sts/brain2-request.js');
  if (fs.existsSync(moduleFile)) context.Robot790Brain2Request = require(moduleFile);
  const start = page.indexOf('    async function requestBrain2Mull(');
  const end = page.indexOf('\n    }\n', start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(page.slice(start, end + 6), context);
  const options = name === 'manual' ? { manual: true }
    : name === 'headlines' ? { manual: true, headlines: [{ title: 'Dated story', url: 'https://example.test/story' }] }
    : name === 'empty-headlines' ? { headlines: [] } : {};
  const initial = clone(evidence);
  const observedSession = { socket: context.realtimeConnection.socket, generation: context.realtimeConnection.generation };
  const pending = context.requestBrain2Mull(options);
  // Attach rejection handling before releasing the deferred network operation.
  const outcome = pending.then(result => {
    if (result.status !== 'stale') {
      assert.equal(result.observed_thinking, thinking, 'retain the request-time Thinking snapshot');
      assert.equal(result.observed_session.socket, observedSession.socket, 'retain the captured socket identity');
      assert.equal(result.observed_session.generation, observedSession.generation, 'retain the captured generation');
    }
    // Assert the additive control metadata above, then compare all pre-existing
    // results and effects against the untouched extraction baseline.
    const { observed_thinking, observed_session, ...legacyResult } = result;
    return { result: clone(legacyResult) };
  }, error => ({ error: error.message }));
  function mutate(change) {
    if (change === 'socket') context.realtimeConnection.socket = {};
    if (change === 'generation') context.realtimeConnection.generation++;
    if (change === 'evidence-generation') context.brain2EvidenceGeneration++;
    if (change === 'setup') context.brain2SetupCards = () => ['setup-cards/new.txt'];
    if (change === 'guidance') context.Robot790NoteBrains.forBrain = () => [{ instruction: 'Changed' }];
    if (change === 'user') context.brain2EvidenceSnapshot = () => ({ ...evidence, user_key: 'user-2' });
    if (change === 'speaking') context.userSpeechActive = true;
    if (change === 'assistant') context.brain2EvidenceSnapshot = () => ({ ...evidence, last_assistant_output_id: 'assistant-2' });
    if (change === 'stopped-only') context.realtimeConnection.stopped = true;
  }
  mutate(name);
  if (name.startsWith('stale-')) mutate('socket');
  async function complete() {
    if (name.includes('network-error')) fail(new Error('Network down'));
    else {
      const httpError = name.includes('http-');
      const resultError = name === 'result-error' || name.endsWith('http-error');
      finish({ ok: !httpError, status: httpError ? 503 : 200, statusText: httpError ? 'Unavailable' : 'OK',
        json: async () => {
          trace.push('json');
          if (name.startsWith('json-')) {
            await new Promise(resolve => { finishJson = resolve; markJsonStarted(); });
          }
          if (name.includes('invalid-json')) throw new SyntaxError('Bad JSON');
          return resultError ? { status: 'error', error: 'Backend failure' }
            : { status: 'ok', note_for_eric: 'Consider another angle.', body_choice: { status: 'abstained' } };
        },
      });
      if (name.startsWith('json-')) {
        await jsonStarted;
        mutate(name.slice(5));
        finishJson();
      }
    }
    const returned = await outcome;
    assert.deepEqual(clone(evidence), initial, 'captured evidence must not be mutated');
    return { posts: clone(posts), trace, ...returned,
      lastEvidence: clone(context.brain2LastEvidence),
      acceptedCapturedIdentity: context.brain2LastEvidence === evidence };
  }
  return { complete, context };
}

async function capture(page) {
  const results = {};
  for (const name of scenarios) results[name] = await fixture(name, page).complete();
  return results;
}

module.exports = { scenarios, fixture, capture };

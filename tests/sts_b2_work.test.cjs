const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { fixture, scenarios, settle } = require('./helpers/sts_b2_work_harness.cjs');
const { installBrain2Work } = require('./helpers/sts_b2_work_owner.cjs');
const { create } = require('../web/sts/brain2-work.js');
const { deferred } = require('./helpers/sts_save_harness.cjs');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');
// Complete event/state traces captured from committed 07c7916 before extraction.
const baseline = require('./fixtures/sts-b2-work.json');

for (const name of scenarios) {
  test(`B2 work preserves baseline effects and state: ${name}`, async () => {
    assert.deepEqual(await fixture(name, page, installBrain2Work).complete(), baseline[name]);
  });
}

test('baseline distinguishes manual failures, automatic backoff and stale completions', () => {
  assert.equal(baseline['second-error'].state.backoff, 161000);
  assert.equal(baseline['manual-error'].state.backoff, 0);
  assert.equal(baseline['reconnect-error'].state.failures, 0);
  assert.equal(baseline['reconnect-error'].state.busy, true);
  assert.equal(baseline['reconnect-mouth'].state.busy, true);
  assert.equal(baseline['empty-headlines'].trace.some(item => item[0] === 'request'), false);
});

test('work owner admits one request, completes it once, and clears both busy indicators', () => {
  const owner = create(), session = { socket: {}, generation: 1 };
  const work = owner.begin({ ...session, headlines: true });
  assert.equal(owner.busy, true);
  assert.equal(owner.headlines, true);
  assert.equal(owner.begin(session), null);
  assert.equal(owner.finish({ ...work }, session), false);
  assert.equal(owner.finish(work, session), true);
  assert.equal(owner.busy, false);
  assert.equal(owner.headlines, false);
  assert.equal(owner.finish(work, session), false);
});

test('old completion cannot release replacement work even on the same connection', () => {
  const owner = create(), session = { socket: {}, generation: 1 };
  const old = owner.begin(session);
  owner.reset();
  const current = owner.begin({ ...session, headlines: true });
  assert.equal(owner.finish(old, session), false);
  assert.equal(owner.busy, true);
  assert.equal(owner.headlines, true);
  assert.equal(owner.finish(current, session), true);
});

test('a completion needs both captured socket and generation', () => {
  const owner = create(), session = { socket: {}, generation: 1 };
  const work = owner.begin(session);
  assert.equal(owner.finish(work, { ...session, generation: 2 }), false);
  assert.equal(owner.finish(work, { ...session, socket: {} }), false);
  assert.equal(owner.busy, true);
  owner.reset();
  assert.equal(owner.finish(work, session), false);
});

test('context reset can retire headline indication without claiming the request finished', () => {
  const owner = create(), session = { socket: {}, generation: 1 };
  const work = owner.begin({ ...session, headlines: true });
  owner.clearHeadlines();
  assert.equal(owner.headlines, false);
  assert.equal(owner.busy, true);
  assert.equal(owner.finish(work, session), true);
});

for (const error of [false, true]) {
  test(`old actual trigger completion leaves a newer pending trigger alone: error=${error}`, async () => {
    const { c, trace } = fixture('quiet', page, installBrain2Work);
    const old = deferred(), current = deferred();
    let count = 0;
    c.requestBrain2Mull = () => (++count === 1 ? old : current).promise;
    const first = c.triggerBrain2Mull();
    c.realtimeConnection.socket = {};
    c.realtimeConnection.generation++;
    c.brain2Work.reset();
    const second = c.triggerBrain2Mull();
    if (error) old.reject(new Error('Old error'));
    else old.resolve({ status: 'ok', note_for_eric: 'Old advice' });
    await first;
    assert.equal(c.brain2Work.busy, true);
    assert.equal(c.brain2FailureStreak, 0);
    assert.equal(c.brain2NoteCandidates.length, 0);
    current.resolve({ status: 'ok', note_for_eric: 'Current advice' });
    await second;
    assert.equal(c.brain2Work.busy, false);
    assert.deepEqual(Array.from(c.brain2NoteCandidates, n => n.text), ['Current advice']);
    assert.equal(trace.filter(t => t[0] === 'pressure' && t[1] === 'Brain 2 mull finished').length, 1);
  });
}

test('duplicate trigger while a request is pending uses the existing blocked path', async () => {
  const { c, request, trace } = fixture('quiet', page, installBrain2Work);
  const first = c.triggerBrain2Mull();
  await c.triggerBrain2Mull({ manual: true });
  assert.equal(trace.filter(t => t[0] === 'request').length, 1);
  assert(trace.some(t => t[0] === 'log' && t[1] === 'mull skipped' && t[2] === 'already in flight'));
  request.resolve({ status: 'ok' });
  await first;
  assert.equal(c.brain2Work.busy, false);
});

test('real runtime halt clears headline occupancy and invalidates its late completion', async () => {
  const { closeFixture } = require('./helpers/sts_close_harness.cjs');
  const { c } = await closeFixture();
  c.brain2Work.reset();
  const token = c.brain2Work.begin({ socket: c.realtimeConnection.socket,
    generation: c.realtimeConnection.generation, headlines: true });
  c.haltRealtimeActivity('offline acceptance');
  assert.equal(c.brain2Work.busy, false);
  assert.equal(c.brain2Work.headlines, false);
  assert.equal(c.brain2Work.finish(token, c.realtimeConnection), false);
  await settle();
});

test('page has one busy owner and unchanged scheduling policy functions', () => {
  assert.doesNotMatch(page, /\b(?:let|var) brain2(?:Headlines)?InFlight\b/);
  assert.match(page, /const brain2Work = Robot790Brain2Work\.create\(\)/);
  assert.match(page, /if \(brain2Work\.finish\(work, realtimeConnection\)\)/);
  const { createHash } = require('node:crypto');
  for (const [name, expected] of Object.entries(baseline.unchangedFunctions)) {
    // Advisory formatting moved; compare its body after reversing adapter names.
    const source = ['formatBrain2AdvisoryContent', 'formatBrain2ForInstructions'].includes(name)
      ? fs.readFileSync(`${__dirname}/../web/sts/brain2-advisories.js`, 'utf8').replace(/\r\n/g, '\n')
        .replaceAll('a.guidanceCurrent(item)', 'Robot790NoteBrains.isCurrent(item, loadedNoteContexts, "b2")')
        .replaceAll('a.userAt()', 'lastUserTurnActivityAt')
      : page;
    const start = source.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    const end = source.indexOf('\n    }\n', start);
    assert(start >= 0 && end > start, name);
    // Reviewed evidence additions; scheduling/extraction guards otherwise stay frozen.
    // Headline coverage: sts_headlines. Shared playback evidence: sts_music.
    const currentExpected = {
      acceptBrain2Headline: '9ecf4557f5823de4578294e8a26fb170d20eb68036e80f23e9dd828ebc705a76',
      brain2EvidenceSnapshot: '17d73091ed3db8502bc17c685fb403fabdaff813ba568e3d07db8e9b00687bbc',
    }[name] || expected;
    assert.equal(createHash('sha256').update(source.slice(start, end + 6)).digest('hex'), currentExpected, name);
  }
});

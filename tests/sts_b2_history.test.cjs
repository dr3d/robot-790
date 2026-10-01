const assert = require('node:assert/strict');
const { test } = require('node:test');
const { create, savedTurns } = require('../web/sts/brain2-history.js');
const { buildSnapshot } = require('../web/sts/brain2-evidence.js');
const advisories = require('../web/sts/brain2-advisories.js');
const { buildPayload, run } = require('../web/sts/brain2-request.js');
const fs = require('node:fs');
const { fixture } = require('./helpers/sts_b2_work_harness.cjs');
const { installBrain2Work } = require('./helpers/sts_b2_work_owner.cjs');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

function input(extra = {}) {
  const lines = ['[8:00:00 AM] You: Earlier question.',
    ...Array.from({ length: 9 }, (_, n) => `[8:01:00 AM] Robot 790: reply ${n}. ${'words '.repeat(500)}`),
    '[8:20:00 AM] You: Current direction.'];
  const metadata = lines.map((_, i) => ({ iso: new Date(1790769600000 + i * 60000).toISOString(), responseId: `r${i}` }));
  const evidence = buildSnapshot({ lines, metadata, prosody: {}, sessionGeneration: 1, evidenceGeneration: 0,
    now: 1790771400000, runtime: {}, searchReceipts: [], setupCards: [], noteGuidance: [], previous: null });
  return { generation: 1, evidence, lines, metadata, notes: [], now: 600000, quietSince: 0,
    gap: 60000, outsideEnabled: true, ...extra };
}
function note(filename = 'sessions/old.txt', word = 'Older question', created = '2026-09-29T12:00:00Z') {
  return { filename, content: `STS Session Note\nCreated: ${created}\nPinned notes: irrelevant\n`
    + `[8:00:00 AM] You: ${word}\n[8:00:03 AM] Robot 790: An older answer.\n` };
}

test('history reads behind the recent window, preserving whole native response and current direction', () => {
  const state = create(), args = input();
  const before = JSON.stringify(args);
  const p = state.candidate(args);
  assert(p);
  assert.equal(p.filename, 'current conversation');
  assert.equal(p.passages.length, 1, 'long coherent turn exceeds soft target intact');
  assert(p.characters > p.target_characters);
  assert(p.passages.every(row => row.last_line <= args.evidence.conversation_window.omitted_chunks));
  assert(!p.passages.some(row => row.text.includes('Current direction')));
  assert.equal(JSON.stringify(args), before);
});

test('successful reading advances backward even while new recent speech accumulates', () => {
  const state = create(), args = input({ outsideEnabled: false });
  const p = state.candidate(args);
  state.attempted('history', args.now);
  assert(state.complete(p, args));
  const next = state.candidate({ ...args, now: args.now + args.gap });
  assert(next.passages.at(-1).last_line < p.passages[0].first_line);
  assert(!next.passages.some(row => p.passages.some(prior => prior.id === row.id)));
});

test('failed attempts do not consume history; real-time cadence is shared with outside reading', () => {
  const state = create(), args = input();
  const p = state.candidate(args);
  state.attempted('history', args.now);
  assert.equal(state.candidate({ ...args, now: args.now + 1000 }), null);
  assert.equal(state.candidate({ ...args, now: args.now + args.gap }), null, 'outside gets next opportunity');
  state.attempted('outside', args.now + args.gap);
  assert.equal(state.candidate({ ...args, now: args.now + 2 * args.gap }).id, p.id);
});

test('new polling time is not source progress and fresh speech postpones reading', () => {
  const state = create(), args = input();
  assert.equal(state.candidate({ ...args, quietSince: args.now - 1000 }), null);
  assert.equal(state.candidate({ ...args, gap: Infinity }), null);
  const p = state.candidate(args);
  assert.equal(state.candidate({ ...args, now: args.now + 1 }).id, p.id);
});

test('history rotates across current and loaded sessions without exhausting the newest source first', () => {
  const state = create();
  const args = input({ notes: [note(), note('sessions/newer.txt', 'Newer', '2026-09-30T10:00:00Z'),
    note('setup-cards/secret.txt'), { ...note('sessions/routed.txt'), brain_context: { version: 1 } }], outsideEnabled: false });
  const seen = [];
  for (let i = 0; i < 30; i++) {
    const p = state.candidate(args);
    if (!p) break;
    seen.push(p);
    assert(state.complete(p, args));
  }
  assert(seen.length > 2);
  assert.deepEqual(seen.slice(0, 3).map(p => p.filename), ['current conversation', 'sessions/newer.txt', 'sessions/old.txt']);
  assert.equal(seen[3].filename, 'current conversation');
  assert.equal(state.candidate(args), null, 'finite coverage, no automatic replay when exhausted');
});

test('unpin, edit, operator turn, reset, and session switch invalidate pending source packets', () => {
  for (const change of ['unpin', 'edit', 'user', 'reset', 'session']) {
    const state = create(), args = input({ notes: [note()], outsideEnabled: false });
    let p;
    do { p = state.candidate(args); assert(p); if (p.filename === 'current conversation') state.complete(p, args); }
    while (p.filename === 'current conversation');
    const next = { ...args };
    if (change === 'unpin') next.notes = [];
    if (change === 'edit') next.notes = [note('sessions/old.txt', 'Changed')];
    if (change === 'user') next.evidence = { ...args.evidence, user_key: 'new user' };
    if (change === 'reset') state.reset();
    if (change === 'session') next.generation++;
    assert.equal(state.current(p, next), false, change);
    assert.equal(state.complete(p, next), false, change);
  }
});

test('saved passages preserve speaker, clock, source lines, and multiline prose, not save-time preamble', () => {
  const rows = savedTurns('Runtime at save: old claim\n[8:00 AM] You: My words.\n  [v: soft]\n'
    + '[8:01 AM] Robot 790: A paragraph.\n\nMore prose.\n[8:02 AM] System: old receipt');
  assert.equal(rows.length, 3);
  assert.equal(rows[0].role, 'user');
  assert.equal(rows[0].first_id, '2');
  assert.equal(rows[1].role, 'assistant');
  assert(rows[1].text.includes('\n\nMore prose.'));
  assert(!rows[0].text.includes('Runtime at save'));
});

test('request mode sends history separately, without modifying recent evidence', () => {
  const args = input();
  const p = create().candidate(args);
  const base = { manual: false, evidence: args.evidence, personFocus: 4, history: p };
  const request = buildPayload(base);
  assert.equal(request.mode, 'history');
  assert.deepEqual(request.history, p);
  assert.deepEqual(request.evidence.conversation, args.evidence.conversation);
  assert.equal(request.idle_art, undefined);
});

test('an old page server cannot silently accept a history read as ordinary oversight', async () => {
  const { evidence } = input();
  const socket = {};
  let accepted = 0;
  const effects = {
    post: async () => ({ ok: true, json: async () => ({ status: 'ok', mode: 'person' }) }),
    currentSession: () => ({ socket, generation: 1, evidenceGeneration: evidence.evidence_generation }),
    setupCards: () => evidence.setup_cards, noteGuidance: () => evidence.note_guidance,
    latestUserKey: () => evidence.user_key, userSpeaking: () => false,
    rememberPrompt() {}, acceptEvidence() { accepted++; }
  };
  await assert.rejects(run({ evidence, socket, generation: 1, history: {} }, effects), /restart the STS page helper/);
  assert.equal(accepted, 0);
});

test('history advisory survives speech until a request includes it, separately from oversight', () => {
  let output = 'b1', userAt = 0, current = true;
  const a = advisories.create({ now: () => 50, userAt: () => userAt, outputId: () => output,
    historyCurrent: () => current, log() {}, remember() {}, userSpeaking: () => false });
  a.acceptHistory({ note_for_eric: 'An earlier possibility.', history_source: { speaker: 'assistant', id: 'old' } }, {});
  assert(a.format().includes('An earlier possibility'));
  assert.equal(a.notes.length, 0, 'history is not a loop assessment');
  output = 'b2'; assert(a.format().includes('An earlier possibility'));
  output = 'b1'; current = false; assert.equal(a.format(), '');
  current = true; userAt = 51; assert.equal(a.format(), '');
  userAt = 0;
  a.sent({ type: 'response.create', response: { instructions: 'An unrelated request' } });
  assert(a.historyPending);
  a.sent({ type: 'response.create', response: { instructions: a.instructions() } });
  assert.equal(a.format(), '');
  assert.equal(a.historyPending, false);
  a.clear(); assert.equal(a.format(), '');
});

test('failed reads yield to another source without consuming the failed passage or restarting its cursor', () => {
  const state = create(), args = input({ notes: [note()], outsideEnabled: false });
  const failed = state.candidate(args);
  state.attempted('history', args.now, failed);
  const next = { ...args, now: args.now + args.gap };
  const other = state.candidate(next);
  assert.equal(other.filename, 'sessions/old.txt');
  assert(state.complete(other, next));
  assert.equal(state.candidate(next).id, failed.id);
});

test('a request assembled before a replacement cannot consume the newer callback', () => {
  let now = 50;
  const logs = [];
  const a = advisories.create({ now: () => now++, userAt: () => 0, historyCurrent: () => true,
    log: (...row) => logs.push(row), remember() {} });
  a.acceptHistory({ note_for_eric: 'First.', history_source: { id: 'one' } }, { id: 'page-one' });
  const old = a.instructions();
  a.acceptHistory({ note_for_eric: 'Second.', history_source: { id: 'two' } }, { id: 'page-two' });
  a.sent({ type: 'response.create', response: { instructions: old } });
  assert(a.historyPending);
  const text = a.instructions();
  a.sent({ type: 'session.update', session: { instructions: text } });
  assert(a.historyPending, 'mere configuration is not a delivery opportunity');
  a.sent({ type: 'conversation.item.create', item: { role: 'assistant', content: [{ type: 'output_text', text }] } });
  assert(!a.historyPending);
  assert.equal(logs.filter(row => row[0] === 'history offered').length, 1);
});

for (const event of ['success', 'abstain', 'user', 'source', 'reconnect', 'disabled', 'failure']) {
  test(`actual dispatcher handles historical reading: ${event}`, async () => {
    const { c, request, trace } = fixture('quiet', page, installBrain2Work);
    const history = { id: 'p1', filename: 'old.txt', passages: [{ id: 'old', speaker: 'assistant' }] };
    let inspected = 0, offered = 0, current = true;
    c.brain2HistoryCandidate = () => history;
    c.brain2HistoryEnabled = () => event !== 'disabled';
    c.brain2HistoryInput = () => ({});
    c.brain2History = { attempted() {}, complete() { if (current) inspected++; return current; } };
    c.brain2Advisories.acceptHistory = result => { offered += Number(Boolean(result.note_for_eric)); };
    const promise = c.triggerBrain2Mull();
    if (event === 'user') c.lastUserTurnActivityAt++;
    if (event === 'source') current = false;
    if (event === 'reconnect') c.realtimeConnection.generation++;
    if (event === 'failure') request.reject(new Error('Model unavailable'));
    else request.resolve({ status: 'ok', note_for_eric: event === 'abstain' ? '' : 'An earlier thought.',
      history_source: { id: 'old', speaker: 'assistant' },
      mouth_text: 'Must not speak', body_beat: 'Must not move', art_proposal: { prompt: 'Must not draw' } });
    if (event === 'failure') await assert.rejects(promise, /unavailable/);
    else await promise;
    assert.equal(inspected, ['success', 'abstain'].includes(event) ? 1 : 0);
    assert.equal(offered, event === 'success' ? 1 : 0);
    assert(!trace.some(row => ['mouth', 'body', 'art', 'headline'].includes(row[0])));
    assert.equal(c.brain2NoteCandidates.length, 0);
    const sent = trace.find(row => row[0] === 'request');
    assert.equal(sent[1].history.id, 'p1');
  });
}

test('history scope normalizer removes only the reviewed literal edits from prior extraction baselines', () => {
  const { edits, normalizeHistoryScope } = require('./helpers/sts_b2_history_scope.cjs');
  const module = fs.readFileSync(`${__dirname}/../web/sts/brain2-advisories.js`, 'utf8').replace(/\r\n/g, '\n');
  for (const [after] of edits) {
    assert.equal((page.includes(after) ? page : module).split(after).length - 1, 1, after);
  }
  const prior = require('node:child_process').execFileSync('git', ['show', '4e30b93:web/sts/brain2-advisories.js'], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
  assert.equal(normalizeHistoryScope(module), prior);
});

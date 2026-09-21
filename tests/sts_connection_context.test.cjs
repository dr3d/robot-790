const assert = require('node:assert/strict');
const { test } = require('node:test');
const { prepare } = require('../web/sts/connection-context.js');
const fs = require('node:fs');
const vm = require('node:vm');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

const note = (filename, content, session = true) => ({ filename, content, connection_history: session });
const base = { model: 'resident', context_window_tokens: 65536, policy: {}, startup_budget_tokens: 100 };
function measure(notes) { const prompt_tokens = 20 + notes.reduce((n, item) => n + item.content.length, 0);
  return { ...base, prompt_tokens, fits: prompt_tokens <= base.startup_budget_tokens }; }
function compactResult(filename, content = 'small') {
  return { status: 'ok', filename, content, source_sha256: 'a'.repeat(64), method: 'source-excerpts' };
}

test('roomy and empty connections do not compact anything', async () => {
  for (const notes of [[], [note('recent', 'fresh')]]) {
    const result = await prepare({ notes, measure, compact: () => assert.fail('not needed') });
    assert.deepEqual(result.notes, notes);
    assert.equal(result.receipt.attempts.length, 0);
  }
});

test('condensation starts at session one; root, newest session and core notes stay unchanged', async () => {
  const notes = [note('new', 'x'.repeat(30)), note('middle', 'y'.repeat(80)), note('root', 'foundation'),
    note('core', 'facts', false)];
  const original = structuredClone(notes), calls = [];
  const result = await prepare({ notes, measure, compact: async filename => { calls.push(filename); return compactResult(filename); } });
  assert.deepEqual(calls, ['middle']);
  assert.deepEqual(notes, original);
  assert.deepEqual(result.notes[0], original[0]);
  assert.deepEqual(result.notes[2], original[2]);
  assert.deepEqual(result.notes[3], original[3]);
  assert.equal(result.receipt.attempts[0].accepted, true);
  assert.equal(result.receipt.attempts[0].history_index, 1);
  assert.equal(result.receipt.history_selection.last_condensed_index, 1);
  assert.equal(result.receipt.history_selection.recent_sessions_intact, 1);
});

test('M is determined by measured fit: stop immediately and leave the newest tail intact', async () => {
  const notes = [note('s4', 'x'.repeat(10)), note('s3', 'x'.repeat(10)), note('s2', 'x'.repeat(55)),
    note('s1', 'x'.repeat(55)), note('s0', 'x'.repeat(10))];
  for (const [budget, expected, m] of [[170, [], 5], [120, ['s1'], 3], [100, ['s1', 's2'], 2]]) {
    const calls = [];
    const result = await prepare({ notes,
      measure: n => ({ ...measure(n), startup_budget_tokens: budget, fits: measure(n).prompt_tokens <= budget }),
      compact: async name => { calls.push(name); return compactResult(name); } });
    assert.deepEqual(calls, expected);
    assert.equal(result.receipt.history_selection.recent_sessions_intact, m);
    assert.deepEqual(result.notes.slice(0, m), notes.slice(0, m));
    assert.deepEqual(result.notes[4], notes[4]);
  }
});

test('N counts sessions only, not intervening pins or cards; configured opening stays intact', async () => {
  const card = { ...note('card', 'card'), brain_context: { version: 1 } };
  const notes = [note('s3', 'new'), note('ordinary', 'pin', false), note('s2', 'x'.repeat(100)),
    card, note('s1', 'foundation'), note('s0', 'opening')];
  const calls = [];
  const result = await prepare({ notes,
    measure: n => ({ ...measure(n), policy: { history_start_index: 2, history_min_recent_sessions: 1 } }),
    compact: async name => { calls.push(name); return compactResult(name); } });
  assert.deepEqual(calls, ['s2']);
  assert.equal(result.receipt.history_selection.session_count, 4);
  assert.equal(result.receipt.attempts[0].history_index, 2);
  for (const index of [0, 1, 3, 4, 5]) assert.deepEqual(result.notes[index], notes[index]);
});

test('one or two sessions have no middle; protected ends cannot be sacrificed to force a fit', async () => {
  for (const notes of [[note('only', 'x'.repeat(100))], [note('new', 'x'.repeat(100)), note('root', 'opening')]]) {
    const before = structuredClone(notes);
    await assert.rejects(prepare({ notes, measure, compact: () => assert.fail('no middle') }), /protected opening/);
    assert.deepEqual(notes, before);
  }
  const notes = [note('new', 'x'.repeat(100)), note('middle', 'x'.repeat(100)), note('root', 'opening')];
  const before = structuredClone(notes), calls = [];
  await assert.rejects(prepare({ notes, measure,
    compact: async name => { calls.push(name); return compactResult(name); } }), /protected opening/);
  assert.deepEqual(calls, ['middle']);
  assert.deepEqual(notes, before);
});

test('explicit zero boundaries allow all sessions, without weakening protected defaults', async () => {
  const notes = [note('only', 'x'.repeat(100))];
  const result = await prepare({ notes,
    measure: n => ({ ...measure(n), policy: { history_start_index: 0, history_min_recent_sessions: 0 } }),
    compact: async name => compactResult(name) });
  assert.equal(result.receipt.history_selection.last_condensed_index, 0);
  assert.equal(result.receipt.history_selection.recent_sessions_intact, 0);
});

test('a configured larger newest tail remains protected even when middle condensation is insufficient', async () => {
  const notes = [note('s3', 'x'.repeat(50)), note('s2', 'x'.repeat(50)), note('s1', 'x'.repeat(100)), note('s0', 'root')];
  const calls = [];
  await assert.rejects(prepare({ notes,
    measure: n => ({ ...measure(n), policy: { history_min_recent_sessions: 2 } }),
    compact: async name => { calls.push(name); return compactResult(name); } }), /protected opening/);
  assert.deepEqual(calls, ['s1']);
});

test('invalid session boundaries cannot reach the selector', async () => {
  for (const policy of [{ history_start_index: -1 }, { history_start_index: 1.5 },
    { history_min_recent_sessions: '1' }, { history_min_recent_sessions: 1000001 }]) {
    await assert.rejects(prepare({ notes: [], measure: n => ({ ...measure(n), policy }),
      compact: () => assert.fail('invalid policy') }), /Invalid connection history boundaries/);
  }
});

test('cards and non-session pins cannot be sacrificed to force a fit', async () => {
  const notes = [{ ...note('card', 'x'.repeat(150)), brain_context: { version: 1 } }, note('core', 'facts', false)];
  await assert.rejects(prepare({ notes, measure, compact: () => assert.fail('must not compact a card') }), /Nothing was dropped/);
  assert.equal(notes[0].content.length, 150);
});

test('wrong identities, provider failure and a changing model never return a plan', async () => {
  const notes = [note('recent', 'new'), note('middle', 'x'.repeat(150)), note('root', 'opening')];
  await assert.rejects(prepare({ notes, measure, compact: async () => compactResult('different') }), /identity/);
  await assert.rejects(prepare({ notes, measure, compact: async () => { throw Error('backend failed'); } }), /backend failed/);
  let calls = 0;
  await assert.rejects(prepare({ notes, measure: async n => ({ ...measure(n), model: ++calls === 1 ? 'one' : 'two' }),
    compact: async name => compactResult(name) }), /Model or context policy changed/);
  assert.equal(notes[1].content.length, 150);
});

test('a larger derivative is not admitted and the loop terminates', async () => {
  const notes = [note('recent', 'new'), note('middle', 'x'.repeat(150)), note('root', 'opening')];
  let calls = 0;
  await assert.rejects(prepare({ notes, measure, compact: async name => { calls++; return compactResult(name, 'y'.repeat(200)); } }), /Nothing was dropped/);
  assert.equal(calls, 1);
});

test('Connect checks budget before opening its socket; budgeting is absent from live request assembly', () => {
  const connect = page.slice(page.indexOf('    async function connect({'), page.indexOf('    async function restartRealtimeServer()'));
  assert.ok(connect.indexOf('await prepareConnectionContext()') < connect.indexOf('new WebSocket('));
  assert.equal((page.match(/await prepareConnectionContext\(\)/g) || []).length, 1);
  assert.match(page, /<script src="connection-context.js"><\/script>/);
});

function source(name) {
  const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
  return page.slice(start, page.indexOf('\n    }\n', start) + 6);
}

test('warning records headroom once, without reconnecting, rewriting or changing idle timing', () => {
  const logs = [], events = [];
  const c = vm.createContext({ connectionContextReceipt: { live_input_ceiling_tokens: 56000, policy: { warning_tokens: 4000 } },
    connectionContextWarned: false, contextUsage: { title: '', style: {} }, log: (_, m) => logs.push(m),
    events: {}, recordUiEvent: (...args) => events.push(args) });
  vm.runInContext(source('observeConnectionBudget'), c);
  c.observeConnectionBudget(51000);
  assert.equal(logs.length, 0);
  c.observeConnectionBudget(52000);
  c.observeConnectionBudget(55000);
  assert.equal(logs.length, 1);
  assert.equal(events.length, 1);
  assert.match(logs[0], /No history was rewritten/);
});

function preparationPage() {
  const notes = [note('sessions/recent.txt', 'STS Session Note\nfacts')];
  const c = vm.createContext({ loadedNoteContexts: notes, connectionContextReceipt: null,
    connectionContextWarned: false, contextUsage: { style: {} }, runtimeConfig: { connection_context: { enabled: true } },
    ws: null, WebSocket: { OPEN: 1, CONNECTING: 0 }, buildSessionInstructions: items => JSON.stringify(items || c.loadedNoteContexts),
    enabledToolList: () => [], buildRuntimeContextSections: () => ({}), setState: () => {}, log: () => {}, events: {},
    loadedNoteLooksLikeSessionNote: () => true, updateLoadedNoteControls: () => {}, recordUiEvent: () => {},
    loadedNoteContextDirty: false, currentContinuitySessionFilename: 'sessions/recent.txt',
    Robot790ConnectionContext: { prepare: async ({ notes }) => ({ notes, receipt: {
      prompt_tokens: 100, growth_available_tokens: 33000, context_window_tokens: 65536, attempts: [] } }) }
  });
  vm.runInContext(source('prepareConnectionContext'), c);
  return c;
}

test('browser installs prepared history once and keeps its source filename', async () => {
  const c = preparationPage(), original = c.loadedNoteContexts;
  await c.prepareConnectionContext();
  assert.notEqual(c.loadedNoteContexts, original);
  assert.equal(c.loadedNoteContexts[0].filename, original[0].filename);
  assert.equal(c.loadedNoteContexts[0].connection_history, true);
  assert.equal(c.connectionContextReceipt.prompt_tokens, 100);
  assert.equal(c.loadedNoteContextDirty, true);
  assert.equal(c.ws, null);
});

test('notes or prompt controls changed while preparing prevent installation', async () => {
  for (const edit of [c => { c.loadedNoteContexts[0].content += ' edited'; },
    c => { c.enabledToolList = () => [{ name: 'new tool' }]; }]) {
    const c = preparationPage(), original = c.loadedNoteContexts;
    c.Robot790ConnectionContext.prepare = async ({ notes }) => { edit(c); return { notes, receipt: {} }; };
    await assert.rejects(c.prepareConnectionContext(), /Notes or controls changed/);
    assert.equal(c.loadedNoteContexts, original);
    assert.equal(c.connectionContextReceipt, null);
    assert.equal(c.ws, null);
  }
});

test('old server configuration and live connections fail explicitly; disabled budgeting is a no-op', async () => {
  const c = preparationPage();
  c.runtimeConfig.connection_context = null;
  await assert.rejects(c.prepareConnectionContext(), /config unavailable/);
  c.runtimeConfig.connection_context = { enabled: true };
  c.ws = { readyState: 1 };
  await assert.rejects(c.prepareConnectionContext(), /only allowed before connection/);
  c.runtimeConfig.connection_context.enabled = false;
  await c.prepareConnectionContext();
  assert.equal(c.connectionContextReceipt, null);
});

test('token-budgeted history is not silently truncated by legacy character caps', () => {
  const c = vm.createContext({ maxLoadedNoteChars: 50, maxLoadedNoteCharsPerFile: 25,
    maxTranscriptNoteChars: 50, baseStartupNoteFilenames: [], Robot790NoteBrains: {},
    noteFilenameInSet: () => false, loadEricMemoriesEnabled: () => true,
    loadedNoteRestoreEnvelope: () => '', loadedNotePromptContent: item => item.content,
    loadedNoteLooksLikeTranscript: () => false });
  for (const name of ['clippedLoadedNoteContent', 'clippedLoadedNotePromptContent', 'formatLoadedNoteContextsForInstructions']) {
    vm.runInContext(source(name), c);
  }
  const content = 'Older details. '.repeat(100);
  const text = c.formatLoadedNoteContextsForInstructions([
    note('sessions/old.txt', content), note('tiny-note.txt', 'A small fact.', false)
  ]);
  assert.ok(text.includes(content));
  assert.ok(text.includes('A small fact.'));
  assert.ok(!text.includes('clipped'));
  assert.ok(c.clippedLoadedNotePromptContent(note('ordinary', content, false), content).includes('clipped'));
});

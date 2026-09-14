const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

function source(name) {
  const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
  const end = page.indexOf('\n    }\n', start);
  assert.ok(start >= 0 && end > start, name);
  return page.slice(start, end + 6);
}

function fixture() {
  const calls = [], logs = [];
  const sessions = [
    { filename: 'sessions/a.txt', title: 'Genius rehearsal', created: '2026-09-12T11:00:00-04:00' },
    { filename: 'sessions/b.txt', title: 'Harbor', parent_session_filename: 'sessions/a.txt' },
    { filename: 'sessions/c.txt', title: 'Harbor' },
  ];
  let now = 1000;
  class Clock extends Date { static now() { return now; } }
  const c = vm.createContext({
    Date: Clock, ws: { readyState: 1 }, WebSocket: { OPEN: 1, CONNECTING: 0, CLOSED: 3 },
    realtimeSessionGeneration: 1, realtimeStopRequested: false,
    pendingSessionMapMove: null, sessionMapMoveBusy: false, sessionMapRequestEpoch: 0, continuitySaveBusy: false,
    lastAcceptedUserTranscriptAt: 1, lastUserTurnActivityAt: 100,
    idleInFlight: false, reengageInFlight: false, gpuWatchInFlight: false, standingRoutineInFlight: false,
    continuityParentForCurrentRun: 'sessions/b.txt', micStream: {}, micMutedForNarration: true,
    loadedNoteContexts: [],
    addConversation: text => calls.push(['transcript', text]),
    send: event => calls.push(['send', event]),
    sessionNoteTitle: (id, title) => title || id,
    currentContinuityScrubMode: () => 'auto',
    fetchContinuitySessions: async () => ({ status: 'ok', sessions }),
    fetchContinuitySessionMetadata: async (id, form) => { calls.push(['preflight', id, form]); return {}; },
    sleepMs: async ms => { now += ms; },
    flushAudioQueue: async () => { calls.push(['flush']); },
    outputAudioActive: () => false,
    recordUiEvent: (type, id) => calls.push([type, id]),
    log: (_, line) => logs.push(line), events: {},
    disconnectRealtime: async options => {
      calls.push(['save-disconnect', options]);
      c.pendingSessionMapMove = null;
      c.realtimeStopRequested = true;
      c.ws.readyState = 3;
      c.micStream = null;
      c.micMutedForNarration = false;
      return { status: 'ok' };
    },
    connectSelectedContinuityFilename: async (...args) => {
      calls.push(['connect', ...args]);
      c.ws = { readyState: 1 };
      c.realtimeSessionGeneration++;
      c.realtimeStopRequested = false;
      c.continuityParentForCurrentRun = args[0];
      c.loadedNoteContexts = [{ filename: args[0] }, { filename: 'core/erics_memories.txt' }];
    },
    setSelectedContinuitySessionFilename: id => calls.push(['select', id]),
    startMic: async () => { calls.push(['mic', c.micMutedForNarration]); c.micStream = {}; },
  });
  for (const name of ['activeRealtimeSession', 'sessionMapEntries', 'listSessionMap', 'requestEnterSession', 'sessionMapArrivalReceipt', 'performSessionMapMove']) {
    vm.runInContext(source(name), c);
  }
  return { c, sessions, calls, logs };
}

test('catalogue is bounded, paginated, filterable metadata; no transcripts or context changes', async () => {
  const { c, sessions, calls } = fixture();
  for (let i = 0; i < 20; i++) sessions.push({ filename: `sessions/x${i}.txt`, title: `Other ${i}`, content: 'PRIVATE TRANSCRIPT' });
  const first = await c.listSessionMap();
  assert.equal(first.sessions.length, 12);
  assert.equal(first.total, 23);
  assert.equal(first.next_offset, 12);
  const next = await c.listSessionMap({ offset: first.next_offset });
  assert.equal(next.sessions.length, 11);
  assert.equal(next.next_offset, null);
  const found = await c.listSessionMap({ query: 'hArBoR' });
  assert.equal(found.sessions.length, 2);
  assert.equal(found.sessions[0].parent_session_id, 'sessions/a.txt');
  assert.equal(found.sessions[0].loaded_parent, true);
  assert.doesNotMatch(JSON.stringify(first), /PRIVATE TRANSCRIPT/);
  assert.equal(c.pendingSessionMapMove, null);
  assert.equal(calls.length, 0);
});

test('ambiguous, partial, absent, and arbitrary file destinations never switch', async () => {
  const { c, calls } = fixture();
  assert.equal((await c.requestEnterSession({ destination: 'Harbor' })).status, 'ambiguous');
  for (const destination of ['genius', 'missing', '../private.txt']) {
    assert.equal((await c.requestEnterSession({ destination })).status, 'not_found');
  }
  assert.equal(c.pendingSessionMapMove, null);
  assert.equal(calls.length, 0);
});

test('unique exact title queues an exact ID without disconnecting during tool execution', async () => {
  const { c, calls } = fixture();
  const result = await c.requestEnterSession({ destination: 'GENIUS REHEARSAL' });
  assert.equal(result.status, 'queued');
  assert.equal(c.pendingSessionMapMove.session_id, 'sessions/a.txt');
  assert.equal(c.pendingSessionMapMove.resumeForm, 'auto');
  assert.deepEqual(calls, [['preflight', 'sessions/a.txt', 'raw']]);
  await assert.rejects(c.requestEnterSession({ destination: 'sessions/a.txt' }), /already pending/);
});

test('autonomous lanes, no user turn, and stopped sessions cannot request a move', async () => {
  for (const overrides of [
    { idleInFlight: true }, { reengageInFlight: true }, { gpuWatchInFlight: true },
    { standingRoutineInFlight: true }, { lastAcceptedUserTranscriptAt: 0 }, { realtimeStopRequested: true },
  ]) {
    const { c, calls } = fixture();
    Object.assign(c, overrides);
    await assert.rejects(c.requestEnterSession({ destination: 'sessions/a.txt' }), /operator conversation turn/);
    assert.equal(calls.length, 0);
  }
});

test('preflight failure, user activity, and disconnect during lookup leave context alone', async () => {
  for (const mode of ['missing', 'user', 'disconnect', 'canceled']) {
    const { c, calls } = fixture();
    c.fetchContinuitySessionMetadata = async () => {
      if (mode === 'missing') throw new Error('Missing session file');
      if (mode === 'user') c.lastUserTurnActivityAt++;
      if (mode === 'disconnect') c.realtimeStopRequested = true;
      if (mode === 'canceled') c.sessionMapRequestEpoch++;
    };
    await assert.rejects(c.requestEnterSession({ destination: 'sessions/a.txt' }), /Missing|canceled/);
    assert.equal(c.pendingSessionMapMove, null);
    assert.equal(calls.length, 0);
  }
});

test('handoff drains speech, saves first, connects selected history, and restores muted mic', async () => {
  const { c, calls } = fixture();
  await c.requestEnterSession({ destination: 'sessions/a.txt' });
  let playing = true;
  c.outputAudioActive = () => playing;
  c.sleepMs = async () => { calls.push(['drained']); playing = false; };
  await c.performSessionMapMove(c.pendingSessionMapMove);
  const labels = calls.map(call => call[0]);
  assert.ok(labels.indexOf('drained') < labels.indexOf('save-disconnect'));
  assert.ok(labels.indexOf('save-disconnect') < labels.indexOf('connect'));
  assert.deepEqual(calls.find(call => call[0] === 'connect'), ['connect', 'sessions/a.txt', 'Enter Session', 'auto']);
  assert.equal(calls.find(call => call[0] === 'save-disconnect')[1].reloadSavedNote, false);
  assert.deepEqual(calls.at(-1), ['mic', true]);
  assert.equal(c.pendingSessionMapMove, null);
  assert.equal(c.sessionMapMoveBusy, false);
});

test('a typed session keeps its mic off after the move', async () => {
  const { c, calls } = fixture();
  c.micStream = null;
  await c.requestEnterSession({ destination: 'sessions/a.txt' });
  await c.performSessionMapMove(c.pendingSessionMapMove);
  assert.ok(!calls.some(call => call[0] === 'mic'));
});

test('arrival inventory counts actual loaded sessions separately from core notes', async () => {
  const { c, calls } = fixture();
  const connect = c.connectSelectedContinuityFilename;
  c.connectSelectedContinuityFilename = async (...args) => {
    await connect(...args);
    c.loadedNoteContexts = [
      ...Array.from({ length: 9 }, (_, i) => ({ filename: i ? `sessions/older-${i}.txt` : args[0] })),
      { filename: 'core/erics_memories.txt' }
    ];
  };
  await c.requestEnterSession({ destination: 'sessions/a.txt' });
  await c.performSessionMapMove(c.pendingSessionMapMove);
  const event = calls.find(call => call[0] === 'send')[1];
  const text = event.item.content[0].text;
  assert.match(text, /"historical_sessions":9/);
  assert.match(text, /"other_notes":1/);
  assert.match(text, /"total_notes":10/);
  assert.match(text, /"parent_session_id":"sessions\/a.txt"/);
  assert.match(calls.find(call => call[0] === 'transcript')[1], /9 historical sessions, 1 other note \(10 notes total\)/);
});

test('connected socket without destination lineage does not report arrival', async () => {
  const { c, calls, logs } = fixture();
  const connect = c.connectSelectedContinuityFilename;
  c.connectSelectedContinuityFilename = async (...args) => {
    await connect(...args);
    c.continuityParentForCurrentRun = '';
  };
  await c.requestEnterSession({ destination: 'sessions/a.txt' });
  await c.performSessionMapMove(c.pendingSessionMapMove);
  assert.match(logs.at(-1), /history was not restored/);
  assert.ok(!calls.some(call => ['session map arrived', 'mic', 'send'].includes(call[0])));
});

test('new activity or stopping during speech drain cancels navigation without saving', async () => {
  for (const mode of ['user', 'disconnect', 'generation']) {
    const { c, calls } = fixture();
    await c.requestEnterSession({ destination: 'sessions/a.txt' });
    c.outputAudioActive = () => true;
    c.sleepMs = async () => {
      if (mode === 'user') c.lastUserTurnActivityAt++;
      if (mode === 'disconnect') c.realtimeStopRequested = true;
      if (mode === 'generation') c.realtimeSessionGeneration++;
    };
    await c.performSessionMapMove(c.pendingSessionMapMove);
    assert.ok(!calls.some(call => call[0] === 'save-disconnect'));
    assert.equal(c.pendingSessionMapMove, null);
  }
});

test('save failure never loads destination or restarts mic', async () => {
  const { c, calls } = fixture();
  c.disconnectRealtime = async () => ({ status: 'error', error: 'disk full' });
  await c.requestEnterSession({ destination: 'sessions/a.txt' });
  await c.performSessionMapMove(c.pendingSessionMapMove);
  assert.ok(!calls.some(call => ['connect', 'mic'].includes(call[0])));
  assert.equal(c.sessionMapMoveBusy, false);
});

test('failed destination connect reports failure, never arrival or mic restart', async () => {
  const { c, calls, logs } = fixture();
  c.connectSelectedContinuityFilename = async () => {};
  await c.requestEnterSession({ destination: 'sessions/a.txt' });
  await c.performSessionMapMove(c.pendingSessionMapMove);
  assert.match(logs.at(-1), /did not connect/);
  assert.ok(!calls.some(call => ['session map arrived', 'mic'].includes(call[0])));
});

test('response boundary dispatches once, without a speech-only followup in the departing session', () => {
  const { c, calls } = fixture();
  vm.runInContext(source('maybeCreateToolFollowup'), c);
  Object.assign(c, {
    toolFollowupNeeded: true, pendingToolCalls: 1, responseDoneAfterTool: true,
    pendingSessionMapMove: { session_id: 'sessions/a.txt' },
    performSessionMapMove: move => calls.push(['move', move.session_id]),
  });
  c.maybeCreateToolFollowup();
  assert.equal(calls.length, 0);
  c.pendingToolCalls = 0;
  c.maybeCreateToolFollowup();
  c.maybeCreateToolFollowup();
  assert.deepEqual(calls, [['move', 'sessions/a.txt']]);
});

test('runtime wiring keeps navigation out of idle and retains normal connect eye clearing', () => {
  const idleNames = page.slice(page.indexOf('const idleToolAllowedNames'), page.indexOf('];', page.indexOf('const idleToolAllowedNames')));
  assert.doesNotMatch(idleNames, /enter_session|list_session_map/);
  assert.match(source('executeTool'), /requestEnterSession\(args\)/);
  assert.match(source('haltRealtimeActivity'), /pendingSessionMapMove = null/);
  assert.match(source('handleEvent'), /event.response.status !== "completed"/);
  assert.match(source('connectSelectedContinuityFilename'), /loadFreshContinuityContext/);
  assert.match(source('resetSessionContextForConnection'), /clearSensingEyeState/);
});

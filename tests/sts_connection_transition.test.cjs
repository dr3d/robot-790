const assert = require('node:assert/strict');
const { test } = require('node:test');
const { saveFixture, deferred, settle, installConnectionFixture } = require('./helpers/sts_save_harness.cjs');
const { loadFunctions } = require('./helpers/sts_tool_harness.cjs');
const { create } = require('../web/sts/realtime-connection.js');

function installNavigation(f) {
  Object.assign(f.c, {
    connectionButtonsLocked: false,
    connectButton: {}, previousConnectButton: {}, emptyConnectButton: {},
    updateContinuitySessionActionButtons() {},
    currentContinuityScrubMode: () => 'auto', continuityScrubMode: { value: 'auto' },
    normalizeContinuityScrubMode: value => value,
    updateContinuityScrubModeUi() {}, currentUiSettingsSnapshot: () => ({}),
    continuityScrubModeLabel: value => value,
    rewindContinuitySessionToPrevious: async () => ({ restored_session_filename: 'sessions/previous.txt' }),
    resolveContinuitySessionForLoad: async filename => ({ status: 'ok', session_filename: filename || 'sessions/saved-1.txt' }),
    fetchContinuitySessionMetadata: async (filename, resume_form) => ({ status: 'ok', session_filename: filename, resume_form }),
  });
  loadFunctions(f.c, ['setConnectionButtonsDisabled', 'connectPrevious', 'connectSelectedContinuityFilename', 'loadPreviousContinuityContext']);
}

async function disconnectedFixture() {
  const f = saveFixture();
  await f.c.disconnectRealtime();
  f.sockets = installConnectionFixture(f);
  return f;
}

test('Connect and Empty cannot prepare competing contexts before a socket exists', async () => {
  const f = await disconnectedFixture(), gate = deferred();
  let entries = 0;
  f.c.ensureRuntimeConfigLoaded = async () => { entries++; await gate.promise; };
  const first = f.c.connect(), second = f.c.connect({ coreNotesOnly: true });
  await settle();
  try { assert.equal(entries, 1); }
  finally { gate.resolve(); await Promise.all([first, second]); }
  assert.equal(f.sockets.length, 1);
  assert.equal(f.calls.filter(call => call === 'clear old transcript').length, 1);
});

test('Connect waits out the entire Disconnect, including snapshots after socket closure', async () => {
  const f = saveFixture(), gate = deferred();
  const sockets = installConnectionFixture(f);
  f.c.recordExitPaneSnapshots = async () => { f.calls.push('snapshots pending'); await gate.promise; };
  const stopping = f.c.disconnectRealtime();
  await settle();
  assert(f.calls.includes('snapshots pending'));
  assert.equal(f.socket.readyState, 3);
  try {
    await f.c.connect();
    assert.equal(sockets.length, 0);
    assert.deepEqual([...f.c.conversationLines], ['The last accepted thought.']);
    assert(!f.calls.includes('clear old transcript'));
  } finally { gate.resolve(); await stopping; }
  await f.c.connect();
  assert.equal(sockets.length, 1);
});

test('Disconnect cannot save half-loaded history while Connect preparation is pending', async () => {
  const f = await disconnectedFixture(), gate = deferred();
  f.c.loadCoreNoteContext = async () => { await gate.promise; };
  const connecting = f.c.connect();
  await settle();
  const before = [...f.calls], requests = f.requests.length;
  try {
    await f.c.disconnectRealtime();
    assert.deepEqual(f.calls, before);
    assert.equal(f.requests.length, requests);
  } finally { gate.resolve(); await connecting; }
  assert.equal(f.sockets.length, 1);
  assert.equal(f.c.realtimeConnection.stopped, false);
});

for (const stage of ['ensureRuntimeConfigLoaded', 'confirmContinuitySessionLoad',
  'loadCoreNoteContext', 'pauseSessionPreparation', 'prepareConnectionContext', 'ensurePlayback']) {
  test(`all normal entry points respect an active Connect at ${stage}`, async () => {
    const f = await disconnectedFixture(), gate = deferred();
    installNavigation(f);
    const original = f.c[stage];
    let entered = 0;
    f.c[stage] = async (...args) => { entered++; await gate.promise; return original(...args); };
    const first = f.c.connect();
    await settle();
    try {
      assert.equal(entered, 1);
      assert.equal(f.c.realtimeConnection.transition.kind, 'connect');
      await f.c.connect();
      await f.c.connect({ coreNotesOnly: true });
      await f.c.connectPrevious();
      await assert.rejects(f.c.connectSelectedContinuityFilename('sessions/other.txt'), /already/);
      await f.c.disconnectRealtime();
      assert.equal(entered, 1);
      assert.equal(f.sockets.length, 0);
      assert.equal(f.requests.length, 1, 'only the fixture baseline was saved');
      assert.equal(f.c.connectButton.disabled, true);
    } finally { gate.resolve(); await first; }
    assert.equal(f.sockets.length, 1);
    assert.equal(f.c.realtimeConnection.transition, null);
    assert.equal(f.c.connectButton.disabled, true, 'transport is now CONNECTING');
  });
}

for (const kind of ['previous', 'selected']) {
  test(`${kind} owns preflight through nested Connect, with one history load`, async () => {
    const f = await disconnectedFixture(), gate = deferred();
    installNavigation(f);
    const stage = kind === 'previous' ? 'rewindContinuitySessionToPrevious' : 'fetchContinuitySessionMetadata';
    const original = f.c[stage];
    let entered = 0;
    f.c[stage] = async (...args) => { entered++; if (entered === 1) await gate.promise; return original(...args); };
    const starting = kind === 'previous' ? f.c.connectPrevious() : f.c.connectSelectedContinuityFilename('sessions/selected.txt');
    await settle();
    try {
      assert.equal(f.c.realtimeConnection.transition.kind, kind);
      await f.c.connect({ coreNotesOnly: true });
      await f.c.connectPrevious();
      await f.c.disconnectRealtime();
      await assert.rejects(f.c.connectSelectedContinuityFilename('sessions/other.txt'), /already/);
      assert.equal(f.sockets.length, 0);
      assert.equal(entered, 1);
    } finally { gate.resolve(); await starting; }
    assert.equal(f.sockets.length, 1);
    assert.equal(f.c.continuityParentForCurrentRun, `sessions/${kind}.txt`);
    assert.equal(f.calls.filter(call => call === 'clear old transcript').length, 1);
    assert.equal(f.calls.filter(call => call === 'preparation lease').length, 1);
    assert.equal(f.c.realtimeConnection.transition, null);
  });
}

test('Previous and selected preflight failures release ownership without clearing the saved transcript', async () => {
  const f = await disconnectedFixture();
  installNavigation(f);
  const rewind = f.c.rewindContinuitySessionToPrevious;
  f.c.rewindContinuitySessionToPrevious = async () => { throw new Error('missing previous'); };
  await f.c.connectPrevious();
  assert.equal(f.c.realtimeConnection.transition, null);
  assert.equal(f.c.connectButton.disabled, false);
  assert.deepEqual([...f.c.conversationLines], ['The last accepted thought.']);
  f.c.rewindContinuitySessionToPrevious = rewind;
  const metadata = f.c.fetchContinuitySessionMetadata;
  f.c.fetchContinuitySessionMetadata = async () => { throw new Error('missing selected'); };
  await assert.rejects(f.c.connectSelectedContinuityFilename('sessions/selected.txt'), /missing selected/);
  assert.equal(f.c.realtimeConnection.transition, null);
  assert.equal(f.c.connectButton.disabled, false);
  assert.deepEqual([...f.c.conversationLines], ['The last accepted thought.']);
  f.c.fetchContinuitySessionMetadata = metadata;
  await f.c.connectSelectedContinuityFilename('sessions/selected.txt');
  assert.equal(f.sockets.length, 1);
});

test('socket-close UI unlock cannot admit Connect until Disconnect finishes snapshots', async () => {
  const f = saveFixture(), gate = deferred();
  const sockets = installConnectionFixture(f);
  installNavigation(f);
  f.socket.close = () => {
    f.socket.readyState = 3;
    f.c.setConnectionButtonsDisabled(false);
  };
  f.c.recordExitPaneSnapshots = () => gate.promise;
  const stop = f.c.disconnectRealtime();
  await settle();
  try {
    assert.equal(f.socket.readyState, 3);
    for (const name of ['connectButton', 'previousConnectButton', 'emptyConnectButton']) assert.equal(f.c[name].disabled, true);
    await f.c.connect();
    assert.equal(sockets.length, 0);
  } finally { gate.resolve(); await stop; }
  assert.equal(f.c.connectButton.disabled, false);
  await f.c.connect();
  assert.equal(sockets.length, 1);
});

test('session jump composes real Disconnect and selected Connect under the same operation', async () => {
  const f = saveFixture(), sockets = installConnectionFixture(f);
  installNavigation(f);
  await f.c.runConnectionTransition('session map move', async transition => {
    const saved = await f.c.disconnectRealtime({ reloadSavedNote: false, transition });
    assert.equal(saved.status, 'ok');
    assert.equal(f.c.realtimeConnection.transition, transition);
    await f.c.connect({ coreNotesOnly: true });
    assert.equal(sockets.length, 0, 'competing entry is rejected even between save and destination load');
    await f.c.connectSelectedContinuityFilename('sessions/destination.txt', 'Enter Session', 'auto', transition);
    assert.equal(f.c.realtimeConnection.transition, transition, 'nested Connect cannot release the parent');
  });
  assert.equal(f.c.continuityParentForCurrentRun, 'sessions/destination.txt');
  assert.equal(f.c.realtimeConnection.transition, null);
  assert.equal(sockets.length, 1);
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].parent_session_filename, 'sessions/parent.txt');
  assert(!f.calls.some(call => call.startsWith('reload:')));
});

test('transition owner rejects competing work, permits explicit composition, and releases on failure', async () => {
  const owner = create(), gate = deferred();
  let outer;
  const running = owner.runTransition('outer', async token => {
    outer = token;
    await owner.runTransition('child', async child => {
      assert.equal(child, token);
      await gate.promise;
    }, token);
    assert.equal(owner.transition, token);
    throw new Error('operation failed');
  });
  await assert.rejects(owner.runTransition('competitor', () => assert.fail('must not enter')), /already/);
  const failed = assert.rejects(running, /operation failed/);
  gate.resolve();
  await failed;
  assert.equal(owner.transition, null);
  await owner.runTransition('next', async token => {
    await assert.rejects(owner.runTransition('stale child', () => assert.fail('must not enter'), outer), /expired/);
    assert.equal(owner.transition, token, 'an expired child cannot release newer ownership');
  });
  assert.equal(owner.transition, null);
  await assert.rejects(owner.runTransition('sync failure', () => { throw new Error('synchronous'); }), /synchronous/);
  assert.equal(owner.transition, null);
});

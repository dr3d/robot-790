const assert = require('node:assert/strict');
const { test } = require('node:test');
const { exitFixture, pageExitFixture } = require('./helpers/sts_exit_harness.cjs');
const { settle, deferred } = require('./helpers/sts_save_harness.cjs');
const { page } = require('./helpers/sts_tool_harness.cjs');

const actions = [
  ['restart', 'restartRealtimeServer', '/api/realtime/restart'],
  ['halt', 'haltRealtimeServer', '/api/realtime/stop'],
  ['unload', 'unloadRealtimeServer', '/api/realtime/unload'],
];

for (const [kind, method, pathname] of actions) {
  test(`${kind} preserves accepted words and calls its existing backend endpoint, not a continuity save`, async () => {
    const f = await exitFixture();
    f.c.audioRecordingActive = () => true;
    const parent = f.c.continuityParentForCurrentRun;
    await f.c[method]();
    await settle();
    assert.equal(f.backendRequests.length, 1);
    assert.equal(f.backendRequests[0].pathname, pathname);
    assert.equal(f.backendRequests[0].method, 'POST');
    if (kind === 'restart') assert.deepEqual(JSON.parse(f.backendRequests[0].body), { preset: 'fixture-model', context: 131072 });
    if (kind === 'unload') assert.equal(f.backendRequests[0].body, '{}');
    assert.deepEqual([...f.c.conversationLines], ['Keep this unsaved exchange.']);
    assert.equal(f.c.continuityParentForCurrentRun, parent);
    assert.deepEqual([...f.c.eyeAssets], ['retained.jpg']);
    assert.equal(f.requests.length, 0);
    assert.equal(f.sockets.length, 1, 'no automatic reconnect');
    assert.equal(f.calls.filter(call => call === 'mic stop').length, 1);
    assert.equal(f.calls.filter(call => call === 'recording stop').length, 1);
    assert.equal(f.calls.filter(call => call === 'pane snapshots').length, 1);
  });

  test(`${kind} backend rejection retains words and reports failure without inventing a save`, async () => {
    const f = await exitFixture();
    f.c.fetch = async () => ({ ok: false, json: async () => ({ error: 'fixture rejection' }) });
    await f.c[method]();
    await settle();
    assert(f.calls.some(call => call === `realtime ${kind} error: fixture rejection`));
    assert.deepEqual([...f.c.conversationLines], ['Keep this unsaved exchange.']);
    assert.equal(f.requests.length, 0);
    assert.equal(f.sockets.length, 1);
  });
}

for (const kind of ['restart', 'unload']) {
  test(`${kind} delayed completion retains its existing status wording without auto-connecting`, async () => {
    const f = await exitFixture();
    await f.c[kind === 'restart' ? 'restartRealtimeServer' : 'unloadRealtimeServer']();
    await settle();
    f.fireStatusTimer(kind);
    assert(f.calls.includes(`state: ${kind === 'restart' ? 'Disconnected' : 'Unloaded'}`));
    assert.equal(f.c.restartServerButton.disabled, false);
    assert.equal(f.c.unloadServerButton.disabled, false);
    assert.equal(f.sockets.length, 1);
    assert.equal(f.requests.length, 0);
  });

  test(`${kind} old completion cannot relabel or unlock a newer connection`, async () => {
    const f = await exitFixture();
    await f.c[kind === 'restart' ? 'restartRealtimeServer' : 'unloadRealtimeServer']();
    await settle();
    f.c.realtimeConnection.adopt({ readyState: 1 });
    f.c.setState('Connected');
    f.c.setConnectionButtonsDisabled(true);
    const before = f.calls.length;
    f.fireStatusTimer(kind);
    assert.equal(f.c.connectionButtonsLocked, true);
    assert.ok(!f.calls.slice(before).some(call => call.startsWith('state:')));
    assert.equal(f.c.restartServerButton.disabled, false, 'old controls must not remain stuck disabled');
    assert.equal(f.c.unloadServerButton.disabled, false);
  });

  test(`${kind} captured completion is harmless after emergency Halt`, async () => {
    const f = await exitFixture();
    await f.c[kind === 'restart' ? 'restartRealtimeServer' : 'unloadRealtimeServer']();
    await settle();
    const oldCallback = f.takeStatusTimer(kind);
    await f.c.haltRealtimeServer();
    const before = [...f.calls];
    oldCallback();
    assert.deepEqual(f.calls, before);
    assert.equal(f.backendRequests.at(-1).pathname, '/api/realtime/stop');
  });

  for (const ok of [true, false]) {
    test(`${kind} late HTTP ${ok ? 'success' : 'failure'} cannot overwrite a newer connection`, async () => {
      const f = await exitFixture(), gate = deferred(), fetch = f.c.fetch;
      f.c.fetch = async (...args) => {
        const result = await fetch(...args);
        await gate.promise;
        return ok ? result : { ok: false, json: async () => ({ error: 'old failure' }) };
      };
      const pending = f.c[kind === 'restart' ? 'restartRealtimeServer' : 'unloadRealtimeServer']();
      await settle();
      f.c.realtimeConnection.adopt({ readyState: 1 });
      f.c.setState('Connected');
      f.c.setConnectionButtonsDisabled(true);
      const before = f.calls.length;
      gate.resolve();
      await pending;
      if (ok) f.fireStatusTimer(kind);
      assert.ok(!f.calls.slice(before).some(call => call.startsWith('state:')));
      assert.equal(f.c.connectionButtonsLocked, true);
      assert.equal(f.c.restartServerButton.disabled, false);
    });
  }
}

test('an old restart callback cannot unlock controls belonging to a pending unload', async () => {
  const f = await exitFixture(), gate = deferred(), fetch = f.c.fetch;
  await f.c.restartRealtimeServer();
  await settle();
  const callback = f.takeStatusTimer('restart');
  f.c.fetch = async (...args) => { const result = await fetch(...args); await gate.promise; return result; };
  const unloading = f.c.unloadRealtimeServer();
  await settle();
  callback();
  assert.equal(f.c.restartServerButton.disabled, true);
  assert.equal(f.c.unloadServerButton.disabled, true);
  assert.ok(f.c.haltRuntimeButtons.every(button => !button.disabled), 'emergency Halt remains available');
  gate.resolve();
  await unloading;
  f.fireStatusTimer('unload');
  assert.equal(f.c.restartServerButton.disabled, false);
});

test('a newer intentional exit invalidates old status without stranding backend controls', async () => {
  const f = await exitFixture();
  await f.c.restartRealtimeServer();
  await settle();
  f.c.beginIntentionalExitCleanup({ saving: true });
  f.c.setState('Stopped; saving');
  f.c.setConnectionButtonsDisabled(true);
  const before = f.calls.length;
  f.fireStatusTimer('restart');
  assert.equal(f.c.connectionButtonsLocked, true);
  assert.ok(!f.calls.slice(before).some(call => call.startsWith('state:')));
  assert.equal(f.c.restartServerButton.disabled, false);
});

test('old feedback cannot relabel a new connection preparation before its socket is adopted', async () => {
  const f = await exitFixture(), gate = deferred();
  await f.c.restartRealtimeServer();
  await settle();
  const preparation = f.c.runConnectionTransition('connect', () => gate.promise);
  const before = f.calls.length;
  f.fireStatusTimer('restart');
  assert.ok(!f.calls.slice(before).some(call => call.startsWith('state:')));
  assert.equal(f.c.connectButton.disabled, true);
  gate.resolve();
  await preparation;
});

test('a late Halt receipt cannot disable microphone controls in a newer connection', async () => {
  const f = await exitFixture(), gate = deferred(), fetch = f.c.fetch;
  f.c.fetch = async (...args) => { const result = await fetch(...args); await gate.promise; return result; };
  const halting = f.c.haltRealtimeServer();
  await settle();
  f.c.realtimeConnection.adopt({ readyState: 1 });
  f.c.startMicButton.disabled = false;
  f.c.stopMicButton.disabled = false;
  f.c.setConnectionButtonsDisabled(true);
  const before = f.calls.length;
  gate.resolve();
  await halting;
  assert.equal(f.c.startMicButton.disabled, false);
  assert.equal(f.c.stopMicButton.disabled, false);
  assert.equal(f.c.connectionButtonsLocked, true);
  assert.ok(!f.calls.slice(before).some(call => call.startsWith('state:')));
});

test('unused thread controls and their dedicated reset/save paths are removed', () => {
  for (const name of ['latestThreadExpando', 'conversationNoteFilename', 'conversationNoteSave',
    'conversationNoteResetAfterSave', 'clearLatestThread', 'resetToPinnedContext',
    'saveConversationThreadNote', 'updateConversationThreadButtons', 'conversationThreadFilenameValue',
    'writeOperatorNoteFile', 'timestampForFilename', 'waitForRealtimeOpen',
    'thread-note-control', 'thread-reset-option']) {
    assert.equal(page.includes(name), false, name);
  }
});

test('the existing memory-loading checkbox remains under Pinned Notes', () => {
  const start = page.indexOf('<details id="pinnedNotesExpando"');
  const panel = page.slice(start, page.indexOf('</details>', start));
  assert.match(panel, /id="loadedNoteSelect"/);
  assert.match(panel, /id="loadedNoteUnpin"/);
  assert.match(panel, /id="loadEricMemories" type="checkbox" checked/);
  assert.equal((page.match(/id="loadEricMemories"/g) || []).length, 1);
});

test('beforeunload only warns for the recording condition; cancellation does not stop the session', () => {
  const f = pageExitFixture(), callback = f.listeners.get('beforeunload')[0];
  const event = { preventDefault() { f.calls.push('prevent unload'); } };
  assert.equal(callback(event), undefined);
  assert.deepEqual(f.calls, []);
  f.c.warning = true;
  assert.equal(callback(event), '');
  assert.equal(event.returnValue, '');
  assert.deepEqual(f.calls, ['beacons', 'prevent unload']);
});

test('pagehide performs best-effort local cleanup and log beacons, not a continuity transaction', () => {
  const f = pageExitFixture();
  for (const callback of f.listeners.get('pagehide')) callback();
  assert.equal(f.c.window.__robot790PageUnloading, true);
  assert.deepEqual(f.calls, ['popouts closed', 'beacons', 'browser camera stop', 'network camera stop', 'idle art disarm']);
});

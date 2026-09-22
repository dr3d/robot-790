const assert = require('node:assert/strict');
const { test } = require('node:test');
const { saveFixture, deferred, settle, installConnectionFixture } = require('./helpers/sts_save_harness.cjs');

test('an old cleanup timer cannot end a newer cleanup', () => {
  const f = saveFixture();
  const first = f.c.beginIntentionalExitCleanup();
  f.c.endIntentionalExitCleanupSoon(first);
  const second = f.c.beginIntentionalExitCleanup();
  f.fireTimer(5000);
  assert.equal(f.c.intentionalExitCleanupInProgress, true);
  f.c.endIntentionalExitCleanupSoon(second);
  f.fireTimer(5000);
  assert.equal(f.c.intentionalExitCleanupInProgress, false);
});

test('a late finally block cannot release cleanup begun by another operation', () => {
  const f = saveFixture();
  const first = f.c.beginIntentionalExitCleanup();
  const second = f.c.beginIntentionalExitCleanup();
  f.c.endIntentionalExitCleanupSoon(first);
  f.fireTimer(5000);
  assert.equal(f.c.intentionalExitCleanupInProgress, true);
  f.c.endIntentionalExitCleanupSoon(second);
  f.fireTimer(5000);
  assert.equal(f.c.intentionalExitCleanupInProgress, false);
});

test('Disconnect composes the real save request and closes only after its receipt', async () => {
  const f = saveFixture(), gate = deferred(), fetch = f.c.fetch;
  f.c.fetch = async (...args) => { await gate.promise; return fetch(...args); };
  const stopping = f.c.disconnectRealtime();
  await settle();
  assert.equal(f.c.realtimeStopRequested, true);
  assert.equal(f.c.continuitySaveBusy, true);
  assert.equal(f.c.continuitySaveHalted, false);
  assert.equal(f.socket.readyState, 1);
  assert.deepEqual(Array.from(f.c.eyeAssets), ['existing-image.jpg']);
  gate.resolve();
  const result = await stopping;
  assert.equal(result.status, 'ok');
  assert.equal(result.session_filename, 'sessions/saved-1.txt');
  assert.deepEqual(f.requests, [{
    body: 'The last accepted thought.', pinned_filenames: ['core/example.txt'],
    parent_session_filename: 'sessions/parent.txt',
    sensing_eye_filenames: ['existing-image.jpg'], context_at_save: { input_tokens: 53606 },
  }]);
  assert.equal(f.c.continuitySaveHalted, true);
  assert.equal(f.c.continuitySaveBusy, false);
  assert.equal(f.socket.readyState, 3);
  assert.equal(f.c.continuityParentForCurrentRun, result.session_filename);
  assert.ok(f.calls.indexOf('reload: sessions/saved-1.txt') < f.calls.indexOf('socket close'));
});

test('an explicit failed save retains transcript, parent and eye assets for retry', async () => {
  const f = saveFixture(), fetch = f.c.fetch;
  f.c.fetch = async () => ({ ok: false, json: async () => ({ error: 'disk full' }) });
  assert.equal((await f.c.disconnectRealtime()).status, 'error');
  assert.equal(f.c.continuitySaveHalted, false);
  assert.equal(f.c.continuityParentForCurrentRun, 'sessions/parent.txt');
  assert.deepEqual(Array.from(f.c.conversationLines), ['The last accepted thought.']);
  assert.deepEqual(Array.from(f.c.eyeAssets), ['existing-image.jpg']);
  assert.equal(f.socket.readyState, 1);
  await f.c.connect();
  assert.ok(f.calls.some(text => text.startsWith('connect blocked:')));
  f.c.fetch = fetch;
  assert.equal((await f.c.disconnectRealtime()).status, 'ok');
  assert.equal(f.saved.size, 1);
  assert.equal(f.requests[0].parent_session_filename, 'sessions/parent.txt');
  assert.equal(f.calls.filter(call => call === 'response.cancel').length, 1);
});

test('a final transcript received during settling is in the save payload', async () => {
  const f = saveFixture(), gate = deferred();
  f.c.conversationLines = [];
  f.c.inputAudioTranscriptionPending = true;
  f.c.sleepMs = () => gate.promise;
  const stopping = f.c.disconnectRealtime();
  await settle();
  assert.equal(f.requests.length, 0);
  f.c.conversationLines.push('The final STT result.');
  f.c.inputAudioTranscriptionPending = false;
  gate.resolve();
  assert.equal((await stopping).status, 'ok');
  assert.equal(f.requests[0].body, 'The final STT result.');
});

test('overlapping Disconnect and Save + Halt do not submit competing save requests', async () => {
  const f = saveFixture(), gate = deferred(), fetch = f.c.fetch;
  f.c.fetch = async (...args) => { await gate.promise; return fetch(...args); };
  const first = f.c.disconnectRealtime();
  await settle();
  await f.c.disconnectRealtime();
  await f.c.saveAndHaltEricState();
  gate.resolve();
  await first;
  assert.equal(f.requests.length, 1);
  assert.equal(f.calls.filter(call => call === 'socket close').length, 1);
});

test('an empty Disconnect stops and closes without inventing a session note', async () => {
  const f = saveFixture();
  f.c.conversationLines = [];
  const result = await f.c.disconnectRealtime();
  assert.equal(result.status, 'ok');
  assert.equal(result.session_filename, null);
  assert.equal(f.saved.size, 0);
  assert.equal(f.socket.readyState, 3);
});

test('post-save map refresh failure does not invalidate an acknowledged write', async () => {
  const f = saveFixture();
  f.c.fetchContinuitySessions = async () => { throw new Error('map offline'); };
  assert.equal((await f.c.disconnectRealtime()).status, 'ok');
  assert.equal(f.saved.size, 1);
  assert.equal(f.c.continuitySaveHalted, true);
});

test('reloadSavedNote false skips pin reload but still saves and preserves the receipt', async () => {
  const f = saveFixture();
  f.c.readTextFile = async () => assert.fail('session-map jump must not reload departing history');
  const result = await f.c.disconnectRealtime({ reloadSavedNote: false });
  assert.equal(result.status, 'ok');
  assert.equal(f.saved.size, 1);
});

test('a successful Save + Halt uses the same real snapshot save path', async () => {
  const f = saveFixture();
  await f.c.saveAndHaltEricState();
  assert.equal(f.saved.size, 1);
  assert.equal(f.c.continuitySaveHalted, true);
  assert.equal(f.c.continuitySaveBusy, false);
  assert.equal(f.socket.readyState, 3);
  assert.equal(f.c.saveAndHaltEricButton.textContent, 'Start Eric');
});

test('Start Eric after Save + Halt prepares a clean connection with saved history', async () => {
  const f = saveFixture(), sockets = installConnectionFixture(f);
  await f.c.saveAndHaltEricState();
  await f.c.startContinuityEric();
  assert.equal(sockets.length, 1);
  assert.equal(f.c.ws, sockets[0]);
  assert.equal(f.c.realtimeStopRequested, false);
  assert.equal(f.c.continuitySaveHalted, false);
  assert.equal(f.c.continuitySaveBusy, false);
  assert.deepEqual(Array.from(f.c.conversationLines), []);
  assert.equal(f.c.continuityParentForCurrentRun, 'sessions/saved-1.txt');
  assert.deepEqual(Array.from(f.c.loadedNoteContexts, note => note.filename),
    ['core/example.txt', 'sessions/saved-1.txt']);
  assert.ok(f.calls.includes('context budget'));
  assert.ok(!f.calls.some(line => line.startsWith('connect blocked:')));
});

test('Start Eric keeps successful-save state through failed preparation and permits retry', async () => {
  const f = saveFixture(), sockets = installConnectionFixture(f);
  await f.c.saveAndHaltEricState();
  const prepare = f.c.prepareConnectionContext;
  f.c.prepareConnectionContext = async () => { throw new Error('budget unavailable'); };
  await f.c.startContinuityEric();
  assert.equal(sockets.length, 0);
  assert.equal(f.c.continuitySaveHalted, true);
  assert.equal(f.c.continuitySaveBusy, false);
  assert.equal(f.c.saveAndHaltEricButton.textContent, 'Start Eric');
  assert.ok(f.calls.includes('release preparation lease'));
  f.c.prepareConnectionContext = prepare;
  await f.c.startContinuityEric();
  assert.equal(sockets.length, 1);
  assert.equal(f.saved.size, 1, 'startup retries do not save again');
});

test('Start Eric cannot bypass the unsaved stopped-session guard', async () => {
  const f = saveFixture(), sockets = installConnectionFixture(f);
  f.c.realtimeStopRequested = true;
  await f.c.startContinuityEric();
  assert.equal(sockets.length, 0);
  assert.deepEqual(Array.from(f.c.conversationLines), ['The last accepted thought.']);
  assert.equal(f.c.continuitySaveHalted, false);
  assert.ok(f.calls.some(line => line.startsWith('connect blocked:')));
});

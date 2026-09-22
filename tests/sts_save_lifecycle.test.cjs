const assert = require('node:assert/strict');
const { test } = require('node:test');
const { saveFixture, deferred, settle, installConnectionFixture } = require('./helpers/sts_save_harness.cjs');
const { page } = require('./helpers/sts_tool_harness.cjs');
const { loadFunctions } = require('./helpers/sts_tool_harness.cjs');

test('the unused alternate save/resume UI and implementation are removed', () => {
  assert.doesNotMatch(page, /saveAndHaltEric|startContinuityEric|toggleEricSaveAndHalt|updateSaveAndHaltButton|loadLatestContinuitySession|Save \+ Halt|Start Eric/);
  for (const id of ['connect', 'disconnect', 'haltRuntime', 'restartServer', 'unloadServer']) {
    assert.ok(page.includes(`id="${id}"`), `${id} remains available`);
  }
});

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
  assert.equal(f.c.realtimeConnection.transition?.kind, 'disconnect');
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
    save_request_id: f.c.continuitySaveTransaction.request.requestId,
  }]);
  assert.equal(f.c.continuitySaveHalted, true);
  assert.equal(f.c.realtimeConnection.transition, null);
  assert.equal(f.socket.readyState, 3);
  assert.equal(f.c.continuityParentForCurrentRun, result.session_filename);
  assert.ok(f.calls.indexOf('reload: sessions/saved-1.txt') < f.calls.indexOf('socket close'));
});

test('a timed-out eye flush cannot later submit a second save', async () => {
  const f = saveFixture(), gate = deferred();
  f.c.flushSensingEyeInboxForSessionSave = () => gate.promise;
  const first = f.c.disconnectRealtime();
  await settle();
  f.fireTimer(16000);
  assert.equal((await first).status, 'error');
  assert.equal(f.requests.length, 0);
  f.c.flushSensingEyeInboxForSessionSave = async () => {};
  assert.equal((await f.c.disconnectRealtime()).status, 'ok');
  gate.resolve();
  await settle();
  assert.equal(f.saved.size, 1);
  assert.equal(f.requests.length, 1);
  assert.equal(f.c.currentContinuitySessionFilename, 'sessions/saved-1.txt');
  assert.equal(f.requests[0].parent_session_filename, 'sessions/parent.txt');
});

test('a lost HTTP reply retries the same frozen save even if surrounding state changes', async () => {
  const f = saveFixture(), fetch = f.c.fetch;
  f.c.fetch = async (...args) => { await fetch(...args); throw new Error('reply lost'); };
  assert.equal((await f.c.disconnectRealtime()).status, 'error');
  assert.equal(f.saved.size, 1);
  assert.equal(f.c.continuitySaveHalted, false);
  f.c.contextUsageForSessionSave = () => ({ input_tokens: 123 });
  f.c.continuityParentForCurrentRun = 'sessions/not-the-real-parent.txt';
  f.c.buildEricContinuitySessionBody = () => 'Not the frozen snapshot';
  f.c.fetch = fetch;
  assert.equal((await f.c.disconnectRealtime()).status, 'ok');
  assert.equal(f.saved.size, 1);
  assert.equal(f.requests.length, 2);
  assert.deepEqual(f.requests[0], f.requests[1]);
  assert.equal(f.c.continuityParentForCurrentRun, 'sessions/saved-1.txt');
});

test('a late write receipt cannot repoint a newer session or clear its assets', async () => {
  const f = saveFixture(), gate = deferred(), fetch = f.c.fetch;
  f.c.fetch = async (...args) => { const response = await fetch(...args); await gate.promise; return response; };
  const first = f.c.disconnectRealtime();
  await settle();
  f.fireTimer(12000);
  assert.equal((await first).status, 'error');
  f.c.fetch = fetch;
  assert.equal((await f.c.disconnectRealtime()).status, 'ok');
  f.c.realtimeSessionGeneration += 1;
  f.c.currentContinuitySessionFilename = 'sessions/newer.txt';
  f.c.continuityParentForCurrentRun = 'sessions/newer.txt';
  f.c.eyeAssets = ['newer-image.jpg'];
  gate.resolve();
  await settle();
  assert.equal(f.saved.size, 1);
  assert.equal(f.c.currentContinuitySessionFilename, 'sessions/newer.txt');
  assert.equal(f.c.continuityParentForCurrentRun, 'sessions/newer.txt');
  assert.deepEqual(f.c.eyeAssets, ['newer-image.jpg']);
});

test('optional readback can hang without blocking Disconnect or pinning into a new session', async () => {
  const f = saveFixture(), gate = deferred();
  f.c.readTextFile = ({ pin }) => { assert.equal(pin, false); return gate.promise; };
  assert.equal((await f.c.disconnectRealtime()).status, 'ok');
  assert.equal(f.c.continuitySaveHalted, true);
  assert.equal(f.socket.readyState, 3);
  f.c.realtimeSessionGeneration += 1;
  f.c.currentContinuitySessionFilename = 'sessions/newer.txt';
  gate.resolve({ filename: 'sessions/saved-1.txt' });
  await settle();
  assert.equal(f.calls.filter(item => item.startsWith('pin:')).length, 0);
});

test('repeated Disconnect after acknowledgement cannot save again', async () => {
  const f = saveFixture();
  await f.c.disconnectRealtime();
  await f.c.disconnectRealtime();
  assert.equal(f.saved.size, 1);
  assert.equal(f.requests.length, 1);
});

test('a new session gets a distinct save identity and its actual parent', async () => {
  const f = saveFixture();
  await f.c.disconnectRealtime();
  f.c.realtimeSessionGeneration += 1;
  f.c.conversationLines = ['Next session.'];
  await f.c.disconnectRealtime();
  assert.equal(f.saved.size, 2);
  assert.notEqual(f.requests[0].save_request_id, f.requests[1].save_request_id);
  assert.equal(f.requests[1].parent_session_filename, 'sessions/saved-1.txt');
});

test('LAN fallback still generates distinct canonical UUID save identities', () => {
  const f = saveFixture();
  f.c.crypto = { getRandomValues: bytes => require('node:crypto').webcrypto.getRandomValues(bytes) };
  const ids = Array.from({ length: 20 }, () => f.c.continuitySaveRequestId());
  assert.equal(new Set(ids).size, 20);
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('invalid receipts are not cached as successful writes', async () => {
  const f = saveFixture(), fetch = f.c.fetch;
  f.c.fetch = async (_, options) => ({ ok: true, json: async () => ({
    status: 'ok', save_request_id: JSON.parse(options.body).save_request_id,
  }) });
  assert.equal((await f.c.disconnectRealtime()).status, 'error');
  assert.equal(f.c.continuitySaveTransaction.result, null);
  f.c.fetch = fetch;
  assert.equal((await f.c.disconnectRealtime()).status, 'ok');
});

test('the old page server is rejected without falling back to a duplicate-prone write', async () => {
  const f = saveFixture();
  let requests = 0;
  f.c.fetch = async () => { requests++; return { ok: false, status: 404, json: async () => ({}) }; };
  const result = await f.c.disconnectRealtime();
  assert.equal(result.status, 'error');
  assert.match(result.error, /Restart the STS page server/);
  assert.equal(requests, 1);
  assert.equal(f.c.continuitySaveHalted, false);
});

test('a late optional map refresh cannot overwrite a newer selection', async () => {
  const f = saveFixture(), gate = deferred();
  let current = true, rendered = 0;
  f.c.continuitySessionRefreshTimer = null;
  f.c.continuitySessions = ['newer session'];
  f.c.renderContinuitySessionSelect = () => { rendered++; };
  f.c.fetch = () => gate.promise;
  loadFunctions(f.c, ['fetchContinuitySessions']);
  const refresh = f.c.fetchContinuitySessions({ isCurrent: () => current });
  current = false;
  gate.resolve({ ok: true, json: async () => ({ status: 'ok', sessions: ['old session'] }) });
  await refresh;
  assert.equal(rendered, 0);
  assert.deepEqual(f.c.continuitySessions, ['newer session']);
});

test('an expired save flush cannot apply a late image-inbox reply', async () => {
  const f = saveFixture(), gate = deferred();
  let current = true, applied = 0;
  f.c.sensingEyeGeneration = 1;
  f.c.fetchSensingEyeInboxItem = () => gate.promise;
  f.c.applySensingEyeInboxItem = async () => { applied++; };
  loadFunctions(f.c, ['flushSensingEyeInboxForSessionSave']);
  const flush = f.c.flushSensingEyeInboxForSessionSave({ isCurrent: () => current });
  current = false;
  gate.resolve({ seq: 1 });
  await flush;
  assert.equal(applied, 0);
});

test('a retained eye asset survives a timeout while its preview is decoding', async () => {
  const f = saveFixture(), decoding = deferred();
  f.c.sensingEyeGeneration = 1;
  f.c.fetchSensingEyeInboxItem = async () => ({ saved_filename: 'accepted-capture.jpg' });
  f.c.rememberSensingEyeSessionAsset = filename => f.c.eyeAssets.push(filename);
  f.c.applySensingEyeInboxItem = () => decoding.promise;
  loadFunctions(f.c, ['flushSensingEyeInboxForSessionSave']);
  const first = f.c.disconnectRealtime();
  await settle();
  f.fireTimer(16000);
  assert.equal((await first).status, 'error');
  f.c.fetchSensingEyeInboxItem = async () => null;
  assert.equal((await f.c.disconnectRealtime()).status, 'ok');
  assert.deepEqual(f.requests[0].sensing_eye_filenames, ['existing-image.jpg', 'accepted-capture.jpg']);
  decoding.resolve();
  await settle();
  assert.equal(f.saved.size, 1);
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

test('repeated Disconnect clicks do not submit competing save requests', async () => {
  const f = saveFixture(), gate = deferred(), fetch = f.c.fetch;
  f.c.fetch = async (...args) => { await gate.promise; return fetch(...args); };
  const first = f.c.disconnectRealtime();
  await settle();
  await f.c.disconnectRealtime();
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

test('failed note reload does not turn an acknowledged write into a failed Disconnect', async () => {
  const f = saveFixture(), sockets = installConnectionFixture(f);
  f.c.readTextFile = async () => { throw new Error('readback unavailable'); };
  const result = await f.c.disconnectRealtime();
  assert.equal(result.status, 'ok');
  assert.equal(result.session_filename, 'sessions/saved-1.txt');
  assert.equal(f.c.continuitySaveHalted, true);
  assert.equal(f.socket.readyState, 3);
  assert.equal(f.saved.size, 1);
  assert.deepEqual(f.requests[0].sensing_eye_filenames, ['existing-image.jpg']);
  assert.ok(f.calls.some(line => line.includes('note was not reloaded')));
  await f.c.connect();
  assert.equal(sockets.length, 1);
  assert.equal(f.saved.size, 1, 'resume reads saved history without a duplicate write');
});

test('reloadSavedNote false skips pin reload but still saves and preserves the receipt', async () => {
  const f = saveFixture();
  f.c.readTextFile = async () => assert.fail('session-map jump must not reload departing history');
  const result = await f.c.disconnectRealtime({ reloadSavedNote: false });
  assert.equal(result.status, 'ok');
  assert.equal(f.saved.size, 1);
});

test('Connect after Disconnect prepares a clean connection with saved history', async () => {
  const f = saveFixture(), sockets = installConnectionFixture(f);
  await f.c.disconnectRealtime();
  await f.c.connect();
  assert.equal(sockets.length, 1);
  assert.equal(f.c.ws, sockets[0]);
  assert.equal(f.c.realtimeStopRequested, false);
  assert.equal(f.c.continuitySaveHalted, false);
  assert.equal(f.c.realtimeConnection.transition, null);
  assert.deepEqual(Array.from(f.c.conversationLines), []);
  assert.equal(f.c.continuityParentForCurrentRun, 'sessions/saved-1.txt');
  assert.deepEqual(Array.from(f.c.loadedNoteContexts, note => note.filename),
    ['core/example.txt', 'sessions/saved-1.txt']);
  assert.ok(f.calls.includes('context budget'));
  assert.ok(!f.calls.some(line => line.startsWith('connect blocked:')));
});

test('Connect keeps successful-save state through failed preparation and permits retry', async () => {
  const f = saveFixture(), sockets = installConnectionFixture(f);
  await f.c.disconnectRealtime();
  const prepare = f.c.prepareConnectionContext;
  f.c.prepareConnectionContext = async () => { throw new Error('budget unavailable'); };
  await f.c.connect();
  assert.equal(sockets.length, 0);
  assert.equal(f.c.continuitySaveHalted, true);
  assert.equal(f.c.realtimeConnection.transition, null);
  assert.ok(f.calls.includes('release preparation lease'));
  f.c.prepareConnectionContext = prepare;
  await f.c.connect();
  assert.equal(sockets.length, 1);
  assert.equal(f.saved.size, 1, 'startup retries do not save again');
});

test('Connect cannot bypass the unsaved stopped-session guard', async () => {
  const f = saveFixture(), sockets = installConnectionFixture(f);
  f.c.realtimeStopRequested = true;
  await f.c.connect();
  assert.equal(sockets.length, 0);
  assert.deepEqual(Array.from(f.c.conversationLines), ['The last accepted thought.']);
  assert.equal(f.c.continuitySaveHalted, false);
  assert.ok(f.calls.some(line => line.startsWith('connect blocked:')));
});

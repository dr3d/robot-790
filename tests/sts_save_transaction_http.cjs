// Invoked by pytest against an ephemeral STS server and a temporary note shelf.
const assert = require('node:assert/strict');
const { saveFixture, deferred, settle } = require('./helpers/sts_save_harness.cjs');

async function main() {
  const f = saveFixture(), endpoint = process.argv[2], writes = [];
  f.c.continuityParentForCurrentRun = '';
  const realFetch = async (url, options) => {
    assert.equal(new URL(url).pathname, '/api/continuity/save-transaction');
    writes.push(JSON.parse(options.body));
    return fetch(new URL('/api/continuity/save-transaction', endpoint), options);
  };
  f.c.fetch = async (...args) => {
    const response = await realFetch(...args);
    assert.equal(response.status, 200);
    await response.json();
    throw new Error('simulated lost reply after durable commit');
  };
  assert.equal((await f.c.disconnectRealtime()).status, 'error');
  assert.equal(f.c.continuitySaveHalted, false);
  f.c.fetch = realFetch;
  const recovered = await f.c.disconnectRealtime();
  assert.equal(recovered.status, 'ok');
  assert.deepEqual(writes[0], writes[1]);

  f.c.realtimeSessionGeneration += 1;
  f.c.conversationLines = ['The next accepted session.'];
  const gate = deferred(), committed = deferred();
  f.c.fetch = async (...args) => {
    const response = await realFetch(...args);
    committed.resolve();
    await gate.promise;
    return response;
  };
  const timedOut = f.c.disconnectRealtime();
  await committed.promise;
  f.fireTimer(12000);
  assert.equal((await timedOut).status, 'error');
  f.c.fetch = realFetch;
  const retry = await f.c.disconnectRealtime();
  assert.equal(retry.status, 'ok');
  assert.notEqual(retry.session_filename, recovered.session_filename);
  assert.deepEqual(writes[2], writes[3]);
  assert.equal(writes[2].parent_session_filename, recovered.session_filename);
  f.c.realtimeSessionGeneration += 1;
  f.c.currentContinuitySessionFilename = 'sessions/new-selection.txt';
  gate.resolve();
  await settle();
  assert.equal(f.c.currentContinuitySessionFilename, 'sessions/new-selection.txt');
  process.stdout.write(JSON.stringify({ first: recovered.session_filename, second: retry.session_filename }));
}

main().catch(error => { console.error(error); process.exitCode = 1; });

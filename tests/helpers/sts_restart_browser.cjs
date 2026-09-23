const assert = require('node:assert/strict');

// The actual Restart button/handler, simulated snapshots and HTTP receipt.
// Run on a fresh isolated page: no live backend control, models or persistence.
async function checkRestartCleanup(page) {
  await page.waitForFunction(() => typeof restartRealtimeServer === 'function');
  await page.evaluate(() => {
    const fixture = window.restartFixture = { requests: [], snapshots: 0, started: false, ready: false };
    const nativeFetch = window.fetch;
    window.fetch = async (url, options) => {
      if (new URL(url, location.href).pathname === '/api/realtime/ready') {
        return new Response(JSON.stringify({ ready: fixture.ready }),
          { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (new URL(url, location.href).pathname !== '/api/realtime/restart') return nativeFetch(url, options);
      fixture.requests.push(JSON.parse(options.body));
      await new Promise(resolve => { fixture.releaseReceipt = resolve; });
      return new Response(JSON.stringify({ status: 'ok', pid: 999, preset: 'fixture-model' }),
        { status: 202, headers: { 'Content-Type': 'application/json' } });
    };
    currentModelRestartPayload = () => ({ preset: 'fixture-model', context: 131072 });
    recordExitPaneSnapshots = async () => {
      fixture.snapshots++;
      fixture.started = true;
      await new Promise(resolve => { fixture.releaseSnapshots = resolve; });
      return [];
    };
  });
  await page.locator('#serverManagementExpando').evaluate(panel => {
    for (let element = panel; element; element = element.parentElement) {
      if (element.tagName === 'DETAILS') element.open = true;
    }
  });
  await page.locator('#restartServer').click();
  await page.waitForFunction(() => restartFixture.started);
  const pending = await page.evaluate(async () => {
    await restartRealtimeServer();
    await connect();
    await disconnectRealtime();
    return { kind: realtimeConnection.transition?.kind,
      locked: restartServerButton.disabled && connectButton.disabled,
      snapshots: restartFixture.snapshots, requests: restartFixture.requests.length,
      hasSocket: Boolean(realtimeConnection.socket) };
  });
  assert.deepEqual(pending, { kind: 'restart', locked: true, snapshots: 1, requests: 0, hasSocket: false });
  await page.evaluate(() => restartFixture.releaseSnapshots());
  await page.waitForFunction(() => restartFixture.requests.length === 1);
  assert.equal(await page.evaluate(() => realtimeConnection.transition?.kind), 'restart');
  await page.evaluate(() => restartFixture.releaseReceipt());
  await page.waitForFunction(() => !restartServerButton.disabled);
  assert.equal(await page.evaluate(() => connectButton.disabled), true,
    'launch feedback is not readiness, even after the five-second timer');
  await page.evaluate(() => { restartFixture.ready = true; });
  await page.waitForFunction(() => !restartServerButton.disabled && !connectButton.disabled);
  const completed = await page.evaluate(() => ({
    requests: restartFixture.requests, busy: realtimeConnection.busy,
    hasSocket: Boolean(realtimeConnection.socket), disconnectDisabled: disconnectButton.disabled
  }));
  assert.deepEqual(completed, { requests: [{ preset: 'fixture-model', context: 131072 }],
    busy: false, hasSocket: false, disconnectDisabled: true });

  // Replace the session out of band while snapshots wait; old work must expire.
  await page.evaluate(() => { restartFixture.started = false; });
  await page.locator('#restartServer').click();
  await page.waitForFunction(() => restartFixture.started);
  const stale = await page.evaluate(async () => {
    const fixture = restartFixture;
    let closeCalls = 0;
    realtimeConnection.adopt({ readyState: WebSocket.OPEN, send() {}, close() { closeCalls++; } });
    conversationLines = ['Replacement session.'];
    fixture.releaseSnapshots();
    while (realtimeConnection.busy) await new Promise(resolve => setTimeout(resolve, 10));
    return { closeCalls, requests: fixture.requests.length, connected: realtimeConnected(),
      words: [...conversationLines], restartAvailable: !restartServerButton.disabled,
      connectLocked: connectButton.disabled };
  });
  assert.deepEqual(stale, { closeCalls: 0, requests: 1, connected: true,
    words: ['Replacement session.'], restartAvailable: true, connectLocked: true });
  return { pending, completed, stale, limits: 'Simulated backend receipt and snapshots; no live Restart, save or model calls.' };
}

module.exports = { checkRestartCleanup };

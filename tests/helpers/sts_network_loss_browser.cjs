const assert = require('node:assert/strict');
const http = require('node:http');
const { createHash } = require('node:crypto');

// A disposable transport, not Eric's backend. The page uses its real close,
// mic-stop, save orchestration and UI; model work and persistence are stubbed.
async function checkNetworkLoss(page) {
  const peers = new Set();
  let connections = 0;
  const server = http.createServer((_request, response) => { response.writeHead(404); response.end(); });
  server.on('upgrade', (request, socket) => {
    const accept = createHash('sha1').update(request.headers['sec-websocket-key']
      + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
      + `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
    connections++;
    peers.add(socket);
    socket.on('data', () => {});
    socket.on('error', () => {});
    socket.on('close', () => peers.delete(socket));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await page.evaluate(async endpoint => {
      const fixture = window.networkLossFixture = { trackStops: 0, saveAttempts: 0, snapshots: 0, failSave: true };
      window.WebSocket = class extends window.isolatedNativeWebSocket {
        constructor() { super(endpoint); }
      };
      ensureRuntimeConfigLoaded = async () => {};
      pauseSessionPreparation = async () => {};
      releaseSessionPreparation = () => {};
      prepareConnectionContext = async () => {};
      currentContinuitySessionFilename = '';
      beginRealtimeSession = () => {};
      syncIdleArtPermission = async () => {};
      stageVisionImage = () => {};
      noteConversationActivity = () => {};
      updateSessionTools = () => {};
      recordRunSetupSnapshot = () => {};
      beginLlmOverview = () => {};
      recordExitPaneSnapshots = async () => { fixture.snapshots++; return []; };
      postFace = async () => ({});
      saveEricContinuitySnapshot = async () => {
        fixture.saveAttempts++;
        if (fixture.failSave) throw new Error('Isolated save service unavailable');
        fixture.savedWords = [...conversationLines];
        return { continuity_session_filename: 'sessions/isolated-fixture.txt' };
      };
      await connect({ continuityAlreadyLoaded: true, openFace: false });
    }, `ws://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => realtimeConnected());
    await page.evaluate(() => {
      const fixture = networkLossFixture;
      fixture.socket = realtimeConnection.socket;
      fixture.socket.addEventListener('close', event => { fixture.closeCode = event.code; });
      conversationLines = ['You: Keep Priya and Chamber Seven in this unsaved exchange.'];
      micStream = { getTracks: () => [{ stop() { fixture.trackStops++; } }] };
      micProcessor = { disconnect() {} };
      micSource = { disconnect() {} };
      micContext = { close: () => new Promise(resolve => { fixture.releaseMic = resolve; }) };
    });

    // Drop TCP without a WebSocket close frame: the browser reports code 1006.
    for (const peer of peers) peer.destroy();
    await page.waitForFunction(() => networkLossFixture.closeCode === 1006 && realtimeConnection.closing);
    const during = await page.evaluate(async () => {
      networkLossFixture.socket.dispatchEvent(new Event('close'));
      await connect();
      await disconnectRealtime();
      return { stopped: realtimeConnection.stopped, closing: realtimeConnection.closing,
        controlsLocked: [connectButton, previousConnectButton, emptyConnectButton, disconnectButton].every(button => button.disabled),
        trackStops: networkLossFixture.trackStops, saves: networkLossFixture.saveAttempts,
        lines: [...conversationLines] };
    });
    assert.deepEqual(during, { stopped: true, closing: true, controlsLocked: true, trackStops: 1, saves: 0,
      lines: ['You: Keep Priya and Chamber Seven in this unsaved exchange.'] });
    assert.equal(connections, 1);

    await page.evaluate(() => networkLossFixture.releaseMic());
    await page.waitForFunction(() => !realtimeConnection.busy && !disconnectButton.disabled);
    const recovery = await page.evaluate(async () => {
      await connect();
      const blockedSocket = realtimeConnection.socket === networkLossFixture.socket;
      const failed = await disconnectRealtime();
      const retryAvailable = !disconnectButton.disabled && conversationLines.length === 1;
      networkLossFixture.failSave = false;
      const saved = await disconnectRealtime();
      await connect({ continuityAlreadyLoaded: true, openFace: false });
      return { blockedSocket, failed: failed.status, retryAvailable, saved: saved.status,
        savedWords: networkLossFixture.savedWords, attempts: networkLossFixture.saveAttempts };
    });
    assert.deepEqual(recovery, { blockedSocket: true, failed: 'error', retryAvailable: true, saved: 'ok',
      savedWords: during.lines, attempts: 2 });
    await page.waitForFunction(() => realtimeConnected());
    assert.equal(connections, 2);
    const fresh = await page.evaluate(() => {
      networkLossFixture.socket.dispatchEvent(new Event('close'));
      return { connected: realtimeConnected(), stopped: realtimeConnection.stopped, closing: realtimeConnection.closing };
    });
    assert.deepEqual(fresh, { connected: true, stopped: false, closing: false });
    return { closeCode: 1006, connections, during, recovery, fresh,
      limits: 'Real TCP loss and browser UI; simulated model, mic resources and save receipt. No live session or persistence writes.' };
  } finally {
    for (const peer of peers) peer.destroy();
    await new Promise(resolve => server.close(resolve));
  }
}

module.exports = { checkNetworkLoss };

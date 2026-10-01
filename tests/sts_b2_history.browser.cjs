const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.ROBOT_790_PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [], requests = [], results = [];
  let scenario = 'success', page;
  try {
    const context = await browser.newContext();
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() === 'POST' && url.pathname === '/api/brain2/mull') {
        const payload = request.postDataJSON();
        requests.push(payload);
        if (scenario === 'user') await page.evaluate(() => { lastUserTurnActivityAt = Date.now(); userSpeechActive = true; });
        if (scenario === 'unpin') await page.evaluate(() => { loadedNoteContexts = []; });
        if (scenario === 'reconnect') await page.evaluate(() => { realtimeConnection.adopt({ readyState: 1, send() {} }); });
        const p = payload.history.passages[0];
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
          status: 'ok', mode: 'history', note_for_eric: 'An earlier question could be worth revisiting.',
          history_source: { id: p.id, speaker: p.speaker, filename: payload.history.filename,
            first_line: p.first_line, last_line: p.last_line, at: p.at },
          mouth_text: '', should_surface: false
        }) });
      }
      if (['GET', 'HEAD'].includes(request.method()) && url.hostname === '127.0.0.1') return route.continue();
      return route.abort();
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'sendBeacon', { value: () => false });
      window.WebSocket = class extends WebSocket { constructor() { throw Error('Live connection prohibited'); } };
    });
    page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:8790/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof Robot790Brain2History === 'object');
    for (scenario of ['success', 'user', 'unpin', 'reconnect']) {
      const result = await page.evaluate(async () => {
        clearBrain2Timer();
        scheduleBrain2Mull = () => {};
        realtimeConnection.adopt({ readyState: 1, send() {} });
        brain2Work.reset(); brain2History.reset(); brain2Advisories.reset();
        brain2MouthBrain.checked = true;
        idleDrift.value = '5'; idleWonder.value = '5'; idleExploration.value = '10';
        brain2PersonFocus.value = '4'; llmWebSearchTools.checked = false;
        conversationLines = ['[8:00:00 AM] You: Keep exploring.', '[8:00:01 AM] Robot 790: A recent reply.'];
        conversationLineMetadata = [{ iso: '2026-09-30T12:00:00Z' }, { iso: '2026-09-30T12:00:01Z', responseId: 'test' }];
        conversationProsodyByIndex = {};
        loadedNoteContexts = [{ filename: 'sessions/history-browser-test.txt', content:
          'STS Session Note\nCreated: 2026-09-29T12:00:00Z\nTranscript\n'
          + '[7:00:00 AM] You: What might the old clinic become?\n[7:00:03 AM] Robot 790: A courtyard for recovery.' }];
        brain2HeadlineStartedAt = Date.now() - 600000;
        lastUserTurnActivityAt = Date.now() - 600000;
        lastAcceptedUserTranscriptAt = lastUserTurnActivityAt;
        lastBrain2MullAt = 0; brain2BackoffUntil = 0; brain2FailureStreak = 0;
        userSpeechActive = false; userTurnPendingUntil = 0;
        pendingSessionMapMove = null; sessionMapMoveBusy = false;
        outputAudioActive = () => false; lmStudioPromptBusy = () => false;
        currentLabGoal = () => null; activeIdleSelfTasks = () => [];
        idleInFlight = false;
        const before = brain2HistoryCandidate();
        await triggerBrain2Mull();
        const advisory = brain2Advisories.format();
        const audit = brain2AuditEntries.filter(row => row.kind.startsWith('history'));
        conversationLines.push('[8:00:02 AM] Robot 790: New output.');
        conversationLineMetadata.push({ iso: '2026-09-30T12:00:02Z', responseId: 'new' });
        const afterSpeech = brain2Advisories.format();
        const sends = [];
        const socket = realtimeConnection.socket;
        socket.send = text => { sends.push(JSON.parse(text)); };
        const event = { type: 'response.create', response: { instructions: brain2Advisories.instructions() } };
        send(event, { socket, generation: realtimeConnection.generation - 1 });
        const afterStaleSend = brain2Advisories.format();
        socket.send = () => { throw Error('Synthetic send failure'); };
        try { send(event); } catch (error) { if (error.message !== 'Synthetic send failure') throw error; }
        const afterFailedSend = brain2Advisories.format();
        socket.send = text => { sends.push(JSON.parse(text)); };
        send(event);
        const afterDelivery = brain2Advisories.format();
        const receipts = brain2AuditEntries.filter(row => row.kind === 'history offered');
        realtimeConnection.requestStop(); realtimeConnection.socket = null;
        return { candidate: before, advisory, afterSpeech, afterStaleSend, afterFailedSend, afterDelivery, sends, receipts, audit };
      });
      assert(result.candidate, scenario);
      assert.equal(result.advisory.includes('An earlier question'), scenario === 'success', scenario);
      assert.equal(result.afterSpeech.includes('An earlier question'), scenario === 'success');
      assert.equal(result.afterStaleSend, result.afterSpeech);
      assert.equal(result.afterFailedSend, result.afterSpeech);
      assert.equal(result.afterDelivery, '');
      assert.equal(result.sends.length, 1);
      results.push({ scenario, ...result });
    }
    assert.equal(requests.length, 4);
    assert(requests.every(r => r.mode === 'history' && !r.body && !r.idle_art && r.history.passages.length));
    assert.deepEqual(errors, []);
    const out = path.resolve(__dirname, '../logs/maintenance/b2-history-repairs/browser.json');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify({ results, requests, errors }, null, 2));
    console.log('Real-page history survives ongoing speech, expires on send, rejects stale/failed sends and invalidated sources.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

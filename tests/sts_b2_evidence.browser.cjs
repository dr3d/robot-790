const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.ROBOT_790_PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const requests = [], errors = [];
  try {
    const context = await browser.newContext();
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() === 'POST' && url.pathname === '/api/brain2/mull') {
        const payload = request.postDataJSON();
        requests.push(payload);
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok',
          note_for_eric: '', should_surface: false, prompt_debug: {
            system: 'Mock completion only; no model contacted.', user: JSON.stringify(payload.evidence),
            evidence_receipt: { format: 'whole-turns-v1', latest_user_characters: payload.evidence.latest_user_utterance.text.length }
          } }) });
      }
      if (['GET', 'HEAD'].includes(request.method()) && url.hostname === '127.0.0.1') return route.continue();
      return route.abort();
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'sendBeacon', { value: () => false });
      window.WebSocket = class extends WebSocket { constructor() { throw Error('Live connection prohibited'); } };
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:8790/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof Robot790Brain2Evidence === 'object' && typeof requestBrain2Mull === 'function');
    const result = await page.evaluate(async () => {
      const direction = 'Here is the premise. '.repeat(60) + 'Compare three endings; put the tradeoffs in a note.';
      realtimeConnection.adopt({ readyState: 1, send() {} });
      conversationLines = [];
      conversationLineMetadata = [];
      conversationProsodyByIndex = {};
      addConversation(`You: ${direction}`, { touchActivity: false });
      for (const response_id of ['first-reply', 'second-reply']) {
        for (let chunk = 0; chunk < 30; chunk++) handleEvent({
          type: 'response.output_audio_transcript.done', response_id,
          transcript: `${response_id}: sentence ${chunk}.`
        });
      }
      const snapshot = brain2EvidenceSnapshot();
      const reply = await requestBrain2Mull({ manual: true });
      realtimeConnection.requestStop();
      realtimeConnection.socket = null;
      return {
        direction, snapshot, status: reply.status,
        visibleRows: conversationLines.length,
        responseIds: conversationLineMetadata.slice(1).map(row => row.responseId),
        audit: brain2AuditEntries.filter(row => row.kind === 'evidence input'),
        privateOutputs: recentBrain2Outputs
      };
    });
    assert.equal(result.status, 'ok');
    assert.equal(result.visibleRows, 61);
    assert.equal(result.snapshot.conversation.length, 3);
    assert.deepEqual(result.snapshot.conversation.slice(1).map(row => row.chunk_count), [30, 30]);
    assert.equal(result.snapshot.latest_user_utterance.text.split('You: ')[1], result.direction);
    assert.equal(result.snapshot.conversation_window.omitted_chunks, 0);
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0].evidence.conversation, result.snapshot.conversation);
    assert.equal(result.audit.length, 1);
    assert.equal(result.privateOutputs.length, 0, 'audit receipts cannot become advice');
    assert.deepEqual(errors, []);
    const out = path.resolve(__dirname, '../logs/maintenance/b2-evidence-fidelity');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'browser.json'), JSON.stringify({ result, errors }, null, 2));
    console.log('Real-page B2 evidence check passed: 60 chunks in two replies, full instruction, audited mock request.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

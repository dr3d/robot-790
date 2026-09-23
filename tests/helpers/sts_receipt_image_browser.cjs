const assert = require('node:assert/strict');

async function checkReceiptAndImageWait(page) {
  const result = await page.evaluate(async () => {
    const original = { fetch: window.fetch, setTimeout: window.setTimeout, imageEnabled: llmImageTools.checked,
      lastEvidence: brain2LastEvidence };
    const socket = { readyState: WebSocket.OPEN, send() {} };
    realtimeConnection.adopt(socket);
    const generation = realtimeConnection.generation;
    let calls = 0, wake;
    try {
      fileWriteReceipts = [];
      const before = brain2EvidenceSnapshot().fingerprint;
      recordFileWriteReceipt({ name: 'write_text_file', call_id: 'browser-write' }, { filename: 'Trip.txt', content: 'PRIVATE BODY' },
        { status: 'ok', filename: 'Trip.txt', characters: 12 }, { socket, generation });
      const evidence = brain2EvidenceSnapshot();
      const write = { changed: evidence.fingerprint !== before,
        filename: evidence.runtime.file_write_receipts[0].filename,
        noBody: !JSON.stringify(evidence.runtime.file_write_receipts).includes('PRIVATE BODY') };
      let request;
      window.fetch = async (target, options) => {
        if (new URL(target, location.href).pathname !== '/api/brain2/mull') throw new Error('unexpected B2 fixture route');
        request = JSON.parse(options.body);
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
      };
      const mull = await requestBrain2Mull();
      const requestCheck = { status: mull.status, receipt: request.evidence.runtime.file_write_receipts[0],
        noBody: !JSON.stringify(request).includes('PRIVATE BODY'),
        noFingerprint: !Object.hasOwn(request.evidence, 'fingerprint'),
        noUserKey: !Object.hasOwn(request.evidence, 'user_key'),
        accepted: brain2LastEvidence === mull.observed_evidence };
      let releaseOld;
      window.fetch = () => new Promise(resolve => { releaseOld = resolve; });
      const oldGeneration = realtimeConnection.generation;
      const oldRequest = requestBrain2Mull();
      realtimeConnection.requestStop();
      realtimeConnection.adopt({ readyState: WebSocket.OPEN, send() {} });
      window.fetch = async () => new Response(JSON.stringify({ status: 'ok', note_for_eric: 'New session' }));
      const newResult = await requestBrain2Mull();
      const acceptedNew = brain2LastEvidence;
      releaseOld(new Response(JSON.stringify({ status: 'error', error: 'Old session error' }), { status: 503 }));
      const oldResult = await oldRequest;
      const requestRace = { newStatus: newResult.status, oldStatus: oldResult.status,
        newEvidenceRetained: brain2LastEvidence === acceptedNew,
        generationsDiffer: realtimeConnection.generation !== oldGeneration };
      // The image-admission fixture below owns a separate session token.
      realtimeConnection.adopt(socket);
      const imageGeneration = realtimeConnection.generation;
      window.setTimeout = callback => { wake = callback; return -1; };
      window.fetch = async target => {
        if (new URL(target, location.href).pathname !== '/api/images/generate') throw new Error('unexpected fixture route');
        calls++;
        throw new Error('isolated provider fixture');
      };
      clearGeneratedImage(); llmImageTools.checked = true; idleArt.busy = true;
      const current = () => activeRealtimeSession(socket, imageGeneration);
      const waiting = generateImage({ prompt: 'Offline wait fixture', _isCurrent: current }).catch(error => error.message);
      const beforeRelease = calls;
      idleArt.busy = false; wake();
      const failure = await waiting;
      idleArt.busy = true;
      const stale = generateImage({ prompt: 'Canceled fixture', _isCurrent: current }).catch(error => ({ message: error.message, submitted: error.generationSubmitted }));
      realtimeConnection.requestStop(); wake();
      const canceled = await stale;
      realtimeConnection.adopt({ readyState: WebSocket.OPEN, send() {} });
      const priorCount = fileWriteReceipts.length;
      recordFileWriteReceipt({ name: 'write_text_file', call_id: 'late' }, { filename: 'Old.txt' },
        { status: 'ok' }, { socket, generation });
      return { write, requestCheck, requestRace, beforeRelease, calls, failure, canceled,
        staleWriteDropped: fileWriteReceipts.length === priorCount,
        newSessionReceipts: brain2EvidenceSnapshot().runtime.file_write_receipts.length };
    } finally {
      window.fetch = original.fetch; window.setTimeout = original.setTimeout;
      idleArt.busy = false; llmImageTools.checked = original.imageEnabled;
      realtimeConnection.requestStop(); fileWriteReceipts = []; clearGeneratedImage();
      brain2LastEvidence = original.lastEvidence;
    }
  });
  assert.deepEqual(result.write, { changed: true, filename: 'Trip.txt', noBody: true });
  assert.equal(result.requestCheck.status, 'ok');
  assert.equal(result.requestCheck.receipt.call_id, 'browser-write');
  assert.equal(result.requestCheck.receipt.filename, 'Trip.txt');
  assert.equal(result.requestCheck.receipt.status, 'ok');
  assert.equal(result.requestCheck.receipt.characters, 12);
  assert.equal(result.requestCheck.noBody, true);
  assert.equal(result.requestCheck.noFingerprint, true);
  assert.equal(result.requestCheck.noUserKey, true);
  assert.equal(result.requestCheck.accepted, true);
  assert.deepEqual(result.requestRace, { newStatus: 'ok', oldStatus: 'stale',
    newEvidenceRetained: true, generationsDiffer: true });
  assert.equal(result.beforeRelease, 0);
  assert.equal(result.calls, 1);
  assert.equal(result.failure, 'isolated provider fixture');
  assert.equal(result.canceled.submitted, false);
  assert.match(result.canceled.message, /superseded/);
  assert.equal(result.staleWriteDropped, true);
  assert.equal(result.newSessionReceipts, 0);
  return result;
}

module.exports = { checkReceiptAndImageWait };

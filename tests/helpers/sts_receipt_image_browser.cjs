const assert = require('node:assert/strict');

async function checkReceiptAndImageWait(page) {
  const result = await page.evaluate(async () => {
    const original = { fetch: window.fetch, setTimeout: window.setTimeout, imageEnabled: llmImageTools.checked };
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
      window.setTimeout = callback => { wake = callback; return -1; };
      window.fetch = async target => {
        if (new URL(target, location.href).pathname !== '/api/images/generate') throw new Error('unexpected fixture route');
        calls++;
        throw new Error('isolated provider fixture');
      };
      clearGeneratedImage(); llmImageTools.checked = true; idleArt.busy = true;
      const current = () => activeRealtimeSession(socket, generation);
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
      return { write, beforeRelease, calls, failure, canceled,
        staleWriteDropped: fileWriteReceipts.length === priorCount,
        newSessionReceipts: brain2EvidenceSnapshot().runtime.file_write_receipts.length };
    } finally {
      window.fetch = original.fetch; window.setTimeout = original.setTimeout;
      idleArt.busy = false; llmImageTools.checked = original.imageEnabled;
      realtimeConnection.requestStop(); fileWriteReceipts = []; clearGeneratedImage();
    }
  });
  assert.deepEqual(result.write, { changed: true, filename: 'Trip.txt', noBody: true });
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

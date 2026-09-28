const assert = require('node:assert/strict');

async function checkEyeHistory(page) {
  const result = await page.evaluate(async () => {
    const original = { fetch: window.fetch, postFace, scheduleIdlePonder };
    const sent = [], fileReads = [], blobs = new Map();
    let writes = 0;
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 60;
    const paint = canvas.getContext('2d');
    const json = body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    const adopt = () => realtimeConnection.adopt({ readyState: WebSocket.OPEN, send: data => sent.push(JSON.parse(data)) });
    window.fetch = async (target, options = {}) => {
      const url = new URL(target, location.href);
      if (url.pathname === '/api/sensing-eye/inbox' && options.method === 'POST') {
        if (JSON.parse(options.body).action !== 'clear') throw Error('History test attempted a disk write');
        writes++; return json({ status: 'ok', latest_seq: 50000 });
      }
      if (url.pathname === '/api/sensing-eye/list') {
        const name = url.searchParams.get('filename');
        if (name !== 'history-0.jpg') throw Error(`Unexpected catalogue request: ${url}`);
        fileReads.push(name);
        return json({ status: 'ok', lookup_version: 1, total: 1,
          files: [{ filename: name, kind: 'image', url: `/sensing-eye/${name}`, modified_at: '2026-09-28T10:00:00Z' }] });
      }
      if (url.pathname === '/sensing-eye/history-0.jpg') return new Response(blobs.get('history-0.jpg'));
      if (!['GET', 'HEAD'].includes(options.method || 'GET')) throw Error(`Unexpected write: ${url.pathname}`);
      return original.fetch(target, options);
    };
    postFace = async endpoint => {
      if (endpoint !== 'commands/clear') throw Error(`Unexpected face call: ${endpoint}`);
      return { status: 'ok', latest_seq: 50000 };
    };
    scheduleIdlePonder = () => {};
    try {
      adopt();
      await clearSensingEyeState();
      let retained, text;
      for (let i = 0; i < 7; i++) {
        paint.fillStyle = `rgb(${20 + i * 30},100,180)`; paint.fillRect(0, 0, 80, 60);
        if (!i) blobs.set('history-0.jpg', await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg')));
        retained = await setVisionImageFromDrawable(canvas, `history-${i}.jpg`,
          { saveToFilesystem: false, savedFilename: `history-${i}.jpg`, autoStage: false });
        text = await setSensingTextContent(`history text ${i}`, `history-${i}.txt`, { saveToFilesystem: false });
      }
      const originalId = retained.id;
      const duplicate = await setVisionImageFromDrawable(canvas, 'duplicate renamed.jpg',
        { saveToFilesystem: false, savedFilename: 'history-6.jpg', autoStage: false });
      const counts = { images: sensingEyeHistory.imageCount, texts: sensingEyeHistory.textCount };
      const duplicateResult = { freshId: duplicate.id !== originalId, oldIdGone: !sensingEyeHistory.imageById(originalId),
        currentId: currentSensingEyeHistoryItem().id === duplicate.id, first: sensingEyeImageHistoryList()[0].id === duplicate.id };
      const rows = sensingEyeImageHistoryList(); rows[0].name = 'outside edit';
      const separateRows = sensingEyeHistory.imageById(duplicate.id).name === 'duplicate renamed.jpg';
      realtimeConnection.requestStop();
      await clearSensingEyeState({ source: 'session_connect' });
      adopt(); beginRealtimeSession();
      const reconnect = { images: sensingEyeHistory.imageCount, texts: sensingEyeHistory.textCount,
        empty: !sensingEyeContent.imageUrl && !sensingEyeContent.text,
        noCurrent: !sensingEyeImageHistoryList().some(x => x.current) && !sensingEyeTextHistoryList().some(x => x.current) };
      const beforeRecall = sent.filter(e => e.item?.content?.some(x => x.type === 'input_image')).length;
      const local = await selectSensingEyeImage({ image_id: 'file:history-6.jpg' });
      stageVisionImage();
      const retainedRecall = { staged: local.selected.staged,
        sameObject: currentSensingEyeHistoryItem() === duplicate,
        imageMessages: sent.filter(e => e.item?.content?.some(x => x.type === 'input_image')).length - beforeRecall,
        fileReads: fileReads.length };
      const localText = await selectSensingEyeImage({ image_id: text.id });
      const textRecall = { kind: localText.selected.kind, content: sensingEyeContent.text, imageEmpty: !sensingEyeContent.imageUrl };
      const disk = await selectSensingEyeImage({ image_id: 'file:history-0.jpg' });
      await visionPreview.decode();
      const fileRecall = { staged: disk.selected.staged, saved: disk.selected.saved_filename,
        width: visionPreview.naturalWidth, fileReads: fileReads.length };
      return { counts, duplicateResult, separateRows, reconnect, retainedRecall, textRecall, fileRecall, writes,
        privateState: !('images' in sensingEyeHistory) && !('texts' in sensingEyeHistory),
        globalsGone: [typeof sensingEyeImageHistory, typeof sensingEyeTextHistory,
          typeof sensingEyeImageHistorySeq, typeof sensingEyeTextHistorySeq].every(x => x === 'undefined') };
    } finally {
      realtimeConnection.requestStop();
      window.fetch = original.fetch; postFace = original.postFace; scheduleIdlePonder = original.scheduleIdlePonder;
    }
  });
  assert.deepEqual(result.counts, { images: 5, texts: 5 });
  assert.deepEqual(result.duplicateResult, { freshId: true, oldIdGone: true, currentId: true, first: true });
  assert.equal(result.separateRows, true);
  assert.deepEqual(result.reconnect, { images: 5, texts: 5, empty: true, noCurrent: true });
  assert.deepEqual(result.retainedRecall, { staged: true, sameObject: true, imageMessages: 1, fileReads: 0 });
  assert.deepEqual(result.textRecall, { kind: 'text', content: 'history text 6', imageEmpty: true });
  assert.deepEqual(result.fileRecall, { staged: true, saved: 'history-0.jpg', width: 80, fileReads: 1 });
  assert.equal(result.writes, 2);
  assert.equal(result.privateState, true); assert.equal(result.globalsGone, true);
  return result;
}

module.exports = { checkEyeHistory };

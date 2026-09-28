const assert = require('node:assert/strict');
const path = require('node:path');

// Real decode/save/stage page path; all writes and image reads stay inside this fixture.
async function checkImageHandoff(page, artifacts) {
  const result = await page.evaluate(async () => {
    if (typeof Robot790GeneratedImageHandoff?.create !== 'function' || typeof generatedImageHandoff?.move !== 'function') {
      throw Error('Generated-image handoff was not loaded');
    }
    const original = { fetch: window.fetch, postFace, scheduleIdlePonder };
    const sent = [], writes = [], reads = [], races = [];
    const canvas = document.createElement('canvas');
    canvas.width = 300; canvas.height = 192;
    const paint = canvas.getContext('2d');
    paint.fillStyle = '#266c7c'; paint.fillRect(0, 0, 300, 192);
    paint.fillStyle = '#e8c957'; paint.fillRect(60, 40, 180, 112);
    const imageUrl = canvas.toDataURL('image/png');
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    let seq = 10000, holdPhase = '', release;
    const adopt = () => {
      const socket = { readyState: WebSocket.OPEN, send: data => sent.push(JSON.parse(data)) };
      realtimeConnection.adopt(socket);
      return socket;
    };
    const imageItems = () => sent.filter(event => event.item?.content?.some(item => item.type === 'input_image'));
    const json = body => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (target, options = {}) => {
      const url = new URL(target, location.href);
      if (url.pathname.startsWith('/generated-images/')) {
        reads.push(url.pathname);
        if (url.pathname.endsWith('/missing.png')) return new Response('', { status: 404, statusText: 'Not Found' });
        if (holdPhase === 'fetch') await new Promise(resolve => { release = resolve; });
        return new Response(blob, { status: 200 });
      }
      if (url.pathname === '/api/sensing-eye/inbox' && options.method === 'POST') {
        const body = JSON.parse(options.body);
        writes.push(body);
        if (body.action === 'clear') return json({ status: 'ok', latest_seq: ++seq });
        if (holdPhase === 'save') await new Promise(resolve => { release = resolve; });
        return json({ status: 'ok', seq: ++seq, saved_filename: `fixture-${seq}.jpg`, saved_url: `/sensing-eye/fixture-${seq}.jpg` });
      }
      if (!['GET', 'HEAD'].includes(options.method || 'GET')) throw Error(`Unexpected fixture write: ${url.pathname}`);
      return original.fetch(target, options);
    };
    postFace = async endpoint => {
      if (endpoint !== 'commands/clear') throw Error(`Unexpected fixture face call: ${endpoint}`);
      return { status: 'ok', latest_seq: seq };
    };
    scheduleIdlePonder = () => {};
    try {
      adopt();
      await clearSensingEyeState();
      showGeneratedImage({ filename: 'preview.png', url: imageUrl });
      const beforeMove = imageItems().length;
      const first = await moveGeneratedImageToSensingEye();
      await visionPreview.decode();
      paint.drawImage(visionPreview, 0, 0);
      const pixel = Array.from(paint.getImageData(100, 80, 1, 1).data);
      const matchingHint = generatedImageHint.textContent;
      const initialStage = { beforeMove, imageMessages: imageItems().length, width: visionPreview.naturalWidth,
        pixel, receipt: first, matchingHint, source: writes.find(row => row.source)?.source,
        transcriptMarker: conversationLines.some(line => line.includes('generated image moved into eye')) };
      showGeneratedImage({ filename: 'newer.png', url: imageUrl });
      const hint = generatedImageHint.textContent;
      const recalled = await moveGeneratedImageToSensingEye({ filename: 'older.png', reason: 'Offline recall' });
      const exactRecall = { receipt: recalled, previewName: generatedPreview.name,
        hintUnchanged: generatedImageHint.textContent === hint, imageMessages: imageItems().length };
      const priorEye = sensingEyeContent.imageUrl;
      let missing;
      try { await moveGeneratedImageToSensingEye({ filename: 'missing.png' }); } catch (error) { missing = error.message; }
      const missingResult = { error: missing, eyeUnchanged: sensingEyeContent.imageUrl === priorEye };

      for (const phase of ['fetch', 'save']) {
        for (const action of ['clear', 'preview', 'eye', 'turn', 'reconnect']) {
          holdPhase = ''; release = null;
          const socket = adopt(), generation = realtimeConnection.generation;
          await clearSensingEyeState();
          showGeneratedImage({ filename: 'old.png', url: imageUrl });
          let turnCurrent = true;
          holdPhase = phase;
          const pending = moveGeneratedImageToSensingEye({ filename: 'late.png',
            _isCurrent: () => turnCurrent && activeRealtimeSession(socket, generation) })
            .then(value => ({ value }), error => ({ error: error.message }));
          for (let i = 0; !release && i < 200; i++) await new Promise(resolve => setTimeout(resolve, 5));
          if (!release) throw Error(`Did not reach ${phase}`);
          const finish = release; holdPhase = '';
          if (action === 'clear') await clearSensingEyeState();
          if (action === 'preview') showGeneratedImage({ filename: 'replacement.png', url: imageUrl });
          if (action === 'eye') await setVisionImageFromDrawable(canvas, 'replacement-eye.png', { saveToFilesystem: false });
          if (action === 'turn') turnCurrent = false;
          if (action === 'reconnect') {
            realtimeConnection.requestStop();
            await clearSensingEyeState({ source: 'session_connect' });
            adopt();
          }
          const eyeBefore = sensingEyeContent.imageUrl, nameBefore = sensingEyeContent.imageName, stagedBefore = imageItems().length;
          finish();
          const outcome = await pending;
          races.push({ phase, action, error: outcome.error,
            eyeUnchanged: sensingEyeContent.imageUrl === eyeBefore && sensingEyeContent.imageName === nameBefore,
            noLateStage: imageItems().length === stagedBefore });
        }
      }
      holdPhase = '';
      await moveGeneratedImageToSensingEye({ filename: 'layout.png' });
      await visionPreview.decode();
      return { initialStage, exactRecall, missingResult, races, imageReads: reads.length,
        savedImages: writes.filter(row => row.image_data_url).length,
        nativeSocket: realtimeConnection.socket instanceof isolatedNativeWebSocket };
    } finally {
      realtimeConnection.requestStop();
      window.fetch = original.fetch; postFace = original.postFace; scheduleIdlePonder = original.scheduleIdlePonder;
    }
  });
  assert.equal(result.initialStage.beforeMove, 0);
  assert.equal(result.initialStage.imageMessages, 1);
  assert.equal(result.initialStage.width, 300);
  const [r, g, b, alpha] = result.initialStage.pixel;
  assert(r > 220 && g > 190 && b < 100 && alpha === 255, 'actual eye JPEG contains the fixture pixels');
  assert.equal(result.initialStage.receipt.staged, true);
  assert.equal(result.initialStage.receipt.source_image, 'preview.png');
  assert.match(result.initialStage.matchingHint, /moved to sensing eye/);
  assert.equal(result.initialStage.source, 'generated image');
  assert.equal(result.initialStage.transcriptMarker, true);
  assert.equal(result.exactRecall.receipt.source_image, 'older.png');
  assert.equal(result.exactRecall.receipt.staged, true);
  assert.equal(result.exactRecall.previewName, 'newer.png');
  assert.equal(result.exactRecall.hintUnchanged, true);
  assert.equal(result.exactRecall.imageMessages, 2);
  assert.match(result.missingResult.error, /404/);
  assert.equal(result.missingResult.eyeUnchanged, true);
  for (const race of result.races) {
    assert.match(race.error, /superseded|canceled/, `${race.phase}/${race.action}`);
    assert.equal(race.eyeUnchanged, true);
    assert.equal(race.noLateStage, true);
  }
  assert.equal(result.nativeSocket, false);
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    const panel = page.locator('#sensingEyeExpando');
    await panel.evaluate(element => {
      for (let node = element; node; node = node.parentElement) if (node.tagName === 'DETAILS') node.open = true;
    });
    await panel.scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#visionPreview').evaluate(img => {
      const rect = img.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= innerWidth;
    }), true, `${name} eye image fits`);
    await panel.screenshot({ path: path.join(artifacts, `image-handoff-${name}.png`) });
  }
  return result;
}

module.exports = { checkImageHandoff };

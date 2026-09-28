const assert = require('node:assert/strict');

// Actual eye setters/clear, with disk writes and body commands confined to the fixture.
async function checkEyePersistence(page) {
  const result = await page.evaluate(async () => {
    if (typeof Robot790SensingEyePersistence?.create !== 'function') throw Error('Eye persistence module missing');
    if (typeof Robot790SensingEyeContent?.create !== 'function') throw Error('Eye content module missing');
    const original = { fetch: window.fetch, postFace, scheduleIdlePonder };
    const writes = [], races = [], failures = [], replacements = [];
    let seq = 20000, hold = '', release, fail = false, savedName = '';
    const canvas = document.createElement('canvas');
    canvas.width = 120; canvas.height = 80;
    canvas.getContext('2d').fillRect(0, 0, 120, 80);
    const json = body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (target, options = {}) => {
      const url = new URL(target, location.href);
      if (options.method === 'POST' && ['/api/sensing-eye/text', '/api/sensing-eye/inbox'].includes(url.pathname)) {
        const body = JSON.parse(options.body);
        writes.push({ path: url.pathname, body });
        if (body.action === 'clear') return json({ status: 'ok', latest_seq: ++seq });
        if (hold === 'fetch') await new Promise(resolve => { release = resolve; });
        const receipt = { status: 'ok', seq: ++seq, saved_filename: `${seq}-${body.filename}`, saved_url: `/sensing-eye/${seq}-${body.filename}` };
        savedName = receipt.saved_filename;
        const response = fail ? new Response('disk unavailable', { status: 503 }) : json(receipt);
        if (hold === 'json') {
          const decode = response.json.bind(response);
          response.json = async () => { await new Promise(resolve => { release = resolve; }); return decode(); };
        }
        return response;
      }
      if (!['GET', 'HEAD'].includes(options.method || 'GET')) throw Error(`Unexpected fixture write: ${url.pathname}`);
      return original.fetch(target, options);
    };
    postFace = async endpoint => {
      if (endpoint !== 'commands/clear') throw Error(`Unexpected fixture face call: ${endpoint}`);
      return { status: 'ok', latest_seq: seq };
    };
    scheduleIdlePonder = () => {};
    const set = (kind, options = {}) => kind === 'text'
      ? setSensingTextContent(' First line\r\nSecond line ', 'fixture.txt', { source: 'operator drop', ...options })
      : setVisionImageFromDrawable(canvas, 'fixture.jpg', { source: 'operator drop', ...options });
    try {
      await clearSensingEyeState();
      const text = await set('text');
      const textResult = { content: sensingTextContent, saved: text.savedFilename,
        attached: sensingEyeSessionAssetFilenames.has(text.savedFilename), imageCleared: !visionImageUrl,
        path: writes.at(-1).path, noImagePayload: !Object.hasOwn(writes.at(-1).body, 'client_eye_generation') };
      const image = await set('visual');
      await visionPreview.decode();
      const imageResult = { saved: image.savedFilename, attached: sensingEyeSessionAssetFilenames.has(image.savedFilename),
        width: visionPreview.naturalWidth, textCleared: !sensingTextContent,
        client: writes.at(-1).body.client_id === sensingEyeClientId,
        generation: writes.at(-1).body.client_eye_generation === sensingEyeGeneration };
      for (const kind of ['text', 'visual']) {
        for (const phase of ['fetch', 'json']) {
          for (const source of ['ui', 'session_connect']) {
            release = null; hold = phase;
            const pending = set(kind).then(() => ({ error: '' }), error => ({ error: error.message }));
            for (let i = 0; !release && i < 200; i++) await new Promise(resolve => setTimeout(resolve, 5));
            if (!release) throw Error(`Save did not reach ${phase}`);
            const finish = release; hold = '';
            await clearSensingEyeState({ source });
            finish();
            const outcome = await pending;
            races.push({ kind, phase, source, error: outcome.error,
              empty: !visionImageUrl && !sensingTextContent,
              notAttached: !sensingEyeSessionAssetFilenames.has(savedName),
              echoHandled: kind === 'text' || handledSensingEyeInboxSeqs.has(String(savedName.split('-')[0])) });
          }
        }
      }
      for (const kind of ['text', 'visual']) {
        let current = true;
        release = null; hold = 'json';
        const pending = set(kind, { isCurrent: () => current }).then(() => '', error => error.message);
        for (let i = 0; !release && i < 200; i++) await new Promise(resolve => setTimeout(resolve, 5));
        if (!release) throw Error('Replacement save did not reach JSON');
        const finish = release; hold = '';
        await set(kind === 'text' ? 'visual' : 'text', { saveToFilesystem: false });
        current = false;
        const expected = { image: visionImageUrl, text: sensingTextContent,
          images: sensingEyeImageHistory.length, texts: sensingEyeTextHistory.length };
        finish();
        const error = await pending;
        replacements.push({ kind, error, retained: visionImageUrl === expected.image && sensingTextContent === expected.text,
          noLateHistory: sensingEyeImageHistory.length === expected.images && sensingEyeTextHistory.length === expected.texts });
      }
      const clearInbox = clearSensingEyeInboxOnServer, clearFace = clearBrowserFaceCaptureQueue;
      const queue = [];
      let overlappingClear;
      try {
        clearSensingEyeInboxOnServer = () => new Promise(resolve => queue.push(resolve));
        clearBrowserFaceCaptureQueue = async () => null;
        const images = sensingEyeImageHistory.length, texts = sensingEyeTextHistory.length;
        const first = clearSensingEyeState(), second = clearSensingEyeState();
        queue[0]({ latest_seq: seq }); await first;
        const held = sensingEyeInboxClearInFlight;
        queue[1]({ latest_seq: seq }); await second;
        overlappingClear = { held, released: !sensingEyeInboxClearInFlight,
          historyKept: sensingEyeImageHistory.length === images && sensingEyeTextHistory.length === texts,
          empty: !visionImageUrl && !sensingTextContent && !visionPreview.hasAttribute('src') };
      } finally {
        clearSensingEyeInboxOnServer = clearInbox; clearBrowserFaceCaptureQueue = clearFace;
      }
      fail = true;
      for (const kind of ['text', 'visual']) {
        const count = writes.length;
        const item = await set(kind);
        failures.push({ kind, writes: writes.length - count, unsaved: !item.savedFilename,
          notAttached: !sensingEyeSessionAssetFilenames.has(savedName),
          visible: kind === 'text' ? sensingTextContent === 'First line\nSecond line' : !!visionImageUrl });
      }
      return { textResult, imageResult, races, replacements, overlappingClear, failures, connected: realtimeConnected() };
    } finally {
      window.fetch = original.fetch; postFace = original.postFace; scheduleIdlePonder = original.scheduleIdlePonder;
    }
  });
  assert.equal(result.connected, false);
  assert.equal(result.textResult.content, 'First line\nSecond line');
  assert.match(result.textResult.saved, /fixture\.txt$/);
  assert.equal(result.textResult.attached, true);
  assert.equal(result.textResult.imageCleared, true);
  assert.equal(result.textResult.noImagePayload, true);
  assert.equal(result.textResult.path, '/api/sensing-eye/text');
  assert.match(result.imageResult.saved, /fixture\.jpg$/);
  assert.equal(result.imageResult.attached, true);
  assert.equal(result.imageResult.width, 120);
  assert.equal(result.imageResult.textCleared, true);
  assert.equal(result.imageResult.client, true);
  assert.equal(result.imageResult.generation, true);
  for (const race of result.races) {
    assert.match(race.error, /Sensing-eye load canceled/, `${race.kind}/${race.phase}/${race.source}`);
    assert.equal(race.empty, true);
    assert.equal(race.notAttached, true);
    assert.equal(race.echoHandled, true);
  }
  for (const failure of result.failures) {
    assert.equal(failure.writes, 1);
    assert.equal(failure.unsaved, true);
    assert.equal(failure.notAttached, true);
    assert.equal(failure.visible, true);
  }
  for (const replacement of result.replacements) {
    assert.match(replacement.error, /superseded/);
    assert.equal(replacement.retained, true);
    assert.equal(replacement.noLateHistory, true);
  }
  assert.deepEqual(result.overlappingClear, { held: true, released: true, historyKept: true, empty: true });
  return result;
}

module.exports = { checkEyePersistence };

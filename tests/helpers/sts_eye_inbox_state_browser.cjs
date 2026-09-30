const assert = require('node:assert/strict');

async function checkInboxState(page) {
  const result = await page.evaluate(async () => {
    const original = { fetch: window.fetch, postFace, browserFaceControllerActive, scheduleSensingEyeInboxPoll, scheduleIdlePonder, loadImage };
    clearTimeout(sensingEyeInboxPollTimer);
    const sent = [], calls = [];
    let latest = 20000, item = null, schedules = 0;
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 60;
    canvas.getContext('2d').fillStyle = '#44cc66'; canvas.getContext('2d').fillRect(0, 0, 80, 60);
    const data = canvas.toDataURL('image/png');
    const json = body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    scheduleSensingEyeInboxPoll = () => { schedules++; };
    scheduleIdlePonder = () => {};
    browserFaceControllerActive = () => true;
    postFace = async endpoint => { calls.push(endpoint); return { status: 'ok', seq: 10, latest_seq: 10 }; };
    window.fetch = async (target, options = {}) => {
      const url = new URL(target, location.href);
      if (url.pathname === '/api/sensing-eye/inbox') {
        if (options.method === 'POST') {
          if (JSON.parse(options.body).action !== 'clear') throw Error('Unexpected disk write');
          return json({ status: 'ok', latest_seq: latest });
        }
        return json({ status: 'ok', latest_seq: latest, item: Number(url.searchParams.get('after')) < latest ? item : null });
      }
      if (!['GET', 'HEAD'].includes(options.method || 'GET')) throw Error(`Unexpected write: ${url.pathname}`);
      return original.fetch(target, options);
    };
    try {
      realtimeConnection.adopt({ readyState: WebSocket.OPEN, send: data => sent.push(JSON.parse(data)) });
      await syncSensingEyeInboxCursor();
      latest++;
      item = { seq: latest, filename: 'inbox-fixture.jpg', saved_filename: 'inbox-fixture.jpg', saved_url: '/sensing-eye/inbox-fixture.jpg',
        source: 'browser_face', image_data_url: data, face_command_seq: 11 };
      const capture = await captureBrowserFaceToEye({ reason: 'isolated receipt test' });
      await visionPreview.decode();
      const probe = document.createElement('canvas'); probe.width = probe.height = 1;
      probe.getContext('2d').drawImage(visionPreview, 0, 0, 1, 1);
      const pixels = Array.from(probe.getContext('2d').getImageData(0, 0, 1, 1).data);
      const duplicate = await applySensingEyeInboxItem(item);
      const captured = { staged: capture.staged, duplicate, pixels, width: visionPreview.naturalWidth,
        last: sensingEyeInboxState.lastSeq, handled: sensingEyeInboxState.has(String(latest)),
        assets: sensingEyeSessionAssetFilenamesForSave(), messages: sent.filter(e => e.item?.content?.some(x => x.type === 'input_image')).length };
      await clearSensingEyeState();
      const oldIgnored = await applySensingEyeInboxItem(item);
      const cleared = { oldIgnored, empty: !sensingEyeContent.imageUrl, ignore: sensingEyeInboxState.ignoreSeqThrough };
      latest++;
      item = { ...item, seq: latest, filename: 'late.jpg', saved_filename: 'late.jpg' };
      let release;
      loadImage = async url => { await new Promise(resolve => { release = resolve; }); return original.loadImage(url); };
      const pending = applySensingEyeInboxItem(item);
      for (let i = 0; !release && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 5));
      if (!release) throw Error('Decode did not start');
      await clearSensingEyeState({ source: 'session_connect' });
      release();
      const stale = { applied: await pending, empty: !sensingEyeContent.imageUrl,
        assets: sensingEyeSessionAssetFilenamesForSave() };
      loadImage = original.loadImage;
      await pollSensingEyeInbox();
      return { captured, cleared, stale, schedules, calls,
        globalsGone: [typeof sensingEyeInboxLastSeq, typeof sensingEyeInboxIgnoreSeqThrough, typeof handledSensingEyeInboxSeqs].every(x => x === 'undefined'),
        last: sensingEyeInboxState.lastSeq, ignore: sensingEyeInboxState.ignoreSeqThrough };
    } finally {
      realtimeConnection.requestStop();
      window.fetch = original.fetch; postFace = original.postFace; browserFaceControllerActive = original.browserFaceControllerActive;
      scheduleSensingEyeInboxPoll = original.scheduleSensingEyeInboxPoll; scheduleIdlePonder = original.scheduleIdlePonder; loadImage = original.loadImage;
    }
  });
  assert.equal(result.captured.staged, true); assert.equal(result.captured.duplicate, false);
  assert.equal(result.captured.width, 80); assert.ok(result.captured.pixels[1] > 180);
  assert.equal(result.captured.last, 20001); assert.equal(result.captured.handled, true);
  assert.equal(result.captured.messages, 1);
  assert.deepEqual(result.captured.assets, ['inbox-fixture.jpg']);
  assert.deepEqual(result.cleared, { oldIgnored: false, empty: true, ignore: 20001 });
  assert.deepEqual(result.stale, { applied: false, empty: true, assets: ['inbox-fixture.jpg'] });
  assert.equal(result.globalsGone, true); assert.equal(result.last, 20002); assert.equal(result.ignore, 20002);
  assert.equal(result.schedules, 1); assert.ok(result.calls.includes('capture_to_eye'));
  return result;
}
module.exports = { checkInboxState };

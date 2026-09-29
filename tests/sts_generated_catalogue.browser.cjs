const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.ROBOT_790_PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext();
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (['GET', 'HEAD'].includes(request.method()) && url.hostname === '127.0.0.1') return route.continue();
      return route.abort();
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'sendBeacon', { value: () => false });
      window.WebSocket = class extends WebSocket {
        constructor() { throw Error('Live connection prohibited'); }
      };
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:8790/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof sensingEyeContent === 'object');
    const result = await page.evaluate(async () => {
      const original = { fetch: window.fetch, scheduleIdlePonder, postFace };
      const name = 'unstaged-loose-eyes.png', saved = 'unstaged-loose-eyes.jpg';
      const sent = [], reads = [], writes = [];
      let hold = false, release;
      const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#00aaee'; ctx.fillRect(0, 0, 100, 80);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
      scheduleIdlePonder = () => {};
      postFace = async () => ({ status: 'ok' });
      window.fetch = async (target, options = {}) => {
        const url = new URL(target, location.href);
        if (url.pathname === '/api/sensing-eye/list') {
          return json({ status: 'ok', lookup_version: 1, total: 1,
            files: [{ id: `generated:${name}`, filename: name, storage: 'generated', kind: 'image', url: `/generated-images/${name}` }] });
        }
        if (url.pathname === `/generated-images/${name}`) {
          reads.push(url.pathname);
          if (hold) await new Promise(resolve => { release = resolve; });
          return new Response(blob);
        }
        if (url.pathname === '/api/sensing-eye/inbox' && options.method === 'POST') {
          writes.push(JSON.parse(options.body));
          return json({ status: 'ok', seq: 90000, saved_filename: saved, saved_url: `/sensing-eye/${saved}` });
        }
        if (!['GET', 'HEAD'].includes(options.method || 'GET')) throw Error(`Unexpected write: ${url.pathname}`);
        return original.fetch(target, options);
      };
      try {
        realtimeConnection.adopt({ readyState: WebSocket.OPEN, send: data => sent.push(JSON.parse(data)) });
        const matches = await listSensingEyeNotes({ query: 'loose eyes' });
        const discovery = { count: matches.count, id: matches.notes[0].id,
          untouched: !sensingEyeContent.imageUrl, writes: writes.length, reads: reads.length };
        const preview = JSON.stringify({ url: generatedPreview.url, name: generatedPreview.name, revision: generatedPreview.revision });
        const recalled = await recallSensingEyeNote({ note_id: matches.notes[0].id });
        await visionPreview.decode();
        const probe = document.createElement('canvas'); probe.width = probe.height = 1;
        probe.getContext('2d').drawImage(visionPreview, 0, 0, 1, 1);
        const pixels = Array.from(probe.getContext('2d').getImageData(0, 0, 1, 1).data);
        const successful = { recalled, attached: sensingEyeSessionAssetFilenamesForSave(), reads: [...reads],
          writes: writes.map(x => ({ filename: x.filename, source: x.source })),
          pixels, width: visionPreview.naturalWidth,
          imageMessages: sent.filter(x => x.item?.content?.some(y => y.type === 'input_image')).length,
          previewUnchanged: preview === JSON.stringify({ url: generatedPreview.url, name: generatedPreview.name, revision: generatedPreview.revision }) };
        hold = true;
        const pending = selectSensingEyeImage({ image_id: matches.notes[0].id }).then(() => '', error => error.message);
        for (let i = 0; !release && i < 200; i++) await new Promise(resolve => setTimeout(resolve, 5));
        if (!release) throw Error('Recall did not reach file fetch');
        await setSensingTextContent('newer eye content', 'replacement', { saveToFilesystem: false });
        release();
        const race = { error: await pending, text: sensingEyeContent.text, writes: writes.length };
        return { discovery, successful, race };
      } finally {
        realtimeConnection.requestStop();
        window.fetch = original.fetch; scheduleIdlePonder = original.scheduleIdlePonder; postFace = original.postFace;
      }
    });
    assert.deepEqual(result.discovery, { count: 1, id: 'generated:unstaged-loose-eyes.png', untouched: true, writes: 0, reads: 0 });
    assert.equal(result.successful.recalled.selected.staged, true);
    assert.deepEqual(result.successful.attached, ['unstaged-loose-eyes.jpg']);
    assert.deepEqual(result.successful.reads, ['/generated-images/unstaged-loose-eyes.png']);
    assert.deepEqual(result.successful.writes, [{ filename: 'unstaged-loose-eyes.png', source: 'generated image' }]);
    assert.equal(result.successful.width, 100);
    assert.ok(result.successful.pixels[1] > 150 && result.successful.pixels[2] > 200);
    assert.equal(result.successful.imageMessages, 1);
    assert.equal(result.successful.previewUnchanged, true);
    assert.match(result.race.error, /superseded/);
    assert.equal(result.race.text, 'newer eye content');
    assert.equal(result.race.writes, 1);
    assert.deepEqual(errors, []);
    const out = path.resolve(__dirname, '../logs/maintenance/generated-catalogue');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'browser.json'), JSON.stringify(result, null, 2));
    console.log('Generated catalogue browser checks passed: discovery, exact recall, pixels, attachment, preview, stale recall.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

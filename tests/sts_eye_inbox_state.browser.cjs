const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.ROBOT_790_PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = {};
  try {
    const context = await browser.newContext();
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (['GET', 'HEAD'].includes(request.method()) && url.hostname === '127.0.0.1') return route.continue();
      return route.abort();
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'sendBeacon', { value: () => false });
      window.WebSocket = class extends WebSocket { constructor() { throw Error('Live connection prohibited'); } };
    });
    for (const [label, helper, method] of [
      ['inbox', 'sts_eye_inbox_state_browser.cjs', 'checkInboxState'],
      ['persistence', 'sts_eye_persistence_browser.cjs', 'checkEyePersistence'],
      ['assets', 'sts_eye_assets_browser.cjs', 'checkEyeAssets'],
    ]) {
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:8790/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof sensingEyeInboxState === 'object');
      results[label] = await require(`./helpers/${helper}`)[method](page);
      assert.deepEqual(errors, []);
      await page.close();
    }
    const out = path.resolve(__dirname, '../logs/maintenance/inbox-state');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'browser.json'), JSON.stringify(results, null, 2));
    console.log('Inbox state, late-save persistence and session asset browser checks passed.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

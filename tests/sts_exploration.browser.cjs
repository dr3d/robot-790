const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.ROBOT_790_PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const artifacts = path.resolve(__dirname, '../logs/maintenance/exploration-browser');
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext();
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname === '/api/realtime/ready') return route.fulfill({
        contentType: 'application/json', body: '{"ready":true}',
      });
      if (url.hostname === '127.0.0.1' && ['GET', 'HEAD'].includes(request.method())
        && !url.pathname.startsWith('/api/exploration')) return route.continue();
      return route.abort();
    });
    await context.addInitScript(() => {
      navigator.sendBeacon = () => false;
      window.WebSocket = class { constructor() { throw Error('No live Eric connections in this test'); } };
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:8790/', { waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('#idleExploration').inputValue(), '5');
    for (const value of ['10', '0', '8']) {
      await page.locator('#idleExploration').evaluate((input, value) => {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, value);
      await page.reload({ waitUntil: 'domcontentloaded' });
      assert.equal(await page.locator('#idleExploration').inputValue(), value);
      assert.equal(await page.locator('#idleExplorationValue').textContent(), value === '0' ? 'Off' : `${value}/10`);
      assert.equal(await page.evaluate(() => Boolean(realtimeConnection.socket)), false);
    }
    for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
      await page.setViewportSize({ width, height });
      const panel = page.locator('#labRunExpando');
      await panel.evaluate(panel => {
        for (let item = panel; item; item = item.parentElement) if (item.tagName === 'DETAILS') item.open = true;
      });
      const control = page.locator('label').filter({ has: page.locator('#idleExploration') });
      await control.scrollIntoViewIfNeeded();
      await panel.screenshot({ path: path.join(artifacts, `${name}.png`) });
      const dimensions = await control.evaluate(label => {
        const rect = label.getBoundingClientRect(), slider = label.querySelector('input').getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: innerWidth, scroll: label.scrollWidth, client: label.clientWidth,
          sliderLeft: slider.left, sliderRight: slider.right, sliderWidth: slider.width };
      });
      assert(dimensions.left >= 0 && dimensions.right <= dimensions.width && dimensions.scroll <= dimensions.client
        && dimensions.sliderWidth > 0 && dimensions.sliderLeft >= dimensions.left && dimensions.sliderRight <= dimensions.right,
      `${name} label and slider fit: ${JSON.stringify(dimensions)}`);
    }
    assert.deepEqual(errors, []);
    console.log('Exploration slider: desktop/mobile fit, defaults, saved 10/0/8, no connection or page errors.');
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });

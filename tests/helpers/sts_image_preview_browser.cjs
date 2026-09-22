const assert = require('node:assert/strict');
const path = require('node:path');

// Actual page renderer and DOM; simulated generation/turn callbacks, no paid request or eye delivery.
async function checkImagePreview(page, artifacts) {
  const result = await page.evaluate(async () => {
    const originalFetch = window.fetch, eye = visionImageUrl;
    const canvas = document.createElement('canvas');
    canvas.width = 300; canvas.height = 192;
    const paint = canvas.getContext('2d');
    paint.fillStyle = '#266c7c'; paint.fillRect(0, 0, 300, 192);
    paint.fillStyle = '#e8c957'; paint.fillRect(60, 40, 180, 112);
    const url = canvas.toDataURL('image/png');
    let current = true, release, calls = 0;
    window.fetch = (target, options) => {
      if (new URL(target, location.href).pathname !== '/api/images/generate' || options?.method !== 'POST') {
        return originalFetch(target, options);
      }
      calls++;
      return new Promise(resolve => { release = () => resolve({ ok: true,
        json: async () => ({ status: 'ok', filename: 'preview-fixture.png', url }) }); });
    };
    try {
      clearGeneratedImage();
      const pending = generateImage({ prompt: 'Offline thumbnail fixture',
        _isCurrent: () => current, _isPreviewCurrent: () => true });
      current = false;
      release();
      const receipt = await pending;
      await generatedImagePreview.decode();
      await topImagePreview.decode();
      paint.clearRect(0, 0, 300, 192);
      paint.drawImage(generatedImagePreview, 0, 0);
      const pixel = Array.from(paint.getImageData(100, 80, 1, 1).data);
      return { calls, displayed: receipt.displayed, retained: receipt.retained, staged: receipt.staged,
        eyeUnchanged: visionImageUrl === eye, state: generatedImageStatusState,
        imageWidth: generatedImagePreview.naturalWidth, pixel,
        controlsReady: !generatedImageOpenButton.disabled && !generatedImageToEyeButton.disabled && !generatedImageClearButton.disabled,
        headerReady: topImageStatus.dataset.state === 'ready' && !topImagePreview.hidden,
        noSocket: !realtimeConnection.socket };
    } finally { window.fetch = originalFetch; }
  });
  assert.deepEqual(result, { calls: 1, displayed: true, retained: true, staged: false,
    eyeUnchanged: true, state: 'ready', imageWidth: 300, pixel: [232, 201, 87, 255],
    controlsReady: true, headerReady: true, noSocket: true });
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    const panel = page.locator('#generatedImageExpando');
    await panel.evaluate(element => {
      for (let node = element; node; node = node.parentElement) {
        if (node.tagName === 'DETAILS') node.open = true;
      }
    });
    await panel.scrollIntoViewIfNeeded();
    const fits = await panel.locator('#generatedImagePreview').evaluate(img => {
      const rect = img.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= innerWidth;
    });
    assert.equal(fits, true, `${name} thumbnail fits`);
    await panel.screenshot({ path: path.join(artifacts, `image-preview-${name}.png`) });
  }
  await page.evaluate(() => clearGeneratedImage());
  return result;
}

module.exports = { checkImagePreview };

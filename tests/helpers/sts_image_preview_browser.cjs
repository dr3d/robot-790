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
        eyeUnchanged: visionImageUrl === eye, state: generatedPreview.state,
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
  const races = await page.evaluate(async () => {
    const originalFetch = window.fetch, eye = visionImageUrl, outcomes = [];
    try {
      for (const action of ['clear', 'replace', 'disconnect']) {
        for (const fail of [false, true]) {
          clearGeneratedImage();
          let finish, current = true, calls = 0;
          window.fetch = (target, options) => {
            if (new URL(target, location.href).pathname !== '/api/images/generate') throw Error('Unexpected image test route');
            calls++;
            return new Promise((resolve, reject) => { finish = () => fail ? reject(Error('late failure'))
              : resolve({ok:true,json:async()=>({status:'ok',filename:'old.png',url:'/old.png'})}); });
          };
          const pending = generateImage({prompt:'Offline race',_isCurrent:()=>current,_isPreviewCurrent:()=>current});
          if (action === 'clear') clearGeneratedImage();
          if (action === 'replace') showGeneratedImage({filename:'new.png',url:'/new.png'});
          if (action === 'disconnect') current = false;
          finish();
          let receipt, error;
          try { receipt = await pending; } catch (e) { error = e.message; }
          outcomes.push({action,fail,calls,state:generatedPreview.state,name:generatedPreview.name,
            displayed:receipt?.displayed ?? null,error:error || null,eyeUnchanged:visionImageUrl===eye,
            disabled:generatedImageOpenButton.disabled,header:topImageStatus.dataset.state});
        }
      }
    } finally { window.fetch = originalFetch; clearGeneratedImage(); }
    return outcomes;
  });
  for (const row of races) {
    assert.equal(row.calls,1);
    assert.equal(row.eyeUnchanged,true);
    assert.equal(row.state,row.action==='replace'?'ready':row.fail&&row.action==='disconnect'?'failed':'empty');
    assert.equal(row.header,row.state);
    assert.equal(row.name,row.action==='replace'?'new.png':'');
    assert.equal(row.disabled,row.action!=='replace');
    assert.equal(row.displayed,row.fail?null:false);
    assert.equal(row.error,row.fail?'late failure':null);
  }
  return {...result,races};
}

module.exports = { checkImagePreview };

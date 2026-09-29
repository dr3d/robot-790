const assert = require('node:assert/strict');

// Real page owner and sessionStorage; the save transport and device calls are mocked.
async function checkEyeAssets(page) {
  await page.waitForFunction(() => typeof sensingEyeSessionAssets === 'object');
  const seeded = await page.evaluate(() => {
    clearSensingEyeSessionAssets();
    rememberSensingEyeSessionAsset('fixture/z.jpg');
    rememberSensingEyeSessionAsset('fixture/a.txt');
    rememberSensingEyeSessionAsset('fixture/z.jpg');
    const copy = sensingEyeSessionAssetFilenamesForSave(); copy.push('outside.jpg');
    return { files: sensingEyeSessionAssetFilenamesForSave(),
      legacyGone: typeof sensingEyeSessionAssetFilenames === 'undefined',
      api: Object.keys(sensingEyeSessionAssets).sort() };
  });
  assert.deepEqual(seeded, { files: ['a.txt', 'z.jpg'], legacyGone: true,
    api: ['clear', 'filenames', 'load', 'persist', 'remember'] });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const restored = await page.evaluate(() => sensingEyeSessionAssetFilenamesForSave());
  assert.deepEqual(restored, ['a.txt', 'z.jpg']);
  const save = await page.evaluate(async () => {
    const original = { waitForPendingUserTranscriptBeforeSessionSave, conversationTranscriptSinceCleanConnect,
      flushSensingEyeInboxForSessionSave, buildEricContinuityState, buildEricContinuitySessionBody,
      continuityPinnedFilenamesForSave, contextUsageForSessionSave, saveContinuitySession,
      refreshSavedContinuityNote, postFace, clearSensingEyeInboxOnServer, clearBrowserFaceCaptureQueue };
    const requests = [];
    let fail = true;
    try {
      postFace = async () => ({ ok: true });
      clearSensingEyeInboxOnServer = async () => ({ latest_seq: 0 });
      clearBrowserFaceCaptureQueue = async () => null;
      await clearSensingEyeState({ source: 'session_connect' });
      const afterClear = sensingEyeSessionAssetFilenamesForSave();
      waitForPendingUserTranscriptBeforeSessionSave = async () => {};
      conversationTranscriptSinceCleanConnect = () => 'Fixture exchange.';
      flushSensingEyeInboxForSessionSave = async () => rememberSensingEyeSessionAsset('flushed.jpg');
      buildEricContinuityState = () => ({ conversation: { line_count: 1 } });
      buildEricContinuitySessionBody = () => 'Fixture exchange.';
      continuityPinnedFilenamesForSave = () => [];
      contextUsageForSessionSave = () => null;
      refreshSavedContinuityNote = async () => {};
      saveContinuitySession = async request => {
        requests.push(JSON.parse(JSON.stringify(request)));
        if (fail) throw Error('fixture reply lost');
        return { session_filename: 'sessions/fixture-assets.txt', sensing_eye_asset_count: request.sensingEyeFilenames.length };
      };
      let error;
      try { await saveEricContinuitySnapshot(); } catch (e) { error = e.message; }
      const retained = sensingEyeSessionAssetFilenamesForSave();
      const storedOnFailure = JSON.parse(sessionStorage.getItem(sensingEyeSessionAssetStorageKey));
      fail = false;
      await saveEricContinuitySnapshot();
      return { afterClear, error, retained, storedOnFailure, requests,
        afterSave: sensingEyeSessionAssetFilenamesForSave(),
        storageCleared: sessionStorage.getItem(sensingEyeSessionAssetStorageKey) === null,
        connected: realtimeConnected() };
    } finally {
      for (const [name, fn] of Object.entries(original)) window[name] = fn;
    }
  });
  assert.deepEqual(save.afterClear, ['a.txt', 'z.jpg']);
  assert.match(save.error, /fixture reply lost/);
  assert.deepEqual(save.retained, ['a.txt', 'flushed.jpg', 'z.jpg']);
  assert.deepEqual(save.storedOnFailure, save.retained);
  assert.equal(save.requests.length, 2);
  assert.deepEqual(save.requests[0], save.requests[1]);
  assert.deepEqual(save.requests[0].sensingEyeFilenames, save.retained);
  assert.deepEqual(save.afterSave, []);
  assert.equal(save.storageCleared, true); assert.equal(save.connected, false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const afterReload = await page.evaluate(() => sensingEyeSessionAssetFilenamesForSave());
  assert.deepEqual(afterReload, []);
  return { seeded, restored, save, afterReload };
}

module.exports = { checkEyeAssets };

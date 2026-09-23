const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.ROBOT_790_PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const root = path.resolve(__dirname, '..');
  const artifacts = path.join(root, 'logs/maintenance/audio-owner-browser');
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const results = {};
  try {
    const page = await browser.newPage();
    await page.addScriptTag({ path: path.join(root, 'web/sts/audio-playback.js') });
    await page.addScriptTag({ path: path.join(root, 'web/sts/tool-continuation.js') });
    await page.evaluate(async () => {
      const context = new AudioContext({ sampleRate: 16000 });
      const gain = context.createGain(), analyser = context.createAnalyser();
      gain.gain.value = 0;
      gain.connect(context.destination);
      const starts = [], buffers = [], ended = [], errors = [];
      const createSource = context.createBufferSource.bind(context);
      context.createBufferSource = () => {
        const source = createSource(), start = source.start.bind(source);
        source.start = at => { starts.push(at); buffers.push(source.buffer.duration); start(at); };
        source.addEventListener('ended', () => ended.push(context.currentTime));
        return source;
      };
      const state = { context, gain, analyser, starts, buffers, ended, errors,
        generation: 1, stopped: false, settled: 0 };
      const owner = Robot790AudioPlayback.create({
        getContext: () => context, ensurePlayback: async () => { await context.resume(); },
        getPlaybackDestination: () => gain, getRecordingDestination: () => analyser,
        getSessionGeneration: () => state.generation, isStopped: () => state.stopped,
        decodePcm16: bytes => {
          const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          return Float32Array.from({ length: bytes.length / 2 }, (_, i) => view.getInt16(i * 2, true) / 32768);
        },
        onSettled: () => { state.settled++; }, onError: error => errors.push(error.message),
      });
      const tone = seconds => {
        const data = new Uint8Array(Math.round(seconds * 16000) * 2), view = new DataView(data.buffer);
        for (let i = 0; i < data.length / 2; i++) view.setInt16(i * 2, Math.round(12000 * Math.sin(i * Math.PI * 2 * 440 / 16000)), true);
        return data;
      };
      window.check = { ...state, owner, tone, state };
      await owner.play(tone(0.4));
      await owner.play(tone(0.4));
    });
    await page.waitForFunction(() => check.owner.isPlaying());
    results.serialized = await page.evaluate(() => ({ starts: check.starts, durations: check.buffers,
      busy: check.owner.isActive(), playing: check.owner.isPlaying() }));
    assert.equal(results.serialized.busy, true);
    assert.equal(results.serialized.playing, true);
    assert(Math.abs(results.serialized.starts[1] - results.serialized.starts[0] - 0.4) < 1e-6);
    await page.waitForFunction(() => {
      const values = new Float32Array(check.analyser.fftSize);
      check.analyser.getFloatTimeDomainData(values);
      return values.some(x => Math.abs(x) > 0.01);
    });
    results.recordingTapHasSignalWithMutedGain = true;
    await page.waitForFunction(() => !check.owner.isActive());
    assert.equal(await page.evaluate(() => check.owner.isPlaying()), false);

    await page.evaluate(async () => { await check.owner.play(check.tone(1)); });
    await page.waitForFunction(() => check.owner.isPlaying());
    await page.evaluate(async () => { await check.context.suspend(); });
    const suspendedAt = await page.evaluate(() => check.context.currentTime);
    await page.waitForTimeout(250);
    results.suspended = await page.evaluate(() => ({ clock: check.context.currentTime,
      busy: check.owner.isActive(), playing: check.owner.isPlaying() }));
    assert.equal(results.suspended.clock, suspendedAt);
    assert.equal(results.suspended.busy, true);
    assert.equal(results.suspended.playing, false);
    await page.evaluate(async () => { await check.context.resume(); });
    await page.waitForFunction(() => !check.owner.isActive());

    results.stopAndRestart = await page.evaluate(async () => {
      await check.owner.play(check.tone(3));
      await check.owner.play(check.tone(3));
      check.owner.stop();
      const stopped = !check.owner.isActive() && !check.owner.isPlaying();
      check.state.generation++;
      await check.owner.play(check.tone(0.1));
      return { stopped, busyAfterRestart: check.owner.isActive(),
        leadSeconds: check.starts.at(-1) - check.context.currentTime };
    });
    assert.equal(results.stopAndRestart.stopped, true);
    assert.equal(results.stopAndRestart.busyAfterRestart, true);
    assert(results.stopAndRestart.leadSeconds < 0.15, 'old six-second schedule must not survive Stop');
    await page.waitForFunction(() => !check.owner.isActive());
    await page.evaluate(() => { check.owner.enqueue(check.tone(0.05)); });
    await page.waitForFunction(() => check.owner.isPlaying());
    await page.waitForFunction(() => !check.owner.isActive());
    assert.deepEqual(await page.evaluate(() => check.errors), []);
    results.toolContinuationBeforeDrain = await page.evaluate(async () => {
      const requests = [];
      const session = { generation: check.state.generation };
      check.continuationRequests = requests;
      check.continuation = Robot790ToolContinuation.create({
        isCurrent: s => s.generation === check.state.generation,
        isSameSession: s => s.generation === check.state.generation,
        getUserActivity: () => 100, audioActive: () => check.owner.isActive(),
        getMaxRounds: () => 8, hasSessionMove: () => false,
        onSessionMove() {}, onTerminal() {},
        onFollowup: request => requests.push({ ...request, audioBusy: check.owner.isActive() }),
      });
      await check.owner.play(check.tone(0.35));
      check.continuation.beginCall({ call_id: 'tool', name: 'search_web' }, { ...session, userActivityAt: 100 });
      check.continuation.completeResponse();
      check.continuation.finishCall(session);
      return { audioBusy: check.owner.isActive(), requests: requests.length };
    });
    assert.deepEqual(results.toolContinuationBeforeDrain, { audioBusy: true, requests: 0 });
    await page.waitForFunction(() => check.continuationRequests.length === 1);
    results.toolContinuationAfterDrain = await page.evaluate(() => ({
      requests: check.continuationRequests.length, audioBusyAtDispatch: check.continuationRequests[0].audioBusy,
    }));
    assert.deepEqual(results.toolContinuationAfterDrain, { requests: 1, audioBusyAtDispatch: false });
    await page.evaluate(async () => { check.owner.stop(); await check.context.close(); });
    await page.close();

    // The real page must load the asset and adapters without touching a live session.
    const context = await browser.newContext();
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() === 'GET' && url.pathname === '/api/realtime/ready') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ready":true}' });
      }
      if (['GET', 'HEAD'].includes(request.method()) && url.hostname === '127.0.0.1') return route.continue();
      return route.abort();
    });
    await context.addInitScript(() => {
      // Exit beacons can outlive route interception during page teardown.
      window.isolatedBeacons = [];
      Object.defineProperty(navigator, 'sendBeacon', { value: (url, body) => {
        window.isolatedBeacons.push({ url: String(url), bytes: body?.size || 0 });
        return false;
      } });
      const NativeSocket = WebSocket;
      window.isolatedNativeWebSocket = NativeSocket;
      window.WebSocket = class extends NativeSocket {
        constructor() { throw new Error('Live connection prohibited in the audio smoke test'); }
      };
    });
    const ui = await context.newPage(), pageErrors = [];
    ui.on('pageerror', error => pageErrors.push(error.message));
    await ui.goto('http://127.0.0.1:8790/', { waitUntil: 'domcontentloaded' });
    await ui.waitForFunction(() => typeof audioPlayback === 'object' && typeof outputAudioActive === 'function');
    results.page = await ui.evaluate(() => ({ factory: typeof Robot790AudioPlayback.create,
      active: outputAudioActive(), playing: outputAudioPlaying(), connected: realtimeConnected() }));
    assert.deepEqual(results.page, { factory: 'function', active: false, playing: false, connected: false });
    results.continuationPage = await ui.evaluate(() => ({
      factory: typeof Robot790ToolContinuation.create, pending: toolContinuation.pending,
      needed: toolContinuation.needed, dispatch: typeof dispatchToolFollowup,
    }));
    assert.deepEqual(results.continuationPage, { factory: 'function', pending: 0, needed: false, dispatch: 'function' });
    results.connectionPage = await ui.evaluate(() => ({
      factory: typeof Robot790RealtimeConnection.create,
      generation: realtimeConnection.generation, stopped: realtimeConnection.stopped,
      transition: realtimeConnection.transition, legacySaveBusy: typeof continuitySaveBusy,
      hasSocket: Boolean(realtimeConnection.socket), active: activeRealtimeSession(),
      legacySocket: typeof ws, legacyGeneration: typeof realtimeSessionGeneration,
      legacyStopped: typeof realtimeStopRequested,
    }));
    assert.deepEqual(results.connectionPage, {
      factory: 'function', generation: 0, stopped: false, hasSocket: false, active: false,
      transition: null, legacySaveBusy: 'undefined',
      legacySocket: 'undefined', legacyGeneration: 'undefined', legacyStopped: 'undefined',
    });
    await ui.waitForFunction(() => realtimeReadiness.ready);
    results.transitionControls = await ui.evaluate(async () => {
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      const pending = runConnectionTransition('isolated UI check', () => gate);
      setConnectionButtonsDisabled(false);
      const controls = [connectButton, previousConnectButton, emptyConnectButton];
      const lockedDuringWork = controls.every(button => button.disabled);
      await connect();
      await connectPrevious();
      await disconnectRealtime();
      const stillOwned = realtimeConnection.transition?.kind === 'isolated UI check';
      release();
      await pending;
      return { lockedDuringWork, stillOwned, released: realtimeConnection.transition === null,
        availableAfterWork: controls.every(button => !button.disabled), hasSocket: Boolean(realtimeConnection.socket) };
    });
    assert.deepEqual(results.transitionControls, { lockedDuringWork: true, stillOwned: true,
      released: true, availableAfterWork: true, hasSocket: false });
    assert.equal(await ui.locator('#saveAndHaltEric').count(), 0);
    assert.equal(await ui.locator('#latestThreadExpando, #conversationNoteSave, #clearLatestThread, #resetToPinnedContext').count(), 0);
    assert.equal(await ui.locator('#pinnedNotesExpando #loadEricMemories').count(), 1);
    results.serverManagement = await ui.locator('#serverManagementExpando button').allTextContents();
    assert.deepEqual(results.serverManagement, ['Halt', 'Restart', 'Unload']);
    for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
      await ui.setViewportSize({ width, height });
      await ui.screenshot({ path: path.join(artifacts, `${name}.png`) });
      await ui.locator('#serverManagementExpando').evaluate(panel => {
        for (let element = panel; element; element = element.parentElement) {
          if (element.tagName === 'DETAILS') element.open = true;
        }
      });
      const panel = ui.locator('#serverManagementExpando');
      await panel.scrollIntoViewIfNeeded();
      const buttonsFit = await panel.locator('button').evaluateAll(buttons => buttons.every(button => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.left >= 0 && rect.right <= innerWidth && button.scrollWidth <= button.clientWidth;
      }));
      assert.equal(buttonsFit, true, `${name} server controls fit`);
      await panel.screenshot({ path: path.join(artifacts, `server-management-${name}.png`) });
      const notes = ui.locator('#pinnedNotesExpando');
      await notes.evaluate(panel => {
        for (let element = panel; element; element = element.parentElement) {
          if (element.tagName === 'DETAILS') element.open = true;
        }
      });
      await notes.scrollIntoViewIfNeeded();
      assert.equal(await notes.locator('#loadEricMemories').isVisible(), true);
      const memoryToggleFits = await notes.locator('.toggle-row').evaluate(label => {
        const rect = label.getBoundingClientRect();
        return rect.width > 0 && rect.left >= 0 && rect.right <= innerWidth && label.scrollWidth <= label.clientWidth;
      });
      assert.equal(memoryToggleFits, true, `${name} memory-loading toggle fits`);
      await notes.screenshot({ path: path.join(artifacts, `pinned-notes-${name}.png`) });
    }
    results.backendFeedback = await ui.evaluate(() => {
      let staleUpdates = 0;
      const restart = backendControlFeedback.begin({ kind: 'restart', isCurrent: () => true });
      const haltAvailable = haltRuntimeButtons.every(button => !button.disabled);
      const halt = backendControlFeedback.begin({ kind: 'halt', isCurrent: () => true });
      restart.complete(() => { staleUpdates++; });
      const lockedForHalt = restartServerButton.disabled && unloadServerButton.disabled
        && haltRuntimeButtons.every(button => button.disabled);
      halt.complete();
      return { haltAvailable, lockedForHalt, staleUpdates,
        released: !restartServerButton.disabled && !unloadServerButton.disabled
          && haltRuntimeButtons.every(button => !button.disabled) };
    });
    assert.deepEqual(results.backendFeedback,
      { haltAvailable: true, lockedForHalt: true, staleUpdates: 0, released: true });
    results.imagePreview = await require('./helpers/sts_image_preview_browser.cjs').checkImagePreview(ui, artifacts);
    results.socketCloseAudio = await require('./helpers/sts_close_audio_browser.cjs').checkSocketCloseAudio(ui);
    results.networkLoss = await require('./helpers/sts_network_loss_browser.cjs').checkNetworkLoss(ui);
    const restartUi = await context.newPage();
    restartUi.on('pageerror', error => pageErrors.push(error.message));
    await restartUi.goto('http://127.0.0.1:8790/', { waitUntil: 'domcontentloaded' });
    results.restartCleanup = await require('./helpers/sts_restart_browser.cjs').checkRestartCleanup(restartUi);
    await restartUi.close();
    const monitorUi = await context.newPage();
    monitorUi.on('pageerror', error => pageErrors.push(error.message));
    await monitorUi.goto('http://127.0.0.1:8790/', { waitUntil: 'domcontentloaded' });
    results.brain2Speech = await require('./helpers/sts_brain2_speech_browser.cjs').checkBrain2Speech(monitorUi);
    results.brain2Surface = await require('./helpers/sts_brain2_surface_browser.cjs').checkBrain2Surface(monitorUi);
    results.exitBeaconIsolation = await monitorUi.evaluate(() => {
      window.dispatchEvent(new Event('pagehide'));
      return { intercepted: isolatedBeacons.length,
        onlySnapshots: isolatedBeacons.every(item => new URL(item.url).pathname === '/api/logs/record'),
        hasContent: isolatedBeacons.some(item => item.bytes > 0) };
    });
    assert(results.exitBeaconIsolation.intercepted > 0, 'exercise actual page-exit snapshot wiring');
    assert.equal(results.exitBeaconIsolation.onlySnapshots, true);
    assert.equal(results.exitBeaconIsolation.hasContent, true);
    await monitorUi.close();
    const receiptUi = await context.newPage();
    receiptUi.on('pageerror', error => pageErrors.push(error.message));
    await receiptUi.goto('http://127.0.0.1:8790/', { waitUntil: 'domcontentloaded' });
    results.receiptImageWait = await require('./helpers/sts_receipt_image_browser.cjs').checkReceiptAndImageWait(receiptUi);
    await receiptUi.close();
    const mapUi = await context.newPage();
    let mapReady = false;
    mapUi.on('pageerror', error => pageErrors.push(error.message));
    await mapUi.route('**/api/realtime/ready', route => route.fulfill({
      status: mapReady ? 200 : 503, contentType: 'application/json',
      body: JSON.stringify({ ready: mapReady })
    }));
    await mapUi.goto('http://127.0.0.1:8790/session-map.html', { waitUntil: 'domcontentloaded' });
    await mapUi.waitForFunction(() => Boolean(selectedSession()));
    assert.equal(await mapUi.locator('#connectInSts').isDisabled(), true);
    mapReady = true;
    await mapUi.waitForFunction(() => !connectButton.disabled);
    mapReady = false;
    await mapUi.waitForFunction(() => connectButton.disabled);
    results.mapReadiness = { unavailable: 'disabled', ready: 'enabled', lostService: 'disabled' };
    await mapUi.close();
    assert.deepEqual(pageErrors, []);
    await context.close();
    fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify(results, null, 2) + '\n');
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });

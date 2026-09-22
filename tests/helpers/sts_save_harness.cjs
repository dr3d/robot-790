const vm = require('node:vm');
const { loadFunctions } = require('./sts_tool_harness.cjs');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Actual page save/stop orchestration and request serialization. Storage, devices,
// note formatting/loading and UI are simulated; this never contacts a live server.
function saveFixture() {
  const calls = [], requests = [], saved = new Map(), timers = new Map();
  let timerId = 0;
  const socket = {
    readyState: 1,
    send(text) { calls.push(JSON.parse(text).type); },
    close() { calls.push('socket close'); this.readyState = 3; },
  };
  const c = vm.createContext({
    URL, location: { href: 'http://fixture.invalid/' },
    WebSocket: { OPEN: 1, CONNECTING: 0, CLOSED: 3 }, ws: socket,
    realtimeSessionGeneration: 1, realtimeStopRequested: false,
    continuitySaveBusy: false, continuitySaveHalted: false,
    intentionalExitCleanupInProgress: false,
    conversationLines: ['The last accepted thought.'], inputDraft: '',
    inputAudioTranscriptionPending: false, userSpeechActive: false,
    lastSpeechStartedAt: 0, brain2DeferredSurface: {},
    currentContinuitySessionFilename: 'sessions/parent.txt',
    continuityParentForCurrentRun: 'sessions/parent.txt',
    eyeAssets: ['existing-image.jpg'],
    disconnectButton: {}, startMicButton: {}, resetMicButton: {},
    idlePonderNowButton: {}, saveAndHaltEricButton: {}, events: {},
    log(_, message) { calls.push(message); },
    recordUiEvent() {}, setState(value) { calls.push(`state: ${value}`); },
    updateTypedInputButtons() {},
    haltRealtimeActivity() { calls.push('halt'); },
    stopVisionCamera() { calls.push('browser camera stop'); },
    stopEsp32Camera() { calls.push('network camera stop'); },
    micStream: {}, async stopMic() { calls.push('mic stop'); c.micStream = null; },
    audioRecordingActive: () => false, audioRecordFinalizing: false,
    audioRecordStopPromise: null,
    async waitForRealtimeClose() {},
    async recordExitPaneSnapshots() { calls.push('pane snapshots'); },
    async flushSensingEyeInboxForSessionSave() { calls.push('eye flush'); },
    conversationTranscriptSinceCleanConnect: () => c.conversationLines.join('\n'),
    buildEricContinuityState: () => ({
      conversation: { line_count: c.conversationLines.length },
      transcript: c.conversationLines.join('\n'),
    }),
    buildEricContinuitySessionBody: state => state.transcript,
    continuityPinnedFilenamesForSave: () => ['core/example.txt'],
    sensingEyeSessionAssetFilenamesForSave: () => [...c.eyeAssets],
    clearSensingEyeSessionAssets() { calls.push('clear saved eye assets'); c.eyeAssets = []; },
    contextUsageForSessionSave: () => ({ input_tokens: 53606 }),
    async readTextFile({ filename }) { calls.push(`reload: ${filename}`); },
    async fetchContinuitySessions() { calls.push('map refresh'); },
    micRuntimeLabel: () => 'off',
    openBrowserFaceWindow() {},
    async loadLatestContinuitySession() { calls.push('load latest'); },
    setTimeout(callback, ms) { timers.set(++timerId, { callback, ms }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    async sleepMs() { throw new Error('Test must explicitly release pending transcription'); },
    async fetch(url, options) {
      if (new URL(url).pathname !== '/api/continuity/save') throw new Error(`Unexpected request: ${url}`);
      const payload = JSON.parse(options.body);
      requests.push(payload);
      const filename = `sessions/saved-${requests.length}.txt`;
      saved.set(filename, payload);
      return { ok: true, json: async () => ({
        status: 'ok', session_filename: filename,
        parent_session_filename: payload.parent_session_filename,
        sensing_eye_asset_count: payload.sensing_eye_filenames.length,
      }) };
    },
  });
  loadFunctions(c, [
    'runtimeStep', 'continuityStep', 'beginIntentionalExitCleanup',
    'endIntentionalExitCleanupSoon', 'activeRealtimeSession', 'realtimeConnected',
    'send', 'quiesceRealtimeForSave', 'inputAudioTranscriptMayBePending',
    'waitForPendingUserTranscriptBeforeSessionSave', 'saveContinuitySession',
    'saveEricContinuitySnapshot', 'updateSaveAndHaltButton', 'disconnectRealtime',
    'saveAndHaltEricState', 'startContinuityEric', 'connect',
  ]);
  const fireTimer = ms => {
    const entry = [...timers].find(([, timer]) => timer.ms === ms);
    if (!entry) throw new Error(`No ${ms}ms timer is pending`);
    timers.delete(entry[0]);
    entry[1].callback();
  };
  return { c, calls, requests, saved, socket, timers, fireTimer };
}

const settle = () => new Promise(setImmediate);
module.exports = { saveFixture, deferred, settle };

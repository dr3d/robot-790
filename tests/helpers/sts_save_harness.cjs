const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
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
    URL, crypto: webcrypto, location: { href: 'http://fixture.invalid/' },
    WebSocket: { OPEN: 1, CONNECTING: 0, CLOSED: 3 }, ws: socket,
    realtimeSessionGeneration: 1, realtimeStopRequested: false,
    continuitySaveHalted: false,
    continuitySaveTransaction: null,
    intentionalExitCleanupInProgress: false,
    intentionalExitCleanupGeneration: 0,
    conversationLines: ['The last accepted thought.'], inputDraft: '',
    inputAudioTranscriptionPending: false, userSpeechActive: false,
    lastSpeechStartedAt: 0, brain2DeferredSurface: {},
    currentContinuitySessionFilename: 'sessions/parent.txt',
    continuityParentForCurrentRun: 'sessions/parent.txt',
    eyeAssets: ['existing-image.jpg'],
    disconnectButton: {}, startMicButton: {}, resetMicButton: {},
    idlePonderNowButton: {}, events: {},
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
    async readTextFile({ filename }) { calls.push(`reload: ${filename}`); return { filename }; },
    rememberLoadedNoteContext(note) { calls.push(`pin: ${note.filename}`); },
    async fetchContinuitySessions() { calls.push('map refresh'); },
    micRuntimeLabel: () => 'off',
    openBrowserFaceWindow() {},
    setTimeout(callback, ms) { timers.set(++timerId, { callback, ms }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    async sleepMs() { throw new Error('Test must explicitly release pending transcription'); },
    async fetch(url, options) {
      if (new URL(url).pathname !== '/api/continuity/save-transaction') throw new Error(`Unexpected request: ${url}`);
      const payload = JSON.parse(options.body);
      requests.push(payload);
      const existing = [...saved].find(([, item]) => item.save_request_id === payload.save_request_id);
      if (existing) assertSamePayload(existing[1], payload);
      const filename = existing?.[0] || `sessions/saved-${saved.size + 1}.txt`;
      saved.set(filename, payload);
      return { ok: true, json: async () => ({
        status: 'ok', session_filename: filename,
        save_request_id: payload.save_request_id,
        parent_session_filename: payload.parent_session_filename,
        sensing_eye_asset_count: payload.sensing_eye_filenames.length,
      }) };
    },
  });
  loadFunctions(c, [
    'runtimeStep', 'continuityStep', 'beginIntentionalExitCleanup',
    'endIntentionalExitCleanupSoon', 'activeRealtimeSession', 'realtimeConnected',
    'send', 'quiesceRealtimeForSave', 'inputAudioTranscriptMayBePending',
    'waitForPendingUserTranscriptBeforeSessionSave', 'continuitySaveRequestId', 'saveContinuitySession',
    'saveEricContinuitySnapshot', 'refreshSavedContinuityNote', 'disconnectRealtime', 'connect',
  ]);
  const fireTimer = ms => {
    const entry = [...timers].find(([, timer]) => timer.ms === ms);
    if (!entry) throw new Error(`No ${ms}ms timer is pending`);
    timers.delete(entry[0]);
    entry[1].callback();
  };
  return { c, calls, requests, saved, socket, timers, fireTimer };
}

function assertSamePayload(first, retry) {
  require('node:assert/strict').deepEqual(retry, first, 'a retry must carry exactly the frozen payload');
}

const settle = () => new Promise(setImmediate);

function installConnectionFixture(f) {
  const { c, calls } = f;
  const sockets = [];
  c.WebSocket = class {
    static OPEN = 1;
    static CONNECTING = 0;
    static CLOSED = 3;
    constructor() { this.readyState = 0; this.listeners = {}; sockets.push(this); }
    addEventListener(name, callback) { this.listeners[name] = callback; }
  };
  Object.assign(c, {
    saveFaceControllerPreference() {}, setConnectionButtonsDisabled() {},
    ensureRuntimeConfigLoaded: async () => {},
    pauseSessionPreparation: async () => { calls.push('preparation lease'); },
    releaseSessionPreparation: () => calls.push('release preparation lease'),
    prepareConnectionContext: async () => { calls.push('context budget'); },
    ensurePlayback: async () => {}, serverUrl: { value: 'ws://fixture.invalid/' },
    toolScopeDenials: new Map(), idleArt: { reset() {} }, suppressedResponseIds: new Set(),
    resetMicInterruptCandidate() {}, cancelBrain2MonitorSpeech() {},
    clearHotConversationState() { calls.push('clear old transcript'); c.conversationLines = []; },
    clearSensingEyeState: async () => {},
    resolveContinuitySessionForLoad: async () => ({ status: 'ok', session_filename: 'sessions/saved-1.txt' }),
    confirmContinuitySessionLoad: async () => {},
    loadCoreNoteContext: async () => { c.loadedNoteContexts.push({ filename: 'core/example.txt' }); },
    loadCurrentContinuitySession: async ({ sessionMetadata }) => {
      c.currentContinuitySessionFilename = sessionMetadata.session_filename;
      c.loadedNoteContexts.push({ filename: sessionMetadata.session_filename });
    },
    fetchContinuitySessionMetadata: async () => {},
    continuitySessionContext: () => true,
    updateLoadedNoteControls() {}, renderMemory() {}, updateSessionTools() {}, contextPanel: {},
  });
  loadFunctions(c, ['resetSessionContextForConnection', 'loadFreshContinuityContext']);
  return sockets;
}

module.exports = { saveFixture, deferred, settle, installConnectionFixture };

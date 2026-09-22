const { saveFixture, installConnectionFixture, settle } = require('./sts_save_harness.cjs');
const { loadFunctions } = require('./sts_tool_harness.cjs');
const { installAudioPlayback } = require('./sts_audio_harness.cjs');

// Register the real page's socket callbacks without opening a live socket.
// UI, devices, storage and clocks are simulated; no network request leaves here.
async function closeFixture() {
  const f = saveFixture(), { c, calls } = f;
  await c.disconnectRealtime();
  const sockets = installConnectionFixture(f);
  Object.assign(c, {
    connectionButtonsLocked: false,
    connectButton: {}, previousConnectButton: {}, emptyConnectButton: {},
    stopMicButton: {}, faceIdleButton: {}, faceBeatButton: {},
    updateContinuitySessionActionButtons() {},
    idleTimer: 90, idleTimerFireAt: 100, imageToolProtectionTimer: 91,
    imageToolProtectionUntil: 100, imageToolProtectionEnabled: true,
    assistantFinishPending: true, assistantFinishWasIdle: true, assistantFinishArmedAt: 100,
    responseActive: true, idleInFlight: true, brain2InFlight: true,
    gpuWatchInFlight: true, standingRoutineInFlight: true,
    gpuWatchRoutine: {}, standingRoutine: {}, micMutedForNarration: true,
    visionImageStaged: true,
    stopGpuWatch: () => calls.push('GPU watch stop'),
    stopStandingRoutine: () => calls.push('standing routine stop'),
    updateMicMuteButton() {}, updateVisionButtons() {}, syncServerPanelToConnection() {},
    updateIdleSchedulerStatus() {}, updateLanePressure() {},
    async stopAudioRecording() { calls.push('recording stop'); return { status: 'ok' }; },
  });
  for (const name of ['clearIdleSchedulerStatusTimer', 'clearBrain2Timer',
    'clearBrain2SurfaceTimer', 'cancelBrain2MonitorSpeech', 'clearAssistantFinishTimer',
    'resetConversationReengageCycle', 'clearMicFreshnessTimer', 'clearUserTurnPending']) {
    c[name] = () => calls.push(name);
  }
  c.clearAudioQueue = () => calls.push('clear audio queue');
  c.stopPlaybackNow = () => calls.push('stop playback');
  loadFunctions(c, ['setConnectionButtonsDisabled']);
  await c.connect();
  const socket = sockets[0];
  socket.readyState = 1;
  socket.send = packet => calls.push(JSON.parse(packet).type);
  socket.close = () => {
    calls.push('socket close');
    socket.readyState = 3;
    socket.listeners.close();
  };
  // Model an active run after the normal cleanup grace interval has elapsed.
  c.intentionalExitCleanupInProgress = false;
  c.micStream = {};
  c.conversationLines = ['Keep this unsaved exchange.'];
  c.eyeAssets = ['retained.jpg'];
  await settle();
  calls.length = 0;
  f.requests.length = 0;
  f.timers.clear();
  return { ...f, socket, sockets };
}

function installClosePlayback(f) {
  const { c } = f, sources = [];
  Object.assign(c, {
    recordingDestination: null, ensureEricPlaybackGain: () => null,
    stopSpeechMouthCue() { f.calls.push('stop speech mouth'); }, checkAssistantUtteranceFinished() {},
    audioContext: {
      currentTime: 10, state: 'running', destination: {},
      createBuffer: (_, n, rate) => ({ duration: n / rate, copyToChannel() {} }),
      createBufferSource() {
        const source = { stops: 0, connect() {}, start(at) { this.startAt = at; },
          stop() { this.stops++; this.stopped = true; } };
        sources.push(source);
        return source;
      },
    },
  });
  loadFunctions(c, ['clearAudioQueue', 'stopPlaybackNow', 'pcm16ToFloat32', 'outputAudioActive']);
  const playback = installAudioPlayback(c);
  return { playback, sources, pcm: seconds => new Uint8Array(seconds * 16000 * 2) };
}

function installClosingMic(f, gate) {
  const { c, calls } = f;
  Object.assign(c, {
    micProcessor: { disconnect: () => calls.push('old processor detached') },
    micSource: { disconnect: () => calls.push('old source detached') },
    micStream: { getTracks: () => [{ stop: () => calls.push('old track stopped') }] },
    micContext: { close: () => { calls.push('old context closing'); return gate.promise; } },
    detachMicFromRecording() {}, resetInputAudioBuffer() {},
    updateMicLevelMeters() {}, syncMicPanelToMic() {},
  });
  loadFunctions(c, ['stopMic']);
}

module.exports = { closeFixture, installClosePlayback, installClosingMic };

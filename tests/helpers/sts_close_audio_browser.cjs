const assert = require('node:assert/strict');

// Runs in the isolated smoke-test page: actual page callback and Web Audio,
// simulated transport/preparation, no model, microphone, writes or device calls.
async function checkSocketCloseAudio(page) {
  const result = await page.evaluate(async () => {
    const original = { WebSocket, ensureRuntimeConfigLoaded, pauseSessionPreparation,
      releaseSessionPreparation, prepareConnectionContext, ensurePlayback,
      recordExitPaneSnapshots, postFace };
    const sources = [], sockets = [];
    let release, pending;
    const tone = seconds => {
      const bytes = new Uint8Array(seconds * 16000 * 2), view = new DataView(bytes.buffer);
      for (let i = 0; i < bytes.length / 2; i++) view.setInt16(i * 2, Math.round(12000 * Math.sin(i * Math.PI * 2 * 440 / 16000)), true);
      return bytes;
    };
    try {
      window.WebSocket = class extends EventTarget {
        static OPEN = 1;
        static CONNECTING = 0;
        static CLOSED = 3;
        constructor() { super(); this.readyState = 0; sockets.push(this); }
        send() { throw new Error('No model packets expected in close-audio fixture'); }
        close() { this.readyState = 3; this.dispatchEvent(new Event('close')); }
      };
      ensureRuntimeConfigLoaded = async () => {};
      pauseSessionPreparation = async () => {};
      releaseSessionPreparation = () => {};
      prepareConnectionContext = async () => {};
      recordExitPaneSnapshots = async () => [];
      postFace = async () => ({});
      const connectFixture = async () => {
        await connect({ continuityAlreadyLoaded: true, openFace: false });
        // Do not emit open: that would start prompts/idle work. The real Connect
        // has registered its close callback and adopted this transport already.
        const socket = sockets.at(-1);
        if (!socket) throw new Error('Fixture connection was not created');
        socket.readyState = 1;
        return socket;
      };
      const first = await connectFixture();
      const createSource = audioContext.createBufferSource.bind(audioContext);
      audioContext.createBufferSource = () => {
        const source = createSource(), stop = source.stop.bind(source);
        source.stopCount = 0;
        source.stop = () => { source.stopCount++; stop(); };
        sources.push(source);
        return source;
      };
      const analyser = audioContext.createAnalyser();
      recordingDestination = analyser;
      await playPcm16Bytes(tone(5));
      await playPcm16Bytes(tone(5));
      const signal = () => {
        const values = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(values);
        return values.some(value => Math.abs(value) > 0.01);
      };
      for (let i = 0; i < 50 && !signal(); i++) await new Promise(resolve => setTimeout(resolve, 20));
      const signalBeforeClose = signal();
      speechMouthActive = true;
      first.close();
      const scheduled = { signalBeforeClose, active: outputAudioActive(),
        sourceStops: sources.map(source => source.stopCount), mouthActive: speechMouthActive };
      await new Promise(resolve => setTimeout(resolve, 200));
      scheduled.signalAfterClose = signal();

      const second = await connectFixture();
      const before = sources.length;
      ensurePlayback = () => new Promise(resolve => { release = resolve; });
      pending = playPcm16Bytes(tone(1));
      const activeWhilePending = outputAudioActive();
      second.close();
      const activeAfterClose = outputAudioActive();
      release();
      await pending;
      await handleRealtimeClose(second, realtimeConnection.generation);
      const pendingSetup = { activeWhilePending, activeAfterClose, newSources: sources.length - before };

      ensurePlayback = original.ensurePlayback;
      await connectFixture();
      await playPcm16Bytes(tone(2));
      first.close();
      second.close();
      const freshAudio = { activeAfterStaleCloses: outputAudioActive(), stops: sources.at(-1).stopCount,
        newSources: sources.length - before };
      return { scheduled, pendingSetup, freshAudio };
    } finally {
      release?.();
      if (pending) await pending;
      audioPlayback.stop();
      sockets.at(-1)?.close();
      if (sockets.length) await handleRealtimeClose(sockets.at(-1), realtimeConnection.generation);
      recordingDestination = null;
      if (audioContext) await audioContext.close();
      audioContext = null;
      window.WebSocket = original.WebSocket;
      ensureRuntimeConfigLoaded = original.ensureRuntimeConfigLoaded;
      pauseSessionPreparation = original.pauseSessionPreparation;
      releaseSessionPreparation = original.releaseSessionPreparation;
      prepareConnectionContext = original.prepareConnectionContext;
      ensurePlayback = original.ensurePlayback;
      recordExitPaneSnapshots = original.recordExitPaneSnapshots;
      postFace = original.postFace;
    }
  });
  assert.deepEqual(result.scheduled, { signalBeforeClose: true, active: false,
    sourceStops: [1, 1], mouthActive: false, signalAfterClose: false });
  assert.deepEqual(result.pendingSetup, { activeWhilePending: true, activeAfterClose: false, newSources: 0 });
  assert.deepEqual(result.freshAudio, { activeAfterStaleCloses: true, stops: 0, newSources: 1 });
  return result;
}

module.exports = { checkSocketCloseAudio };

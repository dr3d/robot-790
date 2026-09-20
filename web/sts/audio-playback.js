(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790AudioPlayback = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create({ getContext, ensurePlayback, getPlaybackDestination,
    getRecordingDestination, getSessionGeneration, isStopped, decodePcm16,
    onSettled, onError, setTimer = setTimeout, clearTimer = clearTimeout }) {
    const audioFlushMs = 120, minPlaybackBytes = 9600;
    let chunks = [], chunkBytes = 0, flushTimer = null;
    let playbackTime = 0, playbackGeneration = 0;
    const sources = new Set(), pending = new Set(), windows = new WeakMap();

    function isActive() {
      const context = getContext();
      // Only the audio clock can expire a source whose onended callback was missed.
      if (context) {
        for (const source of sources) {
          const window = windows.get(source);
          if (window && context.currentTime >= window.end) sources.delete(source);
        }
        if (!sources.size) playbackTime = context.currentTime;
      }
      return Boolean(chunkBytes > 0 || pending.size || sources.size);
    }

    function isPlaying() {
      const context = getContext();
      if (!context || context.state !== "running") return false;
      const now = context.currentTime;
      return [...sources].some(source => {
        const window = windows.get(source);
        return window && now >= window.start && now < window.end;
      });
    }

    function clearQueue() {
      if (flushTimer) clearTimer(flushTimer);
      flushTimer = null;
      chunks = [];
      chunkBytes = 0;
    }

    function stop() {
      playbackGeneration++;
      pending.clear();
      clearQueue();
      for (const source of sources) {
        try { source.stop(); } catch { /* Already stopped. */ }
      }
      sources.clear();
      const context = getContext();
      if (context) playbackTime = context.currentTime;
    }

    async function play(bytes) {
      const generation = getSessionGeneration(), playback = playbackGeneration;
      const token = {};
      pending.add(token);
      try {
        await ensurePlayback();
        if (isStopped() || generation !== getSessionGeneration() || playback !== playbackGeneration) return;
        const context = getContext();
        const samples = decodePcm16(bytes);
        const buffer = context.createBuffer(1, samples.length, 16000);
        buffer.copyToChannel(samples, 0);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(getPlaybackDestination() || context.destination);
        const recording = getRecordingDestination();
        if (recording) source.connect(recording);
        source.onended = () => {
          sources.delete(source);
          onSettled();
        };
        const start = Math.max(playbackTime, context.currentTime + 0.03);
        windows.set(source, { start, end: start + buffer.duration });
        source.start(start);
        sources.add(source);
        playbackTime = start + buffer.duration;
      } finally {
        pending.delete(token);
        onSettled();
      }
    }

    function joinChunks() {
      const bytes = new Uint8Array(chunkBytes);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      chunks = [];
      chunkBytes = 0;
      return bytes;
    }

    async function flush() {
      if (!chunkBytes) return;
      if (flushTimer) clearTimer(flushTimer);
      flushTimer = null;
      await play(joinChunks());
    }

    function enqueue(bytes) {
      chunks.push(bytes);
      chunkBytes += bytes.length;
      if (chunkBytes >= minPlaybackBytes) {
        flush().catch(onError);
        return;
      }
      if (!flushTimer) flushTimer = setTimer(() => { flush().catch(onError); }, audioFlushMs);
    }

    return { enqueue, flush, play, clearQueue, stop, isActive, isPlaying };
  }

  return { create };
});

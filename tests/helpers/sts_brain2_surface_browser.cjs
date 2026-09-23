const assert = require('node:assert/strict');

// The preceding monitor fixture isolates devices/transport; this adds the actual
// deferred owner and page adapters with captured timers instead of wall-clock waits.
async function checkBrain2Surface(page) {
  const result = await page.evaluate(async () => {
    const original = { setTimeout: window.setTimeout, clearTimeout: window.clearTimeout };
    const timers = [], voices = [], displayed = [], logs = [];
    let voiceReady = true, mouthReady = true;
    window.setTimeout = (callback, ms) => { timers.push({ callback, ms }); return -timers.length; };
    window.clearTimeout = id => { if (id >= 0) original.clearTimeout(id); };
    brain2MouthBrainEnabled = () => true;
    brain2VoiceCanSpeak = () => voiceReady;
    brain2MouthCanSurface = () => mouthReady;
    speakBrain2Monitor = text => { voices.push(text); return true; };
    logBrain2 = (kind, text) => logs.push({ kind, text });
    rememberBrain2Output = (kind, text) => displayed.push({ kind, text });
    setMouthText = async () => {};
    const socket = { readyState: 1, send() {} };
    realtimeConnection.adopt(socket);
    brain2Surface.reset();
    const fire = async timer => { timer.callback(); await Promise.resolve(); await Promise.resolve(); };
    const outcome = {};
    try {
      deferBrain2Surface('Old.', 'busy');
      const old = timers.at(-1);
      deferBrain2Surface('New.', 'busy');
      const fresh = timers.at(-1);
      await fire(old);
      outcome.staleTimer = { spoken: voices.length, pending: brain2Surface.pending.mouthText };
      await fire(fresh);
      outcome.normal = { voice: voices.slice(), mouth: displayed.slice(), retryMs: fresh.ms,
        drained: brain2Surface.pending === null };

      voiceReady = false;
      let finish;
      setMouthText = () => new Promise(resolve => { finish = resolve; });
      deferBrain2Surface('Old display.', 'busy');
      const work = maybeSurfaceDeferredBrain2();
      deferBrain2Surface('Replacement.', 'busy');
      const before = displayed.length;
      finish(); await work;
      outcome.staleDisplay = { added: displayed.length - before, pending: brain2Surface.pending.mouthText };

      const replacedTimer = timers.at(-1);
      quiesceRealtimeForSave('isolated deferred surface stop');
      outcome.stop = { empty: brain2Surface.pending === null, stopped: realtimeConnection.stopped };
      realtimeConnection.adopt(socket);
      setMouthText = async () => {};
      voiceReady = true;
      deferBrain2Surface('Reconnected.', 'busy');
      const reconnectTimer = timers.at(-1);
      await fire(replacedTimer);
      outcome.reconnect = { pending: brain2Surface.pending.mouthText, spoken: voices.length };
      await fire(reconnectTimer);

      mouthReady = false;
      deferBrain2Surface('Once while held.', 'busy');
      await fire(timers.at(-1));
      await fire(timers.at(-1));
      mouthReady = true;
      await fire(timers.at(-1));
      outcome.once = voices.filter(text => text === 'Once while held.').length;

      deferBrain2Surface('Text only.', 'busy');
      brain2VoiceMonitor.checked = false;
      brain2VoiceMonitor.dispatchEvent(new Event('change'));
      outcome.disabledVoiceMarked = brain2Surface.pending.voiceSpoken;
      const voiceCount = voices.length;
      await fire(timers.at(-1));
      outcome.textOnly = { addedVoices: voices.length - voiceCount, text: displayed.at(-1).text };
      outcome.errors = logs.filter(item => item.kind.endsWith('error'));
      return outcome;
    } finally {
      brain2Surface.reset();
      realtimeConnection.requestStop();
      window.setTimeout = original.setTimeout;
      window.clearTimeout = original.clearTimeout;
    }
  });
  assert.deepEqual(result, {
    staleTimer: { spoken: 0, pending: 'New.' },
    normal: { voice: ['New.'], mouth: [{ kind: 'mouth', text: 'New.' }], retryMs: 1200, drained: true },
    staleDisplay: { added: 0, pending: 'Replacement.' },
    stop: { empty: true, stopped: true },
    reconnect: { pending: 'Reconnected.', spoken: 1 },
    once: 1,
    disabledVoiceMarked: true,
    textOnly: { addedVoices: 0, text: 'Text only.' },
    errors: [],
  });
  return result;
}

module.exports = { checkBrain2Surface };

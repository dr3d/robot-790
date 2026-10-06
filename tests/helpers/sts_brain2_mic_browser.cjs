const assert = require('node:assert/strict');

// Exercise the served page's actual microphone, speech, and VAD adapters.
// Capture, synthesis, socket, playback, and device side effects are simulated.
async function checkBrain2Mic(page) {
  const result = await page.evaluate(async () => {
    const utterances = [], packets = [], changes = [], reports = [];
    let echo = true, processor, canceled = 0;
    const track = { readyState: 'live', stop() { this.readyState = 'ended'; },
      getSettings: () => ({ echoCancellation: echo }),
      getConstraints: () => ({ channelCount: 1, noiseSuppression: true }),
      applyConstraints: async value => { echo = value.echoCancellation.exact; changes.push(echo); } };
    const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
    const saved = { getUserMedia: navigator.mediaDevices.getUserMedia, AudioContext: window.AudioContext,
      speak: speechSynthesis.speak, cancel: speechSynthesis.cancel };
    const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
    try {
      navigator.mediaDevices.getUserMedia = async () => stream;
      window.AudioContext = class {
        sampleRate = 16000;
        createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
        createScriptProcessor() { return processor = { connect() {}, disconnect() {} }; }
        async close() {}
      };
      speechSynthesis.speak = utterance => utterances.push(utterance);
      speechSynthesis.cancel = () => { canceled++; };
      refreshMicDevices = async () => {};
      attachMicToRecording = () => {};
      detachMicFromRecording = () => {};
      autoAudioRecordEnabled = () => false;
      scheduleMicFreshnessCheck = () => {};
      log = () => {};
      logBrain2 = (kind, message) => reports.push({ kind, message });
      cueFaceMode = () => {};
      postFace = async () => ({});
      updateSessionTools = () => {};
      appendBrain2AdvisoryToConversation = () => {};
      captureCompletedAloneInterval = () => {};
      noteConversationActivity = () => {};
      audioPlayback.enqueue = () => {};
      brain2MouthBrainEnabled = () => true;
      realtimeConnection.adopt({ readyState: 1, send: text => packets.push(JSON.parse(text)) });
      brain2VoiceMonitor.checked = true;
      brain2MuteMic.checked = true;
      responseCompletion.active = false;
      clearUserTurnPending();
      await startMic();
      const frame = () => processor.onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array(2048).fill(0.05) } });
      const sent = () => packets.filter(packet => packet.type === 'input_audio_buffer.append').length;

      speakBrain2Monitor('Muted monitor.');
      utterances.at(-1).onstart();
      let before = sent(); frame();
      const checked = { frames: sent() - before, echo, constraintChanges: changes.length };
      cancelBrain2MonitorSpeech();

      brain2MuteMic.checked = false;
      brain2MuteMic.dispatchEvent(new Event('change'));
      speakBrain2Monitor('A full sentence for Eric to hear through the microphone.');
      const queuedBeforePreparation = utterances.length;
      before = sent(); frame();
      const duringPreparation = sent() - before;
      await flush();
      const audible = utterances.at(-1);
      audible.onstart();
      before = sent(); frame();
      const listening = { frames: sent() - before, echo, queuedBeforePreparation, utterances: utterances.length };
      const beforeVad = canceled;
      handleEvent({ type: 'input_audio_buffer.speech_started' });
      const vadCanceledB2 = canceled !== beforeVad;

      queueAudioDelta('AAAAAA==');
      before = sent(); frame();
      const duringRestore = sent() - before;
      await flush();
      const restored = { echo, held: brain2Mic.blocksInput(), canceled: canceled > beforeVad };
      return { checked, duringPreparation, listening, vadCanceledB2, duringRestore, restored, changes,
        micReports: reports.filter(item => item.kind === 'microphone') };
    } finally {
      cancelBrain2MonitorSpeech();
      await stopMic({ reason: 'isolated browser check' });
      navigator.mediaDevices.getUserMedia = saved.getUserMedia;
      window.AudioContext = saved.AudioContext;
      speechSynthesis.speak = saved.speak;
      speechSynthesis.cancel = saved.cancel;
      realtimeConnection.requestStop();
    }
  });
  assert.deepEqual(result.checked, { frames: 0, echo: true, constraintChanges: 0 });
  assert.equal(result.duringPreparation, 0);
  assert.deepEqual(result.listening, { frames: 1, echo: false, queuedBeforePreparation: 1, utterances: 2 });
  assert.equal(result.vadCanceledB2, false);
  assert.equal(result.duringRestore, 0);
  assert.deepEqual(result.restored, { echo: true, held: false, canceled: true });
  assert.deepEqual(result.changes, [false, true]);
  return result;
}
module.exports = { checkBrain2Mic };

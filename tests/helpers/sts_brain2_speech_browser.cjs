const assert = require('node:assert/strict');

// Real page/event adapters and native utterances, but no browser voice output,
// microphone, transport, device calls, model inference or durable writes.
async function checkBrain2Speech(page) {
  const result = await page.evaluate(async () => {
    const utterances = [], logs = [], packets = [];
    let cancels = 0;
    const synthesis = window.speechSynthesis;
    const original = { speak: synthesis.speak, cancel: synthesis.cancel };
    synthesis.speak = utterance => utterances.push(utterance);
    synthesis.cancel = () => { cancels++; };
    logBrain2 = (kind, text) => logs.push({ kind, text });
    postFace = async () => ({});
    setMouthText = async () => ({});
    updateSessionTools = () => {};
    appendBrain2AdvisoryToConversation = () => {};
    captureCompletedAloneInterval = () => {};
    noteConversationActivity = () => {};
    brain2MouthBrainEnabled = () => true;
    const socket = { readyState: 1, send: text => packets.push(JSON.parse(text)) };
    realtimeConnection.adopt(socket);
    brain2VoiceMonitor.checked = true;
    clearUserTurnPending();
    responseActive = false;
    const dispatch = type => handleEvent({ type });
    const outcome = {};
    try {
      speakBrain2Monitor('Queued before the human returns.');
      const queued = utterances.at(-1), before = cancels;
      dispatch('input_audio_buffer.speech_started');
      queued.onstart();
      outcome.humanStart = { canceled: cancels === before + 1,
        muted: brain2MonitorAudioShouldMuteMic(), loggedStart: logs.some(item => item.kind === 'voice started') };
      dispatch('input_audio_buffer.speech_stopped');
      outcome.pendingTurn = { pending: userTurnPending(), accepted: speakBrain2Monitor('Too soon.') };
      clearUserTurnPending();
      speakBrain2Monitor('New voice.');
      const newer = utterances.at(-1);
      newer.onstart();
      const beforeStale = cancels;
      queued.onstart(); queued.onend(); queued.onerror();
      outcome.staleCallbacks = { cancels: cancels - beforeStale, muted: brain2MonitorAudioShouldMuteMic() };

      responseCreateLedgerCredits = 1;
      handleEvent({ type: 'response.created', response: { id: 'isolated-b1' } });
      const activeDuringInference = brain2MonitorAudioShouldMuteMic();
      handleEvent({ type: 'response.output_audio.delta', delta: 'AAA=' });
      outcome.b1Audio = { activeDuringInference, monitorMuted: brain2MonitorAudioShouldMuteMic(),
        audioBusy: outputAudioActive() };
      stopPlaybackNow();
      responseActive = false;

      let finishDisplay;
      setMouthText = () => new Promise(resolve => { finishDisplay = resolve; });
      const beforeDisplay = utterances.length;
      const pending = surfaceBrain2MouthText('Display can finish without stale speech.');
      dispatch('input_audio_buffer.speech_started');
      clearUserTurnPending();
      finishDisplay(); await pending;
      outcome.delayedDisplay = { queued: utterances.length - beforeDisplay,
        displayed: logs.some(item => item.kind === 'mouth' && item.text.startsWith('Display can')) };

      speakBrain2Monitor('Disable me.');
      const disabled = utterances.at(-1);
      disabled.onstart();
      brain2VoiceMonitor.checked = false;
      brain2VoiceMonitor.dispatchEvent(new Event('change'));
      disabled.onend();
      outcome.disabled = { muted: brain2MonitorAudioShouldMuteMic(), accepted: speakBrain2Monitor('No.') };

      brain2VoiceMonitor.checked = true;
      speakBrain2Monitor('Disconnect me.');
      const disconnected = utterances.at(-1);
      disconnected.onstart();
      quiesceRealtimeForSave('isolated B2 speech check');
      disconnected.onstart(); disconnected.onend(); disconnected.onerror();
      outcome.disconnect = { stopped: realtimeConnection.stopped, muted: brain2MonitorAudioShouldMuteMic(),
        sentCancel: packets.some(event => event.type === 'response.cancel') };

      realtimeConnection.adopt(socket);
      brain2VoiceMonitor.checked = true;
      clearUserTurnPending();
      speakBrain2Monitor('Fresh session.');
      utterances.at(-1).onstart();
      const beforeOldSession = cancels;
      disconnected.onstart(); disconnected.onend(); disconnected.onerror();
      outcome.reconnect = { cancels: cancels - beforeOldSession, muted: brain2MonitorAudioShouldMuteMic() };
      outcome.nativeUtterances = utterances.every(item => item instanceof SpeechSynthesisUtterance);
      outcome.noModelRequests = packets.every(event => event.type === 'response.cancel');
      return outcome;
    } finally {
      realtimeConnection.requestStop();
      haltRealtimeActivity('isolated test cleanup');
      synthesis.speak = original.speak;
      synthesis.cancel = original.cancel;
    }
  });
  assert.deepEqual(result, {
    humanStart: { canceled: true, muted: false, loggedStart: false },
    pendingTurn: { pending: true, accepted: false },
    staleCallbacks: { cancels: 0, muted: true },
    b1Audio: { activeDuringInference: true, monitorMuted: false, audioBusy: true },
    delayedDisplay: { queued: 0, displayed: true },
    disabled: { muted: false, accepted: false },
    disconnect: { stopped: true, muted: false, sentCancel: true },
    reconnect: { cancels: 0, muted: true },
    nativeUtterances: true, noModelRequests: true,
  });
  return result;
}

module.exports = { checkBrain2Speech };

const assert = require('node:assert/strict');

async function checkResponseCompletion(page) {
  await page.evaluate(async () => {
    const calls = [];
    window.completionCheck = { calls };
    noteConversationActivity = () => calls.push('finished');
    scheduleFaceIdle = () => {};
    clearLabGoalAfterOneShotResponse = () => {};
    updateSessionTools = () => {};
    clearBrain2Timer();
    realtimeConnection.adopt({ readyState: WebSocket.OPEN, send() {} });
    responseCompletion.active = true;
    await ensurePlayback();
    await audioContext.resume();
    await audioPlayback.play(new Uint8Array(16000 * 2 * 0.4));
    await audioPlayback.play(new Uint8Array(16000 * 2 * 0.4));
    handleEvent({ type: 'response.done', response: { status: 'completed' } });
    completionCheck.beforeDrain = { pending: responseCompletion.pending,
      modelActive: responseCompletion.active, audioActive: outputAudioActive(), finished: calls.length };
  });
  await page.waitForFunction(() => completionCheck.calls.length === 1);
  const drained = await page.evaluate(() => ({ pending: responseCompletion.pending,
    audioActive: outputAudioActive(), finished: completionCheck.calls.length }));
  assert.deepEqual(drained, { pending: false, audioActive: false, finished: 1 });
  const result = await page.evaluate(async () => {
    const { calls } = completionCheck;
    const old = { socket: realtimeConnection.socket, generation: realtimeConnection.generation };
    responseCompletion.active = true;
    await audioPlayback.play(new Uint8Array(16000 * 2 * 3));
    handleEvent({ type: 'response.done', response: { status: 'completed' } });
    realtimeConnection.requestStop();
    haltRealtimeActivity('isolated completion cutoff');
    checkAssistantUtteranceFinished();
    const stopped = { pending: responseCompletion.pending, active: responseCompletion.active,
      timer: responseCompletion.timer, audioActive: outputAudioActive(), finished: calls.length };
    realtimeConnection.adopt({ readyState: WebSocket.OPEN, send() {} });
    responseCompletion.active = true;
    handleEvent({ type: 'response.done', response: { status: 'completed' } }, old);
    const staleIgnored = responseCompletion.active && !responseCompletion.pending && calls.length === 1;
    handleEvent({ type: 'response.done', response: { status: 'completed' } });
    checkAssistantUtteranceFinished();
    const freshFinished = calls.length === 2 && !responseCompletion.pending;
    realtimeConnection.requestStop(); haltRealtimeActivity('isolated completion finished');
    return { beforeDrain: completionCheck.beforeDrain, stopped, staleIgnored, freshFinished,
      legacyActive: typeof responseActive, legacyPending: typeof assistantFinishPending };
  });
  assert.deepEqual(result, {
    beforeDrain: { pending: true, modelActive: false, audioActive: true, finished: 0 },
    stopped: { pending: false, active: false, timer: null, audioActive: false, finished: 1 },
    staleIgnored: true, freshFinished: true, legacyActive: 'undefined', legacyPending: 'undefined',
  });
  return { ...result, drained };
}

module.exports = { checkResponseCompletion };

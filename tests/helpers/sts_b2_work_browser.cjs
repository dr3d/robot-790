const assert = require('node:assert/strict');

async function checkBrain2Work(page) {
  const result = await page.evaluate(async () => {
    const originalFetch = window.fetch, originalSchedule = scheduleBrain2Mull;
    const pending = [];
    try {
      scheduleBrain2Mull = () => {};
      clearBrain2Timer();
      brain2PersonFocus.value = '4';
      conversationLines = ['[10:00 AM] You: Offline ownership test.'];
      conversationLineMetadata = [];
      brain2NoteCandidates = []; brain2QuestionCandidates = []; brain2RevisionCandidates = [];
      userSpeechActive = false; pendingSessionMapMove = null; sessionMapMoveBusy = false;
      toolContinuation.reset(); brain2Work.reset();
      window.fetch = (target, options) => {
        if (new URL(target, location.href).pathname !== '/api/brain2/mull') throw new Error('Unexpected fixture request');
        return new Promise(resolve => pending.push({ resolve, body: JSON.parse(options.body) }));
      };
      realtimeConnection.adopt({ readyState: WebSocket.OPEN, send() {} });
      const old = triggerBrain2Mull({ manual: true });
      const initiallyBusy = brain2Work.busy && brain2MullNowButton.disabled;
      await triggerBrain2Mull({ manual: true });
      const duplicateBlocked = pending.length === 1;
      realtimeConnection.requestStop();
      haltRealtimeActivity('isolated B2 replacement');
      realtimeConnection.adopt({ readyState: WebSocket.OPEN, send() {} });
      const current = triggerBrain2Mull({ manual: true });
      pending[0].resolve(new Response(JSON.stringify({ status: 'error', error: 'Old request' }), { status: 503 }));
      await old;
      const oldCannotRelease = brain2Work.busy && brain2MullNowButton.disabled && brain2NoteCandidates.length === 0;
      pending[1].resolve(new Response(JSON.stringify({ status: 'ok', note_for_eric: 'Current private advice' })));
      await current;
      const freshCompleted = !brain2Work.busy && !brain2MullNowButton.disabled
        && brain2NoteCandidates.length === 1 && brain2NoteCandidates[0].text === 'Current private advice';
      const token = brain2Work.begin({ socket: realtimeConnection.socket,
        generation: realtimeConnection.generation, headlines: true });
      haltRealtimeActivity('isolated headline stop');
      return { initiallyBusy, duplicateBlocked, requests: pending.length, oldCannotRelease, freshCompleted,
        stopped: !brain2Work.busy && !brain2Work.headlines,
        lateStopIgnored: !brain2Work.finish(token, realtimeConnection),
        legacyBusy: typeof brain2InFlight, legacyHeadlines: typeof brain2HeadlinesInFlight };
    } finally {
      realtimeConnection.requestStop(); brain2Work.reset(); clearBrain2Timer();
      window.fetch = originalFetch; scheduleBrain2Mull = originalSchedule;
    }
  });
  assert.deepEqual(result, { initiallyBusy: true, duplicateBlocked: true, requests: 2,
    oldCannotRelease: true, freshCompleted: true, stopped: true, lateStopIgnored: true,
    legacyBusy: 'undefined', legacyHeadlines: 'undefined' });
  return result;
}

module.exports = { checkBrain2Work };

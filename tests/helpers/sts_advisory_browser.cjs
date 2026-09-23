const assert = require('node:assert/strict');

async function checkBrain2Advisories(page) {
  const result = await page.evaluate(() => {
    const originalSend = send, packets = [];
    try {
      clearBrain2Timer(); clearTimeout(idleTimer); idleTimer = null; brain2Advisories.reset();
      send = packet => packets.push(packet);
      realtimeConnection.adopt({ readyState: WebSocket.OPEN, send() {} });
      loadedNoteContexts = []; lastUserTurnActivityAt = 0; userSpeechActive = true;
      const before = conversationLines.length;
      const evidence = brain2EvidenceSnapshot();
      brain2Advisories.accept({note_for_eric:'Private browser fixture note', question:'A private question?',
        revision_candidate:'A private correction', observed_evidence:evidence});
      const privatePackets = () => packets.filter(p => p.item?.content?.[0]?.text?.startsWith('[B2 advisory]'));
      const deliveredDuringSpeech = privatePackets().length === 1;
      const duplicateHeld = appendBrain2AdvisoryToConversation() === false;
      const notes = brain2Advisories.notes.length, questions = brain2Advisories.questions.length;
      const revisions = brain2Advisories.revisions.length;
      const privateOnly = conversationLines.length === before && privatePackets()[0].item.role === 'assistant';
      lastUserTurnActivityAt = Date.now() + 1;
      const staleNoteGone = !formatBrain2AdvisoryContent().includes('Private browser fixture note')
        && formatBrain2AdvisoryContent().includes('A private question?');
      userSpeechActive = false;
      clearHotConversationState({reason:'isolated advisory reset'});
      const reset = !brain2Advisories.notes.length && !brain2Advisories.questions.length
        && !brain2Advisories.revisions.length && formatBrain2AdvisoryContent() === '';
      lastUserTurnActivityAt = 0;
      brain2Advisories.accept({note_for_eric:'New connection note'});
      const afterReset = appendBrain2AdvisoryToConversation();
      return {deliveredDuringSpeech, duplicateHeld, notes, questions, revisions, privateOnly,
        staleNoteGone, reset, afterReset, legacyNotes:typeof brain2NoteCandidates};
    } finally {
      realtimeConnection.requestStop(); brain2Advisories.reset();
      clearBrain2Timer(); clearTimeout(idleTimer); idleTimer = null; send = originalSend;
    }
  });
  assert.deepEqual(result, {deliveredDuringSpeech:true, duplicateHeld:true, notes:1, questions:1,
    revisions:1, privateOnly:true, staleNoteGone:true, reset:true, afterReset:true, legacyNotes:'undefined'});
  return result;
}
module.exports = { checkBrain2Advisories };

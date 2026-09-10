const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const page = fs.readFileSync(path.join(__dirname, '../web/sts/index.html'), 'utf8').replace(/\r\n/g, '\n');

function load(names, globals = {}) {
  const context = vm.createContext(globals);
  for (const name of names) {
    const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    assert.notEqual(start, -1, name);
    const end = page.indexOf('\n    }\n', start);
    assert.notEqual(end, -1, name);
    vm.runInContext(page.slice(start, end + 6), context, { filename: name });
  }
  return context;
}

function evidenceContext(extraNames = [], extra = {}) {
  return load(['brain2EvidenceSnapshot', ...extraNames], {
    Date, realtimeSessionGeneration: 1, brain2EvidenceGeneration: 0, brain2LastEvidence: null,
    conversationLines: ['[10:25:30 PM] You: An outburst.', '[10:25:36 PM] Robot 790: Here.'],
    conversationLineMetadata: [{ iso: '2026-09-09T22:25:30-04:00' }, { iso: '2026-09-09T22:25:36-04:00' }],
    conversationProsodyByIndex: { 0: 'loud -> medium; mid pitch' },
    micRuntimeLabel: () => 'on', audioRecordingActive: () => true,
    visionImageUrl: '', visionImageName: '', sensingTextContent: '', sensingTextName: '',
    visionCameraActive: () => false, idleHardBrakeActive: () => false, idleHardBrakeReason: '',
    searchContextReceipts: [], ...extra,
  });
}

test('Brain2 evidence identifies chunks and remains unchanged when only time or Brain2 thoughts pass', () => {
  const context = evidenceContext();
  const first = context.brain2EvidenceSnapshot();
  assert.equal(first.new_assistant_chunks, 1);
  assert.equal(first.last_assistant_output_id, '1:0:1');
  assert.equal(first.latest_user_utterance.prosody, 'loud -> medium; mid pitch');
  assert.equal(first.latest_user_utterance.at, '2026-09-09T22:25:30-04:00');
  context.brain2LastEvidence = first;
  context.recentBrain2Outputs = [{ text: 'The fan changed pitch.' }];
  const next = context.brain2EvidenceSnapshot();
  assert.equal(next.new_assistant_chunks, 0);
  assert.equal(next.new_user_input, false);
  assert.equal(first.fingerprint, next.fingerprint);
  assert.equal(next.runtime.microphone, 'on');
  assert.equal(next.runtime.audio_recording, true);
  assert.doesNotMatch(JSON.stringify(next), /fan changed/);
  context.idleHardBrakeActive = () => true;
  context.idleHardBrakeReason = 'loop guard';
  assert.notEqual(context.brain2EvidenceSnapshot().fingerprint, next.fingerprint);
});

test('new speech replaces old prosody; transcript amendment is fresh even without a new line', () => {
  const context = evidenceContext();
  context.brain2LastEvidence = context.brain2EvidenceSnapshot();
  context.conversationLines.push('[10:41:21 PM] You: Ha ha ha.');
  const next = context.brain2EvidenceSnapshot();
  assert.equal(next.new_user_input, true);
  assert.equal(next.latest_user_utterance.prosody, '');
  context.conversationProsodyByIndex[2] = 'quiet -> loud; punchy';
  context.brain2LastEvidence = context.brain2EvidenceSnapshot();
  context.conversationLines[2] = '[10:41:22 PM] You: Ha ha ha, keep going.';
  const amended = context.brain2EvidenceSnapshot();
  assert.equal(amended.new_user_input, true);
  assert.equal(amended.new_assistant_chunks, 0);
  assert.equal(amended.latest_user_utterance.prosody, 'quiet -> loud; punchy');
});

test('automatic mulls wait for changed evidence; manual reflection stays available', () => {
  const context = evidenceContext(['brain2BlockedReason'], {
    brain2InFlight: false, realtimeConnected: () => true, brain2MouthBrainEnabled: () => true,
    currentBrain2PersonFocus: () => 4, userSpeechActive: false, brain2BackoffUntil: 0,
    lastBrain2MullAt: 0, brain2MinGapMs: 14000, brain2FastClockFloorMs: 14000,
    brain2HeadlinesDue: () => false,
    compressIdleMs: value => value,
  });
  assert.equal(context.brain2BlockedReason(), '');
  context.brain2LastEvidence = context.brain2EvidenceSnapshot();
  assert.equal(context.brain2BlockedReason(), 'no new evidence');
  assert.equal(context.brain2BlockedReason({ manual: true }), '');
  context.conversationLines.push('[10:42:00 PM] Robot 790: A different idea.');
  assert.equal(context.brain2BlockedReason(), '');
});

for (const change of ['user', 'reset', 'failure', 'assistant']) {
  test(`Brain2 HTTP result handles ${change} during its request without consuming unseen evidence`, async () => {
    let finish;
    let posted;
    const context = evidenceContext(['requestBrain2Mull'], {
      ws: {}, URL, location: { href: 'http://127.0.0.1:8790/' }, userSpeechActive: false,
      currentBrain2PersonFocus: () => 4, brain2ConversationContext: () => 'A recent conversation.',
      brain2RecentIdleContext: () => '', brain2RecentOutputContext: () => '',
      rememberBrain2Prompt: () => {},
      fetch: (_, options) => {
        posted = JSON.parse(options.body);
        return new Promise(resolve => { finish = resolve; });
      },
    });
    const pending = context.requestBrain2Mull();
    assert.equal(posted.evidence.new_assistant_chunks, 1);
    assert.equal(posted.voice_shape, 'loud -> medium; mid pitch');
    assert.equal(posted.evidence.fingerprint, undefined);
    if (change === 'user') context.conversationLines.push('[10:26:00 PM] You: Different question.');
    if (change === 'reset') context.brain2EvidenceGeneration += 1;
    if (change === 'assistant') context.conversationLines.push('[10:26:00 PM] Robot 790: New output.');
    finish({ ok: change !== 'failure', json: async () => ({ status: change === 'failure' ? 'error' : 'ok', error: 'test failure' }) });
    if (change === 'failure') {
      await assert.rejects(pending, /test failure/);
      assert.equal(context.brain2LastEvidence, null);
    } else {
      const result = await pending;
      if (change === 'assistant') {
        assert.equal(result.status, 'ok');
        assert.equal(context.brain2EvidenceSnapshot().new_assistant_chunks, 1);
      } else {
        assert.equal(result.status, 'stale');
        assert.equal(context.brain2LastEvidence, null);
      }
    }
  });
}

test('a loop guard cannot count the same Eric output repeatedly or carry pressure past new user input', async () => {
  let outputId = '1:0:1';
  let now = 100;
  const context = load(['brain2LoopGuardText', 'recentBrain2LoopGuardCount', 'triggerBrain2Mull'], {
    Date: { now: () => now }, realtimeSessionGeneration: 1, ws: {}, brain2InFlight: false,
    brain2EvidenceGeneration: 0, brain2HeadlinesDue: () => false,
    brain2NoteCandidates: [], brain2QuestionCandidates: [], brain2RevisionCandidates: [],
    lastUserTurnActivityAt: 0, userSpeechActive: false, brain2BlockedReason: () => '',
    updateBrain2Controls: () => {}, updateLanePressure: () => {}, bumpBrain2Counter: () => {},
    logBrain2: () => {}, rememberBrain2Output: () => {}, maybeArmIdleHardBrakeFromBrain2Note: () => {},
    requestBrain2Mull: async () => ({
      status: 'ok', note_for_eric: 'LOOP GUARD: Another count.', should_surface: false,
      observed_evidence: { last_assistant_output_id: outputId },
    }),
  });
  await context.triggerBrain2Mull();
  await context.triggerBrain2Mull();
  assert.equal(context.brain2NoteCandidates.length, 1);
  assert.equal(context.recentBrain2LoopGuardCount(), 1);
  outputId = '1:0:2';
  now = 200;
  await context.triggerBrain2Mull();
  assert.equal(context.recentBrain2LoopGuardCount(), 2);
  context.lastUserTurnActivityAt = 201;
  assert.equal(context.recentBrain2LoopGuardCount(), 0);
});

test('acknowledgments fade without weakening actual requests or suppressing their normal conversation', () => {
  let now = 100000;
  const context = load(['idleCueIsAcknowledgment', 'formatLastUserIdleCueForInstructions'], {
    Date: { now: () => now }, lastUserText: 'Mm-hmm.', lastAcceptedUserTranscriptAt: 99000,
    lastUserTurnActivityAt: 99000, lastUserIdleEchoMs: 900000, aloneActivityLog: [],
    shortDuration: () => '1s',
  });
  assert.match(context.formatLastUserIdleCueForInstructions(), /not an assignment/);
  context.aloneActivityLog.push({ type: 'idle_beat', at: 99500 });
  assert.equal(context.formatLastUserIdleCueForInstructions(), '');
  context.aloneActivityLog = [];
  now += 31000;
  assert.equal(context.formatLastUserIdleCueForInstructions(), '');
  for (const request of ['Keep going.', 'Yes, research the displays.', 'Stop talking.', 'Look up the weather.']) {
    context.lastUserText = request;
    assert.equal(context.idleCueIsAcknowledgment(request), false);
    assert.match(context.formatLastUserIdleCueForInstructions(), /strongest soft cue/);
  }
});

test('re-engagement observes real human time even at 11x lab speed, including direct trigger checks', () => {
  const timers = [];
  let now = 105000;
  const context = load(['conversationReengageWindowActive', 'conversationReengageBlockedReason', 'scheduleConversationReengage'], {
    Date: { now: () => now }, realtimeConnected: () => true, micStream: {}, micMutedForNarration: false,
    lastAcceptedUserTranscriptAt: 99000, lastAssistantResponseDoneAt: 100000,
    reengageGoneAfterMs: 75000, lastReengageAt: 0, reengageAttempts: 0, userTurnPendingUntil: 0,
    responseActive: false, outputAudioActive: () => false, idleInFlight: false, reengageInFlight: false,
    toolFollowupNeeded: false, pendingToolCalls: 0, userSpeechActive: false, userTurnPending: () => false,
    conversationReengagePolicy: () => ({ enabled: true, maxAttempts: 1, firstDelayMs: 26000, repeatDelayMs: 40000 }),
    compressIdleMs: ms => ms / 11, clearConversationReengageTimer: () => {},
    setTimeout: (_, delay) => { timers.push(delay); return timers.length; },
  });
  assert.equal(context.conversationReengageWindowActive(), true);
  assert.equal(context.conversationReengageBlockedReason(), 'conversation breathing room');
  context.scheduleConversationReengage();
  assert.equal(timers[0], 21000);
  now = 126000;
  assert.equal(context.conversationReengageBlockedReason(), '');
  now = 174000;
  assert.equal(context.conversationReengageWindowActive(), false);
  assert.equal(context.conversationReengageBlockedReason(), 'user away');
});

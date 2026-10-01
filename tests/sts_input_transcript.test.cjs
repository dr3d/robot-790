const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { create } = require('../web/sts/realtime-connection.js');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

function source(name) {
  const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
  const end = page.indexOf('\n    }\n', start);
  assert.ok(start >= 0 && end > start, name);
  return page.slice(start, end + 6);
}

function fixture() {
  let now = Date.parse('2026-09-27T19:00:00.000Z');
  const calls = [], logs = [];
  const realtimeConnection = create();
  realtimeConnection.adopt({ readyState: 1 });
  const c = vm.createContext({
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [now])); }
      static now() { return now; }
    },
    conversationLines: [], conversationLineMetadata: [], conversationProsodyByIndex: {},
    inputDraft: '', lastUserText: '', recentUserTexts: [],
    lastAcceptedUserTranscript: '', lastAcceptedUserTranscriptAt: 0, lastUserConversationIndex: -1,
    toolScopeDenials: new Map(), toolContinuation: {
      startTurn() { calls.push('turn'); }, allowTools() { calls.push('allow'); },
    },
    resetConversationReengageCycle() {}, captureCompletedAloneInterval() {},
    renderConversation() {}, noteConversationActivity() { calls.push('activity'); },
    events: {}, log: (_, text) => logs.push(text), realtimeConnection,
    llmRunOverview: null, observeContextUsage() {}, performance: { now: () => now },
    noteUserTurnActivity() { calls.push('user activity'); }, idlePendingUserTurnMs: 2000,
    cueFaceMode() { calls.push('face'); }, responseOutputSuppressed: () => false,
    containsToolMarkup: () => false, noteAudioCaption() {}, noteAssistantText() {},
    idleInFlight: false, gpuWatchInFlight: false, standingRoutineInFlight: false,
    transcriptControlDetails: { checked: false }, formatProsodyForTranscript: shape => shape || '',
  });
  for (const name of [
    'conversationLineMetadataFromDate', 'conversationLine', 'addConversation', 'replaceConversation',
    'noteUserText', 'normalizeTranscriptForDedupe', 'transcriptSimilarity', 'classifyTranscriptUpdate',
    'recordUserTranscript', 'clearInputDraft', 'rememberConversationProsody',
    'activeRealtimeSession', 'eventResponseId', 'handleEvent', 'conversationDisplayTextRange', 'conversationDisplayText',
    'conversationVisibleText', 'recordingSnapshotPaneText', 'conversationTranscriptSinceCleanConnect',
  ]) vm.runInContext(source(name), c);
  const event = (item, text, extra = {}, owner) => c.handleEvent({
    type: 'conversation.item.input_audio_transcription.completed',
    item_id: item, content_index: 0, transcript: text, ...extra,
  }, owner);
  const speech = text => c.handleEvent({ type: 'response.output_audio_transcript.done', transcript: text });
  return { c, calls, logs, event, speech, advance: ms => { now += ms; } };
}

test('assistant transcript metadata retains response identity without changing visible words', () => {
  const { c } = fixture();
  for (const response_id of ['first', 'first', 'second']) c.handleEvent({
    type: 'response.output_audio_transcript.done', response_id, transcript: 'A complete sentence.'
  });
  c.handleEvent({ type: 'response.output_text.delta', response_id: 'text-response', delta: 'Text only.' });
  assert.deepEqual(Array.from(c.conversationLineMetadata, row => row.responseId),
    ['first', 'first', 'second', 'text-response']);
  assert.ok(c.conversationLines.slice(0, 3).every(line => line.endsWith('Robot 790: A complete sentence.')));
});

test('same item rewrites one row despite long gaps, changed wording, and intervening Eric speech', () => {
  const f = fixture(), { c } = f;
  f.event('utterance-1', 'A father won a computer.');
  const iso = c.conversationLineMetadata[0].iso;
  f.advance(1000);
  f.speech('Go on.');
  c.addConversation('System: [eye opened]', { channel: 'control' });
  f.advance(90000);
  f.event('utterance-1', 'A viewer requested a one-handed keyboard.', { voice_shape: 'v: revised' });
  assert.equal(c.conversationLines.length, 3);
  assert.match(c.conversationLines[0], /You: A viewer requested a one-handed keyboard\.$/);
  assert.match(c.conversationLines[1], /Robot 790: Go on\.$/);
  assert.match(c.conversationLines[2], /System: \[eye opened\]$/);
  assert.equal(c.conversationLineMetadata[0].iso, iso, 'revision keeps the original chronological position');
  assert.equal(c.conversationLineMetadata[0].channel, 'dialogue');
  assert.equal(c.conversationLineMetadata[2].channel, 'control');
  assert.equal(c.conversationProsodyByIndex[0], 'v: revised');
  assert.deepEqual(Array.from(c.recentUserTexts), ['A viewer requested a one-handed keyboard.']);
});

test('same-item corrections can shrink, change case/punctuation, or use non-English text', () => {
  const { c, event } = fixture();
  for (const text of ['First a very long and wrong transcription.', 'No.', 'NO!', '\u4e0d\u662f\u90a3\u4e2a\u610f\u601d', '\u65e5\u672c\u8a9e']) {
    event('one', text);
    assert.equal(c.conversationLines.length, 1);
    assert.equal(c.lastUserText, text);
    assert.deepEqual(Array.from(c.recentUserTexts), [text]);
  }
});

test('different protocol items preserve genuine repeated utterances even within the same second', () => {
  const { c, event } = fixture();
  event('first', 'Try that again.');
  event('second', 'Try that again.');
  assert.equal(c.conversationLines.length, 2);
  assert.deepEqual(Array.from(c.recentUserTexts), ['Try that again.', 'Try that again.']);
  assert.equal(c.conversationLineMetadata[0].inputItemId, 'first');
  assert.equal(c.conversationLineMetadata[1].inputItemId, 'second');
  assert.equal((c.conversationDisplayText().match(/Try that again\./g) || []).length, 2);
});

test('content parts have independent identity and correcting an older part does not overwrite another row', () => {
  const { c, event } = fixture();
  event('one', 'First part.', { content_index: 0 });
  event('one', 'Second part.', { content_index: 1 });
  event('one', 'First part corrected.', { content_index: 0 });
  assert.equal(c.conversationLines.length, 2);
  assert.match(c.conversationLines[0], /First part corrected\.$/);
  assert.match(c.conversationLines[1], /Second part\.$/);
});

test('exact duplicate delivery is idempotent; empty events do not add rows', () => {
  const { c, calls, event } = fixture();
  event('one', 'Keep the final words.');
  const turns = calls.filter(call => call === 'turn').length;
  event('one', 'Keep the final words.');
  event('two', '   ');
  assert.equal(c.conversationLines.length, 1);
  assert.equal(calls.filter(call => call === 'turn').length, turns);
  assert.deepEqual(Array.from(c.recentUserTexts), ['Keep the final words.']);
});

test('existing id-less provider fallback still coalesces matching extensions', () => {
  const { c, event } = fixture();
  event(undefined, 'Please build a small keyboard');
  event(undefined, 'Please build a small keyboard for one hand.');
  assert.equal(c.conversationLines.length, 1);
  assert.deepEqual(Array.from(c.recentUserTexts), ['Please build a small keyboard for one hand.']);
  assert.equal(c.conversationLineMetadata[0].inputItemId, undefined);
});

test('protocol IDs override the id-less fallback instead of absorbing a typed or legacy input', () => {
  const { c, event } = fixture();
  event(undefined, 'Please draw a keyboard.');
  event('new', 'Please draw a keyboard.');
  assert.equal(c.conversationLines.length, 2);
  assert.equal(c.conversationLineMetadata[0].inputItemId, undefined);
  assert.equal(c.conversationLineMetadata[1].inputItemId, 'new');
});

test('Disconnect still accepts the current final revision without reviving response activity', () => {
  const { c, calls, event } = fixture();
  event('one', 'Save this unfinished');
  c.realtimeConnection.requestStop();
  const before = calls.filter(call => call === 'face' || call === 'user activity').length;
  event('one', 'Save this completed thought.', { voice_shape: 'v: final' });
  assert.equal(c.conversationLines.length, 1);
  assert.match(c.conversationTranscriptSinceCleanConnect(), /Save this completed thought\./);
  assert.doesNotMatch(c.conversationTranscriptSinceCleanConnect(), /unfinished/);
  assert.equal(c.conversationProsodyByIndex[0], 'v: final');
  assert.equal(calls.filter(call => call === 'face' || call === 'user activity').length, before);
});

test('stale sockets and generations cannot revise a newer session with a reused item ID', () => {
  const { c, event } = fixture();
  const old = { socket: c.realtimeConnection.socket, generation: c.realtimeConnection.generation };
  event('one', 'Old session.');
  // These are the existing conversation-clear operations; identity has no separate cache.
  c.conversationLines = []; c.conversationLineMetadata = []; c.conversationProsodyByIndex = {};
  assert.match(source('clearHotConversationState'), /conversationLineMetadata = \[\];/);
  c.realtimeConnection.adopt({ readyState: 1 });
  event('one', 'New session.');
  event('one', 'Late old transcript.', {}, old);
  c.realtimeConnection.requestStop();
  event('one', 'Late old stopped transcript.', {}, old);
  assert.equal(c.conversationLines.length, 1);
  assert.match(c.conversationLines[0], /You: New session\.$/);
});

test('all transcript consumers receive only the latest revision, without losing intervening receipts', () => {
  const { c, event } = fixture();
  event('one', 'Wrong beginning.');
  c.addConversation('System: [eye opened]', { channel: 'control' });
  event('one', 'Correct final narration.');
  for (const text of [c.conversationDisplayText(), c.recordingSnapshotPaneText('conversation'),
    c.conversationTranscriptSinceCleanConnect()]) {
    assert.doesNotMatch(text, /Wrong beginning/);
    assert.equal((text.match(/You:/g) || []).length, 1);
    assert.match(text, /System: \[eye opened\]/);
  }
  assert.match(c.conversationVisibleText(), /Correct final narration\./);
  assert.doesNotMatch(c.conversationVisibleText(), /System:/);
  assert.match(source('formatSessionNote'), /conversationDisplayText\(\)\.trimEnd\(\)/);
  assert.match(source('companionAuditText'), /conversationLines\.map/);
});

test('long narration with early-word corrections retains one row per turn instead of every prefix', () => {
  const { c, event, advance } = fixture();
  for (let turn = 0; turn < 3; turn++) {
    for (let revision = 0; revision < 26; revision++) {
      advance(2100);
      event(`turn-${turn}`, `${revision % 2 ? 'Their' : 'The'} keyboard ${'design '.repeat(revision + 1)}${turn}.`);
    }
  }
  assert.equal(c.conversationLines.length, 3);
  assert.equal(c.recentUserTexts.length, 3);
  for (let turn = 0; turn < 3; turn++) {
    assert.match(c.conversationLines[turn], /You: Their keyboard/);
    assert.equal((c.conversationLines[turn].match(/design/g) || []).length, 26);
  }
});

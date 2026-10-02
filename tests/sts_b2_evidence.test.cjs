const assert = require('node:assert/strict');
const { test } = require('node:test');
const { cases, context } = require('./helpers/sts_evidence_harness.cjs');
const golden = require('./fixtures/sts-b2-evidence.json');
const { buildSnapshot } = require('../web/sts/brain2-evidence.js');

function unchangedContract(packet) {
  const { fingerprint, conversation, conversation_window, ...rest } = packet;
  return JSON.parse(JSON.stringify(rest));
}

for (const input of cases) {
  test(`B2 evidence preserves freshness and receipt baseline: ${input.name}`, () => {
    const c = context(input);
    const before = JSON.stringify(input);
    const packet = c.brain2EvidenceSnapshot();
    assert.deepEqual(unchangedContract(packet), unchangedContract(JSON.parse(golden.packets[input.name])));
    assert.equal(packet.conversation.map(row => row.text).join('\n'), input.lines.join('\n'));
    assert.equal(JSON.stringify(input), before, 'assembly must not mutate its inputs');
  });
}

test('B2 evidence literal empty contract includes explicit window coverage', () => {
  const packet = context(cases[0]).brain2EvidenceSnapshot();
  const runtime = { microphone: 'on', audio_recording: false, sensing_eye_image: null,
    image_task_receipts: null, file_write_receipts: [], sensing_eye_text: null,
    camera_active: false, b1_hard_brake: false, b1_hard_brake_reason: '' };
  const window = { format: 'whole-turns-v1', text_unit: 'UTF-16', target_text_units: 16000,
    included_text_units: 0, over_target: false, included_turns: 0, omitted_turns: 0,
    included_chunks: 0, omitted_chunks: 0, first_id: '', last_id: '' };
  assert.equal(JSON.stringify(packet), JSON.stringify({
    fingerprint: JSON.stringify([{ conversation: [], conversation_window: window }, null, runtime, [], [], []]),
    setup_cards: [], note_guidance: [],
    evidence_generation: 0, user_key: '', sampled_at: '2026-09-23T12:00:00.000Z', previous_sampled_at: null,
    assistant_chunks_total: 0, new_assistant_chunks: 0, last_assistant_output_id: '', new_user_input: false,
    conversation: [], conversation_window: window, latest_user_utterance: null, runtime, search_receipts: []
  }));
});

test('standalone packet builder accepts frozen inputs and leaves previous evidence untouched', () => {
  function freeze(value) {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }
  for (const input of cases) {
    const expected = JSON.parse(golden.packets[input.name]);
    const args = freeze(JSON.parse(JSON.stringify({
      lines: input.lines, metadata: input.metadata, prosody: input.prosody,
      sessionGeneration: input.generation, evidenceGeneration: input.evidenceGeneration,
      now: input.now, runtime: expected.runtime, searchReceipts: input.searches || [],
      setupCards: input.cards || [], noteGuidance: input.guidance || [], previous: input.previous || null
    })));
    const before = JSON.stringify(args);
    assert.deepEqual(unchangedContract(buildSnapshot(args)), unchangedContract(expected), input.name);
    assert.equal(JSON.stringify(args), before);
  }
});

test('packet extraction preserves Unicode text and existing role labels without interpretation', () => {
  const line = '[8:00:00 AM] You: Caf\u00e9 \u6708 \ud83c\udf19';
  const packet = context({ ...cases[0], lines: [line], prosody: { 0: 'doux' } }).brain2EvidenceSnapshot();
  assert.equal(packet.conversation[0].text, line);
  assert.equal(packet.latest_user_utterance.prosody, 'doux');
  assert.equal(packet.latest_user_utterance.role, 'user');
});

function packet(rows, extra = {}) {
  return buildSnapshot({ lines: rows.map(r => r.text), metadata: rows.map(r => ({
    iso: r.at || '', ...(r.response ? { responseId: r.response } : {})
  })), prosody: {}, sessionGeneration: 1, evidenceGeneration: 0,
  now: Date.parse('2026-09-30T12:00:00Z'), runtime: {}, searchReceipts: [],
  setupCards: [], noteGuidance: [], previous: null, ...extra });
}

test('more than twelve speech chunks preserve whole responses and the full operator assignment', () => {
  const user = '[8:00:00 AM] You: ' + 'The premise has several parts. '.repeat(45)
    + 'Now the actual task: compare three endings and save the alternatives.';
  const rows = [{ text: user, at: '2026-09-30T12:00:00Z' }];
  for (let reply = 1; reply <= 3; reply++) {
    for (let chunk = 0; chunk < 24; chunk++) rows.push({
      text: `[8:00:01 AM] Robot 790: reply ${reply}, chunk ${chunk}`,
      response: `response-${reply}`, at: new Date(Date.parse('2026-09-30T12:00:01Z') + chunk * 200).toISOString()
    });
  }
  const p = packet(rows);
  assert.equal(p.conversation.length, 4);
  assert.equal(p.conversation[1].chunk_count, 24);
  assert.equal(p.conversation[1].text, rows.slice(1, 25).map(r => r.text).join('\n'));
  assert.equal(p.conversation[3].first_id, '1:0:49');
  assert.equal(p.conversation[3].id, p.last_assistant_output_id);
  assert.equal(p.new_assistant_chunks, 72);
  assert.equal(p.latest_user_utterance.text, user);
  assert.equal(p.conversation_window.omitted_chunks, 0);
});

test('soft window omits whole older turns but retains two long replies and old operator direction', () => {
  const user = '[8:00:00 AM] You: ' + 'Full direction. '.repeat(100);
  const rows = [{ text: user }, ...[1, 2, 3, 4].map(n => ({
    text: `[8:00:01 AM] Robot 790: ${n}: ` + 'x'.repeat(9000), response: `r${n}`
  }))];
  const p = packet(rows);
  assert.equal(p.conversation.length, 2);
  assert.equal(p.conversation[0].text, rows[3].text);
  assert.equal(p.conversation[1].text, rows[4].text);
  assert.equal(p.conversation_window.omitted_turns, 3);
  assert.equal(p.conversation_window.omitted_chunks, 3);
  assert.equal(p.conversation_window.over_target, true);
  assert.equal(p.latest_user_utterance.text, user);
  const corrected = packet([{ text: user + ' A corrected ending.' }, ...rows.slice(1)], { previous: p });
  assert.notEqual(corrected.fingerprint, p.fingerprint, 'out-of-window operator amendment is still evidence');
  assert.equal(corrected.new_user_input, true);
  assert.equal(corrected.new_assistant_chunks, 0);
});

test('different native response IDs stay separate even in the same second, including repeated wording', () => {
  const p = packet(['a', 'b', 'c'].map(response => ({
    text: '[8:00:00 AM] Robot 790: I am here.', at: '2026-09-30T12:00:00Z', response
  })));
  assert.equal(p.conversation.length, 3);
  assert.ok(p.conversation.every(r => r.chunk_count === 1));
});

test('legacy timing groups a burst, not a later repeat, missing timestamps, or an interruption', () => {
  const reply = text => `[8:00:00 AM] Robot 790: ${text}`;
  const p = packet([
    { text: reply('First sentence.'), at: '2026-09-30T12:00:00Z' },
    { text: reply('Second sentence.'), at: '2026-09-30T12:00:01Z' },
    { text: reply('First sentence.'), at: '2026-09-30T12:00:46Z' },
    { text: '[8:00:47 AM] You: Wait.', at: '2026-09-30T12:00:47Z' },
    { text: reply('Interrupted.'), at: '2026-09-30T12:00:48Z' },
    { text: reply('Unknown time.') }, { text: reply('Another unknown.') }
  ]);
  assert.deepEqual(p.conversation.map(r => r.chunk_count), [2, 1, 1, 1, 1, 1]);
});

test('growing an in-flight response advances chunk identity without manufacturing another turn', () => {
  const rows = [{ text: '[8:00:00 AM] Robot 790: Beginning.', response: 'same' }];
  const first = packet(rows);
  rows.push({ text: '[8:00:10 AM] Robot 790: Still the same reply.', response: 'same' });
  const next = packet(rows, { previous: first });
  assert.equal(next.conversation.length, 1);
  assert.equal(next.conversation[0].chunk_count, 2);
  assert.equal(next.last_assistant_output_id, '1:0:1');
  assert.equal(next.new_assistant_chunks, 1);
  assert.notEqual(next.fingerprint, first.fingerprint);
  assert.equal(packet(rows, { previous: next, now: Date.parse('2026-09-30T13:00:00Z') }).fingerprint,
    next.fingerprint);
});

test('accepted evidence checkpoint changed only response metadata; current page retains the wiring', () => {
  const fs = require('node:fs');
  const cp = require('node:child_process');
  const { edits, normalizeB2Evidence } = require('./helpers/sts_b2_evidence_scope.cjs');
  const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');
  const before = cp.execFileSync('git', ['show', '4e30b93:web/sts/index.html'], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
  for (const [after] of edits) assert.equal(page.split(after).length - 1, 1, after);
  const checkpoint = require('./helpers/sts_checkpoint_page.cjs').acceptedCheckpointPage();
  assert.equal(normalizeB2Evidence(checkpoint), before);
});

test('prepared B2 evidence receipt goes to audit, not the conversation or advisory queues', () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const { extract } = require('./helpers/sts_completion_harness.cjs');
  const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');
  const audit = [], ledgers = [];
  const c = vm.createContext({ Date, brain2PromptLog: [], maxBrain2PromptLog: 20,
    logBrain2: (...args) => audit.push(args), rememberPromptLedger: item => ledgers.push(item),
    log() {}, events: {} });
  vm.runInContext(extract(page, 'rememberBrain2Prompt'), c);
  c.rememberBrain2Prompt({ result: { status: 'ok', prompt_debug: { system: 'System', user: 'Evidence',
    evidence_receipt: { format: 'whole-turns-v1', latest_user_characters: 1146 } } } });
  assert.equal(audit.length, 1);
  assert.equal(audit[0][0], 'evidence input');
  assert.equal(JSON.parse(audit[0][1]).latest_user_characters, 1146);
  assert.equal(ledgers[0].input, 'Evidence');
});

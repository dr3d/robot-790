const assert = require('node:assert/strict');
const { test } = require('node:test');
const { cases, context } = require('./helpers/sts_evidence_harness.cjs');
const golden = require('./fixtures/sts-b2-evidence.json');
const { buildSnapshot } = require('../web/sts/brain2-evidence.js');

for (const input of cases) {
  test(`B2 evidence exact baseline: ${input.name}`, () => {
    const c = context(input);
    const before = JSON.stringify(input);
    assert.equal(JSON.stringify(c.brain2EvidenceSnapshot()), golden.packets[input.name]);
    assert.equal(JSON.stringify(input), before, 'assembly must not mutate its inputs');
  });
}

test('B2 evidence literal empty contract and field order', () => {
  const packet = context(cases[0]).brain2EvidenceSnapshot();
  const runtime = { microphone: 'on', audio_recording: false, sensing_eye_image: null,
    image_task_receipts: null, file_write_receipts: [], sensing_eye_text: null,
    camera_active: false, b1_hard_brake: false, b1_hard_brake_reason: '' };
  assert.equal(JSON.stringify(packet), JSON.stringify({
    fingerprint: JSON.stringify([[], runtime, [], [], []]), setup_cards: [], note_guidance: [],
    evidence_generation: 0, user_key: '', sampled_at: '2026-09-23T12:00:00.000Z', previous_sampled_at: null,
    assistant_chunks_total: 0, new_assistant_chunks: 0, last_assistant_output_id: '', new_user_input: false,
    conversation: [], latest_user_utterance: null, runtime, search_receipts: []
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
    assert.equal(JSON.stringify(buildSnapshot(args)), golden.packets[input.name], input.name);
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

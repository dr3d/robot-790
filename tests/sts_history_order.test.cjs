const assert = require('node:assert/strict');
const { test } = require('node:test');
const { chronologicalPromptNotes, prepare } = require('../web/sts/connection-context.js');

const session = (name, date, body = name, variant = false) => ({
  filename: `sessions/${name}.txt`, connection_history: true,
  content: variant
    ? `STS Session Variant\nCreated: 2026-10-01T12:00:00Z\nSource created: ${date}\n\n${body}`
    : `STS Session Note\nCreated: ${date}\n\n${body}`,
});

test('newest-first inventory is presented oldest-first without changing any note or transcript', () => {
  const notes = [session('latest', '2026-09-23T21:24:55-04:00', '[9:20] FIRST\n[9:21] SECOND'),
    session('middle', '2026-09-23T12:52:58-04:00'), session('root', '2026-09-18T12:30:22-04:00')];
  const before = structuredClone(notes);
  const ordered = chronologicalPromptNotes(notes);
  assert.deepEqual(ordered, [notes[2], notes[1], notes[0]]);
  assert.equal(ordered[2], notes[0]);
  assert.deepEqual(notes, before);
  assert.deepEqual(chronologicalPromptNotes(ordered), ordered);
});

test('source timestamps govern variants and UTC offsets govern date ordering', () => {
  const earlier = session('earlier', '2026-09-24T09:00:00-04:00', 'EXCERPT', true);
  const later = session('later', '2026-09-24T13:30:00Z');
  assert.deepEqual(chronologicalPromptNotes([later, earlier]), [earlier, later]);
});

test('pins, routed cards and undated history keep their positions; equal dates are stable', () => {
  const newest = session('newest', '2026-09-24T12:00:00Z');
  const older = session('older', '2026-09-22T12:00:00Z');
  const sameDate = session('tie', '2026-09-22T12:00:00Z');
  const pin = { filename: 'notes/facts.txt', content: 'Created: 2000-01-01T00:00:00Z\nFACTS' };
  const card = { ...session('card', '2000-01-01T00:00:00Z'), brain_context: { version: 1 } };
  const undated = session('unknown', 'not a date');
  const notes = [newest, pin, older, card, undated, sameDate];
  assert.deepEqual(chronologicalPromptNotes(notes), [older, pin, sameDate, card, undated, newest]);
  assert.deepEqual(chronologicalPromptNotes(null), []);
  assert.deepEqual(chronologicalPromptNotes([]), []);
});

test('chronological measurement preserves newest-first budget selection and protected ends', async () => {
  const notes = [session('latest', '2026-09-24T12:00:00Z'),
    session('middle', '2026-09-23T12:00:00Z', 'X'.repeat(200)),
    session('root', '2026-09-18T12:00:00Z')];
  const compacted = [], measured = [];
  const result = await prepare({ notes,
    measure: candidate => {
      const prompt = chronologicalPromptNotes(candidate);
      measured.push(prompt.map(n => n.filename));
      const prompt_tokens = prompt.reduce((n, item) => n + item.content.length, 0);
      return { model: 'local', context_window_tokens: 1000, policy: {}, startup_budget_tokens: 300,
        prompt_tokens, fits: prompt_tokens <= 300 };
    },
    compact: async filename => {
      compacted.push(filename);
      return { status: 'ok', filename, content: session('middle', '2026-09-23T12:00:00Z', 'EXCERPT', true).content,
        source_sha256: 'a'.repeat(64), method: 'source-excerpts' };
    },
  });
  assert.deepEqual(compacted, ['sessions/middle.txt']);
  assert.deepEqual(result.notes[0], notes[0]);
  assert.deepEqual(result.notes[2], notes[2]);
  for (const order of measured) assert.deepEqual(order, ['sessions/root.txt', 'sessions/middle.txt', 'sessions/latest.txt']);
  assert.equal(result.receipt.history_selection.recent_sessions_intact, 1);
});

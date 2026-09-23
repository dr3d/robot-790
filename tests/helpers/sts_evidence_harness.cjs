const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const page = fs.readFileSync(`${__dirname}/../../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');
const now = Date.parse('2026-09-23T12:00:00Z');
const lines = ['[8:00:00 AM] You: Remember the hotel.', '[8:00:01 AM] Robot 790: The cloche handshake.'];
const metadata = [{ iso: '2026-09-23T12:00:00Z' }, { iso: '2026-09-23T12:00:01Z' }];
const user = { id: '4:2:0', text: lines[0], at: metadata[0].iso, role: 'user', prosody: 'steady' };
const previous = { sampled_at: '2026-09-23T11:59:59.000Z', assistant_chunks_total: 1, user_key: JSON.stringify(user) };
const defaults = { now, lines, metadata, prosody: { 0: 'steady' }, generation: 4, evidenceGeneration: 2 };
const cases = [
  { name: 'empty card-free connection', lines: [], metadata: [], prosody: {}, generation: 1, evidenceGeneration: 0 },
  { name: 'resumed conversation', previous },
  { name: 'time alone and accelerated idle', previous, now: now + 60000, labSpeed: 12 },
  { name: 'transcript amendment', lines: [lines[0].replace('hotel', 'harbor'), lines[1]], previous },
  { name: 'new assistant chunk', lines: [...lines, '[8:00:02 AM] Robot 790: A tray crosses clocks.'], previous },
  { name: 'old user outside transcript window', lines: [...lines, ...Array.from({ length: 20 }, (_, i) => `[8:00:03 AM] Robot 790: thought ${i}`)], previous },
  { name: 'new session and reset counters', generation: 5, evidenceGeneration: 3, previous: { ...previous, assistant_chunks_total: 80 } },
  { name: 'missing timestamps and unrecognized role', lines: ['[8:00:00 AM] System: receipt', '[8:00:01 AM] You: Salut.', '[8:00:02 AM] Robot 790: Bonjour.'], metadata: [], prosody: {} },
  { name: 'write receipt with stale sibling', writes: [
    { call_id: 'stale', session_generation: 3, status: 'ok', filename: 'old.txt' },
    { call_id: 'write', session_generation: 4, at: '2026-09-23T12:00:00Z', status: 'ok', filename: 'Trip.txt', characters: 12, mode: 'overwrite' }
  ] },
  { name: 'image eye and idle art receipts', image: { artifact: 'new.png', receipts: [{ tool: 'generate_image', status: 'ok' }] },
    eye: 'new.jpg', art: { jobs: [{ filename: 'idle.png', status: 'ready' }] } },
  { name: 'search receipt window', searches: [1, 2, 3, 4].map(n => ({ query: `search ${n}`, status: 'ok' })) },
  { name: 'changed note guidance', cards: ['setup-cards/companion.txt'], guidance: [{ filename: 'setup-cards/companion.txt', text: 'Ask a real question.', key: 'v2' }] },
  { name: 'runtime attention and holds', microphone: 'muted', recording: true, camera: true, brake: 'existing hold', textName: 'input.txt', attention: 'warm' },
  { name: 'private thoughts are not evidence', previous, recentBrain2Outputs: [{ text: 'PRIVATE THOUGHT NOT A FACT' }] }
].map(item => ({ ...defaults, ...item }));

function context(input) {
  const c = vm.createContext({
    Robot790Brain2Evidence: require('../../web/sts/brain2-evidence.js'),
    Date: class extends Date { static now() { return input.now; } },
    realtimeConnection: { generation: input.generation }, brain2EvidenceGeneration: input.evidenceGeneration,
    conversationLines: input.lines, conversationLineMetadata: input.metadata, conversationProsodyByIndex: input.prosody,
    micRuntimeLabel: () => input.microphone || 'on', audioRecordingActive: () => Boolean(input.recording),
    visionImageUrl: input.eye || '', visionImageName: input.eye || '', imageTaskReceipt: input.image || null,
    fileWriteReceipts: input.writes || [], sensingTextContent: input.textName ? 'PRIVATE INPUT BODY' : '', sensingTextName: input.textName || '',
    visionCameraActive: () => Boolean(input.camera), idleHardBrakeActive: () => Boolean(input.brake), idleHardBrakeReason: input.brake || '',
    conversationAttentionEnabled: () => Boolean(input.attention), conversationAttentionState: () => ({ phase: input.attention }),
    searchContextReceipts: input.searches || [], brain2SetupCards: () => input.cards || [],
    Robot790NoteBrains: { forBrain: () => input.guidance || [] }, loadedNoteContexts: [], brain2LastEvidence: input.previous || null,
    recentBrain2Outputs: input.recentBrain2Outputs || [], labSpeed: input.labSpeed || 1,
    ...(input.art ? { idleArt: { history: [1], snapshot: count => { assert.equal(count, 6); return input.art; } } } : {})
  });
  const start = page.indexOf('    function brain2EvidenceSnapshot(');
  const end = page.indexOf('\n    }\n', start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(page.slice(start, end + 6), c);
  return c;
}

module.exports = { cases, context };

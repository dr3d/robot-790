const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

function fixture() {
  const measured = [], pinned = [];
  const context = vm.createContext({
    URL, AbortSignal, location: { href: 'http://localhost/' },
    ws: {}, realtimeSessionGeneration: 1, realtimeConnected: () => true,
    realtimeStopRequested: false, activeRealtimeSession: () => true,
    lastConversationInputTokens: 80000,
    connectionContextReceipt: { prompt_tokens: 60000, model: 'local' },
    Robot790NoteBrains: require('../web/sts/note-brains.js'),
    log() {}, events: {}, rememberLoadedNoteContext: note => pinned.push(note),
    fetch: async (url, options) => {
      if (String(url).includes('/api/notes/read')) return { ok: true,
        json: async () => ({ status: 'ok', filename: 'trail.txt', content: 'Full note END' }) };
      measured.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ status: 'ok', fits: false, model: 'local',
        prompt_tokens: 2500, live_input_ceiling_tokens: 120000 }) };
    },
  });
  for (const name of ['admitLiveNoteRead', 'readTextFile']) {
    const start = page.indexOf(`    async function ${name}(`);
    const end = page.indexOf('\n    }\n', start);
    require('./helpers/sts_connection_harness.cjs').installRealtimeConnection(context);
    vm.runInContext(page.slice(start, end + 6), context);
  }
  return { c: context, measured, pinned };
}

test('live reads count the full B1 receipt and use live headroom, not startup growth reserve', async () => {
  const { c, measured, pinned } = fixture();
  const result = await c.readTextFile({ filename: 'trail.txt' }, { toolRead: true });
  assert.equal(result.content, 'Full note END');
  assert.equal(pinned.length, 1);
  assert.match(measured[0].instructions, /Full note END/);
  assert.deepEqual(measured[0].tools, []);
  await c.admitLiveNoteRead({ filename: 'card.txt', content: 'BODY', brain_context: {
    version: 1, revision: 'new', shared: 'SHARED', brains: { b1: 'PUBLIC', b2: 'PRIVATE B2' }
  } });
  assert.match(measured[1].instructions, /PUBLIC/);
  assert.doesNotMatch(measured[1].instructions, /PRIVATE B2/);
});

test('oversized live reads fail explicitly before pin mutation or tool delivery', async () => {
  const { c, pinned } = fixture();
  c.lastConversationInputTokens = 119000;
  await assert.rejects(c.readTextFile({ filename: 'trail.txt' }, { toolRead: true }), /Nothing clipped or pinned/);
  assert.equal(pinned.length, 0);
});

test('stale connections and measurement errors cannot install a note', async () => {
  const { c, pinned } = fixture();
  c.activeRealtimeSession = () => false;
  await assert.rejects(c.readTextFile({ filename: 'trail.txt' }), /Connection changed/);
  c.activeRealtimeSession = () => true;
  c.fetch = async () => ({ ok: false, status: 500, json: async () => ({ error: 'model unavailable' }) });
  await assert.rejects(c.admitLiveNoteRead({ filename: 'trail.txt', content: 'END' }), /nothing pinned or delivered/);
  assert.equal(pinned.length, 0);
});

test('disconnected and save-stop reads do not depend on a loaded model', async () => {
  const { c, measured, pinned } = fixture();
  c.realtimeConnected = () => false;
  await c.readTextFile({ filename: 'trail.txt' });
  c.realtimeConnected = () => true;
  c.realtimeStopRequested = true;
  await c.readTextFile({ filename: 'trail.txt' });
  assert.equal(pinned.length, 2);
  assert.equal(measured.length, 0);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const lookup = require('../web/sts/file-lookup.js');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

function load(names, globals = {}) {
  const context = vm.createContext({ Robot790FileLookup: lookup, URL, location: { href: 'http://localhost:8790/' }, ...globals });
  for (const name of names) {
    const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    const end = page.indexOf('\n    }\n', start);
    assert.ok(start >= 0 && end > start, name);
    vm.runInContext(page.slice(start, end + 6), context);
  }
  return context;
}

function fixture(files, local = []) {
  const calls = [];
  const c = load(['sensingEyeLookupItems', 'listSensingEyeImages', 'listSensingEyeNotes',
    'sensingEyeNoteQueryScore', 'chooseSensingEyeNote'], {
    sensingEyeImageHistoryList: () => local,
    sensingEyeTextHistoryList: () => [],
    sensingEyeSavedRemarks: () => new Map(),
    fetchSensingEyeFilePage: async args => {
      calls.push(args);
      const found = files.filter(file => args.filename ? file.filename === args.filename
        : args.hints.includes(file.filename) || lookup.matches(`${file.filename} ${file.reason || ''}`, args.query));
      return { total: found.length, files: found.slice(args.offset, args.offset + args.limit) };
    }
  });
  return { c, calls };
}

test('tool lookups have small enforced pages and cannot request an unlimited dump', () => {
  assert.deepEqual(lookup.options(), { query: '', offset: 0, limit: 5 });
  for (const options of [{ limit: 0 }, { limit: 25 }, { limit: '8' }, { offset: -1 },
    { offset: 0.5 }, { offset: Infinity }, { query: {} }, { query: 'x'.repeat(161) }]) {
    assert.throws(() => lookup.options(options));
  }
  assert.equal(lookup.options({ limit: 8 }).limit, 8);
});

test('lookup keys handle Unicode and separators without English keyword rules', () => {
  assert.equal(lookup.matches('2026-港の灯台.jpg', '港の灯台'), true);
  assert.equal(lookup.matches('Lumière_du-port.jpg', 'LUMIÈRE port'), true);
  assert.equal(lookup.matches('Caf\u0065\u0301.jpg', 'café'), true);
  assert.equal(lookup.matches('harbor.jpg', '!!!'), false);
  assert.equal(lookup.matches('boat.jpg', 'lighthouse'), false);
});

test('both eye tool aliases return compact matches, never dialogue, paths, URLs or contents', async () => {
  const files = Array.from({ length: 80 }, (_, i) => ({
    filename: `image-${String(i).padStart(3, '0')}.jpg`, reason: 'r'.repeat(1000),
    nearby_transcript: 'PRIVATE '.repeat(1000), last_user_text: 'PRIVATE',
    url: '/sensing-eye/example.jpg', source: 'PRIVATE',
  }));
  const { c } = fixture(files);
  for (const [fn, field] of [['listSensingEyeNotes', 'notes'], ['listSensingEyeImages', 'images']]) {
    const first = await c[fn]();
    assert.equal(first[field].length, 5);
    assert.equal(first.total, 80);
    assert.equal(first.next_offset, 5);
    assert.doesNotMatch(JSON.stringify(first), /PRIVATE|open_url|remarks_after_open|saved_filename|nearby_transcript/);
    assert.ok(JSON.stringify(first).length < 2300);
    const next = await c[fn]({ offset: first.next_offset, limit: 8 });
    assert.equal(next[field].length, 8);
    assert.equal(next[field][0].id, 'file:image-005.jpg');
    assert.equal(next.next_offset, 13);
    const end = await c[fn]({ offset: 79 });
    assert.equal(end[field].length, 1);
    assert.equal(end.next_offset, null);
  }
});

test('search and exact recall can reach files older than the former 25-file window', async () => {
  const files = Array.from({ length: 50 }, (_, i) => ({ filename: `new-${i}.jpg` }));
  files.push({ filename: 'old-harbor-lighthouse.jpg', url: '/sensing-eye/old-harbor-lighthouse.jpg' });
  const { c, calls } = fixture(files);
  const match = await c.listSensingEyeNotes({ query: 'harbor lighthouse' });
  assert.equal(match.total, 1);
  const exact = await c.sensingEyeLookupItems({ image_id: match.notes[0].id, query: 'irrelevant context' });
  assert.equal(exact.images[0].id, match.notes[0].id);
  assert.equal(exact.images[0].open_url, 'http://localhost:8790/sensing-eye/old-harbor-lighthouse.jpg');
  assert.equal(calls.at(-1).filename, 'old-harbor-lighthouse.jpg');
  assert.equal((await c.sensingEyeLookupItems({ image_id: 'file:missing.jpg' })).images.length, 0);
});

test('attributed old remarks are search clues but never become catalogue dialogue', async () => {
  const { c, calls } = fixture([{ filename: 'camera-001.jpg', nearby_transcript: 'a different subject' }]);
  c.sensingEyeSavedRemarks = () => new Map([['camera-001.jpg', [{ remarks: ['A lighthouse with a square tower.'] }]]]);
  const match = await c.listSensingEyeNotes({ query: 'square tower' });
  assert.equal(match.notes[0].id, 'file:camera-001.jpg');
  assert.deepEqual(Array.from(calls[0].hints), ['camera-001.jpg']);
  assert.doesNotMatch(JSON.stringify(match), /A lighthouse|different subject|remarks/);
});

test('unsaved local eye notes page correctly with disk files and saved local IDs are deduplicated', async () => {
  const local = Array.from({ length: 7 }, (_, i) => ({ id: `eye-${i}`, name: `local-${i}.jpg` }));
  local.push({ id: 'eye-saved', saved_filename: 'saved.jpg', name: 'original.jpg', current: true });
  const { c } = fixture([{ filename: 'saved.jpg' }, { filename: 'other.jpg' }], local);
  const first = await c.listSensingEyeNotes();
  assert.equal(first.total, 9);
  const next = await c.listSensingEyeNotes({ offset: first.next_offset });
  assert.deepEqual(Array.from(next.notes, n => n.id), ['eye-5', 'eye-6', 'file:saved.jpg', 'file:other.jpg']);
  assert.equal(next.notes[2].current, true);
  assert.equal(next.notes[2].name, 'original.jpg');
  assert.equal(next.next_offset, null);
  assert.equal((await c.sensingEyeLookupItems({ image_id: 'file:saved.jpg' })).images[0].history_id, 'eye-saved');
});

test('ambiguous search results remain separate choices; no automatic eye replacement', async () => {
  const { c } = fixture([{ filename: 'panda-one.jpg' }, { filename: 'panda-two.jpg' }]);
  const result = await c.listSensingEyeNotes({ query: 'panda' });
  assert.equal(result.notes.length, 2);
  assert.equal(c.chooseSensingEyeNote(result.notes, { query: 'panda' }), null);
  assert.equal(c.chooseSensingEyeNote(result.notes, { id: 'file:panda-two.jpg', index: 1 }).id, 'file:panda-two.jpg');
});

test('file lookup API rejects stale helpers instead of silently ignoring query and paging', async () => {
  const c = load(['fetchSensingEyeFilePage'], { fetch: async () => ({ ok: true, json: async () => ({ files: [] }) }) });
  await assert.rejects(c.fetchSensingEyeFilePage({ query: 'old photo' }), /needs a restart/);
  c.fetch = async url => {
    assert.equal(url.searchParams.get('query'), '灯台');
    assert.equal(url.searchParams.get('filename'), 'A&B #1.jpg');
    assert.deepEqual(url.searchParams.getAll('hint'), ['A&B #1.jpg']);
    return { ok: true, json: async () => ({ lookup_version: 1, files: [], total: 0 }) };
  };
  await c.fetchSensingEyeFilePage({ query: '灯台', filename: 'A&B #1.jpg', hints: ['A&B #1.jpg'] });
});

test('note-file tool enforces a small page before sending a request; the operator shelf is separate', async () => {
  const calls = [];
  const c = load(['listTextFiles'], {
    fetch: async url => { calls.push(url); return { ok: true, json: async () => ({ files: ['one.txt'] }) }; },
    events: {}, log() {}
  });
  await c.listTextFiles({ query: 'companion', directory: 'setups' });
  assert.equal(calls[0].searchParams.get('limit'), '5');
  assert.equal(calls[0].searchParams.get('query'), 'companion');
  await assert.rejects(c.listTextFiles({ limit: 999 }), /1-8/);
  assert.equal(calls.length, 1);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const vm = require('node:vm');
const { test } = require('node:test');
const { extract } = require('./helpers/sts_completion_harness.cjs');
const { installInboxState, normalizeInboxState } = require('./helpers/sts_eye_inbox_state_owner.cjs');
const before = cp.execFileSync('git', ['show', 'd2629ec:web/sts/index.html'], { encoding: 'utf8', maxBuffer: 4e6 }).replace(/\r\n/g, '\n');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');
const plain = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(setImmediate);

function fixture(source, options = {}) {
  const trace = [], image = { width: 10, height: 10 };
  let decode;
  const c = vm.createContext({
    URL, AbortSignal, Date, location: { href: 'http://localhost:8790/' },
    sensingEyeContent: { generation: 3, clearInFlight: !!options.clearing },
    sensingEyeClientId: 'this', sensingEyeFaceCommandIgnoreSeqThrough: options.faceIgnore || 0,
    sensingEyeInboxLastSeq: 2, sensingEyeInboxIgnoreSeqThrough: options.ignore || 0,
    handledSensingEyeInboxSeqs: new Set(options.handled || []),
    sensingEyeInboxPollInFlight: false, window: {},
    filenameFromPath: x => x, sensingEyeMemoryContext: () => ({ last_user_text: 'fixture' }),
    loadImage: data => { trace.push(['decode', data]); return options.hold
      ? new Promise(resolve => { decode = resolve; }) : Promise.resolve(image); },
    rememberSensingEyeSessionAsset: name => trace.push(['asset', name]),
    setVisionImageFromDrawable: async (...args) => { trace.push(['set', ...args]); if (options.setterFails) throw Error('save failed'); },
    updateVisionButtons: () => trace.push(['buttons']),
    log: (_, message) => trace.push(['log', message]), events: {},
    scheduleSensingEyeInboxPoll: () => trace.push(['schedule']),
    fetch: async (url, init) => { trace.push(['fetch', url.href, init]); return {
      ok: !options.httpError, status: 503, statusText: 'Unavailable',
      json: async () => options.badJson ? Promise.reject(Error('bad JSON')) : { status: 'ok', latest_seq: options.latest ?? 20, item: options.item || null }
    }; },
  });
  installInboxState(c, source);
  for (const name of ['applySensingEyeInboxItem', 'fetchSensingEyeInboxItem', 'clearSensingEyeInboxOnServer',
    'syncSensingEyeInboxCursor', 'pollSensingEyeInbox', 'flushSensingEyeInboxForSessionSave', 'createSensingEyePersistence']) {
    vm.runInContext(extract(source, name), c);
  }
  c.Robot790SensingEyePersistence = { create: a => a };
  const observe = c.createSensingEyePersistence().observeInboxSeq;
  const snapshot = () => plain({ last: c.sensingEyeInboxLastSeq, ignore: c.sensingEyeInboxIgnoreSeqThrough,
    handled: [...c.handledSensingEyeInboxSeqs], trace });
  return { c, observe, snapshot, trace, release: () => decode(image) };
}
const item = { seq: 12, image_data_url: 'data:fixture', filename: 'original.png', saved_filename: 'original.jpg', saved_url: '/sensing-eye/original.jpg', source: 'browser_face', state: { mood: 'happy', mouth: { shape: 'smile' } } };

for (const [label, options, patch] of [
  ['normal', {}, {}], ['zero', {}, { seq: 0 }], ['no image', {}, { image_data_url: '' }],
  ['numeric string', {}, { seq: '012' }], ['clear active', { clearing: true }, {}],
  ['ignored cursor', { ignore: 20 }, {}], ['handled', { handled: ['12'] }, {}],
  ['stale local generation', {}, { client_id: 'this', client_eye_generation: 2 }],
  ['current local generation', {}, { client_id: 'this', client_eye_generation: 3 }],
  ['external generation', {}, { client_id: 'other', client_eye_generation: 2 }],
  ['old face command', { faceIgnore: 15 }, { face_command_seq: 14 }],
  ['setter error', { setterFails: true }, {}],
  ['handled retention', { handled: Array.from({ length: 105 }, (_, i) => String(100 + i)) }, {}],
]) test(`inbox receipt ${label} matches d2629ec`, async () => {
  const run = async source => {
    const f = fixture(source, options), results = [];
    for (let i = 0; i < 2; i++) {
      try { results.push(await f.c.applySensingEyeInboxItem({ ...item, ...patch })); }
      catch (error) { results.push(error.message); }
    }
    return { results, ...f.snapshot() };
  };
  assert.deepEqual(await run(page), await run(before));
});

for (const mode of ['duplicate while decoding', 'generation change while decoding']) test(`inbox ${mode} matches d2629ec`, async () => {
  const run = async source => {
    const f = fixture(source, { hold: true });
    const pending = f.c.applySensingEyeInboxItem(item);
    await tick();
    const initial = f.snapshot();
    if (mode.startsWith('generation')) f.c.sensingEyeContent.generation++;
    else assert.equal(await f.c.applySensingEyeInboxItem(item), false);
    f.release();
    return { initial, result: await pending, final: f.snapshot() };
  };
  assert.deepEqual(await run(page), await run(before));
});

for (const method of ['clearSensingEyeInboxOnServer', 'syncSensingEyeInboxCursor']) {
  for (const options of [{}, { latest: '30' }, { latest: 1 }, { latest: 'bad' }, { httpError: true }, { badJson: true }]) {
    test(`inbox ${method} ${JSON.stringify(options)} matches d2629ec`, async () => {
      const run = async source => {
        const f = fixture(source, options); f.observe(25);
        let result, error;
        try { result = await f.c[method](); } catch (e) { error = e.message; }
        await f.c.fetchSensingEyeInboxItem();
        return plain({ result, error, ...f.snapshot() });
      };
      if (options.httpError) {
        // Fetch errors are separately tested by the real poll below.
        const runError = async source => { const f = fixture(source, options); await assert.rejects(f.c[method](), /Unavailable/); return f.snapshot(); };
        assert.deepEqual(await runError(page), await runError(before));
      } else assert.deepEqual(await run(page), await run(before));
    });
  }
}

test('saved receipts preserve untrimmed echoes, ordering and out-of-order cursors', () => {
  const run = source => {
    const f = fixture(source);
    for (let i = 1; i <= 110; i++) f.observe(i);
    f.observe(2);
    return f.snapshot();
  };
  assert.deepEqual(run(page), run(before));
  assert.equal(run(page).handled.length, 110);
});

for (const mode of ['normal', 'already polling', 'unloading', 'failed', 'stale', 'save flush', 'obsolete save']) test(`inbox ${mode} orchestration matches d2629ec`, async () => {
  const run = async source => {
    const f = fixture(source, { item });
    f.c.sensingEyeInboxPollInFlight = mode === 'already polling';
    f.c.window.__robot790PageUnloading = mode === 'unloading';
    f.c.fetchSensingEyeInboxItem = async () => {
      if (mode === 'failed') throw Error('offline');
      if (mode === 'stale') f.c.sensingEyeContent.generation++;
      return item;
    };
    if (mode.includes('save')) await f.c.flushSensingEyeInboxForSessionSave({ isCurrent: () => mode !== 'obsolete save' });
    else await f.c.pollSensingEyeInbox();
    return f.snapshot();
  };
  assert.deepEqual(await run(page), await run(before));
});

test('accepted inbox state extraction left existing page function bodies equivalent', () => {
  const checkpoint = require('./helpers/sts_checkpoint_page.cjs').acceptedCheckpointPage();
  for (const match of before.matchAll(/^    (?:async )?function (\w+)\(/gm)) {
    assert.equal(normalizeInboxState(extract(checkpoint, match[1])), extract(before, match[1]), match[1]);
  }
});

test('shipped inbox owner is private, read-only and independent', () => {
  const { create } = require('../web/sts/sensing-eye-inbox-state.js');
  const a = create(), b = create();
  assert.equal(a.lastSeq, 0); assert.equal(a.ignoreSeqThrough, 0);
  a.observeSaved(12); a.observeSaved(3);
  assert.equal(a.lastSeq, 12); assert.equal(a.ignoreSeqThrough, 12);
  assert.equal(a.has('3'), true); assert.equal(a.has(3), false);
  assert.equal(Reflect.set(a, 'lastSeq', 99), false);
  assert.equal(Reflect.set(a, 'ignoreSeqThrough', 99), false);
  assert.equal(b.lastSeq, 0); assert.equal(b.has('12'), false);
  assert.deepEqual(Object.keys(a).sort(), ['advance', 'has', 'ignoreSeqThrough', 'ignoreThrough', 'lastSeq', 'observeSaved', 'remember']);
  for (let i = 0; i < 110; i++) a.observeSaved(i);
  assert.equal(a.has('0'), true);
  a.remember('new');
  assert.equal(a.has('0'), false); assert.equal(a.has('new'), true);
  assert.doesNotMatch(page, /\b(?:sensingEyeInboxLastSeq|sensingEyeInboxIgnoreSeqThrough|handledSensingEyeInboxSeqs)\b/);
});

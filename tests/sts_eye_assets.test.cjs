const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const vm = require('node:vm');
const { test } = require('node:test');
const { extract } = require('./helpers/sts_completion_harness.cjs');
const { installEyeAssets } = require('./helpers/sts_eye_assets_owner.cjs');
const { saveFixture, deferred, settle } = require('./helpers/sts_save_harness.cjs');
const baseline = '97d0721';
const before = cp.execFileSync('git', ['show', `${baseline}:web/sts/index.html`], { encoding: 'utf8', maxBuffer: 4e6 }).replace(/\r\n/g, '\n');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');
const key = 'robot790.sensingEyeSessionAssets.v1';
const plain = value => JSON.parse(JSON.stringify(value));

function attach(c, source, options = {}) {
  const trace = [], stored = new Map(options.stored === undefined ? [] : [[key, options.stored]]);
  c.sensingEyeSessionAssetStorageKey = key;
  vm.runInContext(extract(source, 'filenameFromPath'), c);
  const storage = Object.fromEntries(['getItem', 'setItem', 'removeItem'].map(method => [method, (...args) => {
    trace.push([method, ...args]);
    if (options.fail === method) throw Error('storage unavailable');
    if (method === 'getItem') return stored.get(args[0]) ?? null;
    if (method === 'setItem') stored.set(...args);
    if (method === 'removeItem') stored.delete(args[0]);
  }]));
  Object.defineProperty(c, 'sessionStorage', { configurable: true, get() {
    if (options.fail === 'access') throw Error('storage denied');
    return storage;
  } });
  installEyeAssets(c, source);
  return { c, trace, snapshot: () => plain({ files: c.sensingEyeSessionAssetFilenamesForSave(), stored: [...stored], trace }) };
}

for (const [label, options] of Object.entries({ empty: {}, duplicates: { stored: '["z.jpg","a.txt","z.jpg"]' },
  paths: { stored: '["dir/a.jpg","C:\\\\folder\\\\b.txt", "", null, 0, false, 123]' },
  malformed: { stored: '{broken' }, object: { stored: '{}' }, null: { stored: 'null' }, string: { stored: '"one.jpg"' },
  getFailure: { fail: 'getItem' }, setFailure: { fail: 'setItem' }, removeFailure: { fail: 'removeItem' }, denied: { fail: 'access' },
})) test(`session assets ${label} preserves ${baseline} behavior`, () => {
  const run = source => {
    const f = attach(vm.createContext({}), source, options), snapshots = [];
    f.c.loadSensingEyeSessionAssets(); snapshots.push(f.snapshot());
    for (const name of ['dir/z.jpg', 'folder/a.txt', 'dir/z.jpg', '', null, 0, false, 123, ' spaced name.jpg ']) {
      f.c.rememberSensingEyeSessionAsset(name);
    }
    snapshots.push(f.snapshot());
    const frozen = f.c.sensingEyeSessionAssetFilenamesForSave();
    frozen.push('outside.jpg');
    assert.ok(!f.c.sensingEyeSessionAssetFilenamesForSave().includes('outside.jpg'));
    f.c.loadSensingEyeSessionAssets(); snapshots.push(f.snapshot());
    f.c.persistSensingEyeSessionAssets(); snapshots.push(f.snapshot());
    f.c.clearSensingEyeSessionAssets(); snapshots.push(f.snapshot());
    assert.deepEqual(Array.from(f.c.sensingEyeSessionAssetFilenamesForSave()), []);
    f.c.loadSensingEyeSessionAssets(); snapshots.push(f.snapshot());
    return snapshots;
  };
  assert.deepEqual(run(page), run(before));
});

test('asset list is not capped and each save snapshot is detached', () => {
  const f = attach(vm.createContext({}), page);
  for (let i = 0; i < 30; i++) f.c.rememberSensingEyeSessionAsset(`image-${i}.jpg`);
  const snapshot = f.c.sensingEyeSessionAssetFilenamesForSave();
  assert.equal(snapshot.length, 30);
  f.c.clearSensingEyeSessionAssets();
  assert.equal(snapshot.length, 30);
});

test('real asset owner retains failed saves and retries the frozen manifest', async () => {
  const f = saveFixture(), a = attach(f.c, page), fetch = f.c.fetch;
  f.c.rememberSensingEyeSessionAsset('z.jpg'); f.c.rememberSensingEyeSessionAsset('a.txt');
  f.c.fetch = async (...args) => { await fetch(...args); throw Error('reply lost'); };
  assert.equal((await f.c.disconnectRealtime()).status, 'error');
  assert.deepEqual(Array.from(f.c.sensingEyeSessionAssetFilenamesForSave()), ['a.txt', 'z.jpg']);
  assert.ok(a.snapshot().stored.length);
  f.c.rememberSensingEyeSessionAsset('later.jpg');
  f.c.fetch = fetch;
  assert.equal((await f.c.disconnectRealtime()).status, 'ok');
  assert.deepEqual(f.requests[0], f.requests[1]);
  assert.deepEqual(f.requests[0].sensing_eye_filenames, ['a.txt', 'z.jpg']);
  assert.deepEqual(Array.from(f.c.sensingEyeSessionAssetFilenamesForSave()), []);
  assert.deepEqual(a.snapshot().stored, []);
});

test('late save receipt cannot clear replacement-session assets with the real owner', async () => {
  const f = saveFixture(); attach(f.c, page);
  const gate = deferred(), fetch = f.c.fetch;
  f.c.rememberSensingEyeSessionAsset('old.jpg');
  f.c.fetch = async (...args) => { const reply = await fetch(...args); await gate.promise; return reply; };
  const pending = f.c.disconnectRealtime();
  await settle(); f.fireTimer(12000);
  assert.equal((await pending).status, 'error');
  f.c.realtimeSessionGeneration += 1;
  f.c.clearSensingEyeSessionAssets(); f.c.rememberSensingEyeSessionAsset('new.jpg');
  gate.resolve(); await settle();
  assert.deepEqual(Array.from(f.c.sensingEyeSessionAssetFilenamesForSave()), ['new.jpg']);
});

test('save flush registers an asset before decode and keeps it through a timed-out flush', async () => {
  const f = saveFixture(); attach(f.c, page);
  f.c.sensingEyeGeneration = 1;
  const decode = deferred();
  f.c.fetchSensingEyeInboxItem = async () => ({ saved_filename: 'capture.jpg' });
  f.c.applySensingEyeInboxItem = () => decode.promise;
  require('./helpers/sts_tool_harness.cjs').loadFunctions(f.c, ['flushSensingEyeInboxForSessionSave']);
  const pending = f.c.disconnectRealtime();
  await settle(); f.fireTimer(16000);
  assert.equal((await pending).status, 'error');
  assert.deepEqual(Array.from(f.c.sensingEyeSessionAssetFilenamesForSave()), ['capture.jpg']);
  f.c.fetchSensingEyeInboxItem = async () => null;
  assert.equal((await f.c.disconnectRealtime()).status, 'ok');
  assert.deepEqual(f.requests[0].sensing_eye_filenames, ['capture.jpg']);
  decode.resolve(); await settle();
  assert.equal(f.requests.length, 1);
});

test('asset extraction changes only delegation in existing page functions', () => {
  const { names, normalizeAssetAccess } = require('./helpers/sts_eye_assets_owner.cjs');
  for (const match of before.matchAll(/^    (?:async )?function (\w+)\(/gm)) {
    assert.equal(normalizeAssetAccess(extract(page, match[1])), extract(before, match[1]), match[1]);
  }
  assert.doesNotMatch(page, /\bsensingEyeSessionAssetFilenames\b/);
  const module = fs.readFileSync(`${__dirname}/../web/sts/sensing-eye-assets.js`, 'utf8').replace(/\r\n/g, '\n');
  const normalized = module.replaceAll('a.filenameFromPath(', 'filenameFromPath(')
    .replaceAll('a.storage()', 'sessionStorage').replaceAll('a.storageKey', 'sensingEyeSessionAssetStorageKey')
    .replaceAll('filenames', 'sensingEyeSessionAssetFilenames');
  for (const name of names) assert.equal(extract(normalized, name), extract(before, name), name);
});

test('shipped asset owner keeps instances separate and exposes no mutable collection', () => {
  const { create } = require('../web/sts/sensing-eye-assets.js');
  const options = { filenameFromPath: x => x, storage: () => { throw Error('denied'); }, storageKey: key };
  const a = create(options), b = create(options);
  a.remember('a.jpg');
  assert.deepEqual(a.filenames(), ['a.jpg']); assert.deepEqual(b.filenames(), []);
  a.filenames().push('outside.jpg'); assert.deepEqual(a.filenames(), ['a.jpg']);
  assert.deepEqual(Object.keys(a).sort(), ['clear', 'filenames', 'load', 'persist', 'remember']);
  a.clear(); assert.deepEqual(a.filenames(), []);
});

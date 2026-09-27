const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const vm = require('node:vm');
const { test } = require('node:test');
const { extract } = require('./helpers/sts_completion_harness.cjs');
const { installEyePersistence } = require('./helpers/sts_eye_persistence_owner.cjs');
const baseline = '7ff12f5';
const read = name => fs.readFileSync(`${__dirname}/../web/sts/${name}`, 'utf8').replace(/\r\n/g, '\n');
const before = name => cp.execFileSync('git', ['show', `${baseline}:web/sts/${name}`], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
const original = before('index.html'), page = read('index.html');
const tick = () => new Promise(setImmediate);
const plain = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function fixture(source, options = {}) {
  const trace = [], assets = [], requests = [];
  const c = vm.createContext({
    URL, location: { href: 'http://localhost:8790/sts/' }, events: {},
    sensingEyeGeneration: 3, sensingEyeClientId: 'fixture-client',
    sensingEyeInboxLastSeq: 5, sensingEyeInboxIgnoreSeqThrough: 7, handledSensingEyeInboxSeqs: new Set(['5']),
    sensingEyeMemoryContext: () => {
      trace.push(['context']);
      if (options.contextError) throw Error('context failed');
      return { last_user_text: 'Look at this', nearby_transcript: 'context before save' };
    },
    rememberSensingEyeSessionAsset: name => {
      trace.push(['asset', name]);
      if (options.assetError) throw Error('asset failed');
      assets.push(name);
    },
    log: (_events, message) => trace.push(['log', message]),
    fetch: (url, init) => {
      trace.push(['request', url.href, init]);
      if (options.fetchThrows) throw Error('synchronous fetch failure');
      const request = { fetch: deferred(), json: deferred() };
      requests.push(request);
      return request.fetch.promise;
    },
  });
  for (const key of ['sensingEyeInboxLastSeq', 'sensingEyeInboxIgnoreSeqThrough']) {
    let value = c[key];
    Object.defineProperty(c, key, { get: () => value, set: next => { value = next; trace.push([key, next]); } });
  }
  installEyePersistence(c, source);
  for (const name of ['saveSensingEyeTextNote', 'saveSensingEyeVisualNote']) vm.runInContext(extract(source, name), c);
  const save = (kind, args) => c[kind === 'text' ? 'saveSensingEyeTextNote' : 'saveSensingEyeVisualNote'](args)
    .then(result => ({ result }), error => ({ error: error.message }));
  const snapshot = () => plain({ generation: c.sensingEyeGeneration, last: c.sensingEyeInboxLastSeq,
    ignore: c.sensingEyeInboxIgnoreSeqThrough, handled: [...c.handledSensingEyeInboxSeqs], assets, trace });
  const response = request => ({ ok: !options.httpError, status: options.httpError ? 503 : 200,
    statusText: options.httpError ? 'Unavailable' : 'OK',
    json: () => { trace.push(['json']); return request.json.promise; } });
  return { c, trace, requests, save, snapshot, response };
}

async function run(source, kind, options = {}) {
  const f = fixture(source, options);
  const args = options.noArgs ? undefined : options.nullArgs ? null : {
    [kind === 'text' ? 'content' : 'dataUrl']: kind === 'text' ? 'A note\nsecond line' : 'data:image/jpeg;base64,ABC',
    ...options.args,
  };
  if (options.badUrl) f.c.location.href = 'not a URL';
  const pending = f.save(kind, args);
  const checkpoints = [f.snapshot()];
  await tick();
  const mutate = phase => {
    if (options.staleAt === phase) {
      f.c.sensingEyeGeneration++;
      f.c.sensingEyeClientId = 'replacement-client';
      f.c.sensingEyeInboxLastSeq = 100;
      f.c.sensingEyeInboxIgnoreSeqThrough = 101;
      f.trace.push(['cleared/reconnected']);
    }
  };
  if (f.requests.length) {
    const request = f.requests[0];
    mutate('fetch');
    request.fetch.resolve(options.networkError ? Promise.reject(Error('offline')) : f.response(request));
    await tick();
    checkpoints.push(f.snapshot());
    if (!options.networkError) {
      mutate('json');
      request.json.resolve(options.jsonError ? Promise.reject(Error('invalid JSON'))
        : Object.hasOwn(options, 'result') ? options.result
          : { status: 'ok', seq: 12, saved_filename: 'retained-note.jpg', saved_url: '/sensing-eye/retained-note.jpg' });
    }
  }
  const outcome = await pending;
  return plain({ checkpoints, outcome, final: f.snapshot() });
}

const cases = [
  ['defaults', {}],
  ['no arguments', { noArgs: true }],
  ['null arguments', { nullArgs: true }],
  ['empty inputs', { args: { content: '', dataUrl: '' } }],
  ['false inputs', { args: { content: false, dataUrl: 0 } }],
  ['coerced inputs', { args: { content: 42, dataUrl: 42 } }],
  ['whitespace is retained', { args: { content: ' ', dataUrl: ' ' } }],
  ['custom metadata', { args: { name: 'my note.txt', source: 'browser camera', reason: 'keep', memoryContext: { tag: '\u03bb' } } }],
  ['false metadata', { args: { name: '', source: null, reason: 0 } }],
  ['non-object context falls back', { args: { memoryContext: 'not an object' } }],
  ['array context is preserved', { args: { memoryContext: ['existing behavior'] } }],
  ['context failure rejects outside transport catch', { contextError: true }],
  ['bad URL', { badUrl: true }],
  ['network failure', { networkError: true }],
  ['synchronous fetch failure', { fetchThrows: true }],
  ['HTTP failure', { httpError: true }],
  ['provider failure', { result: { status: 'error', error: 'disk unavailable', seq: 99 } }],
  ['unparseable JSON', { jsonError: true }],
  ['null JSON', { result: null }],
  ['empty receipt', { result: {} }],
  ['asset registration failure', { assetError: true }],
  ['clear/reconnect during fetch', { staleAt: 'fetch' }],
  ['clear/reconnect during JSON', { staleAt: 'json' }],
  ['numeric string sequence', { result: { status: 'ok', seq: '19', saved_filename: 'nineteen.jpg' } }],
  ['lower sequence', { result: { status: 'ok', seq: 2, saved_filename: 'two.jpg' } }],
  ['non-numeric sequence', { result: { status: 'ok', seq: 'bad', saved_filename: 'no-seq.jpg' } }],
];

for (const kind of ['text', 'visual']) {
  for (const [name, options] of cases) {
    test(`eye persistence preserves ${kind}: ${name}`, async () => {
      assert.deepEqual(await run(page, kind, options), await run(original, kind, options));
    });
  }
}

test('stale visual receipts suppress inbox echo without joining the new session; text has no inbox effects', async () => {
  for (const kind of ['text', 'visual']) {
    const { outcome, final } = await run(page, kind, { staleAt: 'json' });
    assert.equal(outcome.result.saved_filename, 'retained-note.jpg');
    assert.equal(final.last, 100);
    assert.equal(final.ignore, 101);
    assert.deepEqual(final.assets, []);
    assert.equal(final.handled.includes('12'), kind === 'visual');
    const request = final.trace.find(row => row[0] === 'request');
    const body = JSON.parse(request[2].body);
    if (kind === 'visual') {
      assert.equal(body.client_eye_generation, 3);
      assert.equal(body.client_id, 'fixture-client');
    } else {
      assert.equal(body.client_eye_generation, undefined);
    }
  }
});

async function concurrent(source) {
  const f = fixture(source), checkpoints = [];
  const old = f.save('visual', { dataUrl: 'old image' });
  f.c.sensingEyeGeneration++;
  const fresh = f.save('visual', { dataUrl: 'new image' });
  const text = f.save('text', { content: 'new text' });
  for (const request of f.requests) request.fetch.resolve(f.response(request));
  await tick();
  for (const i of [1, 0, 2]) {
    f.requests[i].json.resolve({ status: 'ok', seq: [12, 14, 99][i], saved_filename: ['old.jpg', 'new.jpg', 'new.txt'][i] });
    await tick();
    checkpoints.push(f.snapshot());
  }
  return plain({ outcomes: [await old, await fresh, await text], checkpoints, final: f.snapshot() });
}

test('out-of-order visual/text saves keep monotonic cursors and independent session ownership', async () => {
  const actual = await concurrent(page);
  assert.deepEqual(actual, await concurrent(original));
  assert.equal(actual.final.last, 14);
  assert.equal(actual.final.ignore, 14);
  assert.deepEqual(actual.final.assets, ['new.jpg', 'new.txt']);
  assert.deepEqual(actual.final.handled, ['5', '14', '12']);
});

test('eye save extraction leaves staging, clear, lookup, context and decisions byte-for-byte unchanged', () => {
  for (const name of ['setVisionImageFromDrawable', 'setSensingTextContent', 'clearSensingEyeState',
    'stageVisionImage', 'selectSensingEyeImage', 'fetchSensingEyeFilePage', 'sensingEyeMemoryContext',
    'rememberSensingEyeSessionAsset', 'pollSensingEyeInbox', 'applySensingEyeInboxItem',
    'buildSessionInstructions', 'handleFunctionCall', 'triggerIdlePonder', 'generateImage',
    'createGeneratedImageHandoff', 'moveGeneratedImageToSensingEye']) {
    assert.equal(extract(page, name), extract(original, name), name);
  }
  for (const name of ['generated-preview.js', 'image-request.js', 'generated-image-handoff.js', 'idle-art.js']) {
    assert.equal(read(name), before(name), name);
  }
});

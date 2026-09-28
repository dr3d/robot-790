const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const vm = require('node:vm');
const { test } = require('node:test');
const { extract } = require('./helpers/sts_completion_harness.cjs');
const { installEyeContent } = require('./helpers/sts_eye_content_owner.cjs');
const baseline = '8786837';
const original = cp.execFileSync('git', ['show', `${baseline}:web/sts/index.html`], { encoding: 'utf8', maxBuffer: 4e6 }).replace(/\r\n/g, '\n');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');
const plain = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const fields = ['sensingEyeGeneration', 'sensingEyeInboxClearInFlight', 'visionImageUrl', 'visionImageName',
  'visionImageStaged', 'visionImageOpenUrl', 'sensingTextContent', 'sensingTextName', 'sensingTextOpenUrl', 'sensingTextSavedFilename'];

function fixture(source, options = {}) {
  const trace = [], saves = [], clears = [];
  const effect = name => (...args) => trace.push([name, ...args]);
  const element = name => ({
    src: 'old-image', value: 'old-file', textContent: 'old hint',
    classList: { add: effect(`${name}.add`), remove: effect(`${name}.remove`) },
    removeAttribute(key) { trace.push([`${name}.removeAttribute`, key]); delete this[key]; },
  });
  const save = kind => args => {
    trace.push([`save.${kind}`, args]);
    const pending = deferred(); saves.push({ kind, pending }); return pending.promise;
  };
  const clear = kind => () => {
    trace.push([`clear.${kind}`]);
    const pending = deferred(); clears.push({ kind, pending }); return pending.promise;
  };
  const c = vm.createContext({
    URL, location: { href: 'http://localhost:8790/sts/' }, events: {},
    sensingEyeGeneration: 3, sensingEyeInboxClearInFlight: false,
    visionImageUrl: 'old-image', visionImageName: 'old.jpg', visionImageStaged: true, visionImageOpenUrl: 'old-url',
    sensingTextContent: '', sensingTextName: '', sensingTextOpenUrl: '', sensingTextSavedFilename: '',
    visionPreview: element('preview'), visionDrop: element('drop'), visionHint: element('hint'), visionFile: element('file'),
    contextPanel: { open: Boolean(options.contextOpen) },
    document: { createElement: type => {
      trace.push(['createElement', type]);
      const ctx = { fillRect: effect('fillRect'), drawImage: effect('drawImage') };
      return { getContext: type => { trace.push(['getContext', type]); return ctx; },
        toDataURL(type, quality) { trace.push(['encode', this.width, this.height, ctx.fillStyle, type, quality]); return 'new-image'; } };
    } },
    visionMaxEdgePx: 1024, visionJpegQuality: 0.9, maxSensingTextChars: 20,
    audioRecordingActive: () => Boolean(options.recording),
    audioRecordingCurrentVisualCover: args => { trace.push(['cover', args]); return { image: 'old-cover' }; },
    sensingEyeMemoryContext: () => { trace.push(['memory']); return { text: 'nearby context' }; },
    saveSensingEyeVisualNote: save('image'), saveSensingEyeTextNote: save('text'),
    clearSensingEyeInboxOnServer: clear('inbox'), clearBrowserFaceCaptureQueue: clear('face'),
    rememberSensingEyeImage: item => { trace.push(['history.image', item]); return options.noHistory ? null : { ...item, id: 'eye-1' }; },
    rememberSensingEyeText: item => { trace.push(['history.text', item]); return options.noHistory ? null : { ...item, id: 'text-1' }; },
    updateVisionButtons: effect('buttons'), updateSessionTools: effect('tools'), renderContextMap: effect('context'),
    log: (_events, text) => trace.push(['log', text]), recordUiEvent: effect('event'),
    addSensingEyeVisualNoteTranscriptMarker: effect('marker'), rolloverAudioRecordingForVisualChange: effect('rollover'),
    scheduleIdlePonder: effect('idle'), approximateTextTokens: text => Math.ceil(text.length / 4),
  });
  c.stageVisionImage = () => { trace.push(['stage']); c.visionImageStaged = true; };
  c.sensingInputLabel = () => c.visionImageName || c.sensingTextName || 'none';
  for (const key of fields) {
    let value = c[key];
    Object.defineProperty(c, key, { enumerable: true, configurable: true,
      get: () => value, set: next => { value = next; trace.push([key, next]); } });
  }
  installEyeContent(c, source);
  for (const name of ['requireCurrentSensingEyeLoad', 'setVisionImageFromDrawable', 'setSensingTextContent', 'clearSensingEyeState']) {
    vm.runInContext(extract(source, name), c);
  }
  const settle = promise => promise.then(result => ({ result }), error => ({ error: error.message }));
  const load = (kind, args = {}) => settle(kind === 'image'
    ? c.setVisionImageFromDrawable(options.drawable || { width: 2048, height: 1000 }, options.name, args)
    : c.setSensingTextContent(options.raw ?? '  First\r\nsecond  ', options.name, args));
  const snapshot = () => plain({ state: Object.fromEntries(fields.map(key => [key, c[key]])),
    preview: c.visionPreview.src, file: c.visionFile.value, hint: c.visionHint.textContent, trace });
  const finishSave = (i = 0, value = { saved_url: '/saved/new.jpg', saved_filename: 'saved/new.jpg' }) => saves[i].pending.resolve(value);
  const finishClear = (start = 0, fail = '') => {
    for (const item of clears.slice(start)) item.pending.resolve(item.kind === fail
      ? Promise.reject(Error(`${fail} offline`)) : { latest_seq: item.kind === 'inbox' ? 9 : 10 });
  };
  return { c, trace, saves, clears, load, settle, snapshot, finishSave, finishClear };
}

async function scenario(source, kind, options = {}) {
  const f = fixture(source, options);
  let current = !options.superseded;
  const args = { ...options.args, ...(options.guard ? { isCurrent: () => current } : {}) };
  const pending = f.load(kind, args);
  const states = [f.snapshot()];
  if (f.saves.length) {
    if (options.clear) {
      const clearing = f.settle(f.c.clearSensingEyeState({ source: options.clear, reason: 'test clear' }));
      states.push(f.snapshot()); f.finishClear(); await clearing;
    }
    if (options.replace) {
      await f.load(kind === 'image' ? 'text' : 'image', { saveToFilesystem: false });
      current = false;
    }
    if (options.rejectSave) f.finishSave(0, Promise.reject(Error('save threw')));
    else f.finishSave(0, options.noReceipt ? null : undefined);
  }
  const result = await pending;
  states.push(f.snapshot());
  return plain({ result, states });
}

for (const kind of ['image', 'text']) {
  const cases = {
    default: {}, explicit: { contextOpen: true, recording: true, name: 'chosen', args: {
      source: 'tool', reason: 'look', transcriptAction: 'recalled', openUrl: '/fallback', savedFilename: 'explicit', memoryContext: {} } },
    unsaved: { args: { saveToFilesystem: false, openUrl: '/open', savedFilename: 'saved', autoStage: false } },
    noReceipt: { noReceipt: true }, noHistory: { noHistory: true }, saveError: { rejectSave: true },
    oldGeneration: { args: { eyeGeneration: 2 } }, alreadySuperseded: { guard: true, superseded: true },
    uiClear: { clear: 'ui' }, reconnect: { clear: 'session_connect' },
    guardedReplacement: { guard: true, replace: true },
    // Ordinary concurrent operator loads still follow completion order; no new cancellation policy.
    unguardedReplacement: { replace: true },
    emptyName: { name: '' }, clipped: { raw: 'x'.repeat(21), contextOpen: true },
  };
  if (kind === 'image') Object.assign(cases, {
    invalidDimensions: { drawable: {} }, video: { drawable: { videoWidth: 640, videoHeight: 360 } },
    tiny: { drawable: { naturalWidth: 1, naturalHeight: 10000 } },
  });
  else Object.assign(cases, { empty: { raw: '  \r\n  ' }, coerce: { raw: 123 }, nullContext: { args: { memoryContext: null } } });
  for (const [name, options] of Object.entries(cases)) test(`eye content ${kind}: ${name} matches ${baseline}`, async () => {
    const expected = await scenario(original, kind, options);
    const actual = await scenario(page, kind, options);
    assert.deepEqual(actual, expected);
    if (['uiClear', 'reconnect', 'oldGeneration'].includes(name)) assert.match(actual.result.error, /canceled/);
    if (name === 'guardedReplacement') assert.match(actual.result.error, /superseded/);
  });
}

for (const source of ['ui', 'tool', 'session_connect']) {
  for (const fail of ['', 'inbox', 'face']) test(`eye clear ${source}/${fail || 'ok'} matches ${baseline}`, async () => {
    const run = async page => {
      const f = fixture(page, { contextOpen: true });
      const pending = f.settle(f.c.clearSensingEyeState({ source, reason: 'r'.repeat(150) }));
      const immediate = f.snapshot(); f.finishClear(0, fail);
      return plain({ immediate, result: await pending, final: f.snapshot() });
    };
    assert.deepEqual(await run(page), await run(original));
  });
}

test('stale clear cannot unlock a newer clear or report its failure', async () => {
  const run = async page => {
    const f = fixture(page), states = [];
    const first = f.settle(f.c.clearSensingEyeState({ source: 'session_connect' }));
    const second = f.settle(f.c.clearSensingEyeState());
    f.finishClear(0, 'inbox');
    const results = await Promise.all([first, second]);
    states.push(f.snapshot());
    return plain({ results, states });
  };
  assert.deepEqual(await run(page), await run(original));
  const f = fixture(page);
  const first = f.c.clearSensingEyeState(), second = f.c.clearSensingEyeState();
  f.clears[0].pending.resolve({}); f.clears[1].pending.resolve(null); await first;
  assert.equal(f.c.sensingEyeInboxClearInFlight, true);
  f.finishClear(2); await second;
  assert.equal(f.c.sensingEyeInboxClearInFlight, false);
});

test('out-of-order operator saves retain existing completion ordering', async () => {
  const run = async page => {
    const f = fixture(page), first = f.load('image'), second = f.load('text');
    f.finishSave(1); await second;
    const middle = f.snapshot(); f.finishSave(0); await first;
    return { middle, final: f.snapshot() };
  };
  assert.deepEqual(await run(page), await run(original));
});

test('page wrappers return the owner promises without another async hop', () => {
  const f = fixture(page);
  const promise = Promise.resolve('receipt');
  for (const [wrapper, method, args] of [
    ['setVisionImageFromDrawable', 'setImage', [{ width: 1, height: 1 }, 'image']],
    ['setSensingTextContent', 'setText', ['text', 'note']],
    ['clearSensingEyeState', 'clear', [{}]],
  ]) {
    f.c.sensingEyeContent[method] = () => promise;
    assert.equal(f.c[wrapper](...args), promise);
  }
});

test('eye extraction leaves retrieval, camera lifetime, staging and model behavior untouched', () => {
  for (const name of ['selectSensingEyeImage', 'fetchSensingEyeFilePage', 'prepareVisionImage', 'prepareSensingText',
    'stageVisionImage', 'clearVisionImage', 'clearSensingEye', 'startVisionCamera', 'stopVisionCamera',
    'pollSensingEyeInbox', 'applySensingEyeInboxItem', 'rememberSensingEyeImage', 'rememberSensingEyeText',
    'buildSessionInstructions', 'triggerIdlePonder', 'handleFunctionCall', 'generateImage', 'moveGeneratedImageToSensingEye']) {
    assert.equal(extract(page, name), extract(original, name), name);
  }
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const vm = require('node:vm');
const { test } = require('node:test');
const { extract } = require('./helpers/sts_completion_harness.cjs');
const { installEyeContent } = require('./helpers/sts_eye_content_owner.cjs');
const before = cp.execFileSync('git', ['show', '3823d81:web/sts/index.html'], { encoding: 'utf8', maxBuffer: 4e6 }).replace(/\r\n/g, '\n');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');
const fields = ['sensingEyeGeneration', 'sensingEyeInboxClearInFlight', 'visionImageUrl', 'visionImageName',
  'visionImageStaged', 'visionImageOpenUrl', 'sensingTextContent', 'sensingTextName', 'sensingTextOpenUrl', 'sensingTextSavedFilename'];
const plain = x => JSON.parse(JSON.stringify(x));

function fixture(source, options = {}) {
  const trace = [], state = () => Object.fromEntries(fields.map(key => [key, c[key]]));
  const effect = name => (...args) => trace.push([name, ...args, state()]);
  const item = { id: 'eye-1', dataUrl: 'data:retained', name: 'retained.jpg', openUrl: '/retained', savedFilename: 'retained.jpg',
    width: 40, height: 20, source: 'operator', ...options.item };
  const c = vm.createContext({
    sensingEyeGeneration: 2, sensingEyeInboxClearInFlight: false,
    visionImageUrl: options.empty ? '' : 'data:before', visionImageName: 'before.jpg',
    visionImageStaged: Boolean(options.staged), visionImageOpenUrl: '/before',
    sensingTextContent: '', sensingTextName: '', sensingTextOpenUrl: '', sensingTextSavedFilename: '',
    sensingEyeImageHistory: [item], sensingEyeTextHistory: [],
    realtimeConnected: () => !options.disconnected,
    currentSensingEyeHistoryItem: () => item,
    send: event => { effect('send')(event); if (options.sendError) throw Error('socket failed'); },
    visionPreview: { classList: { add: effect('preview.add') } },
    visionDrop: { classList: { remove: effect('drop.remove') } }, visionHint: { textContent: '' },
    updateVisionButtons: effect('buttons'), updateSessionTools: effect('tools'), scheduleIdlePonder: effect('idle'),
    addSensingEyeVisualNoteTranscriptMarker: effect('marker'), log: (_events, value) => effect('log')(value), events: {},
    rememberSensingEyeSessionAsset: effect('asset'), recordUiEvent: effect('event'),
    currentPromptContextModeKey: () => 'normal', renderMemory: effect('memory'),
    contextPanel: { open: true }, renderContextMap: effect('context'),
    chooseSensingEyeNote: items => items[0],
  });
  installEyeContent(c, source);
  for (const name of ['requireCurrentSensingEyeLoad', 'stageVisionImage', 'beginRealtimeSession', 'selectSensingEyeImage']) {
    vm.runInContext(extract(source, name), c);
  }
  c.sensingEyeLookupItems = async () => {
    if (options.mutation === 'clear') c.sensingEyeGeneration++;
    if (options.mutation === 'replace') c.visionImageUrl = 'data:replacement';
    return { images: options.noMatch ? [] : [{ ...item, location: 'session', kind: 'image' }] };
  };
  const snapshot = () => plain({ state: state(), trace, hint: c.visionHint.textContent, preview: c.visionPreview.src });
  return { c, snapshot };
}

for (const [name, options] of Object.entries({
  normal: {}, disconnected: { disconnected: true }, empty: { empty: true }, staged: { staged: true },
  sendFailure: { sendError: true },
})) test(`eye state staging ${name} matches 3823d81`, () => {
  const run = source => {
    const f = fixture(source, options);
    let error = '';
    try { f.c.stageVisionImage(); f.c.stageVisionImage(); } catch (e) { error = e.message; }
    return { error, ...f.snapshot() };
  };
  assert.deepEqual(run(page), run(before));
});

for (const [name, options] of Object.entries({
  normal: {}, disconnected: { disconnected: true }, defaults: { item: { name: '', openUrl: '', width: 0, savedFilename: '' } },
  noMatch: { noMatch: true }, cleared: { mutation: 'clear' }, replaced: { mutation: 'replace' },
})) test(`eye state retained recall ${name} matches 3823d81`, async () => {
  const run = async source => {
    const f = fixture(source, options);
    let result, error;
    try { result = await f.c.selectSensingEyeImage({ image_id: 'eye-1' }); } catch (e) { error = e.message; }
    return plain({ result, error, ...f.snapshot() });
  };
  assert.deepEqual(await run(page), await run(before));
});

test('begin session resets staging without discarding eye content, then permits one fresh stage', () => {
  const run = source => {
    const f = fixture(source, { staged: true });
    f.c.beginRealtimeSession(); f.c.stageVisionImage(); f.c.stageVisionImage();
    return f.snapshot();
  };
  const actual = run(page);
  assert.deepEqual(actual, run(before));
  assert.equal(actual.trace.filter(row => row[0] === 'send').length, 1);
  assert.equal(actual.state.visionImageUrl, 'data:before');
});

// These tests use the shipped module intact, without the VM state-seeding hook.
const eyeModule = require('../web/sts/sensing-eye-content.js');
function publicFixture() {
  const effects = [], clears = [];
  const effect = name => (...args) => effects.push([name, ...args]);
  const element = () => ({ value: '', classList: { add() {}, remove() {} }, removeAttribute() {} });
  const ui = { visionFile: element(), visionPreview: element(), visionDrop: element(), visionHint: element() };
  const a = {
    ui: () => ui, sensingInputLabel: () => 'fixture',
    sensingEyeMemoryContext: () => ({}), rememberSensingEyeText: item => item,
    approximateTextTokens: text => Math.ceil(text.length / 4), maxSensingTextChars: 1000,
    updateVisionButtons: effect('buttons'), updateSessionTools: effect('tools'),
    log: effect('log'), recordUiEvent: effect('event'),
    addSensingEyeVisualNoteTranscriptMarker: effect('marker'), scheduleIdlePonder: effect('idle'),
    clearSensingEyeInboxOnServer: () => new Promise(resolve => clears.push(resolve)),
    clearBrowserFaceCaptureQueue: async () => null,
  };
  return { a, effects, clears, owner: eyeModule.create(a) };
}

test('shipped eye owner initializes without effects and has getter-only private state', () => {
  const { fields } = require('./helpers/sts_eye_content_owner.cjs');
  const f = publicFixture();
  assert.deepEqual(f.effects, []);
  for (const [legacy, field] of Object.entries(fields)) {
    const descriptor = Object.getOwnPropertyDescriptor(f.owner, field);
    assert.equal(typeof descriptor.get, 'function', field);
    assert.equal(descriptor.set, undefined, field);
    assert.equal(Reflect.set(f.owner, field, 'outside write'), false, field);
    assert.equal(Object.hasOwn(f.owner, legacy), false, legacy);
  }
  assert.equal(f.owner.generation, 0);
  assert.equal(f.owner.clearInFlight, false);
  assert.equal(f.owner.imageUrl, '');
  assert.equal(f.owner.imageStaged, false);
  assert.equal(f.owner.text, '');
});

test('shipped eye owners do not share state; recall and reset do not save, stage, or announce', async () => {
  const f = publicFixture(), other = publicFixture();
  await f.owner.setText(' old text ', 'old.txt', { saveToFilesystem: false, openUrl: '/old', savedFilename: 'old.txt' });
  f.effects.length = 0;
  const item = { dataUrl: 'data:image', name: 'retained', openUrl: '/retained' };
  f.owner.restoreImage(item);
  item.name = 'mutated caller';
  assert.equal(f.owner.imageName, 'retained');
  assert.equal(f.owner.imageOpenUrl, '/retained');
  for (const field of ['text', 'textName', 'textOpenUrl', 'textSavedFilename']) assert.equal(f.owner[field], '');
  assert.equal(f.owner.imageStaged, false);
  f.owner.markStaged();
  assert.equal(f.owner.imageStaged, true);
  f.owner.resetStaging();
  assert.equal(f.owner.imageStaged, false);
  assert.equal(f.owner.imageUrl, 'data:image');
  assert.equal(f.owner.generation, 0);
  assert.equal(other.owner.imageUrl, '');
  assert.deepEqual(f.effects, []);
});

test('shipped owner Clear cancels a pending load and an older Clear cannot release a newer one', async () => {
  const f = publicFixture();
  let finishSave;
  f.a.saveSensingEyeTextNote = () => new Promise(resolve => { finishSave = resolve; });
  const pending = f.owner.setText('late', 'late.txt');
  const rejected = assert.rejects(pending, /Sensing-eye load canceled/);
  const first = f.owner.clear(), second = f.owner.clear();
  assert.equal(f.owner.generation, 2);
  f.clears[0]({ latest_seq: 1 }); await first;
  assert.equal(f.owner.clearInFlight, true);
  finishSave({ saved_filename: 'late.txt' }); await rejected;
  assert.equal(f.owner.text, '');
  f.clears[1]({ latest_seq: 2 }); await second;
  assert.equal(f.owner.clearInFlight, false);
});

test('all existing page functions retain their behavior after only eye access substitutions', () => {
  const { normalizeEyeAccess, fields } = require('./helpers/sts_eye_content_owner.cjs');
  for (const match of before.matchAll(/^    (?:async )?function (\w+)\(/gm)) {
    const name = match[1];
    if (name === 'createSensingEyeContent') continue;
    assert.equal(normalizeEyeAccess(extract(page, name)), extract(before, name), name);
  }
  for (const name of Object.keys(fields)) assert.doesNotMatch(page, new RegExp(`\\b${name}\\b`));
  assert.doesNotMatch(page, /sensingEyeContent\.\w+\s*=(?!=)/);
  const source = fs.readFileSync(`${__dirname}/../web/sts/sensing-eye-content.js`, 'utf8').replace(/\r\n/g, '\n');
  const original = cp.execFileSync('git', ['show', '3823d81:web/sts/sensing-eye-content.js'], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
  for (const name of ['requireCurrent', 'setImage', 'setText', 'clear']) assert.equal(extract(source, name), extract(original, name), name);
});

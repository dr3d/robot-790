const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const vm = require('node:vm');
const { test } = require('node:test');
const { extract } = require('./helpers/sts_completion_harness.cjs');
const baseline = 'df44692';
const before = cp.execFileSync('git', ['show', `${baseline}:web/sts/index.html`], { encoding: 'utf8', maxBuffer: 4e6 }).replace(/\r\n/g, '\n');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');
const names = ['rememberSensingEyeImage', 'rememberSensingEyeText', 'sensingEyeImageHistoryList',
  'sensingEyeTextHistoryList', 'sensingEyeImageHistoryContextLine', 'currentSensingEyeHistoryItem'];
const plain = value => JSON.parse(JSON.stringify(value));

function fixture(source, options = {}) {
  const trace = [];
  let tick = 0;
  const c = vm.createContext({
    Date: class extends Date { constructor() { super(1700000000000 + tick++); } },
    sensingEyeImageHistory: [], sensingEyeImageHistorySeq: 0, sensingEyeTextHistory: [], sensingEyeTextHistorySeq: 0,
    maxSensingEyeImageHistory: 5, sensingEyeContent: { imageUrl: '', text: '' },
    filenameFromPath: value => String(value || '').split(/[\\/]/).pop(),
    sensingEyeMemoryContext: () => { trace.push(['context']); if (options.contextError) throw Error('context failed');
      return { last_user_text: ' nearby user ', nearby_transcript: ' nearby conversation ' }; },
    contextPanel: { open: !!options.open }, renderContextMap: () => trace.push(['render']),
  });
  if (source.includes('function createSensingEyeHistory(')) require('./helpers/sts_eye_history_owner.cjs').installEyeHistory(c, source);
  for (const name of names) vm.runInContext(extract(source, name), c);
  const snapshot = () => plain({ images: c.sensingEyeImageHistory, texts: c.sensingEyeTextHistory,
    imageSeq: c.sensingEyeImageHistorySeq, textSeq: c.sensingEyeTextHistorySeq,
    imageRows: c.sensingEyeImageHistoryList(), textRows: c.sensingEyeTextHistoryList(),
    context: c.sensingEyeImageHistoryContextLine(), current: c.currentSensingEyeHistoryItem(), trace });
  return { c, snapshot };
}

for (const kind of ['Image', 'Text']) {
  for (const [name, options] of Object.entries({
    defaults: {}, empty: { args: {} }, null: { args: null },
    metadata: { open: true, args: { name: 'folder/thing', source: 'my_source', openUrl: '/open', savedFilename: 'saved',
      width: '20', height: 'bad', memoryContext: { last_user_text: ' user ', nearby_transcript: ' dialogue ' } } },
    noContext: { args: { memoryContext: {} } }, arrayContext: { args: { memoryContext: [] } },
    invalidContext: { args: { memoryContext: 'no' } }, contextError: { contextError: true },
    coercion: { args: { name: 0, source: 0, width: -1, height: Infinity, openUrl: 42, savedFilename: false } },
    sourceClip: { args: { source: 'a_'.repeat(60) } },
  })) test(`eye history ${kind}/${name} matches ${baseline}`, () => {
    const run = source => {
      const f = fixture(source, options);
      let result, error;
      const args = name === 'empty' || name === 'null' ? options.args
        : { dataUrl: 'data:image', content: '  untrimmed text  ', ...options.args };
      try { result = f.c[`rememberSensingEye${kind}`](args); } catch (e) { error = e.message; }
      return plain({ result, error, ...f.snapshot() });
    };
    assert.deepEqual(run(page), run(before));
  });
}

test('history preserves independent caps, IDs, deduplication, metadata and current rows', () => {
  const run = source => {
    const f = fixture(source, { open: true }), snapshots = [];
    for (let i = 0; i < 7; i++) {
      f.c.rememberSensingEyeImage({ dataUrl: `image-${i}`, name: 'same name' });
      f.c.rememberSensingEyeText({ content: `text-${i}`, name: 'same name' });
    }
    snapshots.push(f.snapshot());
    f.c.sensingEyeContent.imageUrl = 'image-3'; f.c.sensingEyeContent.text = 'text-5';
    snapshots.push(f.snapshot());
    const image = f.c.rememberSensingEyeImage({ dataUrl: 'image-3', name: 'new metadata' });
    const text = f.c.rememberSensingEyeText({ content: 'text-5', name: 'new text metadata' });
    snapshots.push(f.snapshot());
    assert.equal(f.c.currentSensingEyeHistoryItem(), image);
    assert.equal(image.id, 'eye-8'); assert.equal(text.id, 'eye-text-8');
    assert.equal(f.c.sensingEyeImageHistory.length, 5); assert.equal(f.c.sensingEyeTextHistory.length, 5);
    const rows = f.c.sensingEyeImageHistoryList(); rows[0].name = 'external catalogue edit';
    assert.equal(image.name, 'new metadata');
    return snapshots;
  };
  assert.deepEqual(run(page), run(before));
});

test('empty history and current content without history retain their existing summaries', () => {
  const run = source => {
    const f = fixture(source), snapshots = [f.snapshot()];
    f.c.sensingEyeContent.imageUrl = 'not retained';
    snapshots.push(f.snapshot());
    return snapshots;
  };
  assert.deepEqual(run(page), run(before));
});

test('shipped history owner keeps arrays private, instances separate and lookup identity intact', () => {
  const { create } = require('../web/sts/sensing-eye-history.js');
  let changed = 0;
  const a = { limit: 5, filenameFromPath: x => x, memoryContext: () => ({}),
    imageUrl: () => 'image', text: () => 'text', changed: () => changed++ };
  const owner = create(a), other = create(a);
  const image = owner.rememberImage({ dataUrl: 'image', name: 'image' });
  const text = owner.rememberText({ content: 'text', name: 'text' });
  assert.equal(owner.imageFor('image'), image);
  assert.equal(owner.imageById(image.id), image);
  assert.equal(owner.textById(text.id), text);
  assert.equal(owner.imageIndex(image), 0);
  assert.equal(owner.imageIndex({ ...image }), -1);
  assert.equal(owner.imageFor('missing'), null);
  assert.equal(owner.imageById('missing'), undefined);
  assert.equal(owner.textById('missing'), undefined);
  assert.equal(other.imageCount, 0); assert.equal(other.textCount, 0);
  for (const key of ['images', 'texts', 'imageSeq', 'textSeq']) assert.equal(Object.hasOwn(owner, key), false);
  assert.equal(Reflect.set(owner, 'imageCount', 99), false);
  assert.equal(changed, 2);
  const list = owner.imageList(); list.pop();
  assert.equal(owner.imageCount, 1);
  assert.equal(owner.imageList()[0].current, true);
  assert.equal(owner.textList()[0].current, true);
});

test('history extraction leaves existing page functions unchanged except explicit owner access', () => {
  const { normalizeHistoryAccess } = require('./helpers/sts_eye_history_owner.cjs');
  for (const match of before.matchAll(/^    (?:async )?function (\w+)\(/gm)) {
    assert.equal(normalizeHistoryAccess(extract(page, match[1])), extract(before, match[1]), match[1]);
  }
  assert.doesNotMatch(page, /\b(?:sensingEyeImageHistory|sensingEyeTextHistory|sensingEyeImageHistorySeq|sensingEyeTextHistorySeq)\b/);
  const source = fs.readFileSync(`${__dirname}/../web/sts/sensing-eye-history.js`, 'utf8').replace(/\r\n/g, '\n');
  // Verify the extracted bodies themselves, not just delegation wrappers.
  let normalized = source.replaceAll('a.filenameFromPath(', 'filenameFromPath(')
    .replaceAll('a.memoryContext()', 'sensingEyeMemoryContext()')
    .replaceAll('a.changed();', 'if (contextPanel?.open) renderContextMap();')
    .replaceAll('a.imageUrl()', 'sensingEyeContent.imageUrl').replaceAll('a.text()', 'sensingEyeContent.text')
    .replaceAll('a.limit', 'maxSensingEyeImageHistory');
  for (const [field, old] of Object.entries({ images: 'sensingEyeImageHistory', texts: 'sensingEyeTextHistory',
    imageSeq: 'sensingEyeImageHistorySeq', textSeq: 'sensingEyeTextHistorySeq' })) normalized = normalized.replaceAll(`s.${field}`, old);
  for (const name of names.filter(n => n !== 'currentSensingEyeHistoryItem')) assert.equal(extract(normalized, name), extract(before, name), name);
});

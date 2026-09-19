const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

function setup(filenames) {
  const removed = [];
  const context = vm.createContext({
    loadedNoteContexts: filenames.map(filename => ({ filename })),
    unpinLoadedNoteContext: filename => { removed.push(filename); return true; },
  });
  for (const name of ['noteLookupKey', 'resolveLoadedNoteFilename', 'unpinNote']) {
    const start = page.indexOf(`    function ${name}(`);
    const end = page.indexOf('\n    }\n', start);
    vm.runInContext(page.slice(start, end + 6), context);
  }
  return { context, removed };
}

test('unknown Unicode and punctuation-only names cannot unpin an unrelated note', () => {
  const { context, removed } = setup(['\u65e5\u672c.txt', '\u4e2d\u6587.txt', 'notes/hello.txt']);
  for (const filename of ['\u4e0d\u660e', '???', '!!!/hello', 'missing/hello']) {
    assert.equal(context.unpinNote({ filename }).status, 'error');
  }
  assert.deepEqual(removed, []);
});

test('ambiguous normalized names return a bounded choice and never unpin', () => {
  const filenames = Array.from({ length: 12 }, (_, i) => `folder${i}/same-name.txt`);
  const { context, removed } = setup(filenames);
  const result = context.unpinNote({ filename: 'same name' });
  assert.equal(result.status, 'error');
  assert.match(result.error, /Multiple pinned notes/);
  assert.match(result.error, /exact filename/);
  assert.deepEqual(removed, []);
  assert.equal(context.unpinNote({ filename: filenames[9] }).filename, filenames[9]);
});

test('exact paths win; Unicode marks and familiar separators stay usable', () => {
  const { context, removed } = setup([
    'setup-cards/fun-act.txt', 'setup-cards/fun_act.txt',
    'notes/caf\u00e9.txt', 'notes/\u0915.txt', 'notes/\u0915\u093f.txt',
  ]);
  assert.equal(context.unpinNote({ filename: 'setup-cards/fun-act.txt' }).status, 'ok');
  assert.equal(context.unpinNote({ filename: 'fun act' }).status, 'error');
  assert.equal(context.unpinNote({ filename: 'cafe\u0301' }).filename, 'notes/caf\u00e9.txt');
  assert.equal(context.unpinNote({ filename: '\u0915\u093f' }).filename, 'notes/\u0915\u093f.txt');
  assert.deepEqual(removed, ['setup-cards/fun-act.txt', 'notes/caf\u00e9.txt', 'notes/\u0915\u093f.txt']);
});

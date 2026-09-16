const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');
function fixture() {
  const storage = new Map();
  const c = vm.createContext({
    llmMemoryTools: { checked: true }, memoryStorageKey: 'facts', maxMemoryNameChars: 48,
    maxMemoryFactChars: 320, maxMemoryFacts: 80, recentAssistantOutputs: [], renderMemory() {},
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  });
  for (const name of ['normalizeMemoryName', 'normalizeMemoryFact', 'memoryFactsFromParsedStorage',
    'loadMemoryFacts', 'saveMemoryFacts', 'rememberMemoryFact', 'forgetMemoryFact', 'noteAssistantText']) {
    const start = page.indexOf('    function ' + name + '('), end = page.indexOf('\n    }\n', start);
    assert.ok(start >= 0 && end > start, name);
    vm.runInContext(page.slice(start, end + 6), c);
  }
  return { c, storage };
}
test('memory capability is independent of English words, stale prose and assistant offers', () => {
  const { c } = fixture();
  for (const text of ['Remember this', 'Do not remember this', 'Recuerda esto', '覚えてください']) {
    c.lastUserText = text;
    c.rememberMemoryFact({ name: 'topic', fact: 'A model-selected fact' });
  }
  c.llmMemoryTools.checked = false;
  c.noteAssistantText('Would you like me to remember this?');
  assert.throws(() => c.rememberMemoryFact({ name: 'topic', fact: 'no' }), /disabled/);
  assert.throws(() => c.forgetMemoryFact({ name: 'topic' }), /disabled/);
  assert.equal(c.loadMemoryFacts()[0].fact, 'A model-selected fact');
});
test('Unicode names remain distinct; replacement and removal retain prior storage', () => {
  const { c, storage } = fixture();
  c.rememberMemoryFact({ name: '月', fact: 'Moon' });
  c.rememberMemoryFact({ name: '星', fact: 'Star' });
  assert.equal(c.loadMemoryFacts().length, 2);
  c.rememberMemoryFact({ name: '月', fact: 'Revised moon' });
  c.forgetMemoryFact({ name: '月' });
  assert.equal(c.loadMemoryFacts()[0].name, '星');
  const history = JSON.parse(storage.get('facts.history'));
  assert.match(history.at(-1).value, /Revised moon/);
  assert.match(history.at(-2).value, /Moon/);
});
test('words cannot directly actuate the robot or arm write permission', () => {
  for (const name of ['maybeHandleDirectFaceCommand', 'memoryWriteAllowed', 'noteFileWriteAllowed',
    'assistantArmedMemorySave', 'userExplicitlyAskedToForget', 'memoryFactAppearsInUserEvidence']) {
    assert.ok(!page.includes('function ' + name + '('), name);
  }
});

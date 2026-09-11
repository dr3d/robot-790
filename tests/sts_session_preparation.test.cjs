const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const page = fs.readFileSync(path.join(__dirname, '../web/sts/index.html'), 'utf8').replace(/\r\n/g, '\n');

function load(names, globals) {
  const context = vm.createContext(globals);
  for (const name of names) {
    const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    const end = page.indexOf('\n    }\n', start);
    assert.notEqual(start, -1);
    vm.runInContext(page.slice(start, end + 6), context);
  }
  return context;
}

test('preparation lease is acquired, renewed and released with one connection identity', async () => {
  const calls = [];
  let heartbeat;
  const c = load(['pauseSessionPreparation', 'releaseSessionPreparation'], {
    preparationActivityId: '', preparationActivityTimer: null,
    sendPreparationActivity: async (id, active) => { calls.push({ id, active }); },
    setInterval: (fn, delay) => { heartbeat = fn; assert.equal(delay, 30000); return 5; },
    clearInterval: id => assert.equal(id, 5),
    events: {}, log: () => {},
  });
  await c.pauseSessionPreparation();
  heartbeat();
  c.releaseSessionPreparation();
  assert.deepEqual(calls.map(call => call.active), [true, true, false]);
  assert.equal(new Set(calls.map(call => call.id)).size, 1);
  assert.equal(c.preparationActivityId, '');
  assert.equal(c.preparationActivityTimer, null);
});

test('failed preparation pause does not start a heartbeat', async () => {
  const c = load(['pauseSessionPreparation'], {
    preparationActivityId: '', preparationActivityTimer: null,
    sendPreparationActivity: async () => { throw new Error('still stopping'); },
    setInterval: () => assert.fail('must not start'),
  });
  await assert.rejects(c.pauseSessionPreparation(), /still stopping/);
});

test('Connect waits for preparation before creating the realtime socket and releases on failure/close', () => {
  const start = page.indexOf('    async function connect({');
  const end = page.indexOf('    async function restartRealtimeServer()', start);
  const connect = page.slice(start, end);
  assert.ok(connect.indexOf('await pauseSessionPreparation()') < connect.indexOf('new WebSocket('));
  assert.match(connect, /catch \(error\) \{\s*releaseSessionPreparation\(\)/);
  assert.match(connect, /socket.addEventListener\("close", \(\) => \{\s*if \(ws !== socket[^\n]+\n\s*releaseSessionPreparation/);
});

test('session picker refreshes pending titles and stops polling after preparation', async () => {
  const timers = [];
  const cleared = [];
  let sessions = [{ filename: 'sessions/session-20260910-105458-357.txt', preparation: { state: 'running' } }];
  const c = load(['fetchContinuitySessions'], {
    continuitySessionRefreshTimer: null, continuitySessions: [], URL,
    location: { href: 'http://localhost:8790/' },
    fetch: async () => ({ ok: true, json: async () => ({ sessions }) }),
    renderContinuitySessionSelect: () => {},
    clearTimeout: id => cleared.push(id),
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    events: {}, log: () => {},
  });
  await c.fetchContinuitySessions();
  assert.equal(timers[0].ms, 3000);
  sessions = [{ ...sessions[0], title: 'Gesture comparison', preparation: { state: 'ready' } }];
  await c.fetchContinuitySessions();
  assert.equal(c.continuitySessions[0].title, 'Gesture comparison');
  assert.equal(c.continuitySessionRefreshTimer, null);
  assert.equal(timers.length, 1);
  assert.deepEqual(cleared, [null, 1]);
});

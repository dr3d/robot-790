const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync(path.join(__dirname, '../web/sts/session-map.html'), 'utf8').replace(/\r\n/g, '\n');

function fixture(confirmed, result = { status: 'ok', archived_session_count: 2, archived_sensing_eye_asset_count: 1 }) {
  const requests = [], statuses = [];
  const plan = { session_filename: 'sessions/root.txt', fingerprint: 'confirmed-plan', sessions: [], session_count: 2 };
  const c = vm.createContext({
    URL, location: { href: 'http://localhost:8790/session-map.html' }, archiveBusy: false,
    selectedSession: () => ({ filename: 'sessions/root.txt' }),
    apiJson: async (url, options) => { requests.push(JSON.parse(options.body)); return requests.length === 1 ? plan : result; },
    confirmBranchArchive: async received => { assert.equal(received, plan); return confirmed; },
    setStatus: text => statuses.push(text), postToSts: () => {}, refreshSessions: async () => {}, loadDetails: () => {},
  });
  const start = page.indexOf('    async function archiveBranchSelected(');
  const end = page.indexOf('\n    }\n', start);
  vm.runInContext(page.slice(start, end + 6), c);
  return { c, requests, statuses };
}

test('canceling branch preview never sends an archive request', async () => {
  const { c, requests } = fixture(false);
  await c.archiveBranchSelected();
  assert.deepEqual(requests, [{ session_filename: 'sessions/root.txt', preview: true }]);
  assert.equal(c.archiveBusy, false);
});

test('branch confirmation sends the server snapshot, not a freshly selected UI node', async () => {
  const { c, requests } = fixture(true);
  await c.archiveBranchSelected();
  assert.deepEqual(requests[1], { session_filename: 'sessions/root.txt', fingerprint: 'confirmed-plan' });
  assert.equal(c.archiveBusy, false);
});

test('partial archive is visible and the controls recover', async () => {
  const { c, statuses } = fixture(true, { status: 'partial', archived_session_count: 1, error: 'disk unavailable' });
  await c.archiveBranchSelected();
  assert.match(statuses.at(-1), /Archived 1 sessions; disk unavailable/);
  assert.equal(c.archiveBusy, false);
});

test('failed preview releases the busy state', async () => {
  const { c } = fixture(true);
  c.apiJson = async () => { throw new Error('not available'); };
  await assert.rejects(c.archiveBranchSelected(), /not available/);
  assert.equal(c.archiveBusy, false);
});

test('an archive already in progress cannot start another branch operation', async () => {
  const { c, requests } = fixture(true);
  c.archiveBusy = true;
  await c.archiveBranchSelected();
  assert.equal(requests.length, 0);
});

test('preview dialog has a scrollable roster, safe default, and an explicit final action', () => {
  assert.match(page, /\.archive-dialog ul\s*\{[^}]*max-height: 45dvh;[^}]*overflow: auto;/);
  assert.match(page, /cancel.autofocus = true/);
  assert.match(page, /confirm.disabled = !plan.allowed/);
  assert.match(page, /dialog.returnValue === "archive"/);
  assert.match(page, /for \(const item of plan.sessions\)/);
});

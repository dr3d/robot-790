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

function singleFixture(confirmed) {
  const requests = [], confirmations = [], notices = [];
  const selected = { filename: 'sessions/one.txt', title: 'One session', created: '2026-09-13T11:00:00-04:00' };
  const c = vm.createContext({
    URL, location: { href: 'http://localhost:8790/session-map.html' }, archiveBusy: false,
    sessions: [selected, { filename: 'sessions/child.txt' }], selectedFilename: selected.filename,
    selectedSession: () => selected,
    confirmBranchArchive: async (plan, options) => { confirmations.push({plan,options}); return confirmed; },
    apiJson: async (url, options) => { requests.push({url:String(url),body:JSON.parse(options.body)}); return { status:'ok' }; },
    setStatus: () => {}, postToSts: value => notices.push(value), refreshSessions: async () => {}, loadDetails: () => {},
  });
  const start = page.indexOf('    async function archiveSelected(');
  const end = page.indexOf('\n    }\n', start);
  vm.runInContext(page.slice(start, end + 6), c);
  return {c,selected,requests,confirmations,notices};
}

test('single archive uses the in-page dialog and cancel sends no mutation', async () => {
  const {c,requests,confirmations,notices} = singleFixture(false);
  await c.archiveSelected();
  assert.equal(confirmations[0].options.single, true);
  assert.equal(confirmations[0].plan.sessions.length, 1);
  assert.equal(confirmations[0].plan.allowed, true);
  assert.equal(requests.length, 0);
  assert.equal(notices.length, 0);
  assert.equal(c.archiveBusy, false);
});

test('single archive submits the originally confirmed session, not a later selection', async () => {
  const {c,requests} = singleFixture(true);
  c.confirmBranchArchive = async () => {
    c.selectedSession = () => ({filename:'sessions/child.txt'});
    return true;
  };
  await c.archiveSelected();
  assert.deepEqual(requests, [{url:'http://localhost:8790/api/continuity/archive',body:{session_filename:'sessions/one.txt'}}]);
  assert.equal(c.archiveBusy, false);
});

test('single archive blocks a second operation while its dialog is open', async () => {
  const {c,requests} = singleFixture(true);
  let release;
  c.confirmBranchArchive = () => new Promise(resolve => {release=resolve;});
  const pending = c.archiveSelected();
  assert.equal(c.archiveBusy, true);
  await c.archiveSelected();
  assert.equal(requests.length, 0);
  release(false);
  await pending;
  assert.equal(c.archiveBusy, false);
});

test('single archive failure releases controls without sending refresh', async () => {
  const {c,notices} = singleFixture(true);
  c.apiJson = async () => {throw Error('archive unavailable');};
  await assert.rejects(c.archiveSelected(), /archive unavailable/);
  assert.equal(c.archiveBusy, false);
  assert.equal(notices.length, 0);
});

test('single dialog warns that descendants remain and cannot archive the last session', async () => {
  const {c,confirmations} = singleFixture(false);
  c.sessions.length = 1;
  await c.archiveSelected();
  assert.equal(confirmations[0].plan.allowed, false);
  assert.match(page, /its descendants stay in the map/);
  assert.match(page, /single \? "Archive session\?" : "Archive branch\?"/);
});

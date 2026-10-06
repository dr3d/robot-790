const { test } = require('node:test');
const assert = require('node:assert/strict');
const mic = require('../web/sts/brain2-mic.js');
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function track() {
  const calls = [];
  let echo = true;
  return { calls, readyState: 'live', getSettings: () => ({ echoCancellation: echo }),
    getConstraints: () => ({ deviceId: { exact: 'chosen-mic' }, channelCount: 1, noiseSuppression: true }),
    async applyConstraints(value) { calls.push(value); echo = value.echoCancellation.exact; } };
}
function fixture() {
  const state = { track: track(), listen: false }, reports = [], timers = new Map();
  let timerId = 0;
  const owner = mic.create({ getTrack: () => state.track, listenEnabled: () => state.listen,
    report: result => reports.push(result), setTimer: fn => { timers.set(++timerId, fn); return timerId; },
    clearTimer: id => timers.delete(id) });
  return { state, owner, reports, timers };
}

test('checked default keeps echo protection; unchecked speech disables it and restores after its tail', async () => {
  const { state, owner, timers } = fixture();
  assert.equal(owner.begin(), null);
  assert.equal(state.track.calls.length, 0);
  state.listen = true;
  const changing = owner.sync();
  assert.equal(owner.blocksInput(), true);
  await changing;
  assert.equal(state.track.getSettings().echoCancellation, false);
  assert.equal(owner.blocksInput(), false);
  assert.deepEqual(state.track.calls[0], { deviceId: { exact: 'chosen-mic' }, channelCount: 1,
    noiseSuppression: true, echoCancellation: { exact: false } });
  owner.end({ tailMs: 500 });
  assert.equal(state.track.getSettings().echoCancellation, false);
  [...timers.values()][0]();
  assert.equal(owner.blocksInput(), true);
  await settle();
  assert.equal(state.track.getSettings().echoCancellation, true);
  assert.equal(owner.blocksInput(), false);
});

test('cancel or rechecking restores protection without leaving a queued disable behind', async () => {
  for (const action of ['cancel', 'recheck']) {
    const { state, owner } = fixture();
    state.listen = true;
    owner.begin();
    if (action === 'cancel') owner.end();
    else { state.listen = false; owner.sync(); }
    await settle();
    assert.equal(state.track.getSettings().echoCancellation, true);
    assert.equal(owner.blocksInput(), false);
    assert.equal(state.track.calls.length, 0);
  }
});

test('an in-flight disable is followed by restore before microphone frames are released', async () => {
  const { state, owner } = fixture();
  const apply = state.track.applyConstraints.bind(state.track);
  let release;
  state.track.applyConstraints = async value => {
    if (!value.echoCancellation.exact) await new Promise(resolve => { release = resolve; });
    await apply(value);
  };
  state.listen = true;
  owner.begin(); await settle();
  owner.end();
  release(); await settle();
  assert.deepEqual(state.track.calls.map(value => value.echoCancellation.exact), [false, true]);
  assert.equal(owner.blocksInput(), false);
});

test('failure to disable echo cancellation is reported, not claimed as acoustic hearing', async () => {
  const { state, owner, reports } = fixture();
  state.track.applyConstraints = async () => {};
  state.listen = true;
  await owner.begin();
  assert.match(reports.at(-1).error, /Off was not confirmed/);
  assert.equal(reports.at(-1).echoCancellation, true);
  assert.equal(owner.blocksInput(), false);
});

test('failure to restore protection holds raw audio until the mic is replaced', async () => {
  const { state, owner, reports } = fixture();
  state.listen = true;
  await owner.begin();
  state.track.applyConstraints = async () => { throw new Error('device failed'); };
  owner.end(); await settle();
  assert.equal(owner.blocksInput(), true);
  assert.match(reports.at(-1).error, /device failed/);
  state.track = track();
  await owner.sync();
  assert.equal(owner.blocksInput(), false);
  assert.equal(state.track.getSettings().echoCancellation, true);
});

test('a replaced microphone is not changed by an old pending preparation', async () => {
  const { state, owner, reports } = fixture();
  const old = state.track;
  state.listen = true;
  owner.begin();
  owner.end();
  state.track = track();
  owner.sync(); await settle();
  assert.equal(old.calls.length, 0);
  assert.equal(state.track.calls.length, 0);
  assert.equal(reports.length, 0);
});

test('no microphone is safe, including speaker-only playback and stop', () => {
  const { state, owner } = fixture();
  state.track = undefined;
  state.listen = true;
  assert.equal(owner.begin(), null);
  owner.end();
  assert.equal(owner.blocksInput(), false);
});

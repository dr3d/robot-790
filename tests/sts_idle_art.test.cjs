const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Controller } = require('../web/sts/idle-art.js');

function setup() {
  const state = { connected: true, eligible: true, blocked: false, quietMs: 100000,
    minimumQuietMs: 90000, userKey: 'user1', eyeKey: 'eye1', mediaKey: 'image1' };
  const calls = [], shown = [], receipts = [];
  let count = 0;
  const controller = new Controller({
    api: async (action, payload) => {
      calls.push({ action, payload });
      return action === 'arm' ? { run_id: payload.run_id, token: 'token' }
        : { status: 'ok', filename: 'art.png', idle_art_job: 'job1' };
    }, context: () => ({ ...state }), deliver: async result => shown.push(result),
    receipt: row => receipts.push({ ...row }), id: () => `run${++count}`, now: () => 100000
  });
  return { controller, state, calls, shown, receipts };
}
const proposal = { prompt: 'A brass teacup observatory.', title: 'Tea stars' };

test('requires permission, quiet and free output; new ideas have no quota', async () => {
  const { controller: c, state, calls, shown } = setup();
  assert.equal(c.offer(proposal), false);
  await c.arm({});
  assert.equal(c.offer(proposal), true);
  state.blocked = true;
  await c.tick();
  state.blocked = false;
  state.quietMs = 100;
  await c.tick();
  assert.equal(calls.filter(x => x.action === 'render').length, 0);
  state.quietMs = 100000;
  await c.tick();
  await c.tick();
  assert.equal(shown.length, 1);
  assert.equal(c.offer(proposal), false);
  assert.equal(c.offer({ ...proposal, prompt: 'A tiny harbor inside a copper kettle.' }), true);
  await c.tick(); await c.tick();
  assert.equal(calls.filter(x => x.action === 'render').length, 2);
});

test('new user input drops a queued proposal without spending', async () => {
  const { controller: c, state, calls } = setup();
  await c.arm({}); c.offer(proposal); state.userKey = 'user2';
  await c.tick();
  assert.equal(c.queued, null);
  assert.equal(c.history.length, 0);
  assert.equal(calls.filter(x => x.action === 'render').length, 0);
});

test('eye or preview replacement while rendering preserves new content', async () => {
  for (const field of ['eyeKey', 'mediaKey']) {
    const { controller: c, state, shown, receipts } = setup();
    await c.arm({}); c.offer(proposal); await c.tick();
    state[field] = 'operator replacement';
    await c.tick();
    assert.equal(shown.length, 0);
    assert.equal(receipts.at(-1).status, 'retained');
  }
});

test('disconnect/reset during generation cannot publish into a new session', async () => {
  const { controller: c, shown } = setup();
  await c.arm({});
  let finish;
  const oldApi = c.api;
  c.api = (action, payload) => action === 'render'
    ? new Promise(resolve => { finish = resolve; }) : oldApi(action, payload);
  c.offer(proposal);
  const pending = c.tick();
  const oldHistory = c.history;
  c.reset();
  finish({ status: 'ok', filename: 'late.png', idle_art_job: 'late' });
  await pending;
  await c.tick();
  assert.equal(shown.length, 0);
  assert.equal(c.history.length, 0);
  assert.equal(oldHistory[0].filename, 'late.png');
});

test('failed generation never automatically retries, but permits new ideas', async () => {
  const { controller: c } = setup();
  await c.arm({});
  c.api = async () => { throw new Error('timeout'); };
  c.offer(proposal); await c.tick(); await c.tick();
  assert.equal(c.history[0].status, 'failed');
  assert.equal(c.offer(proposal), false);
  assert.equal(c.offer({ ...proposal, prompt: 'A copper kettle harbor.' }), true);
});

test('permission response arriving after disarm is revoked, never rearmed', async () => {
  const { controller: c, calls } = setup();
  let finish;
  c.api = async (action, payload) => {
    calls.push({ action, payload });
    if (action === 'arm') return new Promise(resolve => { finish = resolve; });
    return {};
  };
  const pending = c.arm({});
  c.disarm();
  finish({ run_id: c.runId, token: 'late' });
  assert.equal(await pending, false);
  assert.equal(c.grant, null);
  assert.equal(calls.at(-1).action, 'revoke');
});

test('disarm/rearm while display is finishing does not permanently block the queue', async () => {
  const { controller: c } = setup();
  await c.arm({}); c.offer(proposal); await c.tick();
  let finish;
  c.deliver = () => new Promise(resolve => { finish = resolve; });
  const delivering = c.tick();
  c.disarm(); await c.arm({});
  finish(); await delivering;
  assert.equal(c.busy, false);
  assert.equal(c.offer({ ...proposal, prompt: 'A different picture.' }), true);
});

test('B1 uses the same grant without B2 and receives an artifact, not auto-staging', async () => {
  const { controller: c, state, calls, shown } = setup();
  state.proposalsEnabled = false;
  await assert.rejects(c.renderRequested(proposal), /permission/);
  await c.arm({});
  assert.equal(c.proposalContext(), null);
  const result = await c.renderRequested(proposal, { size: '1536x1024' });
  assert.equal(result.retained, false);
  assert.equal(result.filename, 'art.png');
  assert.equal(calls.at(-1).payload.size, '1536x1024');
  await c.tick();
  assert.equal(shown.length, 0, 'Eric decides whether to call the eye move');
  assert.equal(c.history.length, 1);
});

test('B1 and B2 cannot render concurrently; revocation/new activity retain late art only', async () => {
  for (const change of ['revoke', 'user', 'eye', 'reset']) {
    const { controller: c, state, shown } = setup();
    await c.arm({});
    let finish;
    c.api = action => action === 'render' ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({});
    const pending = c.renderRequested(proposal);
    assert.equal(c.proposalContext(), null);
    await assert.rejects(c.renderRequested(proposal), /already in progress/);
    if (change === 'revoke') c.disarm();
    if (change === 'user') state.userKey = 'new';
    if (change === 'eye') state.eyeKey = 'new';
    if (change === 'reset') c.reset();
    finish({ status: 'ok', filename: 'late.png', idle_art_job: 'job' });
    assert.equal((await pending).retained, true);
    assert.equal(shown.length, 0);
  }
});

test('runtime receipts are bounded without losing full session history', async () => {
  const { controller: c } = setup();
  c.history = Array.from({ length: 20 }, (_, i) => ({ prompt: 'private long prompt', title: `${i}`, status: 'complete' }));
  assert.equal(c.snapshot(6).jobs.length, 6);
  assert.equal(c.snapshot().jobs.length, 20);
  assert.equal(c.snapshot(6).attempts, 20);
  assert.equal(JSON.stringify(c.snapshot()).includes('private long prompt'), false);
});

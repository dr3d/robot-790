const assert = require('node:assert/strict');
const { test } = require('node:test');
const { fixture, loadFunctions } = require('./helpers/sts_tool_harness.cjs');

test('successful write forwards compact provider receipt, not content or operator prose', async () => {
  const f = fixture();
  f.c.executeTool = async () => ({ status: 'ok', filename: 'Trip plans.txt', characters: 1234, mode: 'append', content: 'PRIVATE BODY' });
  await f.tool('write_text_file', { filename: 'trip', content: 'PRIVATE BODY', mode: 'append' });
  const row = f.c.fileWriteReceipts[0];
  assert.equal(row.filename, 'Trip plans.txt');
  assert.equal(row.characters, 1234);
  assert.equal(row.mode, 'append');
  assert.equal(row.status, 'ok');
  assert.equal(row.session_generation, f.c.realtimeConnection.generation);
  assert.equal(row.call_id, 'call-1');
  assert.ok(Number.isFinite(Date.parse(row.at)));
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE BODY/);
  assert.equal(f.calls.length, 0); // overridden executor; no read-back or second tool
});

test('failed, malformed and denied writes never become successful receipts', async () => {
  const f = fixture();
  f.c.executeTool = async () => { throw new Error('Disk unavailable'); };
  await f.tool('write_text_file', { filename: 'draft.txt' });
  assert.equal(f.c.fileWriteReceipts[0].status, 'error');
  assert.equal(f.c.fileWriteReceipts[0].error, 'Disk unavailable');
  f.c.executeTool = async () => ({ filename: 'uncertain.txt' });
  await f.tool('write_text_file', { filename: 'uncertain.txt' });
  assert.equal(f.c.fileWriteReceipts[1].status, 'unknown');
  f.c.enabledToolList = () => [];
  await f.tool('write_text_file', { filename: 'denied.txt' });
  assert.equal(f.c.fileWriteReceipts[2].code, 'scope_denied');
  assert.equal(f.c.fileWriteReceipts[2].filename, 'denied.txt');
});

test('new user speech keeps the same-session write receipt; stale session completion drops it', async () => {
  for (const stale of [false, true]) {
    const f = fixture(); let finish;
    let active = true;
    f.c.activeRealtimeSession = () => active;
    f.c.executeTool = () => new Promise(resolve => { finish = resolve; });
    const pending = f.tool('write_text_file', { filename: 'later.txt', content: 'body' });
    f.c.lastUserTurnActivityAt++;
    if (stale) active = false;
    finish({ status: 'ok', filename: 'later.txt', characters: 4 });
    await pending;
    assert.equal(f.c.fileWriteReceipts.length, stale ? 0 : 1);
  }
});

test('stale failure also drops its receipt and repeated call id is not executed twice', async () => {
  const f = fixture(); let fail;
  let active = true;
  f.c.activeRealtimeSession = () => active;
  f.c.executeTool = () => new Promise((_, reject) => { fail = reject; });
  const pending = f.tool('write_text_file', { filename: 'old.txt' });
  active = false; fail(new Error('old failure')); await pending;
  assert.equal(f.c.fileWriteReceipts.length, 0);
  const g = fixture();
  await g.tool('write_text_file', { filename: 'one.txt' }, 'same');
  await g.tool('write_text_file', { filename: 'one.txt' }, 'same');
  assert.equal(g.calls.length, 1);
  assert.equal(g.c.fileWriteReceipts.length, 1);
});

test('receipt history is bounded metadata, not a limit on file writes', async () => {
  const f = fixture();
  for (let i = 0; i < 12; i++) await f.tool('write_text_file', { filename: `note-${i}.txt` });
  assert.equal(f.calls.length, 12);
  assert.equal(f.c.fileWriteReceipts.length, 8);
  assert.equal(f.c.fileWriteReceipts[0].call_id, 'call-5');
  loadFunctions(f.c, ['recordFileWriteReceipt']);
  f.c.recordFileWriteReceipt({ name: 'search_web' }, {}, { status: 'ok' }, { socket: f.c.ws, generation: 1 });
  assert.equal(f.c.fileWriteReceipts.length, 8);
});

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { create } = require('../web/sts/realtime-connection.js');
const { page, loadFunctions } = require('./helpers/sts_tool_harness.cjs');
const { saveFixture, installConnectionFixture, deferred } = require('./helpers/sts_save_harness.cjs');

function socket(readyState = 1) {
  return { readyState, packets: [], send(packet) { this.packets.push(packet); } };
}

test('close owns one cleanup promise and excludes transitions until settlement', async () => {
  const owner = create(), transport = socket(), gate = deferred();
  const generation = owner.adopt(transport);
  let calls = 0;
  const closing = owner.close(transport, generation, () => {
    calls++;
    assert.equal(owner.busy, true, 'ownership is published before effects');
    return gate.promise;
  });
  assert.equal(owner.stopped, true);
  assert.equal(owner.close(transport, generation, () => assert.fail('duplicate')), closing);
  await assert.rejects(owner.runTransition('connect', () => assert.fail('must not enter')), /cleanup/);
  gate.resolve();
  await closing;
  assert.equal(calls, 1);
  assert.equal(owner.busy, false);
  assert.equal(owner.close(transport, generation, () => assert.fail('completed duplicate')), closing);
  await owner.runTransition('retry', () => {});
});

test('close failure releases ownership and stale completion cannot release a newer close', async () => {
  const owner = create(), old = socket(), gate = deferred(), nextGate = deferred();
  const first = owner.close(old, owner.adopt(old), () => gate.promise);
  const next = socket(), generation = owner.adopt(next);
  const second = owner.close(next, generation, () => nextGate.promise);
  gate.resolve();
  await first;
  assert.equal(owner.closing, true);
  await owner.close(old, generation - 1, () => assert.fail('stale effect'));
  const rejected = assert.rejects(second, /fixture/);
  nextGate.reject(new Error('fixture'));
  await rejected;
  assert.equal(owner.busy, false);
  const fresh = socket();
  await assert.rejects(owner.close(fresh, owner.adopt(fresh), () => { throw new Error('sync fixture'); }), /sync fixture/);
  assert.equal(owner.busy, false);
});

test('connection identity preserves the old active/connected decisions and wire packets', () => {
  const event = { type: 'response.create', response: { modalities: ['audio', 'text'], instructions: 'Unchanged.' } };
  for (const stopped of [false, true]) {
    for (const readyState of [0, 1, 2, 3]) {
      for (const currentKind of ['none', 'same', 'different']) {
        for (const generation of [0, 1, 2]) {
          const candidate = socket(readyState), other = socket(readyState);
          const current = currentKind === 'none' ? undefined : currentKind === 'same' ? candidate : other;
          const owner = create();
          Object.assign(owner, { socket: current, generation: 1, stopped });
          // These are the pre-extraction page predicates, kept independent of the owner.
          const expectedActive = Boolean(!stopped && candidate && candidate === current
            && generation === 1 && candidate.readyState === 1);
          const expectedConnected = Boolean(!stopped && current && current.readyState === 1);
          assert.equal(owner.isActive(candidate, generation), expectedActive);
          assert.equal(owner.isConnected(), expectedConnected);
          owner.send(event, { socket: candidate, generation });
          assert.deepEqual(candidate.packets, expectedActive ? [JSON.stringify(event)] : []);
          assert.deepEqual(other.packets, []);
        }
      }
    }
  }
});

test('invalidation and adoption preserve the two existing generation boundaries', () => {
  const owner = create(), first = socket(), second = socket();
  assert.equal(owner.generation, 0);
  assert.equal(owner.isActive(), false);
  owner.invalidate();
  const firstGeneration = owner.adopt(first);
  assert.equal(firstGeneration, 2);
  assert.equal(owner.isActive(first, firstGeneration), true);
  owner.requestStop();
  owner.invalidate();
  assert.equal(owner.stopped, true, 'preparation alone must not resume a stopped session');
  assert.equal(owner.isCurrent(first, firstGeneration), false);
  const secondGeneration = owner.adopt(second);
  assert.equal(secondGeneration, 4);
  assert.equal(owner.stopped, false);
  owner.send({ type: 'old' }, { socket: first, generation: firstGeneration });
  owner.send({ type: 'new' });
  assert.deepEqual(first.packets, []);
  assert.deepEqual(second.packets.map(JSON.parse), [{ type: 'new' }]);
});

test('stop blocks work without losing identity needed for final transcription and close', () => {
  const owner = create(), current = socket();
  const generation = owner.adopt(current);
  owner.send({ type: 'response.cancel' });
  owner.requestStop();
  assert.equal(owner.isConnected(), false);
  assert.equal(owner.isCurrent(current, generation), true);
  assert.equal(owner.isActive(current, generation), false);
  owner.send({ type: 'response.create' });
  for (const state of [2, 3]) {
    current.readyState = state;
    assert.equal(owner.isCurrent(current, generation), true);
    assert.equal(owner.isActive(current, generation), false);
  }
  assert.deepEqual(current.packets.map(JSON.parse), [{ type: 'response.cancel' }]);
});

test('an older generation of the same socket is still stale', () => {
  const owner = create(), current = socket();
  const generation = owner.adopt(current);
  owner.invalidate();
  assert.equal(owner.isCurrent(current, generation), false);
  owner.send({ type: 'old' }, { socket: current, generation });
  assert.deepEqual(current.packets, []);
});

test('page has one connection state owner and keeps prompts out of the module', () => {
  assert.match(page, /<script src="realtime-connection.js"><\/script>/);
  assert.match(page, /const realtimeConnection = Robot790RealtimeConnection.create\(\);/);
  assert.doesNotMatch(page, /\b(?:let|const|var) (?:ws|realtimeSessionGeneration|realtimeStopRequested)\b/);
  assert.doesNotMatch(page, /realtimeConnection\.(?:socket|generation|stopped)\s*(?:=(?!=)|\+=|\+\+)/);
  const moduleText = require('node:fs').readFileSync(require.resolve('../web/sts/realtime-connection.js'), 'utf8');
  assert.doesNotMatch(moduleText, /setTimeout|fetch\(|localStorage|instructions:|new WebSocket|\.close\(/);
});

test('real page old open, close and error callbacks cannot affect a newly connected session', async () => {
  const f = saveFixture(), sockets = installConnectionFixture(f);
  await f.c.disconnectRealtime();
  await f.c.connect();
  const old = sockets[0];
  const newer = socket();
  f.c.realtimeConnection.adopt(newer);
  f.c.continuityParentForCurrentRun = 'sessions/newer.txt';
  const before = [...f.calls];
  old.listeners.open();
  old.listeners.close();
  old.listeners.error();
  assert.deepEqual(f.calls, before);
  assert.equal(f.c.realtimeConnection.socket, newer);
  assert.equal(f.c.continuityParentForCurrentRun, 'sessions/newer.txt');
});

test('real page stop path still accepts only the current socket final transcript', () => {
  const f = saveFixture(), accepted = [];
  const current = f.c.realtimeConnection.socket, generation = f.c.realtimeConnection.generation;
  Object.assign(f.c, {
    llmRunOverview: null, clearInputDraft() {}, performance: { now: () => 0 },
    recordUserTranscript: text => { accepted.push(text); return { accepted: true, index: 0 }; },
    rememberConversationProsody() {},
  });
  loadFunctions(f.c, ['handleEvent']);
  f.c.realtimeConnection.requestStop();
  const final = { type: 'conversation.item.input_audio_transcription.completed', transcript: 'Keep these final words.' };
  f.c.handleEvent(final, { socket: socket(), generation });
  f.c.handleEvent(final, { socket: current, generation: generation - 1 });
  assert.deepEqual(accepted, []);
  f.c.handleEvent(final, { socket: current, generation });
  assert.deepEqual(accepted, ['Keep these final words.']);
});

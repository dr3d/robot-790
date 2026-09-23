const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const { loadFunctions } = require('./helpers/sts_tool_harness.cjs');

function fixture() {
  let now = 1000;
  const timers = [], voices = [], displays = [], logs = [];
  const c = vm.createContext({
    Date: { now: () => now },
    brain2DeferredSurfaceMaxAgeMs: 90000,
    enabled: true, voiceReady: true, mouthReady: true, voiceAccepted: true,
    brain2MouthBrainEnabled: () => c.enabled,
    brain2VoiceCanSpeak: () => c.voiceReady,
    brain2MouthCanSurface: () => c.mouthReady,
    compressIdleMs: (ms, options) => Math.max(options.floorMs, ms),
    speakBrain2Monitor: text => { voices.push(text); return c.voiceAccepted; },
    surfaceBrain2MouthText: async (text, options) => { displays.push({ text, speak: options.speak }); },
    bumpBrain2Counter() {}, logBrain2: (kind, text) => logs.push({ kind, text }),
    setTimeout: (callback, ms) => { timers.push({ callback, ms, cleared: false }); return timers.length; },
    clearTimeout: id => { if (id) timers[id - 1].cleared = true; },
  });
  loadFunctions(c, ['deferBrain2Surface', 'scheduleBrain2Surface', 'maybeSurfaceDeferredBrain2', 'clearBrain2SurfaceTimer']);
  return { c, timers, voices, displays, logs, advance: ms => { now += ms; },
    pending: () => c.brain2Surface.pending,
    reset: () => c.brain2Surface.reset(),
    markVoiceHandled: () => c.brain2Surface.markVoiceHandled(),
    fire: async timer => { timer.callback(); await new Promise(setImmediate); },
  };
}

test('deferred B2 keeps its 1200ms retry and delivers mouth/voice once', async () => {
  const f = fixture();
  f.c.deferBrain2Surface('An aside.', 'busy');
  assert.equal(f.timers[0].ms, 1200);
  await f.fire(f.timers[0]);
  assert.deepEqual(f.voices, ['An aside.']);
  assert.deepEqual(f.displays, [{ text: 'An aside.', speak: false }]);
  assert.equal(f.pending(), null);
  await f.c.maybeSurfaceDeferredBrain2();
  assert.equal(f.displays.length, 1);
});

test('a captured canceled timer cannot deliver its replacement early', async () => {
  const f = fixture();
  f.c.deferBrain2Surface('Old.', 'busy');
  const old = f.timers[0];
  f.c.deferBrain2Surface('New.', 'busy');
  const current = f.timers[1];
  assert.equal(old.cleared, true);
  await f.fire(old);
  assert.equal(f.displays.length, 0);
  assert.equal(current.cleared, false);
  await f.fire(current);
  assert.deepEqual(f.voices, ['New.']);
});

test('stopping the timer invalidates its captured callback without dropping the held item', async () => {
  const f = fixture();
  f.c.deferBrain2Surface('Held.', 'busy');
  f.c.clearBrain2SurfaceTimer();
  await f.fire(f.timers[0]);
  assert.equal(f.displays.length, 0);
  assert.equal(f.pending().mouthText, 'Held.');
  f.c.scheduleBrain2Surface();
  await f.fire(f.timers[1]);
  assert.equal(f.displays.length, 1);
});

for (const change of ['stop', 'new session']) {
  test(`a held item cannot publish after ${change}`, async () => {
    const f = fixture();
    f.c.deferBrain2Surface('Old session.', 'busy');
    if (change === 'stop') f.c.realtimeConnection.requestStop();
    else f.c.realtimeConnection.invalidate();
    await f.fire(f.timers[0]);
    assert.equal(f.displays.length, 0);
    assert.equal(f.voices.length, 0);
    assert.equal(f.pending(), null);
  });
}

test('reset plus a new item cannot be disturbed by the old timer', async () => {
  const f = fixture();
  f.c.deferBrain2Surface('Before reset.', 'busy');
  const old = f.timers[0];
  f.reset();
  f.c.deferBrain2Surface('After reset.', 'busy');
  await f.fire(old);
  assert.equal(f.displays.length, 0);
  assert.equal(f.pending().mouthText, 'After reset.');
  await f.fire(f.timers[1]);
  assert.deepEqual(f.voices, ['After reset.']);
});

test('busy mouth retries while an already admitted voice is not replayed', async () => {
  const f = fixture();
  f.c.mouthReady = false;
  f.c.deferBrain2Surface('Once.', 'busy');
  await f.fire(f.timers[0]);
  await f.fire(f.timers[1]);
  assert.deepEqual(f.voices, ['Once.']);
  assert.equal(f.displays.length, 0);
  f.c.mouthReady = true;
  await f.fire(f.timers[2]);
  assert.deepEqual(f.displays, [{ text: 'Once.', speak: false }]);
});

test('rejected voice admission is not marked spoken', async () => {
  const f = fixture();
  f.c.voiceAccepted = false; f.c.mouthReady = false;
  f.c.deferBrain2Surface('Retry admission.', 'busy');
  await f.fire(f.timers[0]);
  assert.equal(f.pending().voiceSpoken, false);
  f.c.voiceAccepted = true; f.c.mouthReady = true;
  await f.fire(f.timers[1]);
  assert.equal(f.voices.length, 2);
  assert.deepEqual(f.displays, [{ text: 'Retry admission.', speak: false }]);
});

test('monitor disable can mark held voice handled while preserving mouth delivery', async () => {
  const f = fixture();
  f.c.deferBrain2Surface('Display only.', 'busy');
  f.markVoiceHandled();
  await f.fire(f.timers[0]);
  assert.deepEqual(f.voices, []);
  assert.deepEqual(f.displays, [{ text: 'Display only.', speak: false }]);
});

test('B2 disable drops the pending item with the existing log', async () => {
  const f = fixture();
  f.c.deferBrain2Surface('Held.', 'busy'); f.c.enabled = false;
  await f.fire(f.timers[0]);
  assert.equal(f.pending(), null);
  assert.equal(f.displays.length, 0);
  assert.ok(f.logs.some(x => x.kind === 'held dropped' && x.text === 'brain 2 off: Held.'));
});

for (const age of [90000, 90001]) {
  test(`existing expiry comparison at ${age}ms is preserved`, async () => {
    const f = fixture();
    f.c.deferBrain2Surface('Timed.', 'busy'); f.advance(age);
    await f.fire(f.timers[0]);
    assert.equal(f.displays.length, age === 90000 ? 1 : 0);
    assert.equal(f.logs.some(x => x.kind === 'held expired'), age > 90000);
  });
}

test('expiry still uses the lab-compressed age with the existing floor', async () => {
  const f = fixture();
  f.c.compressIdleMs = (ms, options) => {
    assert.equal(ms, 90000); assert.equal(options.floorMs, 15000);
    return 15000;
  };
  f.c.deferBrain2Surface('Fast lab.', 'busy'); f.advance(15001);
  await f.fire(f.timers[0]);
  assert.equal(f.displays.length, 0);
});

for (const change of ['replacement', 'reset', 'stop', 'new session', 'disabled']) {
  test(`a mouth request finishing after ${change} cannot publish or revive speech`, async () => {
    const f = fixture();
    let release;
    Object.assign(f.c, {
      voiceReady: false, brain2Speech: { revision: 0 },
      setMouthText: () => new Promise(resolve => { release = resolve; }),
      rememberBrain2Output: (kind, text) => f.displays.push({ kind, text }),
    });
    loadFunctions(f.c, ['surfaceBrain2MouthText']);
    f.c.deferBrain2Surface('In flight.', 'busy');
    const work = f.c.maybeSurfaceDeferredBrain2();
    if (change === 'replacement') f.c.deferBrain2Surface('Replacement.', 'busy');
    if (change === 'reset') f.reset();
    if (change === 'stop') f.c.realtimeConnection.requestStop();
    if (change === 'new session') f.c.realtimeConnection.invalidate();
    if (change === 'disabled') f.c.enabled = false;
    release(); await work;
    assert.equal(f.displays.length, 0);
    assert.equal(f.voices.length, 0);
    assert.equal(f.logs.some(x => x.kind === 'mouth'), false);
    if (change === 'replacement') assert.equal(f.pending().mouthText, 'Replacement.');
  });
}

test('a completed current mouth request retains normal logging and optional speech', async () => {
  const f = fixture();
  Object.assign(f.c, {
    voiceReady: false, brain2Speech: { revision: 0 }, setMouthText: async () => {},
    rememberBrain2Output: (kind, text) => f.displays.push({ kind, text }),
  });
  loadFunctions(f.c, ['surfaceBrain2MouthText']);
  f.c.deferBrain2Surface('Current.', 'busy');
  await f.c.maybeSurfaceDeferredBrain2();
  assert.deepEqual(f.displays, [{ kind: 'mouth', text: 'Current.' }]);
  assert.deepEqual(f.voices, ['Current.']);
});

test('a rejected mouth promise is logged once and does not clear a newer held item', async () => {
  const f = fixture();
  let reject;
  f.c.surfaceBrain2MouthText = () => new Promise((_, no) => { reject = no; });
  f.c.deferBrain2Surface('In flight.', 'busy');
  f.timers[0].callback();
  f.c.deferBrain2Surface('New.', 'busy');
  reject(new Error('Device unavailable'));
  await new Promise(setImmediate);
  assert.equal(f.logs.filter(x => x.kind === 'surface error').length, 1);
  assert.equal(f.pending().mouthText, 'New.');
});

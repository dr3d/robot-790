const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const { loadFunctions } = require('./helpers/sts_tool_harness.cjs');

function fixture() {
  const utterances = [], logs = [];
  let now = 1000, cancels = 0;
  const c = vm.createContext({
    Date: { now: () => now },
    window: { speechSynthesis: {
      speak: utterance => utterances.push(utterance),
      cancel: () => { cancels++; },
    } },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    Robot790Brain2Speech: require('../web/sts/brain2-speech.js'),
    brain2VoiceUnsupportedLogged: false, brain2VoiceMonitor: { checked: true },
    brain2MouthBrainEnabled: () => true,
    responseActive: false, audioBusy: false, userSpeechActive: false, userTurnPendingUntil: 0,
    outputAudioActive: () => c.audioBusy,
    selectedBrain2BrowserVoice: () => null,
    currentBrain2VoiceVolume: () => 40, currentBrain2VoicePace: () => 1.12,
    logBrain2: (kind, text) => logs.push({ kind, text }),
    log() {}, events: {}, bumpBrain2Counter() {}, rememberBrain2Output() {},
    setMouthText: async () => {},
    idlePendingUserTurnMs: 2000, compressIdleMs: ms => ms,
    clearIdleHardBrake() {}, noteConversationActivity() {}, captureCompletedAloneInterval() {},
    audioPlayback: { enqueue() {}, play: async () => {} }, b64ToBytes: () => new Uint8Array(2),
  });
  loadFunctions(c, ['brain2VoiceMonitorEnabled', 'browserSpeechAvailable', 'brain2VoiceCanSpeak',
    'speakBrain2Monitor', 'cancelBrain2MonitorSpeech', 'brain2MonitorAudioShouldMuteMic',
    'surfaceBrain2MouthText', 'userTurnPending', 'noteUserTurnActivity',
    'queueAudioDelta', 'playPcm16Bytes', 'createBrain2SpeechOwner']);
  c.brain2Speech = c.createBrain2SpeechOwner();
  return { c, utterances, logs, cancels: () => cancels, advance: ms => { now += ms; } };
}

for (const blocker of ['userSpeechActive', 'userTurnPendingUntil', 'responseActive', 'audioBusy']) {
  test(`monitor cannot queue during ${blocker}`, () => {
    const { c, utterances } = fixture();
    c[blocker] = blocker === 'userTurnPendingUntil' ? 3000 : true;
    c.speakBrain2Monitor('Private thought monitor.');
    assert.equal(utterances.length, 0);
  });

  test(`delayed monitor start rechecks ${blocker}`, () => {
    const f = fixture(), { c } = f;
    c.speakBrain2Monitor('Queued.');
    const before = f.cancels();
    c[blocker] = blocker === 'userTurnPendingUntil' ? 3000 : true;
    f.utterances[0].onstart();
    assert.equal(f.cancels(), before + 1);
    assert.equal(c.brain2MonitorAudioShouldMuteMic(), false);
    assert.equal(f.logs.some(item => item.kind === 'voice started'), false);
  });
}

test('late start/end/error of an old utterance cannot cancel or clear its replacement', () => {
  const f = fixture(), { c } = f;
  c.speakBrain2Monitor('Old.');
  const old = f.utterances[0];
  c.cancelBrain2MonitorSpeech();
  c.speakBrain2Monitor('Current.');
  f.utterances[1].onstart();
  const before = f.cancels();
  old.onstart(); old.onend(); old.onerror();
  assert.equal(f.cancels(), before);
  assert.equal(c.brain2MonitorAudioShouldMuteMic(), true);
});

test('human turn activity cancels queued voice and keeps it canceled after the turn', () => {
  const f = fixture(), { c } = f;
  c.speakBrain2Monitor('Queued.');
  const before = f.cancels();
  c.noteUserTurnActivity();
  assert.equal(f.cancels(), before + 1);
  f.advance(5000);
  f.utterances[0].onstart();
  assert.equal(c.brain2MonitorAudioShouldMuteMic(), false);
});

for (const adapter of ['queueAudioDelta', 'playPcm16Bytes']) {
  test(`${adapter} cancels monitor speech before B1 audio`, async () => {
    const f = fixture(), { c } = f;
    c.speakBrain2Monitor('Speaking.');
    f.utterances[0].onstart();
    const before = f.cancels();
    await c[adapter](new Uint8Array(2));
    assert.equal(f.cancels(), before + 1);
    assert.equal(c.brain2MonitorAudioShouldMuteMic(), false);
  });
}

test('delayed mouth display still completes but cannot speak across human activity', async () => {
  const f = fixture(), { c } = f;
  let release;
  c.setMouthText = () => new Promise(resolve => { release = resolve; });
  const pending = c.surfaceBrain2MouthText('An observation.');
  c.noteUserTurnActivity();
  f.advance(5000);
  release(); await pending;
  assert.equal(f.utterances.length, 0);
  assert.equal(f.logs.some(item => item.kind === 'mouth'), true);
});

test('normal monitor speech preserves voice settings and the 500ms mic echo tail', () => {
  const f = fixture(), { c } = f;
  c.speakBrain2Monitor('  A   thought.  ');
  const utterance = f.utterances[0];
  assert.equal(utterance.text, 'A thought.');
  assert.equal(utterance.volume, 0.4);
  assert.equal(utterance.rate, 1.12);
  assert.equal(utterance.pitch, 0.62);
  assert.equal(c.brain2MonitorAudioShouldMuteMic(), false);
  utterance.onstart();
  assert.equal(c.brain2MonitorAudioShouldMuteMic(), true);
  utterance.onend(); f.advance(499);
  assert.equal(c.brain2MonitorAudioShouldMuteMic(), true);
  f.advance(1);
  assert.equal(c.brain2MonitorAudioShouldMuteMic(), false);
});

for (const change of ['disabled', 'stopped', 'new session']) {
  test(`late start after ${change} cannot revive monitor speech`, () => {
    const f = fixture(), { c } = f;
    c.speakBrain2Monitor('Queued.');
    if (change === 'disabled') c.brain2VoiceMonitor.checked = false;
    if (change === 'stopped') c.realtimeConnection.requestStop();
    if (change === 'new session') c.realtimeConnection.invalidate();
    const before = f.cancels();
    f.utterances[0].onstart();
    assert.equal(f.cancels(), before + 1);
    assert.equal(c.brain2MonitorAudioShouldMuteMic(), false);
  });
}

for (const started of [false, true]) {
  test(`cancellation clears ${started ? 'active' : 'queued'} speech and ignores all later callbacks`, () => {
    const f = fixture(), { c } = f;
    c.speakBrain2Monitor('Cancel me.');
    const utterance = f.utterances[0];
    if (started) utterance.onstart();
    c.cancelBrain2MonitorSpeech();
    const before = f.cancels();
    utterance.onstart(); utterance.onend(); utterance.onerror();
    assert.equal(f.cancels(), before);
    assert.equal(c.brain2MonitorAudioShouldMuteMic(), false);
    c.cancelBrain2MonitorSpeech();
    assert.equal(f.cancels(), before, 'no unowned global browser cancel');
  });
}

test('canceled utterance callbacks delivered synchronously cannot resurrect mic muting', () => {
  const f = fixture(), { c } = f;
  c.speakBrain2Monitor('Old.');
  const old = f.utterances[0];
  c.window.speechSynthesis.cancel = () => { old.onstart(); old.onerror(); old.onend(); };
  assert.equal(c.speakBrain2Monitor('New.'), true);
  assert.equal(c.brain2MonitorAudioShouldMuteMic(), false);
  f.utterances[1].onstart();
  assert.equal(c.brain2MonitorAudioShouldMuteMic(), true);
});

test('browser cancellation changing permission is rechecked before dispatch', () => {
  const f = fixture(), { c } = f;
  c.speakBrain2Monitor('Old.');
  c.window.speechSynthesis.cancel = () => { c.userSpeechActive = true; };
  assert.equal(c.speakBrain2Monitor('New.'), false);
  assert.equal(f.utterances.length, 1);
});

test('failed browser dispatch leaves no active speech or mic mute', () => {
  const f = fixture(), { c } = f;
  c.window.speechSynthesis.speak = () => { throw new Error('Browser speech failed'); };
  assert.equal(c.speakBrain2Monitor('Try.'), false);
  assert.equal(c.brain2MonitorAudioShouldMuteMic(), false);
  assert.ok(f.logs.some(item => item.kind === 'voice error'));
});

test('unsupported browser is reported once and does not claim speech admission', () => {
  const f = fixture(), { c } = f;
  delete c.window.speechSynthesis;
  assert.equal(c.speakBrain2Monitor('One.'), false);
  assert.equal(c.speakBrain2Monitor('Two.'), false);
  assert.equal(f.logs.filter(item => item.kind === 'voice unsupported').length, 1);
});

test('manual voice test still works with B2 off, but cannot talk over a pending human turn', () => {
  const f = fixture(), { c } = f;
  c.brain2MouthBrainEnabled = () => false;
  assert.equal(c.speakBrain2Monitor('Automatic.'), false);
  assert.equal(c.speakBrain2Monitor('Test.', { kind: 'voice test' }), true);
  c.noteUserTurnActivity();
  assert.equal(c.speakBrain2Monitor('Test.', { kind: 'voice test' }), false);
});

test('a normal mouth display can still speak and a text-only display does not queue speech', async () => {
  const f = fixture(), { c } = f;
  await c.surfaceBrain2MouthText('Mouth and voice.');
  await c.surfaceBrain2MouthText('Mouth only.', { speak: false });
  assert.equal(f.utterances.length, 1);
  assert.equal(f.logs.filter(item => item.kind === 'mouth').length, 2);
});

test('an older display completion cannot replace newer monitor speech', async () => {
  const f = fixture(), { c } = f;
  let release;
  c.setMouthText = () => new Promise(resolve => { release = resolve; });
  const pending = c.surfaceBrain2MouthText('Older display.');
  c.speakBrain2Monitor('Newer monitor.');
  f.utterances[0].onstart();
  const before = f.cancels();
  release(); await pending;
  assert.equal(f.cancels(), before);
  assert.equal(f.utterances.length, 1);
  assert.equal(c.brain2MonitorAudioShouldMuteMic(), true);
  assert.ok(f.logs.some(item => item.kind === 'mouth'));
});

test('deferred mouth and voice surface only once in an ordinary quiet gap', async () => {
  const f = fixture(), { c } = f;
  Object.assign(c, {
    brain2DeferredSurface: { mouthText: 'Deferred.', createdAt: 1000, voiceSpoken: false },
    brain2DeferredSurfaceMaxAgeMs: 60000, brain2MouthCanSurface: () => true,
    scheduleBrain2Surface() {},
  });
  loadFunctions(c, ['maybeSurfaceDeferredBrain2']);
  await c.maybeSurfaceDeferredBrain2();
  assert.equal(f.utterances.length, 1);
  assert.equal(c.brain2DeferredSurface, null);
  assert.equal(f.logs.filter(item => item.kind === 'mouth').length, 1);
});

test('B1 inference does not cancel already-running monitor speech; B1 audio does', () => {
  const f = fixture(), { c } = f;
  c.speakBrain2Monitor('An aside.');
  f.utterances[0].onstart();
  c.responseActive = true;
  assert.equal(c.brain2MonitorAudioShouldMuteMic(), true);
  assert.equal(c.speakBrain2Monitor('Another aside.'), false);
  c.queueAudioDelta('AAA=');
  assert.equal(c.brain2MonitorAudioShouldMuteMic(), false);
});

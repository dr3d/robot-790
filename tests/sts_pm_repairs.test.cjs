const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

function load(names, globals = {}) {
  const c = vm.createContext(globals);
  for (const name of names) {
    const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    const end = page.indexOf('\n    }\n', start);
    assert.ok(start >= 0 && end > start, name);
    vm.runInContext(page.slice(start, end + 6), c, { filename: name });
  }
  return c;
}

function audio() {
  const sends = [], logs = [];
  let now = 100000;
  class Clock extends Date { static now() { return now; } }
  const c = load(['resetMicInterruptCandidate', 'audioInterruptTiming', 'outputAudioPlaying',
    'maybeBargeInFromMicFrame', 'interruptPeakThreshold'], {
    Date: Clock, runtimeConfig: {}, micInterruptActiveMs: 0, micInterruptGapMs: 0,
    lastBargeInAt: 0, bargeInCooldownMs: 900, currentInterruptSensitivity: () => 5,
    interruptSensitivityValue: { textContent: '5/10' }, audioContext: { currentTime: 1, state: 'running' },
    audioPlaybackWindows: new WeakMap(), activeAudioSources: new Set(),
    ws: { readyState: 1 }, WebSocket: { OPEN: 1 }, send: value => sends.push(value),
    stopPlaybackNow: () => sends.push('stop'), cueFaceMode: () => {}, events: {}, log: (_, text) => logs.push(text),
  });
  const source = {};
  c.activeAudioSources.add(source);
  c.audioPlaybackWindows.set(source, { start: 0, end: 10 });
  return { c, sends, logs, source, tick: ms => { now += ms; } };
}

test('one high microphone frame, low-RMS spikes, and separated bursts do not cancel speech', () => {
  const { c, sends } = audio();
  c.maybeBargeInFromMicFrame(0.61, 0.15, 43);
  for (let i = 0; i < 10; i++) c.maybeBargeInFromMicFrame(0.9, 0.003, 43);
  c.maybeBargeInFromMicFrame(0.61, 0.15, 43);
  assert.equal(sends.length, 0);
  assert.equal(c.micInterruptActiveMs, 43);
});

test('sustained deliberate audio interrupts once and logs evidence, not a claim of recognized speech', () => {
  const { c, sends, logs } = audio();
  for (let i = 0; i < 4; i++) c.maybeBargeInFromMicFrame(0.7, 0.12, 43);
  assert.equal(sends.length, 0);
  c.maybeBargeInFromMicFrame(0.7, 0.12, 43);
  assert.equal(sends[0], 'stop');
  assert.equal(sends[1].type, 'response.cancel');
  assert.match(logs[0], /sustained audio 215ms.*rms 0.120.*playback playing/);
  for (let i = 0; i < 10; i++) c.maybeBargeInFromMicFrame(0.7, 0.12, 43);
  assert.equal(sends.length, 2);
});

test('queued future audio, suspended playback, interrupt-off, and invalid frames cannot barge in', () => {
  for (const mode of ['queued', 'suspended', 'off', 'invalid']) {
    const { c, sends, source } = audio();
    if (mode === 'queued') c.audioPlaybackWindows.set(source, { start: 2, end: 10 });
    if (mode === 'suspended') c.audioContext.state = 'suspended';
    if (mode === 'off') c.currentInterruptSensitivity = () => 0;
    for (let i = 0; i < 20; i++) c.maybeBargeInFromMicFrame(0.7, mode === 'invalid' ? NaN : 0.12, 43);
    assert.equal(sends.length, 0, mode);
  }
});

test('audio gate knobs come from runtime configuration and a finished source is not still speaking', () => {
  const { c, sends } = audio();
  c.runtimeConfig.audio_interrupt = { minimum_active_ms: 300 };
  for (let i = 0; i < 6; i++) c.maybeBargeInFromMicFrame(0.7, 0.12, 43);
  assert.equal(sends.length, 0);
  c.audioContext.currentTime = 11;
  c.maybeBargeInFromMicFrame(0.7, 0.12, 43);
  assert.equal(c.micInterruptActiveMs, 0);
});

test('capture-adjacent prose and current preference cannot steal a recall; ties and unknown queries fail', () => {
  const c = load(['sensingEyeNoteQueryScore', 'chooseSensingEyeNote'], { maxSensingEyeImageHistory: 5 });
  const notes = [
    { id: 'file:rig.jpg', name: 'rig.jpg', current: true, nearby_transcript: 'panda face panda face' },
    { id: 'file:panda.jpg', name: 'panda.jpg', current: false },
    { id: 'file:panda-two.jpg', name: 'panda-two.jpg', current: false },
  ];
  assert.equal(c.chooseSensingEyeNote(notes, { id: 'file:panda.jpg', index: 1, query: 'rig' }).id, 'file:panda.jpg');
  assert.equal(c.chooseSensingEyeNote(notes, { index: 2, query: 'rig' }).id, 'file:panda.jpg');
  assert.equal(c.chooseSensingEyeNote(notes, { query: 'panda' }), null);
  assert.equal(c.chooseSensingEyeNote(notes, { query: 'nonexistent' }), null);
  assert.equal(c.chooseSensingEyeNote(notes, { id: 'missing', index: 1 }), null);
});

test('saved file ID is stable across local recalls and note catalogs do not duplicate images', async () => {
  const c = load(['sensingEyeSavedRemarks', 'listSensingEyeImages', 'listSensingEyeNotes'], {
    loadedNoteContexts: [],
    fetchSensingEyeVisualNoteFiles: async () => [{ filename: 'rig.jpg', url: '/sensing-eye/rig.jpg' }, { filename: 'panda.jpg' }],
    sensingEyeImageHistoryList: () => [{ id: 'eye-1', saved_filename: 'rig.jpg', created_at: 'now' }],
    sensingEyeTextHistoryList: () => [], sensingInputActive: () => false, sensingInputLabel: () => '',
    URL, location: { href: 'http://127.0.0.1:8790/' }, events: {}, log: () => {},
  });
  const result = await c.listSensingEyeNotes();
  assert.equal(result.notes[0].id, 'file:rig.jpg');
  assert.equal(result.notes[0].history_id, 'eye-1');
  assert.equal(result.notes.length, 2);
  assert.equal(result.images, undefined);
});

test('recalling an existing file registers its dependency without resaving it', async () => {
  const item = { id: 'eye-1', savedFilename: 'rig.jpg', dataUrl: 'data:test', name: 'rig.jpg' };
  const assets = [];
  const c = load(['selectSensingEyeImage', 'chooseSensingEyeNote'], {
    sensingEyeGeneration: 1, maxSensingEyeImageHistory: 5,
    listSensingEyeImages: async () => ({ images: [{ id: 'file:rig.jpg', history_id: 'eye-1', kind: 'image', location: 'session' }] }),
    requireCurrentSensingEyeLoad: () => {}, sensingEyeImageHistory: [item],
    visionPreview: { classList: { add() {} } }, visionDrop: { classList: { remove() {} } }, visionHint: {},
    updateVisionButtons() {}, events: {}, log() {}, recordUiEvent() {}, updateSessionTools() {},
    rememberSensingEyeSessionAsset: filename => assets.push(filename),
    stageVisionImage: () => { c.visionImageStaged = true; },
  });
  const result = await c.selectSensingEyeImage({ image_id: 'file:rig.jpg' });
  assert.equal(result.selected.staged, true);
  assert.equal(result.selected.id, 'file:rig.jpg');
  assert.deepEqual(assets, ['rig.jpg']);
});

test('catalogue remarks follow the file-open receipt, never the next image capture', async () => {
  const c = load(['sensingEyeSavedRemarks', 'listSensingEyeImages'], {
    loadedNoteContexts: [{ filename: 'sessions/test.txt', content: [
      'Transcript Since Clean Connect', '------------------------------',
      '[1:00:00 PM] Robot 790: The previous image had yellow wood.',
      '[1:00:01 PM] System: [sensing-eye visual note opened into B1 context: id eye-1 file logs/sensing-eye/panda.jpg size 600x600 source operator drop]',
      '[1:00:02 PM] Robot 790: A panda face with black ears.',
      '[1:00:03 PM] Robot 790: Big blue eyes.',
      '[1:00:04 PM] System: [sensing-eye visual note loaded into eye: id eye-2 file logs/sensing-eye/next.jpg size 600x600 source operator drop]',
      '[1:00:05 PM] System: [sensing-eye visual note opened into B1 context: id eye-2 file logs/sensing-eye/next.jpg size 600x600 source operator drop]',
      '[1:00:06 PM] You: Here you go.',
      '[1:00:07 PM] Robot 790: A cardboard face.',
      '[1:00:08 PM] You: Now for something else.',
      '[1:00:09 PM] Robot 790: This is a different subject.',
      'B2 Notes For Eric', '------------------',
      '[1:00:10 PM] Robot 790: Not image evidence.',
    ].join('\n') }],
    fetchSensingEyeVisualNoteFiles: async () => [
      { filename: 'panda.jpg', nearby_transcript: 'yellow wood' },
      { filename: 'next.jpg', nearby_transcript: 'A panda face with black ears.', last_user_text: 'panda' },
    ],
    sensingEyeImageHistoryList: () => [], sensingEyeTextHistoryList: () => [],
    sensingInputActive: () => false, sensingInputLabel: () => '',
  });
  const result = await c.listSensingEyeImages();
  assert.deepEqual(Array.from(result.images[0].remarks_after_open[0].remarks), ['A panda face with black ears.', 'Big blue eyes.']);
  assert.deepEqual(Array.from(result.images[1].remarks_after_open[0].remarks), ['A cardboard face.']);
  assert.equal(result.images[1].nearby_transcript, undefined);
  assert.equal(result.images[1].last_user_text, undefined);
  assert.equal(result.images[0].remarks_after_open[0].source_session, 'sessions/test.txt');
});

test('recall follow-up distinguishes staged images from text and unstaged notes', () => {
  const c = load(['sensingEyeRecallFollowupInstructions']);
  assert.match(c.sensingEyeRecallFollowupInstructions({ selected: { staged: true, kind: 'image' } }), /actual staged image/);
  assert.match(c.sensingEyeRecallFollowupInstructions({ selected: { staged: true, kind: 'text' } }), /actual staged text/);
  assert.match(c.sensingEyeRecallFollowupInstructions({ selected: { staged: false } }), /not staged/);
});

test('restored-note envelope stays byte-identical as wall time advances and preserves saved timestamps', () => {
  const c = load(['loadedNoteLooksLikeSessionNote', 'continuityCreatedAt', 'loadedNoteRestoreEnvelope'], {
    continuityRestoreAt: Date.parse('2026-09-11T12:00:00Z'), shortDuration: () => 'one hour',
  });
  const item = { content: 'STS Session Note\nCreated: 2026-09-11T11:00:00Z\n' };
  const first = c.loadedNoteRestoreEnvelope(item);
  class Later extends Date { constructor(...args) { super(...(args.length ? args : ['2030-01-01'])); } }
  c.Date = Later;
  assert.equal(c.loadedNoteRestoreEnvelope(item), first);
  assert.match(first, /Authoritative session save timestamp: 2026-09-11T11:00:00Z/);
});

test('steering-only advisories are not serialized as object strings', () => {
  const c = load(['arrayTail', 'compactSessionList']);
  const formatter = item => typeof item === 'string' ? item : item?.text;
  assert.equal(c.compactSessionList([{ text: '', steering: { next: 'new_subject' } }], formatter), '- none');
  assert.equal(c.compactSessionList(['legacy', { text: 'current' }], formatter), '- legacy\n- current');
  assert.match(page, /compactSessionList\(state\.brain2_state\.notes_for_eric, \(item\) => typeof item === "string" \? item : item\?\.text/);
});

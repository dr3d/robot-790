const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const { create } = require('../web/sts/tts-controls.js');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');

function fixture(saved = []) {
  const stored = new Map(saved);
  const elements = {
    model: { value: '0.6B', options: [{value: '0.6B'}, {value: '1.7B'}] },
    styles: {}, activeLabel: {}, styleNotice: {}, restartNotice: {},
    storage: {getItem: k => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, v)}
  };
  const controls = create(elements);
  controls.load();
  const active = (size, precision = 'bfloat16') => controls.update({
    active: {running: true, model: size, precision, style_instructions: size === '1.7B'},
    models: [{id: '0.6B', installed: true}, {id: '1.7B', installed: true}]
  });
  return {controls, elements, active, stored};
}

test('style visibility follows the running model, never a pending selection', () => {
  const f = fixture();
  assert.equal(f.elements.styles.hidden, true);
  f.active('0.6B');
  assert.equal(f.elements.styles.hidden, true);
  f.elements.model.value = '1.7B';
  f.controls.modelChanged();
  assert.equal(f.elements.styles.hidden, true);
  assert.match(f.elements.activeLabel.textContent, /In use: 0.6B/);
  assert.match(f.elements.restartNotice.textContent, /Restart required.*1.7B/);
  f.active('1.7B');
  assert.equal(f.elements.styles.hidden, false);
  assert.equal(f.elements.styleNotice.hidden, true);
  f.elements.model.value = '0.6B';
  f.controls.modelChanged();
  assert.equal(f.elements.styles.hidden, false);
  f.active('0.6B');
  assert.equal(f.elements.styles.hidden, true);
});

test('legacy browser precision preferences cannot affect the model controls', () => {
  for (const saved of [[], [['robot790.ttsPrecision.v1', 'float16']], [['robot790.ttsPrecision.v2', 'float16']]]) {
    const f = fixture(saved);
    for (const size of ['0.6B', '1.7B']) {
      f.active(size, 'float16');
      assert.equal(f.elements.model.value, size);
      assert.equal(f.controls.active.precision, 'float16');
      assert.doesNotMatch(f.elements.restartNotice.textContent, /^Restart required/);
      assert.doesNotMatch(f.elements.activeLabel.textContent, /float16/);
    }
  }
});

test('no saved selection adopts the active engine, missing or unknown status hides styles', () => {
  const f = fixture();
  f.active('1.7B', 'float16');
  assert.equal(f.elements.model.value, '1.7B');
  f.controls.unavailable();
  assert.equal(f.elements.styles.hidden, true);
  f.controls.update({active: {running: false}, models: [{id:'1.7B', installed:false}]});
  assert.equal(f.elements.model.options[1].disabled, true);
  assert.equal(f.elements.styles.hidden, true);
});

function voiceFixture(supported) {
  const updates = [];
  const context = vm.createContext({
    ttsVoice: {value:'Eric'}, ttsInstruct:{value:'dry'}, ttsPreset:{value:'dry'},
    qwen3TtsVoices: ['Eric','Vivian'], ttsStylePresets: {dry:'dry', sleepy:'sleepy', neutral:''},
    ttsControls: {supportsStyles: () => supported, styleUnavailableReason: () => 'unsupported by active model'},
    realtimeConnected: () => true, updateSessionTtsStyle: () => updates.push(true)
  });
  for (const name of ['currentTtsVoice','currentTtsInstruct','effectiveTtsInstruct','resolveTtsVoice',
    'matchingTtsPresetName','setVoice','ttsRuntimeConfig']) {
    const start = page.indexOf(`    function ${name}(`);
    const end = page.indexOf('\n    }\n', start);
    assert.ok(start > 0 && end > start, name);
    vm.runInContext(page.slice(start, end + 6), context);
  }
  return {c: context, updates};
}

test('a missing status endpoint names the page-server restart and preserves the pending model', async () => {
  const f = fixture([['robot790.ttsModel.v1', '1.7B']]);
  const context = vm.createContext({
    ttsRuntimeRequest: 0, ttsControls: f.controls, URL, AbortSignal,
    location: {href:'http://localhost:8790/'},
    fetch: async () => ({ok:false,status:404}),
    realtimeConnected: () => false
  });
  const start = page.indexOf('    async function refreshTtsRuntime(');
  const end = page.indexOf('\n    }\n', start);
  vm.runInContext(page.slice(start, end + 6), context);
  await context.refreshTtsRuntime();
  assert.equal(f.elements.model.disabled, true);
  assert.equal(f.elements.styles.hidden, true);
  assert.match(f.elements.activeLabel.textContent, /page server needs restart/);
  assert.match(f.elements.restartNotice.textContent, /Realtime Server restart button does not/);
  f.controls.unavailable();
  assert.match(f.elements.activeLabel.textContent, /page server needs restart/);
  f.active('0.6B');
  assert.equal(f.elements.model.disabled, false);
  assert.equal(f.elements.model.value, '1.7B');
  assert.match(f.elements.restartNotice.textContent, /Restart required to use 1.7B/);
  f.active('1.7B');
  assert.equal(f.elements.styles.hidden, false);
});

test('unsupported style requests do not mutate voice settings or claim a change', () => {
  const {c, updates} = voiceFixture(false);
  for (const request of [{preset:'sleepy'}, {instruct:'ominous'}, {neutral:true}, {voice:'Vivian',preset:'sleepy'}]) {
    const result = c.setVoice(request);
    assert.equal(result.status, 'unsupported');
    assert.equal(result.changed, false);
    assert.equal(c.ttsVoice.value, 'Eric');
    assert.equal(c.ttsInstruct.value, 'dry');
  }
  assert.equal(updates.length, 0);
  assert.equal(c.ttsRuntimeConfig().qwen3_tts_instruct, '');
  assert.equal(c.setVoice({}).preset, null);
  const changed = c.setVoice({voice:'Vivian'});
  assert.equal(changed.changed, true);
  assert.equal(changed.voice, 'Vivian');
  assert.equal(changed.style_supported, false);
});

test('supported style requests still reach the session settings', () => {
  const {c, updates} = voiceFixture(true);
  assert.equal(c.setVoice({preset:'sleepy'}).status, 'ok');
  assert.equal(updates.length, 1);
  assert.match(c.ttsRuntimeConfig().qwen3_tts_instruct, /sleepy/);
});

test('conversation reset is outside the voice panel and clearly named', () => {
  const panel = page.slice(page.indexOf('<details id="brain1Expando"'), page.indexOf('<details id="brain2Expando"'));
  assert.doesNotMatch(panel, /id="clearLog"/);
  assert.match(page, /id="clearLog"[^>]*>Reset conversation<\/button>/);
  assert.match(panel, /id="ttsStyleControls"[^>]*hidden/);
  assert.doesNotMatch(panel, /ttsPrecision|Advanced precision|ttsEngineExpando/);
  assert.equal((panel.match(/<details\b/g) || []).length, 1, 'Brain 1 has no nested expanders');
});

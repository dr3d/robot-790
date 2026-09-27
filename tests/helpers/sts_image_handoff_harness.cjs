const assert = require('node:assert/strict');
const vm = require('node:vm');
const { extract } = require('./sts_completion_harness.cjs');

const clone = value => JSON.parse(JSON.stringify(value));

function fixture(page, install) {
  const trace = [], snapshot = () => clone({
    preview: c.generatedPreview, hint: c.generatedImageHint.textContent,
    eye: [c.sensingEyeGeneration, c.visionImageUrl, c.sensingTextContent, c.visionImageName, c.visionImageStaged], trace,
  });
  const c = vm.createContext({
    URL, location: { href: 'http://fixture.test/' },
    generatedPreview: { revision: 4, name: 'preview.png', url: 'http://fixture.test/generated-images/preview.png' },
    generatedImageHint: { textContent: 'Preview ready' },
    sensingEyeGeneration: 2, visionImageUrl: '/before.jpg', sensingTextContent: '',
    visionImageName: 'before.jpg', visionImageStaged: true, current: true,
    filenameFromPath: value => { trace.push(['filename', value]); return value.split('/').at(-1); },
    updateGeneratedImageButtons: () => trace.push(['buttons']),
  });
  const f = { c, trace, snapshot, holds: new Map(), phase: null, failure: null, stageMode: 'normal' };
  async function step(name, value) {
    trace.push([name, value]);
    if (f.failure === name) throw Error(`${name} failed`);
    if (f.phase === name) await new Promise(resolve => f.holds.set(name, resolve));
  }
  c.fetch = async (url, options) => {
    await step('fetch', { url: String(url), options });
    return { ok: f.failure !== 'HTTP', status: 404, statusText: 'Not Found',
      blob: async () => { await step('blob', null); return { image: 'bytes' }; } };
  };
  c.blobToDataUrl = async blob => { await step('data', blob); return 'data:image/png;base64,fixture'; };
  c.loadImage = async url => { await step('decode', url); return { width: 12, height: 8 }; };
  c.setVisionImageFromDrawable = async (image, name, options) => {
    await step('save', { image, name, options: { ...options, isCurrent: options.isCurrent() } });
    trace.push(['save guard', options.isCurrent()]);
    if (f.stageMode === 'null') return null;
    if (!options.isCurrent()) throw Error('Image request was superseded.');
    c.visionImageUrl = '/saved.jpg'; c.sensingTextContent = '';
    c.visionImageName = f.stageMode === 'wrong name' ? 'other.jpg' : name;
    c.visionImageStaged = f.stageMode !== 'unstaged';
    return f.stageMode === 'no metadata' ? {} : { savedFilename: 'saved.jpg', openUrl: '/sensing-eye/saved.jpg' };
  };
  c.idleArt = { busy: false, ready: null,
    stageReady: async options => {
      trace.push(['idle stage', { expectedFilename: options.expectedFilename, sameGuard: options.isCurrent === f.guard }]);
      if (f.failure === 'idle') throw Error('idle delivery failed');
      return { status: 'ok', staged: true, source_image: 'pending.png', saved_filename: 'idle-eye.jpg' };
    } };
  f.guard = () => c.current;
  install?.(c, page);
  vm.runInContext(extract(page, 'moveGeneratedImageToSensingEye'), c);
  f.invoke = async args => {
    try { trace.push(['result', await c.moveGeneratedImageToSensingEye(args)]); }
    catch (error) { trace.push(['error', error.message]); }
  };
  return f;
}

async function characterize(page, install) {
  const cases = [];
  async function run(name, action) {
    const f = fixture(page, install);
    await action(f);
    cases.push({ name, ...f.snapshot() });
  }
  await run('current preview and matching hint', f => f.invoke());
  await run('exact retained image leaves different preview intact', f => f.invoke({ filename: 'older.png', reason: 'Recall it' }));
  await run('exact retrieval without preview or idle owner', f => {
    delete f.c.idleArt; f.c.generatedPreview.name = ''; f.c.generatedPreview.url = '';
    return f.invoke({ filename: 'older.png', _usePending: true });
  });
  await run('empty preview without filename rejects', f => { f.c.generatedPreview.url = ''; return f.invoke(); });
  await run('data URL bypasses transport', f => {
    f.c.generatedPreview.url = 'data:image/png;base64,inline'; return f.invoke({ reason: 'x'.repeat(140) });
  });
  await run('name falls back to URL basename', f => { f.c.generatedPreview.name = ''; return f.invoke(); });
  await run('name falls back to default', f => {
    f.c.generatedPreview.name = ''; f.c.filenameFromPath = () => ''; return f.invoke();
  });
  await run('filename is trimmed', f => f.invoke({ filename: '  older.WEBP  ' }));
  for (const filename of ['../x.png', 'path/x.png', 'path\\x.png', 'https://host/x.png', 'x.png?q', 'x.txt', 'x'.repeat(157) + '.png']) {
    await run(`invalid filename ${filename}`, f => f.invoke({ filename }));
  }
  await run('stale request rejects before validation', f => {
    f.c.current = false; return f.invoke({ filename: '../bad', _isCurrent: f.guard });
  });
  await run('explicit expected mismatch wins over pending busy', f => {
    f.c.idleArt.busy = true;
    return f.invoke({ filename: 'other.png', _expectedFilename: 'expected.png', _usePending: true });
  });
  await run('preview expected mismatch', f => f.invoke({ _expectedFilename: 'other.png' }));
  await run('preview expected match', f => f.invoke({ _expectedFilename: 'preview.png' }));
  await run('pending busy wins over ready', f => {
    f.c.idleArt.busy = true; f.c.idleArt.ready = {}; return f.invoke({ _usePending: true });
  });
  for (const args of [{}, { filename: 'pending.png' }, { _expectedFilename: 'pending.png' }]) {
    await run(`pending delivery ${JSON.stringify(args)}`, f => {
      f.c.idleArt.ready = {}; return f.invoke({ ...args, _usePending: true, _isCurrent: f.guard });
    });
  }
  await run('pending ignored without explicit use', f => {
    f.c.idleArt.busy = true; f.c.idleArt.ready = {}; return f.invoke();
  });
  await run('pending failure propagates without fallback', f => {
    f.c.idleArt.ready = {}; f.failure = 'idle'; return f.invoke({ _usePending: true, _isCurrent: f.guard });
  });
  for (const failure of ['fetch', 'HTTP', 'blob', 'data', 'decode', 'save']) {
    await run(`${failure} failure`, f => { f.failure = failure; return f.invoke(); });
  }
  for (const stageMode of ['null', 'wrong name', 'unstaged', 'no metadata']) {
    await run(`eye receipt ${stageMode}`, f => { f.stageMode = stageMode; return f.invoke(); });
  }
  const mutations = {
    user: c => { c.current = false; },
    session: c => { c.sensingEyeGeneration++; c.visionImageUrl = ''; c.visionImageName = ''; c.visionImageStaged = false; },
    preview: c => { c.generatedPreview.revision++; c.generatedPreview.name = 'new.png'; c.generatedPreview.url = '/new.png'; },
    eye: c => { c.visionImageUrl = '/new-eye.jpg'; c.visionImageName = 'new-eye.jpg'; },
    text: c => { c.sensingTextContent = 'New operator text'; },
  };
  for (const phase of ['fetch', 'blob', 'data', 'decode', 'save']) {
    for (const [change, mutate] of Object.entries(mutations)) {
      await run(`${change} during ${phase}`, async f => {
        f.phase = phase;
        const pending = f.invoke({ filename: 'retained.png', _isCurrent: f.guard });
        for (let i = 0; !f.holds.has(phase) && i < 40; i++) await Promise.resolve();
        assert.ok(f.holds.has(phase), `Reached ${phase}`);
        mutate(f.c); f.trace.push(['mutate', change]); f.holds.get(phase)(); await pending;
      });
    }
  }
  return cases;
}

module.exports = { characterize, fixture };

if (require.main === module) {
  const fs = require('node:fs'), cp = require('node:child_process');
  const baseline = '7833d90';
  const page = cp.execFileSync('git', ['show', `${baseline}:web/sts/index.html`], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
  characterize(page).then(cases => {
    fs.writeFileSync('tests/fixtures/sts-image-handoff.json', JSON.stringify({ baseline, cases }, null, 2) + '\n');
    console.log(`Captured ${cases.length} handoff cases from ${baseline}`);
  }).catch(error => { console.error(error); process.exitCode = 1; });
}

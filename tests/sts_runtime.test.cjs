const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const page = fs.readFileSync(path.join(__dirname, '../web/sts/index.html'), 'utf8').replace(/\r\n/g, '\n');
const facePage = fs.readFileSync(path.join(__dirname, '../web/face-sim/index.html'), 'utf8').replace(/\r\n/g, '\n');
const sessionMapPage = fs.readFileSync(path.join(__dirname, '../web/sts/session-map.html'), 'utf8').replace(/\r\n/g, '\n');
const runtimeConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/runtime.json'), 'utf8'));

test('the shipped page scripts compile', () => {
  const scripts = Array.from(page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/g), match => match[1]);
  assert.ok(scripts.length > 0);
  scripts.forEach((source, index) => new vm.Script(source, { filename: `sts-inline-${index}.js` }));
});

test('STS boots toward Browser Face as the default embodiment', () => {
  assert.equal(runtimeConfig.default_embodiment, 'browser_face');
  assert.match(runtimeConfig.current_embodiment, /Browser Face simulator/);
  assert.match(page, /<input id="faceUrl" value="http:\/\/127\.0\.0\.1:8791\/"/);
  assert.match(page, /defaultCurrentEmbodiment = "Your current embodiment is the Browser Face simulator:/);
});

test('Connect Previous follows the prior timestamped continuity session', () => {
  assert.match(page, /id="previousConnect"[^>]*>Connect Previous<\/button>/);
  assert.match(page, /async function connectPrevious\(\)/);
  assert.match(page, /const previous = continuitySessions\[currentIndex \+ 1\]/);
  assert.match(page, /\/api\/continuity\/save/);
  assert.match(page, /async function loadPreviousContinuityContext\(sessionFilename\)/);
  assert.match(page, /await loadCurrentContinuitySession\(\{ source: "Connect Previous", sessionFilename \}\)/);
  assert.match(page, /continuityParentForCurrentRun/);
});

test('Connect Select exposes one-item checklist management and archive', () => {
  assert.match(page, /id="continuitySessionList" role="listbox"/);
  assert.match(page, /<select id="continuitySessionSelect" hidden/);
  assert.match(page, /id="openSessionMap"[^>]*>Map<\/button>/);
  assert.match(page, /id="archiveContinuitySession"[^>]*>Archive<\/button>/);
  assert.match(page, /function setSelectedContinuitySessionFilename\(filename\)/);
  assert.match(page, /querySelectorAll\(['"]\.session-choice['"]\)/);
  assert.match(page, /\/api\/continuity\/archive/);
  assert.match(page, /function openSessionMapWindow\(\)/);
  assert.match(page, /function handleSessionMapMessage\(event\)/);
  assert.match(page, /robot790-continuity-session-map/);
  assert.match(page, /const refreshed = await fetchContinuitySessions\(\)/);
  assert.match(page, /notes\/sessions\/archived/);
});

test('session map page ships as a standalone chooser', () => {
  assert.match(sessionMapPage, /RObot-790 Session Map/);
  assert.match(sessionMapPage, /\/api\/continuity\/sessions/);
  assert.match(sessionMapPage, /\/api\/continuity\/archive/);
  assert.match(sessionMapPage, /robot790-continuity-session-map/);
  const scripts = Array.from(sessionMapPage.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/g), match => match[1]);
  assert.ok(scripts.length);
  scripts.forEach((source, index) => new vm.Script(source, { filename: `session-map-inline-${index}.js` }));
});

test('Context Map cards keep their own open state out of panel status', () => {
  assert.match(page, /const contextCardOpenByName = new Map\(\)/);
  assert.match(page, /function rememberContextCardOpenStates\(\)/);
  assert.match(page, /card\.dataset\.contextName = section\.name/);
  assert.match(page, /card\.open = Boolean\(contextCardOpenByName\.get\(section\.name\)\)/);
  assert.match(page, /function openExpandoStatusNames\(\)/);
  assert.match(page, /details\.settings-panel\[open\], details\.runtime-settings-expando\[open\]/);
  assert.doesNotMatch(page, /document\.querySelectorAll\("details\[open\]"\)/);
});

test('session restore wrapper marks old fresh-boot claims as stale', () => {
  assert.match(page, /old Robot 790 line says fresh boot, empty connect, no session note loaded/);
  assert.match(page, /trust the current run setup, current loaded-note list, current runtime truth/);
  assert.match(page, /current run now vs\. remembered prior run then/);
  assert.match(page, /Do not say you have only core notes or no session note just because an older transcript contains that old line/);
});

test('blank sensing-eye recall skips the already-current newest note', () => {
  const context = loadFunctions(['sensingEyeNoteQueryScore', 'chooseSensingEyeNote'], {
    maxSensingEyeImageHistory: 5,
  });
  const notes = [
    { index: 1, id: 'eye-current', name: 'study.jpg', current: true },
    { index: 2, id: 'eye-next', name: 'daisied-electra.jpg', current: false },
    { index: 3, id: 'eye-old', name: 'sleeping-in-bed.jpg', current: false },
  ];

  assert.equal(context.chooseSensingEyeNote(notes).id, 'eye-next');
  assert.equal(context.chooseSensingEyeNote(notes, { index: 1 }).id, 'eye-current');
  assert.equal(context.chooseSensingEyeNote(notes, { query: 'sleeping' }).id, 'eye-old');
});

test('Robot Controls exposes sensing-eye salience focus dial', () => {
  assert.match(page, /id="focusExpando"/);
  assert.match(page, /id="sensingEyeSalience" type="range" min="0" max="10"/);
  assert.match(page, /function sensingEyeSalienceInstruction/);
  assert.match(page, /sensing-eye salience/);
  assert.match(page, /Sensing-eye salience is/);
  assert.match(page, /loadSensingEyeSalience\(\)/);
});

test('continuity pin receipts preserve every named dependency', () => {
  const context = loadFunctions(['continuityPinnedNoteFilenames'], {
    legacyContinuityBookmarkNoteFilename: 'core/continuity.txt',
  });
  const pins = context.continuityPinnedNoteFilenames([
    'Robot 790 Continuity Session',
    '============================',
    'Pinned Context At Save',
    '-----------------------',
    '- core/erics_memories.txt',
    '  20 chars | sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '- research/first.txt',
    '  10 chars | sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    '- research/second.txt',
    '  10 chars | sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    '',
    'Session Demarcation',
    '-------------------',
    'Transcript Since Clean Connect',
    '------------------------------',
    '[4:00 PM] You: Hello.',
  ].join('\n'));
  assert.deepEqual(Array.from(pins), [
    'core/erics_memories.txt',
    'research/first.txt',
    'research/second.txt',
  ]);
});

test('continuity restore replaces stale browser pins with the selected session receipt', async () => {
  const files = new Map([
    ['sessions/chosen.txt', 'STS Session Note\n============================\nSession Demarcation\n-------------------\nChosen session.'],
    ['shared.txt', 'NEW DISK CONTENT'],
  ]);
  const reads = [];
  const context = loadFunctions([
    'noteFilenameSet',
    'noteFilenameInSet',
    'continuityPinnedNoteFilenames',
    'fetchContinuitySessionMetadata',
    'setLoadedNoteContextsForContinuity',
    'loadCurrentContinuitySession',
  ], {
    URL,
    location: new URL('http://127.0.0.1:8790/'),
    currentContinuitySessionFilename: '',
    continuityParentForCurrentRun: '',
    baseStartupNoteFilenames: ['core/erics_memories.txt'],
    loadedNoteContexts: [
      { filename: 'shared.txt', content: 'OLD TAB CONTENT', loadedAt: 1 },
      { filename: 'old-branch-only.txt', content: 'SHOULD NOT LOAD', loadedAt: 1 },
    ],
    loadedNoteContextDirty: false,
    legacyContinuityBookmarkNoteFilename: 'core/continuity.txt',
    loadEricMemoriesEnabled: () => true,
    updateLoadedNoteControls: () => {},
    contextPanel: { open: false },
    log: () => {},
    events: {},
    recordUiEvent: () => {},
    fetch: async url => {
      assert.equal(new URL(String(url)).pathname, '/api/continuity/select');
      return {
        ok: true,
        json: async () => ({
          status: 'ok',
          session_filename: 'sessions/chosen.txt',
          pinned_notes: [
            { filename: 'shared.txt', status: 'ok', current_status: 'changed' },
          ],
        }),
      };
    },
    readTextFile: async ({ filename }) => {
      reads.push(filename);
      if (!files.has(filename)) throw new Error(`missing ${filename}`);
      return { status: 'ok', filename, content: files.get(filename) };
    },
  });

  const result = await context.loadCurrentContinuitySession({
    source: 'test',
    sessionFilename: 'sessions/chosen.txt',
  });

  assert.deepEqual(reads, ['sessions/chosen.txt', 'shared.txt']);
  assert.deepEqual(Array.from(context.loadedNoteContexts, note => [note.filename, note.content]), [
    ['sessions/chosen.txt', files.get('sessions/chosen.txt')],
    ['shared.txt', 'NEW DISK CONTENT'],
  ]);
  assert.deepEqual(Array.from(result.restored_pinned_notes), ['shared.txt']);
});

test('stale async tool results cannot write into a newer realtime session', async () => {
  const oldSocket = { readyState: 1, sends: [], send(value) { this.sends.push(JSON.parse(value)); } };
  const newSocket = { readyState: 1, sends: [], send(value) { this.sends.push(JSON.parse(value)); } };
  let resolveTool;
  const context = loadFunctions([
    'activeRealtimeSession',
    'send',
    'maybeCreateToolFollowup',
    'handleFunctionCall',
  ], {
    WebSocket: { OPEN: 1 },
    ws: oldSocket,
    realtimeSessionGeneration: 1,
    pendingToolCalls: 0,
    toolFollowupNeeded: false,
    responseDoneAfterTool: false,
    idleInFlight: false,
    toolFollowupExactText: '',
    toolFollowupInstructions: '',
    toolFollowupPromptSources: [],
    parseToolArguments: () => ({}),
    beginToolActivity: () => {},
    endToolActivity: () => {},
    toolDetailFromArgs: () => '',
    executeTool: () => new Promise(resolve => { resolveTool = resolve; }),
    log: () => {},
    events: {},
    updateSessionTools: () => {},
  });

  const pending = context.handleFunctionCall(
    { name: 'get_brain_status', arguments: '{}', call_id: 'old-call' },
    { socket: oldSocket, generation: 1 },
  );
  assert.equal(context.pendingToolCalls, 1);
  context.ws = newSocket;
  context.realtimeSessionGeneration = 2;
  resolveTool({ status: 'ok' });
  await pending;

  assert.equal(context.pendingToolCalls, 0);
  assert.deepEqual(oldSocket.sends, []);
  assert.deepEqual(newSocket.sends, []);
});

// Exercise the shipped functions without starting a socket, microphone, or device.
function loadFunctions(names, globals, source = page) {
  const context = vm.createContext(globals);
  for (const name of names) {
    const start = source.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    assert.notEqual(start, -1, `Missing ${name}`);
    const end = source.indexOf('\n    }\n', start);
    assert.notEqual(end, -1, `Missing end of ${name}`);
    vm.runInContext(source.slice(start, end + 6), context, { filename: name });
  }
  return context;
}

for (const [prefix, routineName, minimum] of [
  ['GpuWatch', 'gpuWatchRoutine', 500],
  ['StandingRoutine', 'standingRoutine', 1000],
]) {
  const lower = prefix[0].toLowerCase() + prefix.slice(1);
  function scheduler(extra = {}) {
    const timers = [];
    const globals = {
      [routineName]: { cadenceMs: 30000, skippedCues: 0, sampleCount: 0 },
      [`${lower}Timer`]: null,
      [`${lower}Expired`]: () => false,
      [`stop${prefix}`]: () => {},
      [`trigger${prefix}Tick`]: async () => {},
      [`${lower}CueBlockedReason`]: () => 'assistant busy',
      sampleGpuWatchStatus: async () => ({ status: 'ok' }),
      gpuWatchSampleText: () => 'sample',
      log: () => {},
      events: {},
      clearTimeout: () => {},
      setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
      ...extra,
    };
    return { timers, context: loadFunctions([`schedule${prefix}Tick`], globals) };
  }

  test(`${prefix}: omitted/null delays use configured cadence, explicit zero keeps its floor`, () => {
    const { context, timers } = scheduler();
    const schedule = context[`schedule${prefix}Tick`];
    schedule(5000);
    schedule();
    schedule(null);
    schedule(0);
    assert.deepEqual(timers.map(timer => timer.delay), [5000, 30000, 30000, minimum]);
  });

  test(`${prefix}: blocked ticks retry at the configured cadence`, async () => {
    const { context, timers } = scheduler();
    loadFunctions([`trigger${prefix}Tick`], context);
    await context[`trigger${prefix}Tick`]();
    assert.equal(context[routineName].skippedCues, 1);
    assert.equal(timers.at(-1).delay, 30000);
  });

  test(`${prefix}: failed ticks retry at the configured cadence`, async () => {
    const { context, timers } = scheduler({
      [`trigger${prefix}Tick`]: async () => { throw new Error('test failure'); },
    });
    context[`schedule${prefix}Tick`](5000);
    timers[0].callback();
    await new Promise(setImmediate);
    assert.equal(timers.at(-1).delay, 30000);
  });

  test(`${prefix}: stopped or expired routines cannot schedule another tick`, () => {
    const { context, timers } = scheduler();
    context[routineName] = null;
    context[`schedule${prefix}Tick`]();
    assert.equal(timers.length, 0);
    let stopped = false;
    context[routineName] = { cadenceMs: 30000 };
    context[`${lower}Expired`] = () => true;
    context[`stop${prefix}`] = () => { stopped = true; };
    context[`schedule${prefix}Tick`]();
    assert.equal(stopped, true);
    assert.equal(timers.length, 0);
  });
}

function memoryContext() {
  return loadFunctions([
    'noteFilenameSet', 'noteFilenameInSet', 'formatLoadedNoteContextsForInstructions',
    'rememberLoadedNoteContext', 'ericMemoryNoteContexts', 'loadedNoteContextsForCurrentPrompt',
  ], {
    maxLoadedNoteChars: 64000,
    maxLoadedNotes: 8,
    loadedNoteContexts: [],
    loadedNoteContextDirty: false,
    log: () => {},
    events: {},
    updateLoadedNoteControls: () => {},
    contextPanel: { open: false },
    baseStartupNoteFilenames: ['core/erics_memories.txt'],
    loadEricMemoriesEnabled: () => true,
    emptyContextSessionEnabled: () => false,
    loadedNoteRestoreEnvelope: () => '',
    loadedNotePromptContent: item => item.content,
    clippedLoadedNotePromptContent: (_, content) => content,
    noteFilenameIsCurrentContinuitySession: () => false,
  });
}

test('long continuity notes cannot displace enabled core memory or reorder the notes', () => {
  const context = memoryContext();
  const result = context.formatLoadedNoteContextsForInstructions([
    { filename: 'sessions/continuity-session-20260907-160000.txt', content: 'x'.repeat(66000) },
    { filename: 'other.txt', content: 'EXTRA_NOTE' },
    { filename: 'core/erics_memories.txt', content: 'CORE_MEMORY_SENTINEL' },
  ]);
  assert.ok(result.includes('CORE_MEMORY_SENTINEL'));
  assert.ok(result.indexOf('[sessions/continuity-session-20260907-160000.txt]') < result.indexOf('[core/erics_memories.txt]'));
  assert.ok(result.includes('context clipped'));
  assert.ok(result.length < 65000);
});

test('ordinary notes and small core memory retain their contents and order', () => {
  const context = memoryContext();
  const notes = [
    { filename: 'ordinary.txt', content: 'ORDINARY_SENTINEL' },
    { filename: 'core/erics_memories.txt', content: 'CORE_MEMORY_SENTINEL' },
    { filename: 'last.txt', content: 'LAST_SENTINEL' },
  ];
  const result = context.formatLoadedNoteContextsForInstructions(notes);
  assert.ok(result.includes('ORDINARY_SENTINEL'));
  assert.ok(result.includes('CORE_MEMORY_SENTINEL'));
  assert.ok(result.includes('LAST_SENTINEL'));
  assert.ok(result.indexOf('ORDINARY_SENTINEL') < result.indexOf('CORE_MEMORY_SENTINEL'));
  assert.ok(result.indexOf('CORE_MEMORY_SENTINEL') < result.indexOf('LAST_SENTINEL'));
});

test('unchecked core memory is not injected from a stale loaded-note entry', () => {
  const context = memoryContext();
  context.loadEricMemoriesEnabled = () => false;
  const result = context.formatLoadedNoteContextsForInstructions([
    { filename: 'ordinary.txt', content: 'ORDINARY_SENTINEL' },
    { filename: 'core/erics_memories.txt', content: 'CORE_MEMORY_SENTINEL' },
  ]);
  assert.ok(result.includes('ORDINARY_SENTINEL'));
  assert.ok(!result.includes('CORE_MEMORY_SENTINEL'));
});

test('loading more than eight notes cannot evict enabled core memory', () => {
  const context = memoryContext();
  context.rememberLoadedNoteContext({
    status: 'ok', filename: 'core/erics_memories.txt', content: 'CORE_MEMORY_SENTINEL',
  });
  for (let index = 0; index < 12; index++) {
    context.rememberLoadedNoteContext({ status: 'ok', filename: `${index}.txt`, content: `note ${index}` });
  }
  assert.deepEqual(Array.from(context.loadedNoteContexts, note => note.filename), [
    '11.txt', '10.txt', '9.txt', '8.txt', '7.txt', '6.txt', '5.txt', 'core/erics_memories.txt',
  ]);
  assert.equal(context.loadedNoteContextDirty, true);
  const result = context.formatLoadedNoteContextsForInstructions(context.loadedNoteContextsForCurrentPrompt());
  assert.ok(result.includes('CORE_MEMORY_SENTINEL'));
});

test('empty connect retains only enabled core memory', () => {
  const context = memoryContext();
  context.loadedNoteContexts = [
    { filename: 'ordinary.txt', content: 'ordinary' },
    { filename: 'core/erics_memories.txt', content: 'core' },
  ];
  context.emptyContextSessionEnabled = () => true;
  assert.deepEqual(Array.from(context.loadedNoteContextsForCurrentPrompt(), note => note.filename), [
    'core/erics_memories.txt',
  ]);
  context.loadEricMemoriesEnabled = () => false;
  assert.equal(context.loadedNoteContextsForCurrentPrompt().length, 0);
});

test('disabled core memory does not reserve a loaded-note slot', () => {
  const context = memoryContext();
  context.loadEricMemoriesEnabled = () => false;
  for (let index = 0; index < 10; index++) {
    context.rememberLoadedNoteContext({ status: 'ok', filename: `${index}.txt`, content: 'note' });
  }
  assert.equal(context.loadedNoteContexts.length, 8);
});

for (const name of ['postFaceTo', 'getFaceJson', 'requestChassis']) {
  test(`${name}: successful HTTP cannot conceal device failure`, async () => {
    let body = { ok: true };
    let httpOk = true;
    const context = loadFunctions([name], {
      URL,
      normalizeUrlString: value => value,
      normalizeFaceBaseUrl: () => 'http://device.invalid/',
      chassisUrl: path => `http://device.invalid/${path}`,
      fetch: async () => ({
        ok: httpOk, status: httpOk ? 200 : 503, statusText: httpOk ? 'OK' : 'Unavailable',
        text: async () => JSON.stringify(body),
      }),
    });
    const invoke = () => name === 'postFaceTo'
      ? context[name]('http://device.invalid/', '/control', {})
      : context[name]('/status');
    assert.equal((await invoke()).ok, true);
    for (const failure of [
      { ok: false, error: 'device rejected' },
      { error: 'connection timed out' },
      { status: 'error', message: 'error receipt' },
      { status: 'failed', reason: 'failure receipt' },
      { status: 'skipped', reason: 'action skipped' },
    ]) {
      body = failure;
      await assert.rejects(invoke(), /device rejected|connection timed out|receipt|action skipped/);
    }
    body = {};
    httpOk = false;
    await assert.rejects(invoke(), /503/);
  });
}

test('volume control instructions agree between the served prompt and browser fallback', () => {
  const prompt = fs.readFileSync(path.join(__dirname, '../prompts/robot-790-realtime-system.md'), 'utf8');
  const rules = prompt.split(/\r?\n/).filter(line => /^(Use get_ui_controls|Use set_ui_control|Never say you changed mic)/.test(line));
  assert.equal(rules.length, 3);
  for (const rule of rules) {
    assert.ok(page.includes(JSON.stringify(rule)), `Browser fallback disagrees with: ${rule}`);
  }
  assert.ok(rules.some(rule => rule.includes('volume 0 as mute')));
});

for (const origin of ['http://127.0.0.1:8790', 'http://192.168.0.150:8790', 'https://192.168.0.150:8790', 'https://power:8790']) {
  test(`${origin}: STS uses matching face and realtime protocols`, () => {
    const location = new URL(origin);
    const context = loadFunctions([
      'isLoopbackHost', 'normalizeUrlString', 'pageHostServiceUrl',
      'defaultRealtimeUrl', 'normalizeRealtimeUrlForPage', 'normalizeFaceBaseUrl',
    ], { URL, location, faceUrl: { value: 'http://127.0.0.1:8791/' } });
    const websocket = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.hostname}:8765/v1/realtime`;
    const face = `${location.protocol}//${location.hostname}:8791/`;
    assert.equal(context.defaultRealtimeUrl(), websocket);
    assert.equal(context.normalizeRealtimeUrlForPage('ws://127.0.0.1:8765/v1/realtime'), websocket);
    assert.equal(context.normalizeRealtimeUrlForPage(`ws://${location.hostname}:8765/v1/realtime`), websocket);
    assert.equal(context.normalizeFaceBaseUrl(), face);
    assert.equal(context.pageHostServiceUrl(`http://${location.hostname}:8791/`), face);
    assert.equal(context.pageHostServiceUrl('http://esp32-s3-face.local/'), 'http://esp32-s3-face.local/');
    assert.equal(context.normalizeRealtimeUrlForPage('wss://external.example/realtime'), 'wss://external.example/realtime');
  });
}

test('browser face scripts compile', () => {
  const scripts = Array.from(facePage.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/g), match => match[1]);
  assert.ok(scripts.length);
  scripts.forEach(source => new vm.Script(source));
});

test('browser face status text clipping cannot grow in a render loop', () => {
  assert.match(facePage, /function fitCanvasText\(text, maxWidth/);
  assert.doesNotMatch(facePage, /while\s*\([^)]*measureText[\s\S]*?slice\(0,\s*-2\)[\s\S]*?\.\.\./);
});

for (const origin of ['http://127.0.0.1:8791', 'http://192.168.0.150:8791', 'https://192.168.0.150:8791', 'https://power:8791']) {
  test(`${origin}: browser face uses matching STS protocol`, () => {
    const location = new URL(origin);
    const context = loadFunctions(['isLoopbackHost', 'defaultStsUrl', 'normalizedStsUrl'], {
      URL, location, stsUrlInput: { value: 'http://127.0.0.1:8790/' },
    }, facePage);
    const expected = `${location.protocol}//${location.hostname}:8790/`;
    assert.equal(context.defaultStsUrl(), expected);
    assert.equal(context.normalizedStsUrl(), expected);
    assert.equal(context.normalizedStsUrl(`http://${location.hostname}:8790/`), expected);
    assert.equal(context.normalizedStsUrl('https://another-server.example/'), 'https://another-server.example/');
  });
}

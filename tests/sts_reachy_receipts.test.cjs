const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync('web/sts/index.html', 'utf8').replace(/\r\n/g, '\n');

test('browser speech releases lifecycle gaze but preserves explicit holds and other bodies', async () => {
  for (const [body, held] of [['browser_face', false], ['browser_face', true], ['s3_face', false], ['s3_face', true], ['reachy_mini', false]]) {
    const c = load(['setFaceMode'], {
      normalizeFaceTintColor: () => '', gazeHoldActive: () => held,
      matchingConfiguredEmbodimentKey: () => body, normalizeFaceBaseUrl: () => '',
      speechMouthSeq: 1, postFace: async (route, payload) => payload
    });
    const payload = await c.setFaceMode({ mode: 'speaking', automatic: true });
    assert.equal(payload.gaze?.auto, ['browser_face', 's3_face'].includes(body) && !held ? true : undefined);
  }
});

test('listening focus lasts through the utterance on browser and touch display', async () => {
  for (const body of ['browser_face', 's3_face', 'reachy_mini']) {
    const c = load(['setFaceMode'], {
      normalizeFaceTintColor: () => '', gazeHoldActive: () => false,
      matchingConfiguredEmbodimentKey: () => body, normalizeFaceBaseUrl: () => '',
      postFace: async (route, payload) => payload
    });
    const payload = await c.setFaceMode({ mode: 'listening', automatic: true });
    assert.equal(payload.gaze.x, 0);
    assert.equal(payload.gaze.y, 0);
    assert.equal(payload.gaze.duration, body === 'reachy_mini' ? 1.4 : 0);
  }
});

function load(names, globals = {}) {
  globals.toolScopeDenials ??= new Map();
  globals.toolFollowupTerminal ??= false;
  globals.runtimeConfig ??= {};
  globals.handledFunctionCallIds ??= new Set();
  const c = vm.createContext(globals);
  for (const name of names) {
    const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
    const end = page.indexOf('\n    }\n', start);
    assert.ok(start > 0 && end > start, name);
    vm.runInContext(page.slice(start, end + 6), c);
  }
  return c;
}

for (const key of ['reachy_mini', 'browser_face', 's3_face', 'external_eyes', 'custom']) {
  test(`idle captions respect ${key} display capability`, () => {
    const calls = [];
    const c = load(['configuredEmbodiments', 'embodimentSupportsMouthText', 'maybeShowIdleMouthAside'], {
      runtimeConfig: JSON.parse(fs.readFileSync('config/runtime.json', 'utf8')),
      matchingConfiguredEmbodimentKey: () => key, normalizeFaceBaseUrl: () => 'fixture',
      llmTools: { checked: true }, faceVisualHoldActive: () => false,
      Date: { now: () => 100000 }, lastIdleMouthAsideAt: 0, idleMouthAsideGapMs: 1000, compressIdleMs: () => 0,
      Math: { random: () => 0, floor: Math.floor }, idleMouthAsideChance: () => 1, idleMouthAsideText: text => text,
      setMouthText: async args => { calls.push(args); }, log: () => {}, events: {},
    });
    c.maybeShowIdleMouthAside('A passing thought');
    assert.equal(calls.length, key === 'reachy_mini' ? 0 : 1);
  });
}

test('compact idle receives only the active body facts, not the full tool manual', () => {
  const c = load(['configuredEmbodiments', 'formatEmbodimentForInstructions'], {
    runtimeConfig: JSON.parse(fs.readFileSync('config/runtime.json', 'utf8')),
    currentEmbodimentKey: 'reachy_mini', normalizeUrlString: String,
    normalizeFaceBaseUrl: () => 'http://127.0.0.1:8792/',
  });
  const prompt = c.formatEmbodimentForInstructions({ compact: true });
  assert.match(prompt, /no camera capture, image buffers/);
  assert.match(prompt, /do not measure clearance/);
  assert.doesNotMatch(prompt, /Use mirror capture|supported beats|Supported beats/);
  c.currentEmbodimentKey = 'browser_face';
  assert.doesNotMatch(c.formatEmbodimentForInstructions({ compact: true }), /move motors only/);
});

test('gesture evidence is retained without a tool-specific spoken script', () => {
  assert.ok(!page.includes('function faceBeatFollowupInstructions('));
  assert.ok(page.includes('await awaitFaceBeatCompletion(result'));
  assert.ok(page.includes('Accepted, running, failed and unknown are not completed'));
});

function completionFixture(states) {
  let now = 100000;
  let reads = 0;
  const c = load(['awaitFaceBeatCompletion', 'handleFunctionCall'], {
    Date: class extends Date { static now() { return now; } }, AbortSignal,
    activeRealtimeSession: () => true, normalizeFaceBaseUrl: () => 'http://body/',
    suppressedResponseIds: new Set(), toolContinuationOrigin: 'conversation',
    enabledToolList: () => [{ name: 'play_face_beat' }],
    sleepMs: async ms => { now += ms; },
    getFaceJson: async (_, options) => {
      assert.equal(options.baseUrl, 'http://body/');
      return states[Math.min(reads++, states.length - 1)];
    }, log: () => {}, events: {},
  });
  const result = { status: 'accepted', capabilities: { completion_tracking: true },
    sequence: { id: 'expected', name: 'drowsy', status: 'running', steps: 4, completed_steps: 0 } };
  return { c, result, options: { socket: {}, generation: 1, baseUrl: 'http://body/' }, reads: () => reads };
}

test('followup receives completed evidence only for its exact fully completed sequence', async () => {
  const { c, result, options, reads } = completionFixture([
    { sequence: { id: 'expected', status: 'running', steps: 4, completed_steps: 2 } },
    { sequence: { id: 'expected', name: 'drowsy', status: 'completed', steps: 4, completed_steps: 4 } },
  ]);
  const final = await c.awaitFaceBeatCompletion(result, options);
  assert.equal(final.completion, 'verified');
  assert.equal(reads(), 2);
  assert.equal(result.sequence.completed_steps, 0);
});

test('recorded dance completion can arrive after the old eight second limit', async () => {
  const states = Array.from({ length: 30 }, () => ({ sequence: { id: 'expected', status: 'running' } }));
  states.push({ sequence: { id: 'expected', status: 'completed', steps: 1, completed_steps: 1 } });
  const { c, result, options } = completionFixture(states);
  result.sequence.duration_s = 19;
  assert.equal((await c.awaitFaceBeatCompletion(result, options)).completion, 'verified');
});

for (const status of ['move_failed', 'move_cancelled', 'interrupted', 'unverified']) {
  test(`daemon ${status} is terminal without waiting for the full dance timeout`, async () => {
    const { c, result, options, reads } = completionFixture([{ sequence: { id: 'expected', status } }]);
    result.sequence.duration_s = 19;
    assert.equal((await c.awaitFaceBeatCompletion(result, options)).status, 'error');
    assert.equal(reads(), 1);
  });
}

for (const condition of ['timeout', 'superseded', 'failed', 'offline', 'disconnected', 'body changed']) {
  test(`completion handles ${condition} without replaying motion`, async () => {
    const state = { sequence: { id: condition === 'superseded' ? 'other' : 'expected',
      status: condition === 'failed' ? 'failed' : 'running', steps: 4, completed_steps: 1 } };
    const { c, result, options, reads } = completionFixture([state]);
    if (condition === 'offline') c.getFaceJson = async () => { throw new Error('offline'); };
    if (condition === 'disconnected') c.activeRealtimeSession = () => false;
    if (condition === 'body changed') c.normalizeFaceBaseUrl = () => 'http://other/';
    const final = await c.awaitFaceBeatCompletion(result, options);
    assert.notEqual(final.completion, 'verified');
    if (condition === 'failed') assert.equal(final.status, 'error');
    else assert.equal(final.completion_receipt.status, 'unverified');
    assert.ok(reads() <= 23);
  });
}

test('bodies without completion tracking keep their original receipt', async () => {
  const { c, result, options, reads } = completionFixture([]);
  result.capabilities.completion_tracking = false;
  assert.equal(await c.awaitFaceBeatCompletion(result, options), result);
  assert.equal(reads(), 0);
});

test('the function-call pipeline delivers completion evidence before requesting its final followup', async () => {
  const { c, result, options } = completionFixture([
    { sequence: { id: 'expected', name: 'drowsy', status: 'completed', steps: 4, completed_steps: 4 } },
  ]);
  const sent = [];
  let followups = 0;
  Object.assign(c, {
    lastUserTurnActivityAt: 0, eyeRecallResponses: new Map(), eventResponseId: event => event.response_id || '',
    ws: options.socket, realtimeSessionGeneration: options.generation, pendingToolCalls: 0,
    toolFollowupNeeded: false, toolFollowupPromptSources: [], idleInFlight: false, loadedNoteContextDirty: false,
    parseToolArguments: JSON.parse, beginToolActivity: () => {}, endToolActivity: () => {},
    toolDetailFromArgs: () => '', executeTool: async () => result,
    send: event => sent.push(event), maybeCreateToolFollowup: () => { followups++; },
  });
  await c.handleFunctionCall({ name: 'play_face_beat', call_id: 'call1', arguments: '{"name":"drowsy"}' }, options);
  assert.equal(sent.length, 1);
  assert.equal(JSON.parse(sent[0].item.output).completion, 'verified');
  assert.equal(c.toolFollowupInstructions, undefined);
  assert.equal(followups, 1);
  assert.equal(c.pendingToolCalls, 0);
});

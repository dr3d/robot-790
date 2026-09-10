const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const page = fs.readFileSync(path.join(__dirname, '../web/sts/index.html'), 'utf8').replace(/\r\n/g, '\n');
const facePage = fs.readFileSync(path.join(__dirname, '../web/face-sim/index.html'), 'utf8').replace(/\r\n/g, '\n');
const sessionMapPage = fs.readFileSync(path.join(__dirname, '../web/sts/session-map.html'), 'utf8').replace(/\r\n/g, '\n');
const runtimeConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/runtime.json'), 'utf8'));

test('session map reuses the STS diamond-metal texture and title family', () => {
  const texture = 'assets/diamond-plate.avif';
  assert.ok(page.includes(`url("${texture}")`));
  assert.ok(sessionMapPage.includes(`url("${texture}")`));
  assert.ok(fs.existsSync(path.join(__dirname, '../web/sts', texture)));
  assert.match(sessionMapPage, /background-size: auto, auto, 190px 190px, auto/);
  assert.match(sessionMapPage, /font-family: "Arial Black", "Segoe UI Black", Impact, system-ui, sans-serif/);
  assert.match(sessionMapPage, /@media \(max-width: 560px\)/);
  assert.match(sessionMapPage, /grid-template-areas:\s*"title status"\s*"toolbar toolbar"/);
  assert.match(sessionMapPage, /<header>[\s\S]*?<div class="toolbar">[\s\S]*?<\/div>\s*<\/header>/);
  assert.doesNotMatch(sessionMapPage, /height: calc\(100vh - 113px\)/);
  assert.match(sessionMapPage, /rgba\(var\(--accent\), 0\.21\)/);
  assert.match(sessionMapPage, /rgba\(var\(--accent\), 0\.11\) 35%/);
});

test('live pane dividers have compact, plain resize rails', () => {
  assert.match(page, /--panel-divider-size: 10px/);
  assert.match(page, /id="conversationResizeHandle"[^>]+role="separator"[^>]+tabindex="0"/);
  assert.match(page, /id="lowerLogResizeHandle"[^>]+role="separator"[^>]+tabindex="0"/);
  assert.match(page, /\.conversation-resize-handle\s*\{[^}]*touch-action: none/);
  assert.match(page, /\.lower-log-resize-handle\s*\{[^}]*touch-action: none/);
  assert.match(page, /function beginConversationPaneResize\(event\)/);
  assert.match(page, /function beginLowerLogPaneResize\(event\)/);
});

test('browser face stays shrinkable and centered without a resize script', () => {
  assert.match(facePage, /html, body\s*\{[^}]*min-width: 0/);
  assert.match(facePage, /\.stage\s*\{[^}]*place-items: center;[^}]*min-width: 0/);
  assert.match(facePage, /canvas\s*\{[^}]*width: min\([^}]*min-width: 0/);
  assert.doesNotMatch(facePage, /resizeTo\(|ResizeObserver/);
});

test('face launcher uses a compact app window without altering the browser profile', () => {
  const launcher = fs.readFileSync(path.join(__dirname, '../scripts/open_browser_face.ps1'), 'utf8');
  assert.match(launcher, /\[int\]\$Width = 320/);
  assert.match(launcher, /\[int\]\$Height = 480/);
  assert.match(launcher, /--app=\$Url/);
  assert.match(launcher, /--window-size=\$Width,\$Height/);
  assert.doesNotMatch(launcher, /--user-data-dir|--disable-web-security/);
});

function faceWindowContext(href = 'http://127.0.0.1:8790/') {
  const opened = [];
  const messages = [];
  const stored = new Map();
  const context = loadFunctions([
    'isLoopbackHost', 'pageHostServiceUrl', 'normalizeUrlString', 'normalizeFaceBaseUrl',
    'configuredEmbodiments', 'matchingConfiguredEmbodimentKey', 'configuredEmbodimentUrl',
    'browserFaceControllerActive', 'loadFaceControllerPreference', 'saveFaceControllerPreference',
    'openBrowserFaceWindow',
  ], {
    URL, location: new URL(href), faceUrl: { value: 'http://127.0.0.1:8791/' },
    runtimeConfig: { embodiments: [] }, browserFaceWindow: null, browserFaceWindowUrl: '',
    faceControllerStorageKey: 'face',
    localStorage: { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) },
    events: {}, log: (_, message) => messages.push(message),
    window: { open: (...args) => {
      const popup = { closed: false, focused: 0, focus() { this.focused++; } };
      opened.push({ args, popup });
      return popup;
    } },
  });
  return { context, opened, messages, stored };
}

test('Browser Face popup opens once, reuses without reloading/resizing, and reopens after closure', () => {
  const { context, opened } = faceWindowContext();
  assert.equal(context.openBrowserFaceWindow({ onlyIfActive: true }), true);
  assert.equal(opened[0].args[0], 'http://127.0.0.1:8791/');
  assert.equal(opened[0].args[1], 'robot790-browser-face');
  assert.match(opened[0].args[2], /popup=yes,width=280,height=420,resizable=yes/);
  assert.equal(context.openBrowserFaceWindow({ onlyIfActive: true }), true);
  assert.equal(opened.length, 1);
  assert.equal(opened[0].popup.focused, 2);
  assert.equal(opened[0].popup.location, undefined);
  opened[0].popup.closed = true;
  context.openBrowserFaceWindow();
  assert.equal(opened.length, 2);
  assert.equal(opened[1].args[1], opened[0].args[1]);
});

test('hardware targets do not auto-open Browser Face; the explicit opener leaves the target unchanged', () => {
  const { context, opened } = faceWindowContext();
  context.faceUrl.value = 'http://esp32-eyes.local/';
  context.runtimeConfig.embodiments = runtimeConfig.embodiments;
  assert.equal(context.openBrowserFaceWindow({ onlyIfActive: true }), false);
  assert.equal(opened.length, 0);
  assert.equal(context.openBrowserFaceWindow(), true);
  assert.equal(opened[0].args[0], 'http://127.0.0.1:8791/');
  assert.equal(context.faceUrl.value, 'http://esp32-eyes.local/');
});

for (const href of ['http://localhost:8790/', 'http://192.168.0.150:8790/', 'https://power:8790/']) {
  test(`${href}: Browser Face popup works before config arrives with the matching host/protocol`, () => {
    const { context, opened } = faceWindowContext(href);
    assert.equal(context.openBrowserFaceWindow({ onlyIfActive: true }), true);
    assert.equal(opened[0].args[0], context.pageHostServiceUrl('http://127.0.0.1:8791/'));
  });
}

test('Browser Face popup failures are nonfatal and give a concrete recovery action', () => {
  const { context, messages } = faceWindowContext();
  context.window.open = () => null;
  assert.equal(context.openBrowserFaceWindow(), false);
  assert.match(messages.at(-1), /Allow popups for STS.*Open Browser Face.*Embodiment/);
  context.window.open = () => { throw new Error('denied'); };
  assert.equal(context.openBrowserFaceWindow(), false);
  assert.match(messages.at(-1), /could not open: denied/);
});

test('Browser Face only opens web URLs and follows a changed browser controller URL', () => {
  const { context, opened } = faceWindowContext();
  context.openBrowserFaceWindow();
  context.faceUrl.value = 'http://localhost:8791/';
  context.openBrowserFaceWindow();
  assert.equal(opened.length, 1);
  assert.equal(opened[0].popup.location, 'http://localhost:8791/');
  context.runtimeConfig.embodiments = [{ key: 'browser_face', face_url: 'javascript:alert(1)' }];
  context.faceUrl.value = 'javascript:alert(1)';
  assert.equal(context.openBrowserFaceWindow(), false);
  assert.equal(opened.length, 1);
});

test('face selection survives refresh without opening a window; malformed preferences are ignored', () => {
  const { context, stored, opened } = faceWindowContext();
  context.faceUrl.value = 'http://esp32-eyes.local/';
  context.saveFaceControllerPreference();
  context.faceUrl.value = 'http://127.0.0.1:8791/';
  context.loadFaceControllerPreference();
  assert.equal(context.faceUrl.value, 'http://esp32-eyes.local/');
  assert.equal(opened.length, 0);
  for (const bad of ['javascript:alert(1)', 'not a URL']) {
    stored.set('face', bad);
    context.loadFaceControllerPreference();
    assert.equal(context.faceUrl.value, 'http://esp32-eyes.local/');
  }
  context.localStorage.getItem = () => { throw new Error('storage disabled'); };
  context.localStorage.setItem = () => { throw new Error('storage disabled'); };
  assert.doesNotThrow(() => context.loadFaceControllerPreference());
  assert.doesNotThrow(() => context.saveFaceControllerPreference());
});

test('successful tool-based body switches persist; failed device probes preserve the previous choice', async () => {
  const { context, stored } = faceWindowContext();
  Object.assign(context, {
    runtimeConfig: structuredClone(runtimeConfig), currentEmbodimentKey: 'browser_face',
    getFaceJson: async () => ({ firmware: 'test' }),
    syncEmbodimentSelect: () => {}, updateVisionButtons: () => {}, updateSessionTools: () => {},
    realtimeConnected: () => false,
  });
  loadFunctions(['setEmbodiment'], context);
  await context.setEmbodiment({ embodiment: 'external_eyes' });
  assert.equal(stored.get('face'), 'http://esp32-eyes.local/');
  context.getFaceJson = async () => { throw new Error('offline'); };
  await assert.rejects(context.setEmbodiment({ embodiment: 's3_face' }), /offline/);
  assert.equal(stored.get('face'), 'http://esp32-eyes.local/');
  assert.equal(context.faceUrl.value, 'http://esp32-eyes.local/');
});

test('restored hardware profile is the current embodiment in the prompt, not the Browser Face default', () => {
  const { context } = faceWindowContext();
  Object.assign(context, {
    runtimeConfig, currentEmbodimentKey: 'external_eyes', defaultBodyTrajectory: 'body',
    embodimentAliasHint: () => '',
  });
  context.faceUrl.value = 'http://esp32-eyes.local/';
  loadFunctions(['formatEmbodimentForInstructions'], context);
  const current = context.formatEmbodimentForInstructions().split('Configured embodiments')[0];
  assert.match(current, /Your current embodiment is External eyes and mask face/);
  assert.doesNotMatch(current, /current embodiment is the Browser Face/);
});

for (const name of ['connect', 'connectPrevious', 'connectSelectedContinuityFilename', 'startContinuityEric']) {
  test(`${name}: popup opens before any asynchronous connection work`, () => {
    let opened = 0;
    const context = loadFunctions([name], {
      ws: null, continuitySaveBusy: false, currentContinuityScrubMode: () => 'full',
      realtimeConnected: () => false, saveFaceControllerPreference: () => {},
      openBrowserFaceWindow: options => {
        assert.equal(options.onlyIfActive, true);
        opened++;
      },
      setState: () => {}, setConnectionButtonsDisabled: () => {}, updateSaveAndHaltButton: () => {},
      ensureRuntimeConfigLoaded: () => new Promise(() => {}),
      fetchContinuitySessionMetadata: () => new Promise(() => {}),
      loadLatestContinuitySession: () => new Promise(() => {}),
    });
    context[name]();
    assert.equal(opened, 1);
  });
}

test('the shipped page scripts compile', () => {
  const scripts = Array.from(page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/g), match => match[1]);
  assert.ok(scripts.length > 0);
  scripts.forEach((source, index) => new vm.Script(source, { filename: `sts-inline-${index}.js` }));
});

test('session prompts lead with identity and creature vocabulary before mode or memory context', () => {
  const prompt = fs.readFileSync(path.join(__dirname, '../prompts/robot-790-realtime-system.md'), 'utf8');
  assert.doesNotMatch(page, /emptyContextSessionEnabled|configOnlySessionInstructions|emptyContextStartedAt/);

  const normalStart = page.indexOf('function buildSessionInstructions(');
  const normalEnd = page.indexOf('\n    function loadedWorldContextActive()', normalStart);
  const normalSource = page.slice(normalStart, normalEnd);
  assert.ok(normalSource.indexOf('baseInstructions.identity') < normalSource.indexOf('formatCreatureForInstructions()'));
  assert.ok(normalSource.indexOf('formatCreatureForInstructions()') < normalSource.indexOf('formatMemoryForInstructions()'));

  for (const heading of [
    '## Conversation discipline',
    '## Runtime truth and staged scenes',
    '## Tools, controls, and recurring work',
    '## Body and face',
    '## Memory, notes, and sensing',
  ]) {
    assert.ok(prompt.includes(heading), `Missing prompt section: ${heading}`);
  }
});

test('fresh and resumed sessions share privacy rules without a startup persona', () => {
  const context = loadFunctions([
    'brain2AdvisoryProtocolInstructions', 'formatBrain2ForInstructions',
    'buildSessionInstructions',
  ], {
    firstContactModeEnabled: () => false,
    performanceModeEnabled: () => false,
    baseSessionInstructionSections: () => ({ identity: 'IDENTITY', operating: 'OPERATING RULES' }),
    formatCreatureForInstructions: () => 'CREATURE',
    formatMemoryForInstructions: () => 'OLD BROWSER FACTS',
    formatLoadedNotesForInstructions: () => 'CORE MEMORY',
    formatSensingTextForInstructions: () => 'OLD SENSING',
    formatRecentSearchContextForInstructions: () => 'OLD SEARCH',
    formatAloneStateForInstructions: () => 'OLD ALONE STATE',
    formatEmbodimentForInstructions: () => 'BODY',
    formatRuntimeWatchForInstructions: () => 'LIVE ROUTINES',
    formatRuntimeStateForInstructions: () => 'LIVE RUNTIME',
    formatRuntimeBehaviorRulesForInstructions: () => 'RUNTIME RULES',
    wonderSearchPolicyText: () => 'SEARCH RULES',
    formatBrain2AdvisoryContent: () => '',
    performancePrivacyInstructions: () => 'PERFORMANCE PRIVACY',
  });
  const fresh = context.buildSessionInstructions();
  context.formatLoadedNotesForInstructions = () => 'CORE MEMORY\nOLD SESSION NOTES';
  const resumed = context.buildSessionInstructions();
  for (const instructions of [fresh, resumed]) {
    assert.ok(instructions.startsWith('IDENTITY\n\nCREATURE'));
    assert.match(instructions, /not words you have spoken/);
    assert.match(instructions, /Never reproduce its markers/);
    assert.match(instructions, /not your identity or a topic to announce/);
    assert.match(instructions, /RUNTIME RULES/);
    assert.ok(instructions.endsWith('OPERATING RULES'));
    assert.doesNotMatch(instructions, /Empty Connect|config-only startup/);
  }
  assert.match(fresh, /CORE MEMORY/);
  assert.match(fresh, /LIVE RUNTIME/);
  assert.doesNotMatch(fresh, /OLD SESSION NOTES/);
  assert.equal(resumed, fresh.replace('CORE MEMORY', 'CORE MEMORY\nOLD SESSION NOTES'));
  assert.match(resumed, /OLD SESSION NOTES/);
  context.formatBrain2AdvisoryContent = () => 'FRESH PRIVATE ADVISORY';
  assert.match(context.buildSessionInstructions(), /FRESH PRIVATE ADVISORY/);
  assert.doesNotMatch(context.buildSessionInstructions({ includeBrain2Advisory: false }), /FRESH PRIVATE ADVISORY/);
  assert.match(context.buildSessionInstructions({ includeBrain2Advisory: false }), /Never reproduce its markers/);
  context.performanceModeEnabled = () => true;
  const performance = context.buildSessionInstructions();
  assert.match(performance, /Never reproduce its markers/);
  assert.doesNotMatch(performance, /FRESH PRIVATE ADVISORY|OLD SESSION NOTES/);
});

test('idle prompts no longer teach an Empty Connect persona', () => {
  assert.doesNotMatch(page, /Empty Connect mode is active|during Empty Connect mode|An Empty Connect idle process/);
  const start = page.indexOf('async function triggerIdlePonder(');
  const end = page.indexOf('\n    }\n', start);
  assert.match(page.slice(start, end), /brain2AdvisoryProtocolInstructions\(\)/);
});

test('Brain2 advisories accept the current session notes, questions, and revisions', () => {
  const context = loadFunctions(['formatBrain2AdvisoryContent'], {
    brain2RevisionCandidates: [],
    brain2QuestionCandidates: [],
    brain2NoteCandidates: [],
    brain2LoopPressureInstruction: () => 'LOOP PRESSURE',
  });
  assert.equal(context.formatBrain2AdvisoryContent(), '');
  context.brain2NoteCandidates.push({ at: 100, text: 'NEW NOTE' });
  context.brain2QuestionCandidates.push({ at: 101, text: 'NEW QUESTION' });
  context.brain2RevisionCandidates.push({ at: 102, text: 'NEW REVISION' });
  const advisory = context.formatBrain2AdvisoryContent();
  assert.doesNotMatch(advisory, /OLD|UNDATED/);
  assert.match(advisory, /NEW NOTE/);
  assert.match(advisory, /NEW QUESTION/);
  assert.match(advisory, /NEW REVISION/);
});

test('base prompt sections split the identity anchor from operating rules', () => {
  const context = loadFunctions(['baseSessionInstructionSections'], {
    runtimeConfig: { base_session_prompt: 'IDENTITY ANCHOR\n\n## Operating rules\nRULE' },
    baseSessionInstructions: [],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(context.baseSessionInstructionSections())), {
    identity: 'IDENTITY ANCHOR',
    operating: '## Operating rules\nRULE',
  });
});

test('runtime behavior rules do not duplicate rules already in the base prompt', () => {
  const duplicate = "Do not reflexively repeat the user's phrasing back as confirmation.";
  const context = loadFunctions([
    'normalizePromptRule', 'baseSessionInstructionsText', 'formatRuntimeBehaviorRulesForInstructions',
  ], {
    runtimeConfig: {
      base_session_prompt: `Identity\n\n${duplicate}`,
      session_behavior_rules: [duplicate, 'Preserve this runtime-only rule.'],
    },
    baseSessionInstructions: [],
  });
  const result = context.formatRuntimeBehaviorRulesForInstructions();
  assert.doesNotMatch(result, /reflexively repeat/);
  assert.match(result, /Preserve this runtime-only rule/);
});

test('local file tools can write source without granting execution', () => {
  assert.match(page, /LLM local files/);
  assert.match(page, /\.txt, \.md, \.py, \.json, \.csv, \.html, \.css, \.js, \.yaml, and \.yml/);
  assert.match(page, /Writing a source file does not execute it/);
  assert.match(page, /localFileNoun = "[^"\n]*python[^"\n]*program/);
  assert.match(page, /Do not say you cannot write a file while write_text_file is available/);
});

test('bounded adaptive deliberation is an Eric action, with Typed Think retained as a lab shortcut', () => {
  const prompt = fs.readFileSync(path.join(__dirname, '../prompts/robot-790-realtime-system.md'), 'utf8');
  assert.match(page, /const deliberationTools = \[/);
  assert.match(page, /name: "deliberate_once"/);
  assert.match(page, /async function deliberateOnceForEric\(args = \{\}\)/);
  assert.match(page, /\.\.\.deliberationTools/);
  assert.match(page, /Use the deliberate_once result as private, fallible support/);
  assert.match(prompt, /When the operator explicitly asks you to think harder[\s\S]*call deliberate_once before answering/);
  assert.match(prompt, /careful multi-step diagnosis, tradeoff, plan, or technical assessment/);
  assert.match(prompt, /If the operator says just answer, fast, or do not overthink, answer directly/);
  assert.match(prompt, /controller maps it to the active brain's actual capability/);
  assert.match(prompt, /It is one private bounded pass, never a routine, loop, or substitute for clarification/);
  assert.match(page, /id="typedThink"[^>]*>Think<\/button>/);
  assert.match(page, /id="typedThinkEffort"[^>]*aria-label="Think depth"/);
  assert.match(page, /option value="low">Low<\/option>/);
  assert.match(page, /option value="medium" selected>Medium<\/option>/);
  assert.match(page, /option value="xhigh">Hard<\/option>/);
  assert.match(page, /id="deliberateIndicator"[\s\S]*?THINK READY/);
  assert.match(page, /async function sendTypedDeliberateTurn\(text\)/);
  assert.match(page, /fetch\("\/api\/deliberate"/);
  assert.match(page, /THINKING \$\{effortLabel\}/);
  assert.match(page, /THINK \$\{resultEffortLabel\} OK/);
  assert.match(page, /effort === "on"\) return "ON"/);
  assert.match(page, /active brain's advertised reasoning capability/);
  assert.match(page, /THINK FALLBACK/);
  assert.match(page, /thinking: currentTypedThinkEffort\(\)/);
  assert.match(page, /tool_choice: "none"/);
  assert.match(page, /Do not mention a worker, model, hidden reasoning, prompt, private note, or chain of thought/);
});

test('PM prompt ledgers retain receipts without copying prompt or loaded-note bodies', () => {
  const context = loadFunctions([
    'promptLedgerInputReceipt',
    'promptLedgerReceiptLine',
    'promptLedgerReceiptReportText',
  ], {
    lastSessionPromptSnapshot: {
      at: '2026-09-08T22:00:00.000Z',
      kind: 'session.update',
      source: 'B1 session',
      instructions: 'PINNED_NOTE_BODY_SENTINEL',
      input: 'USER_INPUT_BODY_SENTINEL',
      tool_count: 3,
      tool_choice: 'auto',
    },
    promptLedgerLog: [{
      at: '2026-09-08T22:01:00.000Z',
      kind: 'response.create',
      source: 'typed user turn',
      instructions: 'ANOTHER_PINNED_NOTE_BODY_SENTINEL',
      input: { notes: 'PRIVATE_INPUT_SENTINEL' },
      tools: [{ name: 'read_text_file' }],
      tool_choice: 'auto',
    }],
    brain2PromptLog: [{
      at: '2026-09-08T22:02:00.000Z',
      kind: 'chat.completions',
      source: 'Brain2 normal',
      instructions: 'BRAIN2_SYSTEM_BODY_SENTINEL',
      input: 'BRAIN2_INPUT_BODY_SENTINEL',
      tool_count: 0,
      tool_choice: 'none',
    }],
  });
  const report = context.promptLedgerReceiptReportText();
  assert.match(report, /Prompt Ledger Receipt/);
  assert.match(report, /Captured: 1; retained as receipts: 1\./);
  assert.match(report, /instructions: 25 chars; input: text \(24 chars\); tools: 3; choice: auto/);
  assert.doesNotMatch(report, /PINNED_NOTE_BODY_SENTINEL|USER_INPUT_BODY_SENTINEL|PRIVATE_INPUT_SENTINEL|BRAIN2_SYSTEM_BODY_SENTINEL|BRAIN2_INPUT_BODY_SENTINEL/);
  assert.doesNotMatch(page, /fullPromptLedgerReportText/);

  const followup = loadFunctions(['toolFollowupPromptReceiptText'], {
    toolFollowupPromptLog: [{
      at: '2026-09-08T22:03:00.000Z',
      kind: 'tool-specific',
      source: 'read_text_file',
      instruction_chars: 29,
      instructions: 'TOOL_FOLLOWUP_BODY_SENTINEL',
    }],
  });
  const followupReport = followup.toolFollowupPromptReceiptText();
  assert.match(followupReport, /instructions: 29 chars; body omitted/);
  assert.doesNotMatch(followupReport, /TOOL_FOLLOWUP_BODY_SENTINEL/);
  assert.doesNotMatch(page, /toolFollowupPromptReportText/);

  const stopReportStart = page.indexOf('function recordingStopReportText(');
  const stopReportEnd = page.indexOf('\n    async function recordAudioStopSnapshots', stopReportStart);
  const stopReportSource = page.slice(stopReportStart, stopReportEnd);
  assert.match(stopReportSource, /Separate Snapshot Artifacts/);
  assert.match(stopReportSource, /Pane bodies are intentionally not duplicated/);
  assert.doesNotMatch(stopReportSource, /recordingSnapshotPaneText\("conversation"\)|recordingSnapshotPaneText\("brain2_mulling"\)|recordingSnapshotPaneText\("events"\)/);

  const contextReceiptStart = page.indexOf('function promptContextSetupLines(');
  const contextReceiptEnd = page.indexOf('\n    function safePromptLedgerJson', contextReceiptStart);
  const contextReceiptSource = page.slice(contextReceiptStart, contextReceiptEnd);
  assert.match(contextReceiptSource, /B1 loaded-note dependencies:/);
  assert.doesNotMatch(contextReceiptSource, /activeLoadedNotes|item\.filename/);

  const stopContext = loadFunctions(['recordingStopReportText'], {
    audioRecordSessionChunks: [],
    audioRecordSessionCoverFilename: '',
    audioRecordSessionCaptions: [],
    currentModelStamp: () => 'test model',
    runPresetLabel: () => 'test preset',
    idleClockLabel: () => 'test clock',
    sensingInputLabel: () => 'none',
    visionCameraActive: () => false,
    micRuntimeLabel: () => 'ready',
    micDeviceReportLabel: () => 'test mic',
    ericAudioRuntimeLabel: () => 'ready',
    autoAudioRecordEnabled: () => false,
    idleDriftLabel: () => 'steady',
    performanceModeLabel: () => 'off',
    brain2MouthBrainEnabled: () => false,
    brain2VoiceLabel: () => 'off',
    promptContextSetupLines: () => ['context receipt'],
    safePromptLedgerJson: () => '{}',
    currentUiSettingsSnapshot: () => ({}),
    uiControlReportText: () => '[none]',
    toolFollowupPromptReceiptText: () => '[none]',
    promptLedgerReceiptReportText: () => '[none]',
    runTelemetryLines: () => ['telemetry receipt'],
    recordingCurationSignals: () => 'curation signal',
    conversationLines: ['CONVERSATION_BODY_SENTINEL'],
    brain2Log: { textContent: 'BRAIN2_BODY_SENTINEL' },
    eventLogLines: ['EVENT_BODY_SENTINEL'],
    countPaneLines: () => 1,
  });
  const stopReport = stopContext.recordingStopReportText({
    recordingResult: { latest: 'audio.webm' },
  });
  assert.match(stopReport, /Separate Snapshot Artifacts/);
  assert.doesNotMatch(stopReport, /CONVERSATION_BODY_SENTINEL|BRAIN2_BODY_SENTINEL|EVENT_BODY_SENTINEL/);
});

test('session updates are fingerprinted before they can reset a warm model cache', () => {
  const context = loadFunctions(['sessionUpdateFingerprint'], {});
  const base = {
    type: 'realtime',
    instructions: 'stable context',
    qwen3_tts_speaker: 'Eric',
    tools: [{ type: 'function', name: 'get_brain_status' }],
    tool_choice: 'auto',
    turn_detection: { interrupt_response: true },
  };
  assert.equal(
    context.sessionUpdateFingerprint(base),
    context.sessionUpdateFingerprint(JSON.parse(JSON.stringify(base))),
  );
  assert.notEqual(
    context.sessionUpdateFingerprint(base),
    context.sessionUpdateFingerprint({ ...base, instructions: 'changed context' }),
  );
});

test('Brain2 advisories are appended at a turn boundary instead of rewriting the warm B1 session', () => {
  const start = page.indexOf('const mouthText = String(result.mouth_text || "").trim();');
  const end = page.indexOf('      } catch (error) {', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = page.slice(start, end);
  assert.match(block, /let brain2AdvisoryChanged = false;/);
  assert.match(block, /appendBrain2AdvisoryToConversation\(\{ reason: "arrived during user speech" \}\)/);
  assert.doesNotMatch(block, /updateSessionTools\(/);
  assert.match(page, /function brain2AdvisoryProtocolInstructions\(\)/);
  assert.match(page, /function appendBrain2AdvisoryToConversation\(/);
  assert.match(page, /role: "assistant",\s*content: \[\{ type: "output_text", text \}\]/);
  assert.match(page, /appendBrain2AdvisoryToConversation\(\{ reason: "typed user turn" \}\)/);
  assert.match(page, /appendBrain2AdvisoryToConversation\(\{ reason: "user speech started" \}\)/);
  const sessionStart = page.indexOf('function updateSessionTools(');
  const sessionEnd = page.indexOf('\n    function enabledToolList()', sessionStart);
  assert.match(page.slice(sessionStart, sessionEnd), /buildSessionInstructions\(\{ includeBrain2Advisory: false \}\)/);
});

test('a Brain2 advisory is deduplicated per realtime socket and stays out of the visible user turn', () => {
  const socket = { name: 'current socket' };
  const sent = [];
  const ledger = [];
  const brain2Log = [];
  const context = loadFunctions(['appendBrain2AdvisoryToConversation'], {
    ws: socket,
    lastBrain2AdvisorySocket: null,
    lastBrain2AdvisoryText: '',
    realtimeConnected: () => true,
    performanceModeEnabled: () => false,
    formatBrain2AdvisoryContent: () => 'Current snapshot. Keep the next reply brief.',
    send: (event) => sent.push(event),
    rememberPromptLedger: (entry) => ledger.push(entry),
    logBrain2: (...entry) => brain2Log.push(entry),
  });
  assert.equal(context.appendBrain2AdvisoryToConversation({ reason: 'test' }), true);
  assert.equal(context.appendBrain2AdvisoryToConversation({ reason: 'test again' }), false);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, 'conversation.item.create');
  assert.equal(sent[0].item.role, 'assistant');
  assert.match(sent[0].item.content[0].text, /^\[B2 advisory\]/);
  assert.match(sent[0].item.content[0].text, /Private runtime context, not spoken dialogue/);
  assert.match(sent[0].item.content[0].text, /\[End B2 advisory\]$/);
  assert.equal(ledger.length, 1);
  assert.deepEqual(brain2Log[0], ['advisory queued', 'test']);
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
  assert.match(page, /return loadFreshContinuityContext\(\{\s*source: "Connect Previous"/);
  assert.match(page, /preflightComplete: true/);
  assert.match(page, /continuityParentForCurrentRun/);
});

test('Connect Select exposes one-item checklist management and archive', () => {
  assert.match(page, /id="continuitySessionList" role="listbox"/);
  assert.match(page, /<select id="continuitySessionSelect" hidden/);
  assert.doesNotMatch(page, /id="selectContinuitySession"/);
  assert.match(page, /id="openSessionMap"[^>]*>Map<\/button>/);
  assert.match(page, /id="archiveContinuitySession"[^>]*>Archive<\/button>/);
  assert.match(page, /id="advancedConnectionExpando"/);
  assert.match(page, /id="continuityScrubMode"/);
  assert.match(page, /value="raw">Full \.txt/);
  assert.match(page, /value="scrubbed">Scrubbed/);
  assert.match(page, /value="summary">Summary/);
  assert.match(page, /function continuityScrubModeLabel/);
  assert.match(page, /function continuityVariantRecord/);
  assert.match(page, /resume_form/);
  assert.match(page, /loadContinuityScrubMode\(\)/);
  assert.match(page, /Connection note flavor is/);
  assert.match(page, /function setSelectedContinuitySessionFilename\(filename\)/);
  assert.match(page, /querySelectorAll\(['"]\.session-choice['"]\)/);
  assert.match(page, /\/api\/continuity\/archive/);
  assert.match(page, /function openSessionMapWindow\(\)/);
  assert.match(page, /function handleSessionMapMessage\(event\)/);
  assert.match(page, /robot790-continuity-session-map/);
  assert.match(page, /const refreshed = await fetchContinuitySessions\(\)/);
  assert.match(page, /Nothing is destroyed/);
});

test('session saves carry sensing-eye capture receipts into their archive package', () => {
  assert.match(page, /const sensingEyeSessionAssetFilenames = new Set\(\)/);
  assert.match(page, /function rememberSensingEyeSessionAsset\(filename\)/);
  assert.match(page, /sensing_eye_filenames: Array\.isArray\(sensingEyeFilenames\)/);
  assert.match(page, /sensingEyeSessionAssetFilenames\.clear\(\)/);
  assert.match(page, /function flushSensingEyeInboxForSessionSave\(\)/);
  assert.match(page, /await flushSensingEyeInboxForSessionSave\(\)/);
  assert.match(page, /session-scoped sensing-eye captures will move with it/);
  assert.match(sessionMapPage, /\["Eye captures", `\$\{Number\(item\.sensing_eye_asset_count \|\| 0\)\.toLocaleString\(\)\} session-scoped`\]/);
  assert.match(sessionMapPage, /session-scoped eye captures/);
});

test('session map page ships as a standalone chooser', () => {
  assert.match(sessionMapPage, /RObot-790 Session Map/);
  assert.match(sessionMapPage, /\/api\/continuity\/sessions/);
  assert.match(sessionMapPage, /\/api\/continuity\/archive/);
  assert.match(sessionMapPage, /robot790-continuity-session-map/);
  assert.match(sessionMapPage, /Resume form/);
  assert.match(sessionMapPage, /resume_form: resumeForm/);
  assert.doesNotMatch(sessionMapPage, /className = "session-path"/);
  assert.match(sessionMapPage, /\["Source", sessionPathDisplay\(item\.filename\)\]/);
  assert.doesNotMatch(sessionMapPage, /id="archive"/);
  assert.match(sessionMapPage, /parentButton\.textContent = "Previous"/);
  assert.match(sessionMapPage, /archiveButton\.textContent = "Archive"/);
  assert.match(sessionMapPage, /\.detail-actions\s*\{\s*display: grid;\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/);
  assert.match(sessionMapPage, /\.detail-actions button\s*\{\s*min-width: 0;\s*min-height: 30px;/);
  assert.doesNotMatch(sessionMapPage, /id="selectInSts"/);
  assert.match(sessionMapPage, /let collapsedLineageNodes = new Set\(\)/);
  assert.match(sessionMapPage, /className = "tree-toggle"/);
  assert.match(sessionMapPage, /aria-expanded/);
  assert.match(sessionMapPage, /toggle\.textContent = expanded \? "-" : "\+"/);
  assert.match(sessionMapPage, /\.root\s*\{\s*padding-left: 18px;\s*border-left: 0;/);
  assert.doesNotMatch(sessionMapPage, /\.root > \.branch-row \.tree-toggle/);
  const renderBranchStart = sessionMapPage.indexOf('function renderBranch(');
  const renderBranchEnd = sessionMapPage.indexOf('\n    function renderNode(', renderBranchStart);
  const renderBranchSource = sessionMapPage.slice(renderBranchStart, renderBranchEnd);
  assert.ok(renderBranchSource.indexOf('branch.append(renderBranch(child, children, visited));')
    < renderBranchSource.indexOf('branch.append(renderNode(item, { hasChildren, expanded }));'));
  const scripts = Array.from(sessionMapPage.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/g), match => match[1]);
  assert.ok(scripts.length);
  scripts.forEach((source, index) => new vm.Script(source, { filename: `session-map-inline-${index}.js` }));
});

test('session map panels have compact, plain resize rails', () => {
  assert.match(sessionMapPage, /--panel-divider-size: 10px/);
  assert.match(sessionMapPage, /id="sessionsResizeHandle"[^>]+role="separator"[^>]+tabindex="0"/);
  assert.match(sessionMapPage, /id="detailsResizeHandle"[^>]+role="separator"[^>]+tabindex="0"/);
  assert.match(sessionMapPage, /\.panel-divider\s*\{[^}]*touch-action: none/);
  assert.match(sessionMapPage, /function beginPanelResize\(event, kind, handle\)/);
  assert.match(sessionMapPage, /function resizePanelFromKeyboard\(event, kind\)/);
  assert.match(sessionMapPage, /PANEL_LAYOUT_STORAGE_KEY/);
  assert.match(sessionMapPage, /localStorage\.setItem\(PANEL_LAYOUT_STORAGE_KEY/);
  assert.doesNotMatch(sessionMapPage, /ResizeObserver|addEventListener\("resize"/);
});

test('session titles keep timestamps in the filename record rather than the bold caption', () => {
  const filename = 'sessions/20260907-175329-daily-driver-empty-boot.txt';
  const mapContext = loadFunctions(['noteBasename', 'sessionTitle', 'sessionDisplayName', 'normalizeFilename', 'sessionPathDisplay'], {}, sessionMapPage);
  const stsContext = loadFunctions(['notePathBasename', 'sessionNoteTitle', 'sessionNoteStamp', 'sessionNoteDisplayName'], {});
  assert.equal(mapContext.sessionTitle(filename), 'daily driver empty boot');
  assert.equal(mapContext.sessionDisplayName(filename), 'daily driver empty boot - 2026-09-07 17:53:29');
  assert.equal(mapContext.sessionPathDisplay(filename), '20260907-175329-daily-driver-empty-boot.txt');
  assert.equal(mapContext.sessionPathDisplay('notes/core/robot.txt'), 'notes/core/robot.txt');
  assert.equal(stsContext.sessionNoteTitle(filename), 'daily driver empty boot');
  assert.equal(stsContext.sessionNoteStamp(filename), '20260907-175329');
  assert.equal(stsContext.sessionNoteDisplayName(filename), 'daily driver empty boot - 2026-09-07 17:53:29');
  assert.match(sessionMapPage, /title\.textContent = `\$\{item\.filename === currentFilename \? "\* " : ""\}\$\{sessionTitle\(item\.filename\)\}`/);
  assert.match(sessionMapPage, /title\.textContent = sessionTitle\(item\.filename\);/);
  assert.match(page, /const displayName = sessionNoteTitle\(filename\);/);
  assert.match(page, /meta\.textContent = sessionNoteStamp\(filename\);/);
});

test('selecting a hidden lineage descendant reopens its ancestors', () => {
  const collapsed = new Set(['sessions/root.txt', 'sessions/parent.txt']);
  const context = loadFunctions(['normalizeFilename', 'lineageKey', 'expandLineageTo'], {
    sessions: [
      { filename: 'sessions/root.txt', parent_session_filename: '' },
      { filename: 'sessions/parent.txt', parent_session_filename: 'sessions/root.txt' },
      { filename: 'sessions/child.txt', parent_session_filename: 'sessions/parent.txt' },
    ],
    collapsedLineageNodes: collapsed,
  }, sessionMapPage);
  context.expandLineageTo('sessions/child.txt');
  assert.deepEqual(Array.from(collapsed), []);
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

test('session restore wrapper makes the Created header the authoritative save time', () => {
  const context = loadFunctions(['loadedNoteLooksLikeSessionNote', 'continuityCreatedAt', 'loadedNoteRestoreEnvelope'], {
    shortDuration: () => 'one hour',
  });
  const envelope = context.loadedNoteRestoreEnvelope({
    content: [
      'STS Session Note',
      '================',
      'Created: 2026-09-08T09:20:22-04:00',
      'Transcript Since Clean Connect',
      '------------------------------',
      '[9:20:22 AM] You: Hello.',
    ].join('\n'),
  });

  assert.match(envelope, /Authoritative session save timestamp: 2026-09-08T09:20:22-04:00/);
  assert.match(envelope, /answer from that Created timestamp/);
  assert.match(envelope, /Do not infer it from transcript turns or say the note lacks a date/);
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

test('eye salience defaults to seven while preserving an explicit saved zero', () => {
  for (const [saved, expected] of [[null, '7'], ['', '7'], ['oops', '7'], ['0', '0'], ['5', '5'], ['12', '10'], ['-1', '0']]) {
    const context = loadFunctions(['loadSensingEyeSalience'], {
      sensingEyeSalience: { value: '7' },
      sensingEyeSalienceStorageKey: 'eye-salience',
      localStorage: { getItem: () => saved },
      updateSensingEyeSalienceUi: () => {},
    });
    context.loadSensingEyeSalience();
    assert.equal(context.sensingEyeSalience.value, expected, `saved ${saved}`);
  }
});

test('note flavors only select source-linked variants that are actually available', () => {
  const stored = new Map([['note-flavor', 'dense_summary']]);
  const context = loadFunctions([
    'selectedContinuitySessionFilename', 'normalizeContinuityScrubMode', 'continuityScrubModeLabel',
    'continuitySessionRecord', 'continuityVariantRecord', 'continuityScrubModeAvailable',
    'currentContinuityScrubMode', 'continuityScrubModeStatusText',
    'updateContinuityScrubModeUi', 'loadContinuityScrubMode',
  ], {
    continuitySessionSelect: { value: 'sessions/chosen.txt' },
    continuitySessions: [{
      filename: 'sessions/chosen.txt',
      variants: [
        { key: 'raw', status: 'available' },
        { key: 'scrubbed', status: 'available' },
        { key: 'summary', status: 'missing' },
      ],
    }],
    continuityScrubMode: {
      value: 'dense_summary',
      options: [
        { value: 'raw', disabled: false, textContent: '' },
        { value: 'scrubbed', disabled: false, textContent: '' },
        { value: 'summary', disabled: false, textContent: '' },
      ],
    },
    continuityScrubModeStatus: { textContent: '' },
    continuityScrubModeStorageKey: 'note-flavor',
    localStorage: { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) },
  });
  context.loadContinuityScrubMode();
  assert.equal(context.continuityScrubMode.value, 'raw');
  assert.equal(stored.get('note-flavor'), 'raw');
  assert.equal(context.continuityScrubModeLabel(), 'Full .txt');
  assert.match(context.continuityScrubModeStatus.textContent, /as written/);
  assert.equal(context.continuityScrubMode.options[2].disabled, true);

  context.continuitySessions[0].variants[2].status = 'available';
  context.continuityScrubMode.value = 'summary';
  context.updateContinuityScrubModeUi();
  assert.equal(context.continuityScrubMode.value, 'summary');
  assert.equal(stored.get('note-flavor'), 'summary');
  assert.match(context.continuityScrubModeStatus.textContent, /checked against its source/);
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
    'normalizeContinuityScrubMode',
    'fetchContinuitySessionMetadata',
    'resolveContinuitySessionForLoad',
    'continuityLoadReferenceIssues',
    'confirmContinuitySessionLoad',
    'ericMemoryNoteContexts',
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
          load_filename: 'sessions/chosen.txt',
          resume_form: 'raw',
          resume_form_label: 'Full .txt',
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
    resumeForm: 'raw',
  });

  assert.deepEqual(reads, ['sessions/chosen.txt', 'shared.txt']);
  assert.deepEqual(Array.from(context.loadedNoteContexts, note => [note.filename, note.content]), [
    ['sessions/chosen.txt', files.get('sessions/chosen.txt')],
    ['shared.txt', 'NEW DISK CONTENT'],
  ]);
  assert.deepEqual(Array.from(result.restored_pinned_notes), ['shared.txt']);
});

test('continuity load preflight exposes missing lineage and lets the operator cancel before reset', async () => {
  const events = [];
  const choices = [];
  const context = loadFunctions([
    'continuityLoadReferenceIssues', 'confirmContinuitySessionLoad',
  ], {
    window: { confirm: message => { choices.push(message); return false; } },
    log: () => {},
    events: {},
    recordUiEvent: (...args) => events.push(args),
  });
  const session = {
    session_filename: 'sessions/child.txt',
    parent_session_filename: 'sessions/parent.txt',
    parent_session_status: 'missing',
    pinned_notes: [
      { filename: 'sessions/parent.txt', status: 'ok', current_status: 'missing' },
      { filename: 'core/still-here.txt', status: 'ok', current_status: 'match' },
    ],
  };

  assert.deepEqual(
    Array.from(context.continuityLoadReferenceIssues(session), item => [item.kind, item.filename]),
    [
      ['parent lineage', 'sessions/parent.txt'],
      ['pinned context', 'sessions/parent.txt'],
    ],
  );
  await assert.rejects(
    context.confirmContinuitySessionLoad(session, { source: 'Connect Selected' }),
    error => error.code === 'continuity_load_canceled',
  );
  assert.match(choices[0], /Cancel: keep the current browser context unchanged\./);
  assert.equal(events[0][0], 'session load canceled for unresolved references');

  context.window.confirm = () => true;
  const accepted = await context.confirmContinuitySessionLoad(session, { source: 'Connect Selected' });
  assert.equal(accepted.length, 2);
  assert.equal(events[1][0], 'session load proceeded with unresolved references');
});

test('continuity load preflight happens before fresh or previous context is cleared', () => {
  const freshStart = page.indexOf('    async function loadFreshContinuityContext(');
  const freshEnd = page.indexOf('\n    }\n', freshStart);
  const fresh = page.slice(freshStart, freshEnd);
  assert.ok(fresh.indexOf('await confirmContinuitySessionLoad') < fresh.indexOf('resetSessionContextForConnection'));

  const previousStart = page.indexOf('    async function loadPreviousContinuityContext(');
  const previousEnd = page.indexOf('\n    }\n', previousStart);
  const previous = page.slice(previousStart, previousEnd);
  assert.match(previous, /return loadFreshContinuityContext\(/);
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
  // A new session already has two of its own calls outstanding.
  context.pendingToolCalls = 2;
  resolveTool({ status: 'ok' });
  await pending;

  assert.equal(context.pendingToolCalls, 2);
  assert.deepEqual(oldSocket.sends, []);
  assert.deepEqual(newSocket.sends, []);
});

test('a Brain2 mouth request finishing after reconnect cannot speak or repopulate advisories', async () => {
  let finishDisplay;
  const spoken = [];
  const outputs = [];
  const context = loadFunctions(['surfaceBrain2MouthText', 'brain2LoopGuardText', 'triggerBrain2Mull'], {
    realtimeSessionGeneration: 1, ws: {}, brain2InFlight: false,
    brain2EvidenceGeneration: 0, lastUserTurnActivityAt: 0, brain2HeadlinesDue: () => false,
    brain2NoteCandidates: [], brain2QuestionCandidates: [], brain2RevisionCandidates: [],
    userSpeechActive: false, brain2BlockedReason: () => '',
    updateBrain2Controls: () => {}, updateLanePressure: () => {},
    bumpBrain2Counter: () => {}, logBrain2: () => {},
    scheduleBrain2Mull: () => {}, maybeArmIdleHardBrakeFromBrain2Note: () => {},
    brain2EchoesRecentVoice: () => false, brain2EchoesRecentBrain2: () => false,
    brain2MouthCanSurface: () => true, brain2MouthBrainEnabled: () => true,
    brain2UserPresentButBusy: () => false,
    requestBrain2Mull: async () => ({ mouth_text: 'OLD VOICE', note_for_eric: 'OLD NOTE' }),
    setMouthText: () => new Promise(resolve => { finishDisplay = resolve; }),
    speakBrain2Monitor: text => spoken.push(text),
    rememberBrain2Output: (...args) => outputs.push(args),
  });
  const pending = context.triggerBrain2Mull();
  await new Promise(setImmediate);
  assert.equal(typeof finishDisplay, 'function');
  context.realtimeSessionGeneration = 2;
  context.ws = {};
  context.brain2InFlight = true;
  finishDisplay();
  await pending;
  assert.deepEqual(spoken, []);
  assert.deepEqual(outputs, []);
  assert.equal(context.brain2NoteCandidates.length, 0);
  assert.equal(context.brain2InFlight, true);

  // The same path must still work normally inside its own session.
  context.setMouthText = async () => {};
  await context.triggerBrain2Mull();
  assert.deepEqual(spoken, ['OLD VOICE']);
  assert.deepEqual(outputs, [['mouth', 'OLD VOICE'], ['note', 'OLD NOTE']]);
  assert.equal(context.brain2NoteCandidates[0].text, 'OLD NOTE');
  assert.equal(context.brain2InFlight, false);
});

test('a late Brain2 HTTP response cannot add the old prompt to a new session ledger', async () => {
  const prompts = [];
  let finishRequest;
  const context = loadFunctions(['requestBrain2Mull'], {
    realtimeSessionGeneration: 1, ws: {}, URL,
    brain2EvidenceGeneration: 0, userSpeechActive: false,
    brain2EvidenceSnapshot: () => ({ evidence_generation: 0, user_key: 'old', fingerprint: 'old' }),
    location: { href: 'http://127.0.0.1:8790/' }, lastInputVoiceShape: '',
    currentBrain2PersonFocus: () => 5, brain2ConversationContext: () => 'OLD CONVERSATION',
    brain2RecentIdleContext: () => '', brain2RecentOutputContext: () => '',
    rememberBrain2Prompt: entry => prompts.push(entry),
    fetch: () => new Promise(resolve => { finishRequest = resolve; }),
  });
  const pending = context.requestBrain2Mull();
  context.realtimeSessionGeneration = 2;
  context.ws = {};
  finishRequest({ ok: true, json: async () => ({ status: 'ok', note_for_eric: 'OLD NOTE' }) });
  await pending;
  assert.deepEqual(prompts, []);
});

test('a deliberate quiet Brain2 result succeeds without speech, advisories, or failure backoff', async () => {
  const counters = [];
  const outputs = [];
  const context = loadFunctions(['brain2LoopGuardText', 'triggerBrain2Mull'], {
    realtimeSessionGeneration: 1, ws: {}, brain2InFlight: false,
    brain2EvidenceGeneration: 0, lastUserTurnActivityAt: 0, brain2HeadlinesDue: () => false,
    brain2FailureStreak: 1, brain2BackoffUntil: 0, lastBrain2MullAt: 0,
    brain2NoteCandidates: [], brain2QuestionCandidates: [], brain2RevisionCandidates: [],
    userSpeechActive: false, brain2BlockedReason: () => '',
    updateBrain2Controls: () => {}, updateLanePressure: () => {}, logBrain2: () => {},
    bumpBrain2Counter: name => counters.push(name),
    surfaceBrain2MouthText: text => outputs.push(text),
    rememberBrain2Output: (...args) => outputs.push(args),
    requestBrain2Mull: async () => ({
      status: 'ok', mouth_text: '', note_for_eric: '', question: '',
      revision_candidate: '', should_surface: false, reason: 'Nothing new to add.',
    }),
  });

  await context.triggerBrain2Mull();
  assert.deepEqual(counters, ['fired']);
  assert.deepEqual(outputs, []);
  assert.equal(context.brain2NoteCandidates.length, 0);
  assert.equal(context.brain2QuestionCandidates.length, 0);
  assert.equal(context.brain2RevisionCandidates.length, 0);
  assert.equal(context.brain2FailureStreak, 0);
  assert.equal(context.brain2BackoffUntil, 0);
  assert.equal(context.brain2InFlight, false);
  assert.ok(context.lastBrain2MullAt > 0);
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
    loadedNoteRestoreEnvelope: () => '',
    loadedNotePromptContent: item => item.content,
    clippedLoadedNotePromptContent: (_, content) => content,
    noteFilenameIsCurrentContinuitySession: () => false,
  });
}

function connectionContext() {
  const context = memoryContext();
  const noop = () => {};
  Object.assign(context, {
    realtimeSessionGeneration: 1,
    brain2EvidenceGeneration: 0, brain2LastEvidence: null,
    currentContinuitySessionFilename: 'sessions/old.txt',
    continuityParentForCurrentRun: 'sessions/old.txt',
    conversationLines: ['OLD CONVERSATION'], conversationLineMetadata: [],
    brain2NoteCandidates: [{ text: 'OLD ADVICE' }],
    recentAssistantOutputs: ['OLD REPLY'], searchContextReceipts: [{ query: 'OLD SEARCH' }],
    visionImageUrl: 'old-image', visionImageName: 'old.png', visionImageStaged: true,
    brain2Log: {}, contextPanel: { open: false }, visionHint: {},
    clearInputDraft: noop, resetConversationReengageCycle: noop,
    clearBrain2Timer: noop, clearBrain2SurfaceTimer: noop, clearAssistantFinishTimer: noop,
    cancelBrain2MonitorSpeech: noop,
    clearUserTurnPending: noop, renderConversation: noop, renderEvents: noop,
    updateBrain2Controls: noop, renderAllLogPopouts: noop, updateSessionTools: noop,
    recordUiEvent: noop, renderMemory: noop, formatProsodyForTranscript: () => '',
    realtimeConnected: () => false, firstContactModeEnabled: () => false,
    performanceModeEnabled: () => false,
    resolveContinuitySessionForLoad: async () => ({ status: 'ok', session_filename: 'sessions/resume.txt' }),
    confirmContinuitySessionLoad: async () => {},
    clearSensingEyeState: () => {
      context.visionImageUrl = ''; context.visionImageName = ''; context.visionImageStaged = false;
      context.sensingTextName = ''; context.sensingTextContent = '';
    },
    readTextFile: async ({ filename, pin = true }) => {
      const note = { status: 'ok', filename, content: filename.startsWith('core/') ? 'CORE MEMORY' : 'NEW NOTE' };
      if (pin) context.rememberLoadedNoteContext(note);
      return note;
    },
    loadCurrentContinuitySession: async ({ sessionMetadata }) => {
      context.currentContinuitySessionFilename = sessionMetadata.session_filename;
      context.continuityParentForCurrentRun = sessionMetadata.session_filename;
      await context.readTextFile({ filename: sessionMetadata.session_filename });
      return sessionMetadata;
    },
    visionCameraActive: () => false, browserFaceControllerActive: () => true,
    idleToolAllowedNames: new Set(['searchTools', 'sensingEyeHistoryTools']),
    embodimentTools: () => [{ name: 'embodiment' }],
    currentSensingEyeHistoryItem: () => null, addSensingEyeVisualNoteTranscriptMarker: noop,
    sensingEyeSalienceInstruction: () => '', updateVisionButtons: noop, scheduleIdlePonder: noop,
    send: noop, brain2LoopPressureInstruction: () => '',
    location: { origin: 'http://localhost:8790' }, runtimeConfig: {},
    currentModelStamp: () => 'test', micRuntimeLabel: () => 'off', runtimeWatchReport: () => ({}),
    currentUiSettingsSnapshot: () => ({ tools: { enabled_tools: context.enabledToolList().map(item => item.name) } }),
    safeLoadMemoryFacts: () => [{ name: 'saved_fact', fact: 'AVAILABLE AS IN ANY SESSION' }],
    currentContinuityScrubMode: () => 'raw', continuityScrubModeLabel: () => 'Full .txt',
    sensingInputLabel: () => context.visionImageName || 'none',
    textTail: (text, size) => String(text || '').slice(-size),
    arrayTail: (items, size) => items.slice(-size), recordingSnapshotPaneText: () => '',
    sessionClock: {}, laneIndicatorLabel: {}, recordingIndicatorLabel: {}, toolIndicatorLabel: {},
    maxSearchContextResults: 4, brain2Counters: {}, pendingToolCalls: 0, toolFollowupNeeded: false,
    brain2HeadlineLastAttemptAt: 0,
  });
  for (const name of ['llmVoiceTools', 'llmUiControlTools', 'llmBodySensorTools', 'llmTools',
    'llmChassisTools', 'llmMemoryTools', 'llmWebSearchTools', 'llmWebPageTools', 'llmImageTools',
    'llmCastMediaTools', 'llmSmartHomeTools', 'llmNoteFileTools']) context[name] = { checked: true };
  for (const name of ['deliberationTools', 'voiceTools', 'uiControlTools', 'runtimeWatchTools',
    'bodySensorTools', 'faceTools', 'chassisTools', 'memoryTools', 'searchTools', 'webPageTools',
    'imageTools', 'sensingEyeTools', 'sensingEyeHistoryTools', 'browserFaceSensingEyeTools',
    'castMediaTools', 'smartHomeTools', 'noteFileTools']) context[name] = [{ name }];
  return loadFunctions([
    'clearHotConversationState', 'resetSessionContextForConnection', 'loadCoreNoteContext',
    'loadFreshContinuityContext', 'loadPreviousContinuityContext', 'listPinnedNotes',
    'currentPromptContextModeKey', 'realtimeContextModeLabel', 'currentPromptContextModeLabel',
    'conversationDisplayTextRange', 'conversationLineMetadataFor', 'conversationLineTimeLabel',
    'conversationTranscriptSinceCleanConnect', 'conversationTimeSpanSnapshot',
    'enabledToolList', 'idleEnabledToolList', 'stageVisionImage', 'formatBrain2AdvisoryContent',
    'buildEricContinuityState', 'currentRunSetupSnapshot',
  ], context);
}

function sensingContext() {
  const noop = () => {};
  const element = () => ({ value: '', textContent: '', removeAttribute: noop, classList: { add: noop, remove: noop } });
  const context = loadFunctions([
    'requireCurrentSensingEyeLoad', 'clearSensingEyeState', 'setVisionImageFromDrawable',
    'setSensingTextContent', 'prepareVisionImage', 'prepareSensingText',
    'applySensingEyeInboxItem', 'pollSensingEyeInbox', 'selectSensingEyeImage',
  ], {
    sensingEyeGeneration: 1, sensingEyeClientId: 'this-browser',
    sensingEyeInboxClearInFlight: false, sensingEyeInboxLastSeq: 0,
    sensingEyeInboxIgnoreSeqThrough: 0, sensingEyeFaceCommandIgnoreSeqThrough: 0,
    handledSensingEyeInboxSeqs: new Set(), sensingEyeInboxPollInFlight: false,
    visionImageUrl: 'OLD IMAGE', visionImageName: 'old.jpg', visionImageStaged: true,
    sensingTextContent: 'OLD TEXT', sensingTextName: 'old.txt',
    sensingEyeImageHistory: [{ id: 'saved-image' }], sensingEyeTextHistory: [{ id: 'saved-text' }],
    visionFile: element(), visionPreview: element(), visionDrop: element(), visionHint: element(),
    contextPanel: { open: false }, window: {}, location: { href: 'http://localhost:8790/' }, URL,
    document: { createElement: () => ({ getContext: () => ({ fillRect: noop, drawImage: noop }), toDataURL: () => 'NEW IMAGE' }) },
    visionMaxEdgePx: 1024, visionJpegQuality: 0.9, maxSensingTextChars: 2000,
    audioRecordingActive: () => false, approximateTextTokens: text => text.length / 4,
    sensingInputLabel: () => 'old input', sensingEyeMemoryContext: () => ({}),
    filenameFromPath: text => text, loadImage: async () => ({ width: 10, height: 10 }),
    clearSensingEyeInboxOnServer: async () => ({ latest_seq: 10 }), clearBrowserFaceCaptureQueue: async () => null,
    saveSensingEyeVisualNote: async () => ({}), saveSensingEyeTextNote: async () => ({}),
    rememberSensingEyeImage: item => item, rememberSensingEyeText: item => item,
    updateVisionButtons: noop, updateSessionTools: noop, log: noop, events: {}, recordUiEvent: noop,
    addSensingEyeVisualNoteTranscriptMarker: noop, stageVisionImage: noop,
    rememberSensingEyeSessionAsset: noop, rolloverAudioRecordingForVisualChange: noop,
    scheduleIdlePonder: noop, scheduleSensingEyeInboxPoll: noop,
  });
  return context;
}

for (const coreNotesOnly of [true, false]) {
  test(`connection (${coreNotesOnly ? 'core' : 'resume'}) waits for the real eye clear and preserves saved eye history`, async () => {
    const context = connectionContext();
    const eye = sensingContext();
    Object.assign(context, eye);
    let finishClear;
    context.clearSensingEyeInboxOnServer = () => new Promise(resolve => { finishClear = resolve; });
    loadFunctions(['clearSensingEyeState'], context);
    const pending = context.loadFreshContinuityContext({ coreNotesOnly });
    await new Promise(setImmediate);
    assert.equal(context.visionImageUrl, '');
    assert.equal(context.sensingTextContent, '');
    assert.equal(context.sensingEyeInboxClearInFlight, true);
    assert.equal(context.loadedNoteContexts.length, 0);
    finishClear({ latest_seq: 10 });
    await pending;
    assert.equal(context.sensingEyeGeneration, 2);
    assert.equal(context.sensingEyeInboxClearInFlight, false);
    assert.equal(context.visionImageStaged, false);
    assert.equal(context.sensingEyeImageHistory[0].id, 'saved-image');
    assert.equal(context.sensingEyeTextHistory[0].id, 'saved-text');
    assert.ok(context.loadedNoteContexts.length > 0);
  });
}

test('a failed startup eye clear aborts continuity loading', async () => {
  const context = connectionContext();
  Object.assign(context, sensingContext());
  loadFunctions(['clearSensingEyeState'], context);
  context.clearSensingEyeInboxOnServer = async () => { throw Error('offline'); };
  await assert.rejects(context.loadFreshContinuityContext({ coreNotesOnly: true }), /Retry Connect/);
  assert.equal(context.loadedNoteContexts.length, 0);
  assert.equal(context.visionImageUrl, '');
});

for (const kind of ['image', 'text']) {
  test(`a ${kind} save finishing after an eye clear cannot reload old content`, async () => {
    const context = sensingContext();
    let finishSave;
    const save = () => new Promise(resolve => { finishSave = resolve; });
    context.saveSensingEyeVisualNote = save;
    context.saveSensingEyeTextNote = save;
    const pending = kind === 'image'
      ? context.setVisionImageFromDrawable({ width: 10, height: 10 }, 'late.jpg')
      : context.setSensingTextContent('LATE TEXT', 'late.txt');
    const rejected = assert.rejects(pending, /Sensing-eye load canceled/);
    await context.clearSensingEyeState({ source: 'session_connect' });
    finishSave({ saved_url: '/old.jpg' });
    await rejected;
    assert.equal(context.visionImageUrl, '');
    assert.equal(context.sensingTextContent, '');
    assert.equal(context.visionImageStaged, false);

    // Input deliberately supplied after the clear still works normally.
    if (kind === 'image') {
      await context.setVisionImageFromDrawable({ width: 10, height: 10 }, 'fresh.jpg', { saveToFilesystem: false });
      assert.equal(context.visionImageName, 'fresh.jpg');
    } else {
      await context.setSensingTextContent('FRESH TEXT', 'fresh.txt', { saveToFilesystem: false });
      assert.equal(context.sensingTextContent, 'FRESH TEXT');
    }
  });
}

test('an inbox image decoding during a clear cannot refill the eye', async () => {
  const context = sensingContext();
  let finishDecode;
  context.loadImage = () => new Promise(resolve => { finishDecode = resolve; });
  const pending = context.applySensingEyeInboxItem({ seq: 5, image_data_url: 'OLD' });
  await context.clearSensingEyeState();
  finishDecode({ width: 10, height: 10 });
  assert.equal(await pending, false);
  assert.equal(context.visionImageUrl, '');
});

test('an inbox poll started before a clear cannot apply its late response', async () => {
  const context = sensingContext();
  let finishFetch;
  context.fetchSensingEyeInboxItem = () => new Promise(resolve => { finishFetch = resolve; });
  const pending = context.pollSensingEyeInbox();
  await context.clearSensingEyeState();
  finishFetch({ seq: 50, image_data_url: 'OLD' });
  await pending;
  assert.equal(context.visionImageUrl, '');
});

test('late mirror commands and old local uploads are ignored even with a new inbox sequence', async () => {
  const context = sensingContext();
  await context.clearSensingEyeState();
  context.sensingEyeFaceCommandIgnoreSeqThrough = 10;
  for (const receipt of [
    { face_command_seq: 9 },
    { client_id: 'this-browser', client_eye_generation: 1 },
  ]) {
    assert.equal(await context.applySensingEyeInboxItem({ seq: 50, image_data_url: 'OLD', ...receipt }), false);
    assert.equal(context.visionImageUrl, '');
  }
  assert.equal(await context.applySensingEyeInboxItem({ seq: 51, face_command_seq: 11, image_data_url: 'NEW' }), true);
  assert.equal(context.visionImageUrl, 'NEW IMAGE');
});

test('Browser Face carries a queued capture sequence, while a manual mirror has no old command', async () => {
  const payloads = [];
  const context = loadFunctions(['captureFaceToEye'], {
    URL, normalizedStsUrl: () => 'http://localhost:8790/', state: {}, timestampLabel: () => 'now',
    browserFaceSnapshot: () => ({ dataUrl: 'IMAGE', width: 10, height: 10 }), setCaptureStatus: () => {},
    fetch: async (_url, options) => {
      payloads.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ status: 'ok' }) };
    },
  }, facePage);
  await context.captureFaceToEye({ commandSeq: 17 });
  await context.captureFaceToEye();
  assert.equal(payloads[0].face_command_seq, 17);
  assert.equal(payloads[1].face_command_seq, 0);
  assert.match(facePage, /reason: command.reason[^\n]*\n\s*commandSeq: seq/);
});

test('a local upload keeps its original eye generation and cannot attach its late save to the new session', async () => {
  const context = sensingContext();
  let finish;
  let payload;
  const assets = [];
  context.rememberSensingEyeSessionAsset = name => assets.push(name);
  context.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    return { ok: true, json: () => new Promise(resolve => { finish = resolve; }) };
  };
  loadFunctions(['saveSensingEyeVisualNote'], context);
  const pending = context.saveSensingEyeVisualNote({ dataUrl: 'OLD IMAGE', name: 'old.jpg' });
  await new Promise(setImmediate);
  await context.clearSensingEyeState();
  finish({ seq: 11, saved_filename: 'old.jpg' });
  await pending;
  assert.equal(payload.client_id, 'this-browser');
  assert.equal(payload.client_eye_generation, 1);
  assert.equal(context.sensingEyeGeneration, 2);
  assert.deepEqual(assets, []);
});

test('file reads and explicit memory recall cannot carry old input across a clear', async () => {
  for (const kind of ['image', 'text', 'recall']) {
    const context = sensingContext();
    let finish;
    const deferred = () => new Promise(resolve => { finish = resolve; });
    context.fileToDataUrl = deferred;
    context.listSensingEyeImages = deferred;
    context.isSensingTextFile = () => true;
    const pending = kind === 'image' ? context.prepareVisionImage({ type: 'image/jpeg', name: 'old.jpg' })
      : kind === 'text' ? context.prepareSensingText({ name: 'old.txt', text: deferred })
        : context.selectSensingEyeImage();
    const rejected = assert.rejects(pending, /Sensing-eye load canceled/);
    await context.clearSensingEyeState();
    finish(kind === 'recall' ? { images: [] } : 'OLD CONTENT');
    await rejected;
    assert.equal(context.visionImageUrl, '');
    assert.equal(context.sensingTextContent, '');
  }
});

test('runtime prompt distinguishes observed browser state, preferences, and unverified devices', () => {
  let recording = false;
  let attached = [];
  const context = loadFunctions(['formatRuntimeStateForInstructions', 'formatRuntimeWatchForInstructions', 'castPlaybackContextLine'], {
    formatLabGoalForInstructions: () => '', micRuntimeLabel: () => 'off', ericAudioRuntimeLabel: () => 'on',
    continuityScrubModeLabel: () => 'Full', continuityScrubModeStatusText: () => '',
    visionCameraActive: () => false, sensingEyeSalienceLabel: () => '7', sensingEyeSalienceStatusText: () => '',
    sensingEyeImageHistoryContextLine: () => '', visionImageUrl: '', sensingTextContent: '',
    audioRecordingActive: () => recording, autoAudioRecordEnabled: () => true,
    runtimeWatchLabel: () => 'none', castPlaybackActive: false, wonderSearchPolicyText: () => '',
    smartHomeTools: [{ name: 'home_action' }], enabledToolList: () => attached,
  });
  let prompt = context.formatRuntimeStateForInstructions();
  assert.match(prompt, /snapshot at prompt assembly/);
  assert.match(prompt, /Current sensing-eye text is absent/);
  assert.match(prompt, /eye is empty right now/);
  assert.doesNotMatch(prompt, /Temporary sensing|Cast playback is inactive|Smart-home tools are enabled/);
  assert.match(prompt, /recorder is not recording; auto-record on microphone start is enabled/);
  assert.match(prompt, /no active playback tracked/);
  assert.match(prompt, /Smart-home tools are not attached/);
  recording = true;
  attached = [{ name: 'home_action' }];
  context.sensingTextContent = 'NEW TEXT';
  context.sensingTextName = 'new.txt';
  prompt = context.formatRuntimeStateForInstructions();
  assert.match(prompt, /recorder is recording/);
  assert.match(prompt, /Current sensing-eye text is present \(new.txt\)/);
  assert.doesNotMatch(prompt, /eye is empty right now/);
  assert.match(prompt, /Smart-home tools are attached to this model request/);
});

for (const coreNotesOnly of [true, false]) {
  test(`${coreNotesOnly ? 'core-note' : 'restored'} connection uses the common reset without changing capabilities`, async () => {
    const context = connectionContext();
    context.loadedNoteContexts = [{ filename: 'old-extra.txt', content: 'OLD' }];
    const tools = JSON.stringify(context.enabledToolList());
    const idleTools = JSON.stringify(context.idleEnabledToolList());
    await context.loadFreshContinuityContext({ coreNotesOnly });
    const expected = [...(coreNotesOnly ? [] : ['sessions/resume.txt']), 'core/erics_memories.txt'];
    assert.deepEqual(Array.from(context.listPinnedNotes().files), expected);
    assert.equal(context.currentPromptContextModeKey(), 'normal');
    assert.equal(context.conversationTranscriptSinceCleanConnect(), '');
    assert.equal(context.brain2NoteCandidates.length, 0);
    assert.equal(context.recentAssistantOutputs.length, 0);
    assert.equal(context.searchContextReceipts.length, 0);
    assert.equal(context.visionImageUrl, '');
    assert.equal(context.realtimeSessionGeneration, 2);
    assert.equal(JSON.stringify(context.enabledToolList()), tools);
    assert.equal(JSON.stringify(context.idleEnabledToolList()), idleTools);
    assert.equal(context.continuityParentForCurrentRun, coreNotesOnly ? '' : 'sessions/resume.txt');
    assert.deepEqual(Array.from(context.currentRunSetupSnapshot().startup_context.startup_notes), expected);
  });
}

test('a core-note connection can pin notes, stage images, receive Brain2 and save all new context', async () => {
  const context = connectionContext();
  context.resolveContinuitySessionForLoad = async () => { throw Error('Must not restore history'); };
  await context.loadFreshContinuityContext({ coreNotesOnly: true });
  await context.readTextFile({ filename: 'new-note.txt' });
  context.realtimeConnected = () => true;
  context.visionImageUrl = 'data:image/png;base64,new';
  context.visionImageName = 'new.png';
  const sent = [];
  context.send = event => sent.push(event);
  context.stageVisionImage();
  assert.equal(sent[0].item.content[1].image_url, context.visionImageUrl);
  assert.equal(context.visionImageStaged, true);
  context.brain2NoteCandidates.push({ text: 'NEW ADVICE', at: Date.now() });
  assert.match(context.formatBrain2AdvisoryContent(), /NEW ADVICE/);
  context.searchContextReceipts.push({ query: 'NEW SEARCH', results: [] });
  context.conversationLines.push('[1:00:00 PM] You: NEW CONVERSATION');
  const state = context.buildEricContinuityState();
  assert.equal(state.context_mode.key, 'normal');
  assert.match(state.conversation.transcript, /NEW CONVERSATION/);
  assert.doesNotMatch(state.conversation.transcript, /OLD/);
  assert.equal(state.loaded_notes.length, 2);
  assert.equal(state.brain2_state.notes_for_eric[0].text, 'NEW ADVICE');
  assert.equal(state.tool_and_search_state.search_receipts[0].query, 'NEW SEARCH');
  assert.equal(state.sensing.image_name, 'new.png');
  assert.equal(state.browser_memory_facts.length, 1);
});

test('a canceled restore leaves the old pins and transcript untouched', async () => {
  const context = connectionContext();
  context.loadedNoteContexts = [{ filename: 'old.txt', content: 'OLD' }];
  context.confirmContinuitySessionLoad = async () => { throw Error('Canceled'); };
  await assert.rejects(context.loadFreshContinuityContext(), /Canceled/);
  assert.equal(context.conversationLines[0], 'OLD CONVERSATION');
  assert.equal(context.loadedNoteContexts[0].filename, 'old.txt');
  assert.equal(context.realtimeSessionGeneration, 1);
});

for (const coreEnabled of [true, false]) {
  test(`the real restore keeps the core preference (${coreEnabled}) when saved pins omit it`, async () => {
    const context = connectionContext();
    context.loadEricMemoriesEnabled = () => coreEnabled;
    loadFunctions(['setLoadedNoteContextsForContinuity', 'loadCurrentContinuitySession'], context);
    await context.loadFreshContinuityContext({
      sessionMetadata: {
        status: 'ok', session_filename: 'sessions/resume.txt', resume_form: 'raw',
        pinned_notes: [{ filename: 'research/example.txt', status: 'ok', current_status: 'match' }],
      },
    });
    assert.deepEqual(Array.from(context.listPinnedNotes().files), [
      'sessions/resume.txt', 'research/example.txt', ...(coreEnabled ? ['core/erics_memories.txt'] : []),
    ]);
  });
}

test('a new connection resets unfinished tool follow-up state', async () => {
  const context = connectionContext();
  Object.assign(context, {
    pendingToolCalls: 2, toolFollowupNeeded: true, responseDoneAfterTool: true,
    toolFollowupExactText: 'OLD REPLY', toolFollowupInstructions: 'OLD INSTRUCTIONS',
  });
  await context.loadFreshContinuityContext({ coreNotesOnly: true });
  assert.equal(context.pendingToolCalls, 0);
  assert.equal(context.toolFollowupNeeded, false);
  assert.equal(context.responseDoneAfterTool, false);
  assert.equal(context.toolFollowupExactText, '');
  assert.equal(context.toolFollowupInstructions, '');
});

test('core-note loading honors an explicit unchecked core preference and reports read failures', async () => {
  const context = connectionContext();
  context.loadEricMemoriesEnabled = () => false;
  await context.loadFreshContinuityContext({ coreNotesOnly: true });
  assert.equal(context.listPinnedNotes().files.length, 0);
  context.loadEricMemoriesEnabled = () => true;
  context.readTextFile = async () => { throw Error('Core file unavailable'); };
  await assert.rejects(context.loadFreshContinuityContext({ coreNotesOnly: true }), /Core file unavailable/);
});

test('missing startup note names the file and the explicit no-core recovery setting', async () => {
  const context = connectionContext();
  const failure = Object.assign(new Error('Note file not found.'), { code: 'note_not_found' });
  context.readTextFile = async () => { throw failure; };
  await assert.rejects(context.loadFreshContinuityContext({ coreNotesOnly: true }), error => {
    assert.match(error.message, /Startup note missing: "notes\/core\/erics_memories\.txt"/);
    assert.match(error.message, /Load Eric memories on refresh/);
    assert.match(error.message, /Robot Controls > Latest Thread/);
    assert.match(error.message, /retry Connect to start without it/);
    assert.equal(error.filename, 'core/erics_memories.txt');
    assert.equal(error.cause, failure);
    return true;
  });
  context.loadEricMemoriesEnabled = () => false;
  await context.loadFreshContinuityContext({ coreNotesOnly: true });
  assert.equal(context.listPinnedNotes().files.length, 0);
});

for (const body of [{ error: 'Note file not found.' }, null]) {
  test(`note read errors include the requested path even with ${body ? 'legacy' : 'non-JSON'} errors`, async () => {
    const context = loadFunctions(['readTextFile'], {
      URL, location: { href: 'http://localhost:8790/' },
      fetch: async () => ({
        ok: false, status: 404, statusText: 'Not Found',
        json: async () => { if (!body) throw Error('Not JSON'); return body; },
      }),
    });
    await assert.rejects(context.readTextFile({ filename: 'core/erics_memories.txt' }), error => {
      assert.match(error.message, /Could not read note "core\/erics_memories\.txt"/);
      assert.equal(error.filename, 'core/erics_memories.txt');
      assert.equal(error.code, 'note_not_found');
      return true;
    });
  });
}

test('successful note reads preserve optional pinning', async () => {
  const note = { status: 'ok', filename: 'core/erics_memories.txt', content: 'CORE MEMORY' };
  const pinned = [];
  const context = loadFunctions(['readTextFile'], {
    URL, location: { href: 'http://localhost:8790/' },
    fetch: async () => ({ ok: true, json: async () => note }),
    log: () => {}, events: {}, rememberLoadedNoteContext: item => pinned.push(item),
  });
  assert.equal(await context.readTextFile({ filename: note.filename, pin: false }), note);
  assert.equal(pinned.length, 0);
  await context.readTextFile({ filename: note.filename });
  assert.deepEqual(pinned, [note]);
});

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

test('all current pins are usable, including notes added after a core-note start', () => {
  const context = memoryContext();
  context.loadedNoteContexts = [
    { filename: 'ordinary.txt', content: 'ordinary' },
    { filename: 'core/erics_memories.txt', content: 'core' },
  ];
  assert.deepEqual(Array.from(context.loadedNoteContextsForCurrentPrompt(), note => note.filename), [
    'ordinary.txt', 'core/erics_memories.txt',
  ]);
});

test('session saves include the entire current transcript', () => {
  const context = loadFunctions([
    'conversationDisplayTextRange', 'conversationLineMetadataFor', 'conversationLineTimeLabel',
    'conversationTranscriptSinceCleanConnect', 'conversationTimeSpanSnapshot',
  ], {
    conversationLines: [
      '[3:52:09 PM] You: Fresh empty turn.',
      '[3:52:14 PM] Robot 790: Fresh reply.',
    ],
    conversationLineMetadata: [
      { local: 'fresh user' },
      { local: 'fresh robot' },
    ],
    conversationProsodyByIndex: {},
    formatProsodyForTranscript: () => '',
    currentContinuitySessionFilename: '',
  });

  assert.equal(context.conversationTranscriptSinceCleanConnect(), [
    '[3:52:09 PM] You: Fresh empty turn.',
    '[3:52:14 PM] Robot 790: Fresh reply.',
  ].join('\n'));
  assert.deepEqual(JSON.parse(JSON.stringify(context.conversationTimeSpanSnapshot())), {
    line_count: 2,
    first_line_at: 'fresh user',
    last_line_at: 'fresh robot',
    continuity_session: 'none',
  });
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

test('browser face turns semantic status tint names into blendable colors', () => {
  const context = loadFunctions(['statusTintHex'], {}, facePage);
  assert.equal(context.statusTintHex('cyan', '#54c6d2'), '#2cdce8');
  assert.equal(context.statusTintHex('PURPLE', '#54c6d2'), '#b482ff');
  assert.equal(context.statusTintHex('#AbC123', '#54c6d2'), '#AbC123');
  assert.equal(context.statusTintHex('not-a-color', '#54c6d2'), '#54c6d2');
  assert.match(facePage, /statusTintHex\(state\?\.status_tint, colorForMood\(mood\)\)/);
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

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

test('the shipped page scripts compile', () => {
  const scripts = Array.from(page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/g), match => match[1]);
  assert.ok(scripts.length > 0);
  scripts.forEach((source, index) => new vm.Script(source, { filename: `sts-inline-${index}.js` }));
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
  assert.match(page, /await confirmContinuitySessionLoad\(sessionMetadata, \{ source: "Connect Previous" \}\)/);
  assert.match(page, /preflightComplete: true/);
  assert.match(page, /continuityParentForCurrentRun/);
});

test('Connect Select exposes one-item checklist management and archive', () => {
  assert.match(page, /id="continuitySessionList" role="listbox"/);
  assert.match(page, /<select id="continuitySessionSelect" hidden/);
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
  assert.ok(fresh.indexOf('await confirmContinuitySessionLoad') < fresh.indexOf('clearHotConversationState'));

  const previousStart = page.indexOf('    async function loadPreviousContinuityContext(');
  const previousEnd = page.indexOf('\n    }\n', previousStart);
  const previous = page.slice(previousStart, previousEnd);
  assert.ok(previous.indexOf('await confirmContinuitySessionLoad') < previous.indexOf('clearHotConversationState'));
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

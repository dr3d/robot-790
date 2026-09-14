const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');
function load(c, names) {
  for (const name of names) {
    const start = html.indexOf(`    function ${name}(`);
    const end = html.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start, name);
    vm.runInContext(html.slice(start, end + 6), c);
  }
}
function fixture() {
  const stored = new Map([['legacy', 'true']]);
  const c = vm.createContext({ performanceMode: { checked: true }, performanceAutoUntil: Date.now() + 480000,
    performancePrompt: 'OLD STAGE HANDOFF', performanceModeStorageKey: 'legacy',
    localStorage: { removeItem: key => stored.delete(key) },
    resetConversationReengageCycle() {}, lastUserText: '', recentUserTexts: [] });
  load(c, ['manualPerformanceModeEnabled', 'performanceModeEnabled', 'performanceModeLabel',
    'loadPerformanceMode', 'savePerformanceMode', 'performancePromptContext', 'noteUserText']);
  return { c, stored };
}
test('legacy manual/automatic activation cannot enable parked mode and is cleared on load', () => {
  const { c, stored } = fixture();
  assert.equal(c.performanceModeEnabled(), false);
  assert.equal(c.manualPerformanceModeEnabled(), false);
  assert.equal(c.performancePromptContext(), '');
  c.loadPerformanceMode();
  assert.equal(c.performanceMode.checked, false); assert.equal(c.performanceAutoUntil, 0);
  assert.equal(c.performancePrompt, ''); assert.equal(stored.has('legacy'), false);
  assert.equal(c.performanceModeLabel(), 'disabled');
});
test('stage language stays dialogue without automatic mode activation or its preset/control', () => {
  const { c } = fixture(); c.loadPerformanceMode();
  for (const text of ['Comedy act coming up', 'take it away', 'work the room', 'performance mode']) {
    c.noteUserText(text);
    assert.equal(c.lastUserText, text);
    assert.equal(c.performanceModeEnabled(), false);
    assert.equal(c.performanceAutoUntil, 0);
  }
  assert.doesNotMatch(html, /userRequestedPerformance|armPerformanceMode|performance_set/);
  assert.match(html, /id="performanceMode" type="hidden"/);
});
test('even stale stage flags preserve pinned history and the normal attention ramp', () => {
  const { c } = fixture();
  Object.assign(c, {
    firstContactModeEnabled: () => false, idleSubstrateTestEnabled: () => false,
    currentIdleDrift: () => 7, idleTiming: () => ({ attention_enabled: true }),
    baseSessionInstructionSections: () => ({ identity: 'ERIC', operating: 'RULES' }),
    formatCreatureForInstructions: () => 'CREATURE', formatRuntimeBehaviorRulesForInstructions: () => '',
    wonderSearchPolicyText: () => '', brain2AdvisoryProtocolInstructions: () => '', runtimeContextProtocolInstructions: () => '',
    formatMemoryForInstructions: () => 'PINNED FACTS', formatLoadedNotesForInstructions: () => 'PAST SESSIONS',
    formatEmbodimentForInstructions: () => 'BODY MANUAL'
  });
  load(c, ['buildSessionInstructions', 'conversationAttentionEnabled']);
  const before = c.buildSessionInstructions();
  c.noteUserText('Comedy act coming up');
  assert.equal(c.buildSessionInstructions(), before);
  assert.match(before, /PINNED FACTS\n\nPAST SESSIONS/);
  assert.equal(c.conversationAttentionEnabled(), true);
});

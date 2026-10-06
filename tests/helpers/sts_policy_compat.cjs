// Historical extraction checks still compare every other byte of these page
// functions. Exclude only the exact, independently tested later additions:
// overdue reading is covered by sts_idle_behavior, live controls by sts_thinking.
function normalizeLaterPolicyAdditions(source) {
  return source.replace([
    '      // Give overdue reading this quiet window before another B1 idle turn takes it.',
    '      if (!manual && brain2HeadlinesDue() && !brain2BlockedReason()) {',
    '        log(events, "idle ponder deferred: Brain 2 reading due");',
    '        try {',
    '          await triggerBrain2Mull();',
    '        } finally {',
    '          if (activeRealtimeSession(socket, generation)) scheduleIdlePonder();',
    '        }',
    '        return;',
    '      }',
    '',
  ].join('\n'), '').replace(
    '        ...(llmUiControlTools?.checked ? thinkingToolList() : []),\n', '');
}

module.exports = { normalizeLaterPolicyAdditions };

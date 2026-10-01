// Only reviewed history-reading integration is reversed in older extraction comparisons.
const edits = [
  [
    "  <script src=\"brain2-history.js\"></script>\n",
    ""
  ],
  [
    "    const brain2History = Robot790Brain2History.create();\n",
    ""
  ],
  [
    "        historyCurrent: packet => brain2History.current(packet, brain2HistoryInput()),\n",
    ""
  ],
  [
    "    function brain2BlockedReason({ manual = false, history = null } = {}) {\n",
    "    function brain2BlockedReason({ manual = false } = {}) {\n"
  ],
  [
    "      if (currentBrain2PersonFocus() <= 0 && !headlinesDue && !history) return \"person lane off\";\n      if (!conversationLines.length && !headlinesDue && !history) return \"no conversation\";\n",
    "      if (currentBrain2PersonFocus() <= 0 && !headlinesDue) return \"person lane off\";\n      if (!conversationLines.length && !headlinesDue) return \"no conversation\";\n"
  ],
  [
    "      if (!manual && !headlinesDue && !history && brain2LastEvidence?.fingerprint === brain2EvidenceSnapshot().fingerprint) return \"no new evidence\";\n",
    "      if (!manual && !headlinesDue && brain2LastEvidence?.fingerprint === brain2EvidenceSnapshot().fingerprint) return \"no new evidence\";\n"
  ],
  [
    "      if (focus <= 0) return brain2HeadlinesEnabled() || brain2HistoryEnabled() ? 30000 : Infinity;\n",
    "      if (focus <= 0) return brain2HeadlinesEnabled() ? 30000 : Infinity;\n"
  ],
  [
    "    function brain2HistoryEnabled() {\n      return brain2MouthBrainEnabled() && currentIdleDrift() > 0 && currentIdleWonder() > 0 && currentIdleExploration() > 0\n        && !firstContactModeEnabled() && !performanceModeEnabled() && !idleSubstrateTestEnabled();\n    }\n\n    function brain2HistoryInput() {\n      return { generation: realtimeConnection.generation, evidence: brain2EvidenceSnapshot(),\n        lines: conversationLines, metadata: conversationLineMetadata, notes: loadedNoteContexts };\n    }\n\n    function brain2HistoryCandidate() {\n      if (!brain2HistoryEnabled() || !realtimeConnected() || brain2Work.busy || brain2Advisories.historyPending) return null;\n      if (userSpeechActive || userTurnPending() || responseCompletion.active || outputAudioActive() || idleInFlight\n        || toolContinuation.pending > 0 || toolContinuation.needed || currentLabGoal() || activeIdleSelfTasks().length\n        || lmStudioPromptBusy()) return null;\n      return brain2History.candidate({ ...brain2HistoryInput(), now: Date.now(), gap: idleExplorationGapMs(),\n        quietSince: Math.max(brain2HeadlineStartedAt, lastUserTurnActivityAt, lastAcceptedUserTranscriptAt),\n        outsideEnabled: brain2HeadlinesEnabled() });\n    }\n\n",
    ""
  ],
  [
    "      const lastReading = Math.max(brain2HeadlineLastAttemptAt, brain2HeadlineLastSelectionAt, brain2History.lastAttemptAt);\n",
    "      const lastReading = Math.max(brain2HeadlineLastAttemptAt, brain2HeadlineLastSelectionAt);\n"
  ],
  [
    "          || (brain2HeadlineRefreshRequested && unusedCached && now - Math.max(brain2HeadlineLastSelectionAt, brain2History.lastAttemptAt) >= 30000));\n",
    "          || (brain2HeadlineRefreshRequested && unusedCached && now - brain2HeadlineLastSelectionAt >= 30000));\n"
  ],
  [
    "    async function requestBrain2Mull({ manual = false, headlines = null, history = null } = {}) {\n",
    "    async function requestBrain2Mull({ manual = false, headlines = null } = {}) {\n"
  ],
  [
    "      const body = headlines || history ? null : brain2BodyContext();\n",
    "      const body = headlines ? null : brain2BodyContext();\n"
  ],
  [
    "        ...(history ? { history } : {}),\n        ...(!headlines && !history && typeof idleArt !== \"undefined\" && idleArt.proposalContext()\n",
    "        ...(!headlines && typeof idleArt !== \"undefined\" && idleArt.proposalContext()\n"
  ],
  [
    "        acceptEvidence: accepted => { if (!history) brain2LastEvidence = accepted; }\n",
    "        acceptEvidence: accepted => { brain2LastEvidence = accepted; }\n"
  ],
  [
    "      const history = !manual ? brain2HistoryCandidate() : null;\n      const readHeadlines = !manual && !history && brain2HeadlinesDue();\n      const blocked = brain2BlockedReason({ manual, history });\n",
    "      const readHeadlines = !manual && brain2HeadlinesDue();\n      const blocked = brain2BlockedReason({ manual });\n"
  ],
  [
    "        logBrain2(\"fired\", history ? \"idle history\" : readHeadlines ? \"idle headlines\" : manual ? \"manual\" : \"auto\");\n        if (history || readHeadlines) brain2History.attempted(history ? \"history\" : \"outside\", Date.now(), history);\n        if (history) logBrain2(\"history reading\", JSON.stringify({ id: history.id, source: history.filename,\n          saved_at: history.saved_at, form: history.form, characters: history.characters,\n          passages: history.passages.map(({ id, speaker, at, first_line, last_line }) => ({ id, speaker, at, first_line, last_line })) }));\n",
    "        logBrain2(\"fired\", readHeadlines ? \"idle headlines\" : manual ? \"manual\" : \"auto\");\n"
  ],
  [
    "        const result = await requestBrain2Mull({ manual, headlines, ...(history ? { history } : {}) });\n",
    "        const result = await requestBrain2Mull({ manual, headlines });\n"
  ],
  [
    "        if (history) {\n          if (!brain2HistoryEnabled() || userSpeechActive || userTurnPending() || userActivityAt !== lastUserTurnActivityAt\n            || !brain2History.complete(history, brain2HistoryInput())) {\n            logBrain2(\"history stale\", \"operator activity, source change, or session reset\");\n            return;\n          }\n          logBrain2(\"history examined\", JSON.stringify({ id: history.id, advice: Boolean(result.note_for_eric), source: result.history_source || null }));\n          brain2Advisories.acceptHistory(result, history);\n          return;\n        }\n",
    ""
  ],
  [
    "      brain2History.reset();\n",
    ""
  ],
  [
    "      const active = activeRealtimeSession(socket, generation);\n",
    ""
  ],
  [
    "      if (active) brain2Advisories.sent(event);\n",
    ""
  ],
  [
    "    let historyCandidate = null;\n",
    ""
  ],
  [
    "    function pendingHistory() {\n      if (!historyCandidate || historyCandidate.at <= a.userAt()\n        || !a.historyCurrent?.(historyCandidate.packet)) return null;\n      return { text: historyCandidate.text, at: historyCandidate.at, source: historyCandidate.source };\n    }\n\n    function sent(event) {\n      if (!historyCandidate) return;\n      const text = event.type === \"response.create\" ? event.response?.instructions\n        : event.type === \"conversation.item.create\" && event.item?.role === \"assistant\"\n          ? event.item.content?.find(part => part.type === \"output_text\")?.text : null;\n      if (typeof text !== \"string\") return;\n      const history = pendingHistory();\n      if (!history || !text.includes(`\"history\":${JSON.stringify(history)}`)) return;\n      // Receipt of the local send, not proof of provider acceptance or attention.\n      const receipt = { id: historyCandidate.packet.id, source: history.source, via: event.type };\n      historyCandidate = null;\n      a.log(\"history offered\", JSON.stringify(receipt));\n    }\n\n",
    ""
  ],
  [
    "      const history = pendingHistory();\n      if (!notes.length && !revisions.length && !questions.length && !history) return \"\";\n",
    "      if (!notes.length && !revisions.length && !questions.length) return \"\";\n"
  ],
  [
    "        JSON.stringify({ notes, revisions, questions, ...(history ? { history } : {}) })\n",
    "        JSON.stringify({ notes, revisions, questions })\n"
  ],
  [
    "    function clear() {\n      historyCandidate = null;\n",
    "    function clear() {\n"
  ],
  [
    "      get historyPending() { return Boolean(pendingHistory()); },\n      accept, clear, reset, sent,\n      acceptHistory(result, packet) {\n        const text = String(result.note_for_eric || \"\").trim();\n        if (!text || !result.history_source) return;\n        historyCandidate = { text, at: a.now(), source: result.history_source, packet };\n        a.log(\"history note for Eric\", text);\n        a.remember(\"history note\", text);\n      },\n",
    "      accept, clear, reset,\n"
  ]
];
function normalizeHistoryScope(source) {
  for (const [after, before] of edits) source = source.replace(after, before);
  return source;
}
module.exports = { edits, normalizeHistoryScope };

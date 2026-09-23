(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790Brain2Evidence = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function buildSnapshot({ lines, metadata, prosody, sessionGeneration, evidenceGeneration,
    now, runtime, searchReceipts, setupCards, noteGuidance, previous }) {
    const rows = lines.map((text, index) => ({
      id: `${sessionGeneration}:${evidenceGeneration}:${index}`,
      text,
      at: metadata[index]?.iso || "",
      role: /\] You:/.test(text) ? "user" : /\] Robot 790:/.test(text) ? "assistant" : "other",
      prosody: prosody[index] || ""
    }));
    const assistantRows = rows.filter((row) => row.role === "assistant");
    const userRow = rows.filter((row) => row.role === "user").at(-1) || null;
    const userKey = userRow ? JSON.stringify(userRow) : "";
    const searches = searchReceipts.slice(0, 3);
    // Sample time is deliberately excluded: polling alone is not new evidence.
    const fingerprint = JSON.stringify([rows.slice(-18), runtime, searches, setupCards, noteGuidance]);
    return {
      fingerprint,
      setup_cards: setupCards,
      note_guidance: noteGuidance,
      evidence_generation: evidenceGeneration,
      user_key: userKey,
      sampled_at: new Date(now).toISOString(),
      previous_sampled_at: previous?.sampled_at || null,
      assistant_chunks_total: assistantRows.length,
      new_assistant_chunks: Math.max(0, assistantRows.length - (previous?.assistant_chunks_total || 0)),
      last_assistant_output_id: assistantRows.at(-1)?.id || "",
      new_user_input: userKey !== (previous?.user_key || ""),
      conversation: rows.slice(-18),
      latest_user_utterance: userRow,
      runtime,
      search_receipts: searches
    };
  }

  return { buildSnapshot };
});

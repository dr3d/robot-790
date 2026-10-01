(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790Brain2Evidence = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const recentTextTarget = 16000;

  function groupTurns(rows, metadata) {
    const turns = [];
    let previous = null;
    rows.forEach((row, index) => {
      const responseId = metadata[index]?.responseId || "";
      const at = Date.parse(row.at);
      const gap = previous ? at - Date.parse(previous.at) : NaN;
      const turn = turns.at(-1);
      // Current replies have protocol identity. Old rows can only be grouped by
      // adjacent speech timing; never merge across a user turn or missing time.
      const sameResponse = turn && row.role === "assistant" && previous?.role === "assistant"
        && (responseId || turn.response_id
          ? Boolean(responseId) && responseId === turn.response_id
          : Number.isFinite(gap) && gap >= 0 && gap <= 10000);
      if (sameResponse) {
        turn.id = row.id;
        turn.end_at = row.at;
        turn.text += `\n${row.text}`;
        turn.chunk_count += 1;
      } else {
        turns.push({ ...row, first_id: row.id, end_at: row.at, chunk_count: 1,
          ...(responseId ? { response_id: responseId } : {}) });
      }
      previous = row;
    });
    return turns;
  }

  function recentTurns(rows, metadata) {
    const turns = groupTurns(rows, metadata);
    let start = turns.length, units = 0, assistantTurns = 0;
    while (start > 0) {
      const turn = turns[start - 1];
      // A soft window, not a sentence cap: keep the latest two assistant turns
      // whole even when long, so B2 can compare them instead of seeing one tail.
      if (assistantTurns >= 2 && units + turn.text.length > recentTextTarget) break;
      units += turn.text.length;
      assistantTurns += Number(turn.role === "assistant");
      start -= 1;
    }
    const selected = turns.slice(start);
    const includedChunks = selected.reduce((count, turn) => count + turn.chunk_count, 0);
    return {
      conversation: selected,
      conversation_window: {
        format: "whole-turns-v1", text_unit: "UTF-16", target_text_units: recentTextTarget,
        included_text_units: units, over_target: units > recentTextTarget,
        included_turns: selected.length, omitted_turns: start,
        included_chunks: includedChunks, omitted_chunks: rows.length - includedChunks,
        first_id: selected[0]?.first_id || "", last_id: selected.at(-1)?.id || ""
      }
    };
  }

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
    const window = recentTurns(rows, metadata);
    // Sample time is deliberately excluded: polling alone is not new evidence.
    const fingerprint = JSON.stringify([window, userRow, runtime, searches, setupCards, noteGuidance]);
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
      ...window,
      latest_user_utterance: userRow,
      runtime,
      search_receipts: searches
    };
  }

  return { buildSnapshot, groupTurns };
});

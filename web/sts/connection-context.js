(function (root) {
  "use strict";

  function chronologicalPromptNotes(notes) {
    const contexts = Array.isArray(notes) ? notes : [];
    const dated = [];
    contexts.forEach((note, index) => {
      if (note.brain_context?.version === 1) return;
      const content = String(note.content || "");
      const variant = /^STS Session Variant\r?$/m.test(content);
      if (!variant && !/^(?:STS Session Note|Robot 790 Session Note|Robot 790 Continuity Session)\r?$/m.test(content)) return;
      const label = content.match(variant ? /^Source created:\s*([^\r\n]+)/m : /^Created:\s*([^\r\n]+)/m);
      const at = label ? Date.parse(label[1].trim()) : NaN;
      if (Number.isFinite(at)) dated.push({ note, index, at });
    });
    // Sort only dated session slots. Pins, cards and undated notes keep their
    // places; the newest-first inventory used for budgeting is never mutated.
    const ordered = dated.slice().sort((a, b) => a.at - b.at || a.index - b.index);
    const result = contexts.slice();
    dated.forEach(({ index }, i) => { result[index] = ordered[i].note; });
    return result;
  }

  async function prepare({ notes, measure, compact, progress = () => {} }) {
    const original = notes.map(note => ({ ...note }));
    let candidate = original.map(note => ({ ...note }));
    let receipt = await measure(candidate);
    const initial = receipt;
    const attempts = [];
    const startIndex = initial.policy?.history_start_index ?? 1;
    const minRecent = initial.policy?.history_min_recent_sessions ?? 1;
    if (![startIndex, minRecent].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000)) {
      throw new Error("Invalid connection history boundaries; nothing installed.");
    }
    // The loader supplies newest-first history. N counts only sessions, oldest-first.
    const history = candidate.map((note, index) => ({ note, index }))
      .filter(({ note }) => note.connection_history && note.brain_context?.version !== 1)
      .map(({ index }) => index).reverse();
    let lastCondensedIndex = null;
    const sameModel = next => {
      if (next.model !== initial.model || next.context_window_tokens !== initial.context_window_tokens
          || JSON.stringify(next.policy) !== JSON.stringify(initial.policy)) {
        throw new Error("Model or context policy changed while preparing; retry Connect.");
      }
    };
    for (let h = startIndex; !receipt.fits && h < history.length - minRecent; h++) {
      const i = history[h];
      const note = candidate[i];
      progress(note.filename);
      const result = await compact(note.filename);
      if (result.status !== "ok" || result.filename !== note.filename || typeof result.content !== "string"
          || !result.content || !/^[a-f0-9]{64}$/.test(result.source_sha256 || "")) {
        throw new Error("Invalid prepared memory identity; nothing installed.");
      }
      const trial = candidate.map((item, index) => index === i ? {
        ...item, content: result.content,
        connection_compaction: { method: result.method, source_sha256: result.source_sha256 }
      } : item);
      const next = await measure(trial);
      sameModel(next);
      const accepted = next.prompt_tokens < receipt.prompt_tokens;
      attempts.push({ filename: note.filename, history_index: h, method: result.method, source_sha256: result.source_sha256,
        before_tokens: receipt.prompt_tokens, after_tokens: next.prompt_tokens, accepted });
      if (accepted) { candidate = trial; receipt = next; lastCondensedIndex = h; }
    }
    if (!receipt.fits) {
      throw new Error(`History needs ${receipt.prompt_tokens.toLocaleString()} startup tokens; budget is `
        + `${receipt.startup_budget_tokens.toLocaleString()} after reserves. Nothing was dropped. `
        + `The protected opening (${startIndex}) and newest (${minRecent}) session boundaries were not crossed. `
        + "Reduce connection_context.growth_tokens in config/runtime.json, select a shorter branch, or use a larger loaded window.");
    }
    const verified = await measure(candidate);
    sameModel(verified);
    if (!verified.fits) throw new Error("Startup context changed during verification; retry Connect.");
    return { notes: candidate, receipt: { ...verified, initial_prompt_tokens: initial.prompt_tokens, attempts,
      history_selection: { session_count: history.length, start_index: startIndex,
        min_recent_sessions: minRecent, last_condensed_index: lastCondensedIndex,
        recent_sessions_intact: lastCondensedIndex === null ? history.length : history.length - lastCondensedIndex - 1 },
      retained_sessions: candidate.filter(note => note.connection_history).map(note => ({
        filename: note.filename, form: note.connection_compaction ? "excerpts" : "loaded", characters: note.content.length
      })) } };
  }

  const api = { prepare, chronologicalPromptNotes };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.Robot790ConnectionContext = api;
})(typeof globalThis === "object" ? globalThis : this);

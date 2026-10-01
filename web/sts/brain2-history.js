(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports
    ? require("./brain2-evidence.js") : root.Robot790Brain2Evidence);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790Brain2History = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (evidenceApi) {
  "use strict";
  const targetCharacters = 2400;
  const speaker = text => /\] You:/.test(text) ? "user" : /\] Robot[ -]790:/.test(text) ? "assistant" : "other";

  function savedTurns(content) {
    const rows = [];
    String(content).split(/\r?\n/).forEach((text, index) => {
      const match = text.match(/^\[([^\]]+)\] (You|Robot[ -]790|System):/);
      if (match) rows.push({ id: String(index + 1), first_id: String(index + 1), text,
        at: match[1], role: speaker(text), end_at: match[1], end_line: index + 1 });
      else if (rows.length) {
        rows.at(-1).text += `\n${text}`;
        rows.at(-1).end_line = index + 1;
      }
    });
    return rows.map(row => ({ ...row, text: row.text.trimEnd() }));
  }

  function create() {
    let scope = "", userKey = "", serial = 0, lastAttemptAt = 0, lastKind = "", lastSource = "";
    let inspected = new Set(), frontiers = new Map(), noteCache = new Map();
    function reset() {
      scope = ""; userKey = ""; serial++; lastAttemptAt = 0; lastKind = ""; lastSource = "";
      inspected = new Set(); frontiers = new Map(); noteCache = new Map();
    }
    function sources(input) {
      const key = `${input.generation}:${input.evidence.evidence_generation}`;
      if (key !== scope) { reset(); scope = key; }
      if (input.evidence.user_key !== userKey) { userKey = input.evidence.user_key; frontiers.clear(); }
      const count = input.evidence.conversation_window?.omitted_chunks || 0;
      const rows = input.lines.slice(0, count).map((text, index) => ({
        id: String(index), text, at: input.metadata[index]?.iso || "", role: speaker(text)
      }));
      const current = evidenceApi.groupTurns(rows, input.metadata)
        .filter(row => row.role !== "other" && row.text !== input.evidence.latest_user_utterance?.text);
      const result = [{ key: `current:${scope}`, filename: "current conversation", saved_at: "",
        form: "live transcript", turns: current }];
      const names = new Set();
      for (const note of input.notes) {
        if (!/^sessions\/[^/]+\.txt$/i.test(note.filename || "") || note.brain_context?.version === 1) continue;
        const content = String(note.content || "");
        names.add(note.filename);
        let cached = noteCache.get(note.filename);
        if (!cached || cached.content !== content) {
          const savedAt = (content.match(/^(?:Source created|Created):\s*([^\r\n]+)/m) || [])[1] || "";
          cached = { key: `note:${++serial}:${note.filename}`, filename: note.filename,
            content, saved_at: savedAt, form: note.connection_compaction ? "loaded excerpts" : "loaded transcript",
            turns: savedTurns(content).filter(row => row.role !== "other") };
          noteCache.set(note.filename, cached);
        }
        result.push(cached);
      }
      for (const name of noteCache.keys()) if (!names.has(name)) noteCache.delete(name);
      return [result[0], ...result.slice(1).sort((a, b) => (Date.parse(b.saved_at) || 0) - (Date.parse(a.saved_at) || 0))];
    }
    function candidate(input) {
      const available = sources(input);
      if (!Number.isFinite(input.gap) || input.now - input.quietSince < Math.min(120000, input.gap)
        || (lastAttemptAt && input.now - lastAttemptAt < input.gap)
        || (lastKind === "history" && input.outsideEnabled)) return null;
      const start = (available.findIndex(source => source.key === lastSource) + 1) % available.length;
      const rotated = [...available.slice(start), ...available.slice(0, start)];
      for (const source of rotated) {
        const frontier = frontiers.get(source.key) ?? Infinity;
        const eligible = source.turns.filter(row => Number(row.first_id) < frontier
          && !inspected.has(`${source.key}:${row.first_id}`));
        if (!eligible.length) continue;
        const selected = [];
        let characters = 0;
        for (let i = eligible.length - 1; i >= 0; i--) {
          const row = eligible[i];
          if (selected.length && characters + row.text.length > targetCharacters) break;
          selected.unshift(row); characters += row.text.length;
        }
        return { id: `${source.key}:${selected[0].first_id}:${selected.at(-1).id}`, scope, user_key: userKey,
          source_key: source.key, filename: source.filename, saved_at: source.saved_at, form: source.form,
          target_characters: targetCharacters, characters,
          passages: selected.map(row => ({ id: `${source.key}:${row.first_id}`, speaker: row.role,
            at: row.at, end_at: row.end_at, first_line: Number(row.first_id) + (source === available[0] ? 1 : 0),
            last_line: source === available[0] ? Number(row.id) + 1 : row.end_line, text: row.text })) };
      }
      return null;
    }
    function current(packet, input) {
      const available = sources(input);
      if (!packet || packet.scope !== scope || packet.user_key !== userKey) return false;
      const source = available.find(item => item.key === packet.source_key);
      return Boolean(source && packet.passages.every(p => source.turns.some(row =>
        `${source.key}:${row.first_id}` === p.id && row.text === p.text)));
    }
    function attempted(kind, now, packet = null) {
      lastKind = kind; lastAttemptAt = now;
      // Advance source fairness even after failure; only complete() consumes passages.
      if (kind === "history" && packet?.scope === scope) lastSource = packet.source_key;
    }
    function complete(packet, input) {
      if (!current(packet, input)) return false;
      lastSource = packet.source_key;
      packet.passages.forEach(p => inspected.add(p.id));
      frontiers.set(packet.source_key, packet.passages[0].first_line - (packet.filename === "current conversation" ? 1 : 0));
      return true;
    }
    return { candidate, current, attempted, complete, reset, get lastAttemptAt() { return lastAttemptAt; } };
  }
  return { create, savedTurns };
});

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790SensingEyeInboxState = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createState() {
    return { lastSeq: 0, ignoreSeqThrough: 0, handled: new Set() };
  }

  function create() {
    const s = createState();

    function advance(seq) {
      s.lastSeq = Math.max(s.lastSeq, seq);
    }

    function ignoreThrough(seq) {
      advance(seq);
      s.ignoreSeqThrough = Math.max(s.ignoreSeqThrough, seq);
    }

    function remember(seqKey) {
      s.handled.add(seqKey);
      while (s.handled.size > 100) {
        s.handled.delete(s.handled.values().next().value);
      }
    }

    function observeSaved(seq) {
      ignoreThrough(seq);
      // Save echoes have historically been recorded without inbound eviction.
      s.handled.add(String(seq));
    }

    return {
      get lastSeq() { return s.lastSeq; },
      get ignoreSeqThrough() { return s.ignoreSeqThrough; },
      has: seqKey => s.handled.has(seqKey),
      advance, ignoreThrough, remember, observeSaved
    };
  }

  return { create };
});

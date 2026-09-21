(function (root) {
  'use strict';

  class LiveNotes {
    constructor() { this.socket = null; this.prefix = ''; this.sent = new Map(); this.receipts = new Map(); }

    bind(socket, prefix, entries) {
      if (this.socket === socket) return;
      this.socket = socket;
      this.prefix = prefix;
      this.sent = new Map(entries);
      this.receipts.clear();
    }

    received(filename, content) { this.receipts.set(filename, content); }

    plan(entries) {
      const current = new Map(entries);
      const changes = [];
      for (const [filename, content] of current) {
        if (this.sent.get(filename) === content) continue;
        changes.push({ filename, content, text: this.receipts.get(filename) === content
          ? `Pinned note ${JSON.stringify(filename)}: the complete revision in the preceding read_text_file result is now active, replacing earlier versions of this note.`
          : `Pinned note ${JSON.stringify(filename)}: this complete revision replaces earlier versions of this note.\n${content}` });
      }
      for (const filename of this.sent.keys()) {
        if (!current.has(filename)) changes.push({ filename, content: null,
          text: `Note ${JSON.stringify(filename)} is no longer pinned. Its instructions are no longer active; earlier appearances remain historical context, not an active note.` });
      }
      return { current, changes };
    }

    commit(plan) { this.sent = plan.current; this.receipts.clear(); }
  }

  const api = { LiveNotes };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Robot790LiveNotes = api;
})(typeof globalThis === 'object' ? globalThis : this);

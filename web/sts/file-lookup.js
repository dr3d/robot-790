(function (root) {
  'use strict';

  function options({ query = '', offset = 0, limit = 5 } = {}) {
    if (typeof query !== 'string' || query.length > 160) throw new Error('Query must be at most 160 characters.');
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Offset must be a nonnegative integer.');
    if (!Number.isInteger(limit) || limit < 1 || limit > 8) throw new Error('Lookup limit must be 1-8.');
    return { query: query.trim(), offset, limit };
  }

  function key(value) {
    return String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }

  function matches(value, query) {
    const needle = key(query), haystack = key(value);
    return !query.trim() || (Boolean(needle) && needle.split(/\s+/u).every(word => haystack.includes(word)));
  }

  function compactEye(item) {
    return {
      id: item.id,
      name: String(item.name || item.saved_filename || '').slice(0, 120),
      kind: item.kind || 'image',
      current: Boolean(item.current),
      created_at: String(item.created_at || '').slice(0, 40),
      ...(item.reason ? { clue: String(item.reason).slice(0, 160) } : {})
    };
  }

  const api = { options, matches, compactEye };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Robot790FileLookup = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

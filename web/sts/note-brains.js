(function (root) {
  'use strict';
  const targets = ['b1', 'b2', 'b3', 'b4'];

  function forBrain(notes, target) {
    if (!targets.includes(target)) throw new Error('Unknown brain target');
    const packet = notes.filter(note => note.brain_context?.version === 1
        && (target === 'b1' || Object.hasOwn(note.brain_context.brains || {}, target)))
      .map(note => ({
        target,
        filename: note.filename,
        revision: note.brain_context.revision,
        shared: note.brain_context.shared || '',
        guidance: note.brain_context.brains?.[target] || ''
      }))
      .filter(note => note.shared || note.guidance)
      .sort((a, b) => a.filename.localeCompare(b.filename));
    if (packet.length > 8) throw new Error('At most 8 routed notes can be active.');
    return packet;
  }

  function b1Content(note) {
    const body = String(note.content || '');
    const [guidance] = forBrain([note], 'b1');
    if (!guidance) return body;
    return [body, 'Optional note guidance; current user direction and runtime permissions take precedence:',
      guidance.shared, guidance.guidance].filter(Boolean).join('\n\n');
  }

  function b1Result(result) {
    const { brain_context, ...ordinary } = result;
    return { ...ordinary, content: b1Content(result) };
  }

  function isCurrent(item, notes, target) {
    return !item.noteGuidanceKey || item.noteGuidanceKey === JSON.stringify(forBrain(notes, target));
  }

  function admit(notes, config = {}) {
    const bounded = (value, fallback, max) => Number.isInteger(value) && value >= 1 && value <= max ? value : fallback;
    const maxCards = bounded(config?.max_cards, 8, 8);
    const limit = bounded(config?.b1_characters, 32000, 128000);
    const cards = notes.filter(note => note.brain_context?.version === 1)
      .sort((a, b) => a.filename.localeCompare(b.filename));
    const reject = (message, code) => { throw Object.assign(new Error(message), { code }); };
    if (cards.length > maxCards) reject(`At most ${maxCards} routed notes can be active; unpin a card before loading another.`, 'card_count_limit');
    const seen = new Set();
    for (const note of cards) {
      const key = String(note.filename || '').toLowerCase();
      if (seen.has(key)) reject(`Duplicate routed note: ${note.filename}`, 'duplicate_card');
      seen.add(key);
      const packet = note.brain_context;
      for (const text of [packet.shared || '', ...Object.entries(packet.brains || {}).filter(([target]) => target !== 'b1').map(([, text]) => text)]) {
        if (typeof text !== 'string' || Array.from(text).length > 1200) reject(`Private/shared guidance exceeds 1200 characters: ${note.filename}`, 'card_guidance_limit');
      }
    }
    const blocks = cards.map(note => {
      const body = b1Content(note);
      return { note, body, text: body ? `[${note.filename}]\n${body}` : '' };
    });
    const bodies = blocks.map(block => block.text).filter(Boolean);
    const text = bodies.length ? ['Loaded routed note instructions for this browser session:', ...bodies].join('\n\n') : '';
    if (text.length > limit) reject(`Routed-note B1 budget exceeded (${text.length}/${limit} UTF-16 code units). No cards were replaced or clipped.`, 'card_budget_exceeded');
    return { cards, blocks, text, characters: text.length, limit, max_cards: maxCards, units: 'utf16_code_units' };
  }

  const api = { forBrain, b1Content, b1Result, isCurrent, admit };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Robot790NoteBrains = api;
})(typeof globalThis === 'object' ? globalThis : this);

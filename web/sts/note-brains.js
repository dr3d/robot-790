(function (root) {
  'use strict';
  const targets = ['b1', 'b2', 'b3', 'b4'];

  function forBrain(notes, target) {
    if (!targets.includes(target)) throw new Error('Unknown brain target');
    return notes.filter(note => note.brain_context?.version === 1
        && (target === 'b1' || Object.hasOwn(note.brain_context.brains || {}, target)))
      .map(note => ({
        target,
        filename: note.filename,
        revision: note.brain_context.revision,
        shared: note.brain_context.shared || '',
        guidance: note.brain_context.brains?.[target] || ''
      }))
      .filter(note => note.shared || note.guidance)
      .sort((a, b) => a.filename.localeCompare(b.filename)).slice(0, 8);
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

  const api = { forBrain, b1Content, b1Result, isCurrent };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Robot790NoteBrains = api;
})(typeof globalThis === 'object' ? globalThis : this);

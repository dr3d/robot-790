// Compare historical extraction traces without rewriting the frozen evidence.
// Only the later preview/observation receipt additions are removed; actual
// state changes, calls, ordering, errors and legacy fields must still match.
function previousImageReceiptShape(value) {
  if (Array.isArray(value)) return value.map(previousImageReceiptShape);
  if (!value || typeof value !== 'object') return value;
  const copy = Object.fromEntries(Object.entries(value).map(([k,v])=>[k,previousImageReceiptShape(v)]));
  delete copy.display_surface; delete copy.observation_note;
  if ('displayed' in copy && !copy.retrieval) delete copy.staged;
  return copy;
}
module.exports = {previousImageReceiptShape};

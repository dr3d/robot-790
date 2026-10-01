// Response identity is a later functional repair, not part of the image-owner
// extractions. Normalize only these literal edits in their historical comparisons.
const edits = [
  ['      if (promptDebug.evidence_receipt) {\n        logBrain2("evidence input", JSON.stringify({ status: item.status, ...promptDebug.evidence_receipt }));\n      }\n', ''],
  ['function addConversation(text, { touchActivity = true, channel = "dialogue", responseId = "" } = {})',
    'function addConversation(text, { touchActivity = true, channel = "dialogue" } = {})'],
  ['conversationLineMetadata.push({ ...conversationLineMetadataFromDate(at), channel,\n        ...(responseId ? { responseId } : {}) });',
    'conversationLineMetadata.push({ ...conversationLineMetadataFromDate(at), channel });'],
  ['addConversation(`Robot 790: ${event.transcript || ""}`, { touchActivity: false, responseId: eventResponseId(event) });',
    'addConversation(`Robot 790: ${event.transcript || ""}`, { touchActivity: false });'],
  ['addConversation(`Robot 790: ${event.delta || ""}`, { touchActivity: false, responseId: eventResponseId(event) });',
    'addConversation(`Robot 790: ${event.delta || ""}`, { touchActivity: false });']
];
function normalizeB2Evidence(source) {
  source = require('./sts_b2_history_scope.cjs').normalizeHistoryScope(source);
  for (const [after, before] of edits) source = source.replace(after, before);
  return source;
}
module.exports = { edits, normalizeB2Evidence };

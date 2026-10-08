// The catalogue repair is functional, separate from the ownership extractions.
// Undo only these literal edits when checking those earlier extraction boundaries.
const edits = [
  ["const exactId = String(selection.image_id || \"\").trim();", "const exactId = String(selection.image_id || \"\");"],
  ["const local = sessionNotes.find(item => item.id === exactId || item.history_id === exactId);\n        if (local) return { images: [local], total: 1, next_offset: null, resolved_id: local.id };", "const local = sessionNotes.find(item => item.id === exactId);\n        if (local) return { images: [local], total: 1, next_offset: null };\n        if (!exactId.startsWith(\"file:\")) return { images: [], total: 0, next_offset: null };"],
  ["filename: exactId, hints: [...hints]", "filename: exactId ? exactId.slice(5) : \"\", hints: [...hints]"],
  ["return { images, total, next_offset: offset + images.length < total ? offset + images.length : null,\n        resolved_id: result.resolved_id || \"\", resolution: result.resolution || \"\" };", "return { images, total, next_offset: offset + images.length < total ? offset + images.length : null };"],
  ["No matching image or eye note was found. Use list_sensing_eye_images or list_sensing_eye_notes with a short subject query, then recall the returned exact id (including generated: for an unstaged original). Nothing in the eye was changed.", "No matching sensing-eye file is available. Nothing in the eye was changed."],
  ["if (listed.resolution === \"ambiguous\") {\n        throw new Error(`Ambiguous image reference. Choose an exact id: ${listed.images.map(item => item.id).join(\", \")}. Nothing in the eye was changed.`);\n      }\n      const listedItem = chooseSensingEyeNote(listed.images, { index, id: listed.resolved_id || imageId, query });", "const listedItem = chooseSensingEyeNote(listed.images, { index, id: imageId, query });"],

  ['(file.storage !== "generated" && sessionNotes.find(item => item.saved_filename === file.filename))', 'sessionNotes.find(item => item.saved_filename === file.filename)'],
  ['id: file.id || `file:${file.filename}`', 'id: `file:${file.filename}`'],
  ['saved_filename: file.storage === "generated" ? "" : file.filename || ""', 'saved_filename: file.filename || ""'],
  ['location: file.storage === "generated" ? "generated" : "filesystem"', 'location: "filesystem"'],
  [`
      if (listedItem.location === "generated") {
        const moved = await moveGeneratedImageToSensingEye({ filename: listedItem.name, _isCurrent: isCurrent });
        return {
          status: moved.status, tool: "select_sensing_eye_image",
          selected: {
            id: listedItem.id, kind: "image", name: moved.source_image, source: "generated image",
            saved_filename: moved.saved_filename, open_url: moved.saved_url, staged: moved.staged
          }
        };
      }
`, ''],
];
function normalizeGeneratedCatalogue(source) {
  for (const [after, before] of edits) source = source.replace(after, before);
  // Checkpoints from before the alias repair still contain these catalogue edits.
  source = source.replace('if (!exactId.startsWith("file:") && !exactId.startsWith("generated:"))', 'if (!exactId.startsWith("file:"))');
  source = source.replace('filename: exactId.startsWith("generated:") ? exactId : exactId ? exactId.slice(5) : ""', 'filename: exactId ? exactId.slice(5) : ""');
  return source;
}
module.exports = { edits, normalizeGeneratedCatalogue };

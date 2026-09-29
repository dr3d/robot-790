// The catalogue repair is functional, separate from the ownership extractions.
// Undo only these literal edits when checking those earlier extraction boundaries.
const edits = [
  ['if (!exactId.startsWith("file:") && !exactId.startsWith("generated:"))', 'if (!exactId.startsWith("file:"))'],
  ['filename: exactId.startsWith("generated:") ? exactId : exactId ? exactId.slice(5) : ""', 'filename: exactId ? exactId.slice(5) : ""'],
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
  return source;
}
module.exports = { edits, normalizeGeneratedCatalogue };

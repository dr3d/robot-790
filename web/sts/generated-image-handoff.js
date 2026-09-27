(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790GeneratedImageHandoff = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create(a) {
    async function move({ filename = "", reason = "", _expectedFilename = "", _isCurrent = () => true, _usePending = false } = {}) {
      const generation = a.eye.generation;
      if (!_isCurrent()) throw new Error("Image request was superseded.");
      const requestedName = String(filename || "").trim();
      if (requestedName && (!/^[a-zA-Z0-9._-]{1,160}$/.test(requestedName) || !/\.(png|jpe?g|webp|svg)$/i.test(requestedName))) {
        throw new Error("Use an exact generated-image filename, not a path or URL.");
      }
      if (requestedName && _expectedFilename && requestedName !== _expectedFilename) {
        throw new Error("The generated image changed; the requested artifact was not staged.");
      }
      if (_usePending && a.idle()?.busy) {
        throw new Error("An idle-art generation or delivery is already in progress.");
      }
      if (_usePending && a.idle()?.ready) {
        return a.idle().stageReady({ isCurrent: _isCurrent, expectedFilename: requestedName || _expectedFilename });
      }
      if (!requestedName && !a.preview.url) throw new Error("No generated image is in the preview. A saved image can be retrieved with its exact filename from the generation receipt.");
      const imageUrl = requestedName
        ? a.url(`/generated-images/${encodeURIComponent(requestedName)}`).href
        : a.preview.url;
      const imageName = requestedName || a.preview.name || a.filenameFromPath(imageUrl) || "generated-image.jpg";
      if (_expectedFilename && imageName !== _expectedFilename) throw new Error("The generated image changed; the requested artifact was not staged.");
      const previewGeneration = a.preview.revision;
      const { url: eyeUrl, text: eyeText } = a.eye;
      // Exact retrieval cannot overwrite newer activity while loading or saving.
      const current = () => _isCurrent() && generation === a.eye.generation
        && previewGeneration === a.preview.revision
        && eyeUrl === a.eye.url && eyeText === a.eye.text;
      let imageDataUrl = imageUrl;
      if (!/^data:image\//i.test(imageUrl)) {
        const response = await a.fetch(imageUrl, { cache: "no-store" });
        if (!response.ok) throw new Error(`Could not read generated image: ${response.status} ${response.statusText}`);
        imageDataUrl = await a.blobToDataUrl(await response.blob());
      }
      const image = await a.loadImage(imageDataUrl);
      if (!current()) throw new Error("Image request was superseded before staging.");
      const historyItem = await a.stage(image, imageName, {
        eyeGeneration: generation,
        isCurrent: current,
        source: "generated image",
        reason: String(reason || "generated image moved to sensing eye").slice(0, 120),
        openUrl: imageUrl,
        transcriptAction: "generated image moved into eye"
      });
      if (!historyItem || !a.eye.staged || a.eye.name !== imageName) throw new Error("Generated image staging was not completed.");
      if (a.preview.name === imageName) a.movedHint(imageName);
      a.updateButtons();
      return {
        status: "ok",
        tool: "move_generated_image_to_sensing_eye",
        filename: a.eye.name,
        saved_filename: historyItem?.savedFilename || "",
        saved_url: historyItem?.openUrl || "",
        staged: a.eye.staged,
        source_image: imageName,
        reason: String(reason || "")
      };
    }
    return { move };
  }

  return { create };
});

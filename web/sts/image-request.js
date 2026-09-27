(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790ImageRequest = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create(a) {
    async function generate({ prompt, title, size = "1024x1024", _isCurrent = () => true, _isPreviewCurrent = _isCurrent, _idleArt = false } = {}) {
      const text = String(prompt || "").replace(/\s+/g, " ").trim();
      if (!text) throw Object.assign(new Error("Missing image prompt"), { generationSubmitted: false });
      if (!_isCurrent()) throw Object.assign(new Error("Image request was superseded."), { generationSubmitted: false });
      if (!_idleArt && a.idle()?.busy) {
        // Waiting has not submitted a render; turn/session/preview changes can still cancel it.
        const previewRevision = a.preview.revision;
        a.log("image request waiting for active idle render");
        while (a.idle().busy) {
          if (!_isCurrent() || a.preview.revision !== previewRevision || !a.enabled()) {
            throw Object.assign(new Error("Image request was superseded or disabled while waiting."), { generationSubmitted: false });
          }
          await a.wait(250);
        }
        if (!_isCurrent() || a.preview.revision !== previewRevision || !a.enabled()) {
          throw Object.assign(new Error("Image request was superseded or disabled while waiting."), { generationSubmitted: false });
        }
      }
      if (a.preview.state === "generating" || a.idle()?.busy) {
        throw Object.assign(new Error("An image generation is already in progress."), { generationSubmitted: false });
      }
      if (a.idle()) a.idle().assertCanRender({ requirePermission: _idleArt });
      const { revision: requestGeneration, title: shortTitle } = a.preview.begin(title);
      const ownsProgress = () => a.preview.owns(requestGeneration);
      const selectedModel = a.model();
      const selectedQuality = a.quality();
      a.log(`image generation: ${shortTitle || text.slice(0, 80)} (${a.settingLabel()})`);
      let result;
      try {
        if (_idleArt) {
          result = await a.idle().renderRequested({ prompt: text, title: shortTitle || "Image" }, { size, isCurrent: _isCurrent });
        } else {
          const response = await a.fetch(a.url("/api/images/generate"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: text, title: shortTitle, size: String(size || "1024x1024"),
              model: selectedModel, quality: selectedQuality })
          });
          result = await response.json().catch(() => ({}));
          if (!response.ok || result.status === "error") {
            throw new Error(result.error || `${response.status} ${response.statusText}`);
          }
        }
      } catch (error) {
        a.preview.fail(requestGeneration, error);
        throw error;
      }
      const absoluteUrl = a.url(String(result.url || "")).href;
      const hydrated = { ...result, local_url: result.url, url: absoluteUrl, displayed: true };
      // Speech freshness and artifact-preview freshness are deliberately separate.
      const canPreview = _isPreviewCurrent() && ownsProgress();
      if (!_isCurrent() || result.retained || !canPreview) {
        if (canPreview) {
          a.show(hydrated);
        } else if (ownsProgress()) {
          a.preview.retain(requestGeneration);
        }
        a.log(canPreview
          ? `image preview ready after superseded turn: ${hydrated.filename}`
          : `image retained on disk after superseded request: ${hydrated.filename}`);
        return { ...hydrated, displayed: canPreview, staged: false, retained: true,
          retrieval: { tool: "move_generated_image_to_sensing_eye", arguments: { filename: hydrated.filename } } };
      }
      a.show(hydrated);
      a.log(`image generated: ${hydrated.filename || absoluteUrl}`);
      return hydrated;
    }
    return { generate };
  }

  return { create };
});

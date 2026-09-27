(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790SensingEyePersistence = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create(a) {
    async function saveText({ content, name, source = "operator text", memoryContext = null } = {}) {
      const generation = a.generation();
      const text = String(content || "");
      if (!text) return null;
      const context = memoryContext && typeof memoryContext === "object" ? memoryContext : a.memoryContext();
      try {
        const response = await a.fetch(a.url("/api/sensing-eye/text"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source,
            filename: name || "sensing-eye-text.txt",
            content: text,
            memory_context: context
          }),
          cache: "no-store"
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.status === "error") {
          throw new Error(result.error || `${response.status} ${response.statusText}`);
        }
        if (generation === a.generation()) a.rememberAsset(result.saved_filename);
        return result;
      } catch (error) {
        a.log(`sensing-eye text note save error: ${error.message}`);
        return null;
      }
    }

    async function saveVisual({ dataUrl, name, source = "operator", reason = "", memoryContext = null } = {}) {
      const generation = a.generation();
      const imageDataUrl = String(dataUrl || "");
      if (!imageDataUrl) return null;
      const context = memoryContext && typeof memoryContext === "object" ? memoryContext : a.memoryContext();
      try {
        const response = await a.fetch(a.url("/api/sensing-eye/inbox"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source,
            filename: name || "sensing-eye.jpg",
            image_data_url: imageDataUrl,
            client_id: a.clientId(),
            client_eye_generation: generation,
            reason: reason || "sensing-eye visual note",
            memory_context: context
          }),
          cache: "no-store"
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.status === "error") {
          throw new Error(result.error || `${response.status} ${response.statusText}`);
        }
        // Consume even a late receipt so polling cannot echo an obsolete local upload.
        const seq = Number(result.seq) || 0;
        if (seq) a.observeInboxSeq(seq);
        if (generation === a.generation()) a.rememberAsset(result.saved_filename);
        return result;
      } catch (error) {
        a.log(`sensing-eye visual note save error: ${error.message}`);
        return null;
      }
    }
    return { saveText, saveVisual };
  }

  return { create };
});

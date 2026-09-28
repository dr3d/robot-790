(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790SensingEyeHistory = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createState() {
    return { images: [], texts: [], imageSeq: 0, textSeq: 0 };
  }

  function create(a) {
    const s = createState();

    function rememberSensingEyeImage({ dataUrl, name, width, height, source = "operator", openUrl = "", savedFilename = "", memoryContext = null } = {}) {
      const imageDataUrl = String(dataUrl || "");
      if (!imageDataUrl) return null;
      const imageName = a.filenameFromPath(name) || String(name || "").trim() || "sensing-eye image";
      s.images = s.images.filter((item) => item.dataUrl !== imageDataUrl);
      const context = memoryContext && typeof memoryContext === "object" ? memoryContext : a.memoryContext();
      const item = {
        kind: "image",
        id: `eye-${++s.imageSeq}`,
        createdAt: new Date().toISOString(),
        name: imageName,
        width: Number(width) || 0,
        height: Number(height) || 0,
        source: String(source || "operator").replace(/_/g, " ").slice(0, 80),
        openUrl: String(openUrl || ""),
        savedFilename: String(savedFilename || ""),
        lastUserText: String(context.last_user_text || "").trim(),
        nearbyTranscript: String(context.nearby_transcript || "").trim(),
        dataUrl: imageDataUrl
      };
      s.images.unshift(item);
      s.images = s.images.slice(0, a.limit);
      a.changed();
      return item;
    }

    function rememberSensingEyeText({ content, name, source = "operator text", openUrl = "", savedFilename = "", memoryContext = null } = {}) {
      const text = String(content || "");
      if (!text) return null;
      const textName = a.filenameFromPath(name) || String(name || "").trim() || "sensing-eye text";
      s.texts = s.texts.filter((item) => item.content !== text);
      const context = memoryContext && typeof memoryContext === "object" ? memoryContext : a.memoryContext();
      const item = {
        kind: "text",
        id: `eye-text-${++s.textSeq}`,
        createdAt: new Date().toISOString(),
        name: textName,
        characters: text.length,
        width: 0,
        height: 0,
        source: String(source || "operator text").replace(/_/g, " ").slice(0, 80),
        openUrl: String(openUrl || ""),
        savedFilename: String(savedFilename || ""),
        lastUserText: String(context.last_user_text || "").trim(),
        nearbyTranscript: String(context.nearby_transcript || "").trim(),
        content: text
      };
      s.texts.unshift(item);
      s.texts = s.texts.slice(0, a.limit);
      a.changed();
      return item;
    }

    function sensingEyeImageHistoryList() {
      return s.images.map((item, index) => ({
        index: index + 1,
        id: item.id,
        kind: item.kind || "image",
        name: item.name,
        source: item.source,
        created_at: item.createdAt,
        width: item.width,
        height: item.height,
        current: Boolean(a.imageUrl() && item.dataUrl === a.imageUrl()),
        open_url: item.openUrl || "",
        saved_filename: item.savedFilename || "",
        last_user_text: item.lastUserText || "",
        nearby_transcript: item.nearbyTranscript || ""
      }));
    }

    function sensingEyeTextHistoryList() {
      return s.texts.map((item, index) => ({
        index: index + 1,
        id: item.id,
        kind: "text",
        name: item.name,
        source: item.source,
        created_at: item.createdAt,
        characters: item.characters,
        current: Boolean(a.text() && item.content === a.text()),
        open_url: item.openUrl || "",
        saved_filename: item.savedFilename || "",
        last_user_text: item.lastUserText || "",
        nearby_transcript: item.nearbyTranscript || ""
      }));
    }

    function sensingEyeImageHistoryContextLine() {
      const notes = [
        ...sensingEyeImageHistoryList(),
        ...sensingEyeTextHistoryList()
      ].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
      if (!notes.length) return "- Recent open sensing-eye notes this browser session: none; saved eye notes may still be listable by tool.";
      const current = notes.find(item => item.current);
      return `- Retained sensing-eye notes this browser session: ${notes.length}. Current: ${current
        ? `${current.kind || "image"} ${current.name}${current.saved_filename ? ` [${current.saved_filename}]` : ""}`
        : "none"}. Earlier identities remain in tool receipts and the sensing-eye catalogue.`;
    }

    return {
      rememberImage: rememberSensingEyeImage,
      rememberText: rememberSensingEyeText,
      imageList: sensingEyeImageHistoryList,
      textList: sensingEyeTextHistoryList,
      contextLine: sensingEyeImageHistoryContextLine,
      imageFor: dataUrl => s.images.find(item => item.dataUrl === dataUrl) || null,
      imageById: id => s.images.find(item => item.id === id),
      textById: id => s.texts.find(item => item.id === id),
      imageIndex: item => s.images.indexOf(item),
      get imageCount() { return s.images.length; },
      get textCount() { return s.texts.length; }
    };
  }

  return { create };
});

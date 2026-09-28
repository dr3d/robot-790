(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790SensingEyeContent = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createState() {
    return {
      sensingEyeGeneration: 0, sensingEyeInboxClearInFlight: false,
      visionImageUrl: "", visionImageName: "", visionImageStaged: false, visionImageOpenUrl: "",
      sensingTextContent: "", sensingTextName: "", sensingTextOpenUrl: "", sensingTextSavedFilename: ""
    };
  }

  function create(a) {
    const s = createState();

    function restoreImage(item) {
      s.sensingTextContent = "";
      s.sensingTextName = "";
      s.sensingTextOpenUrl = "";
      s.sensingTextSavedFilename = "";
      s.visionImageUrl = item.dataUrl;
      s.visionImageName = item.name || "sensing-eye image";
      s.visionImageStaged = false;
      s.visionImageOpenUrl = item.openUrl || "";
    }

    function markStaged() { s.visionImageStaged = true; }
    function resetStaging() { s.visionImageStaged = false; }

    function requireCurrent(generation) {
      if (generation !== s.sensingEyeGeneration) {
        throw new Error("Sensing-eye load canceled: the eye was cleared or a new session began.");
      }
    }

    async function setImage(drawable, name, options = {}) {
      const generation = options.eyeGeneration ?? s.sensingEyeGeneration;
      requireCurrent(generation);
      if (options.isCurrent && !options.isCurrent()) throw new Error("Image request was superseded.");
      const naturalWidth = drawable.videoWidth || drawable.naturalWidth || drawable.width;
      const naturalHeight = drawable.videoHeight || drawable.naturalHeight || drawable.height;
      if (!naturalWidth || !naturalHeight) {
        throw new Error("Camera frame is not ready yet.");
      }
      const previousCover = a.audioRecordingActive() ? a.audioRecordingCurrentVisualCover({ includePlaceholder: true }) : null;
      const scale = Math.min(1, a.visionMaxEdgePx / Math.max(naturalWidth, naturalHeight));
      const width = Math.max(1, Math.round(naturalWidth * scale));
      const height = Math.max(1, Math.round(naturalHeight * scale));
      const canvas = a.createCanvas();
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#101114";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(drawable, 0, 0, width, height);
      const imageUrl = canvas.toDataURL("image/jpeg", a.visionJpegQuality);
      const imageName = name || "image";
      let openUrl = String(options.openUrl || "");
      const memoryContext = options.memoryContext && typeof options.memoryContext === "object"
        ? options.memoryContext
        : a.sensingEyeMemoryContext();
      let savedResult = null;
      if (options.saveToFilesystem !== false) {
        savedResult = await a.saveSensingEyeVisualNote({
          dataUrl: imageUrl,
          name: imageName,
          source: options.source || "operator",
          reason: options.reason || "sensing-eye visual note",
          memoryContext
        });
        if (savedResult?.saved_url) {
          openUrl = a.absoluteUrl(String(savedResult.saved_url));
        }
      }
      requireCurrent(generation);
      if (options.isCurrent && !options.isCurrent()) throw new Error("Image request was superseded.");
      s.sensingTextContent = "";
      s.sensingTextName = "";
      s.sensingTextOpenUrl = "";
      s.sensingTextSavedFilename = "";
      s.visionImageUrl = imageUrl;
      s.visionImageName = imageName;
      s.visionImageStaged = false;
      s.visionImageOpenUrl = openUrl;
      const historyItem = a.rememberSensingEyeImage({
        dataUrl: s.visionImageUrl,
        name: s.visionImageName,
        width,
        height,
        source: options.source || "operator",
        openUrl: s.visionImageOpenUrl,
        savedFilename: options.savedFilename || savedResult?.saved_filename || "",
        memoryContext
      });
      a.ui().visionPreview.src = s.visionImageUrl;
      a.ui().visionPreview.classList.add("ready");
      a.ui().visionDrop.classList.remove("text-ready");
      a.ui().visionHint.textContent = `${s.visionImageName} (${width}x${height})`;
      a.updateVisionButtons();
      a.updateSessionTools();
      a.log(`sensing-eye image loaded: ${a.ui().visionHint.textContent}`);
      a.recordUiEvent("sensing input image", a.ui().visionHint.textContent, {
        name: s.visionImageName,
        width,
        height,
        source_width: naturalWidth,
        source_height: naturalHeight,
        staged: s.visionImageStaged,
        history_id: historyItem?.id || ""
      });
      a.addSensingEyeVisualNoteTranscriptMarker(
        options.transcriptAction || "loaded into eye",
        historyItem,
        { touchActivity: false }
      );
      if (options.autoStage !== false) a.stageVisionImage();
      a.rolloverAudioRecordingForVisualChange("sensing-eye image changed", { cover: previousCover });
      return historyItem;
    }

    async function setText(raw, name = "text", options = {}) {
      const generation = options.eyeGeneration ?? s.sensingEyeGeneration;
      requireCurrent(generation);
      if (options.isCurrent && !options.isCurrent()) throw new Error("Sensing-eye text request was superseded.");
      const content = String(raw || "").replace(/\r\n/g, "\n").trim();
      if (!content) throw new Error("Text file is empty.");
      let savedResult = null;
      let openUrl = String(options.openUrl || "");
      let savedFilename = String(options.savedFilename || "");
      const memoryContext = options.memoryContext && typeof options.memoryContext === "object"
        ? options.memoryContext
        : a.sensingEyeMemoryContext();
      if (options.saveToFilesystem !== false) {
        savedResult = await a.saveSensingEyeTextNote({
          content,
          name,
          source: options.source || "operator text",
          memoryContext
        });
        if (savedResult?.saved_url) openUrl = a.absoluteUrl(String(savedResult.saved_url));
        if (savedResult?.saved_filename) savedFilename = String(savedResult.saved_filename);
      }
      requireCurrent(generation);
      if (options.isCurrent && !options.isCurrent()) throw new Error("Sensing-eye text request was superseded.");
      s.visionImageUrl = "";
      s.visionImageName = "";
      s.visionImageStaged = false;
      s.visionImageOpenUrl = "";
      a.ui().visionPreview.removeAttribute("src");
      a.ui().visionPreview.classList.remove("ready");
      s.sensingTextContent = content;
      s.sensingTextName = name || "text";
      s.sensingTextOpenUrl = openUrl;
      s.sensingTextSavedFilename = savedFilename;
      const textItem = a.rememberSensingEyeText({
        content,
        name: s.sensingTextName,
        source: options.source || "operator text",
        openUrl,
        savedFilename,
        memoryContext
      });
      a.ui().visionDrop.classList.add("text-ready");
      const clipped = content.length > a.maxSensingTextChars;
      a.ui().visionHint.textContent = `${s.sensingTextName} - ${a.approximateTextTokens(content).toLocaleString()} tok eye text${clipped ? " clipped" : ""}`;
      a.updateVisionButtons();
      a.updateSessionTools();
      if (a.ui().contextPanel?.open) a.renderContextMap();
      a.log(`sensing text loaded: ${s.sensingTextName} (${content.length} chars${savedFilename ? `, saved ${savedFilename}` : ""}${clipped ? `, clipped to ${a.maxSensingTextChars}` : ""})`);
      a.recordUiEvent("sensing input text", a.ui().visionHint.textContent, {
        name: s.sensingTextName,
        characters: content.length,
        clipped,
        max_chars: a.maxSensingTextChars,
        saved_filename: savedFilename,
        history_id: textItem?.id || ""
      });
      a.addSensingEyeVisualNoteTranscriptMarker(
        options.transcriptAction || "loaded into eye",
        textItem,
        { touchActivity: false }
      );
      a.scheduleIdlePonder();
      return textItem;
    }

    async function clear({ source = "ui", reason = "" } = {}) {
      const generation = ++s.sensingEyeGeneration;
      const previous = a.sensingInputLabel();
      s.sensingEyeInboxClearInFlight = true;
      s.visionImageUrl = "";
      s.visionImageName = "";
      s.visionImageStaged = false;
      s.visionImageOpenUrl = "";
      s.sensingTextContent = "";
      s.sensingTextName = "";
      s.sensingTextOpenUrl = "";
      s.sensingTextSavedFilename = "";
      a.ui().visionFile.value = "";
      a.ui().visionPreview.removeAttribute("src");
      a.ui().visionPreview.classList.remove("ready");
      a.ui().visionDrop.classList.remove("text-ready");
      a.ui().visionHint.textContent = "Drop image or text, then speak";
      a.updateVisionButtons();
      a.updateSessionTools();
      if (a.ui().contextPanel?.open) a.renderContextMap();
      a.recordUiEvent("sensing input cleared", previous || "none", {
        current: a.sensingInputLabel(),
        source,
        reason: String(reason || "").slice(0, 120) || null
      });
      await Promise.allSettled([
        a.clearSensingEyeInboxOnServer(),
        a.clearBrowserFaceCaptureQueue()
      ]).then((results) => {
        if (generation !== s.sensingEyeGeneration) return;
        const inboxResult = results[0];
        const faceResult = results[1];
        if (inboxResult.status === "fulfilled") {
          a.log(`sensing-eye inbox cleared: seq ${inboxResult.value.latest_seq || 0}`);
        } else {
          a.log(`sensing-eye inbox clear error: ${inboxResult.reason?.message || inboxResult.reason}`);
        }
        if (faceResult.status === "fulfilled" && faceResult.value) {
          a.log(`browser-face mirror queue cleared: seq ${faceResult.value.latest_seq || 0}`);
        } else if (faceResult.status === "rejected") {
          a.log(`browser-face mirror queue clear error: ${faceResult.reason?.message || faceResult.reason}`);
        }
        s.sensingEyeInboxClearInFlight = false;
        if (source === "session_connect" && results.some((result) => result.status === "rejected")) {
          throw new Error("Could not clear the sensing-eye inbox or mirror queue. Retry Connect.");
        }
      });
      return previous;
    }

    return {
      requireCurrent, setImage, setText, clear, restoreImage, markStaged, resetStaging,
      get generation() { return s.sensingEyeGeneration; },
      get clearInFlight() { return s.sensingEyeInboxClearInFlight; },
      get imageUrl() { return s.visionImageUrl; },
      get imageName() { return s.visionImageName; },
      get imageStaged() { return s.visionImageStaged; },
      get imageOpenUrl() { return s.visionImageOpenUrl; },
      get text() { return s.sensingTextContent; },
      get textName() { return s.sensingTextName; },
      get textOpenUrl() { return s.sensingTextOpenUrl; },
      get textSavedFilename() { return s.sensingTextSavedFilename; }
    };
  }

  return { create };
});

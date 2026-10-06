(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790TtsControls = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Requested engine settings never stand in for the running model's capabilities.
  function create({ model, styles, activeLabel, styleNotice, restartNotice, storage }) {
    const modelKey = "robot790.ttsModel.v1";
    let active = null;
    let modelChosen = false;
    let pageServerOutdated = false;
    function supportsStyles() { return active?.running === true && active?.style_instructions === true; }
    function render() {
      styles.hidden = !supportsStyles();
      styleNotice.hidden = supportsStyles();
      model.disabled = pageServerOutdated;
      if (pageServerOutdated) {
        activeLabel.textContent = "STS page server needs restart.";
        styleNotice.textContent = "The page server is still running old code and cannot verify delivery-style support.";
        restartNotice.textContent = "Restart the STS page server, then refresh. The Realtime Server restart button does not restart the page server.";
        return;
      }
      activeLabel.textContent = active?.running
        ? `In use: ${active.model || active.label || "Unknown speech model"}`
        : active ? "Speech server is not running." : "Speech model not verified.";
      styleNotice.textContent = active?.running && active.style_instructions === false
        ? "This speech model supports named voices. Delivery styles require 1.7B."
        : "Delivery styles appear when a supported speech model is running.";
      const pending = active?.running && model.value !== active.model;
      restartNotice.textContent = pending
        ? `Restart required to use ${model.value}. Use Server Management → Restart.`
        : "Model changes require Server Management → Restart.";
    }
    function load() {
      const savedModel = storage.getItem(modelKey);
      modelChosen = ["0.6B", "1.7B"].includes(savedModel);
      model.value = modelChosen ? savedModel : "0.6B";
      render();
    }
    function update(result) {
      pageServerOutdated = false;
      active = result?.active || null;
      if (active?.running) {
        if (!modelChosen && ["0.6B", "1.7B"].includes(active.model)) model.value = active.model;
      }
      for (const option of model.options) {
        const installed = result?.models?.find(item => item.id === option.value)?.installed;
        option.disabled = installed === false;
        option.textContent = `${option.value} — ${option.value === "1.7B" ? "Voices + delivery styles" : "Named voices"}${installed === false ? " (not installed)" : ""}`;
      }
      render();
    }
    return {
      load, update, render, supportsStyles,
      get active() { return active; },
      modelChanged() { modelChosen = true; storage.setItem(modelKey, model.value); render(); },
      unavailable({ outdated = false } = {}) {
        active = null;
        pageServerOutdated ||= outdated;
        render();
      },
      styleUnavailableReason() {
        return active?.running && active.style_instructions === false
          ? "The running 0.6B speech model does not support delivery styles. Named voice changes are available."
          : "Speech-model style support has not been verified. Named voice changes are available.";
      }
    };
  }
  return { create };
});

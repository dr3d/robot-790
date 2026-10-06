(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790Brain2Speech = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create({ getSynthesis, createUtterance, canSpeak, getSessionGeneration,
    log, now = () => Date.now(), prepare = () => null, release = () => {} }) {
    let current = null, revision = 0, muteUntil = 0;

    function cancel(reason = "monitor reset") {
      const previous = current;
      current = null;
      revision++;
      muteUntil = 0;
      release({ tailMs: 0 });
      // Invalidate before cancel: browsers may dispatch callbacks synchronously.
      if (previous) {
        previous.synthesis.cancel();
        log("voice canceled", reason);
      }
    }

    function speak(text, options = {}) {
      if ((options.revision !== undefined && options.revision !== revision) || !canSpeak(options)) return false;
      const synthesis = getSynthesis();
      if (!synthesis) return false;
      const utterance = createUtterance(text);
      cancel("replaced");
      if (!canSpeak(options)) return false;
      const token = { synthesis, utterance, started: false, generation: getSessionGeneration() };
      current = token;
      const isSessionCurrent = () => token.generation === getSessionGeneration();
      utterance.onstart = () => {
        // An expired callback must not globally cancel a newer browser utterance.
        if (current !== token) return;
        if (!isSessionCurrent() || !canSpeak(options)) {
          cancel("speaker busy or session ended");
          return;
        }
        token.started = true;
        log("voice started", text);
      };
      const finish = kind => {
        if (current !== token) return;
        current = null;
        muteUntil = token.started && isSessionCurrent() ? now() + 500 : 0;
        release({ tailMs: muteUntil ? 500 : 0 });
        log(kind, text);
      };
      utterance.onend = () => finish("voice ended");
      utterance.onerror = () => finish("voice error");
      const dispatch = () => {
        if (current !== token) return false;
        if (!isSessionCurrent() || !canSpeak(options)) { cancel("speaker busy or session ended"); return false; }
        try {
          synthesis.speak(utterance);
          log(options.kind || "voice", text);
          return true;
        } catch (error) {
          if (current === token) cancel("browser speech failed");
          log("voice error", error.message);
          return false;
        }
      };
      let preparation;
      try { preparation = prepare(); } catch (error) {
        cancel("microphone preparation failed");
        log("voice error", error.message);
        return false;
      }
      if (preparation?.then) {
        preparation.then(dispatch, error => {
          if (current !== token) return;
          cancel("microphone preparation failed");
          log("voice error", error.message);
        });
        return true;
      }
      return dispatch();
    }

    return {
      speak, cancel,
      get revision() { return revision; },
      shouldMuteMic: () => Boolean(current?.started || now() < muteUntil),
    };
  }

  return { create };
});

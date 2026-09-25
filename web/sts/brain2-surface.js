(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790Brain2Surface = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create({ getSession, isCurrentSession, isEnabled, getMaxAge,
    canSpeak, speak, canDisplay, display, onHeld, log,
    now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout }) {
    let pending = null, timer = null, revision = 0;

    function stopWaiting() {
      const previous = timer;
      timer = null;
      if (previous) clearTimer(previous.id);
    }

    function reset() {
      revision++;
      pending = null;
      stopWaiting();
    }

    function schedule() {
      stopWaiting();
      if (!pending) return;
      const token = { id: null };
      timer = token;
      token.id = setTimer(() => {
        if (timer !== token) return;
        timer = null;
        maybeSurface().catch(error => log("surface error", error.message));
      }, 1200);
    }

    function defer(mouthText, reason, monitorText = mouthText) {
      pending = { mouthText, monitorText, reason, createdAt: now(), voiceSpoken: false,
        session: getSession(), revision: ++revision };
      onHeld(reason, mouthText);
      schedule();
    }

    async function maybeSurface() {
      const item = pending;
      if (!item) return;
      if (!isCurrentSession(item.session)) { reset(); return; }
      if (!isEnabled()) {
        log("held dropped", `brain 2 off: ${item.mouthText}`);
        reset();
        return;
      }
      if (now() - item.createdAt > getMaxAge()) {
        log("held expired", item.mouthText);
        reset();
        return;
      }
      const isCurrent = () => revision === item.revision && isCurrentSession(item.session) && isEnabled();
      if (!item.voiceSpoken && canSpeak()) {
        const admitted = speak(item.monitorText);
        if (pending !== item || !isCurrent()) return;
        item.voiceSpoken = admitted;
      }
      if (!canDisplay()) { schedule(); return; }
      pending = null;
      stopWaiting();
      // The device call may finish later; its receipt cannot revive superseded work.
      await display(item.mouthText, { speak: !item.voiceSpoken, monitorText: item.monitorText, isCurrent });
    }

    return {
      defer, schedule, maybeSurface, stopWaiting, reset,
      markVoiceHandled() { if (pending) pending.voiceSpoken = true; },
      get pending() {
        if (!pending) return null;
        const { mouthText, reason, createdAt, voiceSpoken } = pending;
        return { mouthText, reason, createdAt, voiceSpoken };
      }
    };
  }

  return { create };
});

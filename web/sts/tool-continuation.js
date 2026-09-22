(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790ToolContinuation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create({ isCurrent, isSameSession, getUserActivity, audioActive,
    getMaxRounds, hasSessionMove, onSessionMove, onTerminal, onFollowup,
    setTimer = setTimeout, clearTimer = clearTimeout }) {
    let drainToken = null;
    const owner = {
      pending: 0, needed: false, terminal: false, responseDone: false,
      rounds: 0, origin: "conversation", userActivityAt: 0, sources: [],
      drainTimer: null, handledIds: new Set(),

      startTurn(origin = "conversation") {
        owner.rounds = 0;
        owner.origin = origin;
        owner.terminal = false;
      },
      allowTools() { owner.terminal = false; },
      clearSources() { owner.sources = []; },
      cancelFollowup() { owner.needed = false; owner.clearSources(); },
      stopWaiting() {
        if (owner.drainTimer) clearTimer(owner.drainTimer);
        owner.drainTimer = null;
        drainToken = null;
      },
      reset() {
        owner.stopWaiting();
        owner.startTurn();
        owner.pending = 0;
        owner.needed = false;
        owner.responseDone = false;
        owner.userActivityAt = 0;
        owner.clearSources();
        owner.handledIds.clear();
      },
      beginCall(event, { generation, userActivityAt }) {
        const key = event.call_id ? `${generation}:${event.call_id}` : "";
        if (key && owner.handledIds.has(key)) return false;
        if (key) {
          owner.handledIds.add(key);
          while (owner.handledIds.size > 512) owner.handledIds.delete(owner.handledIds.values().next().value);
        }
        if (!owner.needed) owner.responseDone = false;
        owner.pending++;
        owner.needed = true;
        owner.userActivityAt = userActivityAt;
        owner.sources = [...owner.sources, event.name].slice(-8);
        return true;
      },
      finishCall(session) {
        if (!isSameSession(session)) return;
        owner.pending = Math.max(0, owner.pending - 1);
        owner.maybeFollowup(session);
      },
      completeResponse() {
        if (owner.needed) owner.responseDone = true;
        return owner.needed;
      },
      maybeFollowup(session) {
        if (!isCurrent(session) || !owner.needed || owner.pending > 0 || !owner.responseDone) return;
        if (owner.terminal) {
          owner.cancelFollowup();
          owner.responseDone = false;
          owner.stopWaiting();
          onTerminal(owner.origin);
          return;
        }
        if (owner.userActivityAt !== getUserActivity()) {
          owner.cancelFollowup();
          return;
        }
        if (audioActive()) {
          if (!owner.drainTimer) {
            const token = {};
            drainToken = token;
            owner.drainTimer = setTimer(() => {
              // A callback already queued before reset must not clear a new wait.
              if (drainToken !== token) return;
              owner.drainTimer = null;
              drainToken = null;
              owner.maybeFollowup(session);
            }, 100);
          }
          return;
        }
        owner.needed = false;
        owner.responseDone = false;
        if (hasSessionMove()) {
          owner.clearSources();
          onSessionMove();
          return;
        }
        const limit = Math.max(1, Math.min(32, Number(getMaxRounds()) || 8));
        const exhausted = owner.rounds >= limit;
        owner.rounds++;
        owner.terminal = exhausted;
        const sources = owner.sources;
        owner.clearSources();
        onFollowup({ ...session, sources, origin: owner.origin, exhausted, limit });
      },
    };
    return owner;
  }

  return { create };
});

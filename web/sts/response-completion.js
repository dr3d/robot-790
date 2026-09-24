(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790ResponseCompletion = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create(a) {
    const owner = {
      active: false, pending: false, wasIdle: false, armedAt: 0, timer: null,

      clearTimer() {
        if (owner.timer) a.clearTimeout(owner.timer);
        owner.timer = null;
      },
      clearPending() {
        owner.pending = false;
        owner.wasIdle = false;
        owner.armedAt = 0;
      },
      arm({ wasIdle = false } = {}) {
        owner.pending = true;
        owner.wasIdle = Boolean(owner.wasIdle || wasIdle);
        owner.armedAt = a.now();
        owner.clearTimer();
        owner.timer = a.setTimeout(owner.check, 100);
      },
      check() {
        owner.clearTimer();
        if (!owner.pending) return;
        // Model completion is not permission to resume idle while audio drains.
        if (owner.active || a.audioActive()) {
          owner.timer = a.setTimeout(owner.check, 150);
          return;
        }
        const wasIdle = owner.wasIdle;
        owner.clearPending();
        a.finished(wasIdle);
      },
      audioDone(event, session) {
        a.flush().catch(error => a.error(error));
        if (event.type === "response.done") {
          if (event.response?.status && event.response.status !== "completed") a.cancelResponse(event);
          const { idle, gpuWatch, standing } = a.lanes();
          const routine = gpuWatch || standing;
          const awaiting = a.completeTools();
          owner.active = false;
          a.clearLanes();
          if (!awaiting && !routine) a.clearGoal();
          if (!awaiting && !routine) owner.arm({ wasIdle: idle });
          if (!awaiting) a.clearImageProtection();
          if (!awaiting && idle) a.updateTools();
          if (!awaiting && gpuWatch) a.resumeGpu();
          if (!awaiting && standing) a.resumeStanding();
          a.pressure(awaiting ? "B1 waiting for tool followup"
            : gpuWatch ? "B1 watch response done"
            : standing ? "B1 standing routine response done" : "B1 response done");
          a.idleStatus();
          if (awaiting) a.followup(session);
        }
        if (!a.needsFollowup()) a.faceIdle();
      },
    };
    return owner;
  }

  return { create };
});

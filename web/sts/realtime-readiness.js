(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790RealtimeReadiness = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Availability only: never opens a session, retries Restart, or runs a model.
  function create({ probe, canCheck, onChange }) {
    let ready = false, pending = false, generation = 0;
    function publish(value) {
      if (ready === value) return;
      ready = value;
      onChange();
    }
    return {
      get ready() { return ready; },
      invalidate() {
        generation++;
        publish(false);
      },
      async check() {
        if (pending || !canCheck()) return;
        pending = true;
        const current = generation;
        let available = false;
        try { available = (await probe()) === true; }
        catch { /* Unreachable, starting, and timed-out services are unavailable. */ }
        finally {
          pending = false;
          if (current === generation && canCheck()) publish(available);
        }
      }
    };
  }

  async function probeLocal() {
    const response = await fetch(new URL("/api/realtime/ready", location.href), {
      cache: "no-store", signal: AbortSignal.timeout(2500)
    });
    return response.ok && (await response.json()).ready === true;
  }

  return { create, probeLocal };
});

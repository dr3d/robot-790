(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790NetworkCamera = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create({ request, onFrame, onState, interval = () => 1000,
    setTimer = setTimeout, clearTimer = clearTimeout }) {
    let active = false, epoch = 0, pending = null, timer = null, controller = null;
    let error = "";
    const state = () => ({ active, busy: Boolean(pending), error });
    const notify = () => onState(state());
    function stop() {
      active = false;
      epoch++;
      clearTimer(timer);
      timer = null;
      controller?.abort();
      controller = null;
      pending = null;
      error = "";
      notify();
    }
    function snapshot() {
      if (pending) return pending;
      const generation = epoch;
      const abort = new AbortController();
      controller = abort;
      error = "";
      const task = Promise.resolve().then(() => {
        if (generation !== epoch) throw new Error("Camera request canceled.");
        return request(abort.signal);
      }).then(frame => {
        if (generation !== epoch) throw new Error("Camera request canceled.");
        onFrame(frame);
        return frame;
      }).catch(cause => {
        if (generation === epoch) {
          error = cause.message;
          active = false;
          clearTimer(timer);
          timer = null;
        }
        throw cause;
      }).finally(() => {
        if (pending === task) { pending = null; controller = null; notify(); }
      });
      pending = task;
      notify();
      return task;
    }
    async function poll(generation) {
      try { await snapshot(); } catch { return; }
      if (active && generation === epoch) timer = setTimer(() => poll(generation), interval());
    }
    function start() {
      if (active) return;
      active = true;
      error = "";
      notify();
      void poll(epoch);
    }
    return { start, stop, snapshot, state, generation: () => epoch };
  }
  return { create };
});

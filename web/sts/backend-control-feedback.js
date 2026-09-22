(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790BackendControlFeedback = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Own UI completion only. This does not cancel a submitted backend command.
  function create({ setTimer, clearTimer, onPending }) {
    let current = null;
    return {
      begin({ kind, isCurrent }) {
        if (current?.timer != null) clearTimer(current.timer);
        const record = { timer: null };
        current = record;
        onPending(kind);
        const updateIfCurrent = update => {
          if (current !== record || !isCurrent()) return false;
          update();
          return true;
        };
        const complete = (update = () => {}) => {
          if (current !== record) return false;
          if (record.timer != null) clearTimer(record.timer);
          const apply = isCurrent();
          current = null;
          // Release this operation's controls even if its connection has changed.
          onPending(null);
          if (apply) update();
          return true;
        };
        return {
          update: updateIfCurrent,
          complete,
          defer(update, delayMs) {
            if (current !== record) return;
            if (record.timer != null) clearTimer(record.timer);
            const timer = setTimer(() => {
              if (record.timer === timer) complete(update);
            }, delayMs);
            record.timer = timer;
          }
        };
      }
    };
  }

  return { create };
});

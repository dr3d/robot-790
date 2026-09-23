(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790Brain2Work = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create() {
    let active = null;
    let headlines = false;
    return {
      get busy() { return active !== null; },
      get headlines() { return headlines; },
      begin({ socket, generation, headlines: reading = false }) {
        if (active) return null;
        active = Object.freeze({ socket, generation });
        headlines = reading;
        return active;
      },
      finish(token, session) {
        // Completion belongs to a specific request, not just a connection.
        if (!active || token !== active || token.socket !== session.socket
          || token.generation !== session.generation) return false;
        active = null;
        headlines = false;
        return true;
      },
      clearHeadlines() { headlines = false; },
      reset() { active = null; headlines = false; }
    };
  }

  return { create };
});

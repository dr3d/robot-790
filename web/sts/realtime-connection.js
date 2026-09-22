(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790RealtimeConnection = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create() {
    let transition = null;
    const owner = {
      socket: undefined, generation: 0, stopped: false,
      get transition() { return transition; },

      async runTransition(kind, operation, parent = null) {
        // Session jumps share their parent's token; unrelated actions never queue.
        if (parent) {
          if (parent !== transition) throw new Error("The connection operation has expired.");
          return operation(parent);
        }
        if (transition) throw new Error("A connection change is already in progress.");
        const token = Object.freeze({ kind });
        transition = token;
        try {
          return await operation(token);
        } finally {
          if (transition === token) transition = null;
        }
      },

      invalidate() { owner.generation++; },
      adopt(socket) {
        owner.socket = socket;
        owner.generation++;
        owner.stopped = false;
        return owner.generation;
      },
      requestStop() { owner.stopped = true; },
      isCurrent(socket = owner.socket, generation = owner.generation) {
        return Boolean(socket && socket === owner.socket && generation === owner.generation);
      },
      isActive(socket = owner.socket, generation = owner.generation) {
        return !owner.stopped && owner.isCurrent(socket, generation) && socket.readyState === 1;
      },
      isConnected() {
        return Boolean(!owner.stopped && owner.socket && owner.socket.readyState === 1);
      },
      send(event, { socket = owner.socket, generation = owner.generation } = {}) {
        if (!owner.isActive(socket, generation)) return;
        socket.send(JSON.stringify(event));
      },
    };
    return owner;
  }

  return { create };
});

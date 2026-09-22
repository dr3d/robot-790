(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790RealtimeConnection = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create() {
    let transition = null;
    let closure = null;
    const owner = {
      socket: undefined, generation: 0, stopped: false,
      get transition() { return transition; },
      get closing() { return Boolean(closure?.pending && closure.generation === owner.generation); },
      get busy() { return Boolean(transition || owner.closing); },

      async runTransition(kind, operation, parent = null) {
        if (owner.closing) throw new Error("Connection cleanup is still in progress.");
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
      close(socket, generation, cleanup) {
        if (!owner.isCurrent(socket, generation)) return Promise.resolve();
        if (closure?.generation === generation) return closure.promise;
        const record = { generation, pending: true, promise: null };
        let resolve, reject;
        record.promise = new Promise((yes, no) => { resolve = yes; reject = no; })
          .finally(() => { record.pending = false; });
        closure = record;
        owner.requestStop();
        // Publish ownership before cleanup runs: stopping playback/devices is synchronous.
        try { Promise.resolve(cleanup()).then(resolve, reject); }
        catch (error) { reject(error); }
        return record.promise;
      },
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

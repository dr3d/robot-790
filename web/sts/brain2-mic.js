(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790Brain2Mic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Temporarily admit speaker audio during the operator's B2 listening experiment.
  // Track constraints are serialized; canceled preparation cannot alter a new mic.
  function create({ getTrack, listenEnabled, report = () => {},
    setTimer = setTimeout, clearTimer = clearTimeout }) {
    const tracks = new WeakMap();
    let windowOpen = false, tailTimer = null;
    function clearTail() { if (tailTimer !== null) clearTimer(tailTimer); tailTimer = null; }
    function sync() {
      const track = getTrack();
      if (!track || track.readyState === "ended") return null;
      const echo = !(windowOpen && listenEnabled());
      let state = tracks.get(track);
      if (!state) {
        state = { desired: null, actual: track.getSettings?.().echoCancellation, revision: 0,
          pending: false, chain: Promise.resolve(), error: null };
        tracks.set(track, state);
      }
      if (state.desired === echo) return state.pending ? state.chain : null;
      state.desired = echo;
      const revision = ++state.revision;
      state.error = null;
      if (!state.pending && state.actual === echo) return null;
      state.pending = true;
      state.chain = state.chain.then(async () => {
        if (track !== getTrack() || track.readyState === "ended" || revision !== state.revision) return;
        try {
          if (state.actual !== echo) {
            if (!track.applyConstraints) throw new Error("This microphone cannot change echo cancellation while running.");
            await track.applyConstraints({ ...track.getConstraints?.(), echoCancellation: { exact: echo } });
            state.actual = track.getSettings?.().echoCancellation;
            if (state.actual !== echo) throw new Error(`Microphone echo cancellation ${echo ? "On" : "Off"} was not confirmed.`);
          }
          if (track === getTrack() && revision === state.revision) report({ echoCancellation: echo });
        } catch (error) {
          if (track === getTrack() && revision === state.revision) {
            state.error = error.message;
            report({ error: error.message, echoCancellation: state.actual });
          }
        } finally {
          if (revision === state.revision) state.pending = false;
        }
      });
      return state.chain;
    }
    function begin() { clearTail(); windowOpen = true; return sync(); }
    function end({ tailMs = 0 } = {}) {
      clearTail();
      if (tailMs > 0) {
        tailTimer = setTimer(() => { tailTimer = null; windowOpen = false; sync(); }, tailMs);
        return;
      }
      windowOpen = false;
      sync();
    }
    function blocksInput() {
      const state = tracks.get(getTrack());
      // Do not send Eric's playback back to him while normal echo protection is restoring.
      return Boolean(state && (state.pending || (state.desired && state.actual === false)));
    }
    return { begin, end, sync, blocksInput };
  }
  return { create };
});

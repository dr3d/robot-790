(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790ThinkingControls = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const keys = { eric: "robot790.ericThinking.v2", brain2: "robot790.brain2Thinking.v1" };
  const enabledModes = ["on", "minimal", "low", "medium", "high", "xhigh"];
  function label(mode, profile) {
    if (mode === "on" && profile?.on_option && profile.on_option !== "on") {
      return `On (${label(profile.on_option)} default)`;
    }
    return { none: "Off", off: "Off", on: "On", minimal: "Minimal", low: "Low", medium: "Medium", high: "High", xhigh: "Extra high" }[mode] || mode;
  }
  function options(profile) {
    if (profile?.status !== "verified") return [];
    const modes = profile.can_off ? ["none"] : [];
    if (profile.can_on) modes.push(...(profile.options || []).filter(value => enabledModes.includes(value)));
    return [...new Set(modes)].map(value => ({ value, label: label(value, profile) }));
  }
  function create({ storage, changed = () => {} }) {
    const states = {};
    for (const brain of Object.keys(keys)) {
      let saved;
      try { saved = JSON.parse(storage.getItem(keys[brain]) || "null"); } catch { saved = null; }
      states[brain] = { mode: enabledModes.includes(saved?.mode) ? saved.mode : "none", revision: 0,
        savedIdentity: saved?.identity, profile: null };
    }
    function persist(brain) {
      const state = states[brain];
      storage.setItem(keys[brain], JSON.stringify({ mode: state.mode, identity: state.profile?.identity }));
    }
    function snapshot(brain) {
      const state = states[brain];
      if (!state) throw new Error("Choose eric or brain2.");
      return { mode: state.mode, revision: state.revision, model: state.profile?.model,
        identity: state.profile?.identity, profile: state.profile };
    }
    function configure(brain, profile) {
      const state = states[brain];
      const previous = state.profile?.identity || state.savedIdentity;
      if (previous && profile?.identity && previous !== profile.identity) {
        state.revision++;
        state.mode = "none";
      }
      state.profile = profile;
      // Old graded-model On preferences used the advertised enabled default.
      if (state.mode === "on" && profile?.status === "verified" && !profile.options?.includes("on") && profile.can_on) {
        state.mode = profile.on_option;
      }
      if (profile?.identity) { state.savedIdentity = profile.identity; persist(brain); }
    }
    function change(brain, value, { source, observed, reason = "" } = {}) {
      if (source !== "operator") throw new Error("Only the operator can change Thinking in Connection Settings.");
      const before = snapshot(brain);
      let mode = value === "off" ? "none" : value;
      if (mode === "on" && !before.profile?.options?.includes("on") && before.profile?.can_on) mode = before.profile.on_option;
      if (observed && (observed.revision !== before.revision || observed.identity !== before.identity)) {
        throw new Error("Thinking change skipped: a newer choice or loaded model superseded this request.");
      }
      if (!options(before.profile).some(option => option.value === mode)) {
        throw new Error(`Thinking setting ${value} is not supported. ${before.profile?.manual || "The loaded model's Thinking controls are not verified."}`);
      }
      const state = states[brain];
      state.mode = mode;
      state.revision++;
      persist(brain);
      const receipt = { brain, before: before.mode, ...snapshot(brain), source, reason: String(reason).slice(0, 160) };
      changed(receipt);
      return receipt;
    }
    return { snapshot, configure, change, label, options: brain => options(snapshot(brain).profile),
      supports: (brain, mode) => options(snapshot(brain).profile).some(option => option.value === mode),
      packet: () => ({ eric: snapshot("eric"), brain2: snapshot("brain2") }) };
  }
  return { create };
});

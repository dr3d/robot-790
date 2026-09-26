(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790GeneratedPreview = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create(a) {
    const owner = {
      url: "", name: "", state: "empty", label: "", revision: 0,
      status({ state = owner.state, label = owner.label } = {}) {
        const requested = ["empty", "generating", "ready", "failed"].includes(state) ? state : "empty";
        owner.state = requested === "ready" && !owner.url ? "empty" : requested;
        owner.label = String(label || "").replace(/\s+/g, " ").trim().slice(0, 140);
        return { state: owner.state, label: owner.label };
      },
      show(result) {
        owner.revision++;
        const cover = a.captureCover();
        owner.url = a.resolveUrl(String(result?.url || ""));
        owner.name = String(result?.filename || result?.title || "generated image");
        owner.state = "ready";
        owner.label = owner.name;
        a.show(result);
        a.changed();
        a.rollover(cover);
      },
      clear() {
        owner.revision++;
        owner.url = owner.name = owner.label = "";
        owner.state = "empty";
        a.clear();
        a.changed();
      },
      begin(value) {
        const revision = ++owner.revision;
        const title = String(value || "").replace(/\s+/g, " ").trim().slice(0, 80);
        owner.state = "generating";
        owner.label = title || "image";
        a.begin(title);
        owner.url = owner.name = "";
        a.changed();
        return { revision, title };
      },
      owns(revision) {
        return revision === owner.revision && owner.state === "generating";
      },
      fail(revision, error) {
        if (!owner.owns(revision)) return;
        owner.state = "failed";
        owner.label = String(error.message).replace(/\s+/g, " ").trim().slice(0, 120);
        a.failed();
        a.changed();
      },
      retain(revision) {
        if (!owner.owns(revision)) return;
        owner.state = "empty";
        owner.label = "";
        a.retained();
        a.changed();
      },
    };
    return owner;
  }
  return { create };
});

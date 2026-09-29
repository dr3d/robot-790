(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790SensingEyeAssets = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create(a) {
    const filenames = new Set();

    function rememberSensingEyeSessionAsset(filename) {
      const safeFilename = a.filenameFromPath(String(filename || ""));
      if (!safeFilename) return;
      filenames.add(safeFilename);
      persistSensingEyeSessionAssets();
    }

    function sensingEyeSessionAssetFilenamesForSave() {
      return [...filenames].sort((left, right) => left.localeCompare(right));
    }

    function persistSensingEyeSessionAssets() {
      try {
        a.storage().setItem(a.storageKey, JSON.stringify(sensingEyeSessionAssetFilenamesForSave()));
      } catch {
        return;
      }
    }

    function loadSensingEyeSessionAssets() {
      try {
        const stored = JSON.parse(a.storage().getItem(a.storageKey) || "[]");
        if (!Array.isArray(stored)) return;
        stored.forEach((filename) => {
          const safeFilename = a.filenameFromPath(String(filename || ""));
          if (safeFilename) filenames.add(safeFilename);
        });
      } catch {
        return;
      }
    }

    function clearSensingEyeSessionAssets() {
      filenames.clear();
      try {
        a.storage().removeItem(a.storageKey);
      } catch {
        return;
      }
    }

    return {
      remember: rememberSensingEyeSessionAsset,
      filenames: sensingEyeSessionAssetFilenamesForSave,
      persist: persistSensingEyeSessionAssets,
      load: loadSensingEyeSessionAssets,
      clear: clearSensingEyeSessionAssets
    };
  }

  return { create };
});

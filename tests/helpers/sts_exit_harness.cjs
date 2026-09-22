const vm = require('node:vm');
const { closeFixture } = require('./sts_close_harness.cjs');
const { loadFunctions, page } = require('./sts_tool_harness.cjs');

// Real page exits and current close owner; backend control, persistence, devices
// and timers are simulated. This fixture cannot stop/restart/unload a real server.
async function exitFixture() {
  const f = await closeFixture(), { c, calls } = f, fetch = c.fetch;
  const backendRequests = [];
  Object.assign(c, {
    restartServerButton: {}, unloadServerButton: {}, haltRuntimeButtons: [{}, {}],
    currentModelRestartPayload: () => ({ preset: 'fixture-model', context: 131072 }),
    currentModelPreset: () => 'fixture-model',
    async fetch(url, options) {
      const pathname = new URL(url).pathname;
      if (!['/api/realtime/restart', '/api/realtime/stop', '/api/realtime/unload'].includes(pathname)) {
        return fetch(url, options);
      }
      backendRequests.push({ pathname, ...options });
      return { ok: true, json: async () => ({ status: 'ok', pid: 999, preset: 'fixture-model' }) };
    },
  });
  loadFunctions(c, ['restartRealtimeServer', 'haltRealtimeServer', 'unloadRealtimeServer']);
  const fireStatusTimer = kind => {
    const phrase = kind === 'restart' ? 'realtime restart launched' : 'realtime backend stopped';
    const entry = [...f.timers].find(([, timer]) => String(timer.callback).includes(phrase));
    if (!entry) throw new Error(`Missing ${kind} completion timer`);
    f.timers.delete(entry[0]);
    entry[1].callback();
  };
  return { ...f, backendRequests, fireStatusTimer };
}

function pageExitFixture() {
  const calls = [], listeners = new Map();
  const c = vm.createContext({
    window: { addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(callback);
    } },
    warning: false,
    recordingUnloadWarningActive: () => c.warning,
    beaconAllLogSnapshots: () => calls.push('beacons'),
    closeAllLogPopouts: () => calls.push('popouts closed'),
    stopVisionCamera: () => calls.push('browser camera stop'),
    stopEsp32Camera: () => calls.push('network camera stop'),
    idleArt: { disarm: () => calls.push('idle art disarm') },
  });
  for (const startText of ['    window.addEventListener("beforeunload", (event) => {',
    '    window.addEventListener("pagehide", () => {']) {
    const start = page.indexOf(startText), end = page.indexOf('\n    });', start);
    if (start < 0 || end < start) throw new Error(`Missing page exit callback: ${startText}`);
    vm.runInContext(page.slice(start, end + 8), c);
  }
  const idle = page.match(/window\.addEventListener\("pagehide", \(\) => idleArt\.disarm\(\)\);/);
  if (!idle) throw new Error('Missing pagehide idle-art cleanup');
  vm.runInContext(idle[0], c);
  return { c, calls, listeners };
}

module.exports = { exitFixture, pageExitFixture };

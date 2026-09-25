const assert = require('node:assert/strict');

async function checkHistoryOrder(page) {
  const result = await page.evaluate(async () => {
    const make = (name, date) => ({ filename: `sessions/${name}.txt`,
      content: `STS Session Note\nCreated: ${date}\n\n[12:00] Robot 790: UNIQUE_${name}_FIRST\n[12:01] You: UNIQUE_${name}_SECOND` });
    const latest = make('latest', '2026-09-23T21:24:55-04:00');
    const root = make('root', '2026-09-18T12:30:22-04:00');
    const middle = make('middle', '2026-09-23T12:52:58-04:00');
    loadedNoteContexts = [latest, middle, root];
    currentContinuitySessionFilename = latest.filename;
    firstContactModeEnabled = () => false;
    performanceModeEnabled = () => false;
    const before = JSON.stringify(loadedNoteContexts), measured = [], packets = [];
    const originalFetch = window.fetch;
    runtimeConfig.connection_context = { enabled: true };
    window.fetch = async (url, options) => {
      if (new URL(url).pathname !== '/api/context/measure') throw Error('Unexpected request in history-order fixture');
      measured.push(JSON.parse(options.body).instructions);
      return { ok: true, json: async () => ({ status: 'ok', model: 'fixture', context_window_tokens: 131072,
        policy: {}, prompt_tokens: 1000, startup_budget_tokens: 90000, growth_available_tokens: 30000, fits: true }) };
    };
    try {
      await prepareConnectionContext();
      const socket = { readyState: 1, send: data => packets.push(JSON.parse(data)) };
      realtimeConnection.adopt(socket);
      updateSessionTools({ quiet: true });
      const sent = packets.find(p => p.type === 'session.update').session.instructions;
      const order = text => ['root', 'middle', 'latest'].map(n => text.indexOf(`UNIQUE_${n}_FIRST`));
      return {
        measuredOrders: measured.map(order), sentOrder: order(sent), measuredEqualsSent: measured.every(s => s === sent),
        unchangedBodies: loadedNoteContexts.every((n, i) => n.content === JSON.parse(before)[i].content),
        inventory: loadedNoteContexts.map(n => n.filename),
        withinSessionOrder: ['root', 'middle', 'latest'].every(n => sent.indexOf(`UNIQUE_${n}_FIRST`) < sent.indexOf(`UNIQUE_${n}_SECOND`)),
      };
    } finally {
      window.fetch = originalFetch;
      realtimeConnection.requestStop();
      realtimeConnection.socket = null;
    }
  });
  assert.equal(result.measuredEqualsSent, true);
  assert.equal(result.unchangedBodies, true);
  assert.equal(result.withinSessionOrder, true);
  assert.deepEqual(result.inventory, ['sessions/latest.txt', 'sessions/middle.txt', 'sessions/root.txt']);
  for (const order of [...result.measuredOrders, result.sentOrder]) {
    assert(order[0] >= 0 && order[0] < order[1] && order[1] < order[2]);
  }
  return result;
}

module.exports = { checkHistoryOrder };

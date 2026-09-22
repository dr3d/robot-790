const { create } = require('../../web/sts/realtime-connection.js');

function installRealtimeConnection(context) {
  if (context.realtimeConnection) return context.realtimeConnection;
  const owner = context.realtimeConnection = create();
  // Legacy fixture names seed/assert the real owner, never a second state copy.
  for (const [legacy, field] of Object.entries({
    ws: 'socket', realtimeSessionGeneration: 'generation', realtimeStopRequested: 'stopped',
  })) {
    if (context[legacy] !== undefined) owner[field] = context[legacy];
    Object.defineProperty(context, legacy, { configurable: true,
      get: () => owner[field], set: value => { owner[field] = value; },
    });
  }
  return owner;
}

module.exports = { installRealtimeConnection };

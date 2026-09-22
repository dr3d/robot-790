const assert = require('node:assert/strict');
const vm = require('node:vm');
const { page } = require('./sts_tool_harness.cjs');

function installAudioPlayback(context) {
  require('./sts_connection_harness.cjs').installRealtimeConnection(context);
  context.Robot790AudioPlayback = require('../../web/sts/audio-playback.js');
  context.setTimeout ??= setTimeout;
  context.clearTimeout ??= clearTimeout;
  context.audioContext ??= null;
  const start = page.indexOf('    const audioPlayback = Robot790AudioPlayback.create({');
  const end = page.indexOf('\n    });', start);
  assert.ok(start >= 0 && end > start, 'production audio owner wiring');
  return vm.runInContext(`${page.slice(start, end + 8)}\naudioPlayback;`, context);
}

module.exports = { installAudioPlayback };

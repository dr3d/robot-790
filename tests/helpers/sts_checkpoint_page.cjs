const { execFileSync } = require('node:child_process');

// The completed September refactors had whole-page equivalence proofs. Keep
// those historical proofs reproducible at their accepted checkpoint, rather
// than treating every later feature as a violation of a closed refactor.
// Behavioral/owner tests continue to load today's page and shipped modules.
const acceptedCheckpoint = 'd2ee62f';
function acceptedCheckpointPage() {
  return execFileSync('git', ['show', `${acceptedCheckpoint}:web/sts/index.html`],
    { encoding: 'utf8', maxBuffer: 4e6 }).replace(/\r\n/g, '\n');
}

module.exports = { acceptedCheckpointPage };

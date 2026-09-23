const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { scenarios, fixture } = require('./helpers/sts_b2_request_harness.cjs');
const page = fs.readFileSync(path.join(__dirname, '../web/sts/index.html'), 'utf8').replace(/\r\n/g, '\n');
// Captured from unchanged requestBrain2Mull at 424b933 before extraction.
const baseline = require('./fixtures/sts-b2-request.json');

for (const name of scenarios) {
  test(`B2 request preserves complete payload, outcome and side-effect order: ${name}`, async () => {
    const result = await fixture(name, page).complete();
    assert.deepEqual(result, baseline[name]);
    const payload = JSON.parse(result.posts[0].body);
    assert.equal(payload.evidence.fingerprint, undefined);
    assert.equal(payload.evidence.user_key, undefined);
    if (result.result?.status === 'stale' || result.error) {
      assert.equal(result.lastEvidence, null);
      assert.equal(result.acceptedCapturedIdentity, false);
    } else assert.equal(result.acceptedCapturedIdentity, true);
  });
}

test('baseline records intentional diagnostic/error ordering and mode omissions', () => {
  assert.equal(baseline['stale-http-error'].result.status, 'stale');
  assert.equal(baseline['stale-network-error'].error, 'Network down');
  assert.equal(baseline.user.trace.filter(x => x.ledger).length, 1);
  assert.equal(baseline.socket.trace.filter(x => x.ledger).length, 0);
  assert.equal(baseline['invalid-json'].acceptedCapturedIdentity, true);
  assert.equal(baseline['stopped-only'].result.status, 'ok');
  const headline = JSON.parse(baseline.headlines.posts[0].body);
  assert.equal(headline.mode, 'headlines');
  assert.equal(headline.body, undefined);
  assert.equal(headline.idle_art, undefined);
  assert.equal(JSON.parse(baseline.manual.posts[0].body).mode, 'question');
  assert.equal(JSON.parse(baseline.normal.posts[0].body).mode, 'person');
});

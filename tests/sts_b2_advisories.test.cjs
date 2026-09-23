const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { characterize, fixture } = require('./helpers/sts_advisory_harness.cjs');
const { installBrain2Advisories } = require('./helpers/sts_advisory_owner.cjs');
const page = fs.readFileSync(`${__dirname}/../web/sts/index.html`, 'utf8').replace(/\r\n/g, '\n');
const baseline = require('./fixtures/sts-b2-advisories.json');

test('private advisory owner preserves complete baseline traces, snapshots and delivery packets', () => {
  assert.deepEqual(characterize(page, installBrain2Advisories), baseline.cases);
});

test('one owner holds private candidates and delivery identity, without page state mirrors', () => {
  assert.doesNotMatch(page, /\b(?:brain2NoteCandidates|brain2QuestionCandidates|brain2RevisionCandidates|lastBrain2AdvisorySocket|lastBrain2AdvisoryText)\b/);
  assert.match(page, /brain2Advisories\.accept\(result\)/);
  assert.match(page, /brain2Advisories\.clear\(\)/);
  assert.match(page, /brain2Advisories\.reset\(\)/);
});

test('reset retires delivery identity but clearing candidates alone preserves it', () => {
  const { c, trace, setTime } = fixture(page, installBrain2Advisories);
  function sameNote() { setTime(1000); c.accept({note_for_eric:'Same note', observed_evidence:{last_assistant_output_id:'b1'}}); }
  sameNote(); assert.equal(c.appendBrain2AdvisoryToConversation(), true);
  c.brain2Advisories.clear(); sameNote(); assert.equal(c.appendBrain2AdvisoryToConversation(), false);
  c.brain2Advisories.reset(); sameNote(); assert.equal(c.appendBrain2AdvisoryToConversation(), true);
  assert.equal(trace.filter(item => item[0] === 'send').length, 2);
});

test('instances do not share private notes or delivery identity', () => {
  const one = fixture(page, installBrain2Advisories), two = fixture(page, installBrain2Advisories);
  one.c.accept({note_for_eric:'Only one'});
  assert.equal(two.c.formatBrain2AdvisoryContent(), '');
  assert.equal(one.c.brain2Advisories.notes.length, 1);
});

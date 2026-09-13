const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync(path.join(__dirname, '../web/sts/session-map.html'), 'utf8').replace(/\r\n/g, '\n');

function formatter(timeZone) {
  const start = page.indexOf('    function formatSessionDate(');
  const end = page.indexOf('\n    }\n', start);
  assert.ok(start >= 0 && end > start);
  const context = vm.createContext({ Date, Intl: {
    DateTimeFormat: class {
      constructor(locale, options) {
        assert.equal(locale, undefined);
        assert.equal(options.timeZone, undefined); // Production follows the browser, not a fixed zone.
        return new Intl.DateTimeFormat('en-US', { ...options, timeZone });
      }
    }
  } });
  vm.runInContext(page.slice(start, end + 6), context);
  return context.formatSessionDate;
}

test('session display converts UTC and explicit offsets to local 12-hour time', () => {
  const format = formatter('America/New_York');
  const source = '2026-09-11T13:38:36-04:00';
  assert.equal(format(source), 'Sep 11, 2026, 1:38 PM');
  assert.equal(format('2026-09-11T17:38:36Z'), format(source));
  assert.equal(source, '2026-09-11T13:38:36-04:00');
  assert.equal(format('2026-01-11T18:38:36Z'), 'Jan 11, 2026, 1:38 PM');
});

test('session display follows browser zone and handles date rollover', () => {
  assert.equal(formatter('America/Los_Angeles')('2026-09-11T01:05:00Z'), 'Sep 10, 2026, 6:05 PM');
  assert.equal(formatter('Asia/Tokyo')('2026-09-11T01:05:00Z'), 'Sep 11, 2026, 10:05 AM');
});

test('missing and invalid dates have explicit fallbacks', () => {
  const format = formatter('America/New_York');
  for (const value of ['', null, undefined, 'not-a-date']) assert.equal(format(value), 'unknown');
  assert.equal(format('', 'undated'), 'undated');
});

test('all session map date labels share the formatter; original dates remain searchable', () => {
  assert.match(page, /formatSessionDate\(item.created, "undated"\)/);
  assert.match(page, /\["Created", formatSessionDate\(item.created\)\]/);
  assert.match(page, /formatSessionDate\(item.created, sessionPathDisplay\(item.filename\)\)/);
  assert.match(page, /item.created,\s*formatSessionDate\(item.created\)/);
  assert.doesNotMatch(page, /item\.created\s*=/);
});

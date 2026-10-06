const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync(`${__dirname}/../web/sts/session-map.html`, 'utf8').replace(/\r\n/g, '\n');

function source(name) {
  const start = page.search(new RegExp(`^    (?:async )?function ${name}\\(`, 'm'));
  assert.ok(start >= 0, name);
  return page.slice(start, page.indexOf('\n    }\n', start) + 6);
}
function load(names, globals) {
  const context = vm.createContext({ URL, AbortController, ...globals });
  vm.runInContext(names.map(source).join('\n'), context);
  return context;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('a deep newest-first lineage resolves ancestors once instead of revisiting every chain', () => {
  let parentReads = 0;
  const items = Array.from({ length: 5000 }, (_, index) => ({
    filename: `sessions/${index}.txt`,
    get parent_session_filename() { parentReads++; return index ? `sessions/${index - 1}.txt` : ''; },
  })).reverse();
  const c = load(['normalizeFilename', 'lineageKey', 'lineageHash', 'buildLineageTints'], {
    LINEAGE_HUES: [210, 335, 150, 30, 270, 185, 5, 60, 305, 120, 240, 90],
  });
  const tints = c.buildLineageTints(items);
  assert.equal(tints.size, items.length);
  assert.equal(tints.get('sessions/4999.txt').depth, 4999);
  assert.equal(tints.get('sessions/4999.txt').rootKey, 'sessions/0.txt');
  assert.ok(parentReads <= items.length * 2, `${parentReads} ancestor reads`);
});

test('cyclic lineage and its descendants keep deterministic colors and depth when reordered', () => {
  const c = load(['normalizeFilename', 'lineageKey', 'lineageHash', 'buildLineageTints'], {
    LINEAGE_HUES: [210, 335, 150],
  });
  const items = [
    { filename: 'leaf', parent_session_filename: 'b' },
    { filename: 'b', parent_session_filename: 'a' },
    { filename: 'a', parent_session_filename: 'b' },
  ];
  const first = c.buildLineageTints(items);
  const second = c.buildLineageTints(items.toReversed());
  for (const [key, value] of first) assert.deepEqual(second.get(key), value);
});

test('many session labels reuse one locale formatter without changing date handling', () => {
  let constructions = 0;
  const c = load(['formatSessionDate'], { Intl: {
    DateTimeFormat: class {
      constructor(locale, options) { constructions++; return new Intl.DateTimeFormat(locale, options); }
    },
  } });
  for (let index = 0; index < 3000; index++) c.formatSessionDate('2026-10-05T13:00:00Z');
  assert.equal(constructions, 1);
  assert.equal(c.formatSessionDate('bad date', 'undated'), 'undated');
});

function refreshFixture(apiJson) {
  const statuses = [], renders = [], previews = [];
  const c = load(['normalizeFilename', 'lineageKey', 'refreshSessions'], {
    location: { href: 'http://localhost:8790/session-map.html' },
    sessionsRequestController: null, sessionsFingerprint: '', sessions: [],
    selectedFilename: '', currentFilename: '', preparationPollTimer: null,
    resumeFormBySession: new Map(), lineageTints: new Map(),
    clearTimeout() {}, apiJson,
    applyLineageDefaults() {}, buildLineageTints: () => new Map(),
    render: () => renders.push(c.sessions.map(item => item.filename)),
    setStatus: value => statuses.push(value), schedulePreparationPoll() {},
    loadDetails: options => { previews.push(options); return new Promise(() => {}); },
  });
  return { c, statuses, renders, previews };
}

test('the map refresh finishes and reports its count while an expensive history preview is pending', { timeout: 1000 }, async () => {
  const { c, statuses, renders, previews } = refreshFixture(async () => ({
    sessions: [{ filename: 'sessions/one.txt' }], current_session_filename: 'sessions/one.txt',
  }));
  await c.refreshSessions();
  assert.equal(statuses.at(-1), '1 sessions');
  assert.equal(renders.length, 1);
  assert.equal(previews.length, 1);
  assert.equal(previews[0].force, true);
});

test('a late superseded list response cannot restore archived or older sessions', async () => {
  const requests = [];
  const { c } = refreshFixture((url, options) => {
    const request = deferred();
    requests.push({ ...request, signal: options.signal });
    return request.promise;
  });
  const oldRefresh = c.refreshSessions();
  const newRefresh = c.refreshSessions();
  assert.equal(requests[0].signal.aborted, true);
  requests[1].resolve({ sessions: [{ filename: 'sessions/new.txt' }] });
  await newRefresh;
  requests[0].resolve({ sessions: [{ filename: 'sessions/old.txt' }] });
  await oldRefresh;
  assert.equal(c.sessions[0].filename, 'sessions/new.txt');
  assert.equal(c.selectedFilename, 'sessions/new.txt');
});

class Element {
  constructor(tagName) { this.tagName = tagName; this.children = []; this.dataset = {}; this.textContent = ''; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = [...children]; }
  setAttribute() {}
  addEventListener() {}
  querySelectorAll() { return this.children.flatMap(child => [child, ...child.querySelectorAll()]).filter(child => child.dataset.archive); }
}
function previewFixture() {
  const requests = [];
  let selected = { filename: 'sessions/one.txt', title: 'One', preparation: { state: 'ready' } };
  const detailsEl = new Element('div');
  const c = load(['loadDetails', 'updateArchiveButtons'], {
    document: { createElement: name => new Element(name) }, detailsEl,
    location: { href: 'http://localhost:8790/session-map.html' },
    detailsRequestController: null, detailsRequestKey: '', archiveBusy: false,
    sessions: [selected, { filename: 'sessions/two.txt' }],
    selectedSession: () => selected,
    selectedResumeForm: () => 'auto',
    resumeFormRecord: (item, key) => ({ key, label: key, filename: item.filename, status: 'available' }),
    resumeFormLabel: record => record.label,
    sessionTitle: (filename, title) => title || filename,
    sessionPathDisplay: value => value, formatSessionDate: () => 'Oct 5',
    sessionContextAtSave: () => ({ detail: 'not recorded' }),
    apiJson: (url, options) => {
      const request = deferred();
      requests.push({ ...request, signal: options.signal });
      return request.promise;
    },
  });
  return { c, requests, detailsEl, select: value => { selected = value; } };
}
const history = content => ({ status: 'ok', resume_form_label: 'Auto history', history_notes: [{ filename: 'source', content }] });

test('selecting the same session does not refetch or rebuild an in-flight or completed history preview', async () => {
  const { c, requests, detailsEl } = previewFixture();
  const first = c.loadDetails();
  const preview = detailsEl.children.at(-1);
  await c.loadDetails();
  assert.equal(requests.length, 1);
  assert.equal(detailsEl.children.at(-1), preview);
  requests[0].resolve(history('Saved history'));
  await first;
  await c.loadDetails();
  assert.equal(requests.length, 1);
  assert.match(preview.textContent, /Saved history/);
});

test('switching sessions cancels the old preview; a late response cannot overwrite the current one', async () => {
  const { c, requests, detailsEl, select } = previewFixture();
  const first = c.loadDetails();
  const oldPreview = detailsEl.children.at(-1);
  select({ filename: 'sessions/two.txt', title: 'Two' });
  const second = c.loadDetails();
  assert.equal(requests[0].signal.aborted, true);
  requests[1].resolve(history('Second history'));
  await second;
  requests[0].resolve(history('First history'));
  await first;
  assert.match(detailsEl.children.at(-1).textContent, /Second history/);
  assert.equal(oldPreview.textContent, 'loading');
});

test('explicit refresh retries the same preview and archive busy-state changes do not fetch it', async () => {
  const { c, requests, detailsEl } = previewFixture();
  const first = c.loadDetails();
  const refreshed = c.loadDetails({ force: true });
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(requests.length, 2);
  c.archiveBusy = true;
  c.updateArchiveButtons();
  assert.ok(detailsEl.querySelectorAll().every(button => button.disabled));
  c.archiveBusy = false;
  c.updateArchiveButtons();
  assert.ok(detailsEl.querySelectorAll().every(button => !button.disabled));
  assert.equal(requests.length, 2);
  requests[0].resolve(history('Old'));
  requests[1].resolve(history('Refreshed'));
  await Promise.all([first, refreshed]);
  assert.match(detailsEl.children.at(-1).textContent, /Refreshed/);
});

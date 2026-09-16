const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const page = fs.readFileSync('web/sts/session-map.html', 'utf8').replace(/\r\n/g, '\n');

function expand(sessions, filename, collapsed, expanded = true) {
  const context = vm.createContext({ sessions, lineageKey: value => String(value || '').toLowerCase() });
  const start = page.indexOf('    function setLineageSubtreeExpanded(');
  const end = page.indexOf('\n    function renderNode(', start);
  vm.runInContext(page.slice(start, end), context);
  context.setLineageSubtreeExpanded(filename, collapsed, expanded);
}

test('fully expands descendants without touching siblings, ancestors or other roots', () => {
  const sessions = [
    { filename: 'root' },
    { filename: 'branch', parent_session_filename: 'root' },
    { filename: 'child', parent_session_filename: 'BRANCH' },
    { filename: 'grandchild', parent_session_filename: 'child' },
    { filename: 'sibling', parent_session_filename: 'root' },
    { filename: 'other' }
  ];
  const collapsed = new Set(sessions.map(item => item.filename));
  expand(sessions, 'BRANCH', collapsed);
  assert.deepEqual([...collapsed], ['root', 'sibling', 'other']);
});

test('expansion uses the supplied filter state and tolerates cyclic lineage', () => {
  const normal = new Set(['a', 'b']);
  const filtered = new Set(normal);
  expand([
    { filename: 'a', parent_session_filename: 'b' },
    { filename: 'b', parent_session_filename: 'a' }
  ], 'a', filtered);
  assert.equal(filtered.size, 0);
  assert.equal(normal.size, 2);
});

test('Alt applies the clicked action recursively; ordinary toggling remains', () => {
  assert.match(page, /event\.altKey\) setLineageSubtreeExpanded\(item\.filename, collapsed, !expanded\)/);
  assert.match(page, /else if \(collapsed\.has\(key\)\) collapsed\.delete\(key\);\s*else collapsed\.add\(key\)/);
});

test('recursive collapse resets deeper levels without changing other branches', () => {
  const sessions = [
    { filename: 'root' },
    { filename: 'child', parent_session_filename: 'root' },
    { filename: 'grandchild', parent_session_filename: 'child' },
    { filename: 'other' }
  ];
  const collapsed = new Set(['grandchild']);
  expand(sessions, 'root', collapsed, false);
  assert.deepEqual([...collapsed].sort(), ['child', 'grandchild', 'root']);
  collapsed.delete('root'); // A normal plus reopens only the first level.
  assert.ok(collapsed.has('child'));
  expand(sessions, 'root', collapsed);
  assert.equal(collapsed.size, 0);
});

test('recursive collapse keeps filter state separate and terminates on cycles', () => {
  const normal = new Set();
  const filtered = new Set();
  expand([
    { filename: 'a', parent_session_filename: 'b' },
    { filename: 'b', parent_session_filename: 'a' }
  ], 'a', filtered, false);
  assert.deepEqual([...filtered].sort(), ['a', 'b']);
  assert.equal(normal.size, 0);
});

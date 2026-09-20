const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../web/sts/index.html'), 'utf8');
const source = html.slice(html.indexOf('    function controlSidebarWidthBounds()'), html.indexOf('    function loadControlSidebarState()'));

function setup(saved, viewport = 1440) {
  const attributes = {}, styles = {};
  const context = {
    window: {innerWidth: viewport},
    document: {querySelector: () => ({style: {setProperty: (key, value) => { styles[key] = value; }}})},
    controlSidebarResize: {setAttribute: (key, value) => { attributes[key] = value; }},
    controlSidebarWidthStorageKey: 'sidebar',
    localStorage: {getItem: () => saved, setItem: (_, value) => { saved = value; }},
    scheduleLogPaneHeightUpdate() {}
  };
  vm.runInNewContext(source, context);
  context.loadControlSidebarWidth();
  return {context, attributes, styles, saved: () => saved};
}

test('sidebar minimum is 225px in both CSS layouts and restored geometry', () => {
  assert.equal(html.match(/minmax\(225px, var\(--control-sidebar-width\)\)/g).length, 2);
  for (const viewport of [390, 980, 1440]) {
    const ui = setup('180', viewport);
    assert.equal(ui.styles['--control-sidebar-width'], '225px');
    assert.equal(ui.attributes['aria-valuemin'], '225');
    assert.equal(ui.attributes['aria-valuenow'], '225');
  }
});

test('sidebar preserves wider saved sizes and clamps persisted resize requests', () => {
  assert.equal(setup(null).styles['--control-sidebar-width'], '360px');
  const ui = setup('450');
  assert.equal(ui.styles['--control-sidebar-width'], '450px');
  assert.equal(ui.context.setControlSidebarWidth(100, {persist: true}), 225);
  assert.equal(ui.saved(), '225');
  assert.equal(ui.context.setControlSidebarWidth(999), 691);
});

test('wide screens permit a 50 percent larger cap while narrower screens retain their proportional limit', () => {
  for (const [viewport, maximum] of [[390, 320], [980, 470], [1200, 576], [1440, 691], [1920, 922], [2560, 930]]) {
    const ui = setup('930', viewport);
    assert.equal(ui.context.setControlSidebarWidth(2000, {persist: true}), maximum);
    assert.equal(ui.attributes['aria-valuemax'], String(maximum));
    assert.equal(ui.saved(), String(maximum));
  }
  assert.equal(setup('850', 2560).styles['--control-sidebar-width'], '850px');
  assert.equal(setup(null, 2560).styles['--control-sidebar-width'], '360px');
});

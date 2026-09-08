const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const MarkdownIt = require('../docs/assets/vendor/markdown-it-15.0.1.min.js');

const root = path.resolve(__dirname, '..');
const reader = vm.createContext({
  markdownit: MarkdownIt,
  URL,
  location: { href: 'https://example.test/robot-790/index.html' },
});
vm.runInContext(fs.readFileSync(path.join(root, 'docs/assets/markdown.js'), 'utf8'), reader);

test('docs render links, tables, code fences and nested lists as Markdown', () => {
  const html = reader.renderMarkdown([
    '# Document title', '', '[Reference](https://example.org/paper)', '',
    '| Source | Role |', '| --- | --- |', '| Raw | Record |', '',
    '```text', 'parent -> child', '```', '', '1. First', '   - Nested', '',
  ].join('\n'));
  assert.doesNotMatch(html, /<h1>/);
  assert.match(html, /<a href="https:\/\/example.org\/paper">Reference<\/a>/);
  assert.match(html, /<table>/);
  assert.match(html, /<pre><code class="language-text">parent -&gt; child/);
  assert.match(html, /<ol>[\s\S]*<ul>/);
});

test('docs resolve article images and links relative to their source file', () => {
  const html = reader.renderMarkdown(
    '![Face](../assets/article-images/face.png)\n\n[Architecture](../context-engineering-architecture.md)',
    'articles/example.md',
  );
  assert.match(html, /src="https:\/\/example.test\/robot-790\/assets\/article-images\/face.png"/);
  assert.match(html, /href="https:\/\/github.com\/dr3d\/robot-790\/blob\/master\/docs\/context-engineering-architecture.md"/);
});

test('docs escape raw HTML and reject executable Markdown URLs', () => {
  const html = reader.renderMarkdown('<script>alert(1)</script>\n\n[bad](javascript:alert(1))');
  assert.doesNotMatch(html, /<script>|href="javascript:/);
  assert.match(html, /&lt;script&gt;/);
});

test('repository Markdown links and catalog sources point at existing files', () => {
  const filenames = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: root, encoding: 'utf8',
  }).split('\0').filter(name => name.endsWith('.md') && fs.existsSync(path.join(root, name)));
  const parser = new MarkdownIt();
  const missing = new Set();
  const check = (source, value) => {
    if (!value || /^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('/') || value.startsWith('#')) return;
    const destination = decodeURIComponent(value.split(/[?#]/)[0]);
    if (!fs.existsSync(path.resolve(root, path.dirname(source), destination))) missing.add(`${source} -> ${value}`);
  };
  const visit = (tokens, source) => {
    for (const token of tokens) {
      for (const attribute of ['href', 'src']) check(source, token.attrGet(attribute));
      if (token.children) visit(token.children, source);
    }
  };
  for (const source of filenames) visit(parser.parse(fs.readFileSync(path.join(root, source), 'utf8'), {}), source);
  const visitCatalog = value => {
    if (Array.isArray(value)) value.forEach(visitCatalog);
    else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (['source', 'preview', 'poster'].includes(key) && typeof item === 'string') check('docs/catalog.json', item);
        else visitCatalog(item);
      }
    }
  };
  visitCatalog(JSON.parse(fs.readFileSync(path.join(root, 'docs/catalog.json'), 'utf8').replace(/^\uFEFF/, '')));
  assert.deepEqual([...missing].sort(), []);
});

test('Mouth Lab article is catalogued and remains explicit about its experimental boundary', () => {
  const source = 'docs/articles/teaching-erics-mouth-to-speak.md';
  const article = fs.readFileSync(path.join(root, source), 'utf8');
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'docs/catalog.json'), 'utf8').replace(/^\uFEFF/, ''));
  assert.match(article, /^# Teaching Eric's Mouth To Speak/m);
  assert.match(article, /does \*\*not\*\* currently:/);
  assert.match(article, /the lab is a renderer-and-timing bench/);
  assert.match(article, /mouth-lab-first-pass-pose-study\.png/);
  assert.ok(fs.existsSync(path.join(root, 'docs/assets/article-images/mouth-lab-first-pass-pose-study.png')));
  assert.ok(catalog.articles.some(item => item.source === 'articles/teaching-erics-mouth-to-speak.md'));
});

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

test('public catalog shelves carry canonical publication times and sort newest first', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'docs/catalog.json'), 'utf8').replace(/^\uFEFF/, ''));
  for (const shelf of ['articles', 'logs', 'media']) {
    const items = catalog[shelf] || [];
    for (const item of items) {
      assert.match(item.published || '', /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
      assert.match(item.published_sort || '', /^\d{14}$/);
      assert.match(item.published_source || '', /^(filename|git-added|metadata|filesystem)$/);
    }
    const sortKeys = items.map(item => item.published_sort);
    assert.deepEqual(sortKeys, [...sortKeys].sort().reverse(), `${shelf} is newest first`);
  }
});

test('media metadata preserves the current recording time when a filename is reused', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'docs/catalog.json'), 'utf8').replace(/^\uFEFF/, ''));
  const dailyDriver = catalog.media.find(item => item.source === 'media/videos/Daily-Driver.mp4');
  const listeningCompanion = catalog.media.find(
    item => item.source === 'media/videos/Time-And-Space-Both-Live-Listening-Companion.mp4',
  );
  assert.equal(dailyDriver.published, '2026-09-07 19:02');
  assert.equal(dailyDriver.published_source, 'metadata');
  assert.equal(listeningCompanion.title, 'Time And Space, Both Live: A Listening Companion');
});

test('public page sorts every shelf using canonical publication time', () => {
  const page = fs.readFileSync(path.join(root, 'docs/assets/site.js'), 'utf8');
  assert.match(page, /function newestFirst\(items\)/);
  assert.match(page, /const orderedArticles = newestFirst\(articles\)/);
  assert.match(page, /const orderedMediaItems = newestFirst\(mediaItems\)/);
  assert.match(page, /const orderedLogs = newestFirst\(logs\)/);
  assert.match(page, /function publicationLabel\(item\)/);
});

test('project overview and listening companion cross-link without publishing the raw audio', () => {
  const source = 'articles/2026-09-10-022329-robot-790-project-overview.md';
  const video = 'media/videos/Robot-790-Conversation-And-Continuity-Listening-Companion-2026-09-10.mp4';
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'docs/catalog.json'), 'utf8'));
  const companion = catalog.media.find(item => item.source === video);
  assert.ok(catalog.articles.some(article => article.source === source));
  assert.equal(companion.article, source);
  assert.ok(companion.bytes < 25 * 1024 * 1024);
  assert.match(companion.description, /AI-generated interpretation/);
  assert.match(companion.description, /not a live Eric session/);
  assert.ok(fs.existsSync(path.join(root, 'docs', companion.preview)));
  assert.ok(!catalog.media.some(item => item.source.startsWith('media/raw-video/')));
  for (const item of catalog.media.filter(item => item.article)) {
    assert.ok(catalog.articles.some(article => article.source === item.article));
  }
  const article = fs.readFileSync(path.join(root, 'docs', source), 'utf8');
  assert.ok(article.includes(`?media=${video}#media`));
  assert.match(article, /dream-time scheduler and automatic continuity\s+consolidation are design work/);
  assert.doesNotMatch(article, /\]\([^)]*(?:sts-ui-guide\.md|firmware\/README\.md)\)/);
});

test('media caption links to its article and omits the link for ordinary media', () => {
  const elements = new Map();
  const document = { querySelector(selector) {
    if (!elements.has(selector)) elements.set(selector, {
      innerHTML: '', addEventListener() {}, querySelectorAll: () => [], querySelector: () => null,
    });
    return elements.get(selector);
  } };
  const context = vm.createContext({ document, URL, location: {
    href: 'https://example.test/robot-790/?media=old.mp4&autoplay=1#media',
  }, window: { addEventListener() {} }, fetch: () => new Promise(() => {}) });
  vm.runInContext(fs.readFileSync(path.join(root, 'docs/assets/site.js'), 'utf8'), context);
  const media = { title: 'Test', kind: 'video', source: 'media/videos/test.mp4',
    article: 'articles/overview.md', description: '<unsafe>' };
  context.selectMedia(media, null, { replaceUrl: false });
  const caption = elements.get('#media-caption').innerHTML;
  assert.match(caption, /Read the article/);
  const target = new URL(caption.match(/<a href="([^"]+)"/)[1].replace(/&amp;/g, '&'));
  assert.equal(target.origin, 'https://example.test');
  assert.equal(target.searchParams.get('article'), media.article);
  assert.equal(target.searchParams.has('media'), false);
  assert.equal(target.searchParams.has('autoplay'), false);
  assert.equal(target.hash, '#article-reader');
  assert.match(caption, /&lt;unsafe&gt;/);
  context.selectMedia({ ...media, article: undefined }, null, { replaceUrl: false });
  assert.doesNotMatch(elements.get('#media-caption').innerHTML, /Read the article/);
});

test('public article reader can shrink and wrap its controls on a phone', () => {
  const css = fs.readFileSync(path.join(root, 'docs/assets/site.css'), 'utf8');
  assert.match(css, /\.reader-section\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /\.reader-actions\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(css, /\.article-body\s*\{[^}]*min-width:\s*0/);
});

test('repository Markdown article list is generated from the same newest-first catalog', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'docs/catalog.json'), 'utf8').replace(/^\uFEFF/, ''));
  const index = fs.readFileSync(path.join(root, 'docs/index.md'), 'utf8');
  assert.doesNotMatch(index, /System\.Object\[\]/);
  const sources = [...index.matchAll(/]\((articles\/[^)]+)\)/g)].map(match => match[1]);
  assert.deepEqual(sources, catalog.articles.map(item => item.source));
});

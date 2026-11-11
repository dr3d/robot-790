// Build a shareable static reading page from a dated public Markdown article.
const fs = require('node:fs');
const path = require('node:path');
const MarkdownIt = require('../docs/assets/vendor/markdown-it-15.0.1.min.js');
const root = path.resolve(__dirname, '..');
const articles = path.join(root, 'docs/articles');
const source = path.resolve(root, process.argv[2] || '');
if (path.dirname(source) !== articles || !source.endsWith('.md')) {
  throw new Error('Pass a Markdown file directly inside docs/articles/.');
}
const markdown = fs.readFileSync(source, 'utf8');
const title = markdown.match(/^# (.+)$/m)?.[1];
const date = path.basename(source).match(/^(\d{4}-\d{2}-\d{2})-/)?.[1];
if (!title || !date) throw new Error('Expected a title and dated article filename.');
const escape = value => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const description = markdown.split(/\r?\n/).find(line => line.startsWith('*') && line.endsWith('*'))?.replace(/^\*|\*$/g, '') || title;
const md = new MarkdownIt({ html: false, typographer: false });
const firstImage = md.parse(markdown, {}).flatMap(token => token.children || []).find(token => token.type === 'image');
const target = source.replace(/\.md$/, '.reading.html');
const canonical = `https://dr3d.github.io/robot-790/articles/${path.basename(target)}`;
const cover = firstImage ? new URL(firstImage.attrGet('src'), canonical).href : null;
const words = markdown.split(/\s+/).length;
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} | Eric Robot 790</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${canonical}">
<meta property="article:published_time" content="${date}">
${cover ? `<meta property="og:image" content="${escape(cover)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="../assets/field-report.css?v=2026-11-11">
</head>
<body>
<nav class="masthead" aria-label="Site navigation"><a href="../index.html#updates">Robot 790 / Field notes</a><span>${Math.ceil(words / 220)} minute read</span></nav>
<article>${md.render(markdown)}</article>
</body>
</html>
`;
fs.writeFileSync(target, html, 'utf8');
console.log(JSON.stringify({ target: path.relative(root, target), words, bytes: Buffer.byteLength(html) }));

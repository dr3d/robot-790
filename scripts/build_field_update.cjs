const fs = require('node:fs');
const path = require('node:path');
const MarkdownIt = require('../docs/assets/vendor/markdown-it-15.0.1.min.js');
const source = path.resolve(__dirname, '../docs/articles/2026-10-01-robot-790-field-update.md');
const markdown = fs.readFileSync(source, 'utf8');
const md = new MarkdownIt({ html: false, typographer: false });
let body = md.render(markdown);
body = body.replace(/src="(\.\.\/media\/[^\"]+)"/g, (_, relative) => {
  const image = fs.readFileSync(path.resolve(path.dirname(source), relative));
  return `src="data:image/jpeg;base64,${image.toString('base64')}"`;
});
body = body.replace(/href="\.\.\/([^\"]+)"/g, 'href="https://github.com/dr3d/robot-790/blob/master/docs/$1"');
const words = markdown.split(/\s+/).length;
const title = markdown.match(/^# (.+)$/m)[1];
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="Stories, drawings, music and corrections from life with Eric, the Robot 790 AI companion.">
<link rel="canonical" href="https://dr3d.github.io/robot-790/articles/2026-10-01-robot-790-field-update.reading.html">
<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="A future museum, an alien signal, a small piano, and the drawings that appear when I stop asking for things.">
<meta property="og:image" content="https://dr3d.github.io/robot-790/media/field-update-20261001/museum-v4.jpg">
<meta property="og:url" content="https://dr3d.github.io/robot-790/articles/2026-10-01-robot-790-field-update.reading.html">
<meta name="twitter:card" content="summary_large_image">
<style>
:root{color-scheme:light;--ink:#252925;--muted:#656960;--paper:#faf8f2;--accent:#9b482c}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Georgia,'Times New Roman',serif}
.masthead{max-width:1040px;margin:auto;padding:38px 36px 22px;border-bottom:1px solid #d9d7cd;display:flex;justify-content:space-between;gap:20px;font:12px/1.5 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
.masthead a{color:inherit;text-decoration:none}
article{max-width:800px;margin:auto;padding:44px 36px 72px;font-size:20px;line-height:1.7}
h1{font-size:clamp(38px,5vw,59px);line-height:1.08;letter-spacing:-.035em;margin:0 0 22px;font-weight:normal}
h1+p{font-size:23px;line-height:1.45;color:#535b50;margin-bottom:24px}
h1+p+p{font:14px/1.6 system-ui,sans-serif;color:var(--muted);margin-bottom:42px}
h2{font:600 27px/1.25 system-ui,sans-serif;letter-spacing:-.025em;margin:55px 0 21px;scroll-margin-top:24px}
p{margin:0 0 24px}a{color:var(--accent);text-underline-offset:4px}a:focus-visible{outline:2px solid var(--accent);outline-offset:5px}
img{display:block;width:100%;max-width:620px;height:auto;margin:36px auto 0;border-radius:3px}
p:has(img)+p{max-width:620px;margin:12px auto 34px;font:14px/1.6 system-ui,sans-serif;color:var(--muted)}
blockquote{margin:32px 0;padding:4px 0 4px 25px;border-left:3px solid #b46743;font-size:24px;line-height:1.5;color:#5b493c}blockquote p{margin:0}
article>p:nth-last-child(2){border-top:1px solid #d9d7cd;padding-top:28px;margin-top:40px;font:14px/1.65 system-ui,sans-serif;color:var(--muted)}
article>p:last-child{font:14px/1.65 system-ui,sans-serif}
@media(max-width:600px){.masthead{padding:24px 22px 18px;font-size:10px;letter-spacing:.1em}article{padding:30px 22px 48px;font-size:18px;line-height:1.65}h1+p{font-size:20px}h1+p+p{margin-bottom:32px}h2{font-size:24px;margin-top:42px}blockquote{font-size:21px;padding-left:18px}img{margin-top:27px}}
@media print{body{background:white}article{max-width:none;font-size:11pt;padding:24px 0}.masthead{padding:0 0 12px}h1{font-size:32pt}h2{font-size:17pt;break-after:avoid}img{max-width:100mm;max-height:110mm;object-fit:contain}blockquote,img{break-inside:avoid}a{color:inherit}}
</style></head><body><nav class="masthead" aria-label="Site navigation"><a href="../index.html#articles">Robot 790 / Field notes</a><span>${Math.ceil(words / 220)} minute read</span></nav><article>${body}</article></body></html>`;
const target = source.replace(/\.md$/, '.reading.html');
fs.writeFileSync(target, html, 'utf8');
console.log(JSON.stringify({target, words, bytes: Buffer.byteLength(html), embeddedImages:(html.match(/src="data:image/g)||[]).length}));

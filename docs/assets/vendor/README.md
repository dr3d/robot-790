# Vendored Markdown Parser

`markdown-it-15.0.1.min.js` is the unmodified UMD browser bundle from
[`markdown-it` 15.0.1](https://www.npmjs.com/package/markdown-it/v/15.0.1),
MIT licensed. Its license is in `markdown-it-LICENSE.txt`.

Package: `https://registry.npmjs.org/markdown-it/-/markdown-it-15.0.1.tgz`

Package integrity (SHA-512, base64):

```text
9/7gE95FNPkfUWrjJIoHZza2iLmuJlPD0UNMxPi7bxUrbCR525YZY0r+zyfes0dZI5ZZ/uNIXUJca0pJvtw41g==
```

Bundle SHA-256:

```text
f9f377ca892291fbe32904e77a00c6e27e8f95c14f435a54c8cb6859b3d97692
```

Fetched with `npm pack --ignore-scripts`; copied from
`package/dist/browser/markdown-it.umd.min.js`. The upstream source-map reference
remains in the bundle, but the map is not needed to serve the site.

The reader disables raw HTML, uses the parser's default URL validation, and
resolves relative links against the source document. No CDN request or npm
install is needed to view the published site.

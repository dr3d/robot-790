const docsMarkdownParser = new markdownit({ html: false, linkify: false });

function renderMarkdown(markdown, source = "index.md") {
  const base = new URL(source, location.href);
  const site = new URL(".", location.href);
  const tokens = docsMarkdownParser.parse(markdown, {});
  // The reader already displays the document title above the article body.
  if (tokens[0]?.type === "heading_open" && tokens[0].tag === "h1") tokens.splice(0, 3);
  const resolveLinks = (items) => {
    for (const token of items) {
      for (const attribute of ["href", "src"]) {
        const value = token.attrGet(attribute);
        if (!value) continue;
        const target = new URL(value, base);
        const localMarkdown = attribute === "href" && target.origin === site.origin
          && target.pathname.startsWith(site.pathname) && /\.md$/i.test(target.pathname);
        token.attrSet(attribute, localMarkdown
          ? `https://github.com/dr3d/robot-790/blob/master/docs/${target.pathname.slice(site.pathname.length)}${target.search}${target.hash}`
          : target.href);
      }
      if (token.children) resolveLinks(token.children);
    }
  };
  resolveLinks(tokens);
  return docsMarkdownParser.renderer.render(tokens, docsMarkdownParser.options, {});
}

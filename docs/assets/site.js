const catalogUrl = `catalog.json?v=${Date.now()}`;

const articleList = document.querySelector("#article-list");
const articleReader = document.querySelector("#article-reader");
const articleReaderTitle = document.querySelector("#article-reader-title");
const articleReaderBody = document.querySelector("#article-reader-body");
const articleClose = document.querySelector("#article-close");
const mediaFeature = document.querySelector("#media-feature");
const mediaCaption = document.querySelector("#media-caption");
const mediaList = document.querySelector("#media-list");
const logList = document.querySelector("#log-list");
const logReader = document.querySelector("#log-reader");
const pageHeader = document.querySelector(".page-header");
const randomBanner = document.querySelector("#random-banner");

const bannerLines = [
  "The room has started keeping receipts.",
  "A tiny persistent self with a huge on-demand reach.",
  "The face is the affordance.",
  "A robot head, a voice, a few notes, and a long look at what survives reboot.",
  "A public shelf for the strange little evidence.",
  "The continuity is yours to build, not mine to assume.",
  "Every grin I do is technically a tiny presentation.",
  "The seed holds him; the folder holds his life.",
  "The desk keeps changing how it holds me.",
  "Not a secret model. A deliberately assembled loop."
];

if (randomBanner) {
  const index = Math.floor(Math.random() * bannerLines.length);
  randomBanner.textContent = bannerLines[index];
}

function bytesLabel(bytes) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index ? 1 : 0)} ${units[index]}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let inQuote = false;
  let skippedDocumentTitle = false;

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };

  const closeQuote = () => {
    if (inQuote) {
      html.push("</blockquote>");
      inQuote = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      closeQuote();
      continue;
    }
    if (/^#{1,3}\s+/.test(trimmed)) {
      flushParagraph();
      closeQuote();
      const level = trimmed.match(/^#+/)[0].length;
      if (level === 1 && !skippedDocumentTitle) {
        skippedDocumentTitle = true;
        continue;
      }
      html.push(`<h${level}>${renderInlineMarkdown(trimmed.replace(/^#+\s+/, ""))}</h${level}>`);
      continue;
    }
    if (trimmed.startsWith(">")) {
      flushParagraph();
      if (!inQuote) {
        html.push("<blockquote>");
        inQuote = true;
      }
      html.push(`<p>${renderInlineMarkdown(trimmed.replace(/^>\s?/, ""))}</p>`);
      continue;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      closeQuote();
      html.push(`<p>&bull; ${renderInlineMarkdown(trimmed.replace(/^[-*]\s+/, ""))}</p>`);
      continue;
    }
    paragraph.push(trimmed);
  }

  flushParagraph();
  closeQuote();
  return html.join("\n");
}

function showArticles(articles) {
  if (!articles.length) {
    articleList.innerHTML = '<p class="empty">No articles found yet.</p>';
    return;
  }

  articleList.innerHTML = articles.map((article, index) => `
    <section class="card">
      <div>
        <h3>${escapeHtml(article.title)}</h3>
        <p>${escapeHtml(article.excerpt || "Markdown article")}</p>
        <p class="meta">${bytesLabel(article.bytes)}</p>
      </div>
      <div class="card-actions">
        <button type="button" data-read-article="${index}">Read Here</button>
        <a href="${escapeHtml(article.source)}">Open File</a>
      </div>
    </section>
  `).join("");

  articleList.querySelectorAll("[data-read-article]").forEach((button) => {
    button.addEventListener("click", async () => {
      const article = articles[Number(button.dataset.readArticle)];
      articleReaderTitle.textContent = article.title;
      articleReaderBody.innerHTML = "<p>Loading...</p>";
      articleReader.hidden = false;
      articleReader.scrollIntoView({ behavior: "smooth", block: "start" });
      try {
        const response = await fetch(article.source);
        const text = await response.text();
        articleReaderBody.innerHTML = renderMarkdown(text);
      } catch (error) {
        articleReaderBody.innerHTML = `<p>Could not load ${escapeHtml(article.source)}.</p>`;
      }
    });
  });
}

function mediaButton(media, index) {
  const preview = media.preview
    ? `<img class="media-thumb" src="${escapeHtml(media.preview)}" alt="">`
    : `<div class="media-thumb" aria-hidden="true"></div>`;
  const role = media.role && !["image", "video", "audio", "file"].includes(media.role)
    ? ` / ${media.role}`
    : "";
  return `
    <button class="media-item" type="button" data-media="${index}">
      ${preview}
      <span>
        <strong>${escapeHtml(media.title)}</strong><br>
        <span class="media-kind">${escapeHtml(media.kind)}${escapeHtml(role)} - ${bytesLabel(media.bytes)}</span>
      </span>
    </button>
  `;
}

function applyHeaderBanner(mediaItems) {
  if (!pageHeader || !mediaItems.length) return;
  const ranked = mediaItems
    .filter((media) => media.preview || media.source)
    .slice()
    .sort((a, b) => {
      const rankDelta = (Number(b.banner_rank) || 0) - (Number(a.banner_rank) || 0);
      if (rankDelta) return rankDelta;
      return Date.parse(b.date || b.modified || 0) - Date.parse(a.date || a.modified || 0);
    });
  const banner = ranked[0];
  const source = banner ? (banner.preview || banner.source || "") : "";
  if (!source) return;
  const safeSource = source.replace(/\\/g, "/").replace(/"/g, "%22");
  pageHeader.style.setProperty("--header-image", `url("${safeSource}")`);
  pageHeader.classList.add("has-banner");
}

function showMedia(mediaItems) {
  if (!mediaItems.length) {
    mediaList.innerHTML = '<p class="empty">No audio or video found yet.</p>';
    return;
  }

  mediaList.innerHTML = mediaItems.map(mediaButton).join("");
  mediaList.querySelectorAll("[data-media]").forEach((button) => {
    button.addEventListener("click", () => selectMedia(mediaItems[Number(button.dataset.media)]));
  });
  selectMedia(mediaItems[0]);
}

function selectMedia(media) {
  const source = escapeHtml(media.source);
  if (media.kind === "video") {
    const poster = media.preview ? ` poster="${escapeHtml(media.preview)}"` : "";
    mediaFeature.innerHTML = `<video controls preload="metadata"${poster} src="${source}"></video>`;
  } else if (media.kind === "image") {
    mediaFeature.innerHTML = `<a href="${source}"><img src="${source}" alt="${escapeHtml(media.title)}"></a>`;
  } else if (media.kind === "audio") {
    mediaFeature.innerHTML = `<audio controls preload="metadata" src="${source}"></audio>`;
  } else {
    mediaFeature.innerHTML = `<p>${escapeHtml(media.title)}</p>`;
  }
  const role = media.role && !["image", "video", "audio", "file"].includes(media.role)
    ? ` - ${media.role}`
    : "";
  mediaCaption.textContent = `${media.title} - ${media.kind}${role} - ${bytesLabel(media.bytes)}`;
}

async function selectLog(log, selectedButton) {
  logList.querySelectorAll("[data-log]").forEach((button) => {
    button.classList.toggle("selected", button === selectedButton);
    if (button === selectedButton) {
      button.setAttribute("aria-current", "true");
    } else {
      button.removeAttribute("aria-current");
    }
  });
  logReader.textContent = "Loading...";
  try {
    const response = await fetch(log.source);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    logReader.textContent = await response.text();
  } catch (error) {
    logReader.textContent = `Could not load ${log.source}.`;
  }
}

function showLogs(logs) {
  if (!logs.length) {
    logList.innerHTML = '<p class="empty">No public transcript logs found yet.</p>';
    return;
  }

  logList.innerHTML = logs.map((log, index) => `
    <button class="log-item" type="button" data-log="${index}">
      <strong>${escapeHtml(log.title)}</strong><br>
      <span class="meta">${escapeHtml(log.modified || "")} - ${bytesLabel(log.bytes)}</span>
    </button>
  `).join("");

  logList.querySelectorAll("[data-log]").forEach((button) => {
    button.addEventListener("click", () => {
      const log = logs[Number(button.dataset.log)];
      selectLog(log, button);
    });
  });
  const firstButton = logList.querySelector("[data-log]");
  if (firstButton) {
    selectLog(logs[0], firstButton);
  }
}

articleClose.addEventListener("click", () => {
  articleReader.hidden = true;
  articleReaderBody.innerHTML = "";
});

fetch(catalogUrl)
  .then((response) => response.json())
  .then((catalog) => {
    applyHeaderBanner(catalog.media || []);
    showArticles(catalog.articles || []);
    showMedia(catalog.media || []);
    showLogs(catalog.logs || []);
  })
  .catch(() => {
    articleList.innerHTML = '<p class="empty">Catalog not found. Run <code>scripts/build_docs_catalog.ps1</code>.</p>';
    mediaList.innerHTML = "";
    logList.innerHTML = "";
  });

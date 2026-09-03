const catalogUrl = `catalog.json?v=${Date.now()}`;
const preferredDefaultMediaSource = "media/videos/VID20260824135110.mp4";

const articleList = document.querySelector("#article-list");
const articleReader = document.querySelector("#article-reader");
const articleReaderTitle = document.querySelector("#article-reader-title");
const articleReaderBody = document.querySelector("#article-reader-body");
const articleRead = document.querySelector("#article-read");
const articlePause = document.querySelector("#article-pause");
const articleStop = document.querySelector("#article-stop");
const articleShare = document.querySelector("#article-share");
const articleClose = document.querySelector("#article-close");
const featuredArticleLink = document.querySelector("#featured-article-link");
const mediaFeature = document.querySelector("#media-feature");
const mediaCaption = document.querySelector("#media-caption");
const mediaList = document.querySelector("#media-list");
const logList = document.querySelector("#log-list");
const logReader = document.querySelector("#log-reader");
const pageHeader = document.querySelector(".page-header");
const headerBannerImage = document.querySelector("#header-banner-image");
const randomBanner = document.querySelector("#random-banner");
const githubDocsBase = "https://github.com/dr3d/robot-790/blob/master/docs/";
const firstVisitStorageKey = "robot790.docs.firstMediaLanding.v1";
let currentArticle = null;
let currentMedia = null;
let articleSpeechState = "idle";

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
    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      flushParagraph();
      closeQuote();
      const alt = imageMatch[1];
      const source = imageMatch[2];
      html.push(`<figure class="article-image"><img src="${escapeHtml(source)}" alt="${escapeHtml(alt)}">${alt ? `<figcaption>${renderInlineMarkdown(alt)}</figcaption>` : ""}</figure>`);
      continue;
    }
    paragraph.push(trimmed);
  }

  flushParagraph();
  closeQuote();
  return html.join("\n");
}

function renderedMarkdownUrl(source) {
  const value = String(source || "");
  if (!/\.md$/i.test(value) || /^[a-z]+:/i.test(value) || value.startsWith("//")) return value;
  return `${githubDocsBase}${value.replace(/^\/+/, "")}`;
}

function requestedArticleSource() {
  try {
    return new URL(location.href).searchParams.get("article") || "";
  } catch (_error) {
    return "";
  }
}

function articleSpeechAvailable() {
  return Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
}

function articleSpeechVoice() {
  if (!articleSpeechAvailable()) return null;
  const voices = window.speechSynthesis.getVoices?.() || [];
  const englishVoices = voices.filter((voice) => /^en\b/i.test(voice.lang || ""));
  const preferred = [
    /natural/i,
    /jenny/i,
    /aria/i,
    /guy/i,
    /sonia/i,
    /google.*english/i,
    /microsoft.*english/i
  ];
  for (const pattern of preferred) {
    const voice = englishVoices.find((candidate) => pattern.test(candidate.name || ""));
    if (voice) return voice;
  }
  return englishVoices[0] || voices[0] || null;
}

function articleSpeechText() {
  const title = articleReaderTitle?.textContent?.trim() || "";
  const body = articleReaderBody?.innerText?.trim() || "";
  return [title, body]
    .filter(Boolean)
    .join(".\n\n")
    .replace(/\s+/g, " ")
    .trim();
}

function updateArticleSpeechButtons() {
  const available = articleSpeechAvailable();
  const hasArticle = Boolean(currentArticle && articleSpeechText());
  if (articleRead) {
    articleRead.disabled = !available || !hasArticle;
    articleRead.textContent = articleSpeechState === "paused" ? "Resume" : "Read";
    articleRead.title = available
      ? "Read the current article aloud with the browser's speech voice."
      : "This browser does not expose speech synthesis.";
  }
  if (articlePause) {
    articlePause.disabled = !available || articleSpeechState !== "speaking";
  }
  if (articleStop) {
    articleStop.disabled = !available || articleSpeechState === "idle";
  }
}

function stopArticleSpeech() {
  if (articleSpeechAvailable()) {
    window.speechSynthesis.cancel();
  }
  articleSpeechState = "idle";
  updateArticleSpeechButtons();
}

function pauseArticleSpeech() {
  if (!articleSpeechAvailable()) return;
  window.speechSynthesis.pause();
  articleSpeechState = "paused";
  updateArticleSpeechButtons();
}

function readArticleAloud() {
  if (!articleSpeechAvailable()) return;
  if (articleSpeechState === "paused") {
    window.speechSynthesis.resume();
    articleSpeechState = "speaking";
    updateArticleSpeechButtons();
    return;
  }
  const text = articleSpeechText();
  if (!text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = articleSpeechVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = 0.96;
  utterance.pitch = 0.92;
  utterance.volume = 1;
  utterance.onend = () => {
    articleSpeechState = "idle";
    updateArticleSpeechButtons();
  };
  utterance.onerror = () => {
    articleSpeechState = "idle";
    updateArticleSpeechButtons();
  };
  articleSpeechState = "speaking";
  updateArticleSpeechButtons();
  window.speechSynthesis.speak(utterance);
}

function articleShareUrl(article) {
  const url = new URL(location.href);
  url.searchParams.delete("media");
  url.searchParams.set("article", article.source);
  url.hash = "article-reader";
  return url.toString();
}

async function copyArticleShareUrl(article, button) {
  if (!article) return;
  const shareUrl = articleShareUrl(article);
  try {
    if (navigator.share) {
      await navigator.share({ title: article.title, url: shareUrl });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareUrl);
    } else {
      window.prompt("Copy article link", shareUrl);
    }
    if (button) {
      const previous = button.textContent;
      button.textContent = "Copied";
      window.setTimeout(() => {
        button.textContent = previous;
      }, 1400);
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      window.prompt("Copy article link", shareUrl);
    }
  }
}

async function openArticle(article, { replaceUrl = false } = {}) {
  stopArticleSpeech();
  currentArticle = article;
  articleReaderTitle.textContent = article.title;
  articleReaderBody.innerHTML = "<p>Loading...</p>";
  updateArticleSpeechButtons();
  articleReader.hidden = false;
  articleReader.scrollIntoView({ behavior: "smooth", block: "start" });
  if (replaceUrl) {
    const url = new URL(location.href);
    if (url.searchParams.has("article")) {
      url.searchParams.delete("media");
      url.searchParams.set("article", article.source);
      url.hash = "article-reader";
      history.replaceState(null, "", url);
    }
  }
  try {
    const response = await fetch(article.source);
    const text = await response.text();
    articleReaderBody.innerHTML = renderMarkdown(text);
    updateArticleSpeechButtons();
  } catch (error) {
    articleReaderBody.innerHTML = `<p>Could not load ${escapeHtml(article.source)}.</p>`;
    updateArticleSpeechButtons();
  }
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
        <a href="${escapeHtml(renderedMarkdownUrl(article.source))}">Open File</a>
      </div>
    </section>
  `).join("");

  articleList.querySelectorAll("[data-read-article]").forEach((button) => {
    button.addEventListener("click", () => {
      const article = articles[Number(button.dataset.readArticle)];
      openArticle(article, { replaceUrl: true });
    });
  });

  const requested = requestedArticleSource();
  if (requested) {
    const selectedIndex = articles.findIndex((article) => article.source === requested);
    if (selectedIndex >= 0) {
      openArticle(articles[selectedIndex], { replaceUrl: false });
    }
  }

  if (featuredArticleLink) {
    featuredArticleLink.addEventListener("click", (event) => {
      const featureSource = featuredArticleLink.dataset.featureSource;
      const featureIndex = featureSource
        ? articles.findIndex((article) => article.source === featureSource)
        : -1;
      const targetIndex = featureIndex >= 0 ? featureIndex : 0;
      const firstArticleButton = articleList.querySelector(`[data-read-article="${targetIndex}"]`);
      if (!firstArticleButton) {
        return;
      }
      event.preventDefault();
      openArticle(articles[targetIndex], { replaceUrl: true });
    });
  }
}

function mediaButton(media, index) {
  const preview = media.preview
    ? `<img class="media-thumb" src="${escapeHtml(media.preview)}" alt="">`
    : `<div class="media-thumb" aria-hidden="true"></div>`;
  const role = media.role && !["image", "video", "audio", "file"].includes(media.role)
    ? ` / ${media.role}`
    : "";
  const description = media.description
    ? `<span class="media-description">${escapeHtml(media.description)}</span>`
    : "";
  return `
    <button class="media-item" type="button" data-media="${index}">
      ${preview}
      <span class="media-copy">
        <strong>${escapeHtml(media.title)}</strong>
        <span class="media-kind">${escapeHtml(media.kind)}${escapeHtml(role)} - ${bytesLabel(media.bytes)}</span>
        ${description}
      </span>
    </button>
  `;
}

function mediaTimestamp(media) {
  const modified = Date.parse(media.modified || 0) || 0;
  const dated = Date.parse(media.date || 0) || 0;
  return Math.max(modified, dated);
}

function bannerImageSource(media) {
  if (media.preview) return media.preview;
  if (media.kind === "image") return media.source || "";
  return "";
}

function applyHeaderBanner(mediaItems) {
  if (!pageHeader || !headerBannerImage || !mediaItems.length) return;
  const ranked = mediaItems
    .filter((media) => bannerImageSource(media))
    .slice()
    .sort((a, b) => {
      const rankDelta = (Number(b.banner_rank) || 0) - (Number(a.banner_rank) || 0);
      if (rankDelta) return rankDelta;
      return mediaTimestamp(b) - mediaTimestamp(a);
    });
  const banner = ranked[0];
  const source = banner ? bannerImageSource(banner) : "";
  if (!source) return;
  const version = encodeURIComponent(String(banner.modified || banner.date || ""));
  const versionedSource = version ? `${source}${source.includes("?") ? "&" : "?"}v=${version}` : source;
  const safeSource = versionedSource.replace(/\\/g, "/").replace(/"/g, "%22");
  headerBannerImage.onload = () => pageHeader.classList.add("has-banner");
  headerBannerImage.onerror = () => pageHeader.classList.remove("has-banner");
  headerBannerImage.src = safeSource;
  pageHeader.style.setProperty("--header-image", `url("${safeSource}")`);
}

function hasExplicitLandingTarget() {
  try {
    const url = new URL(location.href);
    return Boolean(location.hash || url.searchParams.has("media") || url.searchParams.has("article"));
  } catch (_error) {
    return Boolean(location.hash);
  }
}

function firstVisitMediaLandingEnabled() {
  if (hasExplicitLandingTarget()) return false;
  try {
    if (localStorage.getItem(firstVisitStorageKey)) return false;
    localStorage.setItem(firstVisitStorageKey, new Date().toISOString());
    return true;
  } catch (_error) {
    return false;
  }
}

function scrollToMediaLanding() {
  requestAnimationFrame(() => {
    window.setTimeout(() => {
      document.querySelector("#media")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 180);
  });
}

function showMedia(mediaItems) {
  if (!mediaItems.length) {
    mediaList.innerHTML = '<p class="empty">No audio or video found yet.</p>';
    return;
  }

  mediaList.innerHTML = mediaItems.map(mediaButton).join("");
  mediaList.querySelectorAll("[data-media]").forEach((button) => {
    button.addEventListener("click", () => selectMedia(mediaItems[Number(button.dataset.media)], button));
  });
  const requested = requestedMediaSource();
  const selectedIndex = requested
    ? mediaItems.findIndex((media) => media.source === requested)
    : -1;
  const targetIndex = selectedIndex >= 0 ? selectedIndex : defaultMediaIndex(mediaItems);
  const targetButton = mediaList.querySelector(`[data-media="${targetIndex}"]`);
  selectMedia(mediaItems[targetIndex], targetButton, {
    replaceUrl: false,
    autoplay: selectedIndex >= 0 && requestedMediaAutoplay()
  });
  if (selectedIndex >= 0 && location.hash === "#media") {
    requestAnimationFrame(() => {
      document.querySelector("#media")?.scrollIntoView({ block: "start" });
    });
  } else if (firstVisitMediaLandingEnabled()) {
    scrollToMediaLanding();
  }
}

function defaultMediaIndex(mediaItems) {
  const preferredIndex = mediaItems.findIndex((media) => media.source === preferredDefaultMediaSource);
  if (preferredIndex >= 0) return preferredIndex;

  let oldestVideoIndex = 0;
  let oldestVideoTime = Number.POSITIVE_INFINITY;
  mediaItems.forEach((media, index) => {
    if (media.kind !== "video") return;
    const time = Date.parse(media.date || media.modified || 0) || Number.POSITIVE_INFINITY;
    if (time < oldestVideoTime) {
      oldestVideoIndex = index;
      oldestVideoTime = time;
    }
  });
  return oldestVideoIndex;
}

function requestedMediaSource() {
  try {
    return new URL(location.href).searchParams.get("media") || "";
  } catch (_error) {
    return "";
  }
}

function requestedMediaAutoplay() {
  try {
    return new URL(location.href).searchParams.get("autoplay") === "1";
  } catch (_error) {
    return false;
  }
}

function selectedMediaIsPlaying() {
  const player = mediaFeature?.querySelector("video, audio");
  return Boolean(player && !player.paused && !player.ended);
}

function mediaShareUrl(media, { autoplay = false } = {}) {
  const url = new URL(location.href);
  url.searchParams.delete("article");
  url.searchParams.set("media", media.source);
  if (autoplay && media.kind === "video") {
    url.searchParams.set("autoplay", "1");
  } else {
    url.searchParams.delete("autoplay");
  }
  url.hash = "media";
  return url.toString();
}

async function copyMediaShareUrl(media, button) {
  const shareUrl = mediaShareUrl(media, { autoplay: selectedMediaIsPlaying() });
  try {
    if (navigator.share) {
      await navigator.share({ title: media.title, url: shareUrl });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareUrl);
    } else {
      window.prompt("Copy media link", shareUrl);
    }
    if (button) {
      const previous = button.textContent;
      button.textContent = "Copied";
      window.setTimeout(() => {
        button.textContent = previous;
      }, 1400);
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      window.prompt("Copy media link", shareUrl);
    }
  }
}

function selectMedia(media, selectedButton = null, { replaceUrl = true, autoplay = false } = {}) {
  currentMedia = media;
  mediaList.querySelectorAll("[data-media]").forEach((button) => {
    const selected = button === selectedButton;
    button.classList.toggle("selected", selected);
    if (selected) {
      button.setAttribute("aria-current", "true");
    } else {
      button.removeAttribute("aria-current");
    }
  });
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
  const meta = `${media.title} - ${media.kind}${role} - ${bytesLabel(media.bytes)}`;
  const description = media.description
    ? escapeHtml(media.description)
    : "No curation note for this item yet.";
  mediaCaption.innerHTML = `
    <div class="media-caption-bar">
      <span>${escapeHtml(meta)}</span>
      <button type="button" class="media-share" data-share-media>Share</button>
    </div>
    <p class="media-analysis" tabindex="0">${description}</p>
  `;
  mediaCaption.querySelector("[data-share-media]")?.addEventListener("click", (event) => {
    copyMediaShareUrl(currentMedia, event.currentTarget);
  });
  if (autoplay && media.kind === "video") {
    const player = mediaFeature.querySelector("video");
    player?.play?.().catch(() => {});
  }
  if (replaceUrl) {
    const url = new URL(location.href);
    if (url.searchParams.has("media")) {
      url.searchParams.delete("article");
      url.searchParams.set("media", media.source);
      url.searchParams.delete("autoplay");
      url.hash = "media";
      history.replaceState(null, "", url);
    }
  }
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

articleShare.addEventListener("click", (event) => {
  copyArticleShareUrl(currentArticle, event.currentTarget);
});

articleRead?.addEventListener("click", readArticleAloud);
articlePause?.addEventListener("click", pauseArticleSpeech);
articleStop?.addEventListener("click", stopArticleSpeech);

articleClose.addEventListener("click", () => {
  stopArticleSpeech();
  currentArticle = null;
  articleReader.hidden = true;
  articleReaderBody.innerHTML = "";
  updateArticleSpeechButtons();
});

if (articleSpeechAvailable()) {
  window.speechSynthesis.onvoiceschanged = updateArticleSpeechButtons;
}
updateArticleSpeechButtons();

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

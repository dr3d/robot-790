from __future__ import annotations

import base64
import html
import logging
import re
from html.parser import HTMLParser
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

logger = logging.getLogger(__name__)

MAX_RESULTS = 10
DEFAULT_RESULTS = 5
SEARCH_STOPWORDS = {
    "about",
    "after",
    "against",
    "before",
    "best",
    "can",
    "could",
    "does",
    "for",
    "from",
    "have",
    "history",
    "into",
    "meaning",
    "process",
    "should",
    "that",
    "the",
    "their",
    "there",
    "this",
    "what",
    "when",
    "where",
    "whether",
    "which",
    "while",
    "with",
    "would",
}
# These describe a search's style, not its subject. In fallback results they
# must not be sufficient evidence that (say) a raccoon story was found.
NEWS_QUERY_WORDS = {
    "news", "story", "stories", "headline", "headlines", "weird", "strange",
    "unusual", "funny", "bizarre", "quirky", "odd", "offbeat", "latest",
    "recent", "specific", "man", "men", "woman", "women", "people", "person",
    "something", "anything", "example", "examples", "local",
}


def search_web(query: str, max_results: int = DEFAULT_RESULTS) -> dict[str, Any]:
    """Search the web and return compact title/snippet/url results."""
    query = (query or "").strip()
    if not query:
        return {"status": "error", "error": "query must be a non-empty string"}

    result_count = _clamp_result_count(max_results)
    errors: list[str] = []
    try:
        from ddgs import DDGS
        from ddgs.exceptions import DDGSException
    except ImportError as exc:
        logger.warning("search_web unavailable because ddgs is not installed: %s", exc)
        errors.append(f"ddgs unavailable: {exc}")
    else:
        logger.info("search_web query=%s max_results=%d", query, result_count)
        try:
            with DDGS() as ddgs:
                hits = list(ddgs.text(query, max_results=result_count))
        except (DDGSException, RuntimeError) as exc:
            logger.warning("search_web failed for %r: %s", query, exc)
            errors.append(f"ddgs failed: {exc}")
        else:
            results = [
                result for result in _compact_ddgs_results(hits, result_count)
                if _dictionary_result_allowed(query, result["url"])
            ]
            if results:
                return {"status": "ok", "tool": "search_web", "query": query, "source": "ddgs", "results": results}
            errors.append("ddgs returned no usable results")

        # General web search can be empty while the same provider's news
        # indexes have useful articles. Try once with the exact same query;
        # do not silently broaden dates, subjects or site constraints.
        if _is_news_query(query):
            try:
                with DDGS() as ddgs:
                    news_hits = list(ddgs.news(query, max_results=result_count))
            except (DDGSException, RuntimeError) as exc:
                logger.warning("search_web news fallback failed for %r: %s", query, exc)
                errors.append(f"ddgs news failed: {exc}")
            else:
                news_results = [
                    result for result in _compact_ddgs_results(news_hits, result_count)
                    if _dictionary_result_allowed(query, result["url"])
                ]
                if news_results:
                    return {
                        "status": "ok", "tool": "search_web", "query": query,
                        "source": "ddgs_news", "results": news_results,
                    }
                errors.append("ddgs news returned no usable results")

    bing_results = _search_bing_html(query, result_count)
    if bing_results:
        return {
            "status": "ok",
            "tool": "search_web",
            "query": query,
            "source": "bing",
            "results": bing_results,
        }

    # An encyclopedia is useful for reference questions, but it is not a
    # substitute news provider when the search engines fail.
    wiki_results = [] if _is_news_query(query) else _search_wikipedia(query, result_count)
    if wiki_results:
        return {
            "status": "ok",
            "tool": "search_web",
            "query": query,
            "source": "wikipedia",
            "results": wiki_results,
        }

    detail = "; ".join(errors) if errors else "no results"
    logger.warning("search_web failed for %r after fallbacks: %s", query, detail)
    return {"status": "error", "error": f"web search failed for '{query}': {detail}", "query": query, "results": []}


def _compact_ddgs_results(hits: list[object], result_count: int) -> list[dict[str, str]]:
    results: list[dict[str, str]] = []
    for hit in hits:
        if not isinstance(hit, dict):
            continue
        title = str(hit.get("title") or "").strip()
        url = str(hit.get("href") or hit.get("url") or "").strip()
        if not title or not url:
            continue
        results.append(
            {
                "title": title,
                "snippet": str(hit.get("body") or "").strip(),
                "url": url,
            }
        )
        if hit.get("date"):
            results[-1]["published_at"] = str(hit["date"])
        if hit.get("source"):
            results[-1]["publisher"] = str(hit["source"])
    return results[:result_count]


def _search_bing_html(query: str, result_count: int) -> list[dict[str, str]]:
    try:
        import httpx
    except ImportError as exc:
        logger.warning("bing html search fallback unavailable because httpx is not installed: %s", exc)
        return []

    try:
        response = httpx.get(
            "https://www.bing.com/search",
            params={"q": query},
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            timeout=8.0,
            follow_redirects=True,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("bing html search fallback failed for %r: %s", query, exc)
        return []

    try:
        import bs4
    except ImportError:
        return _parse_bing_html_results(response.text, query, result_count)

    soup = bs4.BeautifulSoup(response.text, "html.parser")
    results: list[dict[str, str]] = []
    for item in soup.select("li.b_algo"):
        link = item.select_one("h2 a")
        if link is None:
            continue
        title = link.get_text(" ", strip=True)
        url = _clean_bing_url(str(link.get("href") or ""))
        snippet_node = item.select_one(".b_caption p") or item.select_one("p")
        snippet = snippet_node.get_text(" ", strip=True) if snippet_node is not None else ""
        if not title or not url:
            continue
        if not _search_result_is_relevant(query, title, snippet, url):
            continue
        results.append({"title": title, "snippet": html.unescape(snippet), "url": url})
        if len(results) >= result_count:
            break
    return results


class _BingHtmlParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.results: list[dict[str, str]] = []
        self._li_depth = 0
        self._in_result = False
        self._in_h2 = False
        self._in_link = False
        self._in_caption = False
        self._in_caption_p = False
        self._current: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = dict(attrs)
        classes = set((attr.get("class") or "").split())
        if tag == "li" and "b_algo" in classes:
            self._in_result = True
            self._li_depth = 1
            self._current = {"title": "", "url": "", "snippet": ""}
            return
        if not self._in_result:
            return
        if tag == "li":
            self._li_depth += 1
        elif tag == "h2":
            self._in_h2 = True
        elif tag == "a" and self._in_h2 and not self._current.get("url"):
            self._in_link = True
            self._current["url"] = attr.get("href") or ""
        elif tag == "div" and "b_caption" in classes:
            self._in_caption = True
        elif tag == "p" and self._in_caption:
            self._in_caption_p = True

    def handle_endtag(self, tag: str) -> None:
        if not self._in_result:
            return
        if tag == "a":
            self._in_link = False
        elif tag == "h2":
            self._in_h2 = False
        elif tag == "p":
            self._in_caption_p = False
        elif tag == "div":
            self._in_caption = False
        elif tag == "li":
            self._li_depth -= 1
            if self._li_depth <= 0:
                self.results.append({key: value.strip() for key, value in self._current.items()})
                self._in_result = False
                self._current = {}

    def handle_data(self, data: str) -> None:
        if not self._in_result:
            return
        if self._in_link:
            self._current["title"] = f"{self._current.get('title', '')} {data}".strip()
        elif self._in_caption_p:
            self._current["snippet"] = f"{self._current.get('snippet', '')} {data}".strip()


def _parse_bing_html_results(html_text: str, query: str, result_count: int) -> list[dict[str, str]]:
    parser = _BingHtmlParser()
    parser.feed(html_text)
    results: list[dict[str, str]] = []
    for item in parser.results:
        title = item.get("title", "").strip()
        url = _clean_bing_url(item.get("url", ""))
        snippet = item.get("snippet", "").strip()
        if not title or not url:
            continue
        if not _search_result_is_relevant(query, title, snippet, url):
            continue
        results.append({"title": title, "snippet": html.unescape(snippet), "url": url})
        if len(results) >= result_count:
            break
    return results


def _clean_bing_url(url: str) -> str:
    value = html.unescape(url).strip()
    if not value:
        return ""
    parsed = urlparse(value)
    if parsed.netloc.endswith("bing.com") and parsed.path.startswith("/ck/"):
        wrapped = parse_qs(parsed.query).get("u", [""])[0]
        decoded = _decode_bing_wrapped_url(wrapped)
        if decoded:
            return decoded
    return value


def _decode_bing_wrapped_url(value: str) -> str:
    wrapped = unquote(value or "")
    if wrapped.startswith("a1"):
        wrapped = wrapped[2:]
    if not wrapped:
        return ""
    padding = "=" * ((4 - len(wrapped) % 4) % 4)
    try:
        decoded = base64.urlsafe_b64decode(f"{wrapped}{padding}").decode("utf-8")
    except (ValueError, UnicodeDecodeError):
        return ""
    return decoded if decoded.startswith(("http://", "https://")) else ""


def _search_wikipedia(query: str, result_count: int) -> list[dict[str, str]]:
    try:
        import httpx
    except ImportError as exc:
        logger.warning("wikipedia search fallback unavailable because httpx is not installed: %s", exc)
        return []

    try:
        response = httpx.get(
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "query",
                "list": "search",
                "srsearch": query,
                "srlimit": result_count,
                "format": "json",
                "utf8": "1",
            },
            headers={
                "User-Agent": "Robot790/0.1 local experiment (https://localhost)",
                "Accept": "application/json",
            },
            timeout=8.0,
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("wikipedia search fallback failed for %r: %s", query, exc)
        return []

    search_items = payload.get("query", {}).get("search", [])
    if not isinstance(search_items, list):
        return []
    results: list[dict[str, str]] = []
    for item in search_items:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        snippet = _clean_wikipedia_snippet(str(item.get("snippet") or ""))
        if not title:
            continue
        url = f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}"
        if not _search_result_is_relevant(query, title, snippet, url):
            continue
        results.append(
            {
                "title": title,
                "snippet": snippet,
                "url": url,
            }
        )
    return results[:result_count]


def _clean_wikipedia_snippet(value: str) -> str:
    without_tags = html.unescape(re.sub(r"<[^>]+>", "", value))
    return re.sub(r"\s+", " ", without_tags).strip()


def _search_result_is_relevant(query: str, title: str, snippet: str, url: str) -> bool:
    tokens = _search_query_tokens(query)
    if not tokens:
        return True
    if not _dictionary_result_allowed(query, url):
        return False
    # Match words in the actual preview, not substrings such as "man" inside
    # "human" or keywords hidden in a domain/tracking URL.
    words = set(re.findall(r"[^\W_]+", f"{title} {snippet}".casefold()))
    if _is_dictionary_result(url):
        tokens = [token for token in tokens if token not in {
            "define", "definition", "definitions", "meaning", "mean", "word",
            "synonym", "synonyms", "pronunciation", "spelling", "etymology",
        }]
    if _is_news_query(query):
        if _host_matches(url, "wikipedia.org"):
            return False
        subjects = [token for token in tokens if token not in NEWS_QUERY_WORDS and not token.isdigit()]
        # Broad requests for odd-news roundups have no subject yet. Their
        # style words can match, but a year alone never counts as a topic.
        tokens = subjects or [token for token in tokens if not token.isdigit()]
    matched = sum(1 for token in tokens if token in words)
    return bool(tokens) and matched >= min(2, len(tokens))


def _is_news_query(query: str) -> bool:
    words = set(re.findall(r"[^\W_]+", query.casefold()))
    return bool(words & {"news", "headlines", "headline"}) or bool(
        words & {"story", "stories"}
        and words & {"weird", "strange", "unusual", "bizarre", "quirky", "odd", "offbeat", "latest", "recent"}
    )


def _host_matches(url: str, domain: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return host == domain or host.endswith(f".{domain}")


def _dictionary_result_allowed(query: str, url: str) -> bool:
    if not _is_dictionary_result(url):
        return True
    words = re.findall(r"[^\W_]+", query.casefold())
    return len(words) == 1 or bool(re.search(
        r"\b(define|definition|meaning|etymology|synonyms?|pronunciation|spelling)\b|\bwhat does .+ mean\b",
        query, re.IGNORECASE,
    ))


def _is_dictionary_result(url: str) -> bool:
    return any(
        _host_matches(url, blocked)
        for blocked in (
            "dictionary.com",
            "merriam-webster.com",
            "dictionary.cambridge.org",
            "collinsdictionary.com",
            "thefreedictionary.com",
            "wiktionary.org",
            "vocabulary.com",
        )
    )


def _search_query_tokens(query: str) -> list[str]:
    tokens = re.findall(r"[^\W_]+", query.casefold())
    return [
        token
        for token in dict.fromkeys(tokens)
        if len(token) > 2 and token not in SEARCH_STOPWORDS
    ]


def _clamp_result_count(value: object) -> int:
    try:
        result_count = int(value)
    except (TypeError, ValueError):
        result_count = DEFAULT_RESULTS
    return max(1, min(result_count, MAX_RESULTS))

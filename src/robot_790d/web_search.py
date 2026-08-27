from __future__ import annotations

import base64
import html
import re
import logging
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
            results = _compact_ddgs_results(hits, result_count)
            if results:
                return {"status": "ok", "tool": "search_web", "query": query, "results": results}
            errors.append("ddgs returned no usable results")

    bing_results = _search_bing_html(query, result_count)
    if bing_results:
        return {
            "status": "ok",
            "tool": "search_web",
            "query": query,
            "source": "bing",
            "results": bing_results,
        }

    wiki_results = _search_wikipedia(query, result_count)
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
        url = str(hit.get("href") or "").strip()
        if not title or not url:
            continue
        results.append(
            {
                "title": title,
                "snippet": str(hit.get("body") or "").strip(),
                "url": url,
            }
        )
    return results[:result_count]


def _search_bing_html(query: str, result_count: int) -> list[dict[str, str]]:
    try:
        import bs4
        import httpx
    except ImportError as exc:
        logger.warning("bing html search fallback unavailable because a dependency is not installed: %s", exc)
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
    without_tags = re.sub(r"<[^>]+>", "", value)
    return re.sub(r"\s+", " ", without_tags).strip()


def _search_result_is_relevant(query: str, title: str, snippet: str, url: str) -> bool:
    tokens = _search_query_tokens(query)
    if not tokens:
        return True
    if len(tokens) >= 2 and _is_dictionary_result(url):
        return False
    haystack = " ".join([title, snippet, url]).lower()
    matched = sum(1 for token in tokens if token in haystack)
    return matched >= min(2, len(tokens))


def _is_dictionary_result(url: str) -> bool:
    host = urlparse(url).netloc.lower()
    return any(
        blocked in host
        for blocked in (
            "dictionary.com",
            "merriam-webster.com",
            "cambridge.org",
            "collinsdictionary.com",
            "thefreedictionary.com",
        )
    )


def _search_query_tokens(query: str) -> list[str]:
    tokens = re.findall(r"[a-z0-9]+", query.lower())
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

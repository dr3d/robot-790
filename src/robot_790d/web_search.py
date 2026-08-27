from __future__ import annotations

import re
import logging
from typing import Any

logger = logging.getLogger(__name__)

MAX_RESULTS = 10
DEFAULT_RESULTS = 5


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
    return [
        {
            "title": str(hit.get("title") or "").strip(),
            "snippet": str(hit.get("body") or "").strip(),
            "url": str(hit.get("href") or "").strip(),
        }
        for hit in hits
        if isinstance(hit, dict)
    ][:result_count]


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
        results.append(
            {
                "title": title,
                "snippet": snippet,
                "url": f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}",
            }
        )
    return results[:result_count]


def _clean_wikipedia_snippet(value: str) -> str:
    without_tags = re.sub(r"<[^>]+>", "", value)
    return re.sub(r"\s+", " ", without_tags).strip()


def _clamp_result_count(value: object) -> int:
    try:
        result_count = int(value)
    except (TypeError, ValueError):
        result_count = DEFAULT_RESULTS
    return max(1, min(result_count, MAX_RESULTS))

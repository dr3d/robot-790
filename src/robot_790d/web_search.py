from __future__ import annotations

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
    try:
        from ddgs import DDGS
        from ddgs.exceptions import DDGSException
    except ImportError as exc:
        logger.warning("search_web unavailable because ddgs is not installed: %s", exc)
        return {
            "status": "error",
            "error": "web search requires the ddgs package; run pip install ddgs",
            "query": query,
            "results": [],
        }

    logger.info("search_web query=%s max_results=%d", query, result_count)
    try:
        with DDGS() as ddgs:
            hits = list(ddgs.text(query, max_results=result_count))
    except DDGSException as exc:
        logger.warning("search_web failed for %r: %s", query, exc)
        return {"status": "error", "error": f"web search failed for '{query}'", "query": query, "results": []}

    results = [
        {
            "title": str(hit.get("title") or "").strip(),
            "snippet": str(hit.get("body") or "").strip(),
            "url": str(hit.get("href") or "").strip(),
        }
        for hit in hits
        if isinstance(hit, dict)
    ]
    return {"status": "ok", "tool": "search_web", "query": query, "results": results[:result_count]}


def _clamp_result_count(value: object) -> int:
    try:
        result_count = int(value)
    except (TypeError, ValueError):
        result_count = DEFAULT_RESULTS
    return max(1, min(result_count, MAX_RESULTS))

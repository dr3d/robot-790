from __future__ import annotations

import copy
import logging
import threading
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urldefrag, urlsplit

import httpx

logger = logging.getLogger(__name__)
HEADLINES_FEED = "https://feeds.bbci.co.uk/news/rss.xml"
HEADLINES_CACHE_SECONDS = 600
_cache: dict[str, object] = {}
_cache_until = 0.0
_cache_lock = threading.Lock()


def _parse_headlines(content: bytes, now: datetime) -> list[dict[str, str]]:
    results = []
    seen = set()
    for item in ET.fromstring(content).findall("./channel/item"):
        title = " ".join((item.findtext("title") or "").split())[:240]
        url = urldefrag((item.findtext("link") or "").strip()).url
        if not title or urlsplit(url).scheme not in {"http", "https"} or not urlsplit(url).hostname:
            continue
        try:
            published = parsedate_to_datetime(item.findtext("pubDate") or "")
        except (TypeError, ValueError, OverflowError):
            continue
        if published.tzinfo is None or not now - timedelta(hours=48) <= published <= now + timedelta(minutes=5):
            continue
        if url in seen or title.casefold() in seen:
            continue
        seen.update((url, title.casefold()))
        results.append({
            "title": title,
            "url": url,
            "snippet": " ".join((item.findtext("description") or "").split())[:500],
            "source": "BBC News",
            "published_at": published.astimezone(timezone.utc).isoformat(),
        })
    return sorted(results, key=lambda item: item["published_at"], reverse=True)[:8]


def read_headlines() -> dict[str, object]:
    """Read a fixed public news feed, with a real-time cache shared by page clients."""
    global _cache, _cache_until
    with _cache_lock:
        if time.monotonic() < _cache_until:
            return copy.deepcopy(_cache)
        try:
            with httpx.stream("GET", HEADLINES_FEED, timeout=8.0, follow_redirects=True) as response:
                response.raise_for_status()
                content = bytearray()
                for chunk in response.iter_bytes():
                    content.extend(chunk)
                    if len(content) > 1024 * 1024:
                        raise ValueError("Headline feed exceeds 1 MiB")
            now = datetime.now(timezone.utc)
            results = _parse_headlines(bytes(content), now)
            if not results:
                raise ValueError("No dated headlines from the last 48 hours")
            _cache = {
                "status": "ok", "tool": "read_headlines", "query": "BBC News headlines",
                "feed_url": HEADLINES_FEED, "retrieved_at": now.isoformat(), "results": results,
            }
            ttl = HEADLINES_CACHE_SECONDS
        except (httpx.HTTPError, ET.ParseError, ValueError) as exc:
            logger.warning("Headline feed unavailable: %s", exc)
            _cache = {"status": "error", "tool": "read_headlines", "error": str(exc), "results": []}
            ttl = 60
        _cache_until = time.monotonic() + ttl
        return copy.deepcopy(_cache)

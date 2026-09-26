"""Small, source-labeled reading candidates; never fetch user-supplied URLs."""
from __future__ import annotations

import copy
import json
import logging
import threading
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlencode, urlsplit

import httpx

from robot_790d.headlines import read_headlines

logger = logging.getLogger(__name__)
SOURCES = {
    "hn": "https://news.ycombinator.com/rss",
    "wikipedia": "https://en.wikipedia.org/w/api.php?" + urlencode({
        "action": "query", "format": "json", "formatversion": 2,
        "generator": "random", "grnnamespace": 0, "grnlimit": 8,
        "prop": "extracts|info", "inprop": "url", "exintro": 1,
        "explaintext": 1, "exchars": 500, "exlimit": 8,
    }),
}
_cache: dict[str, tuple[float, dict]] = {}
_lock = threading.Lock()


def _text(value: object, limit: int) -> str:
    return " ".join(str(value or "").split())[:limit]


def _parse(source: str, content: bytes, retrieved: str) -> list[dict[str, str]]:
    results = []
    if source == "hn":
        for entry in ET.fromstring(content).findall("./channel/item"):
            try:
                published = parsedate_to_datetime(entry.findtext("pubDate") or "")
                if published.tzinfo is None:
                    continue
            except (TypeError, ValueError, OverflowError):
                continue
            results.append({
                "title": _text(entry.findtext("title"), 240),
                "url": _text(entry.findtext("link"), 2048),
                "snippet": "Hacker News submission title only; the linked article has not been read.",
                "source": "Hacker News", "kind": "discussion",
                "published_at": published.astimezone(timezone.utc).isoformat(),
                "retrieved_at": retrieved,
            })
    else:
        payload = json.loads(content)
        if not isinstance(payload, dict) or not isinstance(payload.get("query"), dict):
            raise ValueError("Wikipedia returned no article query")
        pages = payload["query"].get("pages", [])
        if not isinstance(pages, list):
            raise ValueError("Wikipedia returned no article list")
        for entry in pages:
            if not isinstance(entry, dict) or not entry.get("extract"):
                continue
            results.append({
                "title": _text(entry.get("title"), 240),
                "url": _text(entry.get("fullurl"), 2048),
                "snippet": _text(entry["extract"], 500),
                "source": "Wikipedia", "kind": "encyclopedia",
                "published_at": "", "retrieved_at": retrieved,
            })
    seen = set()
    valid = []
    for item in results:
        parsed = urlsplit(item["url"])
        if not item["title"] or parsed.scheme not in {"https", "http"} or not parsed.hostname:
            continue
        if source == "wikipedia" and parsed.hostname != "en.wikipedia.org":
            continue
        if item["url"] in seen:
            continue
        seen.add(item["url"])
        valid.append(item)
    return valid[:8]


def read_exploration(source: str) -> dict:
    if source == "bbc":
        return read_headlines()
    if source not in SOURCES:
        return {"status": "error", "error": "Unknown exploration source", "results": []}
    # Serializing cache fills also prevents simultaneous browser clients hammering a source.
    with _lock:
        until, cached = _cache.get(source, (0, {}))
        if time.monotonic() < until:
            return copy.deepcopy(cached)
        try:
            with httpx.stream("GET", SOURCES[source], timeout=8.0, follow_redirects=True,
                              headers={"User-Agent": "Robot790/0.1 (https://github.com/dr3d/robot-790)"}) as response:
                response.raise_for_status()
                content = bytearray()
                for chunk in response.iter_bytes():
                    content.extend(chunk)
                    if len(content) > 1024 * 1024:
                        raise ValueError("Exploration response exceeds 1 MiB")
            retrieved = datetime.now(timezone.utc).isoformat()
            results = _parse(source, bytes(content), retrieved)
            if not results:
                raise ValueError("No reading candidates returned")
            payload = {"status": "ok", "tool": "read_exploration", "source": source,
                       "retrieved_at": retrieved, "results": results}
            ttl = 60
        except (httpx.HTTPError, ValueError, ET.ParseError) as exc:
            logger.warning("Exploration source %s unavailable: %s", source, exc)
            payload = {"status": "error", "source": source, "error": str(exc), "results": []}
            ttl = 60
        _cache[source] = (time.monotonic() + ttl, payload)
        return copy.deepcopy(payload)

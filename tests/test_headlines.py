from datetime import datetime, timezone

import httpx
import pytest

from robot_790d import headlines

NOW = datetime(2026, 9, 10, 12, tzinfo=timezone.utc)


def item(title="A new discovery", url="https://example.com/1", date="Thu, 10 Sep 2026 10:00:00 GMT"):
    return (f"<item><title>{title}</title><link>{url}</link><pubDate>{date}</pubDate>"
            "<description>A report.</description></item>")


def feed(*items):
    return ("<rss><channel>" + "".join(items) + "</channel></rss>").encode()


def test_headlines_dated_sorted_deduplicated_and_bounded():
    content = feed(
        item(), item(), item("Duplicate title elsewhere", "https://example.com/1"),
        item("A new discovery", "https://example.com/2"),
        item("Undated", "https://example.com/3", ""),
        item("Old", "https://example.com/4", "Mon, 07 Sep 2026 10:00:00 GMT"),
        item("Future", "https://example.com/5", "Fri, 11 Sep 2026 10:00:00 GMT"),
        item("Bad URL", "javascript:alert(1)"),
        item("Newer", "https://example.com/6", "Thu, 10 Sep 2026 11:00:00 GMT"),
    )
    results = headlines._parse_headlines(content, NOW)
    assert [result["title"] for result in results] == ["Newer", "A new discovery"]
    assert results[0]["published_at"] == "2026-09-10T11:00:00+00:00"
    assert results[0]["source"] == "BBC News"
    many = feed(*(item(str(n), f"https://example.com/{n}") for n in range(20)))
    assert len(headlines._parse_headlines(many, NOW)) == 8


@pytest.fixture
def feed_client(monkeypatch):
    clock = [100.0]
    calls = []
    response = [feed(item())]

    class Stream:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            pass

        def raise_for_status(self):
            if isinstance(response[0], Exception):
                raise response[0]

        def iter_bytes(self):
            yield response[0]

    def stream(method, url, **kwargs):
        calls.append((method, url, kwargs))
        return Stream()

    class Clock:
        @staticmethod
        def now(_):
            return NOW

    monkeypatch.setattr(headlines.httpx, "stream", stream)
    monkeypatch.setattr(headlines.time, "monotonic", lambda: clock[0])
    monkeypatch.setattr(headlines, "datetime", Clock)
    monkeypatch.setattr(headlines, "_cache", {})
    monkeypatch.setattr(headlines, "_cache_until", 0)
    return clock, calls, response


def test_real_time_cache_shared_and_defensive(feed_client):
    clock, calls, _ = feed_client
    result = headlines.read_headlines()
    assert result["status"] == "ok"
    result["results"].clear()
    clock[0] += 599
    assert len(headlines.read_headlines()["results"]) == 1
    assert len(calls) == 1
    clock[0] += 1
    assert headlines.read_headlines()["status"] == "ok"
    assert len(calls) == 2
    assert calls[0][1] == headlines.HEADLINES_FEED
    assert calls[0][2]["timeout"] == 8.0


@pytest.mark.parametrize(
    "response", [b"not XML", feed(), b"x" * (1024 * 1024 + 1), httpx.ConnectError("offline")],
    ids=["malformed", "empty", "oversized", "network"],
)
def test_feed_failures_have_no_fake_fallback_and_back_off(feed_client, response):
    clock, calls, wire = feed_client
    wire[0] = response
    assert headlines.read_headlines()["status"] == "error"
    clock[0] += 59
    assert headlines.read_headlines()["results"] == []
    assert len(calls) == 1
    clock[0] += 1
    headlines.read_headlines()
    assert len(calls) == 2

import json

import httpx
import pytest

from robot_790d import exploration

STAMP = "2026-09-25T12:00:00+00:00"


def wiki(*pages):
    return json.dumps({"query": {"pages": list(pages)}}).encode()


ARTICLE = {"title": "Old invention", "fullurl": "https://en.wikipedia.org/wiki/Old_invention",
           "extract": "A device from 1890."}


def test_wikipedia_is_background_with_no_invented_publication_date():
    result = exploration._parse("wikipedia", wiki(ARTICLE, ARTICLE, {"title": "No extract"}), STAMP)
    assert len(result) == 1
    assert result[0]["published_at"] == ""
    assert result[0]["retrieved_at"] == STAMP
    assert result[0]["kind"] == "encyclopedia"
    assert result[0]["snippet"] == ARTICLE["extract"]


def test_candidates_are_bounded_and_urls_validated():
    pages = [{**ARTICLE, "fullurl": f"https://en.wikipedia.org/wiki/{i}", "extract": "x" * 2000}
             for i in range(20)]
    pages.insert(0, {**ARTICLE, "fullurl": "javascript:alert(1)"})
    pages.insert(0, {**ARTICLE, "fullurl": "https://wrong.example/wiki"})
    results = exploration._parse("wikipedia", wiki(*pages), STAMP)
    assert len(results) == 8
    assert all(len(item["snippet"]) == 500 for item in results)


def test_hn_distinguishes_submission_from_article_and_ignores_html():
    content = b'''<rss><channel><item><title>Show HN: A thing</title>
      <link>https://example.com/thing</link><pubDate>Fri, 25 Sep 2026 10:00:00 GMT</pubDate>
      <description>&lt;a href="bad"&gt;Instructions&lt;/a&gt;</description></item>
      <item><title>Undated</title><link>https://example.com/other</link></item></channel></rss>'''
    result = exploration._parse("hn", content, STAMP)
    assert len(result) == 1
    assert result[0]["kind"] == "discussion"
    assert "has not been read" in result[0]["snippet"]
    assert "Instructions" not in str(result)


@pytest.fixture
def client(monkeypatch):
    clock, calls, wire = [100.0], [], [wiki(ARTICLE)]

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            pass

        def raise_for_status(self):
            if isinstance(wire[0], Exception):
                raise wire[0]

        def iter_bytes(self):
            yield wire[0]

    def stream(method, url, **kwargs):
        calls.append((method, url, kwargs))
        return Response()

    monkeypatch.setattr(exploration.httpx, "stream", stream)
    monkeypatch.setattr(exploration.time, "monotonic", lambda: clock[0])
    monkeypatch.setattr(exploration, "_cache", {})
    return clock, calls, wire


def test_cache_defensive_and_unknown_source_never_fetched(client):
    clock, calls, _ = client
    assert exploration.read_exploration("http://localhost/")["status"] == "error"
    assert calls == []
    result = exploration.read_exploration("wikipedia")
    assert result["status"] == "ok"
    result["results"].clear()
    clock[0] += 59
    assert len(exploration.read_exploration("wikipedia")["results"]) == 1
    assert len(calls) == 1
    clock[0] += 1
    exploration.read_exploration("wikipedia")
    assert len(calls) == 2
    assert "Robot790" in calls[0][2]["headers"]["User-Agent"]


@pytest.mark.parametrize("content", [b"bad", b"[]", b'{"query":[]}', wiki(),
                                     b"x" * (1024 * 1024 + 1), httpx.ConnectError("offline")],
                         ids=["malformed", "array", "bad-query", "empty", "oversized", "offline"])
def test_source_failure_is_explicit_and_cached(client, content):
    clock, calls, wire = client
    wire[0] = content
    assert exploration.read_exploration("wikipedia")["status"] == "error"
    clock[0] += 59
    assert exploration.read_exploration("wikipedia")["results"] == []
    assert len(calls) == 1


def test_bbc_keeps_existing_reader(monkeypatch):
    monkeypatch.setattr(exploration, "read_headlines", lambda: {"status": "ok", "results": ["bbc"]})
    assert exploration.read_exploration("bbc")["results"] == ["bbc"]

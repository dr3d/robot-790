import json
import sys
import types
from pathlib import Path

import pytest

from robot_790d.web_search import _clean_bing_url, _search_result_is_relevant, search_web


class FakeDdgs:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def text(self, query, max_results):
        assert query == "robot 790"
        assert max_results == 2
        return [
            {"title": "First", "body": "One", "href": "https://example.com/1"},
            {"title": "Second", "body": "Two", "href": "https://example.com/2"},
        ]


def test_search_web_returns_compact_results(monkeypatch) -> None:
    fake_module = types.ModuleType("ddgs")
    fake_module.DDGS = FakeDdgs
    fake_exceptions = types.ModuleType("ddgs.exceptions")
    fake_exceptions.DDGSException = RuntimeError
    monkeypatch.setitem(sys.modules, "ddgs", fake_module)
    monkeypatch.setitem(sys.modules, "ddgs.exceptions", fake_exceptions)

    result = search_web(" robot 790 ", max_results=2)

    assert result == {
        "status": "ok",
        "tool": "search_web",
        "query": "robot 790",
        "source": "ddgs",
        "results": [
            {"title": "First", "snippet": "One", "url": "https://example.com/1"},
            {"title": "Second", "snippet": "Two", "url": "https://example.com/2"},
        ],
    }


def test_search_web_falls_back_to_wikipedia(monkeypatch) -> None:
    class FailingDdgs:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def text(self, _query, max_results):
            assert max_results == 2
            raise RuntimeError("No results found.")

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "query": {
                    "search": [
                        {
                            "title": "Fresnel lens",
                            "snippet": "A <span>Fresnel lens</span> is used in lighthouses.",
                        }
                    ]
                }
            }

    class EmptyBingResponse:
        text = "<html><body></body></html>"

        def raise_for_status(self):
            return None

    def fake_get(url, *, params, headers, timeout, follow_redirects=False):
        if url == "https://www.bing.com/search":
            assert params["q"] == "Fresnel lens inventor"
            assert timeout == 8.0
            assert follow_redirects is True
            return EmptyBingResponse()
        assert url == "https://en.wikipedia.org/w/api.php"
        assert params["srsearch"] == "Fresnel lens inventor"
        assert headers["User-Agent"].startswith("Robot790/")
        assert timeout == 8.0
        return FakeResponse()

    fake_ddgs = types.ModuleType("ddgs")
    fake_ddgs.DDGS = FailingDdgs
    fake_exceptions = types.ModuleType("ddgs.exceptions")
    fake_exceptions.DDGSException = RuntimeError
    fake_httpx = types.ModuleType("httpx")
    fake_httpx.get = fake_get
    fake_httpx.HTTPError = RuntimeError

    monkeypatch.setitem(sys.modules, "ddgs", fake_ddgs)
    monkeypatch.setitem(sys.modules, "ddgs.exceptions", fake_exceptions)
    monkeypatch.setitem(sys.modules, "httpx", fake_httpx)

    result = search_web("Fresnel lens inventor", max_results=2)

    assert result == {
        "status": "ok",
        "tool": "search_web",
        "query": "Fresnel lens inventor",
        "source": "wikipedia",
        "results": [
            {
                "title": "Fresnel lens",
                "snippet": "A Fresnel lens is used in lighthouses.",
                "url": "https://en.wikipedia.org/wiki/Fresnel_lens",
            }
        ],
    }


def test_search_web_falls_back_to_bing_html(monkeypatch) -> None:
    class FailingDdgs:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def text(self, _query, max_results):
            assert max_results == 2
            raise RuntimeError("No results found.")

    class FakeResponse:
        text = """
        <html><body>
          <li class="b_algo">
            <h2><a href="https://example.com/login">Fleet Manager Login</a></h2>
            <div class="b_caption"><p>Sign in to manage your fleet account.</p></div>
          </li>
          <li class="b_algo">
            <h2><a href="https://example.com/mars">Mars traction study</a></h2>
            <div class="b_caption"><p>Mars rover wheels interact with dry dust.</p></div>
          </li>
        </body></html>
        """

        def raise_for_status(self):
            return None

    def fake_get(url, *, params, headers, timeout, follow_redirects=False):
        assert url == "https://www.bing.com/search"
        assert params["q"] == "Mars dust traction"
        assert "Mozilla/5.0" in headers["User-Agent"]
        assert timeout == 8.0
        assert follow_redirects is True
        return FakeResponse()

    fake_ddgs = types.ModuleType("ddgs")
    fake_ddgs.DDGS = FailingDdgs
    fake_exceptions = types.ModuleType("ddgs.exceptions")
    fake_exceptions.DDGSException = RuntimeError
    fake_httpx = types.ModuleType("httpx")
    fake_httpx.get = fake_get
    fake_httpx.HTTPError = RuntimeError

    monkeypatch.setitem(sys.modules, "ddgs", fake_ddgs)
    monkeypatch.setitem(sys.modules, "ddgs.exceptions", fake_exceptions)
    monkeypatch.setitem(sys.modules, "httpx", fake_httpx)

    result = search_web("Mars dust traction", max_results=2)

    assert result == {
        "status": "ok",
        "tool": "search_web",
        "query": "Mars dust traction",
        "source": "bing",
        "results": [
            {
                "title": "Mars traction study",
                "snippet": "Mars rover wheels interact with dry dust.",
                "url": "https://example.com/mars",
            }
        ],
    }


def test_clean_bing_url_decodes_wrapped_url() -> None:
    wrapped = (
        "https://www.bing.com/ck/a?!&&u="
        "a1aHR0cHM6Ly9leGFtcGxlLmNvbS9wYXRoP3E9bWFycw"
        "&ntb=1"
    )

    assert _clean_bing_url(wrapped) == "https://example.com/path?q=mars"


def test_relevance_filter_blocks_dictionary_for_multi_term_lookup() -> None:
    assert not _search_result_is_relevant(
        "thermal blanket material traction slippery",
        "THERMAL | English meaning",
        "The meaning of thermal is relating to heat or temperature.",
        "https://dictionary.cambridge.org/dictionary/english/thermal",
    )


def test_search_web_rejects_empty_query() -> None:
    assert search_web("") == {"status": "error", "error": "query must be a non-empty string"}


@pytest.mark.parametrize("receipt", json.loads(
    (Path(__file__).parent / "fixtures/search-headline-fallbacks.json").read_text(encoding="utf-8")
), ids=lambda receipt: receipt["query"])
def test_rejects_unrelated_fallbacks_observed_in_headline_game(receipt) -> None:
    for result in receipt["results"]:
        assert not _search_result_is_relevant(receipt["query"], **result), result


@pytest.mark.parametrize("query,title,snippet,url", [
    ("weird news raccoon stealing donuts", "Raccoon steals donuts from bakery",
     "A raccoon surprised customers.", "https://example.com/news/raccoon"),
    ("man attempts world record dancing 2025 strange news", "World record dancing attempt",
     "A man danced for days.", "https://example.com/dance"),
    ("weird news 2025", "The year's weird news stories", "An odd-news roundup.", "https://example.com/roundup"),
    ("Fresnel lens inventor", "Fresnel lens", "Used in lighthouses.", "https://en.wikipedia.org/wiki/Fresnel_lens"),
    ("thermal blanket material", "Thermal blanket material study", "A physics paper.", "https://www.cambridge.org/paper"),
    ("define weird", "Weird definition", "Unusual or strange.", "https://en.wiktionary.org/wiki/weird"),
    ("what does punchy mean", "Punchy", "Having force.", "https://www.vocabulary.com/dictionary/punchy"),
])
def test_relevance_retains_subject_matches_reference_and_explicit_definitions(query, title, snippet, url) -> None:
    assert _search_result_is_relevant(query, title, snippet, url)


def test_fallback_cannot_match_substrings_or_tracking_url() -> None:
    assert not _search_result_is_relevant(
        "man dancing", "Human resources", "Office opening hours.",
        "https://example.com/?q=man+dancing",
    )


def test_primary_dictionary_junk_continues_to_fallback_without_using_wikipedia_for_news(monkeypatch) -> None:
    import robot_790d.web_search as search

    class DictionaryDdgs(FakeDdgs):
        def text(self, query, max_results):
            return [{"title": "Weird", "body": "Definition", "href": "https://en.wiktionary.org/wiki/weird"}]

        def news(self, query, max_results):
            return []

    fake_module = types.ModuleType("ddgs")
    fake_module.DDGS = DictionaryDdgs
    fake_exceptions = types.ModuleType("ddgs.exceptions")
    fake_exceptions.DDGSException = RuntimeError
    monkeypatch.setitem(sys.modules, "ddgs", fake_module)
    monkeypatch.setitem(sys.modules, "ddgs.exceptions", fake_exceptions)
    monkeypatch.setattr(search, "_search_bing_html", lambda *_: [])
    monkeypatch.setattr(
        search, "_search_wikipedia", lambda *_: pytest.fail("News must not become an encyclopedia search")
    )
    result = search.search_web("weird news raccoon stealing donuts")
    assert result["status"] == "error"
    assert result["results"] == []


@pytest.mark.parametrize("text_outcome", ["empty", "exception", "dictionary"])
def test_news_search_recovers_an_empty_web_search_and_preserves_provenance(monkeypatch, text_outcome) -> None:
    import robot_790d.web_search as search

    calls = []
    query = "unusual bizarre news story animal weird recent 2026"

    class NewsDdgs(FakeDdgs):
        def text(self, q, max_results):
            calls.append(("text", q, max_results))
            if text_outcome == "exception":
                raise RuntimeError("No results found.")
            if text_outcome == "dictionary":
                return [{"title": "Weird", "href": "https://en.wiktionary.org/wiki/weird"}]
            return []

        def news(self, q, max_results):
            calls.append(("news", q, max_results))
            return [{
                "title": "News of the Weird", "body": "Animal stories from around the world.",
                "url": "https://example.com/news", "date": "2026-09-16T06:00:00+00:00",
                "source": "Example News", "image": None,
            }]

    fake_module = types.ModuleType("ddgs")
    fake_module.DDGS = NewsDdgs
    fake_exceptions = types.ModuleType("ddgs.exceptions")
    fake_exceptions.DDGSException = RuntimeError
    monkeypatch.setitem(sys.modules, "ddgs", fake_module)
    monkeypatch.setitem(sys.modules, "ddgs.exceptions", fake_exceptions)
    monkeypatch.setattr(search, "_search_bing_html", lambda *_: pytest.fail("Already recovered via news"))
    result = search.search_web(query, 3)
    assert calls == [("text", query, 3), ("news", query, 3)]
    assert result == {
        "status": "ok", "tool": "search_web", "query": query, "source": "ddgs_news",
        "results": [{
            "title": "News of the Weird", "snippet": "Animal stories from around the world.",
            "url": "https://example.com/news", "published_at": "2026-09-16T06:00:00+00:00",
            "publisher": "Example News",
        }],
    }


def test_news_failure_falls_through_once_without_relaxing_the_query(monkeypatch) -> None:
    import robot_790d.web_search as search

    calls = []
    query = "site:apnews.com/oddities recent strange news story"

    class EmptyDdgs(FakeDdgs):
        def text(self, q, max_results):
            calls.append(("text", q))
            raise RuntimeError("No results found.")

        def news(self, q, max_results):
            calls.append(("news", q))
            raise RuntimeError("No results found.")

    fake_module = types.ModuleType("ddgs")
    fake_module.DDGS = EmptyDdgs
    fake_exceptions = types.ModuleType("ddgs.exceptions")
    fake_exceptions.DDGSException = RuntimeError
    monkeypatch.setitem(sys.modules, "ddgs", fake_module)
    monkeypatch.setitem(sys.modules, "ddgs.exceptions", fake_exceptions)
    monkeypatch.setattr(search, "_search_bing_html", lambda q, _: calls.append(("bing", q)) or [])
    monkeypatch.setattr(search, "_search_wikipedia", lambda *_: pytest.fail("No news encyclopedia fallback"))
    result = search.search_web(query)
    assert calls == [("text", query), ("news", query), ("bing", query)]
    assert result["status"] == "error"
    assert result["results"] == []

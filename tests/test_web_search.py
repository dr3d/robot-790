import types
import sys

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

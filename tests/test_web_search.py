import sys
import types

from robot_790d.web_search import search_web


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

    def fake_get(url, *, params, headers, timeout):
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


def test_search_web_rejects_empty_query() -> None:
    assert search_web("") == {"status": "error", "error": "query must be a non-empty string"}

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


def test_search_web_rejects_empty_query() -> None:
    assert search_web("") == {"status": "error", "error": "query must be a non-empty string"}

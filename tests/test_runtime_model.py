import json

import pytest

from robot_790d import runtime_model, session_preparation, sts_page_server


@pytest.fixture
def selection(tmp_path, monkeypatch):
    path = tmp_path / "active-llm.json"
    monkeypatch.setattr(runtime_model, "SELECTION_PATH", path)
    return path


def test_selection_refreshes_without_page_restart(selection):
    assert runtime_model.local_runtime_model() is None
    runtime_model.select_model("new-model", "http://127.0.0.1:1234/v1")
    assert runtime_model.local_runtime_model() == "new-model"
    runtime_model.select_model("old-model", "http://127.0.0.1:1234/v1")
    assert runtime_model.local_runtime_model() == "old-model"


def test_invalid_selection_fails_closed(selection):
    selection.write_text(json.dumps({"model": ""}), encoding="utf-8")
    with pytest.raises(ValueError):
        runtime_model.local_runtime_model()


def test_remote_selection_does_not_autoload_local_model(selection):
    runtime_model.select_model("remote", "https://example.com/v1")
    assert runtime_model.local_runtime_model("https://example.com/v1") is None
    with pytest.raises(ValueError, match="disabled"):
        runtime_model.local_runtime_model()


def test_summary_follows_selected_model_over_old_environment(selection, monkeypatch):
    monkeypatch.setenv("ROBOT_790_SUMMARY_MODEL", "old-model")
    monkeypatch.setenv("ROBOT_790_SUMMARY_BASE_URL", "http://127.0.0.1:1234/v1")
    runtime_model.select_model("new-model", "http://127.0.0.1:1234/v1")
    assert session_preparation.summary_request("A useful conversation.")["model"] == "new-model"


@pytest.mark.parametrize("lane", ["BRAIN2", "DELIBERATE"])
def test_background_request_follows_selected_model(selection, monkeypatch, lane):
    monkeypatch.setenv(f"ROBOT_790_{lane}_MODEL", "old-model")
    monkeypatch.setenv(f"ROBOT_790_{lane}_BASE_URL", "http://127.0.0.1:1234/v1")
    runtime_model.select_model("new-model", "http://127.0.0.1:1234/v1")
    calls = []

    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            content = '{"should_surface":false,"reason":"quiet"}' if lane == "BRAIN2" else "A considered answer."
            return {"choices": [{"message": {"content": content}}]}

    class Client:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def post(self, url, headers=None, json=None):
            calls.append(json)
            return Response()

    monkeypatch.setattr(sts_page_server.httpx, "Client", Client)
    if lane == "BRAIN2":
        sts_page_server.mull_second_brain({"conversation": "Operator: Let us try a new model. Eric: Ready for the experiment."})
    else:
        sts_page_server.deliberate_once({"question": "What is worth checking?", "model": "stale-browser-model"})
    assert calls[-1]["model"] == "new-model"

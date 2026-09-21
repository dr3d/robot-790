import asyncio
import hashlib
import json
import sys
from types import SimpleNamespace

import pytest

from robot_790d import connection_context as cc
from robot_790d.continuity import save_continuity_session
from robot_790d.note_files import read_note_file, write_note_file


def test_budget_reserves_growth_and_shared_brain_output_headroom():
    config = cc.budget_config(None)
    assert config["history_start_index"] == 1
    assert config["history_min_recent_sessions"] == 1
    small = cc.budget_receipt(23000, 65536, config)
    assert small["startup_budget_tokens"] == 23552
    assert small["growth_available_tokens"] == 33320
    assert small["fits"]
    assert not cc.budget_receipt(23553, 65536, config)["fits"]
    assert cc.budget_receipt(23552, 65536, config)["fits"]
    assert cc.budget_receipt(61000, 131072, config)["fits"]
    assert not cc.budget_receipt(1, 8192, config)["fits"]
    assert cc.budget_receipt(39000, 65536, {"growth_tokens": 16384})["fits"]


@pytest.mark.parametrize("config", [{"enabled": "true"}, {"growth_tokens": True},
                                      {"margin_tokens": -1}, {"b2_tokens": 1.5}, {"output_tokens": 1000001},
                                      {"history_start_index": -1}, {"history_start_index": True},
                                      {"history_start_index": 1.5}, {"history_min_recent_sessions": "1"}])
def test_config_rejects_invalid_values(config):
    with pytest.raises(ValueError):
        cc.budget_config(config)


def test_history_boundaries_do_not_change_token_allowances():
    baseline = cc.budget_receipt(20000, 65536, {})
    changed = cc.budget_receipt(20000, 65536, {"history_start_index": 2, "history_min_recent_sessions": 3})
    assert changed["policy"]["history_start_index"] == 2
    assert changed["policy"]["history_min_recent_sessions"] == 3
    assert {k: v for k, v in changed.items() if k != "policy"} == {k: v for k, v in baseline.items() if k != "policy"}
    assert cc.budget_config({"history_start_index": 0, "history_min_recent_sessions": 0})["history_start_index"] == 0


def test_measure_includes_voice_tools_runtime_and_never_loads_or_generates(monkeypatch):
    captured = {}
    class Model:
        identifier = "resident"
        def apply_prompt_template(self, chat, opts):
            captured.update(chat=chat, opts=opts)
            return "rendered by provider"
        def tokenize(self, text):
            assert text == "rendered by provider"
            return list(range(100))
        def get_context_length(self):
            return 65536
    class Client:
        def __init__(self, host):
            assert host == "127.0.0.1:1234"
            self.llm = SimpleNamespace(list_loaded=lambda: [Model()])
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
    monkeypatch.setitem(sys.modules, "lmstudio", SimpleNamespace(Client=Client, set_sync_api_timeout=lambda n: None))
    monkeypatch.setattr(cc, "local_runtime_model", lambda: "resident")
    tool = {"type": "function", "name": "get_clock", "description": "Clock", "parameters": {"type": "object"}}
    result = cc.measure_connection({"instructions": "ERIC IDENTITY", "runtime": "PRIVATE STATE", "tools": [tool]}, {})
    assert result["prompt_tokens"] == 100
    assert result["model"] == "resident"
    assert "ERIC IDENTITY" in captured["chat"]["messages"][0]["content"]
    assert "Voice Rules" in captured["chat"]["messages"][0]["content"]
    assert captured["chat"]["messages"][1] == {"role": "assistant", "content": "PRIVATE STATE"}
    assert captured["opts"]["toolDefinitions"][0]["function"]["name"] == "get_clock"
    monkeypatch.setattr(cc, "local_runtime_model", lambda: "not-loaded")
    with pytest.raises(ValueError, match="not loaded"):
        cc.measure_connection({"instructions": "test"}, {})


def source_session(root):
    text = "Transcript\n----------\n[10:00] You: Bonjour.\n[10:01] Robot 790: Bonjour Scott.\n"
    text += "\n".join(f"[10:{i:02}] Robot 790: Thought {i}." for i in range(2, 12))
    return save_continuity_session(text, [], root, filename_timestamp="20260920-120000")["session_filename"]


def completion(ids):
    return {"choices": [{"finish_reason": "stop", "message": {"content": json.dumps({"selected_turn_ids": ids})}}]}


def test_excerpts_cache_source_ids_preserve_source_and_operator_reply(tmp_path, monkeypatch):
    monkeypatch.delenv("ROBOT_790_NOTES_PATH", raising=False)
    monkeypatch.setattr(cc, "local_runtime_model", lambda: "resident")
    name = source_session(tmp_path)
    before = read_note_file(tmp_path, name).content
    calls = []
    async def complete(request):
        calls.append(request)
        return completion([6])
    async def run():
        return await cc.prepare_excerpt(name, instance_path=tmp_path, cache_root=tmp_path / "cache", complete=complete)
    first, second = asyncio.run(run()), asyncio.run(run())
    assert first == second
    assert len(calls) == 1
    assert first["source_sha256"] == hashlib.sha256(before.encode()).hexdigest()
    assert "You: Bonjour." in first["content"] and "Robot 790: Bonjour Scott." in first["content"]
    assert "Thought 6." in first["content"] and "Historical gap" in first["content"]
    assert read_note_file(tmp_path, name).content == before
    assert first["filename"] == name
    assert calls[0]["model"] == "resident"
    assert "tools" not in calls[0]


def test_source_mutation_during_preparation_prevents_installable_result(tmp_path, monkeypatch):
    monkeypatch.delenv("ROBOT_790_NOTES_PATH", raising=False)
    monkeypatch.setattr(cc, "local_runtime_model", lambda: "resident")
    name = source_session(tmp_path)
    original = read_note_file(tmp_path, name).content
    async def complete(request):
        write_note_file(tmp_path, name, original + "\nChanged by operator.")
        return completion([6])
    with pytest.raises(ValueError, match="Source or model changed"):
        asyncio.run(cc.prepare_excerpt(name, instance_path=tmp_path, cache_root=tmp_path / "cache", complete=complete))
    assert read_note_file(tmp_path, name).content.endswith("Changed by operator.")
    assert not list((tmp_path / "cache").rglob("result.json"))


@pytest.mark.parametrize("name", ["core/eric.txt", "sessions/archived/test.txt", "../private.txt"])
def test_no_core_cards_archives_or_arbitrary_files_compacted(name):
    with pytest.raises(ValueError, match="Only a current"):
        asyncio.run(cc.prepare_excerpt(name))


def test_measure_endpoint_is_bounded_and_failure_is_explicit(monkeypatch):
    from robot_790d import sts_page_server as server
    handler = object.__new__(server.StsPageHandler)
    sizes, replies = [], []
    handler._read_json_body = lambda max_bytes: sizes.append(max_bytes) or {"instructions": "Eric"}
    handler._send_json = lambda code, data: replies.append((code, data))
    monkeypatch.setattr(server, "runtime_config", lambda: {"connection_context": {}})
    monkeypatch.setattr(server, "measure_connection", lambda payload, config: cc.budget_receipt(100, 65536, config))
    handler._handle_connection_context("/api/context/measure")
    assert sizes == [2_000_000]
    assert replies[-1][0] == 200 and replies[-1][1]["fits"]
    def fail(*args):
        raise ValueError("Model unavailable")
    monkeypatch.setattr(server, "measure_connection", fail)
    handler._handle_connection_context("/api/context/measure")
    assert replies[-1][0] == 400 and "Model unavailable" in replies[-1][1]["error"]

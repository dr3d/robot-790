import json

import pytest

from robot_790d import continuity as c
from robot_790d.note_files import read_note_file, resolve_note_path, write_note_file

SNAPSHOT = {"input_tokens": 48123, "context_window_tokens": 65536,
            "observed_at": "2026-09-20T16:40:00.000Z", "model": "qwen-test"}


def test_saved_context_is_frozen_metadata_not_transcript_or_pinned_memory(tmp_path):
    result = c.save_continuity_session("Conversation.", [], tmp_path, context_at_save=SNAPSHOT)
    name = result["session_filename"]
    source = read_note_file(tmp_path, name)
    metadata = json.loads(read_note_file(tmp_path, c.continuity_session_context_filename(name)).content)
    assert "48123" not in source.content
    assert "context_at_save" not in source.content
    assert metadata["version"] == 1
    assert metadata["context_at_save"]["input_tokens"] == 48123
    assert metadata["context_at_save"]["context_window_tokens"] == 65536
    assert metadata["context_at_save"]["model"] == "qwen-test"
    assert c.list_continuity_sessions(tmp_path)["sessions"][0]["context_at_save"] == result["context_at_save"]
    assert c.select_continuity_session(name, tmp_path)["context_at_save"] == result["context_at_save"]
    assert result["pinned_notes"] == []


@pytest.mark.parametrize("snapshot", [None, {}, [], {"input_tokens": True}, {"input_tokens": "500"},
                                      {"input_tokens": 0}, {"input_tokens": -1}, {"input_tokens": 1.5}])
def test_missing_or_invalid_measurement_never_invents_percentage_or_blocks_save(tmp_path, snapshot):
    result = c.save_continuity_session("Conversation.", [], tmp_path, context_at_save=snapshot)
    assert result["status"] == "ok"
    assert result["context_at_save"] is None
    assert c.list_continuity_sessions(tmp_path)["sessions"][0]["context_at_save"] is None
    assert not resolve_note_path(c.continuity_session_context_filename(result["session_filename"]), tmp_path).exists()


def test_unknown_window_retains_tokens_but_cannot_claim_a_percentage(tmp_path):
    result = c.save_continuity_session("Conversation.", [], tmp_path,
                                       context_at_save={"input_tokens": 48123, "context_window_tokens": "65536",
                                                        "observed_at": "bad time", "model": 3})
    assert result["context_at_save"]["input_tokens"] == 48123
    assert result["context_at_save"]["context_window_tokens"] is None
    assert result["context_at_save"]["observed_at"] is None
    assert result["context_at_save"]["model"] == ""


def test_changed_session_or_corrupt_receipt_does_not_reuse_stale_context(tmp_path):
    result = c.save_continuity_session("Conversation.", [], tmp_path, context_at_save=SNAPSHOT)
    name = result["session_filename"]
    source = read_note_file(tmp_path, name)
    write_note_file(tmp_path, name, source.content + "\nEdited.")
    assert c.list_continuity_sessions(tmp_path)["sessions"][0]["context_at_save"] is None
    write_note_file(tmp_path, name, source.content)
    write_note_file(tmp_path, c.continuity_session_context_filename(name), "not JSON")
    assert c.list_continuity_sessions(tmp_path)["sessions"][0]["context_at_save"] is None


def test_ctx_receipt_archives_with_its_session_without_dangling_file(tmp_path):
    c.save_continuity_session("Keep this one.", [], tmp_path, filename_timestamp="20260920-110000")
    saved = c.save_continuity_session("Archive this one.", [], tmp_path, context_at_save=SNAPSHOT,
                                      filename_timestamp="20260920-120000")
    sidecar = c.continuity_session_context_filename(saved["session_filename"])
    archived = c.archive_continuity_session(saved["session_filename"], tmp_path)
    receipts = [name for name in archived["archived_variant_filenames"] if name.endswith(".context.json")]
    assert len(receipts) == 1
    assert not resolve_note_path(sidecar, tmp_path).exists()
    assert json.loads(read_note_file(tmp_path, receipts[0]).content)["context_at_save"]["input_tokens"] == 48123


def test_receipt_write_failure_does_not_make_saved_transcript_look_unsaved(tmp_path, monkeypatch):
    original = c.write_note_file
    def write(instance, filename, content):
        if filename.endswith(".context.json"):
            raise OSError("receipt disk error")
        return original(instance, filename, content)
    monkeypatch.setattr(c, "write_note_file", write)
    result = c.save_continuity_session("Conversation.", [], tmp_path, context_at_save=SNAPSHOT)
    assert result["status"] == "ok"
    assert "receipt disk error" in result["context_at_save_warning"]
    assert "Conversation." in read_note_file(tmp_path, result["session_filename"]).content
    assert result["context_at_save"] is None


def test_save_endpoint_forwards_existing_usage_without_model_work(monkeypatch):
    from robot_790d import sts_page_server as server
    handler = object.__new__(server.StsPageHandler)
    received, replies = {}, []
    handler._read_json_body = lambda: {"body": "Conversation.", "context_at_save": SNAPSHOT}
    handler._send_json = lambda code, payload: replies.append((code, payload))
    def save(body, pins, **kwargs):
        received.update(kwargs)
        return {"status": "ok", "session_filename": "sessions/test.txt"}
    monkeypatch.setattr(server, "save_continuity_session", save)
    monkeypatch.setattr(server.session_preparer, "enqueue", lambda name: {"state": "queued"})
    handler._handle_continuity_save()
    assert received["context_at_save"] == SNAPSHOT
    assert replies[0][0] == 200

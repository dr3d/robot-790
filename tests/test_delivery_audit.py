import json
from datetime import datetime, timedelta, timezone

from robot_790d import delivery_audit as a
from robot_790d import request_diagnostics as d


def configure(path, texts):
    value = {"version": 1, "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
             "targets": [{"source_filename": "private-name.txt", "text": text} for text in texts]}
    (path / "delivery-audit.json").write_text(json.dumps(value), encoding="utf-8")
    return value


def test_full_body_presence_location_and_privacy(tmp_path):
    configure(tmp_path, ["PRIVATE first\r\nPRIVATE last\n", "MISSING BODY"])
    messages = [{"role": "system", "content": "prefix\nPRIVATE first\nPRIVATE last\nsuffix"}]
    before = json.dumps(messages)
    result = a.audit_delivery(tmp_path, messages)
    assert result["status"] == "checked"
    found, missing = result["targets"]
    assert found["present"] and found["sha256"] == a.digest("PRIVATE first\nPRIVATE last")
    assert found["locations"] == [{"message_index": 0, "role": "system", "part_index": 0, "character_offset": 7}]
    assert not missing["present"]
    assert all(secret not in json.dumps(result) for secret in ("PRIVATE", "MISSING", "private-name"))
    assert json.dumps(messages) == before


def test_no_false_match_across_messages_or_image_bytes(tmp_path):
    configure(tmp_path, ["whole note", "SECRET IMAGE"])
    messages = [{"role": "system", "content": "whole "}, {"role": "user", "content": [
        {"type": "text", "text": "note"},
        {"type": "image_url", "image_url": {"url": "SECRET IMAGE"}},
    ]}]
    assert not any(r["present"] for r in a.audit_delivery(tmp_path, messages)["targets"])


def test_truncation_and_modified_note_do_not_pass(tmp_path):
    configure(tmp_path, ["begin middle end"])
    for content in ("begin middle", "begin changed end"):
        assert not a.audit_delivery(tmp_path, [{"role": "system", "content": content}])["targets"][0]["present"]


def test_order_and_role_report_without_merging_parts(tmp_path):
    configure(tmp_path, ["newer", "older"])
    result = a.audit_delivery(tmp_path, [{"role": "system", "content": "older | newer"},
                                        {"role": "tool", "content": [{"type": "text", "text": "newer"}]}])
    new, old = result["targets"]
    assert new["locations"][0]["character_offset"] > old["locations"][0]["character_offset"]
    assert new["locations"][1]["role"] == "tool"


def test_missing_expired_malformed_or_oversized_is_safe(tmp_path):
    assert a.audit_delivery(tmp_path, []) is None
    value = configure(tmp_path, ["body"])
    value["expires_at"] = "2000-01-01T00:00:00+00:00"
    path = tmp_path / "delivery-audit.json"
    path.write_text(json.dumps(value))
    assert a.audit_delivery(tmp_path, []) is None
    for content in ("not json", "x" * (a.MAX_BYTES + 1), json.dumps({**value, "expires_at": "bad"})):
        path.write_text(content)
        assert a.audit_delivery(tmp_path, []) == {"status": "unavailable"}


def test_capture_and_b1_gates(tmp_path, monkeypatch):
    monkeypatch.setenv("ROBOT_790_METRICS_DIR", str(tmp_path))
    monkeypatch.setattr(d, "capture_active", lambda _: True)
    rows, calls = [], []
    monkeypatch.setattr(d, "_write", lambda _, row: rows.append(row))
    monkeypatch.setattr(d, "audit_delivery", lambda *args: calls.append(args) or {"status": "checked"})
    args = {"owner": "audit-test", "model": "m", "messages": [], "options": {}}
    d.begin_request("a", family="B1", **args)
    d.begin_request("b", family="B2", **args)
    assert len(calls) == 1
    assert rows[0]["delivery_audit"]["status"] == "checked"
    assert "delivery_audit" not in rows[1]
    monkeypatch.setattr(d, "capture_active", lambda _: False)
    assert d.begin_request("c", family="B1", **args) is None
    assert len(calls) == 1


def test_prepare_uses_history_without_changing_selection(tmp_path, monkeypatch):
    from robot_790d import continuity, context_history, sts_page_server

    monkeypatch.setattr(continuity, "select_continuity_session", lambda name: {"session_filename": name})
    monkeypatch.setattr(sts_page_server, "runtime_config", lambda: {"context_history": {"use_summaries": False}})
    monkeypatch.setattr(context_history, "context_history_plan", lambda selection, **config: {
        "history_notes": [{"filename": selection["session_filename"], "content": "full history\n"}]})
    result = a.prepare("sessions/example.txt", tmp_path)
    assert result["targets"][0]["source_filename"] == "sessions/example.txt"
    assert result["targets"][0]["sha256"] == a.digest("full history")
    assert a.audit_delivery(tmp_path, [{"role": "system", "content": "full history"}])["targets"][0]["present"]

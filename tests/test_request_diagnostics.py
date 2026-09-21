import json
from datetime import datetime, timedelta, timezone

from robot_790d import request_diagnostics as d


def enable(tmp_path, monkeypatch):
    monkeypatch.setenv("ROBOT_790_METRICS_DIR", str(tmp_path))
    now = datetime.now(timezone.utc)
    (tmp_path / "status.json").write_text(json.dumps({
        "state": "recording", "updated_at": now.isoformat(), "started_at": now.isoformat(), "max_hours": 1,
    }))


def test_shapes_expose_changes_without_content_or_mutation():
    messages = [{"role": "system", "content": "PRIVATE IDENTITY"}, {"role": "user", "content": [
        {"type": "text", "text": "SECRET WORDS"},
        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,PRIVATE IMAGE"}},
    ]}]
    options = {"tools": [{"description": "PRIVATE TOOL"}], "temperature": .8}
    original = json.dumps([messages, options])
    shape, hashes = d.request_shape(messages, options)
    assert shape["messages"] == 2 and shape["image_parts"] == 1
    assert shape["tool_count"] == 1
    assert all(len(h) == 64 for h in hashes)
    assert "PRIVATE" not in json.dumps(shape) and "SECRET" not in json.dumps(shape)
    assert json.dumps([messages, options]) == original
    changed, _ = d.request_shape(messages, {**options, "temperature": 1})
    assert changed["options_sha256"] != shape["options_sha256"]
    assert changed["messages_sha256"] == shape["messages_sha256"]


def test_receipts_match_request_usage_and_detect_history_shrink(tmp_path, monkeypatch):
    enable(tmp_path, monkeypatch)
    rows = []
    monkeypatch.setattr(d, "_write", lambda directory, row: rows.append(row))
    kwargs = {"family": "B1", "owner": "connection", "model": "model", "options": {}}
    first = [{"role": "system", "content": "identity"}, {"role": "user", "content": "older"}]
    d.begin_request("a", messages=first, **kwargs)
    ticket = d.begin_request("b", messages=first + [{"role": "assistant", "content": "new"}], **kwargs)
    d.finish_request(ticket, outcome="completed", input_tokens=80000, output_tokens=4)
    d.begin_request("c", messages=first[:1], **kwargs)
    assert rows[1]["common_prefix_messages"] == 2
    assert rows[2]["request_id"] == "b" and rows[2]["input_tokens"] == 80000
    assert rows[3]["message_count_delta"] == -2
    assert rows[3]["common_prefix_messages"] == 1
    assert rows[3]["previous_request_id"] == "b"


def test_off_expired_stale_or_failed_capture_does_no_request_work(tmp_path, monkeypatch):
    monkeypatch.setenv("ROBOT_790_METRICS_DIR", str(tmp_path))
    monkeypatch.setattr(d, "request_shape", lambda *args: (_ for _ in ()).throw(AssertionError("hashed")))
    kwargs = {"family": "B1", "owner": "c", "model": "m", "messages": [], "options": {}}
    assert d.begin_request("a", **kwargs) is None
    for field, value in (("state", "stopped"), ("updated_at", "2000-01-01T00:00:00+00:00"),
                         ("started_at", (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat())):
        enable(tmp_path, monkeypatch)
        status = json.loads((tmp_path / "status.json").read_text())
        status[field] = value
        (tmp_path / "status.json").write_text(json.dumps(status))
        assert d.begin_request("a", **kwargs) is None


def test_diagnostic_failure_does_not_block_generation(tmp_path, monkeypatch):
    enable(tmp_path, monkeypatch)
    monkeypatch.setattr(d, "_write", lambda *args: (_ for _ in ()).throw(OSError("disk full")))
    assert d.begin_request("a", family="B1", owner="c", model="m", messages=[], options={}) is None
    d.finish_request({"directory": tmp_path, "request_id": "a", "started": 0}, outcome="failed")

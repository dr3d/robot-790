import json
import os
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace as NS

import pytest

from robot_790d import provider_output_capture as c


def arm(tmp_path, monkeypatch, **updates):
    config = {"version": 1, "arm_id": tmp_path.name,
              "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()}
    config.update(updates)
    (tmp_path / "provider-output-capture.json").write_text(json.dumps(config))
    monkeypatch.setattr(c, "_ARM", None)
    monkeypatch.setattr(c, "_COUNT", 0)
    return {"directory": tmp_path}


def chunk(**fields):
    return NS(choices=[NS(delta=NS(**fields), finish_reason=None)], usage=None)


def test_disabled_capture_does_not_touch_provider_or_write(tmp_path, monkeypatch):
    assert c.begin_output_capture("x", ticket=None, stream=True) is None
    assert c.begin_output_capture("x", ticket={"directory": tmp_path}, stream=True) is None
    for content in ["invalid", "[]", "{}", "x" * 4097]:
        (tmp_path / "provider-output-capture.json").write_text(content)
        assert c.begin_output_capture("x", ticket={"directory": tmp_path}, stream=True) is None


@pytest.mark.parametrize("expiry", ["2000-01-01T00:00:00+00:00", "2000-01-01", "invalid",
                                      "2999-01-01T00:00:00+00:00"])
def test_expired_naive_and_invalid_config_is_off(tmp_path, monkeypatch, expiry):
    ticket = arm(tmp_path, monkeypatch, expires_at=expiry)
    assert c.begin_output_capture("x", ticket=ticket, stream=True) is None


def test_raw_field_order_split_tags_and_original_objects_survive(tmp_path, monkeypatch):
    ticket = arm(tmp_path, monkeypatch)
    rows = []
    monkeypatch.setattr(c, "_write", lambda directory, row: rows.append(row))
    cap = c.begin_output_capture("receipt", ticket=ticket, stream=True,
                                 extra_body={"reasoning_effort": "none", "secret": "NO"})
    chunks = [chunk(content="<thi"), chunk(content="nk>private"),
              chunk(reasoning_content="separate", tool_calls=[{"arguments": "SECRET TOOL"}]),
              chunk(content="</think>Answer"), chunk(refusal="refusal", reasoning="other")]
    result = list(cap.wrap(iter(chunks)))
    assert all(original is observed for original, observed in zip(chunks, result))
    cap.finish("completed")
    cap.finish("completed")
    assert len(rows) == 1
    row = rows[0]
    assert row["request_id"] == "receipt" and row["reasoning_effort"] == "none"
    assert [item["sequence"] for item in row["chunks"]] == [1, 2, 3, 4, 5]
    assert "".join(item["fields"].get("content", "") for item in row["chunks"]) == "<think>private</think>Answer"
    assert row["chunks"][2]["fields"] == {"reasoning_content": "separate"}
    assert "SECRET" not in json.dumps(row) and "secret" not in json.dumps(row)


def test_character_chunk_and_request_bounds_do_not_truncate_actual_response(tmp_path, monkeypatch):
    ticket = arm(tmp_path, monkeypatch)
    cap = c.begin_output_capture("x", ticket=ticket, stream=True)
    big = chunk(content="x" * (c.MAX_CHARACTERS + 50))
    assert list(cap.wrap([big])) == [big]
    assert cap.row["truncated"]
    assert cap.characters == c.MAX_CHARACTERS
    assert cap.row["field_characters"]["content"] == c.MAX_CHARACTERS + 50
    monkeypatch.setattr(c, "MAX_CHUNKS", 2)
    cap = c.begin_output_capture("y", ticket=ticket, stream=True)
    assert len(list(cap.wrap([chunk(content="x") for _ in range(5)]))) == 5
    assert len(cap.row["chunks"]) == 2 and cap.row["truncated"]
    for _ in range(c.MAX_REQUESTS - 2):
        assert c.begin_output_capture("z", ticket=ticket, stream=True) is not None
    assert c.begin_output_capture("over", ticket=ticket, stream=True) is None


def test_nonstream_expiry_and_io_failure_preserve_response(tmp_path, monkeypatch, caplog):
    ticket = arm(tmp_path, monkeypatch)
    cap = c.begin_output_capture("x", ticket=ticket, stream=False,
                                 extra_body={"chat_template_kwargs": {"enable_thinking": False}})
    response = {"choices": [{"message": {"content": "answer", "reasoning_content": "private"},
                             "finish_reason": "stop"}]}
    assert cap.wrap(response) is response
    assert cap.row["enable_thinking"] is False
    assert cap.row["finish_reasons"] == ["stop"]
    cap.expires = datetime.now(timezone.utc) - timedelta(seconds=1)
    cap.observe(response)
    assert cap.row["truncated"] and len(cap.row["chunks"]) == 1
    monkeypatch.setattr(c, "_write", lambda *_: (_ for _ in ()).throw(OSError("full")))
    cap.finish("cancelled")
    assert "sample not saved" in caplog.text
    assert "OSError" in caplog.text
    assert "private" not in caplog.text


def test_provider_exception_propagates_unchanged_and_partial_sample_is_kept(tmp_path, monkeypatch):
    cap = c.begin_output_capture("x", ticket=arm(tmp_path, monkeypatch), stream=True)
    error = RuntimeError("provider disconnected")
    def source():
        yield chunk(content="partial")
        raise error
    with pytest.raises(RuntimeError) as caught:
        list(cap.wrap(source()))
    assert caught.value is error
    assert cap.row["chunks"][0]["fields"]["content"] == "partial"


def test_real_provider_adapter_captures_before_private_filter_without_changing_output(tmp_path, monkeypatch):
    from speech_to_speech.LLM.chat_completions_language_model import (
        ChatCompletionsApiModelHandler as Handler, _iter_chat_stream_events)
    from robot_790d import realtime_entry as entry

    arm(tmp_path, monkeypatch)
    monkeypatch.setenv("ROBOT_790_METRICS_DIR", str(tmp_path))
    now = datetime.now(timezone.utc).isoformat()
    (tmp_path / "status.json").write_text(json.dumps({
        "state": "recording", "updated_at": now, "started_at": now, "max_hours": 1}))
    def generate(self, active, original, turn, options, **kwargs):
        yield from kwargs["request_fn"]([], options)
    monkeypatch.setattr(Handler, "_generate", generate)
    monkeypatch.setattr(Handler, "_robot_790_interruptible_generation_patch", False, raising=False)
    entry.apply_interruptible_chat_generation_patch()
    handler = object.__new__(Handler)
    handler.stream = True
    handler._generation_is_stale = lambda _: False
    handler._turn_is_latest = lambda *_: True
    handler._request = lambda *_: iter([
        chunk(content="<think>PRIVATE", tool_calls=None, refusal=None),
        chunk(content="</think>Public answer.", tool_calls=None, refusal=None)])
    handler._iter_events = lambda response: entry._filter_private_advisory_events(_iter_chat_stream_events(response))
    turn = NS(response=None, gen=1, turn_id="turn", turn_revision=0)
    result = list(handler._generate(None, None, turn, {}))
    assert "PRIVATE" not in str(result)
    assert "Public answer." in str(result)
    rows = [json.loads(line) for line in (tmp_path / f"provider-output-{os.getpid()}.jsonl").read_text().splitlines()]
    assert len(rows) == 1 and "PRIVATE" in json.dumps(rows)
    receipts = [json.loads(line) for line in (tmp_path / f"requests-{os.getpid()}.jsonl").read_text().splitlines()]
    assert rows[0]["request_id"] == receipts[0]["request_id"]
    status = c.saved_capture_status(tmp_path)
    assert status[0]["status"] == "verified" and status[0]["records"] == 1
    assert status[0]["think_tag_records"] == 1
    assert "PRIVATE" not in json.dumps(status) and "Public answer" not in json.dumps(status)


def test_status_reads_bytes_and_reports_invalid_or_empty_files(tmp_path):
    path = tmp_path / "provider-output-test.jsonl"
    path.write_text("")
    assert c.saved_capture_status(tmp_path)[0]["status"] == "empty"
    path.write_text("not-json")
    assert c.saved_capture_status(tmp_path)[0]["status"] == "unavailable"

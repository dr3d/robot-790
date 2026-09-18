import json
import logging
from types import SimpleNamespace

from robot_790d.brain_status import _parse_context, _parse_latest_request_usage, get_brain_status


def test_context_uses_one_request_not_accumulated_response_totals():
    records = [
        {"request_id": "old", "input_tokens": 63292, "output_tokens": 45},
        {"request_id": "current", "input_tokens": 63127, "output_tokens": 211},
    ]
    log = "\n".join("INFO - B1 request usage: " + json.dumps(record) for record in records)
    log += '\nB1 request usage: {"incomplete":'
    usage = _parse_latest_request_usage(log)
    context = _parse_context({"input_tokens": 126419}, {}, {"context_window_tokens": 131072}, usage)
    assert usage == records[-1]
    assert context["last_input_tokens"] == 63127
    assert context["window_usage_percent"] == 48.2
    assert context["source"] == "provider_request_usage"
    assert context["request_id"] == "current"


def test_empty_or_invalid_usage_keeps_labeled_legacy_fallback():
    for payload in ['null', '[]', '{"request_id":"x","input_tokens":0}',
                    '{"request_id":"x","input_tokens":true}',
                    '{"request_id":"x","input_tokens":200,"conversation":"none"}', '{}']:
        assert _parse_latest_request_usage("B1 request usage: " + payload) == {}
    context = _parse_context({"input_tokens": 35000}, {}, request_usage={})
    assert context["last_input_tokens"] == 35000
    assert context["source"] == "legacy_response_usage"
    assert "accumulated" in context["pressure_basis"]


def test_status_endpoint_path_exposes_request_context_not_cancelled_response(monkeypatch, tmp_path):
    import robot_790d.brain_status as status

    monkeypatch.setattr(status, "_read_realtime_runtime_args", lambda _: {})
    monkeypatch.setattr(status, "_read_lm_studio_status", lambda _: {
        "active_model": {"context_window_tokens": 131072}})
    monkeypatch.setattr(status, "get_gpu_status", lambda: {})
    logs = tmp_path / "logs"
    logs.mkdir()
    (logs / "sts-realtime.err.log").write_text(
        'B1 request usage: {"request_id":"measured","input_tokens":63127,"output_tokens":211}\n'
        'Response done (status=completed) - this response: input_tokens=126419, output_tokens=256, '
        'audio=0.00s | cumulative: input_tokens=126419, output_tokens=256, audio=0.00s\n'
        'Response done (status=cancelled) - this response: input_tokens=0, output_tokens=0, '
        'audio=0.00s | cumulative: input_tokens=126419, output_tokens=256, audio=0.00s\n', encoding="utf-8")
    result = get_brain_status(tmp_path)
    assert result["context"]["window_usage_percent"] == 48.2
    assert result["latest_request"]["request_id"] == "measured"
    assert result["latest_response"]["status"] == "cancelled"
    assert not any("previous measured response" in note for note in result["notes"])


def test_provider_usage_has_unique_request_identity_and_ignores_cancelled_events(monkeypatch, caplog):
    from speech_to_speech.LLM.base_openai_compatible_language_model import Usage
    from speech_to_speech.LLM.chat_completions_language_model import ChatCompletionsApiModelHandler as Handler

    from robot_790d.realtime_entry import apply_interruptible_chat_generation_patch

    def generate(self, active, original, turn, options, **kwargs):
        yield from kwargs["request_fn"]([], options)

    monkeypatch.setattr(Handler, "_generate", generate)
    monkeypatch.setattr(Handler, "_robot_790_interruptible_generation_patch", False, raising=False)
    apply_interruptible_chat_generation_patch()
    handler = object.__new__(Handler)
    cancelled = False
    handler._generation_is_stale = lambda _: cancelled
    handler._turn_is_latest = lambda *_: True
    handler._request = lambda *_: None
    handler._iter_events = lambda _: iter([Usage(input_tokens=63127, output_tokens=211)])
    turn = SimpleNamespace(response=None, gen=7, turn_id="turn_1", turn_revision=2)
    with caplog.at_level(logging.INFO, logger="robot_790d.realtime_entry"):
        for _ in range(2):
            list(handler._generate(None, None, turn, {}))
        # Cancel after the provider iterator starts, before yielding its usage.
        def stale_events(_):
            nonlocal cancelled
            cancelled = True
            yield Usage(input_tokens=99999, output_tokens=12)
        handler._iter_events = stale_events
        list(handler._generate(None, None, turn, {}))
    messages = [record.getMessage() for record in caplog.records if "B1 request usage: " in record.getMessage()]
    assert len(messages) == 2
    records = [_parse_latest_request_usage(message) for message in messages]
    assert records[0]["request_id"] != records[1]["request_id"]
    assert all(record["input_tokens"] == 63127 and record["generation"] == 7 for record in records)
    assert records[0]["turn_id"] == "turn_1"
    assert records[0]["turn_revision"] == 2

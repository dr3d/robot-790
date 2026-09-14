import json
from types import SimpleNamespace

import numpy as np
import pytest

from robot_790d.realtime_entry import (
    _append_voice_shape_to_transcript,
    _capture_llm_wire_request,
    _chat_text_max_tokens_from_env,
    _b1_temperature_from_env,
    _filter_private_advisory_events,
    _PrivateAdvisoryTextFilter,
    _runtime_tts_instruct,
    _strip_voice_shape_from_transcript,
    _voice_shape_from_transcript,
    _voice_shape_summary,
)


def test_auxiliary_temperatures_are_pinned_without_changing_request_contract(monkeypatch):
    from speech_to_speech.LLM.chat_completions_language_model import ChatCompletionsApiModelHandler as Handler
    from speech_to_speech.LLM.base_openai_compatible_language_model import WARMUP_MAX_RETRIES
    from robot_790d.realtime_entry import apply_chat_auxiliary_temperature_patch

    monkeypatch.setattr(Handler, "warmup", Handler.warmup)
    monkeypatch.setattr(Handler, "_build_compaction_generate_fn", Handler._build_compaction_generate_fn)
    monkeypatch.setattr(Handler, "_robot_790_auxiliary_temperature_patch", False, raising=False)
    monkeypatch.setenv("ROBOT_790_B1_TEMPERATURE", "1.3")
    apply_chat_auxiliary_temperature_patch()
    warmup = Handler.warmup
    apply_chat_auxiliary_temperature_patch()
    assert Handler.warmup is warmup
    received, retries = [], []
    response = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="condensed"))])
    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(
        create=lambda **kwargs: received.append(kwargs) or response)))
    client.with_options = lambda **kwargs: retries.append(kwargs) or client
    handler = object.__new__(Handler)
    handler.client = client
    handler.model_name = "same-model"
    handler.request_timeout = 17
    handler._extra_body = {"reasoning_effort": "none"}
    handler.warmup()
    generate = handler._build_compaction_generate_fn()
    assert generate("existing compaction prompt", "existing transcript") == "condensed"
    response.choices[0].message.content = None
    assert generate("system", "user") == ""
    assert retries == [{"max_retries": WARMUP_MAX_RETRIES}]
    assert received[0]["messages"] == [
        {"role": "system", "content": "You are a helpful assistant"},
        {"role": "user", "content": "Hello"}]
    assert received[1]["messages"] == [
        {"role": "system", "content": "existing compaction prompt"},
        {"role": "user", "content": "existing transcript"}]
    for request in received:
        assert request["temperature"] == 0.8
        assert request["model"] == "same-model"
        assert request["timeout"] == 17
        assert request["extra_body"] == {"reasoning_effort": "none"}
        assert "top_p" not in request
        assert "top_k" not in request


def test_b1_temperature_default_and_override(monkeypatch):
    monkeypatch.delenv("ROBOT_790_B1_TEMPERATURE", raising=False)
    assert _b1_temperature_from_env() == 0.8
    for value in [0, 0.3, 1.3, 2]:
        monkeypatch.setenv("ROBOT_790_B1_TEMPERATURE", str(value))
        assert _b1_temperature_from_env() == value


@pytest.mark.parametrize("value", ["", "hot", "nan", "inf", "-0.1", "2.1"])
def test_b1_temperature_rejects_invalid_setting(monkeypatch, value):
    monkeypatch.setenv("ROBOT_790_B1_TEMPERATURE", value)
    with pytest.raises(ValueError, match="ROBOT_790_B1_TEMPERATURE"):
        _b1_temperature_from_env()


@pytest.mark.parametrize("explicit", [None, 0.0, 1.2])
def test_b1_temperature_reaches_provider_request(monkeypatch, explicit):
    from speech_to_speech.LLM.chat_completions_language_model import ChatCompletionsApiModelHandler as Handler
    from robot_790d.realtime_entry import apply_interruptible_chat_generation_patch

    def generate(self, active, original, turn, options, **kwargs):
        yield from kwargs["request_fn"]([], options)

    monkeypatch.setattr(Handler, "_generate", generate)
    monkeypatch.setattr(Handler, "_robot_790_interruptible_generation_patch", False, raising=False)
    monkeypatch.delenv("ROBOT_790_B1_TEMPERATURE", raising=False)
    apply_interruptible_chat_generation_patch()
    received = []
    handler = object.__new__(Handler)
    handler.client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(
        create=lambda **kwargs: received.append(kwargs) or iter([]))))
    handler.model_name = "test"
    handler.stream = True
    handler._extra_body = None
    handler.request_timeout = 10
    handler._iter_events = iter
    handler._generation_is_stale = lambda _: False
    handler._turn_is_latest = lambda *_: True
    turn = SimpleNamespace(response=None, gen=0, turn_id=None, turn_revision=None)
    options = {"tool_choice": "auto"}
    if explicit is not None:
        options["temperature"] = explicit
    list(handler._generate(None, None, turn, options))
    assert received[0]["temperature"] == (0.8 if explicit is None else explicit)
    assert received[0]["tool_choice"] == "auto"


@pytest.mark.parametrize("marker", ["[B2 advisory]", "[STS runtime]"])
@pytest.mark.parametrize("split", range(len("[B2 advisory]") + 1))
def test_private_advisory_filter_handles_every_marker_split(split, marker) -> None:
    guard = _PrivateAdvisoryTextFilter()
    output = "".join(guard.feed(part) for part in [
        "Yes, I hear you. ", marker[:split], marker[split:],
        "Current snapshot. Brain 2 loop pressure is YELLOW. More private text.",
    ]) + guard.finish()
    assert output == "Yes, I hear you. "
    assert guard.blocked


def test_private_advisory_filter_handles_single_character_chunks_and_case() -> None:
    guard = _PrivateAdvisoryTextFilter()
    output = "".join(guard.feed(char) for char in "Hello.[b2 ADVISORY] secret") + guard.finish()
    assert output == "Hello."
    assert guard.blocked


@pytest.mark.parametrize("text", [
    "Brain 2 is an advisory process. I can explain how it works.",
    "Loop pressure means repetition; that is what you asked about.",
    "Here is a list: [one, two]. A [B2 battery] is not a protocol marker.",
    "An unfinished bracket [",
    "Regular conversation without punctuation",
    "",
])
def test_private_advisory_filter_preserves_ordinary_text(text) -> None:
    guard = _PrivateAdvisoryTextFilter()
    assert "".join(guard.feed(char) for char in text) + guard.finish() == text
    assert not guard.blocked


def test_private_advisory_events_filter_speech_and_history_but_preserve_tools_and_usage(caplog) -> None:
    pytest.importorskip("speech_to_speech.LLM.base_openai_compatible_language_model")
    from openai.types.realtime.realtime_conversation_item_assistant_message import Content
    from openai.types.responses import ResponseFunctionToolCall
    from speech_to_speech.LLM.base_openai_compatible_language_model import (
        AssistantMessage,
        TextDelta,
        ToolCall,
        Usage,
    )

    raw = "Yes. [B2 advisory]\nprivate snapshot"
    tool = ToolCall(item=ResponseFunctionToolCall(
        type="function_call", name="get_brain_status", arguments="{}", call_id="call_test",
    ))
    usage = Usage(input_tokens=10, output_tokens=20)
    events = iter([
        TextDelta(text="Yes. [B2"), TextDelta(text=" advisory]\nprivate snapshot"),
        AssistantMessage(content=[Content(type="output_text", text=raw)]), tool, usage,
    ])
    filtered = list(_filter_private_advisory_events(events))
    assert "".join(event.text for event in filtered if isinstance(event, TextDelta)) == "Yes. "
    history = [event for event in filtered if isinstance(event, AssistantMessage)]
    assert len(history) == 1
    assert "".join(part.text for part in history[0].content) == "Yes. "
    assert filtered[-2] is tool
    assert filtered[-1] is usage
    assert "Suppressed private controller output" in caplog.text
    assert "private snapshot" not in caplog.text


def test_private_advisory_filter_patches_streaming_and_nonstreaming_once(monkeypatch) -> None:
    pytest.importorskip("speech_to_speech.LLM.base_openai_compatible_language_model")
    from openai.types.realtime.realtime_conversation_item_assistant_message import Content
    from speech_to_speech.LLM.base_openai_compatible_language_model import AssistantMessage, TextDelta, Usage
    from speech_to_speech.LLM.chat_completions_language_model import ChatCompletionsApiModelHandler as Handler

    from robot_790d.realtime_entry import apply_private_advisory_output_patch

    raw = "[B2 advisory] all private"
    def events(_self, _response):
        yield TextDelta(text=raw)
        yield AssistantMessage(content=[Content(type="output_text", text=raw)])
        yield Usage(input_tokens=1, output_tokens=5)

    monkeypatch.setattr(Handler, "_iter_stream_events", events)
    monkeypatch.setattr(Handler, "_iter_response_events", events)
    monkeypatch.setattr(Handler, "_robot_790_private_advisory_patch", False, raising=False)
    apply_private_advisory_output_patch()
    patched = Handler._iter_stream_events
    apply_private_advisory_output_patch()
    assert Handler._iter_stream_events is patched
    for method in [Handler._iter_stream_events, Handler._iter_response_events]:
        with pytest.raises(RuntimeError, match="robot790_private_output_suppressed"):
            list(method(None, None))


@pytest.mark.parametrize("raw, expected", [
    ("Hello. [B2 advisory] private", "Hello. "),
    ("[B2 advisory] private", ""),
    ("Brain 2 can suggest a correction.", "Brain 2 can suggest a correction."),
    ("A bracket [", "A bracket ["),
])
def test_private_advisory_filter_handles_real_nonstream_event_order(raw, expected) -> None:
    pytest.importorskip("speech_to_speech.LLM.base_openai_compatible_language_model")
    from speech_to_speech.LLM.base_openai_compatible_language_model import AssistantMessage, TextDelta, Usage
    from speech_to_speech.LLM.chat_completions_language_model import _iter_chat_response_events

    response = SimpleNamespace(
        usage=SimpleNamespace(prompt_tokens=10, completion_tokens=20),
        choices=[SimpleNamespace(message=SimpleNamespace(content=raw, tool_calls=[]))],
    )
    if not expected:
        with pytest.raises(RuntimeError, match="robot790_private_output_suppressed"):
            list(_filter_private_advisory_events(_iter_chat_response_events(response)))
        return
    filtered = list(_filter_private_advisory_events(_iter_chat_response_events(response)))
    assert isinstance(filtered[0], Usage)
    assert "".join(event.text for event in filtered if isinstance(event, TextDelta)) == expected
    assert "".join(
        part.text for event in filtered if isinstance(event, AssistantMessage) for part in event.content
    ) == expected


@pytest.mark.parametrize("retry_error,cancelled", [(False, False), (True, False), (True, True)])
def test_fully_filtered_recovery_is_bounded_local_and_cancellable(monkeypatch, retry_error, cancelled):
    from speech_to_speech.LLM.chat import Chat, make_user_message
    from speech_to_speech.LLM.chat_completions_language_model import ChatCompletionsApiModelHandler as Handler
    from speech_to_speech.pipeline.messages import EndOfResponse

    from robot_790d.realtime_entry import PRIVATE_OUTPUT_SUPPRESSED, apply_interruptible_chat_generation_patch

    calls = []
    def generate(self, active, original, turn, options, **kwargs):
        calls.append(active)
        error = PRIVATE_OUTPUT_SUPPRESSED if len(calls) == 1 or retry_error else None
        yield EndOfResponse(error=error)

    monkeypatch.setattr(Handler, "_generate", generate)
    monkeypatch.setattr(Handler, "_robot_790_interruptible_generation_patch", False, raising=False)
    apply_interruptible_chat_generation_patch()
    handler = object.__new__(Handler)
    handler._generation_is_stale = lambda _: cancelled
    handler._turn_is_latest = lambda *_: True
    turn = SimpleNamespace(response=None, gen=0, turn_id=None, turn_revision=None)
    active = Chat(0)
    active.add_item(make_user_message("Tell me about that idea."))
    output = list(handler._generate(active, active, turn, {}))
    assert len(calls) == (1 if cancelled else 2)
    assert len(output) == 1
    assert bool(output[0].error) == (retry_error or cancelled)
    assert len(active.buffer) == 1
    if not cancelled:
        assert calls[1] is not active
        assert len(calls[1].buffer) == 2
        assert "STS response recovery" in calls[1].buffer[-1].content[0].text


def test_private_only_text_with_real_tool_call_is_not_retried():
    from openai.types.responses import ResponseFunctionToolCall
    from speech_to_speech.LLM.base_openai_compatible_language_model import TextDelta, ToolCall
    tool = ToolCall(item=ResponseFunctionToolCall(
        type="function_call", name="generate_image", arguments="{}", call_id="call_real"))
    assert list(_filter_private_advisory_events(iter([TextDelta(text="[B2 advisory] secret"), tool]))) == [tool]


def test_zero_chat_size_preserves_live_history_and_clones(monkeypatch):
    from speech_to_speech.LLM.chat import Chat, make_user_message

    from robot_790d.realtime_entry import apply_unbounded_live_chat_patch
    monkeypatch.setattr(Chat, "trim_if_needed", Chat.trim_if_needed)
    monkeypatch.setattr(Chat, "_robot_790_zero_size_patch", False, raising=False)
    apply_unbounded_live_chat_patch()
    patched = Chat.trim_if_needed
    apply_unbounded_live_chat_patch()
    assert Chat.trim_if_needed is patched
    chat = Chat(0)
    def forbidden_compactor(_):
        pytest.fail("zero-size history must not trigger turn-count compaction")
    for index in range(100):
        chat.add_item(make_user_message(f"turn {index}"))
        chat.trim_if_needed(forbidden_compactor)
    clone = chat.copy()
    clone.trim_if_needed(forbidden_compactor)
    assert len(chat.buffer) == len(clone.buffer) == 100
    bounded = Chat(2)
    for index in range(3):
        bounded.add_item(make_user_message(f"turn {index}"))
    bounded.trim_if_needed()
    assert len(bounded.buffer) == 2


def test_runtime_tts_instruct_reads_session_extra_field() -> None:
    tts_input = SimpleNamespace(
        response=None,
        runtime_config=SimpleNamespace(session=SimpleNamespace(qwen3_tts_instruct=" low and raspy ")),
    )

    assert _runtime_tts_instruct(tts_input) == "low and raspy"


def test_runtime_tts_instruct_prefers_response_override() -> None:
    tts_input = SimpleNamespace(
        response=SimpleNamespace(qwen3_tts_instruct="bright"),
        runtime_config=SimpleNamespace(session=SimpleNamespace(qwen3_tts_instruct="ominous")),
    )

    assert _runtime_tts_instruct(tts_input) == "bright"


def test_runtime_tts_instruct_reads_audio_output_extra() -> None:
    output = SimpleNamespace(model_extra={"qwen3_tts_instruct": "sleepy"})
    tts_input = SimpleNamespace(
        response=None,
        runtime_config=SimpleNamespace(session=SimpleNamespace(audio=SimpleNamespace(output=output))),
    )

    assert _runtime_tts_instruct(tts_input) == "sleepy"


def test_chat_text_max_tokens_defaults_to_unlimited(monkeypatch) -> None:
    monkeypatch.delenv("ROBOT_790_TEXT_MAX_TOKENS", raising=False)

    assert _chat_text_max_tokens_from_env() is None


def test_chat_text_max_tokens_reads_positive_env(monkeypatch) -> None:
    monkeypatch.setenv("ROBOT_790_TEXT_MAX_TOKENS", "192")

    assert _chat_text_max_tokens_from_env() == 192


def test_chat_text_max_tokens_ignores_invalid_env(monkeypatch) -> None:
    monkeypatch.setenv("ROBOT_790_TEXT_MAX_TOKENS", "nope")

    assert _chat_text_max_tokens_from_env() is None


def test_llm_wire_capture_records_request_without_inline_media(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("ROBOT_790_CAPTURE_LLM_WIRE", "1")
    monkeypatch.setenv("ROBOT_790_LLM_WIRE_CAPTURE_DIR", str(tmp_path))

    captured = _capture_llm_wire_request(
        model_name="qwen3.8-27b-nvfp4-mtp",
        messages=[
            {"role": "system", "content": "Eric context"},
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": "hello"},
                    {"type": "input_image", "image_url": "data:image/png;base64,abc"},
                ],
            },
        ],
        optional_kwargs={"tool_choice": "auto", "tools": [{"type": "function", "function": {"name": "read_note"}}]},
        extra_body={"reasoning_effort": "none"},
        stream=True,
    )

    assert captured is not None
    payload = captured.read_text(encoding="utf-8")
    assert '"model": "qwen3.8-27b-nvfp4-mtp"' in payload
    assert '"name": "read_note"' in payload
    assert '"omitted_data_url_characters": 25' in payload
    assert "data:image/png;base64,abc" not in payload


def test_llm_wire_capture_preserves_large_prompts_and_tool_descriptions(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("ROBOT_790_CAPTURE_LLM_WIRE", "1")
    monkeypatch.setenv("ROBOT_790_LLM_WIRE_CAPTURE_DIR", str(tmp_path))
    prompt = "Identity, notes, and runtime context.\n" * 3000
    description = "Tool usage and arguments.\n" * 2000
    messages = [{"role": "system", "content": prompt}]
    options = {"tools": [{"type": "function", "function": {"name": "read_note", "description": description}}]}
    captured = _capture_llm_wire_request(
        model_name="test", messages=messages, optional_kwargs=options, extra_body={}, stream=True,
    )
    assert captured is not None
    payload = json.loads(captured.read_text(encoding="utf-8"))
    assert payload["messages"] == messages
    assert payload["request_options"] == options


def test_voice_shape_summary_describes_low_rate_volume_and_pitch(monkeypatch) -> None:
    monkeypatch.setenv("ROBOT_790_VOICE_SHAPE_BUCKET_S", "0.5")
    sample_rate = 16_000
    half_second = np.arange(sample_rate // 2) / sample_rate
    quiet_low = 0.02 * np.sin(2 * np.pi * 110 * half_second)
    pause = np.zeros(sample_rate // 2)
    loud_high = 0.2 * np.sin(2 * np.pi * 260 * half_second)
    audio = np.concatenate([quiet_low, pause, loud_high]).astype(np.float32)

    summary = _voice_shape_summary(audio, sample_rate)

    assert summary.startswith("[voice-shape: avg=0.5s:")
    assert "vol=quiet pitch=low" in summary
    assert "vol=pause pitch=none" in summary
    assert "vol=loud pitch=high" in summary


def test_voice_shape_can_be_appended_and_hidden_from_visible_transcript() -> None:
    enhanced = _append_voice_shape_to_transcript(
        "hello there",
        "[voice-shape: avg=0.5s: 0.0s vol=loud pitch=mid]",
    )

    assert enhanced == "hello there\n[voice-shape: avg=0.5s: 0.0s vol=loud pitch=mid]"
    assert _voice_shape_from_transcript(enhanced) == "[voice-shape: avg=0.5s: 0.0s vol=loud pitch=mid]"
    assert _strip_voice_shape_from_transcript(enhanced) == "hello there"

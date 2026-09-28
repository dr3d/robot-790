from queue import Queue
from types import SimpleNamespace

import pytest
from openai.types.realtime import ConversationItemCreateEvent, ResponseCreateEvent
from openai.types.responses import ResponseFunctionToolCall
from speech_to_speech.api.openai_realtime.service import RealtimeService
from speech_to_speech.LLM.base_openai_compatible_language_model import AssistantMessage, TextDelta, ToolCall
from speech_to_speech.LLM.chat import Chat, make_assistant_message, make_user_message
from speech_to_speech.LLM.chat_completions_language_model import ChatCompletionsApiModelHandler as Handler
from speech_to_speech.pipeline.messages import EndOfResponse

from robot_790d.realtime_entry import (
    IDLE_TOOL_BLOCKED,
    _PrivateAdvisoryTextFilter,
    apply_interruptible_chat_generation_patch,
    apply_unbounded_live_chat_patch,
    apply_visual_history_patch,
)
from robot_790d.realtime_lifecycle import apply_native_response_lifecycle_patch


@pytest.fixture
def runtime(monkeypatch):
    monkeypatch.setattr(Handler, "_generate", Handler._generate)
    monkeypatch.setattr(Handler, "_robot_790_interruptible_generation_patch", False, raising=False)
    apply_interruptible_chat_generation_patch()
    monkeypatch.setattr(Chat, "trim_if_needed", Chat.trim_if_needed)
    monkeypatch.setattr(Chat, "_robot_790_zero_size_patch", False, raising=False)
    apply_unbounded_live_chat_patch()
    monkeypatch.setattr(Chat, "strip_images", Chat.strip_images)
    monkeypatch.setattr(Chat, "_robot_790_visual_history_patch", False, raising=False)
    apply_visual_history_patch()
    handler = object.__new__(Handler)
    handler.client = SimpleNamespace(base_url="http://127.0.0.1:1234/v1")
    handler.stream, handler.stream_batch_sentences = False, 1
    handler.compactor = None
    handler.enable_lang_prompt = False
    handler.cancel_scope = None
    handler.audio_content_type = "input_audio"
    handler._generation_is_stale = lambda _: False
    handler._turn_is_latest = lambda *_: True
    handler._turn_output_allowed = lambda *_: True
    handler._chunk = lambda _, **kwargs: SimpleNamespace(**kwargs)
    requests, calls = [], []
    replies = [[AssistantMessage(content=[{"type": "output_text", "text": "An older connection."}])]]

    def request(items, options):
        requests.append((items, options))
        return iter(replies[min(len(requests) - 1, len(replies) - 1)])

    handler._request, handler._iter_events = request, iter
    handler._record_tool_call = lambda *args: calls.append(args) or iter([])
    chat = Chat(0)
    system = "Stable Eric identity. Loaded parent-session note: the clock has eleven seconds."
    handler._apply_config(chat, system, True)
    chat.add_item(make_user_message("An early gem: the harbor bell is a violet triangle."))
    for index in range(35):
        chat.add_item(make_assistant_message(f"Historical reply {index}."))
        chat.add_item(make_user_message(f"Later conversation {index}."))
    session = SimpleNamespace(instructions=system, tools=[{
        "type": "function", "name": "generate_image", "description": "Draw an image.",
        "parameters": {"type": "object", "properties": {}},
    }], tool_choice="auto")
    return SimpleNamespace(
        handler=handler, chat=chat, session=session, requests=requests, calls=calls, replies=replies)


def idle_response(**overrides):
    return ResponseCreateEvent.model_validate({"type": "response.create", "response": {
        "conversation": "none", "output_modalities": ["audio"],
        "robot790_idle_continuation": True,
        "instructions": "Let a thought arise from any part of your history. Current eye is empty.",
        "input": [{"type": "message", "role": "user", "content": [
            {"type": "input_text", "text": "A temporary idle cue, not something Scott said."}
        ]}], "tools": [], "tool_choice": "none", **overrides,
    }}).response


def run(runtime, response):
    return list(runtime.handler.process(SimpleNamespace(
        audio=None, runtime_config=SimpleNamespace(chat=runtime.chat, session=runtime.session),
        response=response, language_code=None, turn_id=None, turn_revision=None, speech_stopped_at_s=None,
    )))


@pytest.fixture
def entry(runtime, monkeypatch):
    for name in ("_on_transcription_completed", "_on_audio_input_completed", "_on_token_usage",
                 "handle_response_create"):
        monkeypatch.setattr(RealtimeService, name, getattr(RealtimeService, name))
    monkeypatch.setattr(RealtimeService, "_robot_790_native_response_lifecycle_patch", False, raising=False)
    apply_native_response_lifecycle_patch()
    service = RealtimeService(text_prompt_queue=Queue(), chat_size=0)
    conn = service.register()
    cfg = service._state(conn).runtime_config
    cfg.chat = runtime.chat
    cfg.session = cfg.session.model_copy(update={
        "instructions": runtime.session.instructions, "tools": runtime.session.tools, "tool_choice": "auto",
    })
    yield service, conn
    service.unregister(conn)


def test_shared_idle_entry_keeps_cues_request_local_across_repeated_turns(runtime, entry):
    service, conn = entry
    for _ in range(3):
        before = runtime.handler._serialize(runtime.chat)
        response = idle_response(conversation="default", tools=runtime.session.tools, tool_choice="auto")
        event = ResponseCreateEvent(type="response.create", response=response)
        original_event = event.model_dump()
        assert service.handle_response_create(conn, event).type == "response.created"
        assert runtime.handler._serialize(runtime.chat) == before
        output = list(runtime.handler.process(service.text_prompt_queue.get_nowait()))
        assert not any(item.error for item in output if isinstance(item, EndOfResponse))
        messages = runtime.requests[-1][0]
        assert messages[:-2] == before
        assert str(messages).count("temporary idle cue") == 1
        saved = runtime.handler._serialize(runtime.chat)
        assert saved[:-1] == before
        assert "temporary idle cue" not in str(saved)
        assert event.model_dump() == original_event
        service.response.finish_response(conn)
    assert str(runtime.handler._serialize(runtime.chat)).count("An older connection.") == 3


def test_shared_idle_entry_supplies_image_once_without_saving_temporary_input(runtime, entry):
    service, conn = entry
    before = runtime.handler._serialize(runtime.chat)
    response = idle_response(conversation="default", input=[{
        "type": "message", "role": "user", "content": [
            {"type": "input_text", "text": "Private current-image cue."},
            {"type": "input_image", "image_url": "data:image/png;base64,cGl4ZWxz"},
        ],
    }])
    service.handle_response_create(conn, ResponseCreateEvent(type="response.create", response=response))
    list(runtime.handler.process(service.text_prompt_queue.get_nowait()))
    messages = runtime.requests[-1][0]
    assert messages[:-2] == before
    assert str(messages).count("data:image/png;base64,cGl4ZWxz") == 1
    assert "data:image/png;base64,cGl4ZWxz" not in str(runtime.handler._serialize(runtime.chat))


def test_normal_in_band_entry_still_commits_operator_input(runtime, entry):
    service, conn = entry
    before = runtime.handler._serialize(runtime.chat)
    response = idle_response(conversation="default", robot790_idle_continuation=False)
    service.handle_response_create(conn, ResponseCreateEvent(type="response.create", response=response))
    assert "temporary idle cue" in str(runtime.handler._serialize(runtime.chat))
    list(runtime.handler.process(service.text_prompt_queue.get_nowait()))
    saved = runtime.handler._serialize(runtime.chat)
    assert saved[:len(before)] == before
    assert str(saved).count("temporary idle cue") == 1
    assert str(saved).count("An older connection.") == 1


def test_isolated_idle_entry_remains_isolated(runtime, entry):
    service, conn = entry
    before = runtime.handler._serialize(runtime.chat)
    service.handle_response_create(conn, ResponseCreateEvent(type="response.create", response=idle_response()))
    list(runtime.handler.process(service.text_prompt_queue.get_nowait()))
    assert str(runtime.requests[-1][0]).count("temporary idle cue") == 1
    assert runtime.handler._serialize(runtime.chat) == before


@pytest.mark.parametrize("case", ["invalid_input", "cancelled", "provider_error", "active_response"])
def test_shared_idle_entry_errors_cannot_leave_controller_input_in_history(runtime, entry, case):
    service, conn = entry
    before = runtime.handler._serialize(runtime.chat)
    response = idle_response(conversation="default")
    if case == "invalid_input":
        response = idle_response(conversation="default", input=[{
            "type": "message", "role": "system", "content": [
                {"type": "input_text", "text": "An invalid idle system replacement."},
            ],
        }])
    elif case == "provider_error":
        def fail_request(*_):
            raise RuntimeError("test provider error")
        runtime.handler._request = fail_request
    elif case == "active_response":
        service._state(conn).in_response = True
    created = service.handle_response_create(conn, ResponseCreateEvent(type="response.create", response=response))
    if case == "active_response":
        assert created.type == "error"
        assert service.text_prompt_queue.empty()
    else:
        if case == "cancelled":
            service.handle_response_cancel(conn)
            runtime.handler._turn_is_latest = lambda *_: False
        output = list(runtime.handler.process(service.text_prompt_queue.get_nowait()))
        if case != "cancelled":
            assert any(item.error for item in output if isinstance(item, EndOfResponse))
        if case != "provider_error":
            assert runtime.requests == []
    assert runtime.handler._serialize(runtime.chat) == before


def test_shared_idle_entry_keeps_tool_receipts_but_not_temporary_input(runtime, entry):
    service, conn = entry
    del runtime.handler._record_tool_call
    runtime.replies[:] = [[tool_event()]]
    response = idle_response(conversation="default", tools=runtime.session.tools, tool_choice="auto")
    service.handle_response_create(conn, ResponseCreateEvent(type="response.create", response=response))
    list(runtime.handler.process(service.text_prompt_queue.get_nowait()))
    service.response.finish_response(conn)
    runtime.chat.add_item(ConversationItemCreateEvent.model_validate({
        "type": "conversation.item.create", "item": {
            "type": "function_call_output", "call_id": "call_test",
            "output": '{"status":"ok","filename":"retained.png"}',
        },
    }).item)
    saved = runtime.handler._serialize(runtime.chat)
    assert "retained.png" in str(saved)
    assert "temporary idle cue" not in str(saved)
    runtime.replies[:] = [[AssistantMessage(content=[{"type": "output_text", "text": "A result."}])]]
    followup = ResponseCreateEvent.model_validate({"type": "response.create", "response": {
        "robot790_tool_followup": "Choose what follows from the receipt.",
        "tools": runtime.session.tools, "tool_choice": "auto", "output_modalities": ["audio"],
    }})
    service.handle_response_create(conn, followup)
    list(runtime.handler.process(service.text_prompt_queue.get_nowait()))
    assert runtime.requests[-1][0][:-1] == saved
    assert "STS tool continuation" not in str(runtime.handler._serialize(runtime.chat))


@pytest.mark.parametrize("stream", [False, True])
def test_idle_uses_entire_serialized_history_and_catalogue_without_writing_back(runtime, stream):
    runtime.handler.stream = stream
    before = runtime.handler._serialize(runtime.chat)
    output = run(runtime, idle_response())
    messages, options = runtime.requests[0]
    assert messages[:-2] == before
    assert "violet triangle" in str(messages)
    assert "eleven seconds" in str(messages[0])
    assert messages[-2]["role"] == "user"
    assert "[STS idle continuation]" in str(messages[-2])
    assert "temporary idle cue" in str(messages[-1])
    assert options["tools"] == runtime.handler._build_optional_kwargs(runtime.session.tools, "auto")["tools"]
    assert options["tool_choice"] == "auto"
    assert runtime.handler._serialize(runtime.chat) == before
    assert runtime.calls == []
    assert [item.error for item in output if isinstance(item, EndOfResponse)] == [None]


def test_idle_media_is_appended_after_history_and_never_persists(runtime):
    before = runtime.handler._serialize(runtime.chat)
    response = idle_response(input=[{"type": "message", "role": "user", "content": [
        {"type": "input_text", "text": "Current image, not a historical sensor."},
        {"type": "input_image", "image_url": "data:image/png;base64,cGl4ZWxz"},
    ]}])
    run(runtime, response)
    messages = runtime.requests[0][0]
    assert messages[:-2] == before
    assert messages[-1]["content"][1]["type"] == "image_url"
    assert runtime.handler._serialize(runtime.chat) == before


def test_provider_context_errors_do_not_compact_or_halve_shared_history(runtime):
    """An overflow receipt alone cannot establish successful memory compaction."""
    before = runtime.handler._serialize(runtime.chat)
    attempts = []

    def fail_request(items, options):
        attempts.append(items)
        raise RuntimeError("Context size has been exceeded.")

    runtime.handler._request = fail_request
    for _ in range(3):
        output = run(runtime, idle_response(conversation="auto"))
        assert any("Context size" in (item.error or "") for item in output if isinstance(item, EndOfResponse))
        assert runtime.handler._serialize(runtime.chat) == before
    assert all(items[:-2] == before for items in attempts)


def test_idle_without_extra_input_still_reads_all_history(runtime):
    before = runtime.handler._serialize(runtime.chat)
    run(runtime, idle_response(input=None))
    assert runtime.requests[0][0][:-1] == before


def test_image_followup_idle_and_return_preserve_historical_media_prefix(runtime):
    image = ConversationItemCreateEvent.model_validate({
        "type": "conversation.item.create", "item": {
            "type": "message", "role": "user", "content": [
                {"type": "input_text", "text": "Staged drawing A."},
                {"type": "input_image", "image_url": "data:image/png;base64,cGl4ZWxz"},
            ],
        },
    }).item
    runtime.chat.add_item(image)
    before = runtime.handler._serialize(runtime.chat)
    run(runtime, None)
    saved = runtime.handler._serialize(runtime.chat)
    assert saved[:len(before)] == before
    run(runtime, idle_response(conversation="default", input=None, tool_choice="auto"))
    assert runtime.requests[-1][0][:len(saved)] == saved
    runtime.chat.add_item(make_user_message("The eye is clear now. That drawing is historical."))
    returned = runtime.handler._serialize(runtime.chat)
    run(runtime, None)
    assert runtime.requests[-1][0] == returned
    assert returned[:len(before)] == before
    assert str(returned).count("data:image/png;base64,cGl4ZWxz") == 1
    runtime.chat.reset()
    assert not runtime.chat.image_message_ids()


def test_spoken_idle_is_committed_once_by_existing_client_path_not_backend(runtime):
    before = runtime.handler._serialize(runtime.chat)
    run(runtime, idle_response())
    assert runtime.handler._serialize(runtime.chat) == before
    runtime.chat.add_item(make_assistant_message("An older connection."))
    committed = runtime.handler._serialize(runtime.chat)
    run(runtime, idle_response(instructions="Another temporary idle beat."))
    assert runtime.requests[1][0][:-2] == committed
    assert str(runtime.handler._serialize(runtime.chat)).count("An older connection.") == 1
    runtime.chat.add_item(make_user_message("I am back."))
    next_conversation = runtime.handler._serialize(runtime.chat)
    run(runtime, None)
    assert runtime.requests[2][0] == next_conversation
    assert "STS idle continuation" not in str(runtime.requests[2][0])


def test_explicit_isolated_experiment_stays_isolated(runtime):
    run(runtime, idle_response(robot790_idle_continuation=False))
    assert "violet triangle" not in str(runtime.requests[0][0])
    assert "eleven seconds" not in str(runtime.requests[0][0])
    assert runtime.requests[0][1]["tool_choice"] == "none"


def test_default_idle_writes_assistant_once_without_persisting_controller_tail(runtime):
    before = runtime.handler._serialize(runtime.chat)
    run(runtime, idle_response(conversation="default", tools=runtime.session.tools, tool_choice="auto"))
    messages, options = runtime.requests[0]
    assert messages[:-2] == before
    assert options["tool_choice"] == "auto"
    saved = runtime.handler._serialize(runtime.chat)
    assert saved[:-1] == before
    assert str(saved).count("An older connection.") == 1
    assert "STS idle continuation" not in str(saved)
    assert "temporary idle cue" not in str(saved)
    runtime.chat.add_item(make_user_message("I am back."))
    run(runtime, None)
    assert runtime.requests[1][0][:-1] == saved


def test_default_idle_can_emit_tool_calls_without_a_tool_blocked_retry(runtime):
    runtime.replies[:] = [[tool_event()]]
    output = run(runtime, idle_response(conversation="default", tools=runtime.session.tools, tool_choice="auto"))
    assert len(runtime.requests) == 1
    assert len(runtime.calls) == 1
    assert not any(item.error for item in output if isinstance(item, EndOfResponse))


def test_default_idle_call_and_receipt_pair_in_real_history_before_followup(runtime):
    del runtime.handler._record_tool_call
    runtime.replies[:] = [[tool_event()]]
    run(runtime, idle_response(conversation="default", tools=runtime.session.tools, tool_choice="auto"))
    output = ConversationItemCreateEvent.model_validate({
        "type": "conversation.item.create", "item": {
            "type": "function_call_output", "call_id": "call_test",
            "output": '{"status":"ok","filename":"retained.png"}',
        },
    }).item
    runtime.chat.add_item(output)
    saved = runtime.handler._serialize(runtime.chat)
    assert "retained.png" in str(saved)
    assert "call_test" in str(saved)
    assert "STS idle continuation" not in str(saved)
    runtime.replies[:] = [[AssistantMessage(content=[{"type": "output_text", "text": "A result."}])]]
    response = ResponseCreateEvent.model_validate({"type": "response.create", "response": {
        "robot790_tool_followup": "Choose what follows from the receipt.", "tool_choice": "auto",
        "tools": runtime.session.tools, "output_modalities": ["audio"],
    }}).response
    run(runtime, response)
    assert runtime.requests[-1][0][:-1] == saved
    assert "STS tool continuation" not in str(runtime.handler._serialize(runtime.chat))


@pytest.mark.parametrize("overrides", [
    {"robot790_tool_followup": "Conflicting continuation."},
    {"input": [{"type": "message", "role": "system", "content": [
        {"type": "input_text", "text": "Must not replace the shared system prefix."}]}]},
])
def test_invalid_shared_idle_fails_without_inference_or_history_mutation(runtime, overrides):
    before = runtime.handler._serialize(runtime.chat)
    output = run(runtime, idle_response(**overrides))
    assert any(item.error for item in output if isinstance(item, EndOfResponse))
    assert runtime.requests == []
    assert runtime.handler._serialize(runtime.chat) == before


def tool_event():
    return ToolCall(item=ResponseFunctionToolCall(
        type="function_call", name="generate_image", arguments="{}", call_id="call_test"))


@pytest.mark.parametrize("repeat_tool", [False, True])
def test_idle_catalogue_does_not_grant_tool_execution_and_retry_is_bounded(runtime, repeat_tool):
    before = runtime.handler._serialize(runtime.chat)
    runtime.replies[:] = [[tool_event()], [tool_event()] if repeat_tool else [TextDelta(text="A thought.")]]
    output = run(runtime, idle_response(tool_choice="auto"))
    assert [options["tool_choice"] for _, options in runtime.requests] == ["auto", "none"]
    assert runtime.requests[0][0] == runtime.requests[1][0]
    assert runtime.calls == []
    assert runtime.handler._serialize(runtime.chat) == before
    errors = [item.error for item in output if isinstance(item, EndOfResponse)]
    assert len(errors) == 1
    assert (IDLE_TOOL_BLOCKED in (errors[0] or "")) == repeat_tool


def test_idle_never_retries_after_public_text(runtime):
    runtime.replies[:] = [[TextDelta(text="Already said."), tool_event()]]
    run(runtime, idle_response())
    assert len(runtime.requests) == 1
    assert runtime.calls == []


def test_shared_idle_preserves_remote_provider_no_tool_contract(runtime):
    runtime.handler.client.base_url = "https://remote.example/v1"
    run(runtime, idle_response())
    assert runtime.requests[0][1]["tool_choice"] == "none"


def test_empty_connection_does_not_retain_previous_sessions(runtime):
    runtime.chat = Chat(0)
    runtime.session.instructions = "New empty session."
    run(runtime, idle_response())
    assert "violet triangle" not in str(runtime.requests[0][0])
    assert "eleven seconds" not in str(runtime.requests[0][0])


def test_stale_idle_request_cannot_start_inference(runtime):
    before = runtime.handler._serialize(runtime.chat)
    runtime.handler._turn_is_latest = lambda *_: False
    run(runtime, idle_response())
    assert runtime.requests == []
    assert runtime.handler._serialize(runtime.chat) == before


@pytest.mark.parametrize("split", range(len("[STS idle continuation]") + 1))
def test_private_idle_marker_cannot_leak_across_stream_chunks(split):
    marker = "[STS idle continuation]"
    guard = _PrivateAdvisoryTextFilter()
    output = "".join(guard.feed(part) for part in [
        "An actual thought. ", marker[:split], marker[split:], "Temporary controller directions.",
    ]) + guard.finish()
    assert output == "An actual thought. "
    assert guard.blocked

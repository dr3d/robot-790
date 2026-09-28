from queue import Queue

import numpy as np
import pytest
from openai.types.realtime import ResponseCreateEvent
from speech_to_speech.api.openai_realtime.service import RealtimeService
from speech_to_speech.pipeline.events import (
    AssistantTextEvent,
    AudioInputCompletedEvent,
    ResponseFailedEvent,
    SpeechStartedEvent,
    TokenUsageEvent,
    TranscriptionCompletedEvent,
)

from robot_790d.realtime_lifecycle import apply_native_response_lifecycle_patch


@pytest.fixture
def service(monkeypatch):
    for name in ("_on_transcription_completed", "_on_audio_input_completed", "_on_token_usage",
                 "handle_response_create"):
        monkeypatch.setattr(RealtimeService, name, getattr(RealtimeService, name))
    monkeypatch.setattr(RealtimeService, "_robot_790_native_response_lifecycle_patch", False, raising=False)
    apply_native_response_lifecycle_patch()
    patched = RealtimeService._on_transcription_completed
    patched_create = RealtimeService.handle_response_create
    apply_native_response_lifecycle_patch()
    assert RealtimeService._on_transcription_completed is patched
    assert RealtimeService.handle_response_create is patched_create
    service = RealtimeService(text_prompt_queue=Queue())
    conn = service.register()
    yield service, conn
    service.unregister(conn)


def queue_native(service, conn, audio=False):
    event = (AudioInputCompletedEvent(audio=np.zeros(1600, dtype=np.float32), audio_duration_s=0.1)
             if audio else TranscriptionCompletedEvent(transcript="Continue our conversation."))
    return service._pipeline_dispatch[type(event)](conn, event)


@pytest.mark.parametrize("audio", [False, True])
def test_native_reply_announced_before_output_and_blocks_extra_request(service, audio):
    service, conn = service
    events = queue_native(service, conn, audio)
    created = [event for event in events if event.type == "response.created"]
    assert len(created) == 1
    response_id = created[0].response.id
    state = service._state(conn)
    assert state.in_response and not state.response_pending
    assert service.text_prompt_queue.qsize() == 1

    # No output or wall-clock expiry is needed to retain ownership.
    rejected = service.handle_response_create(conn, ResponseCreateEvent(type="response.create"))
    assert rejected.type == "error"
    assert rejected.error.type == "conversation_already_has_active_response"
    assert service.text_prompt_queue.qsize() == 1
    service.response.on_assistant_text(conn, AssistantTextEvent(text="Still here."))
    actual_id, _, more_created = service.audio.begin_audio_response(conn)
    assert actual_id == response_id
    assert more_created == []
    done = service.response.finish_response(conn)
    terminal = next(event for event in done if event.type == "response.done")
    assert terminal.response.id == response_id
    assert not state.in_response
    assert service.handle_response_create(conn, ResponseCreateEvent(type="response.create")).type == "response.created"


def test_empty_transcription_or_missing_queue_does_not_start_reply(service):
    service, conn = service
    events = service._on_transcription_completed(conn, TranscriptionCompletedEvent(transcript=""))
    assert not any(event.type == "response.created" for event in events)
    assert not service._state(conn).in_response
    service.text_prompt_queue = None
    events = queue_native(service, conn)
    assert not any(event.type == "response.created" for event in events)
    assert not service._state(conn).in_response


def test_failure_closes_announced_reply_once(service):
    service, conn = service
    queue_native(service, conn)
    events = service._on_response_failed(conn, ResponseFailedEvent(message="provider timed out"))
    assert not any(event.type == "response.created" for event in events)
    assert next(event for event in events if event.type == "response.done").response.status == "failed"
    assert not service._state(conn).in_response
    assert service._on_response_failed(conn, ResponseFailedEvent(message="duplicate")) == []


def test_interrupt_before_first_output_closes_old_reply_and_announces_new_one(service):
    service, conn = service
    queue_native(service, conn)
    old_id = service._state(conn).current_response_id
    events = service.audio.on_speech_started(conn, SpeechStartedEvent())
    terminal = next(event for event in events if event.type == "response.done")
    assert terminal.response.id == old_id
    assert terminal.response.status == "cancelled"
    created = next(event for event in queue_native(service, conn) if event.type == "response.created")
    assert created.response.id != old_id


def test_existing_active_reply_is_not_announced_twice(service):
    service, conn = service
    queue_native(service, conn)
    first = service._state(conn).current_response_id
    events = queue_native(service, conn)
    assert not any(event.type == "response.created" for event in events)
    assert service._state(conn).current_response_id == first


def test_usage_protocol_preserves_totals_but_reports_each_request_separately(service):
    service, conn = service
    queue_native(service, conn)
    for tokens in [63292, 63127]:
        events = service._pipeline_dispatch[TokenUsageEvent](conn, TokenUsageEvent(input_tokens=tokens))
        assert len(events) == 1
        payload = events[0].model_dump()
        assert payload["type"] == "robot790.request.usage"
        assert payload["input_tokens"] == tokens
        assert payload["conversation_id"] == service._state(conn).conversation_id
        assert payload["response_id"] == service._state(conn).current_response_id
    assert service._state(conn).response_usage.input_tokens == 126419
    service.response.finish_response(conn)
    assert service._on_token_usage(conn, TokenUsageEvent(input_tokens=99999)) == []


def test_isolated_usage_cannot_replace_conversation_context_meter(service):
    from openai.types.realtime.realtime_response_create_params import RealtimeResponseCreateParams

    service, conn = service
    service.handle_response_create(conn, ResponseCreateEvent(
        type="response.create", response=RealtimeResponseCreateParams(conversation="none")))
    events = service._on_token_usage(conn, TokenUsageEvent(input_tokens=200))
    assert events[0].conversation_id is None


def test_stale_turn_usage_is_not_sent_to_client(service):
    from types import SimpleNamespace

    service, conn = service
    queue_native(service, conn)
    service.speculative_turns = SimpleNamespace(is_latest=lambda *_: False)
    assert service._on_token_usage(conn, TokenUsageEvent(input_tokens=99999)) == []
    assert service._state(conn).response_usage.input_tokens == 0

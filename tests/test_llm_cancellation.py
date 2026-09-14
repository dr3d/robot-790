from threading import Event, Thread
from types import SimpleNamespace

import httpx
import pytest

from robot_790d.llm_cancellation import CancellableProviderEvents


class Response:
    def __init__(self):
        self.closed = Event()
        self.reading = Event()

    def close(self):
        self.closed.set()

    def blocked_events(self):
        self.reading.set()
        assert self.closed.wait(3), "reader was not closed"
        yield "stale output"


def consume_in_thread(events):
    output = []
    finished = Event()

    def consume():
        try:
            output.extend(events)
        finally:
            finished.set()

    thread = Thread(target=consume, daemon=True)
    thread.start()
    return output, finished


def test_cancellation_unblocks_read_without_leaking_stale_output():
    response, cancel = Response(), Event()
    events = CancellableProviderEvents(lambda: response, lambda r: r.blocked_events(), cancel.is_set)
    output, finished = consume_in_thread(events)
    assert response.reading.wait(1)
    cancel.set()
    assert finished.wait(0.5)
    assert response.closed.wait(0.5)
    assert events.finished.wait(1)
    assert output == []


def test_cancellation_before_headers_does_not_block_next_request():
    response, cancel, headers = Response(), Event(), Event()
    started = Event()

    def request():
        started.set()
        assert headers.wait(3)
        return response

    events = CancellableProviderEvents(request, lambda _: iter(["old"]), cancel.is_set)
    output, finished = consume_in_thread(events)
    try:
        assert started.wait(1)
        cancel.set()
        assert finished.wait(0.5)
        fresh = Response()
        next_events = CancellableProviderEvents(lambda: fresh, lambda _: iter(["new"]), lambda: False)
        assert list(next_events) == ["new"]
        assert fresh.closed.is_set()
        assert output == []
    finally:
        headers.set()
        assert events.finished.wait(1)
    assert response.closed.is_set()


def test_normal_events_keep_order_and_close_once():
    response = Response()
    events = CancellableProviderEvents(lambda: response, lambda _: iter(range(100)), lambda: False)
    assert list(events) == list(range(100))
    events.close()
    assert events.finished.is_set()
    assert response.closed.is_set()


@pytest.mark.parametrize("during_request", [True, False])
def test_provider_failure_reaches_original_error_handler(during_request):
    error = httpx.ReadTimeout("timeout")
    response = Response()

    def fail():
        raise error

    events = CancellableProviderEvents(fail if during_request else lambda: response,
                                      lambda _: fail(), lambda: False)
    with pytest.raises(httpx.ReadTimeout) as caught:
        list(events)
    assert caught.value is error
    assert events.finished.wait(1)


def test_full_queue_can_be_cancelled_and_closed():
    response, cancel = Response(), Event()
    events = CancellableProviderEvents(lambda: response, lambda _: iter(range(100000)), cancel.is_set)
    events.close()
    assert events.finished.wait(1)
    assert list(events) == []
    assert response.closed.is_set() or events.response is None


def test_cancelled_generation_does_not_commit_history_or_speak_apology(monkeypatch):
    from speech_to_speech.LLM.chat_completions_language_model import ChatCompletionsApiModelHandler as Handler
    from speech_to_speech.pipeline.cancel_scope import CancelScope
    from speech_to_speech.pipeline.messages import EndOfResponse

    from robot_790d.realtime_entry import apply_interruptible_chat_generation_patch

    original = Handler._generate
    monkeypatch.setattr(Handler, "_robot_790_interruptible_generation_patch", False, raising=False)
    monkeypatch.setattr(Handler, "_generate", original)
    apply_interruptible_chat_generation_patch()
    patched = Handler._generate
    apply_interruptible_chat_generation_patch()
    assert Handler._generate is patched
    handler = object.__new__(Handler)
    handler.stream = True
    handler.stream_batch_sentences = 1
    handler.cancel_scope = CancelScope()
    handler.speculative_turns = None
    handler.request_timeout_s = 20
    response = Response()
    handler._serialize = lambda _: ["prompt"]
    handler._request = lambda *_: response
    handler._iter_events = lambda r: r.blocked_events()
    chat = SimpleNamespace(image_message_ids=lambda: set())
    turn = SimpleNamespace(gen=handler.cancel_scope.generation, turn_id=None, turn_revision=None,
                           response=None, wants_audio=True, runtime_config=None)
    output, finished = consume_in_thread(handler._generate(chat, chat, turn, {}))
    assert response.reading.wait(1)
    handler.cancel_scope.cancel()
    assert finished.wait(0.5)
    assert len(output) == 1
    assert isinstance(output[0], EndOfResponse)
    assert output[0].error is None
    assert response.closed.wait(1)


@pytest.mark.parametrize("native_audio", [False, True])
@pytest.mark.parametrize("second_private", [False, True])
def test_real_generation_filtered_recovery_closes_turn_and_commits_only_public_history(
    monkeypatch, native_audio, second_private
):
    from openai.types.realtime.realtime_conversation_item_assistant_message import Content
    from speech_to_speech.LLM.base_openai_compatible_language_model import AssistantMessage, TextDelta
    from speech_to_speech.LLM.chat import Chat, make_user_message
    from speech_to_speech.LLM.chat_completions_language_model import ChatCompletionsApiModelHandler as Handler
    from speech_to_speech.pipeline.messages import EndOfResponse

    from robot_790d.realtime_entry import _filter_private_advisory_events, apply_interruptible_chat_generation_patch

    monkeypatch.setattr(Handler, "_generate", Handler._generate)
    monkeypatch.setattr(Handler, "_robot_790_interruptible_generation_patch", False, raising=False)
    apply_interruptible_chat_generation_patch()
    handler = object.__new__(Handler)
    handler.stream = False
    handler.compactor = None
    handler._generation_is_stale = lambda _: False
    handler._turn_is_latest = lambda *_: True
    handler._turn_output_allowed = lambda *_: True
    handler._chunk = lambda _, **kwargs: SimpleNamespace(**kwargs)
    requests = []
    def request(items, options):
        requests.append(items)
        raw = "[B2 advisory] private snapshot" if len(requests) == 1 or second_private else "Here is my answer."
        return iter([AssistantMessage(content=[Content(type="output_text", text=raw)]), TextDelta(text=raw)])
    handler._serialize = lambda chat: [item.model_dump() for item in chat.buffer]
    handler._request = request
    handler._iter_events = _filter_private_advisory_events
    original = Chat(100)
    user = original.add_item(make_user_message("Original question"))
    turn = SimpleNamespace(gen=0, turn_id=None, turn_revision=None, response=None, wants_audio=False)
    kwargs = {"transactional_user_message_id": user.id} if native_audio else {}
    outputs = list(handler._generate(original.copy(), original, turn, {}, **kwargs))
    assert len(requests) == 2
    ends = [item for item in outputs if isinstance(item, EndOfResponse)]
    assert len(ends) == 1
    assert bool(ends[0].error) == second_private
    history = str([item.model_dump() for item in original.buffer])
    assert "private snapshot" not in history
    assert "STS response recovery" not in history
    assert ("Here is my answer." in history) == (not second_private)
    assert ("Original question" in history) == (not native_audio or not second_private)


def test_tool_followup_uses_voice_prefix_even_for_private_text_selection(monkeypatch):
    from speech_to_speech.LLM.chat_completions_language_model import ChatCompletionsApiModelHandler as Handler

    from robot_790d.realtime_entry import apply_interruptible_chat_generation_patch

    seen = []
    def generate(self, active_chat, original_chat, turn, options, **kwargs):
        yield options
    monkeypatch.setattr(Handler, "_generate", generate)
    monkeypatch.setattr(Handler, "_robot_790_interruptible_generation_patch", False, raising=False)
    apply_interruptible_chat_generation_patch()
    handler = object.__new__(Handler)
    handler._apply_config = lambda *args: seen.append(args)
    turn = SimpleNamespace(response=SimpleNamespace(robot790_tool_followup="Say it is loaded."),
                           runtime_config=SimpleNamespace(session=SimpleNamespace(instructions="stable B1")))
    additions = []
    active = SimpleNamespace(add_item=additions.append)
    options = {"tools": ["all original schemas"], "tool_choice": "none"}
    monkeypatch.delenv("ROBOT_790_B1_TEMPERATURE", raising=False)
    assert list(handler._generate(active, "original", turn, options)) == [{**options, "temperature": 0.8}]
    assert "temperature" not in options
    assert seen == [(active, "stable B1", True)]
    assert additions[0].role == "user"
    assert additions[0].content[0].text == "[STS tool continuation]\nSay it is loaded."


def test_real_http_read_is_aborted_without_waiting_for_server_body():
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    release, reading, cancel = Event(), Event(), Event()

    class Server(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"
        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-Length", "10")
            self.end_headers()
            self.wfile.flush()
            release.wait(3)
            self.close_connection = True
        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Server)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with httpx.Client(timeout=5, trust_env=False) as client:
            def request():
                return client.send(client.build_request("GET", f"http://127.0.0.1:{server.server_port}"), stream=True)
            def iterate(response):
                reading.set()
                yield from response.iter_lines()
            events = CancellableProviderEvents(request, iterate, cancel.is_set)
            output, finished = consume_in_thread(events)
            assert reading.wait(1)
            cancel.set()
            assert finished.wait(0.5)
            assert events.finished.wait(1), "HTTP read still blocked after cancellation"
            assert not release.is_set()
            assert output == []
    finally:
        release.set()
        server.shutdown()
        server.server_close()
        thread.join(1)


def test_tool_followup_preserves_serialized_system_and_does_not_persist_private_input(monkeypatch):
    from openai.types.realtime import ResponseCreateEvent
    from speech_to_speech.LLM.chat import Chat, make_user_message
    from speech_to_speech.LLM.chat_completions_language_model import ChatCompletionsApiModelHandler as Handler

    from robot_790d.realtime_entry import apply_interruptible_chat_generation_patch

    seen = []
    def generate(self, active, original, turn, options, **kwargs):
        seen.append(self._serialize(active))
        return iter([])
    monkeypatch.setattr(Handler, "_generate", generate)
    monkeypatch.setattr(Handler, "_robot_790_interruptible_generation_patch", False, raising=False)
    apply_interruptible_chat_generation_patch()
    handler = object.__new__(Handler)
    handler.audio_content_type = "input_audio"
    chat = Chat(size=100)
    handler._apply_config(chat, "Stable identity, history, body.", True)
    chat.add_item(make_user_message("Show the saved picture."))
    before = handler._serialize(chat)
    event = ResponseCreateEvent.model_validate({"type": "response.create", "response": {
        "output_modalities": ["text"], "robot790_tool_followup": "Select an exact listed ID."
    }})
    turn = SimpleNamespace(response=event.response, runtime_config=SimpleNamespace(
        session=SimpleNamespace(instructions="Stable identity, history, body.")))
    active = chat.copy()
    handler._apply_config(active, "Stable identity, history, body.", False)
    list(handler._generate(active, chat, turn, {}))
    assert seen[0][:-1] == before
    assert seen[0][-1]["role"] == "user"
    assert handler._serialize(chat) == before

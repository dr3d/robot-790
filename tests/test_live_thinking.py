from concurrent.futures import ThreadPoolExecutor
from threading import Event
from types import SimpleNamespace

import pytest
from openai.types.realtime import SessionUpdateEvent
from speech_to_speech.LLM.chat_completions_language_model import ChatCompletionsApiModelHandler as Handler
from speech_to_speech.api.openai_realtime.handlers.session import SessionHandler
from speech_to_speech.api.openai_realtime.runtime_config import RuntimeConfig

from robot_790d import realtime_entry as entry


@pytest.fixture
def live_thinking(monkeypatch):
    for cls, names in [
        (Handler, ["__init__", "_request", "_generate"]),
        (SessionHandler, ["handle_session_update", "build_session_created", "build_session_updated"]),
    ]:
        for name in names:
            monkeypatch.setattr(cls, name, getattr(cls, name))
    monkeypatch.setattr(Handler, "_build_extra_body", classmethod(Handler._build_extra_body.__func__))
    for flag in ["thinking_switch", "live_thinking", "interruptible_generation", "wire_capture"]:
        monkeypatch.setattr(Handler, f"_robot_790_{flag}_patch", False, raising=False)
    entry.apply_chat_thinking_switch_patch()
    entry.apply_live_chat_thinking_patch()
    entry.apply_chat_completions_wire_capture_patch()
    profile = {"status": "verified", "model": "test", "can_on": True, "can_off": True,
               "options": ["off", "on", "medium", "xhigh"], "on_option": "on", "identity": "test"}
    monkeypatch.setattr(entry, "_handler_thinking_profile", lambda handler=None: dict(profile))
    return None


def session_handler():
    configs = {name: RuntimeConfig() for name in ["one", "two"]}
    service = SimpleNamespace(
        _state=lambda name: SimpleNamespace(runtime_config=configs[name]),
        make_error=lambda message, kind: {"error": kind},
    )
    return SessionHandler(service), configs


def update(handler, name, **values):
    return handler.handle_session_update(name, SessionUpdateEvent.model_validate({
        "type": "session.update", "session": {"type": "realtime", **values},
    }))


def test_real_session_protocol_acknowledges_and_scopes_thinking(live_thinking):
    handler, configs = session_handler()
    assert handler.build_session_created("one").model_dump()["robot790_live_thinking"] is True
    assert update(handler, "one", robot790_reasoning_effort="on", instructions="Keep this") is None
    assert update(handler, "one", robot790_reasoning_effort="none") is None
    receipt = handler.build_session_updated("one").model_dump()
    assert receipt["robot790_live_thinking"] is True
    assert receipt["session"]["robot790_reasoning_effort"] == "none"
    assert configs["one"].session.instructions == "Keep this"
    assert getattr(configs["two"].session, "robot790_reasoning_effort", None) is None
    assert update(handler, "one", robot790_reasoning_effort=["on"], instructions="Bad") == {
        "error": "invalid_thinking_setting"}
    assert configs["one"].session.instructions == "Keep this"
    assert configs["one"].session.robot790_reasoning_effort == "none"
    assert update(handler, "one", robot790_reasoning_effort="on", robot790_thinking_model="different-model") == {
        "error": "invalid_thinking_setting"}
    assert configs["one"].session.robot790_reasoning_effort == "none"


def test_next_request_changes_without_mutating_inflight_or_startup(live_thinking, monkeypatch):
    def generate(self, active, original, turn, options, **kwargs):
        yield from kwargs["request_fn"]([], options)

    monkeypatch.setattr(Handler, "_generate", generate)
    entry.apply_interruptible_chat_generation_patch()
    entered, release = Event(), Event()
    received, captures = [], []

    def create(**kwargs):
        received.append(kwargs)
        if len(received) == 1:
            entered.set()
            assert release.wait(10)
        return iter([])

    monkeypatch.setattr(entry, "_capture_llm_wire_request", lambda **kw: captures.append(kw))
    handler = object.__new__(Handler)
    handler.client = SimpleNamespace(base_url="http://127.0.0.1:1234/v1", chat=SimpleNamespace(
        completions=SimpleNamespace(create=create)))
    handler.model_name, handler.stream, handler.request_timeout = "test", True, 10
    handler._extra_body = {"reasoning_effort": "medium", "chat_template_kwargs": {"preserve": True}}
    handler._iter_events = iter
    handler._generation_is_stale = lambda _: False
    handler._turn_is_latest = lambda *_: True
    sessions, configs = session_handler()
    turn = SimpleNamespace(response=None, runtime_config=configs["one"], gen=0, turn_id=None, turn_revision=None)
    update(sessions, "one", robot790_reasoning_effort="on")

    with ThreadPoolExecutor() as pool:
        first = pool.submit(lambda: list(handler._generate(None, None, turn, {})))
        try:
            assert entered.wait(10)
            update(sessions, "one", robot790_reasoning_effort="none")
            list(handler._generate(None, None, turn, {}))
            assert [call["extra_body"]["reasoning_effort"] for call in received] == ["low", "none"]
        finally:
            release.set()
        first.result(timeout=10)

    turn.runtime_config = configs["two"]
    list(handler._generate(None, None, turn, {}))
    assert [call["extra_body"]["reasoning_effort"] for call in received] == ["low", "none", "medium"]
    assert [call["extra_body"] for call in captures] == [call["extra_body"] for call in received]
    assert handler._extra_body == {"reasoning_effort": "medium", "chat_template_kwargs": {"preserve": True}}
    assert entry._CHAT_REQUEST_EXTRA_BODY.get() is None
    assert all(call["extra_body"]["chat_template_kwargs"] == {"preserve": True} for call in received)
    assert all(call["stream_options"] == {"include_usage": True} for call in received)


@pytest.mark.parametrize("mode,expected", [
    ("on", {"reasoning_effort": "low"}),
    ("none", {"reasoning_effort": "none"}),
    ("medium", {"reasoning_effort": "medium"}),
    ("", {"reasoning_effort": "none"}),
])
def test_override_replaces_conflicting_startup_fields(live_thinking, mode, expected):
    handler = object.__new__(Handler)
    handler.client = SimpleNamespace(base_url="http://localhost:1234/v1")
    handler._extra_body = {"reasoning_effort": "none", "chat_template_kwargs": {"enable_thinking": False}}
    turn = SimpleNamespace(runtime_config=SimpleNamespace(session=SimpleNamespace(robot790_reasoning_effort=mode)))
    assert entry._runtime_chat_extra_body(handler, turn) == expected
    assert handler._extra_body == {"reasoning_effort": "none", "chat_template_kwargs": {"enable_thinking": False}}


@pytest.mark.parametrize("mode,wire_value", [("none", "none"), ("on", "low"), ("medium", "medium"), ("xhigh", "xhigh")])
def test_openai_sdk_serializes_the_per_request_switch(live_thinking, mode, wire_value):
    import httpx
    import json
    from openai import OpenAI

    bodies = []

    def transport(request):
        bodies.append(json.loads(request.content))
        return httpx.Response(200, json={
            "id": "test", "object": "chat.completion", "created": 0,
            "model": "test", "choices": [{"index": 0, "finish_reason": "stop",
                "message": {"role": "assistant", "content": "437"}}],
        })

    with OpenAI(base_url="http://127.0.0.1:1234/v1", api_key="test",
                http_client=httpx.Client(transport=httpx.MockTransport(transport))) as client:
        handler = object.__new__(Handler)
        handler.client, handler.model_name, handler.stream, handler.request_timeout = client, "test", False, 10
        handler._extra_body = {"reasoning_effort": "medium"}
        turn = SimpleNamespace(runtime_config=SimpleNamespace(session=SimpleNamespace(robot790_reasoning_effort=mode)))
        token = entry._CHAT_REQUEST_EXTRA_BODY.set(entry._runtime_chat_extra_body(handler, turn))
        try:
            handler._request([{"role": "user", "content": "19 times 23?"}], {"temperature": 0.8})
        finally:
            entry._CHAT_REQUEST_EXTRA_BODY.reset(token)
    assert bodies[0]["reasoning_effort"] == wire_value
    assert bodies[0]["temperature"] == 0.8
    assert not any(key.startswith("robot790") for key in bodies[0])

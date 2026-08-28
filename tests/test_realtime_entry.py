from types import SimpleNamespace

from robot_790d.realtime_entry import _chat_text_max_tokens_from_env, _runtime_tts_instruct


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

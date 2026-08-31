from types import SimpleNamespace

import numpy as np

from robot_790d.realtime_entry import (
    _append_voice_shape_to_transcript,
    _chat_text_max_tokens_from_env,
    _runtime_tts_instruct,
    _strip_voice_shape_from_transcript,
    _voice_shape_from_transcript,
    _voice_shape_summary,
)


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

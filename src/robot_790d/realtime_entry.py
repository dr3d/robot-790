"""Project-owned speech-to-speech entrypoint for Robot 790 runtime patches."""

from __future__ import annotations

import os
from collections.abc import Iterator
from typing import Any

_VOICE_SHAPE_PREFIX = "[voice-shape:"


def _extra_value(model: Any, name: str) -> Any:
    if model is None:
        return None
    value = getattr(model, name, None)
    if value is not None:
        return value
    extra = getattr(model, "model_extra", None)
    if isinstance(extra, dict):
        return extra.get(name)
    return None


def _output_audio_value(container: Any, name: str) -> Any:
    audio = getattr(container, "audio", None)
    output = getattr(audio, "output", None)
    return _extra_value(output, name)


def _runtime_tts_instruct(tts_input: Any) -> str | None:
    response = getattr(tts_input, "response", None)
    runtime_config = getattr(tts_input, "runtime_config", None)
    session = getattr(runtime_config, "session", None)
    for value in (
        _extra_value(response, "qwen3_tts_instruct"),
        _output_audio_value(response, "qwen3_tts_instruct"),
        _extra_value(session, "qwen3_tts_instruct"),
        _output_audio_value(session, "qwen3_tts_instruct"),
    ):
        if value is not None:
            return str(value).strip()
    return None


def _voice_shape_enabled() -> bool:
    raw = os.environ.get("ROBOT_790_VOICE_SHAPE", "1").strip().lower()
    return raw not in {"0", "false", "off", "no"}


def _voice_shape_bucket_s() -> float:
    raw = os.environ.get("ROBOT_790_VOICE_SHAPE_BUCKET_S", "").strip()
    if not raw:
        return 0.5
    try:
        value = float(raw)
    except ValueError:
        return 0.5
    return min(max(value, 0.25), 2.0)


def _append_voice_shape_to_transcript(transcript: str, voice_shape: str) -> str:
    text = str(transcript or "").strip()
    shape = str(voice_shape or "").strip()
    if not text or not shape:
        return text
    if _VOICE_SHAPE_PREFIX in text:
        return text
    return f"{text}\n{shape}"


def _strip_voice_shape_from_transcript(transcript: str) -> str:
    lines = str(transcript or "").splitlines()
    visible = [line for line in lines if not line.strip().startswith(_VOICE_SHAPE_PREFIX)]
    return "\n".join(visible).strip()


def _voice_shape_from_transcript(transcript: str) -> str:
    for line in str(transcript or "").splitlines():
        value = line.strip()
        if value.startswith(_VOICE_SHAPE_PREFIX):
            return value
    return ""


def _voice_shape_summary(audio: Any, sample_rate: int = 16000) -> str:
    if not _voice_shape_enabled():
        return ""

    try:
        import numpy as np
    except Exception:
        return ""

    try:
        samples = np.asarray(audio, dtype=np.float32).reshape(-1)
    except Exception:
        return ""

    if samples.size < max(1, int(sample_rate * 0.2)):
        return ""

    samples = np.nan_to_num(samples, nan=0.0, posinf=0.0, neginf=0.0)
    if not np.any(np.abs(samples) > 0):
        return ""

    sample_rate = int(sample_rate or 16000)
    duration_s = samples.size / sample_rate
    bucket_s = _voice_shape_bucket_s()
    max_buckets = 16
    if duration_s / bucket_s > max_buckets:
        bucket_s = duration_s / max_buckets

    bucket_size = max(1, int(round(bucket_s * sample_rate)))
    rms_values = []
    buckets = []
    for start in range(0, samples.size, bucket_size):
        end = min(samples.size, start + bucket_size)
        chunk = samples[start:end]
        if chunk.size < max(1, int(sample_rate * 0.08)):
            continue
        rms = float(np.sqrt(np.mean(np.square(chunk))))
        peak = float(np.max(np.abs(chunk)))
        pitch_hz = _estimate_pitch_hz(chunk, sample_rate, np)
        buckets.append((start / sample_rate, end / sample_rate, rms, peak, pitch_hz))
        rms_values.append(rms)

    if not buckets:
        return ""

    active_rms = [value for value in rms_values if value > 0.0001]
    loud_ref = float(np.percentile(active_rms, 90)) if active_rms else max(rms_values)
    loud_ref = max(loud_ref, 0.0001)
    silence_cutoff = max(0.003, loud_ref * 0.08)

    tags = []
    for start_s, end_s, rms, peak, pitch_hz in buckets:
        volume = _volume_tag(rms, loud_ref, silence_cutoff)
        pitch = _pitch_tag(pitch_hz) if volume != "pause" else "none"
        impact = " hit" if volume != "pause" and peak >= max(0.12, rms * 8.0) else ""
        tags.append((start_s, end_s, f"vol={volume} pitch={pitch}{impact}"))

    merged = _merge_voice_shape_tags(tags)
    joined = "; ".join(merged[:max_buckets])
    bucket_note = f"avg={bucket_s:.1f}s"
    return f"{_VOICE_SHAPE_PREFIX} {bucket_note}: {joined}]"


def _estimate_pitch_hz(chunk: Any, sample_rate: int, np: Any) -> float | None:
    if chunk.size < max(1, int(sample_rate * 0.08)):
        return None

    centered = chunk - float(np.mean(chunk))
    rms = float(np.sqrt(np.mean(np.square(centered))))
    if rms < 0.006:
        return None

    max_samples = int(sample_rate * 0.18)
    if centered.size > max_samples:
        centered = centered[:max_samples]

    windowed = centered * np.hanning(centered.size)
    corr = np.correlate(windowed, windowed, mode="full")[windowed.size - 1 :]
    if corr.size == 0 or corr[0] <= 0:
        return None

    min_lag = max(1, int(sample_rate / 350))
    max_lag = min(corr.size - 1, int(sample_rate / 70))
    if max_lag <= min_lag:
        return None

    search = corr[min_lag : max_lag + 1]
    lag = int(np.argmax(search)) + min_lag
    strength = float(corr[lag] / corr[0])
    if strength < 0.28:
        return None
    return sample_rate / lag


def _volume_tag(rms: float, loud_ref: float, silence_cutoff: float) -> str:
    if rms <= silence_cutoff:
        return "pause"
    ratio = rms / loud_ref
    if ratio < 0.28:
        return "quiet"
    if ratio < 0.7:
        return "medium"
    return "loud"


def _pitch_tag(pitch_hz: float | None) -> str:
    if pitch_hz is None:
        return "unclear"
    if pitch_hz < 130:
        return "low"
    if pitch_hz < 210:
        return "mid"
    return "high"


def _merge_voice_shape_tags(tags: list[tuple[float, float, str]]) -> list[str]:
    merged = []
    run_start, run_end, run_tag = tags[0]
    for start_s, end_s, tag in tags[1:]:
        if tag == run_tag:
            run_end = end_s
            continue
        merged.append(_format_voice_shape_range(run_start, run_end, run_tag))
        run_start, run_end, run_tag = start_s, end_s, tag
    merged.append(_format_voice_shape_range(run_start, run_end, run_tag))
    return merged


def _format_voice_shape_range(start_s: float, end_s: float, tag: str) -> str:
    if end_s - start_s <= 0.55:
        return f"{start_s:.1f}s {tag}"
    return f"{start_s:.1f}-{end_s:.1f}s {tag}"


def apply_qwen3_tts_runtime_instruct_patch() -> None:
    from speech_to_speech.TTS.qwen3_tts_handler import Qwen3TTSHandler

    if getattr(Qwen3TTSHandler, "_robot_790_runtime_instruct_patch", False):
        return

    original_process = Qwen3TTSHandler.process

    def process_with_runtime_instruct(self: Any, tts_input: Any) -> Iterator[Any]:
        override = _runtime_tts_instruct(tts_input)
        if override is None:
            yield from original_process(self, tts_input)
            return

        previous = getattr(self, "instruct", None)
        self.instruct = override
        try:
            yield from original_process(self, tts_input)
        finally:
            self.instruct = previous

    Qwen3TTSHandler.process = process_with_runtime_instruct
    Qwen3TTSHandler._robot_790_runtime_instruct_patch = True


def apply_chat_text_token_cap_patch() -> None:
    from speech_to_speech.LLM.chat_completions_language_model import ChatCompletionsApiModelHandler

    if getattr(ChatCompletionsApiModelHandler, "_robot_790_text_token_cap_patch", False):
        return

    original_build_optional_kwargs = ChatCompletionsApiModelHandler._build_optional_kwargs

    def build_optional_kwargs_with_text_cap(self: Any, req_tools: Any, req_tool_choice: Any) -> dict[str, Any]:
        kwargs = original_build_optional_kwargs(self, req_tools, req_tool_choice)
        text_max_tokens = _chat_text_max_tokens_from_env()
        if text_max_tokens is not None:
            kwargs.setdefault("max_tokens", text_max_tokens)
        return kwargs

    ChatCompletionsApiModelHandler._build_optional_kwargs = build_optional_kwargs_with_text_cap
    ChatCompletionsApiModelHandler._robot_790_text_token_cap_patch = True


def apply_parakeet_voice_shape_patch() -> None:
    from speech_to_speech.pipeline.messages import Transcription
    from speech_to_speech.STT.parakeet_tdt_handler import ParakeetTDTSTTHandler

    if getattr(ParakeetTDTSTTHandler, "_robot_790_voice_shape_patch", False):
        return

    original_process = ParakeetTDTSTTHandler.process

    def process_with_voice_shape(self: Any, vad_audio: Any) -> Iterator[Any]:
        audio = getattr(vad_audio, "audio", None)
        sample_rate = int(getattr(self, "sample_rate", 16000) or 16000)
        voice_shape = _voice_shape_summary(audio, sample_rate)

        for output in original_process(self, vad_audio):
            if isinstance(output, Transcription) and output.text and voice_shape:
                text = _append_voice_shape_to_transcript(output.text, voice_shape)
                output = output.model_copy(update={"text": text})
            yield output

    ParakeetTDTSTTHandler.process = process_with_voice_shape
    ParakeetTDTSTTHandler._robot_790_voice_shape_patch = True


def apply_visible_transcript_voice_shape_filter_patch() -> None:
    from speech_to_speech.api.openai_realtime.handlers.conversation import ConversationHandler

    if getattr(ConversationHandler, "_robot_790_voice_shape_filter_patch", False):
        return

    original_on_completed = ConversationHandler.on_transcription_completed

    def on_transcription_completed_without_voice_shape(self: Any, conn_id: str, event: Any) -> list[Any]:
        transcript = getattr(event, "transcript", "")
        voice_shape = _voice_shape_from_transcript(transcript)
        visible_transcript = _strip_voice_shape_from_transcript(transcript)
        if visible_transcript != transcript and hasattr(event, "model_copy"):
            event = event.model_copy(update={"transcript": visible_transcript})
        events = original_on_completed(self, conn_id, event)
        if voice_shape:
            events = [
                output.model_copy(update={"voice_shape": voice_shape})
                if getattr(output, "type", "") == "conversation.item.input_audio_transcription.completed"
                and hasattr(output, "model_copy")
                else output
                for output in events
            ]
        return events

    ConversationHandler.on_transcription_completed = on_transcription_completed_without_voice_shape
    ConversationHandler._robot_790_voice_shape_filter_patch = True


def _chat_text_max_tokens_from_env() -> int | None:
    raw = os.environ.get("ROBOT_790_TEXT_MAX_TOKENS", "").strip()
    if not raw:
        return None
    try:
        value = int(raw)
    except ValueError:
        return None
    return value if value > 0 else None


def main() -> None:
    apply_qwen3_tts_runtime_instruct_patch()
    apply_chat_text_token_cap_patch()
    apply_parakeet_voice_shape_patch()
    apply_visible_transcript_voice_shape_filter_patch()
    from speech_to_speech.s2s_pipeline import main as speech_to_speech_main

    speech_to_speech_main()


if __name__ == "__main__":
    main()

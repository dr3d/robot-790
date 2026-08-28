"""Project-owned speech-to-speech entrypoint for Robot 790 runtime patches."""

from __future__ import annotations

import os
from collections.abc import Iterator
from typing import Any


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
    from speech_to_speech.s2s_pipeline import main as speech_to_speech_main

    speech_to_speech_main()


if __name__ == "__main__":
    main()

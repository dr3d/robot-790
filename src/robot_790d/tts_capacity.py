"""Keep coalesced CustomVoice text within the accelerated decoder's capacity."""

from __future__ import annotations

import logging
import inspect
import re
from collections.abc import Callable, Iterator
from contextvars import ContextVar
from functools import wraps
from types import SimpleNamespace
from typing import Any

logger = logging.getLogger(__name__)
_custom_voice_token_limit: ContextVar[int | None] = ContextVar("custom_voice_token_limit", default=None)
# Coalescing can otherwise send minutes of slow recitation through one decode.
MAX_BATCH_TEXT_TOKENS = 80
# A capacity split should leave a short phrase, not an orphaned word, at the end.
MIN_BATCH_TAIL_CHARS = 24
DECODE_CAPACITY_RESERVE = 32


def split_for_capacity(text: str, fits: Callable[[str], bool]) -> Iterator[str]:
    """Partition verbatim text, preferring sentence and then whitespace boundaries."""
    while text:
        if fits(text):
            yield text
            return
        low, high = 0, len(text)
        while low < high:
            middle = (low + high + 1) // 2
            if fits(text[:middle]):
                low = middle
            else:
                high = middle - 1
        if not low:
            raise ValueError("TTS decoder has no capacity for even one text character")
        # Prefer a reasonably full sentence batch; do not require English words.
        ends = [m.end() for m in re.finditer(r'[.!?。！？][\s\"\'”’]*', text[:low])]
        boundary = next((end for end in reversed(ends) if end >= low // 2), 0)
        if not boundary:
            boundary = max((m.end() for m in re.finditer(r'\s+', text[:low])), default=low)
        part = text[:boundary]
        # Tokenization need not be monotonic at a preferred boundary.
        if not fits(part):
            boundary, part = low, text[:low]
        # Keep complete sentences intact, but move an in-sentence cut earlier
        # if it would leave a tiny final batch (e.g. the single word "for.").
        # Recheck both sides: moving words changes tokenization, and capacity
        # always takes precedence when no safe word boundary is available.
        minimum = min(MIN_BATCH_TAIL_CHARS, max(1, low // 2))
        if boundary not in ends and len(text[boundary:].strip()) < minimum:
            for match in reversed(list(re.finditer(r'\s+', text[:boundary]))):
                candidate = match.end()
                head, tail = text[:candidate], text[candidate:]
                if len(head.strip()) < minimum:
                    break
                if len(tail.strip()) >= minimum and fits(head) and fits(tail):
                    boundary, part = candidate, head
                    break
        yield part
        text = text[boundary:]


def install_tts_capacity_patch() -> None:
    from speech_to_speech.TTS.qwen3_tts_handler import Qwen3TTSHandler
    from faster_qwen3_tts import streaming

    if getattr(Qwen3TTSHandler, "_robot790_capacity_patch", False):
        return
    original_voice = Qwen3TTSHandler._process_custom_voice
    original_decode = streaming.fast_generate_streaming

    @wraps(original_voice)
    def voice(self: Any, text: str) -> Iterator[Any]:
        graph = getattr(getattr(self, "model", None), "talker_graph", None)
        capacity = getattr(graph, "max_seq_len", 0)
        if not capacity or getattr(self, "backend", None) != "faster_qwen3_tts":
            yield from original_voice(self, text)
            return
        tokenizer = self.model.model.processor.tokenizer
        estimate_config = SimpleNamespace(max_new_tokens=2**31 - 1,
                                          streaming_chunk_size=self.streaming_chunk_size)

        def estimate(part: str) -> int:
            return Qwen3TTSHandler._estimate_max_new_tokens(estimate_config, part)

        def fits(part: str) -> bool:
            input_tokens = len(tokenizer.encode(part, add_special_tokens=False))
            # Reserve role/language/speaker tokens and extra room for slow delivery.
            predicted = estimate(part)
            return (input_tokens <= MAX_BATCH_TEXT_TOKENS
                    and predicted <= self.max_new_tokens
                    and input_tokens + 64 + predicted <= capacity * 0.8)

        scope = getattr(self, "cancel_scope", None)
        generation = scope.generation if scope is not None else None
        for index, part in enumerate(split_for_capacity(text, fits), 1):
            if scope is not None and scope.is_stale(generation):
                logger.info("TTS remaining batches cancelled before batch %d", index)
                return
            logger.info("TTS batch %d: chars=%d text_tokens=%d estimated_audio_tokens=%d capacity=%d",
                        index, len(part), len(tokenizer.encode(part, add_special_tokens=False)),
                        self._estimate_max_new_tokens(part), capacity)
            limit_token = _custom_voice_token_limit.set(self.max_new_tokens)
            try:
                yield from original_voice(self, part)
            finally:
                _custom_voice_token_limit.reset(limit_token)

    @wraps(original_decode)
    def decode(*args: Any, **kwargs: Any) -> Iterator[Any]:
        # Bind using the installed library signature so positional calls remain valid.
        bound = inspect.signature(original_decode).bind(*args, **kwargs)
        bound.apply_defaults()
        values = bound.arguments
        prefill = int(values["talker_input_embeds"].shape[1])
        capacity = int(values["talker_graph"].max_seq_len)
        budget = int(values["max_new_tokens"])
        estimated_budget = budget
        configured_limit = _custom_voice_token_limit.get()
        if configured_limit is not None:
            # Text-length estimates assume a speaking rate. A custom style may
            # legitimately take much longer; let EOS finish each small batch,
            # bounded by the configured limit and the actual decoder prefill.
            budget = min(configured_limit, capacity - prefill - DECODE_CAPACITY_RESERVE)
            if budget <= 0:
                raise ValueError("TTS prompt leaves no decoder capacity for speech")
            values["max_new_tokens"] = budget
            logger.info("TTS audio allowance: estimated=%d actual_budget=%d prefill=%d capacity=%d",
                        estimated_budget, budget, prefill, capacity)
        generated, finished, reason = 0, False, "cancelled"
        try:
            for chunk, timing in original_decode(*bound.args, **bound.kwargs):
                generated += int(chunk.shape[0])
                yield chunk, timing
            finished = True
            reason = ("sequence_capacity" if generated >= capacity - prefill else
                      "token_budget" if generated >= budget else "eos")
        except Exception:
            reason = "error"
            raise
        finally:
            log = logger.warning if finished and reason != "eos" else logger.info
            log("TTS decoder stop: reason=%s prefill=%d generated=%d budget=%d capacity=%d",
                reason, prefill, generated, budget, capacity)

    Qwen3TTSHandler._process_custom_voice = voice
    streaming.fast_generate_streaming = decode
    Qwen3TTSHandler._robot790_capacity_patch = True

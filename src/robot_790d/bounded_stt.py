"""Bound Parakeet inference without changing VAD or conversational turn boundaries.

Shared verbatim with the container repo; see docs/sts-maintenance.md.
Only decoded text and audio fingerprints are cached, never GPU tensors or PCM.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from hashlib import sha256
from time import perf_counter

import numpy as np

logger = logging.getLogger(__name__)
MAX_DECODE_SECONDS = 15
CORE_SECONDS = 14
CONTEXT_SECONDS = 0.5


class DecodeDeferred(Exception):
    """The input became stale, the session stopped, or compute is busy."""


@dataclass
class Piece:
    start: int
    end: int
    core_end: int
    fingerprint: bytes
    text: str
    anchors: tuple = ()


def _overlap_prefix(previous, words) -> int:
    """Match acoustic overlap, not arbitrary repeated phrases in the transcript.

    Require at least two matching words with nearby absolute audio timestamps.
    Single-word matches and repeated phrases at different times are left alone.
    """
    def key(word):
        return "".join(c for c in word.casefold() if c.isalnum())

    for count in range(min(len(previous), len(words), 8), 1, -1):
        pairs = list(zip(previous[-count:], words[:count]))
        if all(key(left[0]) and key(left[0]) == key(right[0]) and abs(left[1] - right[1]) <= 0.75
               for left, right in pairs):
            return count
    return 0


def _fingerprint(audio: np.ndarray) -> bytes:
    return sha256(np.ascontiguousarray(audio, dtype=np.float32).view(np.uint8)).digest()


class BoundedTurnTranscriber:
    """Reuse immutable audio prefixes across revisions, including after finals.

    Each core has half a second of acoustic context on either side. Word
    timestamps assign a boundary word to exactly one core; punctuation is not
    required. Actual PCM changes invalidate cached text from the first affected
    window. A short active tail remains revisable.
    """

    def __init__(self, sample_rate: int = 16000):
        self.sample_rate = sample_rate
        self.turn_id = None
        self.pieces: list[Piece] = []
        self.tail: Piece | None = None
        self.warned_alignment = False

    def transcribe(self, audio, turn_id, decode, current=lambda: True) -> str:
        audio = np.asarray(audio)
        if audio.ndim != 1:
            raise ValueError("STT expects mono audio")
        if turn_id is None or turn_id != self.turn_id:
            self.turn_id = turn_id
            self.pieces.clear()
            self.tail = None
        # Verify the prefix rather than assuming all revision changes append.
        valid = 0
        for piece in self.pieces:
            if not current():
                raise DecodeDeferred()
            if piece.end > len(audio) or _fingerprint(audio[piece.start:piece.end]) != piece.fingerprint:
                break
            valid += 1
        if valid != len(self.pieces):
            self.tail = None
        del self.pieces[valid:]
        position = self.pieces[-1].core_end if self.pieces else 0
        core = int(CORE_SECONDS * self.sample_rate)
        context = int(CONTEXT_SECONDS * self.sample_rate)
        text = [piece.text for piece in self.pieces]
        while position < len(audio):
            if not current():
                raise DecodeDeferred()
            complete = len(audio) - position >= core + context
            core_end = position + core if complete else len(audio)
            start = max(0, position - context)
            end = core_end + context if complete else core_end
            fingerprint = _fingerprint(audio[start:end])
            cached = self.tail
            if cached and (cached.start, cached.end, cached.core_end, cached.fingerprint) == (
                start, end, core_end, fingerprint
            ):
                piece = cached
            else:
                window = np.asarray(audio[start:end], dtype=np.float32)
                assert len(window) <= MAX_DECODE_SECONDS * self.sample_rate
                result = decode(window)
                timestamps = getattr(result, "timestamp", None) or {}
                words = timestamps.get("word", []) if isinstance(timestamps, dict) else []
                full_text = str(getattr(result, "text", "")).strip()
                try:
                    aligned = [(str(w["word"]), (float(w["start"]) + float(w["end"])) / 2) for w in words]
                    if full_text and not aligned:
                        raise ValueError("Missing word alignment")
                    if any(not np.isfinite(at) or at < 0 or at > len(window) / self.sample_rate for _, at in aligned):
                        raise ValueError("Invalid word alignment")
                    absolute = [(word, start / self.sample_rate + at) for word, at in aligned]
                    previous = self.pieces[-1].anchors if self.pieces else ()
                    overlap = _overlap_prefix(previous, absolute)
                    selected = [(word, at) for index, (word, at) in enumerate(absolute)
                                if index >= overlap and at * self.sample_rate < core_end
                                and (overlap or at * self.sample_rate >= position)]
                    piece_text = " ".join(word for word, _ in selected)
                    anchors = tuple(selected[-8:])
                except (KeyError, TypeError, ValueError):
                    # A backend without alignment still gets bounded, nonoverlapping
                    # decoding. Never guess at duplicate words in ordinary speech.
                    if not self.warned_alignment:
                        logger.warning("Bounded STT: word alignment unavailable; using nonoverlapping cores")
                        self.warned_alignment = True
                    if start == position and end == core_end:
                        piece_text = full_text
                    else:
                        if not current():
                            raise DecodeDeferred()
                        fallback = decode(np.asarray(audio[position:core_end], dtype=np.float32))
                        piece_text = str(getattr(fallback, "text", "")).strip()
                    anchors = ()
                piece = Piece(start, end, core_end, fingerprint, piece_text, anchors)
            if complete:
                self.pieces.append(piece)
                self.tail = None
            else:
                self.tail = piece
            text.append(piece.text)
            position = core_end
        if not current():
            raise DecodeDeferred()
        return " ".join(part for part in text if part).strip()


def apply_bounded_stt_patch() -> None:
    """Install once, on the CUDA/CPU nano-parakeet backend used by both builds."""
    from speech_to_speech.pipeline.messages import PartialTranscription, Transcription
    from speech_to_speech.STT.parakeet_tdt_handler import ParakeetTDTSTTHandler as Handler

    if getattr(Handler, "_robot790_bounded_stt", False):
        return
    original_process = Handler.process
    original_session_end = Handler.on_session_end

    def process(self, item):
        if self.backend != "nano_parakeet":
            yield from original_process(self, item)
            return
        rate = int(self.sample_rate)
        engine = getattr(self, "_robot790_turn_transcriber", None)
        if engine is None or engine.sample_rate != rate:
            engine = self._robot790_turn_transcriber = BoundedTurnTranscriber(rate)
        progressive = item.mode == "progressive"
        if progressive and not self.enable_live_transcription:
            return

        def current():
            return not self.stop_event.is_set() and self._is_latest_turn_item(
                item, wait_for_pending_reopen=False, wait_for_stability=False
            )

        calls = 0
        max_audio_s = 0.0
        inference_s = 0.0
        lock_s = 0.0

        def decode(window):
            nonlocal calls, max_audio_s, inference_s, lock_s
            if not current():
                raise DecodeDeferred()
            # Release compute between chunks so cancellation / TTS can proceed.
            with self._compute_lock_context("ParakeetSTT-Bounded", timeout=0.01 if progressive else 5.0) as acquired:
                if not acquired or not current():
                    raise DecodeDeferred()
                started = perf_counter()
                try:
                    calls += 1
                    max_audio_s = max(max_audio_s, len(window) / rate)
                    return self.model.transcribe(window, timestamps=True)
                finally:
                    elapsed = perf_counter() - started
                    inference_s += elapsed
                    lock_s = max(lock_s, elapsed)

        started = perf_counter()
        self.processing_final = not progressive
        status = "ok"
        text = ""
        try:
            text = engine.transcribe(item.audio, item.turn_id, decode, current)
            if progressive:
                if text:
                    yield PartialTranscription(text=text, turn_id=item.turn_id, turn_revision=item.turn_revision)
            else:
                language = self.start_language
                if not language or language == "auto":
                    language = self._detect_language_from_text(text[-4000:]) or self.last_language
                self.last_language = language
                self._clear_live_transcription_line()
                yield Transcription(text=text, language_code=language, turn_id=item.turn_id,
                                    turn_revision=item.turn_revision, speech_stopped_at_s=item.created_at_s)
        except DecodeDeferred:
            status = "deferred"
        except Exception:
            status = "error"
            raise
        finally:
            self.processing_final = False
            logger.info(
                "Bounded STT %s turn=%s rev=%s status=%s audio=%.3fs calls=%d max_decode=%.3fs "
                "inference=%.3fs max_lock=%.3fs total=%.3fs chars=%d",
                "progressive" if progressive else "final", item.turn_id, item.turn_revision, status,
                len(item.audio) / rate, calls, max_audio_s, inference_s, lock_s, perf_counter() - started, len(text),
            )
            if not progressive:
                # Retain the timing record consumed by the existing status UI.
                logger.info(
                    "Parakeet final STT done turn=%s rev=%s total=%.3fs lock_scope=%.3fs inference=%.3fs chars=%d",
                    item.turn_id, item.turn_revision, perf_counter() - started, lock_s, inference_s, len(text),
                )

    def session_end(self):
        self._robot790_turn_transcriber = None
        original_session_end(self)

    Handler.process = process
    Handler.on_session_end = session_end
    Handler._robot790_bounded_stt = True
    logger.info("Robot 790 bounded STT enabled: max decode 15s, core 14s; VAD timing unchanged")

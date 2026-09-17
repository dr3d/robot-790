"""Observed synthesis intervals for GPU-chart annotation, not GPU attribution."""

import re
import time
from datetime import datetime
from pathlib import Path

WINDOW_MS = 120_000
ACTIVE_LEASE_MS = 60_000
_STAMP = re.compile(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})")
_PIPELINE = re.compile(r"\[pipeline (\d+)\]")
_FIRST = re.compile(r"Qwen3-TTS TTFA: ([\d.]+)s")
_DONE = re.compile(r"Qwen3-TTS generated [\d.]+s audio in ([\d.]+)s")


def parse_tts_activity(text: str, now_ms: float) -> dict:
    cutoff = now_ms - WINDOW_MS
    pending = {}
    intervals = []
    for line in text.splitlines():
        stamp = _STAMP.match(line)
        if not stamp:
            continue
        try:
            at = datetime.strptime(stamp[1], "%Y-%m-%d %H:%M:%S,%f").timestamp() * 1000
        except ValueError:
            continue
        if at < cutoff or at > now_ms:
            continue
        pipeline = _PIPELINE.search(line)
        key = pipeline[1] if pipeline else "default"
        if "speech_to_speech.TTS.qwen3_tts_handler" in line:
            first, done = _FIRST.search(line), _DONE.search(line)
            if first:
                pending[key] = max(cutoff, at - float(first[1]) * 1000)
            elif done:
                start = max(cutoff, at - float(done[1]) * 1000)
                intervals.append({"start_ms": start, "end_ms": at})
                pending.pop(key, None)
        elif "Response cancelled" in line or "released (session" in line:
            start = pending.pop(key, None)
            if start is not None:
                intervals.append({"start_ms": start, "end_ms": at})
    # In-flight observation expires if a process dies without a completion log.
    active = [start for start in pending.values() if 0 <= now_ms - start <= ACTIVE_LEASE_MS]
    intervals.extend({"start_ms": start, "end_ms": now_ms} for start in active)
    return {"status": "ok", "source": "qwen3_tts_log", "sampled_at_ms": now_ms,
            "active": bool(active), "intervals": intervals[-180:]}


def read_tts_activity(repo_root: Path | None = None) -> dict:
    root = repo_root or Path(__file__).resolve().parents[2]
    now_ms = time.time() * 1000
    try:
        with (root / "logs/sts-realtime.err.log").open("rb") as stream:
            stream.seek(0, 2)
            stream.seek(max(0, stream.tell() - 128_000))
            text = stream.read(128_000).decode("utf-8", errors="replace")
    except OSError:
        return {"status": "unavailable", "sampled_at_ms": now_ms, "active": False, "intervals": []}
    return parse_tts_activity(text, now_ms)

"""Bounded request-shape receipts while passive engine capture is active.

No prompts, image bytes, tool arguments, or generated text are persisted.
Message-prefix equality is not a token-cache hit measurement.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import threading
import time
from collections import OrderedDict
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any

from robot_790d.delivery_audit import audit_delivery

_LOCK = threading.Lock()
_PREVIOUS: OrderedDict = OrderedDict()
_LOGGERS: dict[Path, logging.Logger] = {}


def capture_directory() -> Path:
    return Path(os.getenv("ROBOT_790_METRICS_DIR", "logs/live/llm-metrics"))


def capture_active(directory: Path) -> bool:
    try:
        state = json.loads((directory / "status.json").read_text(encoding="utf-8"))
        now = time.time()
        updated = datetime.fromisoformat(state["updated_at"]).timestamp()
        started = datetime.fromisoformat(state["started_at"]).timestamp()
        hours = float(state["max_hours"])
        return (state["state"] == "recording" and math.isfinite(hours) and 0 < hours <= 24
                and 0 <= now - updated < 30 and started <= now < started + hours * 3600)
    except (OSError, ValueError, TypeError, KeyError, OverflowError):
        return False


def _encoded(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _hash(value: Any) -> str:
    return hashlib.sha256(_encoded(value)).hexdigest()


def request_shape(messages: list[dict], options: dict) -> tuple[dict, list[str]]:
    digests = [_hash(message) for message in messages]
    images = 0
    text_chars = 0
    for message in messages:
        content = message.get("content", "")
        if isinstance(content, str):
            text_chars += len(content)
        elif isinstance(content, list):
            for part in content:
                if not isinstance(part, dict):
                    continue
                if part.get("type") in {"image_url", "input_image"}:
                    images += 1
                if isinstance(part.get("text"), str):
                    text_chars += len(part["text"])
    return {
        "messages": len(messages), "text_characters": text_chars, "image_parts": images,
        "serialized_bytes": len(_encoded(messages)), "messages_sha256": _hash(digests),
        "system_sha256": _hash([m for m in messages if m.get("role") in {"system", "developer"}]),
        "options_sha256": _hash(options), "tools_sha256": _hash(options.get("tools", [])),
        "tool_count": len(options.get("tools") or []),
    }, digests


def _write(directory: Path, row: dict) -> None:
    # Per-process files avoid competing rollover from page and realtime servers.
    with _LOCK:
        if directory not in _LOGGERS:
            directory.mkdir(parents=True, exist_ok=True)
            logger = logging.getLogger(f"robot790.request_diagnostics.{os.getpid()}.{directory}")
            handler = RotatingFileHandler(directory / f"requests-{os.getpid()}.jsonl",
                                          maxBytes=5 * 1024 * 1024, backupCount=2, encoding="utf-8")
            handler.setFormatter(logging.Formatter("%(message)s"))
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)
            logger.propagate = False
            _LOGGERS[directory] = logger
        _LOGGERS[directory].info(json.dumps({
            "observed_at": datetime.now(timezone.utc).isoformat(), "pid": os.getpid(), **row,
        }))


def begin_request(request_id: str, *, family: str, owner: str, model: str,
                  messages: list[dict], options: dict) -> dict | None:
    directory = capture_directory()
    if not capture_active(directory):
        return None
    try:
        shape, digests = request_shape(messages, options)
        if family == "B1":
            delivery = audit_delivery(directory, messages)
            if delivery is not None:
                shape["delivery_audit"] = delivery
        key = (str(directory), family, owner, model)
        with _LOCK:
            previous = _PREVIOUS.get(key)
            if previous:
                previous_id, old = previous
                common = 0
                for left, right in zip(old, digests):
                    if left != right:
                        break
                    common += 1
                shape.update(previous_request_id=previous_id, common_prefix_messages=common,
                             previous_messages=len(old), message_count_delta=len(digests) - len(old))
            _PREVIOUS[key] = (request_id, digests)
            _PREVIOUS.move_to_end(key)
            while len(_PREVIOUS) > 32:
                _PREVIOUS.popitem(last=False)
        _write(directory, {"kind": "request_start", "request_id": request_id,
                           "family": family, "owner": owner, "model": model, **shape})
        return {"directory": directory, "request_id": request_id, "started": time.monotonic()}
    except Exception:
        # Diagnostics must never prevent inference or expose a prompt in an error.
        return None


def finish_request(ticket: dict | None, *, outcome: str, input_tokens: int | None = None,
                   output_tokens: int | None = None) -> None:
    if ticket is None:
        return
    try:
        _write(ticket["directory"], {
            "kind": "request_end", "request_id": ticket["request_id"], "outcome": outcome,
            "elapsed_seconds": round(time.monotonic() - ticket["started"], 3),
            "input_tokens": input_tokens, "output_tokens": output_tokens,
        })
    except Exception:
        pass

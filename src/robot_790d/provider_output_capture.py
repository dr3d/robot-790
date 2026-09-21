"""Opt-in, bounded private samples before provider output normalization."""

from __future__ import annotations

import json
import logging
import math
import os
import threading
from datetime import datetime, timedelta, timezone
from logging.handlers import RotatingFileHandler
from typing import Any
from uuid import uuid4

from robot_790d.request_diagnostics import capture_directory

MAX_REQUESTS = 24
MAX_CHARACTERS = 16_384
MAX_CHUNKS = 2048
FIELDS = ("content", "reasoning_content", "reasoning", "refusal")
_LOCK = threading.Lock()
_ARM = None
_COUNT = 0
_LOGGERS = {}
logger = logging.getLogger(__name__)


def _get(value: Any, name: str, default: Any = None) -> Any:
    return value.get(name, default) if isinstance(value, dict) else getattr(value, name, default)


def _write(directory, row: dict) -> None:
    with _LOCK:
        if directory not in _LOGGERS:
            directory.mkdir(parents=True, exist_ok=True)
            logger = logging.getLogger(f"robot790.provider_output.{os.getpid()}.{directory}")
            handler = RotatingFileHandler(directory / f"provider-output-{os.getpid()}.jsonl",
                                          maxBytes=1024 * 1024, backupCount=2, encoding="utf-8")
            handler.setFormatter(logging.Formatter("%(message)s"))
            logger.addHandler(handler)
            logger.propagate = False
            logger.setLevel(logging.INFO)
            _LOGGERS[directory] = logger
        _LOGGERS[directory].info(json.dumps(row, ensure_ascii=True))


class OutputCapture:
    def __init__(self, directory, arm: str, expires: datetime, request_id: str,
                 stream: bool, extra_body: Any) -> None:
        self.directory = directory
        self.expires = expires
        self.stream = stream
        self.characters = 0
        self.seen_chunks = 0
        self.finished = False
        self.row = {
            "observed_at": datetime.now(timezone.utc).isoformat(), "pid": os.getpid(),
            "arm_id": arm, "request_id": request_id, "stream": stream,
            "boundary": "provider before normalization and private-output filter",
            "chunks": [], "field_characters": {field: 0 for field in FIELDS},
            "finish_reasons": [], "truncated": False,
        }
        if isinstance(extra_body, dict):
            effort = extra_body.get("reasoning_effort")
            if effort in {"none", "low", "medium", "high", "xhigh"}:
                self.row["reasoning_effort"] = effort
            template = extra_body.get("chat_template_kwargs")
            if isinstance(template, dict) and isinstance(template.get("enable_thinking"), bool):
                self.row["enable_thinking"] = template["enable_thinking"]

    def observe(self, response: Any) -> None:
        try:
            self.seen_chunks += 1
            if datetime.now(timezone.utc) >= self.expires:
                self.row["truncated"] = True
                return
            choices = _get(response, "choices", []) or []
            if not choices:
                return
            # STS consumes the first choice only; do not collect tool arguments,
            # image data, prompts, or unrelated provider metadata.
            choice = choices[0]
            finish = _get(choice, "finish_reason")
            if isinstance(finish, str) and finish not in self.row["finish_reasons"]:
                if len(self.row["finish_reasons"]) < 8:
                    self.row["finish_reasons"].append(finish[:64])
            part = _get(choice, "delta" if self.stream else "message")
            fields = {}
            for field in FIELDS:
                text = _get(part, field)
                if not isinstance(text, str) or not text:
                    continue
                self.row["field_characters"][field] += len(text)
                available = MAX_CHARACTERS - self.characters if len(self.row["chunks"]) < MAX_CHUNKS else 0
                sample = text[:available]
                if len(sample) < len(text):
                    self.row["truncated"] = True
                if sample:
                    fields[field] = sample
                    self.characters += len(sample)
            if fields:
                self.row["chunks"].append({"sequence": self.seen_chunks, "fields": fields})
        except Exception:
            self.row["capture_error"] = True

    def wrap(self, response: Any) -> Any:
        if not self.stream:
            self.observe(response)
            return response

        def chunks():
            for chunk in response:
                self.observe(chunk)
                yield chunk

        # The existing cancellation owner still owns/closes the original response.
        return chunks()

    def finish(self, outcome: str) -> None:
        if self.finished:
            return
        self.finished = True
        try:
            self.row.update(outcome=outcome, seen_chunks=self.seen_chunks,
                            captured_characters=self.characters)
            _write(self.directory, self.row)
        except Exception as exc:
            logger.warning("Provider output capture failed: request=%s error=%s; sample not saved",
                           self.row["request_id"], type(exc).__name__)


def begin_output_capture(request_id: str, *, ticket: dict | None,
                         stream: bool, extra_body: Any = None) -> OutputCapture | None:
    global _ARM, _COUNT
    if ticket is None:
        return None
    try:
        directory = ticket["directory"]
        with (directory / "provider-output-capture.json").open("rb") as source:
            raw = source.read(4097)
        if len(raw) > 4096:
            return None
        config = json.loads(raw)
        expires = datetime.fromisoformat(config["expires_at"])
        now = datetime.now(timezone.utc)
        arm = config["arm_id"]
        if (config.get("version") != 1 or not isinstance(arm, str) or not 1 <= len(arm) <= 64
                or not now < expires <= now + timedelta(hours=24)):
            return None
        with _LOCK:
            key = (str(directory), arm)
            if _ARM != key:
                _ARM, _COUNT = key, 0
            if _COUNT >= MAX_REQUESTS:
                return None
            _COUNT += 1
        return OutputCapture(directory, arm, expires, request_id, stream, extra_body)
    except Exception:
        return None


def saved_capture_status(directory) -> list[dict]:
    """Verify readable records, not directory size metadata for an open log."""
    results = []
    for path in sorted(directory.glob("provider-output-*.jsonl*")):
        report = {"file": path.name, "records": 0, "captured_characters": 0,
                  "reasoning_characters": 0, "think_tag_records": 0}
        try:
            with path.open("rb") as source:
                raw = source.read(2 * 1024 * 1024 + 1)
            if len(raw) > 2 * 1024 * 1024:
                raise ValueError("capture file exceeds verification bound")
            report["read_bytes"] = len(raw)
            for line in raw.splitlines():
                if not line.strip():
                    continue
                row = json.loads(line)
                fields = {field: "".join(chunk["fields"].get(field, "") for chunk in row["chunks"])
                          for field in FIELDS}
                report["records"] += 1
                report["captured_characters"] += sum(map(len, fields.values()))
                report["reasoning_characters"] += len(fields["reasoning_content"]) + len(fields["reasoning"])
                report["think_tag_records"] += int(any(
                    "<think>" in text.lower() or "</think>" in text.lower() for text in fields.values()))
                report["last_request_id"] = row["request_id"]
            report["status"] = "verified" if report["records"] else "empty"
        except Exception as exc:
            report.update(status="unavailable", error=type(exc).__name__)
        results.append(report)
    return results


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hours", type=float, default=2)
    parser.add_argument("--stop", action="store_true")
    parser.add_argument("--status", action="store_true")
    args = parser.parse_args()
    directory = capture_directory()
    if args.status:
        print(json.dumps(saved_capture_status(directory), indent=2))
        return
    config = directory / "provider-output-capture.json"
    if args.stop:
        config.unlink(missing_ok=True)
        print("Provider output capture disabled for new requests.")
        return
    if not math.isfinite(args.hours) or not 0 < args.hours <= 24:
        parser.error("hours must be positive and at most 24")
    directory.mkdir(parents=True, exist_ok=True)
    settings = {"version": 1, "arm_id": uuid4().hex,
                "expires_at": (datetime.now(timezone.utc) + timedelta(hours=args.hours)).isoformat()}
    config.write_text(json.dumps(settings, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({**settings, "max_requests_per_process": MAX_REQUESTS,
                      "requires_active_metrics": True, "private_output_text": True}))


if __name__ == "__main__":
    main()

"""Opt-in, time-limited note-presence receipts at the outgoing B1 boundary."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

MAX_BYTES = 1_048_576
MAX_TARGETS = 20


def normalized(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n")


def digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def audit_delivery(directory: Path, messages: list[dict]) -> dict | None:
    """Never change messages or fail inference; never return target/source text."""
    try:
        path = directory / "delivery-audit.json"
        if not path.is_file():
            return None
        with path.open("rb") as stream:
            raw = stream.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise ValueError("size")
        config = json.loads(raw)
        if config.get("version") != 1:
            raise ValueError("version")
        if datetime.fromisoformat(config["expires_at"]) <= datetime.now(timezone.utc):
            return None
        targets = config["targets"]
        if not isinstance(targets, list) or not 1 <= len(targets) <= MAX_TARGETS:
            raise ValueError("targets")
        expected = []
        for index, target in enumerate(targets):
            text = target["text"]
            if not isinstance(text, str) or not text.strip():
                raise ValueError("text")
            expected.append((index, normalized(text).rstrip()))
        parts = []
        for index, message in enumerate(messages):
            role = message.get("role")
            role = role if role in {"system", "developer", "user", "assistant", "tool"} else "other"
            content = message.get("content")
            if isinstance(content, str):
                parts.append((index, role, 0, normalized(content)))
            elif isinstance(content, list):
                for part_index, part in enumerate(content):
                    if isinstance(part, dict) and isinstance(part.get("text"), str):
                        parts.append((index, role, part_index, normalized(part["text"])))
        receipts = []
        for index, text in expected:
            locations = []
            for message_index, role, part_index, content in parts:
                offset = content.find(text)
                if offset >= 0:
                    locations.append({"message_index": message_index, "role": role,
                                      "part_index": part_index, "character_offset": offset})
            receipts.append({"target_index": index, "sha256": digest(text), "characters": len(text),
                             "present": bool(locations), "locations": locations[:4]})
        return {"status": "checked", "config_sha256": hashlib.sha256(raw).hexdigest(),
                "normalization": "LF; expected trailing whitespace removed", "targets": receipts}
    except Exception:
        return {"status": "unavailable"}


def prepare(session: str, directory: Path, *, hours: float = 2) -> dict:
    from robot_790d.context_history import context_history_plan
    from robot_790d.continuity import select_continuity_session
    from robot_790d.note_brains import parse_note_brains
    from robot_790d.sts_page_server import runtime_config

    if not 0 < hours <= 24:
        raise ValueError("Audit hours must be between zero and 24.")
    selection = select_continuity_session(session)
    history = context_history_plan(selection, **runtime_config()["context_history"])
    # This audit deliberately targets ordinary notes/history, not routed setup-card projections.
    targets = [{"source_filename": note["filename"], "text": note["content"]}
               for note in history["history_notes"]]
    if any(parse_note_brains(target["text"])[1] for target in targets):
        raise ValueError("Routed cards require projected B1 targets; this audit expects ordinary notes.")
    if not 1 <= len(targets) <= MAX_TARGETS:
        raise ValueError("Audit supports one to twenty expected notes.")
    value = {"version": 1, "session_filename": session,
             "expires_at": (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat(),
             "targets": targets}
    raw = json.dumps(value, ensure_ascii=False, indent=2).encode("utf-8")
    if len(raw) > MAX_BYTES:
        raise ValueError("Expected-note snapshot exceeds audit limit.")
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "delivery-audit.json").write_bytes(raw)
    return {"session_filename": session, "expires_at": value["expires_at"],
            "targets": [{"target_index": i, "source_filename": t["source_filename"],
                         "characters": len(normalized(t["text"]).rstrip()),
                         "sha256": digest(normalized(t["text"]).rstrip())}
                        for i, t in enumerate(targets)]}


def main() -> None:
    from robot_790d.request_diagnostics import capture_directory

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("session")
    parser.add_argument("--hours", type=float, default=2)
    args = parser.parse_args()
    print(json.dumps(prepare(args.session, capture_directory(), hours=args.hours), indent=2))


if __name__ == "__main__":
    main()

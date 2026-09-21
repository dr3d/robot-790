"""Pure context-rewrite primitives. Not connected to live history or scheduling."""

from __future__ import annotations

import copy
import re
from typing import Any

RUNTIME_PREFIX = (
    "[STS runtime]\n\nPrivate controller update, not spoken dialogue. "
    "Changed sections supersede earlier versions; other sections remain unchanged.\n\n"
)
RUNTIME_SUFFIX = "\n\n[End STS runtime]"
SECTION_NAMES = frozenset({"runtime", "sensing_text", "search_receipts", "idle_art", "alone_ledger"})
REPLACEABLE = frozenset({"runtime", "alone_ledger"})


def render_runtime(sections: dict[str, str]) -> str:
    return RUNTIME_PREFIX + "\n\n".join(f"{key}:\n{value}" for key, value in sections.items()) + RUNTIME_SUFFIX


def parse_runtime(message: dict[str, Any]) -> dict[str, str] | None:
    """Recognize only the exact controller-owned envelope; opaque records survive."""
    text = message.get("content")
    if message.get("role") != "assistant" or message.get("tool_calls") or not isinstance(text, str):
        return None
    if not text.startswith(RUNTIME_PREFIX) or not text.endswith(RUNTIME_SUFFIX):
        return None
    body = text[len(RUNTIME_PREFIX):-len(RUNTIME_SUFFIX)]
    parts = re.split(r"\n\n(?=[a-z_]+:\n)", body)
    sections = {}
    for part in parts:
        key, sep, value = part.partition(":\n")
        if not sep or key not in SECTION_NAMES or key in sections:
            return None
        sections[key] = value
    return sections if sections and render_runtime(sections) == text else None


def require_closed_tools(messages: list[dict[str, Any]]) -> None:
    pending = set()
    for message in messages:
        for call in message.get("tool_calls", []):
            call_id = call.get("id")
            if not isinstance(call_id, str) or not call_id or call_id in pending:
                raise ValueError("Invalid tool-call identity; cannot rewrite context.")
            pending.add(call_id)
        if message.get("role") == "tool":
            call_id = message.get("tool_call_id")
            if call_id not in pending:
                raise ValueError("Unpaired tool receipt; cannot rewrite context.")
            pending.remove(call_id)
    if pending:
        raise ValueError("Unfinished tool call; wait for a completed boundary.")


def fold_runtime_snapshots(wire: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    """At a rollover boundary, discard superseded volatile state, never speech."""
    require_closed_tools(wire["messages"])
    parsed = [parse_runtime(message) for message in wire["messages"]]
    latest = {key: i for i, sections in enumerate(parsed) if sections
              for key in sections if key in REPLACEABLE}
    candidate = copy.deepcopy(wire)
    messages = []
    removed = []
    for i, (message, sections) in enumerate(zip(candidate["messages"], parsed, strict=True)):
        if sections is None:
            messages.append(message)
            continue
        kept = {key: value for key, value in sections.items()
                if key not in REPLACEABLE or latest[key] == i}
        omitted = [key for key in sections if key not in kept]
        if omitted:
            removed.append({"source_message": i, "sections": omitted,
                            "superseded_by": {key: latest[key] for key in omitted}})
        if kept:
            message["content"] = render_runtime(kept)
            messages.append(message)
    candidate["messages"] = messages
    require_closed_tools(messages)
    return candidate, {"source_messages": len(wire["messages"]), "retained_messages": len(messages),
                       "removed_sections": removed,
                       "policy": "Only superseded runtime/alone_ledger sections; other records unchanged."}

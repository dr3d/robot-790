from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from robot_790d.note_files import find_existing_note_path, read_note_file, resolve_note_path, write_note_file

PASSIVATED_SESSION_HEADER = "Eric Passivated State Transcript"
DEFAULT_PASSIVATED_NOTE = "core/passivated_eric_state.txt"
DEFAULT_SESSION_NOTES_DIR = "sessions"


@dataclass(frozen=True)
class PassivatedSession:
    index: int
    source_filename: str
    created: str
    first_turn: str
    last_turn: str
    conversation_lines: str
    model: str
    context_mode: str
    previous_loaded_notes: str
    search_receipts: str
    session_demarcation: str
    runtime_at_save: str
    transcript: str
    brain2_notes: str
    brain2_tail: str
    raw: str


def extract_passivated_session_notes(
    instance_path: str | Path | None = None,
    *,
    source_filename: str = DEFAULT_PASSIVATED_NOTE,
    output_dir: str = DEFAULT_SESSION_NOTES_DIR,
    overwrite: bool = False,
) -> dict[str, object]:
    note = read_note_file(instance_path, source_filename)
    sessions = parse_passivated_sessions(note.content, source_filename=note.filename)
    written: list[dict[str, object]] = []
    for session in sessions:
        filename = unique_session_note_filename(
            instance_path,
            session,
            output_dir=output_dir,
            overwrite=overwrite,
        )
        content = format_passivated_session_note(session, source_chars=len(note.content))
        written_note = write_note_file(instance_path, filename, content)
        written.append(
            {
                "filename": written_note.filename,
                "characters": len(content),
                "session_index": session.index,
                "first_turn": session.first_turn,
                "last_turn": session.last_turn,
                "conversation_lines": _int_or_none(session.conversation_lines),
            }
        )
    return {
        "status": "ok",
        "tool": "extract_passivated_session_notes",
        "source_filename": note.filename,
        "output_dir": safe_note_folder(output_dir),
        "session_count": len(sessions),
        "written_count": len(written),
        "notes": written,
    }


def parse_passivated_sessions(content: str, *, source_filename: str = DEFAULT_PASSIVATED_NOTE) -> list[PassivatedSession]:
    text = str(content or "").replace("\r\n", "\n").strip()
    if not text:
        raise ValueError("Passivated state note is empty.")
    blocks = split_passivated_blocks(text)
    return [
        parse_passivated_session_block(block, index=index + 1, source_filename=source_filename)
        for index, block in enumerate(blocks)
    ]


def split_passivated_blocks(text: str) -> list[str]:
    matches = list(re.finditer(rf"(?m)^{re.escape(PASSIVATED_SESSION_HEADER)}\s*$", text))
    if len(matches) <= 1:
        return [text]
    blocks = []
    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[start:end].strip()
        if block:
            blocks.append(block)
    return blocks or [text]


def parse_passivated_session_block(block: str, *, index: int, source_filename: str) -> PassivatedSession:
    session_demarcation = section_text(block, "Session Demarcation")
    runtime_at_save = section_text(block, "Runtime At Save")
    transcript = section_text(block, "Transcript Since Clean Connect")
    brain2_notes = section_text(block, "B2 Notes For Eric")
    brain2_tail = section_text(block, "Recent Brain2 Tail")
    metadata = section_key_values(session_demarcation)
    return PassivatedSession(
        index=index,
        source_filename=source_filename,
        created=line_value(block, "Created"),
        first_turn=metadata.get("First transcript turn on disk", ""),
        last_turn=metadata.get("Last transcript turn on disk", ""),
        conversation_lines=metadata.get("Conversation lines", ""),
        model=metadata.get("Model", ""),
        context_mode=metadata.get("Context mode at save", ""),
        previous_loaded_notes=metadata.get("Previous-run loaded notes", ""),
        search_receipts=metadata.get("Search receipts", ""),
        session_demarcation=session_demarcation,
        runtime_at_save=runtime_at_save,
        transcript=transcript or "[none]",
        brain2_notes=brain2_notes or "- none",
        brain2_tail=brain2_tail or "[none]",
        raw=block,
    )


def format_passivated_session_note(session: PassivatedSession, *, source_chars: int) -> str:
    lines = [
        "Robot 790 Extracted Session Note",
        "================================",
        f"Source passivated note: {session.source_filename}",
        f"Source characters: {source_chars}",
        f"Session index in source: {session.index}",
        f"Created from passivated record: {session.created or 'unknown'}",
        f"First transcript turn: {session.first_turn or 'unknown'}",
        f"Last transcript turn: {session.last_turn or 'unknown'}",
        f"Conversation lines: {session.conversation_lines or 'unknown'}",
        f"Context mode at save: {session.context_mode or 'unknown'}",
        f"Previous-run loaded notes: {session.previous_loaded_notes or 'none'}",
        f"Search receipts: {session.search_receipts or 'none'}",
        "",
        "Use",
        "---",
        "This is a permanent session note extracted from a passivated transcript.",
        "It preserves the session transcript and receipts; it is not an AI summary.",
        "Treat it as prior conversation continuity and stale-session evidence, not live sensor truth.",
        "",
        "Session Demarcation",
        "-------------------",
        session.session_demarcation or "[none]",
        "",
        "Runtime At Save",
        "---------------",
        session.runtime_at_save or "[none]",
        "",
        "Transcript",
        "----------",
        session.transcript,
        "",
        "B2 Notes For Eric",
        "------------------",
        session.brain2_notes,
        "",
        "Recent Brain2 Tail",
        "------------------",
        session.brain2_tail,
        "",
    ]
    return "\n".join(lines)


def section_text(text: str, heading: str) -> str:
    pattern = re.compile(
        rf"(?ms)^{re.escape(heading)}\s*\n-+\s*\n(.*?)(?=^[^\n]+\s*\n-+\s*\n|\Z)"
    )
    match = pattern.search(text)
    return match.group(1).strip() if match else ""


def section_key_values(section: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in str(section or "").splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        values[key.strip()] = value.strip()
    return values


def line_value(text: str, key: str) -> str:
    match = re.search(rf"(?m)^{re.escape(key)}:\s*(.+)$", text)
    return match.group(1).strip() if match else ""


def unique_session_note_filename(
    instance_path: str | Path | None,
    session: PassivatedSession,
    *,
    output_dir: str,
    overwrite: bool,
) -> str:
    folder = safe_note_folder(output_dir)
    base = session_filename_base(session)
    candidate = f"{folder}/{base}.txt"
    if overwrite:
        return candidate
    for suffix in ["", *[f"-{index:02d}" for index in range(2, 100)]]:
        filename = f"{folder}/{base}{suffix}.txt"
        try:
            path = find_existing_note_path(filename, instance_path)
        except ValueError:
            path = resolve_note_path(filename, instance_path)
        if not path.exists():
            return filename
    raise ValueError(f"Could not find an unused filename for {candidate}.")


def session_filename_base(session: PassivatedSession) -> str:
    for value in (session.first_turn, session.created):
        timestamp = timestamp_from_text(value)
        if timestamp:
            return f"passivated-session-{timestamp}"
    return f"passivated-session-{session.index:03d}"


def timestamp_from_text(value: str) -> str:
    text = str(value or "")
    iso = re.search(r"\((\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})", text)
    if iso:
        return f"{iso.group(1).replace('-', '')}-{iso.group(2)}{iso.group(3)}{iso.group(4)}"
    local = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?", text, re.I)
    if local:
        month, day, year, hour, minute, second, ampm = local.groups()
        hour_int = int(hour)
        if ampm:
            upper = ampm.upper()
            if upper == "PM" and hour_int != 12:
                hour_int += 12
            if upper == "AM" and hour_int == 12:
                hour_int = 0
        return f"{int(year):04d}{int(month):02d}{int(day):02d}-{hour_int:02d}{int(minute):02d}{int(second):02d}"
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return ""
    return parsed.strftime("%Y%m%d-%H%M%S")


def safe_note_folder(value: str) -> str:
    folder = str(value or DEFAULT_SESSION_NOTES_DIR).replace("\\", "/").strip().strip("/")
    if not folder:
        folder = DEFAULT_SESSION_NOTES_DIR
    parts = [
        re.sub(r"[^a-zA-Z0-9_-]+", "_", part).strip("_")
        for part in folder.split("/")
        if part and part not in {".", ".."}
    ]
    return "/".join(parts) or DEFAULT_SESSION_NOTES_DIR


def _int_or_none(value: Any) -> int | None:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None

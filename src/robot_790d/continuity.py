from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from robot_790d.note_files import (
    delete_note_file,
    find_existing_note_path,
    list_note_files,
    read_note_file,
    write_note_file,
)

CONTINUITY_SESSION_HEADER = "STS Session Note"
LEGACY_CONTINUITY_SESSION_HEADERS = ("Robot 790 Session Note", "Robot 790 Continuity Session")
DEFAULT_CONTINUITY_SESSION_DIR = "sessions"
ARCHIVED_CONTINUITY_SESSION_DIR = "sessions/archived"


@dataclass(frozen=True)
class PinnedNoteReceipt:
    filename: str
    characters: int | None
    sha256: str | None
    status: str


def current_continuity_session(
    instance_path: str | Path | None = None,
) -> dict[str, object]:
    sessions = list_continuity_sessions(instance_path)["sessions"]
    if not sessions:
        return {
            "status": "unavailable",
            "tool": "current_continuity_session",
            "reason": "No session notes are available yet.",
        }

    session_filename = str(sessions[0]["filename"])
    session = read_note_file(instance_path, session_filename)
    metadata = continuity_session_metadata(session.content)
    if not metadata:
        raise ValueError(f"{session.filename} is not a session note.")
    receipts = _parse_pinned_note_receipts(session.content)
    return {
        "status": "ok",
        "tool": "current_continuity_session",
        "selection": "latest",
        "session_filename": session.filename,
        "parent_session_filename": metadata["parent_session_filename"],
        "parent_session_status": _continuity_session_reference_status(
            instance_path, metadata["parent_session_filename"]
        ),
        "pinned_notes": [_receipt_with_current_state(instance_path, receipt) for receipt in receipts],
        "created": metadata["created"],
    }


def list_continuity_sessions(
    instance_path: str | Path | None = None,
) -> dict[str, object]:
    sessions: list[dict[str, object]] = []
    for filename in list_note_files(instance_path):
        normalized = filename.replace("\\", "/")
        if not _looks_like_continuity_session_filename(normalized):
            continue
        try:
            note = read_note_file(instance_path, normalized)
        except (FileNotFoundError, ValueError):
            continue
        metadata = continuity_session_metadata(note.content)
        if not metadata:
            continue
        sessions.append(
            {
                "filename": note.filename,
                "created": metadata["created"],
                "parent_session_filename": metadata["parent_session_filename"],
                "characters": len(note.content),
                "current": False,
            }
        )

    sessions.sort(
        key=lambda item: _session_sort_key(str(item["filename"]), str(item.get("created") or "")),
        reverse=True,
    )
    current_filename = str(sessions[0]["filename"]) if sessions else ""
    for session in sessions:
        session["current"] = str(session["filename"]).lower() == current_filename.lower()
    return {
        "status": "ok",
        "tool": "list_continuity_sessions",
        "current_session_filename": current_filename,
        "sessions": sessions,
    }


def select_continuity_session(
    session_filename: str,
    instance_path: str | Path | None = None,
) -> dict[str, object]:
    filename = _normalize_session_filename(instance_path, session_filename)
    if not filename:
        raise ValueError("No session note filename was provided.")
    note = read_note_file(instance_path, filename)
    metadata = continuity_session_metadata(note.content)
    if not metadata:
        raise ValueError(f"{note.filename} is not a session note.")
    receipts = _parse_pinned_note_receipts(note.content)
    return {
        "status": "ok",
        "tool": "select_continuity_session",
        "selection": "explicit",
        "session_filename": note.filename,
        "parent_session_filename": metadata["parent_session_filename"],
        "parent_session_status": _continuity_session_reference_status(
            instance_path, metadata["parent_session_filename"]
        ),
        "pinned_notes": [_receipt_with_current_state(instance_path, receipt) for receipt in receipts],
        "created": metadata["created"],
    }


def archive_continuity_session(
    session_filename: str,
    instance_path: str | Path | None = None,
) -> dict[str, object]:
    filename = _normalize_session_filename(instance_path, session_filename)
    if not filename:
        raise ValueError("No session note filename was provided.")

    sessions = list_continuity_sessions(instance_path)["sessions"]
    active_filenames = {str(session["filename"]).lower() for session in sessions}
    if filename.lower() not in active_filenames:
        raise ValueError(f"{filename} is not an active session note.")
    if len(sessions) <= 1:
        raise ValueError("Cannot archive the only active session note.")

    note = read_note_file(instance_path, filename)
    metadata = continuity_session_metadata(note.content)
    if not metadata:
        raise ValueError(f"{note.filename} is not a session note.")

    archived_filename = _unique_archived_session_filename(instance_path, note.filename)
    archived = write_note_file(instance_path, archived_filename, note.content)
    delete_note_file(instance_path, note.filename)
    refreshed = list_continuity_sessions(instance_path)
    return {
        "status": "ok",
        "tool": "archive_continuity_session",
        "session_filename": note.filename,
        "archived_session_filename": archived.filename,
        "current_session_filename": refreshed["current_session_filename"],
        "sessions": refreshed["sessions"],
    }


def save_continuity_session(
    body: str,
    pinned_filenames: list[str] | tuple[str, ...],
    instance_path: str | Path | None = None,
    *,
    parent_session_filename: str = "",
    output_dir: str = DEFAULT_CONTINUITY_SESSION_DIR,
    created_at: datetime | None = None,
    created_label: str = "",
    filename_timestamp: str = "",
) -> dict[str, object]:
    text = str(body or "").strip()
    if not text:
        raise ValueError("Session note body is empty.")

    parent = _normalize_session_filename(instance_path, parent_session_filename)
    if parent:
        parent_note = read_note_file(instance_path, parent)
        if not continuity_session_metadata(parent_note.content):
            raise ValueError(f"Parent session note is not valid: {parent_note.filename}")

    created = created_at or datetime.now().astimezone()
    session_filename = _unique_continuity_session_filename(
        instance_path,
        output_dir=output_dir,
        timestamp=filename_timestamp or created.strftime("%Y%m%d-%H%M%S-%f")[:-3],
    )
    receipts = _pinned_note_receipts(instance_path, pinned_filenames)
    content = format_continuity_session_note(
        body=text,
        session_filename=session_filename,
        parent_session_filename=parent,
        created_label=created_label or created.isoformat(timespec="seconds"),
        pinned_notes=receipts,
    )
    session = write_note_file(instance_path, session_filename, content)
    return {
        "status": "ok",
        "tool": "save_continuity_session",
        "selection": "latest",
        "session_filename": session.filename,
        "parent_session_filename": parent or None,
        "pinned_notes": [_receipt_payload(receipt) for receipt in receipts],
        "characters": len(session.content),
    }


def rewind_continuity_session(
    instance_path: str | Path | None = None,
) -> dict[str, object]:
    current = current_continuity_session(instance_path)
    if current["status"] != "ok":
        raise ValueError("No current session note is available for Connect Previous.")

    sessions = list_continuity_sessions(instance_path)["sessions"]
    ordered = list(reversed(sessions))
    current_key = str(current["session_filename"]).lower()
    current_index = next(
        (index for index, session in enumerate(ordered) if str(session["filename"]).lower() == current_key),
        -1,
    )
    if current_index <= 0:
        raise ValueError("The current session note has no earlier timestamped session.")

    previous_filename = str(ordered[current_index - 1]["filename"])
    previous_note = read_note_file(instance_path, previous_filename)
    previous_metadata = continuity_session_metadata(previous_note.content)
    if not previous_metadata:
        raise ValueError(f"Previous session note is not valid: {previous_note.filename}")
    return {
        "status": "ok",
        "tool": "rewind_continuity_session",
        "archived_session_filename": current["session_filename"],
        "restored_session_filename": previous_note.filename,
        "restored_parent_session_filename": previous_metadata["parent_session_filename"],
    }


def continuity_session_metadata(content: str) -> dict[str, object] | None:
    text = str(content or "").replace("\r\n", "\n")
    if not _has_session_note_header(text):
        return None
    return {
        "created": _line_value(text, "Created"),
        "parent_session_filename": _line_value(text, "Parent session"),
        "pinned_notes": [_receipt_payload(receipt) for receipt in _parse_pinned_note_receipts(text)],
    }


def format_continuity_session_note(
    *,
    body: str,
    session_filename: str,
    parent_session_filename: str,
    created_label: str,
    pinned_notes: list[PinnedNoteReceipt],
) -> str:
    lines = [
        CONTINUITY_SESSION_HEADER,
        "============================",
        f"Created: {created_label}",
        f"Session note: {session_filename}",
        f"Parent session: {parent_session_filename or 'none'}",
        "",
        "Use",
        "---",
        "This is the saved latest transcript/context from one sit-down. Load it when resuming from this run.",
        (
            "The filename should carry the PM caption. "
            "Current sensors, tools, and time still need fresh runtime truth."
        ),
        "",
        "How This Run Got Here",
        "-----------------------",
        f"- Saved session note: {session_filename}",
        f"- Parent session note: {parent_session_filename or 'none'}",
        "- Pinned notes expected at boot are listed below with save-time receipts.",
        "",
        "Pinned Context At Save",
        "-----------------------",
    ]
    if pinned_notes:
        for receipt in pinned_notes:
            lines.append(f"- {receipt.filename}")
            if receipt.status == "ok":
                lines.append(f"  {receipt.characters} chars | sha256:{receipt.sha256}")
            else:
                lines.append("  missing when session was saved")
    else:
        lines.append("- none")
    return "\n".join([*lines, "", body.strip(), ""])


def _line_value(content: str, key: str) -> str:
    match = re.search(rf"(?mi)^{re.escape(key)}:\s*(.+)$", str(content or ""))
    value = match.group(1).strip() if match else ""
    return "" if value.lower() == "none" else value


def _normalize_session_filename(instance_path: str | Path | None, value: str) -> str:
    filename = str(value or "").strip()
    if not filename or filename.lower() == "none":
        return ""
    return read_note_file(instance_path, filename).filename


def _pinned_note_receipts(
    instance_path: str | Path | None,
    filenames: list[str] | tuple[str, ...],
) -> list[PinnedNoteReceipt]:
    receipts: list[PinnedNoteReceipt] = []
    for filename in _dedupe_filenames(filenames):
        try:
            note = read_note_file(instance_path, filename)
        except FileNotFoundError:
            receipts.append(PinnedNoteReceipt(filename=filename, characters=None, sha256=None, status="missing"))
            continue
        digest = hashlib.sha256(note.content.encode("utf-8")).hexdigest()
        receipts.append(
            PinnedNoteReceipt(
                filename=note.filename,
                characters=len(note.content),
                sha256=digest,
                status="ok",
            )
        )
    return receipts


def _parse_pinned_note_receipts(content: str) -> list[PinnedNoteReceipt]:
    section = _section_text(content, "Pinned Context At Save", "Session Demarcation")
    receipts: list[PinnedNoteReceipt] = []
    lines = section.splitlines()
    index = 0
    while index < len(lines):
        match = re.match(r"^\s*-\s+(.+?)\s*$", lines[index])
        if not match:
            index += 1
            continue
        filename = match.group(1).strip()
        index += 1
        if not filename or filename.lower() == "none":
            continue
        detail = lines[index].strip() if index < len(lines) and lines[index].startswith("  ") else ""
        if detail:
            index += 1
        detail_match = re.match(r"^(\d+) chars \| sha256:([0-9a-f]{64})$", detail)
        receipts.append(
            PinnedNoteReceipt(
                filename=filename,
                characters=int(detail_match.group(1)) if detail_match else None,
                sha256=detail_match.group(2) if detail_match else None,
                status="ok" if detail_match else "missing",
            )
        )
    return receipts


def _section_text(content: str, heading: str, next_heading: str) -> str:
    match = re.search(rf"(?m)^{re.escape(heading)}\s*\n-+\s*\n", str(content or ""))
    if not match:
        return ""
    body = str(content)[match.end():]
    boundary = re.search(rf"(?m)^{re.escape(next_heading)}\s*\n-+\s*\n", body)
    return body[:boundary.start()].strip() if boundary else body.strip()


def _receipt_payload(receipt: PinnedNoteReceipt) -> dict[str, Any]:
    return {
        "filename": receipt.filename,
        "characters": receipt.characters,
        "sha256": receipt.sha256,
        "status": receipt.status,
    }


def _receipt_with_current_state(
    instance_path: str | Path | None,
    receipt: PinnedNoteReceipt,
) -> dict[str, Any]:
    payload = _receipt_payload(receipt)
    try:
        note = read_note_file(instance_path, receipt.filename)
    except FileNotFoundError:
        payload["current_status"] = "missing"
        return payload

    current_digest = hashlib.sha256(note.content.encode("utf-8")).hexdigest()
    payload["current_characters"] = len(note.content)
    payload["current_sha256"] = current_digest
    if receipt.status != "ok":
        payload["current_status"] = "added"
    elif receipt.characters == len(note.content) and receipt.sha256 == current_digest:
        payload["current_status"] = "match"
    else:
        payload["current_status"] = "changed"
    return payload


def _continuity_session_reference_status(
    instance_path: str | Path | None,
    filename: str,
) -> str:
    if not filename:
        return "none"
    try:
        note = read_note_file(instance_path, filename)
    except FileNotFoundError:
        return "missing"
    except ValueError:
        return "invalid"
    return "available" if continuity_session_metadata(note.content) else "invalid"


def _dedupe_filenames(values: list[str] | tuple[str, ...] | Any) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values or []:
        filename = str(value or "").strip()
        key = filename.lower()
        if not filename or key == "none" or key in seen:
            continue
        seen.add(key)
        result.append(filename)
    return result


def _unique_continuity_session_filename(
    instance_path: str | Path | None,
    *,
    output_dir: str,
    timestamp: str,
) -> str:
    folder = safe_note_folder(output_dir)
    normalized_stamp = re.sub(r"[^0-9-]", "", timestamp) or datetime.now().strftime("%Y%m%d-%H%M%S-%f")[:-3]
    for suffix in ["", *[f"-{index:02d}" for index in range(2, 100)]]:
        filename = f"{folder}/session-{normalized_stamp}{suffix}.txt"
        try:
            path = find_existing_note_path(filename, instance_path)
        except ValueError:
            continue
        if not path.exists():
            return filename
    raise ValueError("Could not find an unused session-note filename.")


def _unique_archived_session_filename(instance_path: str | Path | None, filename: str) -> str:
    source_name = Path(str(filename).replace("\\", "/")).name
    source_path = Path(source_name)
    stem = source_path.stem or "session"
    suffix = source_path.suffix or ".txt"
    for extra in ["", *[f"-{index:02d}" for index in range(2, 100)]]:
        candidate = f"{ARCHIVED_CONTINUITY_SESSION_DIR}/{stem}{extra}{suffix}"
        try:
            path = find_existing_note_path(candidate, instance_path)
        except ValueError:
            continue
        if not path.exists():
            return candidate
    raise ValueError("Could not find an unused archived session-note filename.")


def safe_note_folder(value: str) -> str:
    folder = str(value or DEFAULT_CONTINUITY_SESSION_DIR).replace("\\", "/").strip().strip("/")
    if not folder:
        folder = DEFAULT_CONTINUITY_SESSION_DIR
    parts = [
        re.sub(r"[^a-zA-Z0-9_-]+", "_", part).strip("_")
        for part in folder.split("/")
        if part and part not in {".", ".."}
    ]
    return "/".join(parts) or DEFAULT_CONTINUITY_SESSION_DIR


def _looks_like_continuity_session_filename(filename: str) -> bool:
    return bool(re.match(r"^sessions/[^/]+\.txt$", filename, re.I))


def _session_sort_key(filename: str, created: str) -> str:
    match = re.search(r"(?:continuity-session-|session-)?(\d{8}-\d{6}(?:-\d{3})?)", filename)
    if match:
        return match.group(1)
    return timestamp_from_text(created) or filename


def _has_session_note_header(text: str) -> bool:
    return any(header in text for header in (CONTINUITY_SESSION_HEADER, *LEGACY_CONTINUITY_SESSION_HEADERS))


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

"""Project saved context into swept sessions, optionally summarizing older history.

Raw manifests choose membership; derivatives never introduce pins or lineage.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from robot_790d.continuity import (
    continuity_session_metadata,
    continuity_session_variant_metadata,
    continuity_session_variant_records,
)
from robot_790d.note_files import read_note_file
from robot_790d.session_preparation import SWEEP_VERSION, digest, prepared_variant


def history_config(value: Any) -> dict[str, int | bool]:
    config = value if isinstance(value, dict) else {}
    recent = config.get("recent_swept_sessions", 2)
    if type(recent) is not int or not 0 <= recent <= 20:
        raise ValueError("context_history.recent_swept_sessions must be an integer from 0 to 20.")
    use_summaries = config.get("use_summaries", False)
    if type(use_summaries) is not bool:
        raise ValueError("context_history.use_summaries must be a boolean.")
    return {"recent_swept_sessions": recent, "use_summaries": use_summaries}


def context_history_plan(
    selection: dict[str, Any],
    *,
    recent_swept_sessions: int = 2,
    use_summaries: bool = False,
    instance_path: str | Path | None = None,
) -> dict[str, Any]:
    policy = history_config({"recent_swept_sessions": recent_swept_sessions, "use_summaries": use_summaries})
    recent = policy["recent_swept_sessions"]
    if selection.get("status") == "unavailable":
        return selection
    selected = str(selection["session_filename"])
    # Saved pins are already a flattened inventory. Do not recursively resurrect
    # unpinned notes, archived sessions, or unrelated branches from older manifests.
    names = [selected] + [
        str(r["filename"])
        for r in selection.get("pinned_notes", [])
        if r.get("status") != "missing" and r.get("current_status") != "missing"
    ]
    sessions, notes, skipped = {}, {}, []
    for name in names:
        if name.replace("\\", "/").lower().startswith("sessions/archived/"):
            skipped.append(name)
            continue
        try:
            note = read_note_file(instance_path, name)
            variant = continuity_session_variant_metadata(note.content)
            if variant:
                note = read_note_file(instance_path, variant["source_session_filename"])
            metadata = continuity_session_metadata(note.content)
            if metadata:
                if len(Path(note.filename).parts) != 2 or Path(note.filename).parts[0] != "sessions":
                    skipped.append(name)
                    continue
                sessions[note.filename.lower()] = (note, metadata)
            else:
                notes[note.filename.lower()] = note
        except FileNotFoundError:
            if name == selected:
                raise
            skipped.append(name)
    ordered = []
    key = selected.lower()
    while key in sessions:
        note, metadata = sessions.pop(key)
        ordered.append(note)
        key = str(metadata["parent_session_filename"]).lower()
    ordered.extend(
        note for note, _ in sorted(sessions.values(), key=lambda pair: str(pair[1]["created"]), reverse=True)
    )
    loaded, required, inventory = [], [], []
    for index, source in enumerate(ordered):
        form = "summary" if use_summaries and index >= recent else "scrubbed"
        record = next(
            r for r in continuity_session_variant_records(source.filename, instance_path) if r["key"] == form
        )
        ready = prepared_variant(record, instance_path)
        raw_fallback = (form == "scrubbed" and record["status"] == "available" and not ready
                        and any(marker in read_note_file(instance_path, record["filename"]).content
                                for marker in (SWEEP_VERSION, "Conservative semantic sweep v2")))
        if raw_fallback:
            form = "raw"
        inventory.append(
            {
                "session_filename": source.filename,
                "resume_form": form,
                "load_filename": source.filename if raw_fallback else record["filename"],
                "raw_characters": len(source.content),
                "characters": len(source.content) if raw_fallback else record["characters"],
                **({"fallback_reason": "Generated sweep omitted protected turns; using full transcript."}
                   if raw_fallback else {}),
            }
        )
        if raw_fallback:
            loaded.append({"status": "ok", "filename": source.filename, "load_filename": source.filename,
                           "resume_form": "raw", "content": source.content})
            continue
        if not ready:
            required.append(source.filename)
            continue
        derivative = read_note_file(instance_path, record["filename"])
        metadata = continuity_session_variant_metadata(derivative.content)
        if not metadata or metadata["source_sha256"] != digest(source.content):
            raise ValueError(f"Source changed while assembling history: {source.filename}. Retry Connect.")
        loaded.append(
            {
                "status": "ok",
                "filename": source.filename,
                "load_filename": derivative.filename,
                "resume_form": form,
                "content": derivative.content,
            }
        )
    loaded.extend(
        {"status": "ok", "filename": note.filename, "load_filename": note.filename, "content": note.content}
        for note in notes.values()
    )
    return {
        **selection,
        "status": "preparing" if required else "ok",
        "resume_form": "auto",
        "resume_form_label": (f"Auto: {recent} recent swept, older summaries" if use_summaries
                              else "Auto: swept with full fallback"
                              if any(r["resume_form"] == "raw" for r in inventory)
                              else "Auto: all retained sessions swept"),
        "load_filename": inventory[0]["load_filename"],
        "history_policy": policy,
        "history_inventory": inventory,
        "history_notes": [] if required else loaded,
        "preparation_required": required,
        "skipped_notes": skipped,
    }

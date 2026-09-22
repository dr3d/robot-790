"""Durable identities for Disconnect saves, including lost HTTP replies."""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from collections.abc import Callable
from pathlib import Path
from typing import Any
from uuid import UUID

from robot_790d import archive_transaction
from robot_790d.note_files import _note_write_transaction, notes_root_for_instance, resolve_note_path

def _publish(path: Path, job: dict[str, Any]) -> None:
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".save-", suffix=".tmp", delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(json.dumps(job, ensure_ascii=False).encode("utf-8"))
            handle.flush()
            os.fsync(handle.fileno())
        temporary.replace(path)
    finally:
        if temporary:
            temporary.unlink(missing_ok=True)


def save_once(
    instance_path: str | Path | None,
    request_id: str,
    payload: dict[str, Any],
    prepare: Callable[[], dict[str, Any]],
    commit: Callable[[dict[str, Any]], dict[str, object]],
) -> dict[str, object]:
    try:
        if str(UUID(request_id)) != request_id:
            raise ValueError
    except (ValueError, TypeError, AttributeError) as exc:
        raise ValueError("save_request_id must be a canonical UUID.") from exc
    root = notes_root_for_instance(instance_path).resolve()
    shelf = hashlib.sha256(str(root).encode("utf-8")).hexdigest()[:16]
    folder = root.parent / "logs" / "continuity-saves" / shelf
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{request_id}.json"
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
    # This lock is separate from the note writer's lock; it also covers another
    # page-server process recovering the same request after a restart.
    with archive_transaction.ARCHIVE_LOCK, _note_write_transaction(folder):
        if path.exists():
            job = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(job, dict) or job.get("version") != 1 or job.get("request_id") != request_id:
                raise ValueError("Invalid session save journal; original left untouched.")
            if job.get("request_sha256") != digest:
                raise ValueError("Save identity already belongs to different contents; original left untouched.")
        else:
            draft = prepare()
            job = {"version": 1, "request_id": request_id, "request_sha256": digest,
                   "state": "prepared", "draft": draft}
            _publish(path, job)

        draft = job.get("draft")
        if (job.get("state") not in {"prepared", "complete"} or not isinstance(draft, dict)
                or not isinstance(draft.get("content"), str) or not isinstance(draft.get("result"), dict)
                or not isinstance(draft["result"].get("session_filename"), str)):
            raise ValueError("Invalid session save journal; original left untouched.")
        if job["state"] == "complete" and (
            not isinstance(job.get("result"), dict) or job["result"].get("save_request_id") != request_id
            or job["result"].get("session_filename") != draft["result"]["session_filename"]
        ):
            raise ValueError("Invalid completed save receipt; original left untouched.")
        filename = draft["result"]["session_filename"]
        note_path = resolve_note_path(filename, instance_path)
        archived = archive_transaction.load_transaction(instance_path, filename)
        if archived is not None:
            raise ValueError("This save already belongs to an archived session; no replacement was created.")
        if note_path.exists():
            if note_path.read_text(encoding="utf-8") != draft["content"]:
                raise ValueError("Saved session has changed since this request; original left untouched.")
        elif job["state"] == "complete":
            raise ValueError("Acknowledged session file is missing; no replacement was created.")
        if job["state"] == "complete":
            return dict(job["result"])

        result = {**commit(draft), "save_request_id": request_id}
        job.update(state="complete", result=result)
        try:
            _publish(path, job)
        except OSError:
            # The source note is authoritative. The prepared journal can verify
            # that same file and finish the receipt on the next retry.
            pass
        return result

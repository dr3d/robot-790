"""Copy/verify/cleanup journal for session archives; recovery is explicit."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
import threading
from pathlib import Path
from typing import Any

from robot_790d.note_files import _note_write_transaction, notes_root_for_instance, resolve_note_path

ARCHIVE_LOCK = threading.RLock()


def file_digest(path: Path) -> str:
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def _publish(temporary: Path, target: Path) -> None:
    if os.name == "nt":
        temporary.rename(target)
    else:
        os.link(temporary, target)


def _atomic_json(path: Path, value: dict[str, Any], *, new: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".archive-", suffix=".tmp", delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(json.dumps(value, indent=2).encode("utf-8"))
            handle.flush()
            os.fsync(handle.fileno())
        if new:
            _publish(temporary, path)
        else:
            temporary.replace(path)
    finally:
        if temporary:
            temporary.unlink(missing_ok=True)


def _journal_path(instance_path: str | Path | None, filename: str) -> Path:
    key = hashlib.sha256(filename.lower().encode("utf-8")).hexdigest()
    return notes_root_for_instance(instance_path).resolve().parent / "logs" / "archive-transactions" / f"{key}.json"


def _paths(job: dict[str, Any], entry: dict[str, Any], instance_path: str | Path | None) -> tuple[Path, Path]:
    name = str(entry["source"])
    relative = Path(name)
    session = Path(job["session_filename"])
    package = Path(job["archived_session_filename"]).parent
    if relative.is_absolute() or ".." in relative.parts or "\\" in name or ":" in name:
        raise ValueError("Invalid archive source path.")
    if entry["kind"] == "note":
        if name == job["session_filename"]:
            expected = Path(job["archived_session_filename"])
        elif relative.parent.as_posix() == "sessions/variants" and relative.name.startswith(session.stem + "."):
            expected = package / "variants" / relative.name
        else:
            raise ValueError("Invalid archive note source.")
        source = resolve_note_path(name, instance_path)
    elif entry["kind"] == "eye" and len(relative.parts) == 1:
        root = notes_root_for_instance(instance_path).resolve().parent / "logs" / "sensing-eye"
        source = (root / name).resolve()
        if source.parent != root.resolve():
            raise ValueError("Archive asset source escaped its root.")
        expected = package / "sensing-eye" / relative.name
    else:
        raise ValueError("Invalid archive source kind.")
    if str(entry["target"]) != expected.as_posix():
        raise ValueError("Invalid archive target path.")
    # Image suffixes are intentionally not part of the text-note resolver.
    root = notes_root_for_instance(instance_path).resolve()
    target = (root / expected).resolve()
    package_path = resolve_note_path(job["archived_session_filename"], instance_path).parent
    if not target.is_relative_to(package_path) or not package_path.is_relative_to(root / "sessions" / "archived"):
        raise ValueError("Archive target escaped its package.")
    return source, target


def _validate(job: dict[str, Any], filename: str, instance_path: str | Path | None) -> None:
    session = Path(filename)
    archived = Path(job["archived_session_filename"])
    if (job.get("schema") != 1 or job.get("session_filename", "").lower() != filename.lower()
            or session.parent.as_posix() != "sessions" or session.suffix.lower() != ".txt"
            or len(archived.parts) != 4 or archived.parts[:2] != ("sessions", "archived")
            or archived.name.lower() != "session.txt" or ".." in archived.parts
            or job.get("state") not in {"copying", "cleanup", "complete"}):
        raise ValueError("Invalid archive transaction identity.")
    sources, targets = set(), set()
    for entry in job["files"]:
        source, target = _paths(job, entry, instance_path)
        if source in sources or target in targets:
            raise ValueError("Duplicate archive transaction path.")
        sources.add(source)
        targets.add(target)
        if len(entry["sha256"]) != 64 or any(c not in "0123456789abcdef" for c in entry["sha256"]):
            raise ValueError("Invalid archive digest.")
    if resolve_note_path(filename, instance_path) not in sources:
        raise ValueError("Archive transaction has no source session.")


def load_transaction(instance_path: str | Path | None, filename: str) -> dict[str, Any] | None:
    path = _journal_path(instance_path, filename)
    if not path.exists():
        return None
    try:
        job = json.loads(path.read_text(encoding="utf-8"))
        _validate(job, filename, instance_path)
        return job
    except (KeyError, TypeError, AttributeError) as exc:
        raise ValueError("Invalid archive transaction; originals left untouched.") from exc


def start_transaction(instance_path: str | Path | None, job: dict[str, Any]) -> None:
    _validate(job, job["session_filename"], instance_path)
    _atomic_json(_journal_path(instance_path, job["session_filename"]), job, new=True)


def pending_archives(instance_path: str | Path | None = None) -> list[dict[str, str]]:
    folder = _journal_path(instance_path, "").parent
    pending = []
    for path in sorted(folder.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            job = load_transaction(instance_path, data["session_filename"])
            if job is None or path != _journal_path(instance_path, job["session_filename"]):
                raise ValueError("Archive journal identity mismatch.")
            if job["state"] != "complete":
                pending.append({key: job[key] for key in ("session_filename", "archived_session_filename", "state")})
        except (OSError, ValueError, KeyError, TypeError) as exc:
            pending.append({"state": "invalid", "journal": path.name, "error": str(exc)})
    return pending


def _copy_verified(source: Path, target: Path, expected: str) -> None:
    if target.exists():
        if file_digest(target) != expected:
            raise ValueError(f"Archive copy differs from journal: {target.name}")
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with source.open("rb") as incoming, tempfile.NamedTemporaryFile(
            dir=target.parent, prefix=".archive-", suffix=".tmp", delete=False,
        ) as output:
            temporary = Path(output.name)
            shutil.copyfileobj(incoming, output)
            output.flush()
            os.fsync(output.fileno())
        if file_digest(temporary) != expected:
            raise ValueError(f"Archive source changed: {source.name}")
        _publish(temporary, target)
    finally:
        if temporary:
            temporary.unlink(missing_ok=True)


def _remove_source(source: Path, target: Path, expected: str) -> None:
    if file_digest(target) != expected:
        raise ValueError(f"Archive copy changed; original retained: {target.name}")
    if source.exists():
        if file_digest(source) != expected:
            raise ValueError(f"Archive source changed; original retained: {source.name}")
        source.unlink()


def finish_transaction(
    instance_path: str | Path | None, job: dict[str, Any], shared_assets: set[str],
) -> dict[str, Any]:
    filename = job["session_filename"]
    _validate(job, filename, instance_path)
    path = _journal_path(instance_path, filename)
    files = [(entry, *_paths(job, entry, instance_path)) for entry in job["files"]]
    if job["state"] == "copying":
        for entry, source, target in files:
            _copy_verified(source, target, entry["sha256"])
    # Check the entire package and all surviving originals before any removals.
    for entry, source, target in files:
        if not target.is_file() or file_digest(target) != entry["sha256"]:
            raise ValueError(f"Archive copy failed verification: {target.name}")
        if source.exists() and file_digest(source) != entry["sha256"]:
            raise ValueError(f"Archive source changed; cleanup stopped: {source.name}")
    if job["state"] == "complete":
        return job["result"]
    for asset in job["result"]["archived_sensing_eye_assets"]:
        if asset.get("archive_status") == "archived" and asset["filename"] in shared_assets:
            asset["retained_for_active_session"] = True
    package = resolve_note_path(job["archived_session_filename"], instance_path).parent
    _atomic_json(package / "manifest.json", {
        "source_session_filename": filename,
        "archived_session_filename": job["archived_session_filename"],
        "created_at": job["created_at"],
        "assets": job["result"]["archived_sensing_eye_assets"],
    })
    job["state"] = "cleanup"
    _atomic_json(path, job)
    # Remove the source session last, so interrupted cleanup remains visible in
    # the map. Retry reads this journal even if the final source unlink succeeded.
    ordered = sorted(files, key=lambda item: item[0]["source"] == filename)
    with _note_write_transaction(notes_root_for_instance(instance_path).resolve()):
        for entry, source, target in ordered:
            name = entry["source"]
            if entry["kind"] == "eye" and (name in shared_assets or name.removesuffix(".json") in shared_assets):
                continue
            _remove_source(source, target, entry["sha256"])
    job["state"] = "complete"
    _atomic_json(path, job)
    return job["result"]

from __future__ import annotations

import os
import re
import tempfile
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path

ALLOWED_EXTENSIONS = {".md", ".txt"}
MAX_NOTE_CHARS = 200000
NOTES_DIRNAME = "notes"
_NOTE_WRITE_LOCK = threading.Lock()


@contextmanager
def _note_write_transaction(root: Path) -> Iterator[None]:
    # The page server and realtime worker can both write notes in separate processes.
    with _NOTE_WRITE_LOCK, (root / ".note-write.lock").open("a+b") as lock_file:
        if lock_file.seek(0, os.SEEK_END) == 0:
            lock_file.write(b"\0")
            lock_file.flush()
        lock_file.seek(0)
        if os.name == "nt":
            import msvcrt

            msvcrt.locking(lock_file.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl

            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            lock_file.seek(0)
            if os.name == "nt":
                msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


@dataclass(frozen=True)
class NoteFile:
    filename: str
    path: Path
    content: str


def notes_root_for_instance(instance_path: str | Path | None = None) -> Path:
    env_path = os.getenv("ROBOT_790_NOTES_PATH")
    if env_path:
        return Path(env_path).expanduser()
    if instance_path is not None:
        return Path(instance_path).expanduser() / NOTES_DIRNAME
    return Path.cwd() / NOTES_DIRNAME


def resolve_note_path(filename: str, instance_path: str | Path | None = None) -> Path:
    root = notes_root_for_instance(instance_path).resolve()
    normalized = filename.replace("\\", "/").strip()
    if not normalized:
        raise ValueError("Missing filename.")
    if Path(normalized).suffix == "":
        normalized = f"{normalized}.txt"

    relative = Path(normalized)
    if relative.is_absolute() or any(part in {"", ".", ".."} for part in relative.parts):
        raise ValueError("Filename must stay inside the notes folder.")

    if relative.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise ValueError("Only .md and .txt note files are allowed.")

    path = (root / relative).resolve()
    try:
        path.relative_to(root)
    except ValueError as exc:
        raise ValueError("Filename must stay inside the notes folder.") from exc
    return path


def relative_note_name(path: Path, instance_path: str | Path | None = None) -> str:
    return path.resolve().relative_to(notes_root_for_instance(instance_path).resolve()).as_posix()


def note_lookup_key(path: Path) -> tuple[str, ...]:
    parts = list(path.parts)
    if not parts:
        return ()
    final = Path(parts[-1])
    parts[-1] = f"{_slug_text(final.stem)}{final.suffix.lower()}"
    return tuple(_slug_text(part) for part in parts[:-1]) + (parts[-1],)


def _slug_text(value: str) -> str:
    split_camel = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", value)
    without_apostrophes = split_camel.casefold().replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "_", without_apostrophes).strip("_")


def find_existing_note_path(filename: str, instance_path: str | Path | None = None) -> Path:
    requested = resolve_note_path(filename, instance_path)
    if requested.exists():
        return requested

    root = notes_root_for_instance(instance_path).resolve()
    requested_relative = requested.relative_to(root)
    requested_key = note_lookup_key(requested_relative)
    basename_matches: list[Path] = []
    requested_basename_key = note_lookup_key(Path(requested_relative.name))
    for candidate in root.rglob("*"):
        if not candidate.is_file() or candidate.suffix.lower() not in ALLOWED_EXTENSIONS:
            continue
        candidate_resolved = candidate.resolve()
        candidate_relative = candidate_resolved.relative_to(root)
        if note_lookup_key(candidate_relative) == requested_key:
            return candidate_resolved
        if (
            len(requested_relative.parts) == 1
            and note_lookup_key(Path(candidate_relative.name)) == requested_basename_key
        ):
            basename_matches.append(candidate_resolved)
    if len(basename_matches) == 1:
        return basename_matches[0]
    if len(basename_matches) > 1:
        names = ", ".join(relative_note_name(path, instance_path) for path in basename_matches)
        raise ValueError(f"Multiple note files match {filename!r}: {names}. Include the folder name.")
    return requested


def write_note_file(
    instance_path: str | Path | None,
    filename: str,
    content: str,
    mode: str = "overwrite",
) -> NoteFile:
    if mode not in {"overwrite", "append"}:
        raise ValueError("Mode must be overwrite or append.")

    normalized_content = str(content)
    if len(normalized_content) > MAX_NOTE_CHARS:
        raise ValueError(f"Content is too long. Limit is {MAX_NOTE_CHARS} characters.")

    path = resolve_note_path(filename, instance_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with _note_write_transaction(notes_root_for_instance(instance_path).resolve()):
        if mode == "append":
            existing = path.read_text(encoding="utf-8") if path.exists() else ""
            separator = "" if not existing or existing.endswith("\n") else "\n"
            normalized_content = f"{existing}{separator}{normalized_content}"
            if len(normalized_content) > MAX_NOTE_CHARS:
                raise ValueError(f"Combined note is too long. Limit is {MAX_NOTE_CHARS} characters.")

        tmp_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", encoding="utf-8", dir=path.parent, prefix=f".{path.name}.", suffix=".tmp", delete=False
            ) as temporary:
                tmp_path = Path(temporary.name)
                temporary.write(normalized_content)
                temporary.flush()
                os.fsync(temporary.fileno())
            tmp_path.replace(path)
        finally:
            if tmp_path is not None:
                tmp_path.unlink(missing_ok=True)

    return NoteFile(filename=relative_note_name(path, instance_path), path=path, content=normalized_content)


def read_note_file(instance_path: str | Path | None, filename: str) -> NoteFile:
    path = find_existing_note_path(filename, instance_path)
    content = path.read_text(encoding="utf-8")
    if len(content) > MAX_NOTE_CHARS:
        raise ValueError(f"Note is too long to read. Limit is {MAX_NOTE_CHARS} characters.")
    return NoteFile(filename=relative_note_name(path, instance_path), path=path, content=content)


def delete_note_file(instance_path: str | Path | None, filename: str) -> str:
    path = find_existing_note_path(filename, instance_path)
    root = notes_root_for_instance(instance_path).resolve()
    with _note_write_transaction(root):
        if not path.exists():
            raise FileNotFoundError(path)
        path.unlink()
    return relative_note_name(path, instance_path)


def list_note_files(instance_path: str | Path | None = None) -> list[str]:
    root = notes_root_for_instance(instance_path)
    if not root.exists():
        return []

    filenames: list[str] = []
    for path in root.rglob("*"):
        if path.is_file() and path.suffix.lower() in ALLOWED_EXTENSIONS:
            filenames.append(relative_note_name(path, instance_path))
    return sorted(filenames)

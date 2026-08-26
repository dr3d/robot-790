from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path

ALLOWED_EXTENSIONS = {".md", ".txt"}
MAX_NOTE_CHARS = 200000
NOTES_DIRNAME = "notes"


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
    return re.sub(r"[^a-z0-9]+", "_", value.casefold()).strip("_")


def find_existing_note_path(filename: str, instance_path: str | Path | None = None) -> Path:
    requested = resolve_note_path(filename, instance_path)
    if requested.exists():
        return requested

    root = notes_root_for_instance(instance_path).resolve()
    requested_key = note_lookup_key(requested.relative_to(root))
    for candidate in root.rglob("*"):
        if not candidate.is_file() or candidate.suffix.lower() not in ALLOWED_EXTENSIONS:
            continue
        if note_lookup_key(candidate.resolve().relative_to(root)) == requested_key:
            return candidate.resolve()
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
    if mode == "append":
        existing = path.read_text(encoding="utf-8") if path.exists() else ""
        separator = "" if not existing or existing.endswith("\n") else "\n"
        normalized_content = f"{existing}{separator}{normalized_content}"
        if len(normalized_content) > MAX_NOTE_CHARS:
            raise ValueError(f"Combined note is too long. Limit is {MAX_NOTE_CHARS} characters.")

    tmp_path = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        tmp_path.write_text(normalized_content, encoding="utf-8")
        tmp_path.replace(path)
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass

    return NoteFile(filename=relative_note_name(path, instance_path), path=path, content=normalized_content)


def read_note_file(instance_path: str | Path | None, filename: str) -> NoteFile:
    path = find_existing_note_path(filename, instance_path)
    content = path.read_text(encoding="utf-8")
    if len(content) > MAX_NOTE_CHARS:
        raise ValueError(f"Note is too long to read. Limit is {MAX_NOTE_CHARS} characters.")
    return NoteFile(filename=relative_note_name(path, instance_path), path=path, content=content)


def list_note_files(instance_path: str | Path | None = None) -> list[str]:
    root = notes_root_for_instance(instance_path)
    if not root.exists():
        return []

    filenames: list[str] = []
    for path in root.rglob("*"):
        if path.is_file() and path.suffix.lower() in ALLOWED_EXTENSIONS:
            filenames.append(relative_note_name(path, instance_path))
    return sorted(filenames)

from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from multiprocessing import get_context
from pathlib import Path

import pytest

from robot_790d.note_files import list_note_files, read_note_file, resolve_note_path, write_note_file


def test_note_files_default_to_txt_and_append(tmp_path: Path) -> None:
    written = write_note_file(tmp_path, "session_summary", "First line.")
    appended = write_note_file(tmp_path, "session_summary", "Second line.", mode="append")
    read = read_note_file(tmp_path, "session_summary")

    assert written.filename == "session_summary.txt"
    assert appended.filename == "session_summary.txt"
    assert read.content == "First line.\nSecond line."
    assert list_note_files(tmp_path) == ["session_summary.txt"]


def test_note_files_read_human_title_as_snake_case_filename(tmp_path: Path) -> None:
    write_note_file(tmp_path, "conversation_summary", "Readable by title.")

    read = read_note_file(tmp_path, "Conversation Summary")

    assert read.filename == "conversation_summary.txt"
    assert read.content == "Readable by title."


def test_note_files_read_camel_case_title_as_snake_case_filename(tmp_path: Path) -> None:
    write_note_file(tmp_path, "last_time", "Readable by camel case.")

    read = read_note_file(tmp_path, "LastTime")

    assert read.filename == "last_time.txt"
    assert read.content == "Readable by camel case."


def test_note_files_read_possessive_title_as_snake_case_filename(tmp_path: Path) -> None:
    write_note_file(tmp_path, "erics_memories", "Remember this by title.")

    read = read_note_file(tmp_path, "Eric's Memories")

    assert read.filename == "erics_memories.txt"
    assert read.content == "Remember this by title."


def test_note_files_read_unique_title_from_subfolder(tmp_path: Path) -> None:
    write_note_file(tmp_path, "core/robot_build", "Build facts.")

    read = read_note_file(tmp_path, "Robot Build")

    assert read.filename == "core/robot_build.txt"
    assert read.content == "Build facts."


def test_note_files_reject_ambiguous_title_from_subfolders(tmp_path: Path) -> None:
    write_note_file(tmp_path, "core/robot_build", "Core build.")
    write_note_file(tmp_path, "experiments/robot_build", "Experiment build.")

    with pytest.raises(ValueError, match="Multiple note files match"):
        read_note_file(tmp_path, "Robot Build")


def test_note_files_allow_named_markdown(tmp_path: Path) -> None:
    written = write_note_file(tmp_path, "logs/today.md", "# Today\n")

    assert written.filename == "logs/today.md"
    assert read_note_file(tmp_path, "logs/today.md").content == "# Today\n"


@pytest.mark.parametrize(
    "filename",
    [
        "programs/spirograph.py",
        "data/runtime.json",
        "exports/turns.csv",
        "web/sketch.html",
        "web/theme.css",
        "web/sketch.js",
        "config/runtime.yaml",
        "config/runtime.yml",
    ],
)
def test_note_files_allow_named_source_and_data_files(tmp_path: Path, filename: str) -> None:
    written = write_note_file(tmp_path, filename, "sample")

    assert written.filename == filename
    assert read_note_file(tmp_path, filename).content == "sample"
    assert filename in list_note_files(tmp_path)


@pytest.mark.parametrize(
    "filename",
    ["../secret.txt", "/tmp/secret.txt", "bad.ps1", "binary.exe", "folder/../secret.txt"],
)
def test_note_files_reject_unsafe_paths(tmp_path: Path, filename: str) -> None:
    with pytest.raises(ValueError):
        resolve_note_path(filename, tmp_path)


def _append_note_batch(instance_path: str, worker: int) -> None:
    for index in range(12):
        write_note_file(instance_path, "shared.txt", f"{worker}:{index}", mode="append")


@pytest.mark.parametrize("processes", [False, True])
def test_concurrent_appends_preserve_every_update(tmp_path: Path, monkeypatch, processes: bool) -> None:
    monkeypatch.delenv("ROBOT_790_NOTES_PATH", raising=False)
    write_note_file(tmp_path, "shared.txt", "start")
    executor = (
        ProcessPoolExecutor(max_workers=4, mp_context=get_context("spawn"))
        if processes
        else ThreadPoolExecutor(max_workers=4)
    )
    with executor:
        futures = [executor.submit(_append_note_batch, str(tmp_path), worker) for worker in range(4)]
        for future in futures:
            future.result(timeout=30)

    lines = read_note_file(tmp_path, "shared.txt").content.splitlines()
    assert len(lines) == 49
    assert set(lines) == {"start", *(f"{worker}:{index}" for worker in range(4) for index in range(12))}
    assert list_note_files(tmp_path) == ["shared.txt"]
    assert not list((tmp_path / "notes").glob("*.tmp"))


def test_failed_replace_keeps_the_previous_note(tmp_path: Path, monkeypatch) -> None:
    write_note_file(tmp_path, "saved.txt", "previous receipt")

    def fail_replace(*args, **kwargs):
        raise OSError("test replacement failure")

    monkeypatch.setattr(Path, "replace", fail_replace)
    with pytest.raises(OSError, match="test replacement failure"):
        write_note_file(tmp_path, "saved.txt", "replacement")

    assert read_note_file(tmp_path, "saved.txt").content == "previous receipt"
    assert not list((tmp_path / "notes").glob("*.tmp"))

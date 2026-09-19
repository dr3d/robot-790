from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from multiprocessing import get_context
from pathlib import Path

import pytest

from robot_790d.note_files import (
    delete_note_file,
    list_note_files,
    list_note_files_page,
    read_note_file,
    resolve_note_path,
    write_note_file,
)


@pytest.fixture(autouse=True)
def isolated_notes(monkeypatch):
    monkeypatch.delenv("ROBOT_790_NOTES_PATH", raising=False)


def test_paginated_note_lookup_is_bounded_searchable_and_keeps_the_full_shelf(tmp_path):
    for index in range(73):
        write_note_file(tmp_path, f"sessions/session-{index:03d}.txt", "a note")
    write_note_file(tmp_path, "from_codex.txt", "a note")
    write_note_file(tmp_path, "core/\u65e5\u8a18.txt", "a note")
    first = list_note_files_page(tmp_path)
    assert len(first["files"]) == 20
    assert first["total"] == 75
    assert first["next_offset"] == 20
    second = list_note_files_page(tmp_path, offset=20)
    assert not set(first["files"]) & set(second["files"])
    assert len(list_note_files(tmp_path)) == 75
    assert list_note_files_page(tmp_path, query="FROM CODEX")["files"] == ["from_codex.txt"]
    assert list_note_files_page(tmp_path, query="\u65e5\u8a18")["files"] == ["core/\u65e5\u8a18.txt"]
    assert list_note_files_page(tmp_path, directory="core")["total"] == 1
    assert list_note_files_page(tmp_path, directory="sessions", offset=70)["next_offset"] is None
    assert list_note_files_page(tmp_path, offset=999)["files"] == []


@pytest.mark.parametrize("options", [
    {"limit": 0}, {"limit": 51}, {"limit": True}, {"offset": -1},
    {"directory": "../"}, {"directory": "/etc"}, {"directory": "C:/Users"},
    {"directory": "\\\\server\\folder"}, {"query": []},
])
def test_note_lookup_rejects_invalid_scopes_and_page_sizes(tmp_path, options):
    with pytest.raises(ValueError):
        list_note_files_page(tmp_path, **options)


@pytest.mark.parametrize("query,directory", [
    ("setup cards companion robot", ""),
    ("setup-cards/companion-robot", ""),
    ("setup_cards\\companion_robot", ""),
    ("companion robot", "setup cards"),
    ("COMPANION ROBOT", "SETUP_CARDS/"),
    ("companion robot", "./setup-cards"),
])
def test_note_lookup_matches_spoken_path_separators(tmp_path, query, directory):
    filename = "setup-cards/companion-robot.txt"
    write_note_file(tmp_path, filename, "companion")
    write_note_file(tmp_path, "other/companion-robot.txt", "other")
    result = list_note_files_page(tmp_path, query=query, directory=directory)
    assert result["files"] == [filename]
    assert result["total"] == 1
    assert result["query"] == query


def test_note_directory_matching_preserves_boundaries_and_returns_ambiguity(tmp_path):
    for filename in ["setup-cards/first.txt", "setup_cards/second.txt",
                     "setup-cards/nested/third.txt", "setup-cards-old/fourth.txt",
                     "setup/cards/fifth.txt", "setup-cards.txt"]:
        write_note_file(tmp_path, filename, "note")
    assert list_note_files_page(tmp_path, directory="setup cards")["files"] == [
        "setup-cards/first.txt", "setup-cards/nested/third.txt", "setup_cards/second.txt",
    ]
    assert list_note_files_page(tmp_path, directory="setup\\cards")["files"] == [
        "setup/cards/fifth.txt",
    ]
    assert list_note_files_page(tmp_path, directory="setup cards/nested")["files"] == [
        "setup-cards/nested/third.txt",
    ]


def test_spoken_path_lookup_preserves_non_ascii_names(tmp_path):
    filename = "\u65e5\u8a18-\u30ab\u30fc\u30c9/\u4eca\u65e5_\u306e\u8a71.txt"
    write_note_file(tmp_path, filename, "note")
    query = "\u65e5\u8a18 \u30ab\u30fc\u30c9 \u4eca\u65e5 \u306e\u8a71"
    assert list_note_files_page(tmp_path, query=query)["files"] == [filename]
    assert list_note_files_page(tmp_path, directory="\u65e5\u8a18 \u30ab\u30fc\u30c9")["files"] == [filename]


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


@pytest.mark.parametrize("operation", [read_note_file, delete_note_file])
@pytest.mark.parametrize("folder", ["", "core/"])
def test_approximate_lookup_rejects_colliding_names_without_changing_files(tmp_path, operation, folder):
    filenames = [f"{folder}robot-build.txt", f"{folder}robot_build.txt"]
    for filename in filenames:
        write_note_file(tmp_path, filename, filename)

    with pytest.raises(ValueError, match="Multiple note files match") as error:
        operation(tmp_path, f"{folder}Robot Build")
    for filename in filenames:
        assert filename in str(error.value)
        assert read_note_file(tmp_path, filename).content == filename


def test_exact_lookup_still_wins_over_approximate_aliases(tmp_path):
    write_note_file(tmp_path, "robot-build.txt", "hyphen")
    write_note_file(tmp_path, "robot_build.txt", "underscore")
    assert read_note_file(tmp_path, "robot-build.txt").content == "hyphen"
    assert delete_note_file(tmp_path, "robot_build.txt") == "robot_build.txt"
    assert read_note_file(tmp_path, "robot-build.txt").content == "hyphen"


@pytest.mark.parametrize("operation", [read_note_file, delete_note_file])
def test_non_latin_lookup_does_not_substitute_an_unrelated_note(tmp_path, operation):
    for filename in ["\u732b.txt", "\u72ac.txt"]:
        write_note_file(tmp_path, filename, filename)
    with pytest.raises(FileNotFoundError):
        operation(tmp_path, "\u89b3\u6e2c.txt")
    assert len(list_note_files(tmp_path)) == 2


@pytest.mark.parametrize("stored,requested", [
    ("\u65e5\u8a18/\u4eca\u65e5_\u306e\u8a71.txt", "\u65e5\u8a18/\u4eca\u65e5 \u306e\u8a71"),
    ("caf\u00e9_notes.txt", "Cafe\u0301 Notes"),
    ("\u0915\u093f_notes.txt", "\u0915\u093f Notes"),
])
def test_approximate_lookup_preserves_unicode_letters_and_marks(tmp_path, stored, requested):
    write_note_file(tmp_path, stored, "intended note")
    write_note_file(tmp_path, "\u0915_notes.txt", "different vowel")
    assert read_note_file(tmp_path, requested).filename == stored


def test_punctuation_only_names_require_an_exact_path(tmp_path):
    write_note_file(tmp_path, "---.txt", "punctuation")
    with pytest.raises(FileNotFoundError):
        read_note_file(tmp_path, "___.txt")
    assert read_note_file(tmp_path, "---.txt").content == "punctuation"


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

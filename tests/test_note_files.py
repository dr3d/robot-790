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


def test_note_files_allow_named_markdown(tmp_path: Path) -> None:
    written = write_note_file(tmp_path, "logs/today.md", "# Today\n")

    assert written.filename == "logs/today.md"
    assert read_note_file(tmp_path, "logs/today.md").content == "# Today\n"


@pytest.mark.parametrize("filename", ["../secret.txt", "/tmp/secret.txt", "bad.json", "folder/../secret.txt"])
def test_note_files_reject_unsafe_paths(tmp_path: Path, filename: str) -> None:
    with pytest.raises(ValueError):
        resolve_note_path(filename, tmp_path)

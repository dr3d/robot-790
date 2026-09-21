import pytest

from robot_790d.continuity import (
    archive_continuity_session,
    list_continuity_sessions,
    save_continuity_session,
    save_continuity_session_variant,
    select_continuity_session,
)
from robot_790d.note_files import MAX_NOTE_CHARS, read_note_file, write_note_file


@pytest.fixture(autouse=True)
def isolated_notes(monkeypatch):
    monkeypatch.delenv("ROBOT_790_NOTES_PATH", raising=False)


def test_long_session_and_variant_are_lossless_readable_and_archivable(tmp_path):
    body = "Start of overnight transcript.\n" + ("A full turn: \u65e5\u8a18\n" * 35000) + "Final turn."
    assert len(body) > MAX_NOTE_CHARS
    saved = save_continuity_session(body, [], tmp_path, filename_timestamp="20260921-083726-000")
    name = saved["session_filename"]
    assert body in read_note_file(tmp_path, name).content
    assert list_continuity_sessions(tmp_path)["sessions"][0]["characters"] > len(body)
    variant = save_continuity_session_variant(body, name, "scrubbed", tmp_path)
    assert body in read_note_file(tmp_path, variant["variant_filename"]).content
    assert select_continuity_session(name, tmp_path)["status"] == "ok"
    save_continuity_session("Newer session.", [], tmp_path, filename_timestamp="20260921-090000-000")
    archived = archive_continuity_session(name, tmp_path)
    assert archived["status"] == "ok"
    assert body in read_note_file(tmp_path, archived["archived_session_filename"]).content
    assert body in read_note_file(tmp_path, archived["archived_variant_filenames"][0]).content


def test_ordinary_note_tool_limit_remains_even_for_session_named_files(tmp_path):
    for name in ("note.txt", "sessions/session-20260921.txt"):
        with pytest.raises(ValueError, match="200000"):
            write_note_file(tmp_path, name, "x" * (MAX_NOTE_CHARS + 1))


def test_large_non_session_content_is_not_read_as_an_archive(tmp_path):
    path = tmp_path / "notes" / "session-fake.txt"
    path.parent.mkdir()
    path.write_text("x" * (MAX_NOTE_CHARS + 1), encoding="utf-8")
    with pytest.raises(ValueError, match="200000"):
        read_note_file(tmp_path, path.name)


def test_large_archive_is_not_an_unbounded_tool_read(tmp_path, monkeypatch):
    from robot_790d.realtime_tools import _read_text_file

    saved = save_continuity_session("x" * (MAX_NOTE_CHARS + 1), [], tmp_path)
    name = saved["session_filename"]
    assert len(read_note_file(tmp_path, name).content) > MAX_NOTE_CHARS
    with pytest.raises(ValueError, match="200000"):
        read_note_file(tmp_path, name, max_chars=MAX_NOTE_CHARS)
    monkeypatch.setenv("ROBOT_790_INSTANCE_PATH", str(tmp_path))
    result = _read_text_file({"filename": name})
    assert result["status"] == "error"
    assert "content" not in result

import hashlib
import json

import pytest

from robot_790d.continuity import (
    archive_continuity_session,
    continuity_session_title_filename,
    list_continuity_sessions,
    save_continuity_session,
    save_continuity_session_title,
    select_continuity_session,
)
from robot_790d.note_files import read_note_file, resolve_note_path, write_note_file


@pytest.fixture
def root(tmp_path, monkeypatch):
    monkeypatch.delenv("ROBOT_790_NOTES_PATH", raising=False)
    return tmp_path


def session(root, stamp="20260910-120000", parent=""):
    return save_continuity_session(
        "Transcript\n----------\n[12:00] You: Try a Reachy gesture.",
        [],
        root,
        filename_timestamp=stamp,
        parent_session_filename=parent,
    )["session_filename"]


def test_title_is_persistent_display_metadata_not_a_note_edit(root):
    filename = session(root)
    child = session(root, "20260910-130000", parent=filename)
    original = resolve_note_path(filename, root).read_bytes()
    before = select_continuity_session(child, root)
    saved = save_continuity_session_title("Reachy gesture comparison", filename, root)
    for _ in range(2):
        items = list_continuity_sessions(root)["sessions"]
        assert items[1]["title"] == saved["title"]
        assert items[0]["parent_session_filename"] == filename
        assert items[1]["filename"] == filename
    assert select_continuity_session(child, root) == before
    assert resolve_note_path(filename, root).read_bytes() == original
    assert saved["source_sha256"] == hashlib.sha256(read_note_file(root, filename).content.encode()).hexdigest()


@pytest.mark.parametrize("bad", ["not JSON", "[]", '{"title": 123}', '{"title": "Unbound title"}'])
def test_bad_sidecar_does_not_break_session_list(root, bad):
    filename = session(root)
    write_note_file(root, continuity_session_title_filename(filename, root), bad)
    assert list_continuity_sessions(root)["sessions"][0]["title"] == ""


def test_stale_title_is_ignored_and_stale_write_rejected(root):
    filename = session(root)
    saved = save_continuity_session_title("Reachy gesture comparison", filename, root)
    write_note_file(root, filename, read_note_file(root, filename).content + "\nNew fact")
    assert list_continuity_sessions(root)["sessions"][0]["title"] == ""
    with pytest.raises(ValueError, match="Source session changed"):
        save_continuity_session_title("An old title", filename, root, expected_source_sha256=saved["source_sha256"])


def test_generated_title_preserves_existing_reviewed_title(root):
    filename = session(root)
    save_continuity_session_title("Operator chosen title", filename, root)
    save_continuity_session_title("Generated title from summary", filename, root, reviewed=False)
    assert list_continuity_sessions(root)["sessions"][0]["title"] == "Operator chosen title"


def test_archiving_moves_title_with_session(root):
    filename = session(root)
    session(root, "20260910-130000")
    save_continuity_session_title("Reachy gesture comparison", filename, root)
    title_path = resolve_note_path(continuity_session_title_filename(filename, root), root)
    result = archive_continuity_session(filename, root)
    archived = next(name for name in result["archived_variant_filenames"] if name.endswith(".title.json"))
    assert json.loads(read_note_file(root, archived).content)["title"] == "Reachy gesture comparison"
    assert not title_path.exists()


@pytest.mark.parametrize("title", [None, 12, "", " ", "x" * 101, "Title\nOther", "<b>title</b>", "Session note"])
def test_invalid_title_rejected(root, title):
    with pytest.raises(ValueError, match="Session title"):
        save_continuity_session_title(title, session(root), root)

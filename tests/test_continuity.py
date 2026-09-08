from pathlib import Path

from robot_790d.continuity import (
    archive_continuity_session,
    current_continuity_session,
    list_continuity_sessions,
    rewind_continuity_session,
    save_continuity_session,
    select_continuity_session,
)
from robot_790d.note_files import read_note_file, write_note_file


def test_continuity_session_saves_pinned_environment_and_becomes_latest(tmp_path: Path) -> None:
    write_note_file(tmp_path, "core/erics_memories.txt", "Owner note.")
    write_note_file(tmp_path, "research/idea.txt", "Keep the latest transcript as a note.")

    body = "\n".join(
        [
            "Session Demarcation",
            "-------------------",
            "Transcript Since Clean Connect",
            "------------------------------",
            "[4:00:00 PM] You: Hello.",
        ]
    )
    result = save_continuity_session(
        body,
        ["core/erics_memories.txt", "research/idea.txt"],
        tmp_path,
        created_label="9/7/2026, 4:00:00 PM",
        filename_timestamp="20260907-160000",
    )

    assert result["session_filename"] == "sessions/session-20260907-160000.txt"
    session = read_note_file(tmp_path, result["session_filename"])
    assert "STS Session Note" in session.content
    assert "Created: 9/7/2026, 4:00:00 PM" in session.content
    assert "- core/erics_memories.txt" in session.content
    assert "sha256:" in session.content
    assert current_continuity_session(tmp_path)["session_filename"] == result["session_filename"]


def test_connect_previous_finds_previous_without_rewriting_the_latest_session(tmp_path: Path) -> None:
    baseline = save_continuity_session(
        "Session Demarcation\n-------------------\nBaseline.",
        [],
        tmp_path,
        created_label="9/7/2026, 4:00:00 PM",
        filename_timestamp="20260907-160000",
    )
    branch = save_continuity_session(
        "Session Demarcation\n-------------------\nBranch A.",
        [baseline["session_filename"]],
        tmp_path,
        parent_session_filename=baseline["session_filename"],
        created_label="9/7/2026, 4:10:00 PM",
        filename_timestamp="20260907-161000",
    )

    result = rewind_continuity_session(tmp_path)

    assert result["archived_session_filename"] == branch["session_filename"]
    assert result["restored_session_filename"] == baseline["session_filename"]
    assert "Branch A." in read_note_file(tmp_path, branch["session_filename"]).content
    assert current_continuity_session(tmp_path)["session_filename"] == branch["session_filename"]


def test_session_list_is_newest_first_and_select_is_explicit_metadata(tmp_path: Path) -> None:
    older = save_continuity_session(
        "Session Demarcation\n-------------------\nOlder.",
        [],
        tmp_path,
        created_label="9/7/2026, 4:00:00 PM",
        filename_timestamp="20260907-160000",
    )
    newer = save_continuity_session(
        "Session Demarcation\n-------------------\nNewer.",
        [older["session_filename"]],
        tmp_path,
        parent_session_filename=older["session_filename"],
        created_label="9/7/2026, 5:00:00 PM",
        filename_timestamp="20260907-170000",
    )

    sessions = list_continuity_sessions(tmp_path)["sessions"]

    assert [session["filename"] for session in sessions] == [newer["session_filename"], older["session_filename"]]
    selected = select_continuity_session(older["session_filename"], tmp_path)
    assert selected["session_filename"] == older["session_filename"]
    assert selected["selection"] == "explicit"
    assert current_continuity_session(tmp_path)["session_filename"] == newer["session_filename"]


def test_current_continuity_receipt_reports_changed_and_missing_dependencies(tmp_path: Path) -> None:
    write_note_file(tmp_path, "core/erics_memories.txt", "before")
    result = save_continuity_session(
        "Session Demarcation\n-------------------\nReceipt test.",
        ["core/erics_memories.txt", "research/missing-later.txt"],
        tmp_path,
        created_label="9/7/2026, 4:00:00 PM",
        filename_timestamp="20260907-160000",
    )
    write_note_file(tmp_path, "core/erics_memories.txt", "after")

    receipts = current_continuity_session(tmp_path)["pinned_notes"]

    assert result["session_filename"]
    assert receipts[0]["current_status"] == "changed"
    assert receipts[1]["current_status"] == "missing"


def test_captioned_session_note_names_are_listed_and_selectable(tmp_path: Path) -> None:
    saved = save_continuity_session(
        "Session Demarcation\n-------------------\nCaptioned.",
        [],
        tmp_path,
        created_label="9/7/2026, 4:00:00 PM",
        filename_timestamp="20260907-160000",
    )
    content = read_note_file(tmp_path, saved["session_filename"]).content
    captioned = "sessions/20260907-160000-daily-driver-empty-boot.txt"
    write_note_file(
        tmp_path,
        captioned,
        content.replace(f"Session note: {saved['session_filename']}", f"Session note: {captioned}"),
    )

    sessions = list_continuity_sessions(tmp_path)["sessions"]
    assert captioned in [session["filename"] for session in sessions]
    selected = select_continuity_session(captioned, tmp_path)
    assert selected["session_filename"] == captioned


def test_archive_continuity_session_moves_note_out_of_active_list(tmp_path: Path) -> None:
    older = save_continuity_session(
        "Session Demarcation\n-------------------\nOlder.",
        [],
        tmp_path,
        created_label="9/7/2026, 4:00:00 PM",
        filename_timestamp="20260907-160000",
    )
    newer = save_continuity_session(
        "Session Demarcation\n-------------------\nNewer.",
        [older["session_filename"]],
        tmp_path,
        parent_session_filename=older["session_filename"],
        created_label="9/7/2026, 5:00:00 PM",
        filename_timestamp="20260907-170000",
    )

    result = archive_continuity_session(newer["session_filename"], tmp_path)

    assert result["session_filename"] == newer["session_filename"]
    assert result["archived_session_filename"] == "sessions/archived/session-20260907-170000.txt"
    assert read_note_file(tmp_path, result["archived_session_filename"]).content
    sessions = list_continuity_sessions(tmp_path)["sessions"]
    assert [session["filename"] for session in sessions] == [older["session_filename"]]
    assert current_continuity_session(tmp_path)["session_filename"] == older["session_filename"]


def test_selected_session_reports_missing_parent_after_parent_is_archived(tmp_path: Path) -> None:
    parent = save_continuity_session(
        "Session Demarcation\n-------------------\nParent.",
        [],
        tmp_path,
        created_label="9/7/2026, 4:00:00 PM",
        filename_timestamp="20260907-160000",
    )
    child = save_continuity_session(
        "Session Demarcation\n-------------------\nChild.",
        [parent["session_filename"]],
        tmp_path,
        parent_session_filename=parent["session_filename"],
        created_label="9/7/2026, 5:00:00 PM",
        filename_timestamp="20260907-170000",
    )

    archive_continuity_session(parent["session_filename"], tmp_path)
    selected = select_continuity_session(child["session_filename"], tmp_path)

    assert selected["parent_session_status"] == "missing"
    assert selected["pinned_notes"][0]["current_status"] == "missing"


def test_archive_continuity_session_refuses_only_active_session(tmp_path: Path) -> None:
    saved = save_continuity_session(
        "Session Demarcation\n-------------------\nOnly.",
        [],
        tmp_path,
        created_label="9/7/2026, 4:00:00 PM",
        filename_timestamp="20260907-160000",
    )

    try:
        archive_continuity_session(saved["session_filename"], tmp_path)
    except ValueError as exc:
        assert "only active session" in str(exc)
    else:
        raise AssertionError("Expected archiving the only active session to fail.")

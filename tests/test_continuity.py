import json
from pathlib import Path

from robot_790d.continuity import (
    archive_continuity_session,
    continuity_session_variant_filename,
    continuity_session_variant_records,
    current_continuity_session,
    list_continuity_sessions,
    rewind_continuity_session,
    save_continuity_session,
    save_continuity_session_variant,
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


def test_session_variants_are_source_linked_alternative_load_forms(tmp_path: Path) -> None:
    source = save_continuity_session(
        "Session Demarcation\n-------------------\nRaw session.",
        ["core/erics_memories.txt"],
        tmp_path,
        created_label="9/7/2026, 4:00:00 PM",
        filename_timestamp="20260907-160000",
    )
    scrubbed = save_continuity_session_variant(
        "Scrubbed transcript with stutters removed.",
        source["session_filename"],
        "scrubbed",
        tmp_path,
        created_label="9/7/2026, 4:10:00 PM",
    )
    summary = save_continuity_session_variant(
        "A short baton for the next run.",
        source["session_filename"],
        "summary",
        tmp_path,
        created_label="9/7/2026, 4:11:00 PM",
    )

    assert scrubbed["variant_filename"] == continuity_session_variant_filename(
        source["session_filename"], "scrubbed", tmp_path
    )
    assert summary["variant_filename"] == continuity_session_variant_filename(
        source["session_filename"], "summary", tmp_path
    )
    variants = continuity_session_variant_records(source["session_filename"], tmp_path)
    assert [(variant["key"], variant["status"]) for variant in variants] == [
        ("raw", "available"),
        ("scrubbed", "available"),
        ("summary", "available"),
    ]

    selected = select_continuity_session(source["session_filename"], tmp_path, resume_form="summary")
    assert selected["session_filename"] == source["session_filename"]
    assert selected["load_filename"] == summary["variant_filename"]
    assert selected["resume_form"] == "summary"
    assert selected["pinned_notes"][0]["filename"] == "core/erics_memories.txt"


def test_changed_source_marks_session_variant_stale_and_refuses_load(tmp_path: Path) -> None:
    source = save_continuity_session(
        "Session Demarcation\n-------------------\nRaw session.",
        [],
        tmp_path,
        created_label="9/7/2026, 4:00:00 PM",
        filename_timestamp="20260907-160000",
    )
    save_continuity_session_variant(
        "A short baton for the next run.",
        source["session_filename"],
        "summary",
        tmp_path,
    )
    raw = read_note_file(tmp_path, source["session_filename"])
    write_note_file(tmp_path, raw.filename, f"{raw.content}\nRaw record amended after review.\n")

    variants = continuity_session_variant_records(source["session_filename"], tmp_path)
    assert next(item for item in variants if item["key"] == "summary")["status"] == "stale"
    try:
        select_continuity_session(source["session_filename"], tmp_path, resume_form="summary")
    except ValueError as exc:
        assert "stale" in str(exc)
    else:
        raise AssertionError("Expected stale summary variant to be refused.")


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
    summary = save_continuity_session_variant(
        "A short baton for the newer session.",
        newer["session_filename"],
        "summary",
        tmp_path,
    )
    summary_content = read_note_file(tmp_path, summary["variant_filename"]).content

    result = archive_continuity_session(newer["session_filename"], tmp_path)

    assert result["session_filename"] == newer["session_filename"]
    assert result["archived_session_filename"] == "sessions/archived/session-20260907-170000/session.txt"
    assert result["archived_variant_filenames"] == [
        "sessions/archived/session-20260907-170000/variants/session-20260907-170000.summary.txt"
    ]
    assert read_note_file(tmp_path, result["archived_session_filename"]).content
    assert read_note_file(tmp_path, result["archived_variant_filenames"][0]).content == summary_content
    sessions = list_continuity_sessions(tmp_path)["sessions"]
    assert [session["filename"] for session in sessions] == [older["session_filename"]]
    assert current_continuity_session(tmp_path)["session_filename"] == older["session_filename"]


def test_archive_continuity_session_moves_its_sensing_eye_assets(tmp_path: Path) -> None:
    eye_dir = tmp_path / "logs" / "sensing-eye"
    eye_dir.mkdir(parents=True)
    captured = eye_dir / "face-capture.jpg"
    captured.write_bytes(b"session-scoped-eye-image")
    captured_sidecar = captured.with_name(f"{captured.name}.json")
    captured_sidecar.write_text(
        json.dumps({"kind": "image", "source": "browser_face"}),
        encoding="utf-8",
    )
    unrelated = eye_dir / "other-session.jpg"
    unrelated.write_bytes(b"leave this one active")

    older = save_continuity_session(
        "Session Demarcation\n-------------------\nThis run captured a face.",
        [],
        tmp_path,
        created_label="9/7/2026, 4:00:00 PM",
        filename_timestamp="20260907-160000",
        sensing_eye_filenames=[captured.name],
    )
    newer = save_continuity_session(
        "Session Demarcation\n-------------------\nKeep one active session.",
        [],
        tmp_path,
        created_label="9/7/2026, 5:00:00 PM",
        filename_timestamp="20260907-170000",
    )

    saved = read_note_file(tmp_path, older["session_filename"])
    assert "Sensing-Eye Assets At Save" in saved.content
    assert "- face-capture.jpg" in saved.content
    assert older["sensing_eye_asset_count"] == 1
    assert list_continuity_sessions(tmp_path)["sessions"][1]["sensing_eye_asset_count"] == 1

    result = archive_continuity_session(older["session_filename"], tmp_path)

    archive_dir = tmp_path / "notes" / "sessions" / "archived" / "session-20260907-160000" / "sensing-eye"
    assert result["archived_sensing_eye_asset_count"] == 1
    assert result["missing_sensing_eye_asset_count"] == 0
    assert result["sensing_eye_asset_archive"] == "sessions/archived/session-20260907-160000/sensing-eye"
    assert not captured.exists()
    assert not captured_sidecar.exists()
    assert (archive_dir / "face-capture.jpg").read_bytes() == b"session-scoped-eye-image"
    assert (archive_dir / "face-capture.jpg.json").is_file()
    manifest = json.loads((archive_dir.parent / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["assets"][0]["archive_status"] == "archived"
    assert unrelated.is_file()
    assert current_continuity_session(tmp_path)["session_filename"] == newer["session_filename"]


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

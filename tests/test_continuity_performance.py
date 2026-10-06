"""Bound session-map reads while keeping externally changed notes authoritative."""

import hashlib
import json
import os
from pathlib import Path

import pytest

from robot_790d import continuity, note_files
from robot_790d.session_preparation import SessionPreparer


@pytest.fixture
def shelf(tmp_path, monkeypatch):
    monkeypatch.delenv("ROBOT_790_NOTES_PATH", raising=False)
    saved = continuity.save_continuity_session(
        "Original conversation.", [], tmp_path, filename_timestamp="20261005-100000",
        created_label="2026-10-05T10:00:00-04:00",
    )
    return tmp_path, saved["session_filename"]


def record(shelf):
    root, name = shelf
    return next(item for item in continuity.list_continuity_sessions(root)["sessions"]
                if item["filename"] == name)


def external_write(path: Path, text: str) -> None:
    """Simulate another process, including same-size edits, without cache hooks."""
    previous = path.stat().st_mtime_ns if path.exists() else 0
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    timestamp = max(path.stat().st_mtime_ns, previous + 1_000_000_000)
    os.utime(path, ns=(timestamp, timestamp))


def sidecar(shelf, kind, value):
    root, name = shelf
    source = note_files.read_note_file(root, name)
    digest = hashlib.sha256(source.content.encode("utf-8")).hexdigest()
    if kind == "title":
        filename = continuity.continuity_session_title_filename(name, root)
        content = json.dumps({"source_sha256": digest, "title": value})
    elif kind == "context":
        filename = continuity.continuity_session_context_filename(name)
        content = json.dumps({
            "version": 1, "source_sha256": digest,
            "context_at_save": {"input_tokens": value, "context_window_tokens": 131072},
        })
    else:
        filename = continuity.continuity_session_variant_filename(name, kind, root)
        content = continuity.format_continuity_session_variant(
            body=value, source_session_filename=name, source_sha256=digest,
            variant=kind, created_label="2026-10-05T10:00:00-04:00",
        )
    path = note_files.resolve_note_path(filename, root)
    external_write(path, content)
    return path


def observed(item, kind):
    if kind == "title":
        return item["title"]
    if kind == "context":
        context = item["context_at_save"]
        return context["input_tokens"] if context else None
    variant = next(form for form in item["variants"] if form["key"] == kind)
    return variant["status"], variant["characters"]


def test_empty_asset_set_does_not_scan_or_read_session_notes(shelf, monkeypatch):
    root, name = shelf
    monkeypatch.setattr(continuity, "read_note_file", lambda *a, **kw: pytest.fail("Unneeded note read"))
    monkeypatch.setattr(Path, "iterdir", lambda *a, **kw: pytest.fail("Unneeded directory scan"))
    monkeypatch.setattr(Path, "rglob", lambda *a, **kw: pytest.fail("Unneeded shelf scan"))
    assert continuity._shared_sensing_eye_assets(root, name, set()) == set()


def test_missing_optional_metadata_does_not_search_aliases(shelf, monkeypatch):
    root, name = shelf
    original = note_files.find_existing_note_path

    def exact_optional_only(filename, instance_path=None):
        if filename.endswith((".title.json", ".context.json")):
            assert note_files.resolve_note_path(filename, instance_path).exists(), (
                "Missing optional metadata must not trigger whole-shelf alias resolution"
            )
        return original(filename, instance_path)

    monkeypatch.setattr(note_files, "find_existing_note_path", exact_optional_only)
    item = record(shelf)
    assert item["filename"] == name
    assert item["title"] == ""
    assert item["context_at_save"] is None


def test_missing_preparation_status_does_not_search_aliases(shelf, monkeypatch):
    root, name = shelf
    original = note_files.find_existing_note_path

    def exact_optional_only(filename, instance_path=None):
        if filename.endswith(".preparation.json"):
            assert note_files.resolve_note_path(filename, instance_path).exists(), (
                "Missing preparation status must not trigger whole-shelf alias resolution"
            )
        return original(filename, instance_path)

    monkeypatch.setattr(note_files, "find_existing_note_path", exact_optional_only)
    worker = SessionPreparer(root)
    try:
        assert worker.status(name) == {"state": "not_prepared"}
    finally:
        worker.close()


def test_warm_session_list_does_not_reread_unchanged_notes(shelf, monkeypatch):
    sidecar(shelf, "title", "A quiet room")
    sidecar(shelf, "summary", "A concise summary.")
    sidecar(shelf, "context", 12000)
    expected = record(shelf)
    monkeypatch.setattr(continuity, "read_note_file", lambda *a, **kw: pytest.fail("Warm cache reread a note"))
    assert record(shelf) == expected


@pytest.mark.parametrize("kind,first,second", [
    ("title", "First thread", "Other thread"),
    ("context", 12000, 22000),
    ("summary", "First summary.", "A longer replacement summary."),
    ("scrubbed", "First cleaned text.", "A longer cleaned transcript."),
])
def test_external_sidecar_create_edit_delete_refreshes_session_list(shelf, kind, first, second):
    before = observed(record(shelf), kind)
    path = sidecar(shelf, kind, first)
    created = observed(record(shelf), kind)
    assert created != before
    sidecar(shelf, kind, second)
    edited = observed(record(shelf), kind)
    assert edited != created
    if kind in {"title", "context"}:
        assert edited == second
    else:
        assert edited[0] == "available"
    path.unlink()
    assert observed(record(shelf), kind) == before


def test_external_source_edit_invalidates_all_derivative_receipts(shelf):
    root, name = shelf
    sidecar(shelf, "title", "A quiet room")
    sidecar(shelf, "context", 12000)
    sidecar(shelf, "summary", "A concise summary.")
    sidecar(shelf, "scrubbed", "Cleaned words.")
    assert record(shelf)["title"] == "A quiet room"
    source = note_files.resolve_note_path(name, root)
    external_write(source, source.read_text(encoding="utf-8").replace("Original", "Modified"))
    changed = record(shelf)
    assert changed["title"] == ""
    assert changed["context_at_save"] is None
    assert all(form["status"] == "stale" for form in changed["variants"] if form["key"] != "raw")


def test_external_session_addition_and_removal_refreshes_current(shelf):
    root, name = shelf
    assert record(shelf)["current"]
    added = "sessions/session-20261005-110000.txt"
    source = note_files.resolve_note_path(name, root).read_text(encoding="utf-8")
    newer = source.replace(name, added).replace("2026-10-05T10:00:00-04:00", "2026-10-05T11:00:00-04:00")
    added_path = note_files.resolve_note_path(added, root)
    external_write(added_path, newer)
    listed = continuity.list_continuity_sessions(root)
    assert listed["current_session_filename"] == added
    assert {item["filename"] for item in listed["sessions"]} == {name, added}
    added_path.unlink()
    listed = continuity.list_continuity_sessions(root)
    assert listed["current_session_filename"] == name
    assert len(listed["sessions"]) == 1
    assert listed["sessions"][0]["characters"] > 0


def test_callers_cannot_mutate_cached_session_records(shelf):
    sidecar(shelf, "title", "A quiet room")
    sidecar(shelf, "context", 12000)
    item = record(shelf)
    item["title"] = "Mutated by caller"
    item["variants"][0]["status"] = "missing"
    item["context_at_save"]["input_tokens"] = 1
    item["preparation"] = {"state": "invented"}
    fresh = record(shelf)
    assert fresh["title"] == "A quiet room"
    assert fresh["variants"][0]["status"] == "available"
    assert fresh["context_at_save"]["input_tokens"] == 12000
    assert "preparation" not in fresh


def test_session_records_are_isolated_between_note_roots(shelf):
    root, name = shelf
    sidecar(shelf, "title", "First shelf")
    assert record(shelf)["title"] == "First shelf"
    other_root = root / "other-instance"
    other_name = continuity.save_continuity_session(
        "A different conversation on another shelf.", [], other_root,
        filename_timestamp="20261005-100000", created_label="2026-10-05T10:00:00-04:00",
    )["session_filename"]
    assert other_name == name
    other_shelf = other_root, other_name
    sidecar(other_shelf, "title", "Other shelf")
    assert record(other_shelf)["title"] == "Other shelf"
    assert record(shelf)["title"] == "First shelf"

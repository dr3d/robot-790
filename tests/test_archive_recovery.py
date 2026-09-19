import json

import pytest

from robot_790d import continuity
from robot_790d.note_files import read_note_file, resolve_note_path
from robot_790d.session_preparation import SessionPreparer


@pytest.fixture
def archive_case(tmp_path, monkeypatch):
    monkeypatch.delenv("ROBOT_790_NOTES_PATH", raising=False)
    eye = tmp_path / "logs" / "sensing-eye"
    eye.mkdir(parents=True)
    (eye / "capture.jpg").write_bytes(b"original image")
    (eye / "capture.jpg.json").write_text('{"source":"test"}', encoding="utf-8")
    source = continuity.save_continuity_session(
        "Transcript\n----------\n[10:00] You: Original words.", [], tmp_path,
        filename_timestamp="20260919-010000", sensing_eye_filenames=["capture.jpg"],
    )["session_filename"]
    variant = continuity.save_continuity_session_variant("A summary", source, "summary", tmp_path)["variant_filename"]
    continuity.save_continuity_session("Keep active", [], tmp_path, filename_timestamp="20260919-020000")
    return tmp_path, source, variant, eye


@pytest.mark.parametrize("client_id", ["live_browser", "archive_browser"])
def test_single_archive_refuses_live_browser_without_changing_parent(archive_case, client_id):
    root, source, variant, eye = archive_case
    worker = SessionPreparer(root)
    try:
        worker.activity(client_id, True)
        with pytest.raises(ValueError, match="Disconnect STS"):
            worker.archive(source)
        assert read_note_file(root, source).content
        assert read_note_file(root, variant).content
        assert (eye / "capture.jpg").exists()
        continuity.save_continuity_session("Child still saves", [], root, parent_session_filename=source)
    finally:
        worker.close()


def test_copy_failure_leaves_every_original_and_retry_uses_same_package(archive_case, monkeypatch):
    from robot_790d import archive_transaction as transaction

    root, source, variant, eye = archive_case
    original_copy = transaction._copy_verified
    calls = 0

    def fail_after_one(*args):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise OSError("disk full")
        return original_copy(*args)

    monkeypatch.setattr(transaction, "_copy_verified", fail_after_one)
    with pytest.raises(OSError, match="disk full"):
        continuity.archive_continuity_session(source, root)
    pending = transaction.pending_archives(root)
    assert len(pending) == 1
    assert pending[0]["state"] == "copying"
    assert resolve_note_path(source, root).exists()
    assert resolve_note_path(variant, root).exists()
    assert (eye / "capture.jpg").read_bytes() == b"original image"
    monkeypatch.setattr(transaction, "_copy_verified", original_copy)
    result = continuity.archive_continuity_session(source, root)
    assert result["archived_session_filename"] == pending[0]["archived_session_filename"]
    assert not transaction.pending_archives(root)
    assert len(list((root / "notes" / "sessions" / "archived").iterdir())) == 1


def test_cleanup_failure_recovers_with_new_worker_and_preserves_shared_assets(archive_case, monkeypatch):
    from robot_790d import archive_transaction as transaction

    root, source, variant, eye = archive_case
    original_remove = transaction._remove_source
    calls = 0

    def fail_after_one(*args):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise OSError("interrupted cleanup")
        return original_remove(*args)

    monkeypatch.setattr(transaction, "_remove_source", fail_after_one)
    with pytest.raises(OSError, match="interrupted cleanup"):
        continuity.archive_continuity_session(source, root)
    pending = transaction.pending_archives(root)
    assert pending[0]["state"] == "cleanup"
    assert resolve_note_path(source, root).exists()
    package = resolve_note_path(pending[0]["archived_session_filename"], root).parent
    assert (package / "sensing-eye" / "capture.jpg").read_bytes() == b"original image"
    # A new reference must retain the asset even if the interrupted plan said move.
    continuity.save_continuity_session("New reference", [], root, sensing_eye_filenames=["capture.jpg"])
    monkeypatch.setattr(transaction, "_remove_source", original_remove)
    worker = SessionPreparer(root)
    try:
        result = worker.archive(source)
        again = worker.archive(source)
    finally:
        worker.close()
    assert result["archived_session_filename"] == again["archived_session_filename"]
    assert (eye / "capture.jpg").exists()
    assert (eye / "capture.jpg.json").exists()
    assert not resolve_note_path(source, root).exists()
    assert not resolve_note_path(variant, root).exists()
    assert not transaction.pending_archives(root)


@pytest.mark.parametrize("change", ["source", "archive"])
def test_changed_source_or_archive_copy_stops_cleanup(archive_case, monkeypatch, change):
    from robot_790d import archive_transaction as transaction

    root, source, _, _ = archive_case
    original_remove = transaction._remove_source
    monkeypatch.setattr(transaction, "_remove_source", lambda *a: (_ for _ in ()).throw(OSError("stop")))
    with pytest.raises(OSError, match="stop"):
        continuity.archive_continuity_session(source, root)
    pending = transaction.pending_archives(root)[0]
    archived = resolve_note_path(pending["archived_session_filename"], root)
    edited = archived if change == "archive" else resolve_note_path(source, root)
    edited.write_text(edited.read_text(encoding="utf-8") + "\nchanged since verification", encoding="utf-8")
    monkeypatch.setattr(transaction, "_remove_source", original_remove)
    with pytest.raises(ValueError, match="Archive copy|Archive source"):
        continuity.archive_continuity_session(source, root)
    assert resolve_note_path(source, root).exists()


def test_interruption_after_final_unlink_can_retry_without_original(archive_case, monkeypatch):
    from robot_790d import archive_transaction as transaction

    root, source, _, _ = archive_case
    original_write = transaction._atomic_json

    def fail_completion(path, value, **kwargs):
        if value.get("state") == "complete":
            raise OSError("power interrupted completion receipt")
        return original_write(path, value, **kwargs)

    monkeypatch.setattr(transaction, "_atomic_json", fail_completion)
    worker = SessionPreparer(root)
    try:
        with pytest.raises(OSError, match="power interrupted"):
            worker.archive(source)
    finally:
        worker.close()
    assert not resolve_note_path(source, root).exists()
    assert transaction.pending_archives(root)[0]["state"] == "cleanup"
    monkeypatch.setattr(transaction, "_atomic_json", original_write)
    restarted = SessionPreparer(root)
    try:
        result = restarted.archive(source)
    finally:
        restarted.close()
    assert result["status"] == "ok"
    assert read_note_file(root, result["archived_session_filename"]).content
    assert not transaction.pending_archives(root)


def test_pending_archive_blocks_preparation_and_receipt_rewrites(archive_case, monkeypatch):
    from robot_790d import archive_transaction as transaction

    root, source, _, _ = archive_case
    worker = SessionPreparer(root)
    worker.jobs[source] = {"state": "queued", "session_filename": source}
    worker._update(source, state="waiting")
    receipt_path = resolve_note_path(worker._status_filename(source), root)
    before = receipt_path.read_bytes()
    original_copy = transaction._copy_verified
    monkeypatch.setattr(transaction, "_copy_verified", lambda *a: (_ for _ in ()).throw(OSError("disk full")))
    try:
        with pytest.raises(OSError, match="disk full"):
            worker.archive(source)
        worker._update(source, state="failed", error="Late preparation failure")
        assert receipt_path.read_bytes() == before
        with pytest.raises(ValueError, match="archive transaction"):
            worker.enqueue(source)
        monkeypatch.setattr(transaction, "_copy_verified", original_copy)
        assert worker.archive(source)["status"] == "ok"
    finally:
        worker.close()


def test_recovery_inventory_api_is_read_only(monkeypatch):
    from robot_790d import sts_page_server as server

    handler = object.__new__(server.StsPageHandler)
    handler.path = "/api/continuity/archive-recovery"
    expected = [{"session_filename": "sessions/original.txt", "state": "cleanup"}]
    monkeypatch.setattr(server, "pending_archives", lambda: expected)
    monkeypatch.setattr(server.session_preparer, "archive", lambda *a: pytest.fail("GET cannot recover or delete"))
    replies = []
    handler._send_json = lambda code, body: replies.append((code, body))
    handler.do_GET()
    assert replies == [(200, {"status": "ok", "pending_archives": expected})]


def test_retry_still_preserves_last_active_session(archive_case, monkeypatch):
    from robot_790d import archive_transaction as transaction

    root, source, _, _ = archive_case
    original_copy = transaction._copy_verified
    monkeypatch.setattr(transaction, "_copy_verified", lambda *a: (_ for _ in ()).throw(OSError("stop")))
    with pytest.raises(OSError, match="stop"):
        continuity.archive_continuity_session(source, root)
    monkeypatch.setattr(transaction, "_copy_verified", original_copy)
    outside = next(item["filename"] for item in continuity.list_continuity_sessions(root)["sessions"]
                   if item["filename"] != source)
    continuity.archive_continuity_session(outside, root)
    with pytest.raises(ValueError, match="only active"):
        continuity.archive_continuity_session(source, root)
    assert resolve_note_path(source, root).exists()
    continuity.save_continuity_session("New thread", [], root)
    assert continuity.archive_continuity_session(source, root)["status"] == "ok"


def test_incomplete_asset_copy_is_not_published_or_removed(archive_case, monkeypatch):
    from robot_790d import archive_transaction as transaction

    root, source, _, eye = archive_case
    original = transaction.shutil.copyfileobj

    def fail_image(incoming, output):
        if incoming.name.endswith("capture.jpg"):
            output.write(b"partial bytes")
            raise OSError("partial disk write")
        return original(incoming, output)

    monkeypatch.setattr(transaction.shutil, "copyfileobj", fail_image)
    with pytest.raises(OSError, match="partial disk write"):
        continuity.archive_continuity_session(source, root)
    archived = transaction.pending_archives(root)[0]["archived_session_filename"]
    package = resolve_note_path(archived, root).parent
    assert not (package / "sensing-eye" / "capture.jpg").exists()
    assert not list(package.rglob("*.tmp"))
    assert (eye / "capture.jpg").read_bytes() == b"original image"
    assert resolve_note_path(source, root).exists()


def test_journal_path_tampering_cannot_delete_outside_archive_sources(archive_case, monkeypatch):
    from robot_790d import archive_transaction as transaction

    root, source, _, _ = archive_case
    monkeypatch.setattr(transaction, "_copy_verified", lambda *a: (_ for _ in ()).throw(OSError("stop")))
    with pytest.raises(OSError, match="stop"):
        continuity.archive_continuity_session(source, root)
    journal = next((root / "logs" / "archive-transactions").glob("*.json"))
    data = json.loads(journal.read_text(encoding="utf-8"))
    data["files"][0]["source"] = "../../outside.txt"
    journal.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ValueError, match="source|path"):
        continuity.archive_continuity_session(source, root)
    assert resolve_note_path(source, root).exists()

import asyncio

import pytest

from robot_790d import continuity
from robot_790d.note_files import read_note_file, resolve_note_path, write_note_file
from robot_790d.session_preparation import SessionPreparer


@pytest.fixture
def branch(tmp_path, monkeypatch):
    monkeypatch.delenv("ROBOT_790_NOTES_PATH", raising=False)

    def save(stamp, parent="", pins=(), assets=()):
        return continuity.save_continuity_session(
            "Transcript\n----------\n[10:00] You: A fact.",
            pins,
            tmp_path,
            parent_session_filename=parent,
            filename_timestamp=stamp,
            sensing_eye_filenames=assets,
        )["session_filename"]

    root = save("20260911-100000")
    child = save("20260911-100001", root, [root])
    leaf = save("20260911-100002", child, [root, child])
    fork = save("20260911-100003", root, [root])
    outside = save("20260911-100004", pins=[root])
    return tmp_path, save, root, child, leaf, fork, outside


def test_branch_preview_and_archive_follow_parent_edges_not_pins(branch):
    path, _, root, child, leaf, fork, outside = branch
    before = read_note_file(path, outside).content
    plan = continuity.preview_continuity_branch_archive(root, path)
    assert {item["filename"] for item in plan["sessions"]} == {root, child, leaf, fork}
    assert plan["session_count"] == 4
    assert plan["allowed"]
    assert resolve_note_path(root, path).exists()  # Preview has no side effects.
    result = continuity.archive_continuity_branch(root, plan["fingerprint"], path)
    assert result["status"] == "ok"
    assert result["archived_session_count"] == 4
    assert result["archived_sessions"][-1]["session_filename"] == root
    assert [s["filename"] for s in continuity.list_continuity_sessions(path)["sessions"]] == [outside]
    assert read_note_file(path, outside).content == before


@pytest.mark.parametrize("change", ["descendant", "content", "no_confirmation"])
def test_stale_or_missing_confirmation_moves_nothing(branch, change):
    path, save, root, child, *_ = branch
    plan = continuity.preview_continuity_branch_archive(root, path)
    fingerprint = plan["fingerprint"]
    if change == "descendant":
        save("20260911-100005", child)
    elif change == "content":
        write_note_file(path, child, read_note_file(path, child).content + "\nMore evidence")
    else:
        fingerprint = ""
    with pytest.raises(ValueError, match="Preview and confirm"):
        continuity.archive_continuity_branch(root, fingerprint, path)
    assert all(resolve_note_path(item["filename"], path).exists() for item in plan["sessions"])


def test_branch_archive_preserves_the_last_active_session(branch):
    path, _, root, *_, outside = branch
    continuity.archive_continuity_session(outside, path)
    plan = continuity.preview_continuity_branch_archive(root, path)
    assert not plan["allowed"]
    with pytest.raises(ValueError, match="at least one active"):
        continuity.archive_continuity_branch(root, plan["fingerprint"], path)
    assert len(continuity.list_continuity_sessions(path)["sessions"]) == 4


def test_branch_packages_include_variants_and_images_shared_outside(branch):
    path, save, root, *_ = branch
    eye = path / "logs" / "sensing-eye"
    eye.mkdir(parents=True)
    (eye / "shared.jpg").write_bytes(b"shared image")
    (eye / "shared.jpg.json").write_text("{}", encoding="utf-8")
    asset_child = save("20260911-100005", root, assets=["shared.jpg"])
    save("20260911-100006", assets=["shared.jpg"])
    for form in ["scrubbed", "summary"]:
        continuity.save_continuity_session_variant("Prepared facts", asset_child, form, path)
    plan = continuity.preview_continuity_branch_archive(root, path)
    result = continuity.archive_continuity_branch(root, plan["fingerprint"], path)
    child_result = next(r for r in result["archived_sessions"] if r["session_filename"] == asset_child)
    assert len(child_result["archived_variant_filenames"]) == 2
    assert child_result["archived_sensing_eye_assets"][0]["retained_for_active_session"]
    assert (eye / "shared.jpg").read_bytes() == b"shared image"
    assert (eye / "shared.jpg.json").exists()
    package = resolve_note_path(child_result["archived_session_filename"], path).parent
    assert (package / "sensing-eye" / "shared.jpg").read_bytes() == b"shared image"


def test_partial_failure_reports_completed_and_remaining_sessions(branch, monkeypatch):
    path, _, root, *_ = branch
    plan = continuity.preview_continuity_branch_archive(root, path)
    original = continuity.archive_continuity_session
    calls = []

    def fail_second(filename, instance_path):
        calls.append(filename)
        if len(calls) == 2:
            raise OSError("disk unavailable")
        return original(filename, instance_path)

    monkeypatch.setattr(continuity, "archive_continuity_session", fail_second)
    result = continuity.archive_continuity_branch(root, plan["fingerprint"], path)
    assert result["status"] == "partial"
    assert result["archived_session_count"] == 1
    assert len(result["remaining_session_filenames"]) == 3
    assert "disk unavailable" in result["error"]
    assert resolve_note_path(root, path).exists()


def test_branch_archive_refuses_connected_browser_and_clears_preparation_jobs(branch):
    path, _, root, child, *_ = branch

    async def blocked(text):
        await asyncio.Event().wait()

    worker = SessionPreparer(path, provider=blocked)
    try:
        worker.activity("sts_browser", True)
        worker.enqueue(child)
        plan = continuity.preview_continuity_branch_archive(root, path)
        with pytest.raises(ValueError, match="Disconnect STS"):
            worker.archive_branch(root, plan["fingerprint"])
        worker.activity("sts_browser", False)
        result = worker.archive_branch(root, plan["fingerprint"])
        assert result["status"] == "ok"
        assert worker.status(child)["state"] == "archived"
        assert child not in worker.queue
        assert not resolve_note_path(child, path).exists()
    finally:
        worker.close()


def test_branch_preview_cycle_is_bounded(branch):
    path, _, root, child, *_ = branch
    content = read_note_file(path, root).content
    write_note_file(path, root, content.replace("Parent session: none", f"Parent session: {child}"))
    plan = continuity.preview_continuity_branch_archive(root, path)
    assert plan["session_count"] == 4


def test_branch_endpoint_preview_cannot_archive(monkeypatch):
    from robot_790d import sts_page_server as server

    handler = object.__new__(server.StsPageHandler)
    replies = []
    handler._read_json_body = lambda: {"session_filename": "sessions/root.txt", "preview": True}
    handler._send_json = lambda code, data: replies.append((code, data))
    monkeypatch.setattr(server, "preview_continuity_branch_archive", lambda name: {"status": "ok", "session_count": 2})
    monkeypatch.setattr(
        server.session_preparer, "archive_branch", lambda *args: pytest.fail("Preview must not archive")
    )
    handler._handle_continuity_archive_branch()
    assert replies == [(200, {"status": "ok", "session_count": 2})]

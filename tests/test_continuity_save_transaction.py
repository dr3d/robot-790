import json
import os
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from http.server import ThreadingHTTPServer
from pathlib import Path
from uuid import uuid4

import pytest

from robot_790d import continuity, continuity_save_transaction, sts_page_server
from robot_790d.note_files import list_note_files, read_note_file, resolve_note_path, write_note_file


@pytest.fixture
def shelf(tmp_path, monkeypatch):
    monkeypatch.setenv("ROBOT_790_NOTES_PATH", str(tmp_path / "notes"))
    return tmp_path


def save(root, identity, body="Accepted transcript.", **kwargs):
    return continuity.save_continuity_session(body, [], root, save_request_id=identity, **kwargs)


def sessions(root):
    return list((root / "notes" / "sessions").glob("session-*.txt"))


def test_retry_returns_same_file_receipt_and_original_parent(shelf):
    parent = save(shelf, str(uuid4()), body="Parent.")["session_filename"]
    identity = str(uuid4())
    first = save(shelf, identity, parent_session_filename=parent)
    content = read_note_file(shelf, first["session_filename"]).content
    second = save(shelf, identity, parent_session_filename=parent)
    assert second == first
    assert second["save_request_id"] == identity
    assert second["parent_session_filename"] == parent
    assert read_note_file(shelf, first["session_filename"]).content == content
    assert len(sessions(shelf)) == 2
    assert all(not name.endswith(".json") for name in list_note_files(shelf))


def test_same_identity_cannot_change_body_parent_assets_or_context(shelf):
    identity = str(uuid4())
    first = save(shelf, identity)
    for body, options in [("Other body", {}), ("Accepted transcript.", {
        "parent_session_filename": first["session_filename"],
    }), ("Accepted transcript.", {"sensing_eye_filenames": ["other.jpg"]}),
        ("Accepted transcript.", {"context_at_save": {"input_tokens": 123}})]:
        with pytest.raises(ValueError, match="different contents"):
            save(shelf, identity, body=body, **options)
    assert len(sessions(shelf)) == 1


def test_concurrent_requests_are_serialized_to_one_file(shelf):
    identity = str(uuid4())
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(lambda _: save(shelf, identity), range(12)))
    assert all(result == results[0] for result in results)
    assert len(sessions(shelf)) == 1


def test_concurrent_processes_share_the_durable_save_lock(shelf):
    identity = str(uuid4())
    script = (
        "import json,sys; from robot_790d.continuity import save_continuity_session; "
        "print(json.dumps(save_continuity_session('Accepted transcript.', [], sys.argv[1], save_request_id=sys.argv[2])))"
    )
    def child(_):
        result = subprocess.run([sys.executable, "-c", script, str(shelf), identity],
                                capture_output=True, text=True, check=True, timeout=20)
        return json.loads(result.stdout)
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(child, range(3)))
    assert all(result == results[0] for result in results)
    assert len(sessions(shelf)) == 1


def test_retry_from_fresh_process_recovers_receipt(shelf):
    identity = str(uuid4())
    first = save(shelf, identity)
    script = (
        "import json,sys; from robot_790d.continuity import save_continuity_session; "
        "print(json.dumps(save_continuity_session('Accepted transcript.', [], sys.argv[1], save_request_id=sys.argv[2])))"
    )
    second = subprocess.run([sys.executable, "-c", script, str(shelf), identity],
                            capture_output=True, text=True, check=True, timeout=20, env=os.environ.copy())
    assert json.loads(second.stdout) == first
    assert len(sessions(shelf)) == 1


@pytest.mark.parametrize("published", [False, True])
def test_interrupted_commit_resumes_reserved_file_not_new_filename(shelf, monkeypatch, published):
    identity = str(uuid4())
    commit = continuity._commit_continuity_save

    def interrupted(*args, **kwargs):
        if published:
            commit(*args, **kwargs)
        raise OSError("simulated process interruption")

    monkeypatch.setattr(continuity, "_commit_continuity_save", interrupted)
    with pytest.raises(OSError):
        save(shelf, identity)
    journal = next((shelf / "logs" / "continuity-saves").rglob("*.json"))
    reserved = json.loads(journal.read_text(encoding="utf-8"))["draft"]["result"]["session_filename"]
    monkeypatch.setattr(continuity, "_commit_continuity_save", commit)
    result = save(shelf, identity)
    assert result["session_filename"] == reserved
    assert len(sessions(shelf)) == 1


def test_lost_journal_completion_does_not_invalidate_saved_note(shelf, monkeypatch):
    identity = str(uuid4())
    publish = continuity_save_transaction._publish

    def fail_final_receipt(path, job):
        if job["state"] == "complete":
            raise OSError("receipt disk failure")
        return publish(path, job)

    monkeypatch.setattr(continuity_save_transaction, "_publish", fail_final_receipt)
    first = save(shelf, identity)
    assert first["status"] == "ok"
    monkeypatch.setattr(continuity_save_transaction, "_publish", publish)
    assert save(shelf, identity) == first
    assert len(sessions(shelf)) == 1


@pytest.mark.parametrize("change", ["edit", "delete", "archive"])
def test_replay_never_overwrites_or_resurrects_changed_session(shelf, change):
    identity = str(uuid4())
    filename = save(shelf, identity)["session_filename"]
    path = resolve_note_path(filename, shelf)
    if change == "edit":
        path.write_text("Operator correction.", encoding="utf-8")
    elif change == "delete":
        path.unlink()
    else:
        save(shelf, str(uuid4()), body="Another active session.")
        continuity.archive_continuity_session(filename, shelf)
    with pytest.raises(ValueError, match="left untouched|no replacement"):
        save(shelf, identity)
    if change == "edit":
        assert path.read_text(encoding="utf-8") == "Operator correction."
    else:
        assert not path.exists()


def test_new_save_identity_is_not_content_deduplication(shelf):
    first = save(shelf, str(uuid4()))
    second = save(shelf, str(uuid4()))
    assert first["session_filename"] != second["session_filename"]
    assert len(sessions(shelf)) == 2


@pytest.mark.parametrize("corrupt", [[], {"version": 1}, None])
def test_corrupted_journal_fails_closed_without_another_save(shelf, corrupt):
    identity = str(uuid4())
    filename = save(shelf, identity)["session_filename"]
    original = read_note_file(shelf, filename).content
    journal = next((shelf / "logs" / "continuity-saves").rglob("*.json"))
    journal.write_text(json.dumps(corrupt), encoding="utf-8")
    with pytest.raises(ValueError, match="Invalid session save journal"):
        save(shelf, identity)
    assert len(sessions(shelf)) == 1
    assert read_note_file(shelf, filename).content == original


@pytest.mark.parametrize("identity", ["../escape", "not-a-uuid", "a" * 1000])
def test_bad_identity_is_rejected_before_writing(shelf, identity):
    with pytest.raises(ValueError, match="canonical UUID"):
        save(shelf, identity)
    assert not sessions(shelf)


def test_exclusive_note_write_cannot_clobber_existing_file(shelf):
    write_note_file(shelf, "existing.txt", "Original")
    with pytest.raises(FileExistsError):
        write_note_file(shelf, "existing.txt", "Replacement", create_only=True)
    assert read_note_file(shelf, "existing.txt").content == "Original"


def test_transactional_handler_validates_identity_and_replays_receipt(shelf, monkeypatch):
    handler = object.__new__(sts_page_server.StsPageHandler)
    responses = []
    payload = {"body": "Accepted transcript.", "save_request_id": str(uuid4())}
    monkeypatch.setattr(handler, "_read_json_body", lambda: payload)
    monkeypatch.setattr(handler, "_send_json", lambda code, body: responses.append((code, body)))
    monkeypatch.setattr(sts_page_server.session_preparer, "enqueue", lambda _: {"state": "fixture"})
    handler._handle_continuity_save(require_identity=True)
    handler._handle_continuity_save(require_identity=True)
    assert responses[0] == responses[1]
    assert responses[0][0] == 200
    assert len(sessions(shelf)) == 1
    del payload["save_request_id"]
    handler._handle_continuity_save(require_identity=True)
    assert responses[-1][0] == 400
    assert len(sessions(shelf)) == 1


def test_browser_orchestration_to_real_http_and_disk_with_lost_replies(shelf, monkeypatch):
    class Handler(sts_page_server.StsPageHandler):
        def log_message(self, *args):
            pass

        def do_POST(self):
            assert self.path == "/api/continuity/save-transaction"
            super().do_POST()

    monkeypatch.setattr(sts_page_server.session_preparer, "enqueue", lambda _: {"state": "fixture"})
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        fixture = Path(__file__).with_name("sts_save_transaction_http.cjs")
        process = subprocess.run(["node", str(fixture), f"http://127.0.0.1:{server.server_port}"],
                                 capture_output=True, text=True, timeout=20)
        assert process.returncode == 0, process.stderr
        result = json.loads(process.stdout)
        assert len(sessions(shelf)) == 2
        assert "The last accepted thought." in read_note_file(shelf, result["first"]).content
        second = read_note_file(shelf, result["second"]).content
        assert "The next accepted session." in second
        assert f"Parent session: {result['first']}" in second
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=5)

import asyncio
import json
import threading
import time

import pytest

from robot_790d import session_preparation as prep
from robot_790d.continuity import (
    continuity_session_variant_records,
    list_continuity_sessions,
    save_continuity_session,
    save_continuity_session_variant,
)
from robot_790d.note_files import read_note_file, resolve_note_path, write_note_file
from robot_790d.sts_page_server import StsPageHandler

TRANSCRIPT = "[10:00] You: Remember this.\n  [v: quiet]\n[10:01] Eric: Yes.\n[10:02] Eric: Yes."
BODY = (
    "Session Demarcation\n-------------------\nLoaded context: old material\n\n"
    "Transcript Since Clean Connect\n------------------------------\n"
    + TRANSCRIPT
    + "\n\nB2 Notes For Eric\n------------------\n- none\n\nRecent Brain2 Tail\n------------------\nfired: auto"
)


@pytest.fixture
def root(tmp_path, monkeypatch):
    monkeypatch.delenv("ROBOT_790_NOTES_PATH", raising=False)
    return tmp_path


def session(root, stamp="20260910-120000"):
    return save_continuity_session(BODY, [], root, filename_timestamp=stamp)["session_filename"]


def wait_until(predicate, timeout=5):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(0.02)
    assert predicate(), "Timed out waiting for preparation state"


async def provider(text):
    assert text == TRANSCRIPT
    return "The operator asked Eric to remember something; no specific fact was supplied.", {
        "model": "test",
        "title": "An unspecified memory request",
    }


def test_conservative_sweep_preserves_utterances_and_excludes_restore_and_b2():
    swept = prep.scrub_session(BODY.replace("\n", "\r\n"))
    assert TRANSCRIPT in swept
    assert swept.count("Eric: Yes.") == 2
    assert "old material" not in swept
    assert "fired: auto" not in swept
    assert prep.session_transcript(BODY) == TRANSCRIPT
    with pytest.raises(ValueError, match="No delimited transcript"):
        prep.scrub_session("something without transcript delimiters")


def test_request_is_small_text_only_and_not_silently_truncated():
    payload = prep.summary_request(TRANSCRIPT)
    assert payload["messages"] == [
        {
            "role": "system",
            "content": prep.SUMMARY_PROMPT + " Use at most 80 words in the summary; be shorter when little happened.",
        },
        {"role": "user", "content": TRANSCRIPT},
    ]
    assert "tools" not in payload
    assert payload["reasoning_effort"] == "none"
    assert payload["chat_template_kwargs"] == {"enable_thinking": False}
    assert payload["response_format"]["json_schema"]["schema"]["required"] == ["title", "summary"]
    with pytest.raises(ValueError, match="no transcript was silently truncated"):
        prep.summary_request("x" * (prep.MAX_SUMMARY_INPUT_CHARS + 1))


@pytest.mark.parametrize(
    "choice",
    [
        {"finish_reason": "length", "message": {"content": "partial"}},
        {"finish_reason": "stop", "message": {"content": ""}},
        {"finish_reason": "stop", "message": {"content": "<think>private</think>text"}},
        {"finish_reason": "stop", "message": {"content": "ok", "tool_calls": [{}]}},
    ],
)
def test_bad_completions_are_not_saved(choice):
    with pytest.raises(ValueError):
        prep.summary_result({"choices": [choice]})


def test_nonlocal_endpoint_is_rejected_before_sending(monkeypatch):
    monkeypatch.setenv("ROBOT_790_SUMMARY_BASE_URL", "https://example.com/v1")
    with pytest.raises(ValueError, match="local loopback"):
        asyncio.run(prep.request_summary(TRANSCRIPT))


def test_structured_summary_separates_title_from_loadable_text():
    payload = {
        "choices": [
            {
                "finish_reason": "stop",
                "message": {
                    "content": json.dumps(
                        {"title": "Memory request and repetition", "summary": [
                            {"speaker": "operator", "text": "Requested a memory."},
                            {"speaker": "eric", "text": "Reported hearing his servos humming."},
                        ]}
                    )
                },
            }
        ]
    }
    body, title = prep.summary_result(payload)
    assert title == "Memory request and repetition"
    assert "not independent sensor or action verification" in body
    assert "Operator's account: Requested a memory." in body
    assert "Eric's account: Reported hearing his servos humming." in body


@pytest.mark.parametrize(
    "fields",
    [
        {},
        [],
        {"summary": "no title"},
        {"title": "Session note", "summary": "ok"},
        {"title": "A useful title", "summary": 12},
        {"title": "A useful title", "summary": ""},
        {"title": "A useful title", "summary": []},
        {"title": "A useful title", "summary": [{"speaker": "sensor", "text": "Silence"}]},
        {"title": "A useful title", "summary": [{"speaker": [], "text": "Silence"}]},
        {"title": "A useful title", "summary": [{"speaker": "eric", "text": ""}]},
        {"title": "A useful title", "summary": "<think>not a summary</think>"},
        {"title": "Title\nwith newline", "summary": "ok"},
    ],
)
def test_malformed_structured_summary_is_rejected(fields):
    with pytest.raises(ValueError):
        prep.summary_result({"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(fields)}}]})


def test_prepare_keeps_raw_and_marks_derivatives_unreviewed(root):
    filename = session(root)
    original = resolve_note_path(filename, root).read_bytes()
    worker = prep.SessionPreparer(root, provider=provider)
    try:
        worker.enqueue(filename)
        wait_until(lambda: worker.status(filename)["state"] == "ready")
        assert resolve_note_path(filename, root).read_bytes() == original
        forms = continuity_session_variant_records(filename, root)
        assert all(form["status"] == "available" for form in forms)
        assert all(form["review"] == "generated; not human-reviewed" for form in forms[1:])
        assert worker.status(filename)["receipt"]["model"] == "test"
        assert list_continuity_sessions(root)["sessions"][0]["title"] == "An unspecified memory request"
        summary = next(form for form in forms if form["key"] == "summary")
        assert '"title"' not in read_note_file(root, summary["filename"]).content
        worker.enqueue(filename)
        wait_until(lambda: worker.status(filename)["state"] == "ready")
    finally:
        worker.close()


def test_existing_reviewed_summary_is_not_replaced(root):
    filename = session(root)
    saved = save_continuity_session_variant("Human work", filename, "summary", root)

    async def forbidden(text):
        raise AssertionError("Existing summary must not trigger inference")

    worker = prep.SessionPreparer(root, provider=forbidden)
    try:
        worker.enqueue(filename)
        wait_until(lambda: worker.status(filename)["state"] == "ready")
        assert "Human work" in read_note_file(root, saved["variant_filename"]).content
    finally:
        worker.close()


def test_failure_retains_scrubbed_and_can_retry(root):
    filename = session(root)

    async def failing(text):
        raise ValueError("LLM unavailable")

    worker = prep.SessionPreparer(root, provider=failing)
    try:
        worker.enqueue(filename)
        wait_until(lambda: worker.status(filename)["state"] == "failed")
        assert "LLM unavailable" in worker.status(filename)["error"]
        forms = continuity_session_variant_records(filename, root)
        assert [f["status"] for f in forms] == ["available", "available", "missing"]
        worker.provider = provider
        worker.enqueue(filename)
        wait_until(lambda: worker.status(filename)["state"] == "ready")
        assert worker.status(filename)["error"] == ""
    finally:
        worker.close()


def test_active_conversation_waits_then_interrupts_blocked_inference(root):
    filename = session(root)
    entered = threading.Event()
    stopped = threading.Event()

    async def blocked(text):
        entered.set()
        try:
            await asyncio.Event().wait()
        finally:
            stopped.set()

    worker = prep.SessionPreparer(root, provider=blocked)
    try:
        worker.activity("browser", True)
        queued = worker.enqueue(filename)
        assert worker.enqueue(filename)["source_sha256"] == queued["source_sha256"]
        wait_until(lambda: worker.status(filename)["state"] == "waiting")
        assert not entered.is_set()
        worker.activity("browser", False)
        assert entered.wait(3)
        started = time.monotonic()
        assert worker.activity("browser", True)
        assert time.monotonic() - started < 2
        assert stopped.is_set()
        wait_until(lambda: worker.status(filename)["state"] == "waiting")
        worker.provider = provider
        worker.activity("browser", False)
        wait_until(lambda: worker.status(filename)["state"] == "ready")
    finally:
        worker.close()


def test_changed_source_during_inference_never_gets_wrong_hash(root):
    filename = session(root)

    async def editing(text):
        old = read_note_file(root, filename).content
        write_note_file(root, filename, old + "\nnew information")
        return "Old summary", {}

    worker = prep.SessionPreparer(root, provider=editing)
    try:
        worker.enqueue(filename)
        wait_until(lambda: worker.status(filename)["state"] == "failed")
        assert "changed" in worker.status(filename)["error"]
        assert continuity_session_variant_records(filename, root)[2]["status"] == "missing"
        with pytest.raises(ValueError, match="changed"):
            save_continuity_session_variant("wrong", filename, "summary", root, expected_source_sha256="0" * 64)
    finally:
        worker.close()


def test_archive_waiting_job_moves_receipt_and_does_not_resurrect_variants(root):
    filename = session(root)
    session(root, "20260910-130000")
    worker = prep.SessionPreparer(root, provider=provider)
    try:
        worker.activity("browser", True)
        worker.enqueue(filename)
        wait_until(lambda: worker.status(filename)["state"] == "waiting")
        result = worker.archive(filename)
        assert any(name.endswith(".preparation.json") for name in result["archived_variant_filenames"])
        assert not resolve_note_path(filename, root).exists()
        worker.activity("browser", False)
        assert worker.status(filename)["state"] == "archived"
        assert not worker.queue
    finally:
        worker.close()


def test_restart_marks_persisted_job_interrupted_without_automatically_running(root):
    filename = session(root)
    worker = prep.SessionPreparer(root, provider=provider)
    write_note_file(root, worker._status_filename(filename), json.dumps({"state": "running"}))
    assert worker.status(filename)["state"] == "interrupted"
    assert worker.thread is None


def test_save_api_success_is_independent_of_preparation(monkeypatch):
    from robot_790d import sts_page_server as server

    handler = object.__new__(StsPageHandler)
    replies = []
    handler._read_json_body = lambda: {"body": BODY}
    handler._send_json = lambda code, body: replies.append((code, body))
    monkeypatch.setattr(
        server,
        "save_continuity_session",
        lambda *args, **kwargs: {"status": "ok", "session_filename": "sessions/new.txt"},
    )

    class BrokenPreparer:
        def enqueue(self, filename):
            raise OSError("Disk unavailable")

    monkeypatch.setattr(server, "session_preparer", BrokenPreparer())
    handler._handle_continuity_save()
    assert replies[0][0] == 200
    assert replies[0][1]["status"] == "ok"
    assert replies[0][1]["preparation"]["state"] == "failed"


def test_activity_api_rejects_non_boolean():
    handler = object.__new__(StsPageHandler)
    replies = []
    handler._read_json_body = lambda: {"client_id": "browser", "active": "false"}
    handler._send_json = lambda code, body: replies.append((code, body))
    handler._handle_preparation_activity()
    assert replies[0][0] == 400

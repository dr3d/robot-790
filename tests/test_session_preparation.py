import asyncio
import json
import threading
import time

import httpx
import pytest

from robot_790d import session_preparation as prep
from robot_790d.continuity import (
    continuity_session_variant_records,
    list_continuity_sessions,
    save_continuity_session,
    save_continuity_session_title,
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

    # The new sweep can still need inference; the human summary must win.
    worker = prep.SessionPreparer(root, provider=provider)
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


def test_semantic_sweep_preserves_verbatim_and_protects_image_anchors():
    transcript = ("[10:00] You: I am busy, chill.\n  [v: quiet]\n"
                  "[10:01] System: [sensing-eye visual note opened into B1 context: id eye-1 "
                  "file logs/sensing-eye/face.png size 20x20]\n"
                  "[10:02] Robot 790: The copper frame looks like a musical staff.\n"
                  "[10:03] You: That is a keeper.\n"
                  "[10:04] You: I am busy, chill.")
    body, dropped = prep.semantic_sweep(transcript, [1, 2, 4])
    assert dropped == []
    assert body.count("I am busy, chill.") == 2
    assert "[10:02] Robot 790: The copper frame looks like a musical staff." in body
    assert "That is a keeper." in body
    assert "[v: quiet]" in body
    assert prep.image_anchor_ids(prep.transcript_turns(transcript)) == {1, 2}


@pytest.mark.parametrize("ids", [[True], [-1], [3], [1, 1], [0, 1, 2], None, "1"])
def test_semantic_sweep_rejects_invalid_deletion_plans(ids):
    with pytest.raises(ValueError):
        prep.semantic_sweep(TRANSCRIPT, ids)


def test_preparation_request_mines_original_turns_and_feedback():
    request = prep.preparation_request(TRANSCRIPT)
    turns = json.loads(request["messages"][1]["content"])
    assert turns[0] == {"id": 0, "text": "[10:00] You: Remember this.\n  [v: quiet]"}
    assert len(turns) == 3
    assert "drop_turn_ids" in request["response_format"]["json_schema"]["schema"]["required"]
    assert "ALL original turns" in request["messages"][0]["content"]
    assert "silence is not approval" in request["messages"][0]["content"]
    assert "Unique idle" in request["messages"][0]["content"]


def test_sweep_keeps_the_exchange_a_retained_correction_refers_to():
    text = ("[10:00] You: Show the panda.\n"
            "[10:01] Robot 790: Looking now.\n"
            "[10:02] Robot 790: Found it, opening.\n"
            "[10:03] You: That clipped and nothing appeared.")
    body, dropped = prep.semantic_sweep(text, [0, 1, 2])
    assert dropped == []
    assert "Show the panda." in body
    assert "Found it, opening." in body
    assert "nothing appeared" in body


def test_sweep_protects_return_and_failures_even_when_model_drops_whole_exchange():
    rows = ["[10:00 PM] You: Draw a harbor.", "[10:01 PM] Eric: Here it is."]
    rows += [f"[1:00 AM] Eric: Autonomous thought {i}." for i in range(60)]
    ending = ["[5:41 AM] You: Eric.", "[5:41 AM] Eric: Could you repeat that?",
              "[5:41 AM] You: I said Eric.", "[5:41 AM] Eric: Here, Scott.",
              "[5:42 AM] Eric: Old thought again.", "[5:43 AM] You: Shut you down.",
              "[5:43 AM] Eric: Voice shutdown is not available."]
    rows += ending
    body, dropped = prep.semantic_sweep("\n".join(rows), list(range(2, len(rows))))
    assert dropped
    assert all(line in body for line in ending)
    assert all(i not in dropped for i in range(len(rows) - 16, len(rows)))
    assert "Autonomous thought 15." not in body


def test_sweep_protects_operator_words_without_english_failure_detection():
    rows = ["[10:00] You: \u00c7a ne marche pas.", "[10:01] Eric: D'accord."]
    rows += [f"[11:00] Eric: Thought {i}." for i in range(40)]
    body, dropped = prep.semantic_sweep("\n".join(rows), list(range(len(rows) - 1)))
    assert rows[0] in body and rows[1] in body
    assert 15 in dropped


def test_sweep_validation_checks_duplicates_and_missing_tail(root):
    transcript = "[10:00] You: A correction.\n[10:01] Eric: Yes.\n[10:01] Eric: Yes."
    source = "Transcript\n----------\n" + transcript
    assert prep.sweep_preserves_required_turns(source, source)
    assert not prep.sweep_preserves_required_turns(source, source.rsplit("\n", 1)[0])


def test_summary_source_citations_cannot_silently_cross_speakers():
    turns = prep.transcript_turns(TRANSCRIPT)
    prep.validate_summary_sources([{"speaker": "operator", "source_turn_ids": [0]}], turns)
    prep.validate_summary_sources([{"speaker": "eric", "source_turn_ids": [1, 2]}], turns)
    for ids in [[0], [999], [True], [], None]:
        with pytest.raises(ValueError):
            prep.validate_summary_sources([{"speaker": "eric", "source_turn_ids": ids}], turns)


def test_semantic_derivatives_written_and_reused_without_changing_raw(root):
    filename = session(root)
    original = read_note_file(root, filename).content
    calls = []

    async def semantic_provider(text):
        calls.append(text)
        swept, dropped = prep.semantic_sweep(text, [2])
        return prep.SUMMARY_VERSION + "\nOperator requested an unspecified memory.", {
            "title": "An unspecified memory request", "swept_body": swept, "dropped_turn_ids": dropped,
        }

    worker = prep.SessionPreparer(root, provider=semantic_provider)
    try:
        for _ in range(2):
            worker.enqueue(filename)
            wait_until(lambda: worker.status(filename)["state"] == "ready")
        assert len(calls) == 1
        assert read_note_file(root, filename).content == original
        forms = continuity_session_variant_records(filename, root)
        assert all(prep.prepared_variant(f, root) for f in forms[1:])
        assert "swept_body" not in worker.status(filename)["receipt"]
        swept = read_note_file(root, forms[1]["filename"]).content
        assert swept.count("Eric: Yes.") == 2
    finally:
        worker.close()


@pytest.fixture
def llm_response(monkeypatch):
    fields = {
        "title": "Memory request and repeated replies",
        "summary": [{"speaker": "operator", "text": "Requested a memory.", "source_turn_ids": [1]}],
        "drop_turn_ids": [],
    }
    response = {"choices": [{"finish_reason": "stop", "message": {"content": ""}}],
                "usage": {"prompt_tokens": 100, "completion_tokens": 25}}
    requests = []

    def handler(request):
        requests.append(json.loads(request.content))
        response["choices"][0]["message"]["content"] = json.dumps(fields)
        return httpx.Response(200, json=response)

    client_type = httpx.AsyncClient
    monkeypatch.setenv("ROBOT_790_SUMMARY_BASE_URL", "http://127.0.0.1:1234/v1")
    monkeypatch.setattr(prep.httpx, "AsyncClient", lambda **kwargs: client_type(
        **kwargs, transport=httpx.MockTransport(handler)))
    return fields, response, requests


@pytest.mark.parametrize("invalid_part", ["speaker", "sweep", "summary"])
def test_valid_title_survives_rejected_continuity_content(root, llm_response, invalid_part):
    fields, _, requests = llm_response
    if invalid_part != "speaker":
        fields["summary"][0]["source_turn_ids"] = [0]
    if invalid_part == "sweep":
        fields["drop_turn_ids"] = [999]
    if invalid_part == "summary":
        fields["summary"] = []
    filename = session(root)
    original = resolve_note_path(filename, root).read_bytes()
    worker = prep.SessionPreparer(root)
    try:
        worker.enqueue(filename)
        wait_until(lambda: worker.status(filename)["state"] == "failed")
        status = worker.status(filename)
        assert status["title"] == "available"
        assert status["summary"] == "failed"
        assert status["failure_receipt"]["request"] == requests[0]
        assert status["failure_receipt"]["usage"]["completion_tokens"] == 25
        assert json.loads(status["failure_receipt"]["response"]["choices"][0]["message"]["content"]) == fields
        assert list_continuity_sessions(root)["sessions"][0]["title"] == fields["title"]
        assert resolve_note_path(filename, root).read_bytes() == original
        forms = continuity_session_variant_records(filename, root)
        assert [form["status"] for form in forms] == ["available", "available", "missing"]
        assert not prep.prepared_variant(forms[1], root)
        assert "receipt" not in status  # No accepted-summary receipt on failed jobs.
        if invalid_part == "speaker":
            assert "item 0 (operator), source turns [1]" in status["error"]
        restarted = prep.SessionPreparer(root)
        assert restarted.status(filename)["failure_receipt"] == status["failure_receipt"]
        assert len(requests) == 1  # Salvage does not make another model call.
    finally:
        worker.close()


def test_retry_preserves_reviewed_title_and_completes_summary(root, llm_response):
    fields, _, requests = llm_response
    filename = session(root)
    worker = prep.SessionPreparer(root)
    try:
        worker.enqueue(filename)
        wait_until(lambda: worker.status(filename)["state"] == "failed")
        save_continuity_session_title("Operator chosen caption", filename, root)
        worker.enqueue(filename)
        wait_until(lambda: worker.status(filename)["state"] == "failed")
        assert list_continuity_sessions(root)["sessions"][0]["title"] == "Operator chosen caption"
        fields["summary"][0]["source_turn_ids"] = [0]
        worker.enqueue(filename)
        wait_until(lambda: worker.status(filename)["state"] == "ready")
        assert worker.status(filename)["summary"] == "available"
        assert worker.status(filename)["error"] == ""
        assert worker.status(filename)["failure_receipt"]  # Keep the earlier failure audit.
        assert list_continuity_sessions(root)["sessions"][0]["title"] == "Operator chosen caption"
        assert len(requests) == 3
    finally:
        worker.close()


@pytest.mark.parametrize("bad_title", ["Session note", "Untitled", "<think>caption</think>", "two\nlines"])
def test_invalid_title_is_not_salvaged(root, llm_response, bad_title):
    fields, _, _ = llm_response
    fields["title"] = bad_title
    filename = session(root)
    worker = prep.SessionPreparer(root)
    try:
        worker.enqueue(filename)
        wait_until(lambda: worker.status(filename)["state"] == "failed")
        assert not list(resolve_note_path(filename, root).parent.glob("variants/*.title.json"))
    finally:
        worker.close()


def test_truncated_completion_does_not_salvage_title(root, llm_response):
    _, response, _ = llm_response
    response["choices"][0]["finish_reason"] = "length"
    filename = session(root)
    worker = prep.SessionPreparer(root)
    try:
        worker.enqueue(filename)
        wait_until(lambda: worker.status(filename)["state"] == "failed")
        assert "did not finish cleanly" in worker.status(filename)["error"]
        assert not list(resolve_note_path(filename, root).parent.glob("variants/*.title.json"))
    finally:
        worker.close()


def test_changed_source_does_not_receive_salvaged_title(root, llm_response):
    filename = session(root)

    async def editing(text):
        try:
            return await prep.request_summary(text)
        except prep.PreparationValidationError:
            write_note_file(root, filename, read_note_file(root, filename).content + "\nChanged source")
            raise

    worker = prep.SessionPreparer(root, provider=editing)
    try:
        worker.enqueue(filename)
        wait_until(lambda: worker.status(filename)["state"] == "failed")
        assert "Source changed" in worker.status(filename)["error"]
        assert not list(resolve_note_path(filename, root).parent.glob("variants/*.title.json"))
    finally:
        worker.close()

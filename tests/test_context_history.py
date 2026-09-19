import pytest

from robot_790d.context_history import context_history_plan, history_config
from robot_790d.continuity import (
    save_continuity_session,
    save_continuity_session_variant,
    select_continuity_session,
)
from robot_790d.note_files import read_note_file, write_note_file


@pytest.fixture
def root(tmp_path, monkeypatch):
    monkeypatch.delenv("ROBOT_790_NOTES_PATH", raising=False)
    return tmp_path


def make_thread(root, count=4):
    write_note_file(root, "core/profile.txt", "Ordinary pinned facts")
    sessions = []
    for i in range(count):
        saved = save_continuity_session(
            f"Transcript\n----------\n[10:00] You: Unique fact {i}.",
            [*reversed(sessions), "core/profile.txt"],
            root,
            parent_session_filename=sessions[-1] if sessions else "",
            filename_timestamp=f"20260911-1000{i:02d}",
        )["session_filename"]
        sessions.append(saved)
        for variant in ["scrubbed", "summary"]:
            save_continuity_session_variant(f"{variant} fact {i}", saved, variant, root)
    return sessions


def test_two_recent_swept_older_summaries_no_raw_duplicates(root):
    sessions = make_thread(root)
    plan = context_history_plan(select_continuity_session(sessions[-1], root), instance_path=root, use_summaries=True)
    assert plan["status"] == "ok"
    assert [x["resume_form"] for x in plan["history_inventory"]] == ["scrubbed", "scrubbed", "summary", "summary"]
    assert [x["filename"] for x in plan["history_notes"]] == [*reversed(sessions), "core/profile.txt"]
    assert "Unique fact" not in "\n".join(x["content"] for x in plan["history_notes"])
    assert "Ordinary pinned facts" in plan["history_notes"][-1]["content"]
    assert plan["session_filename"] == sessions[-1]
    assert "Unique fact 3" in read_note_file(root, sessions[-1]).content


def test_zero_recent_and_single_session(root):
    sessions = make_thread(root)
    plan = context_history_plan(
        select_continuity_session(sessions[0], root), instance_path=root, recent_swept_sessions=0, use_summaries=True
    )
    assert [x["resume_form"] for x in plan["history_inventory"]] == ["summary"]
    assert len(plan["history_notes"]) == 2


@pytest.mark.parametrize("recent", [0, 2, 20])
def test_sweeps_only_default_has_no_age_cutoff(root, recent):
    sessions = make_thread(root, count=22)
    plan = context_history_plan(
        select_continuity_session(sessions[-1], root), instance_path=root, recent_swept_sessions=recent,
    )
    assert plan["status"] == "ok"
    assert len(plan["history_inventory"]) == 22
    assert all(item["resume_form"] == "scrubbed" for item in plan["history_inventory"])
    assert all(item["load_filename"].endswith(".scrubbed.txt") for item in plan["history_notes"][:-1])
    assert not plan["history_policy"]["use_summaries"]
    assert plan["resume_form_label"] == "Auto: all retained sessions swept"


def test_missing_older_sweep_uses_original_not_available_summary(root):
    sessions = make_thread(root)
    save_continuity_session_variant("Legacy sweep", sessions[0], "scrubbed", root, reviewed=False)
    plan = context_history_plan(select_continuity_session(sessions[-1], root), instance_path=root)
    assert plan["preparation_required"] == []
    assert plan["status"] == "ok"
    assert plan["history_notes"][-2]["content"] == read_note_file(root, sessions[0]).content
    assert plan["history_inventory"][-1]["resume_form"] == "raw"


def test_history_config_defaults_to_sweeps():
    assert history_config(None) == {"recent_swept_sessions": 2, "use_summaries": False}
    assert history_config({"recent_swept_sessions": 2})["use_summaries"] is False


@pytest.mark.parametrize("value", [0, 1, "false", None, []])
def test_invalid_summary_switch_is_explicit(value):
    with pytest.raises(ValueError, match="use_summaries"):
        history_config({"use_summaries": value})


def test_stale_derivative_uses_current_original(root):
    sessions = make_thread(root)
    source = read_note_file(root, sessions[-1])
    write_note_file(root, source.filename, source.content + "\nchanged")
    plan = context_history_plan(select_continuity_session(sessions[-1], root), instance_path=root)
    assert plan["status"] == "ok"
    assert plan["preparation_required"] == []
    assert plan["history_notes"][0]["content"] == source.content + "\nchanged"
    assert plan["history_inventory"][0]["fallback_status"] == "stale"


def test_unpinned_history_is_not_resurrected_and_archived_pins_are_skipped(root):
    sessions = make_thread(root)
    selected = select_continuity_session(sessions[-1], root)
    selected["pinned_notes"] = [
        {"filename": "sessions/archived/old.txt", "status": "ok"},
        {"filename": sessions[0], "status": "ok"},
    ]
    plan = context_history_plan(selected, instance_path=root)
    assert [x["filename"] for x in plan["history_notes"]] == [sessions[-1], sessions[0]]
    assert plan["skipped_notes"] == ["sessions/archived/old.txt"]


def test_variant_pins_use_original_identity_and_are_deduplicated(root):
    sessions = make_thread(root)
    selected = select_continuity_session(sessions[-1], root)
    old = select_continuity_session(sessions[0], root, resume_form="summary")
    selected["pinned_notes"].append({"filename": old["load_filename"], "status": "ok"})
    plan = context_history_plan(selected, instance_path=root)
    assert len(plan["history_inventory"]) == 4
    assert plan["history_inventory"][-1]["session_filename"] == sessions[0]


def test_old_generated_sweep_is_not_misrepresented_as_new(root):
    sessions = make_thread(root)
    save_continuity_session_variant("Conservative sweep v1", sessions[-1], "scrubbed", root, reviewed=False)
    plan = context_history_plan(select_continuity_session(sessions[-1], root), instance_path=root)
    assert plan["preparation_required"] == []
    assert plan["history_inventory"][0]["resume_form"] == "raw"
    assert plan["history_notes"][0]["content"] == read_note_file(root, sessions[-1]).content


def test_unsafe_semantic_sweep_falls_back_to_raw_without_model_or_source_edits(root):
    filename = make_thread(root, count=1)[0]
    original = read_note_file(root, filename).content
    save_continuity_session_variant(
        "Conservative semantic sweep v2\nTranscript\n----------\n[11:00] Eric: An idle thought.",
        filename, "scrubbed", root, reviewed=False,
    )
    plan = context_history_plan(select_continuity_session(filename, root), instance_path=root)
    assert plan["status"] == "ok"
    assert plan["preparation_required"] == []
    assert plan["history_inventory"][0]["resume_form"] == "raw"
    assert plan["history_inventory"][0]["fallback_status"] == "unprepared"
    assert plan["history_notes"][0]["content"] == original
    assert read_note_file(root, filename).content == original


def test_valid_generated_sweep_remains_preferred(root):
    from robot_790d import session_preparation as prep

    filename = make_thread(root, count=1)[0]
    source = read_note_file(root, filename).content
    swept, _ = prep.semantic_sweep(prep.session_transcript(source), [])
    save_continuity_session_variant(swept, filename, "scrubbed", root, reviewed=False)
    plan = context_history_plan(select_continuity_session(filename, root), instance_path=root)
    assert plan["history_inventory"][0]["resume_form"] == "scrubbed"
    assert "fallback_reason" not in plan["history_inventory"][0]
    assert prep.SWEEP_VERSION in plan["history_notes"][0]["content"]
    assert "Source created:" in plan["history_notes"][0]["content"]


@pytest.mark.parametrize("value", [-1, 21, True, "2", 2.1])
def test_invalid_history_configuration_is_explicit(value):
    with pytest.raises(ValueError, match="recent_swept_sessions"):
        history_config({"recent_swept_sessions": value})


def test_no_saved_sessions_need_no_preparation():
    assert context_history_plan({"status": "unavailable"}) == {"status": "unavailable"}


@pytest.mark.parametrize("prepare,preview", [(True, False), (False, False), (False, True)])
def test_history_endpoint_returns_original_without_enqueuing(root, monkeypatch, prepare, preview):
    from robot_790d import session_preparation as prep
    from robot_790d import sts_page_server as server

    filename = make_thread(root)[0]
    save_continuity_session_variant("Legacy generated sweep", filename, "scrubbed", root, reviewed=False)

    worker = prep.SessionPreparer(root)
    def unexpected_enqueue(*args, **kwargs):
        pytest.fail("Connect must not enqueue model preparation")
    monkeypatch.setattr(worker, "enqueue", unexpected_enqueue)
    monkeypatch.setattr(server, "session_preparer", worker)
    monkeypatch.setattr(server, "select_continuity_session", lambda name: select_continuity_session(name, root))
    original_plan = server.context_history_plan
    monkeypatch.setattr(
        server, "context_history_plan", lambda selected, **kw: original_plan(selected, instance_path=root, **kw)
    )
    handler = object.__new__(server.StsPageHandler)
    payload = {"session_filename": filename, "prepare": prepare, "preview": preview}
    replies = []
    handler._read_json_body = lambda: payload
    handler._send_json = lambda code, data: replies.append((code, data))
    try:
        handler._handle_context_history()
        assert replies[-1][0] == 200
        plan = replies[-1][1]
        assert plan["history_notes"][0]["filename"] == filename
        assert plan["history_notes"][0]["content"] == read_note_file(root, filename).content
        assert plan["preparation"] == []
        assert not worker.queue
    finally:
        worker.close()


def test_oversized_failed_preparation_does_not_block_resume(root):
    from robot_790d import session_preparation as prep

    transcript = "[10:00] You: Beginning.\n" + "[10:01] Eric: A thought.\n" * 4500 + "[11:00] You: Ending."
    with pytest.raises(ValueError, match="96,000"):
        prep.summary_request(transcript)
    filename = save_continuity_session("Transcript\n----------\n" + transcript, [], root)["session_filename"]
    source = read_note_file(root, filename).content
    plan = context_history_plan(select_continuity_session(filename, root), instance_path=root)
    assert plan["status"] == "ok"
    assert plan["preparation_required"] == []
    assert plan["history_notes"][0]["content"] == source
    assert plan["history_inventory"][0]["source_sha256"] == prep.digest(source)
    assert plan["history_inventory"][0]["fallback_status"] == "missing"
    assert read_note_file(root, filename).content == source


def test_unavailable_explicit_summary_falls_back_with_truthful_receipt(root):
    filename = make_thread(root, count=1)[0]
    save_continuity_session_variant("Legacy summary", filename, "summary", root, reviewed=False)
    plan = context_history_plan(
        select_continuity_session(filename, root), instance_path=root, use_summaries=True, recent_swept_sessions=0,
    )
    item = plan["history_inventory"][0]
    assert item["requested_form"] == "summary"
    assert item["resume_form"] == "raw"
    assert plan["history_notes"][0]["content"] == read_note_file(root, filename).content
    assert "full fallback" in plan["resume_form_label"]


def test_unreadable_derivative_falls_back_but_unreadable_source_does_not(root, monkeypatch):
    from robot_790d import context_history as history

    filename = make_thread(root, count=1)[0]
    selection = select_continuity_session(filename, root)
    original = history.read_note_file

    def fail_derivative(instance, name):
        if name.endswith(".scrubbed.txt"):
            raise OSError("Derivative unavailable")
        return original(instance, name)

    monkeypatch.setattr(history, "read_note_file", fail_derivative)
    plan = history.context_history_plan(selection, instance_path=root)
    assert plan["history_notes"][0]["content"] == original(root, filename).content
    assert plan["history_inventory"][0]["fallback_status"] == "unreadable"

    def fail_source(*args):
        raise OSError("Source unavailable")

    monkeypatch.setattr(history, "read_note_file", fail_source)
    with pytest.raises(OSError, match="Source unavailable"):
        history.context_history_plan(selection, instance_path=root)

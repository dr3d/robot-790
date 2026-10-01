import copy
import importlib.util
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("b2_history_lab", ROOT / "scripts/b2_history_lab.py")
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)


def test_multiline_transcript_and_prosody(tmp_path):
    path = tmp_path / "conversation.txt"
    path.write_text("Header\n[1:01:01 PM] You: Long question.\n  [v: low]\n"
                    "[1:01:03 PM] Robot 790: First line.\n\nSecond paragraph.\n"
                    "[1:01:10 PM] System: Old receipt.\n", encoding="utf-8")
    rows = lab.read_transcript(path, "2026-09-30")
    assert len(rows) == 3
    assert rows[0]["prosody"] == "[v: low]"
    assert rows[1]["text"].endswith("First line.\n\nSecond paragraph.")
    assert rows[0]["line"] == 2
    assert rows[1]["end_line"] == 6
    assert rows[0]["at"] == "2026-09-30T13:01:01-04:00"


def base_request():
    return {"model": "fixture", "messages": [{"role": "system", "content": "System"},
            {"role": "user", "content": "Present evidence"}], "temperature": 0.55,
            "max_tokens": 420, "response_format": {"type": "json_schema"}}


def test_arms_change_only_documented_prompt_parts():
    base = base_request()
    original = copy.deepcopy(base)
    passage = {"source": "old.txt", "text": "An old idea"}
    assert lab.arm_request(base, "current", passage) == base
    empty = lab.arm_request(base, "reader_empty", passage)
    history = lab.arm_request(base, "reader_history", passage)
    assert base == original
    assert empty["messages"][0] == history["messages"][0]
    assert history["messages"][1]["content"].startswith(base["messages"][1]["content"])
    assert "An old idea" not in empty["messages"][1]["content"]
    assert "An old idea" in history["messages"][1]["content"]
    for request in (empty, history):
        assert {k: v for k, v in request.items() if k != "messages"} == {
            k: v for k, v in base.items() if k != "messages"}
        assert "tools" not in request
    with pytest.raises(ValueError):
        lab.arm_request(base, "wrong", passage)


def test_shuffled_repetitions_cover_each_condition_once():
    result = lab.trial_order(["a", "b"], 3, 790)
    assert result == lab.trial_order(["a", "b"], 3, 790)
    assert len(result) == 18
    assert len({(r["case"], r["arm"], r["repeat"]) for r in result}) == 18


@pytest.mark.parametrize("output", ["1", "", "uncertain"])
def test_active_or_unknown_session_blocks(output):
    with patch.object(lab.subprocess, "run", return_value=Mock(stdout=output)):
        with pytest.raises(RuntimeError, match="Eric connected"):
            lab.require_disconnected()


def test_disconnected_guard():
    with patch.object(lab.subprocess, "run", return_value=Mock(stdout="0\n")):
        lab.require_disconnected()


def test_capture_current_production_request_without_network():
    request = lab.compile_request({"conversation": "A sufficiently long fixture conversation.",
                                   "mode": "person", "person_focus": 4}, "fixture")
    assert request["model"] == "fixture"
    assert request["temperature"] == 0.55
    assert request["max_tokens"] == 420
    assert request["response_format"]["type"] == "json_schema"
    assert "tools" not in request
    assert "Historical reading opportunity" not in request["messages"][0]["content"]


def test_current_evidence_preserves_latest_instruction():
    rows = [{"text": "[1:00:00 PM] You: Keep this entire instruction. " + "detail " * 100,
             "at": "2026-09-30T13:00:00-04:00", "prosody": ""},
            {"text": "[1:00:10 PM] Robot 790: An answer.",
             "at": "2026-09-30T13:00:10-04:00", "prosody": ""}]
    evidence = lab.evidence_for(rows, lab.clock("2026-09-30", "1:00:20 PM"))
    assert evidence["latest_user_utterance"]["text"] == rows[0]["text"]
    assert evidence["conversation_window"]["format"] == "whole-turns-v1"


def historical_fixture(tmp_path, monkeypatch):
    source = ("Header\n[1:00:00 PM] You: An old question.\n"
              "[1:00:01 PM] Robot 790: An earlier possibility.\n"
              "[1:05:00 PM] You: New direction.\n"
              "[1:05:01 PM] Robot 790: A recent answer.\n"
              "[1:10:00 PM] You: Future material must not leak.\n")
    (tmp_path / "old.txt").write_text(source, encoding="utf-8")
    monkeypatch.setattr(lab, "ROOT", tmp_path)
    evidence = {"conversation_window": {"first_id": "999:0:2"},
                "latest_user_utterance": {"text": "[1:05:00 PM] You: New direction."}}
    monkeypatch.setattr(lab, "evidence_for", Mock(return_value=evidence))
    return {"id": "fixture", "source": "old.txt", "date": "2026-09-30",
            "cutoff": "1:05:01 PM", "passage": ["1:00:00 PM", "1:00:01 PM"]}


def test_preparation_proves_source_and_excludes_future(tmp_path, monkeypatch):
    case = lab.prepare_case(historical_fixture(tmp_path, monkeypatch))
    passage = case["passage"]
    assert passage["line_start"] == 2
    assert passage["line_end"] == 3
    assert passage["source_sha256"] == lab.digest((tmp_path / "old.txt").read_bytes())
    assert "An earlier possibility" in passage["text"]
    assert "Future material" not in case["payload"]["conversation"]
    passed_rows = lab.evidence_for.call_args.args[0]
    assert len(passed_rows) == 4


def test_overlapping_passage_is_rejected(tmp_path, monkeypatch):
    spec = historical_fixture(tmp_path, monkeypatch)
    spec["passage"][1] = "1:05:01 PM"
    with pytest.raises(ValueError, match="strictly older"):
        lab.prepare_case(spec)


def test_empty_passage_is_rejected(tmp_path, monkeypatch):
    spec = historical_fixture(tmp_path, monkeypatch)
    spec["passage"] = ["1:02:00 PM", "1:02:01 PM"]
    with pytest.raises(ValueError, match="nonempty"):
        lab.prepare_case(spec)


def test_even_dry_preparation_cannot_overwrite_completed_inputs(tmp_path, monkeypatch):
    import sys

    plan = tmp_path / "plan.json"
    plan.write_text("{}", encoding="utf-8")
    (tmp_path / "results.json").write_text("[]", encoding="utf-8")
    (tmp_path / "prepared.json").write_text("original", encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["b2_history_lab.py", str(plan)])
    with pytest.raises(RuntimeError, match="never overwrite trial inputs"):
        lab.main()
    assert (tmp_path / "prepared.json").read_text(encoding="utf-8") == "original"

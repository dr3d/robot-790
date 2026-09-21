import copy
import hashlib

import pytest

from robot_790d.context_wire_lab import (
    apply_excerpts,
    completion_request,
    grade_recall,
    historical_blocks,
    image_variant,
    measurement_request,
    quotes_supported,
    render_excerpts,
)


def sample_wire():
    return {
        "model": "local-test",
        "request_options": {"temperature": 0.8, "tools": [{"type": "function"}], "tool_choice": "auto"},
        "extra_body": {"reasoning_effort": "none"},
        "messages": [{"role": "system", "content": (
            "Persona unchanged.\n[sessions/session-one.txt]\nRestore envelope unchanged.\n"
            "Transcript Since Clean Connect\n----\n"
            "[6:01:00 AM] You: Draw a memory.\n"
            "[6:01:01 AM] Robot 790: This is a metaphor, not evidence.\n"
            "[6:01:02 AM] System: Image staged as eye-1.\n"
            "[6:01:03 AM] Robot 790: One thought.\n"
            "[6:01:04 AM] Robot 790: Repeated thought.\n"
            "[6:01:05 AM] Robot 790: Repeated again.\n"
            "[Loaded-note context clipped. Read the note again if exact detail is needed.]\n\n"
            "[core/profile.txt]\nScott.\nCurrent Robot 790 embodiment:\nBrowser face."
        )}, {"role": "user", "content": "Current unfinished question."}],
    }


def test_excerpts_preserve_envelope_instructions_and_current_conversation():
    wire = sample_wire()
    original = copy.deepcopy(wire)
    system = wire["messages"][0]["content"]
    block, = historical_blocks(system)
    text, receipt = render_excerpts(system[block["start"]:block["end"]], {1})
    candidate = apply_excerpts(wire, [{"name": block["name"], **receipt}])
    assert wire == original
    assert candidate["messages"][1:] == wire["messages"][1:]
    assert candidate["request_options"] == wire["request_options"]
    assert candidate["messages"][0]["content"] == system[:block["start"]] + text + system[block["end"]:]
    assert "System: Image staged as eye-1." in text
    assert "metaphor, not evidence" in text
    assert "Loaded-note context clipped" in text
    assert "Repeated thought" not in text
    receipt["source_sha256"] = "wrong"
    with pytest.raises(ValueError, match="source changed"):
        apply_excerpts(wire, [{"name": block["name"], **receipt}])


@pytest.mark.parametrize("system", ["No notes", "[sessions/test.txt]\nUnknown handoff"])
def test_unsupported_envelopes_fail_closed(system):
    with pytest.raises(ValueError):
        historical_blocks(system)


def image_fixture(tmp_path):
    raw = b"verified-test-bytes"
    (tmp_path / "test.jpg").write_bytes(raw)
    manifest = {"images": [{"name": "test.jpg", "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}]}
    parts = [{"type": "text", "text": '[STS sensing image]\n{"id":"eye-1","name":"test.png"}'
              '\n[End STS sensing image]'},
             {"type": "image_url", "image_url": {"detail": "auto", "url": {"omitted_data_url_characters": 51}}}]
    return manifest, {"messages": [{"role": "user", "content": copy.deepcopy(parts)} for _ in range(3)]}


def test_historical_pixels_become_references_current_pixels_remain(tmp_path):
    manifest, wire = image_fixture(tmp_path)
    original = copy.deepcopy(wire)
    candidate, references = image_variant(wire, manifest, tmp_path, keep=1)
    assert wire == original
    assert len(references) == 2
    assert candidate["messages"][0]["content"][1]["type"] == "text"
    assert "logs/sensing-eye/test.jpg" in candidate["messages"][0]["content"][1]["text"]
    assert candidate["messages"][-1]["content"][1]["image_url"]["url"].startswith("data:image/jpeg;base64,")
    assert candidate["messages"][0]["content"][0] == wire["messages"][0]["content"][0]
    restored, refs = image_variant(wire, manifest, tmp_path, keep=None)
    assert not refs
    assert all(m["content"][1]["type"] == "image_url" for m in restored["messages"])
    with pytest.raises(ValueError, match="current image"):
        image_variant(wire, manifest, tmp_path, keep=0)
    (tmp_path / "test.jpg").write_bytes(b"changed")
    with pytest.raises(ValueError, match="hash/size"):
        image_variant(wire, manifest, tmp_path, keep=1)


def test_replay_keeps_schemas_but_never_executes_tools():
    wire = sample_wire()
    request = completion_request(wire, question="Private diagnostic.")
    assert request["tools"] == wire["request_options"]["tools"]
    assert request["tool_choice"] == "none"
    assert request["messages"][:-1] == wire["messages"]
    assert request["max_tokens"] == 1
    assert wire["request_options"]["tool_choice"] == "auto"
    measure = measurement_request(wire)
    assert measure["tool_choice"] == wire["request_options"]["tool_choice"]
    assert measure["tools"] == wire["request_options"]["tools"]
    assert measure["max_tokens"] == 1


def test_recalled_source_substitution_requires_explicit_opt_in(tmp_path):
    manifest, wire = image_fixture(tmp_path)
    for message in wire["messages"]:
        message["content"][0]["text"] = message["content"][0]["text"].replace(
            '"name":"test.png"', '"name":"test.png","source":"sensing-eye filesystem"'
        )
        message["content"][1]["image_url"]["url"]["omitted_data_url_characters"] = 50
    with pytest.raises(ValueError, match="payload length"):
        image_variant(wire, manifest, tmp_path, keep=None)
    _, receipts = image_variant(wire, manifest, tmp_path, keep=None, allow_recalled_source=True)
    assert len(receipts) == 3
    assert all(r["kind"] == "recalled_image_source_substitution" for r in receipts)


def test_final_session_does_not_consume_embodiment():
    system = "[sessions/test.txt]\nTranscript\n---\n[6:00:00 AM] You: Hi.\nCurrent Robot 790 embodiment:\nFace."
    block, = historical_blocks(system)
    assert system[block["end"]:].startswith("\nCurrent Robot 790 embodiment:")


def test_recall_requires_quotes_present_in_actual_candidate():
    wire = sample_wire()
    assert quotes_supported(wire, ["This is a metaphor, not evidence."])
    assert not quotes_supported(wire, ["That experiment was proven."])
    assert not quotes_supported(wire, [])
    assert not quotes_supported(wire, [" "])


def test_recall_grades_answer_and_quote_accuracy_separately():
    checks = {"probes": [{"key": key, "expected": "yes"} for key in ("right", "inexact", "wrong", "missing")]}
    results = grade_recall({
        "right": {"answer": "yes", "quotes_found_in_context": True},
        "inexact": {"answer": "yes", "quotes_found_in_context": False},
        "wrong": {"answer": "no", "quotes_found_in_context": True},
    }, checks)
    assert results["answers_passed"] == 2
    assert results["quotes_passed"] == 2
    assert results["passed"] == 1
    assert results["total"] == 4
    assert results["answer_score"]["inexact"] is True
    assert results["score"]["inexact"] is False
    assert results["score"]["wrong"] is False
    assert results["score"]["missing"] is False


def test_bundled_recall_does_not_claim_quote_validation():
    result = grade_recall({"fact": "correct"}, {"expected": {"fact": "correct"}})
    assert result["passed"] == result["answers_passed"] == 1
    assert result["quote_score"] is None
    assert result["quotes_passed"] is None


def test_protected_question_keeps_reply_start_across_system_receipt_and_marks_gaps():
    transcript = (
        "[6:00:00 AM] Robot 790: Older remark.\n"
        "[6:00:01 AM] You: What happened?\n"
        "[6:00:02 AM] System: Tool succeeded.\n"
        "[6:00:03 AM] Robot 790: The picture arrived.\n"
        "[6:00:04 AM] Robot 790: An optional aside.\n"
        "[6:00:05 AM] You: Merci.\n"
        "[6:00:06 AM] Robot 790: Avec plaisir.\n"
        "[6:00:07 AM] Robot 790: Another optional aside.\n"
    )
    text, receipt = render_excerpts(transcript, set())
    assert "Robot 790: The picture arrived." in text
    assert "Robot 790: Avec plaisir." in text
    assert "optional aside" not in text
    assert receipt["protected_reply_starts"] == [3, 6]
    assert receipt["omitted_ranges"] == [[0, 0], [4, 4], [7, 7]]
    assert text.count("[Historical gap:") == 3
    assert text.index("The picture arrived.") < text.index("source entries 4-4") < text.index("You: Merci.")

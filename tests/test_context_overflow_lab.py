import copy
import json

import pytest

from robot_790d.context_overflow_lab import (
    checkpoint,
    excerpt_memories,
    excerpt_request,
    finalize,
    parse_excerpt_selection,
    partition,
    prepare,
    receipt_index,
    sha256,
    validate_candidate,
)


def fixture_turns():
    return [
        "[6:37:05 AM] You: Draw forgetting.",
        "[6:37:21 AM] System: [sensing-eye visual note opened into B1 context: id eye-2 file image.jpg]",
        "[6:37:23 AM] Robot 790: There it is.",
        "[6:40:00 AM] Robot 790: We could test memory with a made-up word.",
        "[8:29:55 AM] Robot 790: That is only an idea, not a measurement.",
    ]


def tool_rows():
    return [
        {
            "time": "6:37:21 AM",
            "name": "move_generated_image_to_sensing_eye",
            "result": {"status": "ok", "staged": True, "saved_filename": "image.jpg", "reason": "arbitrary prose"},
        },
        {"time": "9:00:00 AM", "name": "write_text_file", "result": {"status": "error", "error": "not written"}},
    ]


def test_threshold_before_overflow_and_explicit_miss():
    usage = [{"input_tokens": n} for n in [30, 79, 81, 96, 51]]
    assert checkpoint(usage, 100, 0.8) == usage[2]
    assert checkpoint(usage, 1000, 0.8) is None
    with pytest.raises(ValueError):
        checkpoint(usage, 0, 0.8)


def test_preserve_completion_and_recent_history_without_interpreting_words():
    turns = fixture_turns()
    split = partition(turns, 2)
    assert [item["source_turn_id"] for item in split["protected"]] == [0, 1]
    assert [item["text"] for item in split["recent"]] == turns[-2:]
    rows = receipt_index(tool_rows(), 8 * 3600)
    assert len(rows) == 1
    assert rows[0]["outcome"] == {"status": "ok", "saved_filename": "image.jpg", "staged": True}
    candidate = {
        **split,
        "tool_receipts": rows,
        "memories": [{"text": "Eric described the completed drawing.", "source_turn_ids": [1, 2]}],
    }
    validate_candidate(candidate, turns, rows, 2)
    for key in ("protected", "recent", "tool_receipts", "memories"):
        damaged = copy.deepcopy(candidate)
        damaged[key] = []
        with pytest.raises(ValueError):
            validate_candidate(damaged, turns, rows, 2)
    candidate["memories"][0]["source_turn_ids"] = [4]
    with pytest.raises(ValueError, match="outside"):
        validate_candidate(candidate, turns, rows, 2)


def prepare_fixture(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    bundle = tmp_path / "bundle"
    bundle.mkdir()
    source = "Transcript\n----------\n" + "\n".join(fixture_turns())
    (bundle / "session-note.txt").write_text(source, encoding="utf-8")
    (bundle / "analysis.json").write_text(
        json.dumps(
            {
                "usage": [{"time": "08:29:55,100", "input_tokens": 85}],
                "tools": tool_rows(),
            }
        ),
        encoding="utf-8",
    )
    output = tmp_path / "logs" / "trial"
    manifest = prepare(bundle, output, at="threshold", limit=100, fraction=0.8, recent=2, b2_at=("8:29:55 AM",))
    (output / "summary").mkdir()
    (output / "summary" / "result.json").write_text(
        json.dumps(
            {
                "source_sha256": sha256(output / "prefix.txt"),
                "sections": [[{"text": "Eric displayed the drawing.", "source_turn_ids": [1, 2]}]],
            }
        ),
        encoding="utf-8",
    )
    return bundle, output, manifest


def test_artifact_rehearsal_preserves_original_and_rejects_corruption(tmp_path, monkeypatch):
    bundle, output, manifest = prepare_fixture(tmp_path, monkeypatch)
    checks = finalize(output)
    assert checks["structural_checks"] == "pass"
    assert checks["token_savings"] is None
    assert not checks["live_installation"]
    assert sha256(bundle / "session-note.txt") == manifest["source_sha256"]
    assert "eye-2" in (output / "candidate.txt").read_text(encoding="utf-8")
    assert not (tmp_path / "notes").exists()
    (output / "tool-receipts.json").write_text("[]", encoding="utf-8")
    with pytest.raises(ValueError, match="evidence changed"):
        finalize(output)


def test_reject_changed_source_and_production_output(tmp_path, monkeypatch):
    bundle, output, _ = prepare_fixture(tmp_path, monkeypatch)
    with pytest.raises(ValueError, match="new output"):
        prepare(bundle, output, at="end", limit=100, fraction=0.8, recent=2)
    with pytest.raises(ValueError, match="under logs"):
        prepare(bundle, tmp_path / "notes", at="end", limit=100, fraction=0.8, recent=2)
    source = bundle / "session-note.txt"
    source.write_text(source.read_text(encoding="utf-8") + "changed", encoding="utf-8")
    with pytest.raises(ValueError, match="Original source changed"):
        finalize(output)


def test_no_silent_cross_midnight_or_fabricated_threshold(tmp_path, monkeypatch):
    bundle, _, _ = prepare_fixture(tmp_path, monkeypatch)
    with pytest.raises(ValueError, match="No recorded"):
        prepare(bundle, tmp_path / "logs" / "none", at="threshold", limit=1000, fraction=0.8, recent=2)
    (bundle / "session-note.txt").write_text(
        "Transcript\n----------\n[11:59:00 PM] You: before\n[12:01:00 AM] Robot 790: after", encoding="utf-8"
    )
    with pytest.raises(ValueError, match="midnight"):
        prepare(bundle, tmp_path / "logs" / "midnight", at="end", limit=100, fraction=0.8, recent=1)


def test_b2_server_can_outlive_its_completion_receipt():
    from robot_790d.sts_page_server import _brain2_evidence_context

    request = {"role": "user", "text": "Draw forgetting."}
    original = {
        "tool": "move_generated_image_to_sensing_eye",
        "status": "ok",
        "artifact": "original-forgetting.png",
        "staged": True,
    }
    later = [{"tool": "generate_image", "status": "ok", "artifact": f"later-{i}.png"} for i in range(4)]
    data = json.loads(
        _brain2_evidence_context(
            {
                "latest_user_utterance": request,
                "conversation": [{"role": "assistant", "text": f"Later thought {i}"} for i in range(18)],
                "runtime": {"image_task_receipts": {"receipts": [original] + later}},
            }
        )
    )
    assert data["latest_user_utterance"]["text"] == request["text"]
    assert len(data["conversation"]) == 18
    assert len(data["image_task_receipts"]["receipts"]) == 4
    assert "original-forgetting.png" not in json.dumps(data)


def test_extractive_choice_is_bounded_and_never_paraphrases():
    turns = fixture_turns()
    request = excerpt_request({"owned_turn_ids": [2, 3], "source_turns": []})
    schema = request["response_format"]["json_schema"]["schema"]
    assert schema["properties"]["selected_turn_ids"]["items"]["enum"] == [2, 3]

    def response(ids, finish="stop"):
        return {"choices": [{"finish_reason": finish, "message": {"content": json.dumps({"selected_turn_ids": ids})}}]}

    assert parse_excerpt_selection(response([3]), {2, 3}) == [3]
    for ids in ([4], [True], [2, 2], list(range(7)), "2"):
        with pytest.raises(ValueError):
            parse_excerpt_selection(response(ids), {2, 3})
    with pytest.raises(ValueError, match="Incomplete"):
        parse_excerpt_selection(response([2], "length"), {2, 3})
    memories = excerpt_memories(turns, {2})
    assert [item["text"] for item in memories] == turns[2:4]
    candidate = {
        **partition(turns, 1),
        "tool_receipts": [],
        "memories": memories,
        "method": "verbatim-excerpts-with-adjacent-context",
    }
    validate_candidate(candidate, turns, [], 1)
    candidate["memories"][0]["text"] = "Scott did this instead."
    with pytest.raises(ValueError, match="exact original"):
        validate_candidate(candidate, turns, [], 1)


def test_excerpts_and_protected_entries_render_in_source_order(tmp_path, monkeypatch):
    _, output, _ = prepare_fixture(tmp_path, monkeypatch)
    result = {
        "source_sha256": sha256(output / "prefix.txt"),
        "method": "verbatim-excerpts-with-adjacent-context",
        "sections": [[{"text": fixture_turns()[2], "source_turn_ids": [2]}]],
    }
    (output / "summary" / "result.json").write_text(json.dumps(result), encoding="utf-8")
    finalize(output)
    text = (output / "candidate.txt").read_text(encoding="utf-8")
    assert text.index(fixture_turns()[0]) < text.index(fixture_turns()[1]) < text.index(fixture_turns()[2])
    assert text.index(fixture_turns()[2]) < text.index(fixture_turns()[3]) < text.index(fixture_turns()[4])

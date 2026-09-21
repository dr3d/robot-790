import copy

import pytest

from robot_790d.context_compaction import (
    fold_runtime_snapshots,
    parse_runtime,
    render_runtime,
    require_closed_tools,
)


def snapshot(**sections):
    return {"role": "assistant", "content": render_runtime(sections)}


def test_fold_only_superseded_state_preserves_evidence_and_clear_values():
    messages = [
        {"role": "system", "content": "Original personality."},
        snapshot(runtime="Eye had an image.", sensing_text="A dropped poem.", search_receipts="A dated source."),
        {"role": "user", "content": "Ahora estamos hablando."},
        snapshot(alone_ledger="Old state.", idle_art='{"status":"failed","job_id":"old"}'),
        {"role": "assistant", "tool_calls": [{"id": "a", "function": {"name": "draw"}}]},
        {"role": "tool", "tool_call_id": "a", "content": '{"status":"ok"}'},
        snapshot(runtime="Eye is empty.", alone_ledger="New state."),
        {"role": "user", "content": [{"type": "image_url", "image_url": {"url": "kept"}}]},
    ]
    wire = {"messages": messages, "request_options": {"tools": ["unchanged"]}}
    original = copy.deepcopy(wire)
    candidate, receipt = fold_runtime_snapshots(wire)
    assert wire == original
    assert receipt["removed_sections"] == [
        {"source_message": 1, "sections": ["runtime"], "superseded_by": {"runtime": 6}},
        {"source_message": 3, "sections": ["alone_ledger"], "superseded_by": {"alone_ledger": 6}},
    ]
    assert parse_runtime(candidate["messages"][1]) == {
        "sensing_text": "A dropped poem.", "search_receipts": "A dated source."}
    assert parse_runtime(candidate["messages"][3]) == {"idle_art": '{"status":"failed","job_id":"old"}'}
    assert candidate["messages"][4:] == wire["messages"][4:]
    assert candidate["messages"][2] == wire["messages"][2]
    assert candidate["request_options"] == wire["request_options"]
    assert fold_runtime_snapshots(candidate)[0] == candidate


def test_user_text_and_opaque_envelopes_are_not_interpreted():
    user = {"role": "user", "content": render_runtime({"runtime": "quoted"})}
    unknown = snapshot(session_arrival="Important transition.")
    malformed = snapshot(runtime="old")
    malformed["content"] = malformed["content"].replace("\n\n[End", "\n\nruntime:\nsecond\n\n[End")
    old = snapshot(runtime="old")
    new = snapshot(runtime="new")
    wire = {"messages": [user, unknown, malformed, old, new]}
    result, _ = fold_runtime_snapshots(wire)
    assert result["messages"] == [user, unknown, malformed, new]


def test_tools_must_be_complete_before_compaction():
    with pytest.raises(ValueError, match="Unfinished"):
        fold_runtime_snapshots({"messages": [{"role": "assistant", "tool_calls": [{"id": "a"}]}]})
    with pytest.raises(ValueError, match="Unpaired"):
        require_closed_tools([{"role": "tool", "tool_call_id": "a"}])
    with pytest.raises(ValueError, match="identity"):
        require_closed_tools([{"role": "assistant", "tool_calls": [{"id": "a"}, {"id": "a"}]}])
    require_closed_tools([{"role": "assistant", "tool_calls": [{"id": "a"}, {"id": "b"}]},
                          {"role": "tool", "tool_call_id": "b"}, {"role": "tool", "tool_call_id": "a"}])


def test_empty_state_is_a_replacement_not_an_omission():
    wire = {"messages": [snapshot(runtime="old"), snapshot(runtime="")]}
    result, _ = fold_runtime_snapshots(wire)
    assert result["messages"] == [wire["messages"][-1]]

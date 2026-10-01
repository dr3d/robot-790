import copy
import json

import pytest

from robot_790d import brain2_history, sts_page_server


def packet():
    return {"id": "page-1", "filename": "sessions/old.txt", "saved_at": "2026-09-28", "form": "loaded excerpts",
            "passages": [{"id": "old-1", "speaker": "assistant", "at": "8:00 AM", "first_line": 4,
                          "last_line": 5, "text": "[8:00 AM] Robot 790: My earlier idea.\nMore context."}]}


def test_history_preserves_source_without_silently_clipping():
    value = packet()
    value["passages"][0]["text"] *= 150
    assert brain2_history.prepare(value) == value
    source = brain2_history.source_for(value, {"history_source_id": "old-1", "note_for_eric": "Consider it."})
    assert source["speaker"] == "assistant"
    assert source["filename"] == "sessions/old.txt"
    assert "text" not in source, 'do not copy full historical passage into B1'


@pytest.mark.parametrize("change", ["speaker", "empty", "range", "duplicate", "identity"])
def test_history_rejects_bad_source_packets(change):
    value = packet()
    if change == "speaker":
        value["passages"][0]["speaker"] = "system"
    if change == "empty":
        value["passages"] = []
    if change == "range":
        value["passages"][0]["first_line"] = True
    if change == "duplicate":
        value["passages"].append(copy.deepcopy(value["passages"][0]))
    if change == "identity":
        value["filename"] = None
    with pytest.raises(ValueError):
        brain2_history.prepare(value)


def test_advice_requires_real_source_and_abstention_is_allowed():
    assert brain2_history.source_for(packet(), {"history_source_id": "", "note_for_eric": ""}) is None
    with pytest.raises(ValueError, match="cite"):
        brain2_history.source_for(packet(), {"history_source_id": "invented", "note_for_eric": "A suggestion"})


def test_production_history_pass_has_no_art_body_mouth_or_loop_actions(monkeypatch):
    import httpx

    requests = []
    monkeypatch.setattr(sts_page_server, "local_runtime_model", lambda _: "fixture")
    monkeypatch.setattr(sts_page_server, "begin_request", lambda *a, **k: None)
    monkeypatch.setattr(sts_page_server, "finish_request", lambda *a, **k: None)

    def post(self, url, **kwargs):
        requests.append(kwargs["json"])
        result = {"note_for_eric": "Earlier, Eric suggested an idea worth checking.", "history_source_id": "old-1",
                  "mouth_text": "Should never surface", "should_surface": True, "question": "Old command?",
                  "revision_candidate": "Another action", "steering": {"loop": True}, "body_beat": "thoughtful",
                  "art_prompt": "Never generate", "reason": "An older possibility."}
        return httpx.Response(200, request=httpx.Request("POST", url),
                              json={"choices": [{"message": {"content": json.dumps(result)}}]})

    monkeypatch.setattr(httpx.Client, "post", post)
    result = sts_page_server.mull_second_brain({"mode": "history", "history": packet(), "note_guidance": [],
                                               "body": {"key": "reachy_mini"}, "conversation": ""})
    assert result["status"] == "ok"
    assert result["history_source"]["speaker"] == "assistant"
    assert not result["mouth_text"] and not result["question"] and not result["revision_candidate"]
    assert result["should_surface"] is False
    assert not any(key in result for key in ("steering", "body_beat", "art_proposal"))
    request, = requests
    assert request["messages"][-1]["content"].endswith(brain2_history.INSTRUCTION)
    assert "history_source_id" in request["response_format"]["json_schema"]["schema"]["required"]
    assert request["response_format"]["json_schema"]["schema"]["properties"]["history_source_id"] == {
        "type": "string", "enum": ["old-1"]
    }
    assert "tools" not in request

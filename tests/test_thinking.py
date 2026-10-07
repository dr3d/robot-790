import json

import pytest

from robot_790d import thinking, sts_page_server


def catalog(options=("off", "on"), default="on", loaded=True):
    return {"models": [{"key": "disk-key", "display_name": "Installed model", "loaded_instances":
                        [{"id": "running-alias"}] if loaded else [],
                        "capabilities": {"reasoning": {"allowed_options": list(options), "default": default}}}]}


def test_binary_loaded_alias_has_binary_manual_and_correct_wire_values():
    profile = thinking.profile_from_catalog(catalog(), "running-alias")
    assert profile["model_key"] == "disk-key"
    assert "no depth levels" in profile["manual"]
    assert "Only the operator changes Thinking settings" in profile["manual"]
    assert thinking.request_options(profile, "on") == {"reasoning_effort": "low"}
    assert thinking.request_options(profile, "off") == {"reasoning_effort": "none"}
    with pytest.raises(ValueError, match="does not support"):
        thinking.request_options(profile, "medium")


def test_graded_model_uses_its_advertised_default_and_never_binary_alias_guess():
    profile = thinking.profile_from_catalog(catalog(("off", "low", "medium", "high"), "high"), "running-alias")
    assert thinking.request_options(profile, "on") == {"reasoning_effort": "high"}
    assert "On uses this model's high" in profile["manual"]
    assert "no depth levels" not in profile["manual"]


@pytest.mark.parametrize("data,model,mode", [
    (catalog(loaded=False), "disk-key", "on"),
    (catalog(), "other-installed-key", "on"),
    (catalog((), None), "running-alias", "on"),
    (catalog(("on",), "on"), "running-alias", "off"),
    (catalog(("off",), "off"), "running-alias", "on"),
])
def test_unloaded_unmatched_and_unsupported_switches_are_rejected(data, model, mode):
    with pytest.raises(ValueError):
        thinking.request_options(thinking.profile_from_catalog(data, model), mode)


@pytest.fixture
def brain2_provider(monkeypatch):
    provider = {
        "profile": thinking.profile_from_catalog(catalog(), "running-alias"),
        "result": {"mouth_text": "", "note_for_eric": "Compare the two designs.", "should_surface": False},
    }
    monkeypatch.setattr(thinking, "model_profile", lambda *_args, **_kwargs: provider["profile"])
    monkeypatch.setattr(sts_page_server, "_brain2_model_config", lambda: ("http://localhost:1234/v1", "running-alias", {}))
    monkeypatch.setattr(sts_page_server, "begin_request", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(sts_page_server, "finish_request", lambda *_args, **_kwargs: None)
    requests = []

    class Client:
        def __init__(self, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def post(self, url, *, headers, json):
            requests.append(json)
            return self
        def raise_for_status(self): pass
        def json(self):
            return {"choices": [{"message": {"content": json.dumps(provider["result"])}}]}

    monkeypatch.setattr(sts_page_server.httpx, "Client", Client)
    return provider, requests


@pytest.mark.parametrize("mode,expected,graded", [("none", "none", False), ("on", "low", False),
    ("none", "none", True), ("low", "low", True), ("medium", "medium", True),
    ("xhigh", "xhigh", True), ("on", "xhigh", True)])
def test_brain2_request_preserves_operator_setting_and_ignores_model_change_intent(brain2_provider, mode, expected, graded):
    provider, requests = brain2_provider
    data = catalog(("off", "low", "medium", "xhigh", "on"), "xhigh") if graded else catalog()
    profile = thinking.profile_from_catalog(data, "running-alias")
    provider["profile"] = profile
    provider["result"]["thinking_changes"] = {"eric": "off", "brain2": "on"}
    result = sts_page_server.mull_second_brain({"conversation": "Operator: Compare these two ideas.",
        "thinking": {"brain2": {"mode": mode, "model": "running-alias"}, "eric": {"mode": "on", "profile": profile}}})
    assert result["status"] == "ok"
    assert requests[0]["reasoning_effort"] == expected
    assert "chat_template_kwargs" not in requests[0]
    assert result["thinking"]["mode"] == mode
    assert "thinking_changes" not in result
    assert ("no depth levels" in requests[0]["messages"][0]["content"]) is not graded
    assert "Thinking settings are controlled only by the operator" in requests[0]["messages"][0]["content"]
    assert "thinking_changes" not in requests[0]["messages"][0]["content"]
    assert requests[0]["max_tokens"] == (4096 if mode != "none" else 420)
    assert len(requests) == 1


@pytest.mark.parametrize("value", [None, True, ["on"], {"eric": True}, {"brain2": "unlimited"},
                                   {"unknown": "on"}, {"eric": "on", "brain2": "on"},
                                   {"eric": "off", "brain2": "off"}])
@pytest.mark.parametrize("pass_mode", ["person", "headlines", "history"])
def test_legacy_thinking_changes_never_control_settings_or_reject_valid_advice(brain2_provider, value, pass_mode):
    provider, requests = brain2_provider
    provider["result"]["thinking_changes"] = value
    payload = {"mode": pass_mode, "conversation": "Operator: Compare these two ideas.",
               "thinking": {"brain2": {"mode": "off", "model": "running-alias"}, "eric": {"mode": "on"}}}
    if pass_mode == "headlines":
        payload["headlines"] = [{"url": "https://example.test/story", "title": "A design comparison",
                                 "published_at": "2026-10-06"}]
        provider["result"]["headline_url"] = "https://example.test/story"
    elif pass_mode == "history":
        payload["history"] = {"id": "page-1", "filename": "sessions/old.txt", "saved_at": "2026-10-05",
                              "form": "loaded excerpts", "passages": [{"id": "old-1", "speaker": "assistant",
                              "at": "8:00 AM", "first_line": 1, "last_line": 1, "text": "Compare the two designs."}]}
        provider["result"]["history_source_id"] = "old-1"
    original_settings = json.loads(json.dumps(payload["thinking"]))

    result = sts_page_server.mull_second_brain(payload)

    assert result["status"] == "ok"
    assert result["note_for_eric"] == "Compare the two designs."
    assert "thinking_changes" not in result
    assert result["thinking"]["mode"] == "off"
    assert payload["thinking"] == original_settings
    assert requests[0]["reasoning_effort"] == "none"
    assert "thinking_changes" not in requests[0]["response_format"]["json_schema"]["schema"]["properties"]
    assert len(requests) == 1


@pytest.mark.parametrize("headlines,body_beats,idle_art", [
    (None, [], False), (None, ["inspect"], False), (None, [], True),
    ([{"url": "https://example.test/story"}], [], False),
])
def test_brain2_schema_has_no_thinking_change_authority(headlines, body_beats, idle_art):
    schema = sts_page_server._brain2_response_format(headlines, body_beats, idle_art)["json_schema"]["schema"]
    assert "thinking_changes" not in schema["properties"]
    assert "thinking_changes" not in schema["required"]
    assert schema["additionalProperties"] is False


def test_operator_choices_still_offer_each_loaded_models_exact_settings():
    binary = thinking.profile_from_catalog(catalog(), "running-alias")
    graded = thinking.profile_from_catalog(catalog(("off", "low", "medium", "xhigh", "on"), "xhigh"), "running-alias")
    assert thinking.control_modes(graded) == ["off", "low", "medium", "xhigh", "on"]
    assert thinking.control_modes(binary) == ["off", "on"]
    with pytest.raises(ValueError, match="does not support"):
        thinking.request_options(binary, "xhigh")
    with pytest.raises(ValueError, match="does not support"):
        thinking.request_options(graded, "high")

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


@pytest.mark.parametrize("value", [True, ["on"], {"eric": True}, {"brain2": "unlimited"}, {"unknown": "on"}])
def test_invalid_brain2_control_output_cannot_change_any_setting(value):
    with pytest.raises(ValueError):
        thinking.changes_from_result(value)


def test_keep_means_no_change():
    assert thinking.changes_from_result({"eric": "keep", "brain2": "on"}) == {"brain2": "on"}


@pytest.mark.parametrize("mode,expected,graded", [("none", "none", False), ("on", "low", False),
    ("none", "none", True), ("low", "low", True), ("medium", "medium", True),
    ("xhigh", "xhigh", True), ("on", "xhigh", True)])
def test_brain2_request_uses_own_setting_and_returns_change_intent(monkeypatch, mode, expected, graded):
    data = catalog(("off", "low", "medium", "xhigh", "on"), "xhigh") if graded else catalog()
    profile = thinking.profile_from_catalog(data, "running-alias")
    monkeypatch.setattr(thinking, "model_profile", lambda *_args, **_kwargs: profile)
    monkeypatch.setattr(sts_page_server, "_brain2_model_config", lambda: ("http://localhost:1234/v1", "running-alias", {}))
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
            return {"choices": [{"message": {"content": json.dumps({"mouth_text": "", "should_surface": False,
                    "thinking_changes": {"eric": "on", "brain2": "off"}})}}]}

    monkeypatch.setattr(sts_page_server.httpx, "Client", Client)
    result = sts_page_server.mull_second_brain({"conversation": "Operator: Compare these two ideas.",
        "thinking": {"brain2": {"mode": mode, "model": "running-alias"}, "eric": {"mode": "on", "profile": profile}}})
    assert result["status"] == "ok"
    assert requests[0]["reasoning_effort"] == expected
    assert "chat_template_kwargs" not in requests[0]
    assert result["thinking"]["mode"] == mode
    assert result["thinking_changes"] == {"eric": "on", "brain2": "off"}
    assert ("no depth levels" in requests[0]["messages"][0]["content"]) is not graded
    assert "next scheduled mull" in requests[0]["messages"][0]["content"]
    assert requests[0]["max_tokens"] == (4096 if mode != "none" else 420)
    assert len(requests) == 1


def test_each_brain_schema_offers_its_loaded_models_exact_choices():
    binary = thinking.profile_from_catalog(catalog(), "running-alias")
    graded = thinking.profile_from_catalog(catalog(("off", "low", "medium", "xhigh", "on"), "xhigh"), "running-alias")
    schema = sts_page_server._brain2_response_format(None, [], thinking_profiles={"eric": graded, "brain2": binary})
    choices = schema["json_schema"]["schema"]["properties"]["thinking_changes"]["properties"]
    assert choices["eric"]["enum"] == ["keep", "off", "low", "medium", "xhigh", "on"]
    assert choices["brain2"]["enum"] == ["keep", "off", "on"]
    assert thinking.changes_from_result({"eric": "xhigh", "brain2": "off"}) == {"eric": "xhigh", "brain2": "off"}
    with pytest.raises(ValueError, match="does not support"):
        thinking.request_options(binary, "xhigh")
    with pytest.raises(ValueError, match="does not support"):
        thinking.request_options(graded, "high")

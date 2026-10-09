import pytest

from robot_790d.lmstudio_cached_load import build_endpoint, verify_config


@pytest.mark.parametrize("mtp", ["on", "off", "default"])
def test_cache_load_preserves_model_context_gpu_parallel_and_mtp(mtp):
    endpoint, expected = build_endpoint("installed/key", "api-name", 96000, 1, mtp, 4, 16384)
    params = endpoint.creation_params
    assert params["modelKey"] == "installed/key"
    assert params["identifier"] == "api-name"
    assert expected["llm.load.contextLength"] == 96000
    assert expected["llm.load.llama.acceleration.offloadRatio"] == "max"
    assert expected["llm.load.numParallelSessions"] == 1
    assert expected["llm.load.llama.contextCheckpoints"] == 4
    override = expected["llm.load.llama.argumentsOverride"]
    assert override == {
        "enabled": True, "excludeAllConfig": False, "disabledParameters": [],
        "overrideParameters": [{"key": "--cache-ram", "value": "16384"}],
    }
    key = "llm.load.speculativeDecoding.draftMtp"
    if mtp == "default":
        assert key not in expected
    else:
        assert expected[key] is (mtp == "on")
    assert not any("prompt" in key.lower() or "reasoning" in key.lower() for key in expected)


@pytest.mark.parametrize("missing", [
    "llm.load.contextLength", "llm.load.numParallelSessions",
    "llm.load.llama.acceleration.offloadRatio", "llm.load.llama.contextCheckpoints",
    "llm.load.llama.argumentsOverride", "llm.load.speculativeDecoding.draftMtp",
])
def test_ignored_or_changed_load_control_is_rejected(missing):
    _, expected = build_endpoint("model", "model", 96000, 1, "off", 4, 16384)
    raw = {"fields": [{"key": key, "value": value} for key, value in expected.items()]}
    verify_config(raw, expected)
    raw["fields"] = [field for field in raw["fields"] if field["key"] != missing]
    with pytest.raises(RuntimeError, match="did not confirm"):
        verify_config(raw, expected)
    raw["fields"].append({"key": missing, "value": "unexpected"})
    with pytest.raises(RuntimeError, match="did not confirm"):
        verify_config(raw, expected)


@pytest.mark.parametrize("cache_mib", [-1, 0, 1000000])
def test_unbounded_or_disabled_cache_is_rejected(cache_mib):
    with pytest.raises(ValueError):
        build_endpoint("model", "model", 96000, 1, "on", 4, cache_mib)

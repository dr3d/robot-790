from pathlib import Path

import pytest

from robot_790d import brain_status, sts_page_server, tts_settings


@pytest.fixture
def installed_models(tmp_path, monkeypatch):
    monkeypatch.setenv("ROBOT_790_TTS_MODEL_DIR", str(tmp_path))
    for size in tts_settings.MODEL_SIZES:
        path = tts_settings.model_path(size)
        path.mkdir()
        (path / "config.json").write_text("{}")
        (path / "model.safetensors").touch()
    return tmp_path


@pytest.mark.parametrize("size,supported", [("0.6B", False), ("1.7B", True)])
def test_active_model_capability_is_independent_of_precision(installed_models, size, supported):
    for precision in ("bfloat16", "float16"):
        result = tts_settings.describe_tts({
            "_running": "true", "qwen3_tts_model_name": str(tts_settings.model_path(size)),
            "qwen3_tts_dtype": precision,
        })
        assert result["active"]["model"] == size
        assert result["active"]["precision"] == precision
        assert result["active"]["style_instructions"] is supported
        assert all(model["installed"] for model in result["models"])


@pytest.mark.parametrize("args", [{}, {"_running": "true"}, {
    "_running": "true", "qwen3_tts_model_name": "Qwen3-TTS-12Hz-1.7B-Base", "qwen3_tts_dtype": "float16"
}])
def test_unknown_or_stopped_model_never_claims_style_support(installed_models, args):
    result = tts_settings.describe_tts(args)
    assert result["active"]["style_instructions"] is None
    assert result["active"]["model"] is None


def test_model_install_requires_config_and_weights(installed_models):
    (tts_settings.model_path("1.7B") / "model.safetensors").unlink()
    assert not tts_settings.model_installed("1.7B")
    with pytest.raises(ValueError):
        tts_settings.model_path("../../unexpected")


def test_tts_endpoint_uses_live_arguments_not_saved_ui_choices(installed_models, monkeypatch):
    monkeypatch.setattr(brain_status, "_read_realtime_commandline", lambda root:
        f'python -m robot_790d.realtime_entry --qwen3_tts_model_name "{tts_settings.model_path("0.6B")}" '
        '--qwen3_tts_dtype bfloat16 --responses_api_api_key PRIVATE_SENTINEL')
    result = brain_status.get_tts_status(Path("."))
    assert result["active"]["model"] == "0.6B"
    assert result["active"]["precision"] == "bfloat16"
    assert "PRIVATE_SENTINEL" not in str(result)
    replies = []
    monkeypatch.setattr(sts_page_server, "get_tts_status", lambda: result)
    handler = object.__new__(sts_page_server.StsPageHandler)
    handler.path = "/api/realtime/tts"
    monkeypatch.setattr(handler, "_send_json", lambda code, body: replies.append((code, body)))
    handler.do_GET()
    assert replies == [(200, result)]

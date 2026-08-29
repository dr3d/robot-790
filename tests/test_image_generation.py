import json
import sys
import types

import pytest

from robot_790d import image_generation


def test_mock_image_generation_writes_svg_and_metadata(tmp_path, monkeypatch) -> None:
    monkeypatch.delenv("ROBOT_790_IMAGE_OUTPUT_DIR", raising=False)
    monkeypatch.delenv("ROBOT_790_INSTANCE_PATH", raising=False)

    result = image_generation.generate_image(
        "Robot 790 imagines a brass clockwork lighthouse.",
        title="clockwork lighthouse",
        provider="mock",
        repo_root=tmp_path,
    )

    assert result["status"] == "ok"
    assert result["tool"] == "generate_image"
    assert result["provider"] == "mock"
    assert str(result["url"]).startswith("/generated-images/")

    path = tmp_path / "logs" / "generated-images" / str(result["filename"])
    assert path.exists()
    assert "Robot 790 image prompt" in path.read_text(encoding="utf-8")

    metadata = json.loads(path.with_suffix(".json").read_text(encoding="utf-8"))
    assert metadata["provider"] == "mock"
    assert metadata["prompt"] == "Robot 790 imagines a brass clockwork lighthouse."


def test_openai_generation_reports_missing_key(monkeypatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("ROBOT_790_OPENAI_API_KEY", raising=False)

    result = image_generation.generate_image("a small robot face", provider="openai")

    assert result["status"] == "error"
    assert "OPENAI_API_KEY" in str(result["error"])


def test_openai_generation_accepts_model_and_quality(tmp_path, monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeResponse:
        status_code = 200

        def json(self) -> dict[str, object]:
            return {"data": [{"b64_json": "aGVsbG8=", "revised_prompt": "revised"}]}

    fake_httpx = types.SimpleNamespace(
        HTTPError=RuntimeError,
        post=lambda url, **kwargs: captured.update({"url": url, **kwargs}) or FakeResponse(),
    )
    monkeypatch.setitem(sys.modules, "httpx", fake_httpx)
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    result = image_generation.generate_image(
        "a better puppet theater",
        title="puppet theater",
        provider="openai",
        model="gpt-image-1",
        quality="high",
        repo_root=tmp_path,
    )

    assert result["status"] == "ok"
    assert result["model"] == "gpt-image-1"
    assert result["quality"] == "high"
    payload = captured["json"]
    assert payload["model"] == "gpt-image-1"
    assert payload["quality"] == "high"


def test_generated_image_path_rejects_unsafe_filename(tmp_path) -> None:
    with pytest.raises(ValueError):
        image_generation.generated_image_path("../secret.png", repo_root=tmp_path)

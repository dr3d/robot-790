import json

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


def test_generated_image_path_rejects_unsafe_filename(tmp_path) -> None:
    with pytest.raises(ValueError):
        image_generation.generated_image_path("../secret.png", repo_root=tmp_path)

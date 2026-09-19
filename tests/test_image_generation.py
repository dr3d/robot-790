import json
import os
import re
import sys
import types
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

import pytest

from robot_790d import image_generation


@pytest.fixture(autouse=True)
def isolated_image_storage(monkeypatch):
    monkeypatch.delenv("ROBOT_790_IMAGE_OUTPUT_DIR", raising=False)
    monkeypatch.delenv("ROBOT_790_INSTANCE_PATH", raising=False)


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
    assert re.fullmatch(r"\d{8}-\d{6}-mock-clockwork-lighthouse-[0-9a-f]{32}\.svg", str(result["filename"]))

    path = tmp_path / "logs" / "generated-images" / str(result["filename"])
    assert path.exists()
    assert "Robot 790 image prompt" in path.read_text(encoding="utf-8")

    metadata = json.loads(path.with_suffix(".json").read_text(encoding="utf-8"))
    assert metadata["provider"] == "mock"
    assert metadata["prompt"] == "Robot 790 imagines a brass clockwork lighthouse."


def test_openai_generation_reports_missing_key(monkeypatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("ROBOT_790_OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("ROBOT_790_DISABLE_DOTENV_FALLBACK", "1")

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


def test_openai_generation_reads_repo_dotenv_fallback(tmp_path, monkeypatch) -> None:
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
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("ROBOT_790_OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("ROBOT_790_DISABLE_DOTENV_FALLBACK", raising=False)
    (tmp_path / ".env").write_text(
        "\n".join(
            [
                "OPENAI_API_KEY=dotenv-key",
                "ROBOT_790_OPENAI_IMAGE_MODEL=gpt-image-1",
                "ROBOT_790_OPENAI_IMAGE_QUALITY=medium",
                "ROBOT_790_IMAGE_SIZE=1024x1024",
            ]
        ),
        encoding="utf-8",
    )

    result = image_generation.generate_image("a robot smelling popcorn", provider="openai", repo_root=tmp_path)

    assert result["status"] == "ok"
    assert result["model"] == "gpt-image-1"
    assert result["quality"] == "medium"
    assert captured["headers"]["Authorization"] == "Bearer dotenv-key"


def test_generated_image_path_rejects_unsafe_filename(tmp_path) -> None:
    with pytest.raises(ValueError):
        image_generation.generated_image_path("../secret.png", repo_root=tmp_path)


def test_same_title_images_keep_distinct_artifacts_and_metadata_in_parallel(tmp_path, monkeypatch):
    class FixedDatetime(datetime):
        @classmethod
        def now(cls):
            return cls(2026, 9, 19, 8, 0, 0)

    monkeypatch.setattr(image_generation, "datetime", FixedDatetime)

    def draw(index):
        return image_generation.generate_image(
            f"Distinct picture {index}", title="harbor", provider="mock", repo_root=tmp_path,
        )

    with ThreadPoolExecutor(max_workers=6) as executor:
        results = list(executor.map(draw, range(12)))
    assert len({result["filename"] for result in results}) == 12
    for index, result in enumerate(results):
        path = image_generation.generated_image_path(result["filename"], tmp_path)
        assert f"Distinct picture {index}" in path.read_text(encoding="utf-8")
        metadata = json.loads(path.with_suffix(".json").read_text(encoding="utf-8"))
        assert metadata["prompt"] == f"Distinct picture {index}"
    assert len(list(path.parent.iterdir())) == 24


def test_image_publication_never_replaces_an_existing_filename(tmp_path, monkeypatch):
    filename = "20260919-080000-mock-existing.svg"
    path = image_generation.generated_image_path(filename, tmp_path)
    path.parent.mkdir(parents=True)
    path.write_bytes(b"original image")
    monkeypatch.setattr(image_generation, "_generated_filename", lambda **kwargs: filename)
    with pytest.raises(FileExistsError):
        image_generation._write_image_bytes(
            b"replacement", prompt="new", title="same", provider="mock", ext="svg", repo_root=tmp_path,
        )
    assert path.read_bytes() == b"original image"
    assert list(path.parent.iterdir()) == [path]


def test_metadata_publication_never_replaces_an_existing_sidecar(tmp_path):
    filename = "20260919-080000-mock-existing.svg"
    path = image_generation.generated_image_path(filename, tmp_path).with_suffix(".json")
    path.parent.mkdir(parents=True)
    path.write_text('{"prompt": "original"}', encoding="utf-8")
    with pytest.raises(FileExistsError):
        image_generation._write_metadata(filename, {"prompt": "replacement"}, repo_root=tmp_path)
    assert json.loads(path.read_text(encoding="utf-8")) == {"prompt": "original"}
    assert list(path.parent.iterdir()) == [path]


@pytest.mark.parametrize("metadata", [False, True])
@pytest.mark.parametrize("failure", ["flush", "publish"])
def test_failed_artifact_writes_leave_no_final_or_temporary_file(tmp_path, monkeypatch, metadata, failure):
    output = image_generation.image_output_dir(tmp_path)
    output.mkdir(parents=True)

    def fail(*args):
        if failure == "publish":
            assert args[0].read_bytes()
            assert not args[1].exists()
        raise OSError("simulated disk failure")

    monkeypatch.setattr(image_generation.os, "fsync" if failure == "flush" else
                        "rename" if os.name == "nt" else "link", fail)
    with pytest.raises(OSError, match="simulated disk failure"):
        if metadata:
            image_generation._write_metadata("existing.svg", {"prompt": "new"}, repo_root=tmp_path)
        else:
            image_generation._write_image_bytes(
                b"complete image", prompt="new", title="same", provider="mock", ext="svg", repo_root=tmp_path,
            )
    assert list(output.iterdir()) == []


def test_legacy_generated_image_filenames_remain_readable(tmp_path):
    filename = "20260911-214823-openai-salem-harbor-from-salem-landing.png"
    assert image_generation.generated_image_path(filename, tmp_path).name == filename
    assert image_generation.generated_image_url(filename) == f"/generated-images/{filename}"

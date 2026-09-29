import json

import pytest

from robot_790d import sts_page_server as server


@pytest.fixture
def catalogue(tmp_path, monkeypatch):
    monkeypatch.delenv("ROBOT_790_IMAGE_OUTPUT_DIR", raising=False)
    monkeypatch.delenv("ROBOT_790_INSTANCE_PATH", raising=False)
    folder = tmp_path / "logs" / "generated-images"
    folder.mkdir(parents=True)

    def add(name, metadata=None):
        (folder / name).write_bytes(b"original")
        if metadata is not None:
            (folder / name).with_suffix(".json").write_text(json.dumps(metadata), encoding="utf-8")

    def lookup(**kwargs):
        return server.list_sensing_eye_images(repo_root=tmp_path, **kwargs)

    return folder, add, lookup


def test_unstaged_originals_found_by_title_and_prompt_without_dumping_prompt(catalogue):
    folder, add, lookup = catalogue
    name = "20260928-165023-openai-the-loose-eyes-roll-around-abc.png"
    add(name, {"prompt": "Four cyan screens with rainbow jumper cables. " * 1000})
    for query in ["The Loose Eyes Roll Around", "rainbow jumper cables"]:
        found = lookup(query=query)
        assert found["total"] == 1
        item = found["files"][0]
        assert item["id"] == f"generated:{name}"
        assert item["storage"] == "generated"
        assert item["url"] == f"/generated-images/{name}"
        assert "prompt" not in item and "_search" not in item
        assert len(json.dumps(found)) < 1500
    add("untitled.png", {"title": "The Day I Became a Dog"})
    assert lookup(query="day became dog")["files"][0]["filename"] == "untitled.png"
    assert not (folder.parent / "sensing-eye").exists()


def test_staged_original_dedup_preserves_prompt_search_and_exact_generated_id(catalogue):
    folder, add, lookup = catalogue
    add("family.png", {"prompt": "A cyan workbench portrait"})
    server.push_sensing_eye_image({
        "filename": "family.png", "image_data_url": "data:image/jpeg;base64,aW1hZ2U=",
        "source": "generated image",
    }, repo_root=folder.parent.parent)
    found = lookup(query="cyan workbench")
    assert found["total"] == 1
    assert found["files"][0]["filename"] == "family.jpg"
    assert found["files"][0]["url"] == "/sensing-eye/family.jpg"
    assert lookup(filename="family.jpg")["total"] == 1
    original = lookup(filename="generated:family.png", query="irrelevant")
    assert original["total"] == 1
    assert original["files"][0]["url"] == "/generated-images/family.png"
    assert lookup()["total"] == 1


def test_generated_and_eye_name_collision_is_not_provenance(catalogue):
    folder, add, lookup = catalogue
    add("same.png")
    server.push_sensing_eye_image({
        "filename": "same.png", "image_data_url": "data:image/png;base64,aW1hZ2U=",
        "source": "operator drop",
    }, repo_root=folder.parent.parent)
    assert lookup()["total"] == 2
    assert lookup(filename="same.png")["files"][0]["url"] == "/sensing-eye/same.png"
    assert lookup(filename="generated:same.png")["files"][0]["url"] == "/generated-images/same.png"


def test_mixed_catalogue_pages_and_bad_sidecars(catalogue):
    folder, add, lookup = catalogue
    for i in range(12):
        add(f"generated-{i:02}.png", [] if i == 0 else {})
    (folder / "generated-01.json").write_text("{bad", encoding="utf-8")
    (folder / "generated-02.json").write_bytes(b"\xff")
    add("not-image.txt")
    add("bad name.png")
    pages, offset = [], 0
    while offset is not None:
        found = lookup(limit=5, offset=offset)
        assert found["total"] == 12
        assert len(found["files"]) <= 5
        pages.extend(item["id"] for item in found["files"])
        offset = found["next_offset"]
    assert len(set(pages)) == 12
    assert lookup(filename="generated:../outside.png")["files"] == []
    assert lookup(query="!!!")["files"] == []


def test_configured_generation_directory_is_used(catalogue, monkeypatch, tmp_path):
    _, add, lookup = catalogue
    add("default.png")
    custom = tmp_path / "instance" / "generated-images"
    custom.mkdir(parents=True)
    (custom / "configured.png").write_bytes(b"original")
    monkeypatch.setenv("ROBOT_790_INSTANCE_PATH", str(custom.parent))
    assert lookup()["files"][0]["filename"] == "configured.png"

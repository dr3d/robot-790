import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

pytestmark = pytest.mark.skipif(sys.platform != "win32", reason="Windows PowerShell backup utility")
SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "backup_private_history.ps1"


def backup(root, target, **environment):
    env = os.environ.copy()
    env.pop("ROBOT_790_NOTES_PATH", None)
    env.update(environment)
    return subprocess.run(
        ["powershell", "-NoProfile", "-File", str(SCRIPT), "-ProjectRoot", str(root), "-Destination", str(target)],
        env=env, capture_output=True, text=True, timeout=30,
    )


def test_backup_verifies_all_private_files_and_leaves_sources_unchanged(tmp_path):
    root = tmp_path / "project [lab]"
    root.mkdir()
    expected = {
        "notes/sessions/session.txt": b"Original conversation\n",
        "notes/sessions/archived/session.txt": b"Archived conversation\n",
        "logs/sensing-eye/picture.png": bytes(range(256)),
        "logs/generated-images/picture.json": b'{"prompt":"original"}',
        "logs/audio/clip.wav": b"private audio",
        "config/runtime.json": b"{}",
        ".env": b"PRIVATE_TOKEN=test-only",
    }
    for relative, content in expected.items():
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    (root / "notes-to-me.txt").write_text("Not in scope", encoding="utf-8")
    target = root / "backups" / "verified"
    result = backup(root, target)
    assert result.returncode == 0, result.stderr
    manifest = json.loads((target / "backup-manifest.json").read_text(encoding="utf-8"))
    assert {item["path"] for item in manifest["files"]} == set(expected)
    for item in manifest["files"]:
        content = expected[item["path"]]
        assert item["sha256"] == hashlib.sha256(content).hexdigest()
        assert item["bytes"] == len(content)
        assert (target / item["path"]).read_bytes() == content
        assert (root / item["path"]).read_bytes() == content
    assert manifest["missing_optional_sources"] == ["qwen3_tts.env"]
    assert not (target / "notes-to-me.txt").exists()
    second = backup(root, target)
    assert second.returncode != 0
    assert "already exists" in second.stderr
    assert json.loads((target / "backup-manifest.json").read_text(encoding="utf-8")) == manifest


@pytest.mark.parametrize("location", ["notes/backup", "logs/backup", "config/backup"])
def test_backup_refuses_destination_inside_sources(tmp_path, location):
    (tmp_path / "notes").mkdir()
    (tmp_path / "notes" / "original.txt").write_text("original", encoding="utf-8")
    target = tmp_path / location
    result = backup(tmp_path, target)
    assert result.returncode != 0
    assert "inside a source" in result.stderr
    assert not target.exists()


def test_backup_refuses_to_misrepresent_external_notes_as_backed_up(tmp_path):
    result = backup(tmp_path, tmp_path / "backup", ROBOT_790_NOTES_PATH=str(tmp_path / "external"))
    assert result.returncode != 0
    assert "External ROBOT_790_NOTES_PATH" in result.stderr
    assert not (tmp_path / "backup").exists()


def test_empty_backup_cannot_report_success(tmp_path):
    result = backup(tmp_path, tmp_path / "backup")
    assert result.returncode != 0
    assert "No private data" in result.stderr
    assert not (tmp_path / "backup").exists()

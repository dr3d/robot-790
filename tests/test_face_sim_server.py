from __future__ import annotations

from pathlib import Path

from robot_790d import face_sim_server


def test_save_browser_face_recording_writes_timestamped_and_latest_files(tmp_path: Path) -> None:
    result = face_sim_server.save_browser_face_recording(
        b"webm data",
        "face take.webm",
        repo_root=tmp_path,
    )

    recording = tmp_path / "logs" / "browser-face" / "face-take.webm"
    latest = tmp_path / "logs" / "browser-face" / "latest-browser-face.webm"
    assert result["ok"] is True
    assert result["filename"] == "face-take.webm"
    assert result["url"] == "/recorded-face/face-take.webm"
    assert result["latest_url"] == "/recorded-face/latest-browser-face.webm"
    assert recording.read_bytes() == b"webm data"
    assert latest.read_bytes() == b"webm data"


def test_browser_face_recording_filename_is_sanitized(tmp_path: Path) -> None:
    result = face_sim_server.save_browser_face_recording(
        b"webm data",
        "../bad name?.txt",
        repo_root=tmp_path,
    )

    assert result["filename"] == "bad-name.webm"
    assert (tmp_path / "logs" / "browser-face" / "bad-name.webm").exists()


def test_browser_face_recording_rejects_empty_data(tmp_path: Path) -> None:
    try:
        face_sim_server.save_browser_face_recording(b"", "empty.webm", repo_root=tmp_path)
    except ValueError as exc:
        assert "Nothing to record" in str(exc)
    else:
        raise AssertionError("Expected empty browser face recording to fail")

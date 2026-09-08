from __future__ import annotations

from pathlib import Path

from robot_790d import face_sim_server


def test_browser_face_mouth_text_tracks_caption_source() -> None:
    state = face_sim_server.FaceSimState("127.0.0.1", 8791)

    brain2 = state.set_mouth({"text": "side thought", "source": "person_lane"})
    assert brain2["mouth"]["text_active"] is True
    assert brain2["mouth"]["text_source"] == "brain2"

    eric = state.set_mouth({"text": "main caption"})
    assert eric["mouth"]["text_source"] == "eric"

    cleared = state.set_mouth({"clear": True})
    assert cleared["mouth"]["text_active"] is False
    assert cleared["mouth"]["text_source"] == ""


def test_browser_face_mouth_tracks_speech_cue_layer() -> None:
    state = face_sim_server.FaceSimState("127.0.0.1", 8791)

    speaking = state.set_mouth(
        {"talking": True, "speech": {"active": True, "shape": "round", "energy": 0.72, "seq": 4}}
    )
    assert speaking["mouth"]["talking"] is True
    assert speaking["mouth"]["manual"] is True
    assert speaking["mouth"]["speech"] == {"active": True, "shape": "round", "energy": 0.72, "seq": 4}

    stopped = state.set_mouth({"talking": False})
    assert stopped["mouth"]["talking"] is False
    assert stopped["mouth"]["speech"] == {"active": False, "shape": "closed", "energy": 0.0, "seq": 4}


def test_browser_face_command_queue_can_be_cleared() -> None:
    state = face_sim_server.FaceSimState("127.0.0.1", 8791)

    queued = state.queue_capture_to_eye({"reason": "mirror test"})
    before_clear = state.list_commands(after=0)
    cleared = state.clear_commands()
    after_clear = state.list_commands(after=0)

    assert queued["queued"] is True
    assert before_clear["commands"][0]["seq"] == queued["seq"]
    assert cleared["cleared"] == 1
    assert cleared["latest_seq"] > queued["seq"]
    assert after_clear["commands"] == []
    assert after_clear["latest_seq"] == cleared["latest_seq"]


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

from robot_790d import sts_page_server


def test_record_log_snapshot_writes_timestamped_and_latest_files(tmp_path) -> None:
    result = sts_page_server.record_log_snapshot("conversation", "Robot 790: hello", repo_root=tmp_path)

    path = tmp_path / result["filename"]
    latest = tmp_path / result["latest"]
    assert path.exists()
    assert latest.exists()
    assert "Source: conversation" in path.read_text(encoding="utf-8")
    assert "Robot 790: hello" in latest.read_text(encoding="utf-8")


def test_record_log_snapshot_rejects_empty_content(tmp_path) -> None:
    try:
        sts_page_server.record_log_snapshot("events", "   ", repo_root=tmp_path)
    except ValueError as exc:
        assert "Nothing to record" in str(exc)
    else:
        raise AssertionError("Expected empty log recording to fail")


def test_dispatch_cast_posts_to_client(monkeypatch) -> None:
    class FakeCastMediaClient:
        def play_youtube(self, **kwargs: object) -> dict[str, object]:
            return {"status": "ok", "tool": "cast_media", "action": "play_youtube", **kwargs}

    monkeypatch.setattr(sts_page_server, "CastMediaClient", FakeCastMediaClient)

    result = sts_page_server._dispatch_cast({"action": "play_youtube", "query": "pterodactyl facts"})

    assert result == {
        "status": "ok",
        "tool": "cast_media",
        "action": "play_youtube",
        "query": "pterodactyl facts",
        "video_id": None,
        "device_name": None,
    }

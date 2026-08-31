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


def test_record_audio_snapshot_returns_picture_mp4(monkeypatch, tmp_path) -> None:
    image_path = tmp_path / "logs" / "generated-images" / "last-image.png"
    image_path.parent.mkdir(parents=True)
    image_path.write_bytes(b"fake image")

    def fake_convert(audio_path, output_path, selected_image_path, repo_root, **_kwargs):
        assert audio_path.suffix == ".webm"
        assert selected_image_path == image_path
        assert repo_root == tmp_path
        output_path.write_bytes(b"fake mp4")
        return {"status": "ok", "duration_s": 12.25}

    monkeypatch.setattr(sts_page_server, "_selected_recording_image", lambda *_args, **_kwargs: image_path)
    monkeypatch.setattr(sts_page_server, "_make_picture_audio_mp4", fake_convert)

    result = sts_page_server.record_audio_snapshot(
        b"fake webm",
        "audio/webm;codecs=opus",
        repo_root=tmp_path,
        image_filename="last-image.png",
    )

    assert result["filename"].endswith("-sts-audio-picture.mp4")
    assert result["latest"] == "logs/audio/latest-sts-audio-picture.mp4"
    assert result["latest_url"] == "/recorded-audio/latest-sts-audio-picture.mp4"
    assert result["raw_latest"] == "logs/audio/latest-sts-audio-source.webm"
    assert result["image_filename"] == "last-image.png"
    assert (tmp_path / result["latest"]).read_bytes() == b"fake mp4"


def test_record_audio_snapshot_prefers_inline_cover_image(monkeypatch, tmp_path) -> None:
    selected_paths = []

    def fake_convert(audio_path, output_path, selected_image_path, repo_root, **_kwargs):
        selected_paths.append(selected_image_path)
        output_path.write_bytes(b"fake mp4")
        return {"status": "ok", "duration_s": 3.5}

    monkeypatch.setattr(sts_page_server, "_make_picture_audio_mp4", fake_convert)

    result = sts_page_server.record_audio_snapshot(
        b"fake webm",
        "audio/webm",
        repo_root=tmp_path,
        image_filename="older-generated-image.png",
        cover_image=b"fake jpeg",
        cover_image_mime="image/jpeg",
        cover_image_name="front-of-recording.jpg",
    )

    assert selected_paths
    selected = selected_paths[0]
    assert selected.name.endswith("-sts-audio-cover.jpg")
    assert selected.read_bytes() == b"fake jpeg"
    assert (tmp_path / "logs" / "audio" / "latest-sts-audio-cover.jpg").read_bytes() == b"fake jpeg"
    assert result["image_filename"] == selected.name
    assert result["cover_source"] == "sensing_eye"


def test_record_audio_snapshot_passes_caption_events(monkeypatch, tmp_path) -> None:
    captured = {}

    def fake_convert(audio_path, output_path, selected_image_path, repo_root, **kwargs):
        captured.update(kwargs)
        output_path.write_bytes(b"fake mp4")
        return {"status": "ok", "duration_s": 4.0, "captioned": True}

    monkeypatch.setattr(sts_page_server, "_make_picture_audio_mp4", fake_convert)

    result = sts_page_server.record_audio_snapshot(
        b"fake webm",
        "audio/webm",
        repo_root=tmp_path,
        captions=[{"speaker": "Robot 790", "start_ms": 1200, "text": "hello tiny stage"}],
    )

    assert captured["captions"] == [{"speaker": "Robot 790", "start_ms": 1200, "text": "hello tiny stage"}]
    assert result["captioned"] is True
    assert result["caption_events"] == 1


def test_finalize_audio_recording_session_splices_chunks(monkeypatch, tmp_path) -> None:
    audio_dir = tmp_path / "logs" / "audio"
    audio_dir.mkdir(parents=True)
    first = audio_dir / "first-source.webm"
    second = audio_dir / "second-source.webm"
    cover = audio_dir / "latest-sts-audio-cover.jpg"
    first.write_bytes(b"first")
    second.write_bytes(b"second")
    cover.write_bytes(b"cover")

    def fake_concat(paths, output_path, repo_root):
        assert paths == [first, second]
        assert repo_root == tmp_path
        output_path.write_bytes(b"firstsecond")
        return {"status": "ok"}

    def fake_convert(audio_path, output_path, selected_image_path, repo_root, **kwargs):
        assert audio_path.name.endswith("-sts-audio-session-source.webm")
        assert selected_image_path == cover
        assert kwargs["captions"] == [{"speaker": "Robot 790", "start_ms": 1200, "text": "stitched line"}]
        output_path.write_bytes(b"fake session mp4")
        return {"status": "ok", "duration_s": 9.25, "captioned": True}

    monkeypatch.setattr(sts_page_server, "_concat_audio_sources", fake_concat)
    monkeypatch.setattr(sts_page_server, "_make_picture_audio_mp4", fake_convert)

    result = sts_page_server.finalize_audio_recording_session(
        [
            {"raw_filename": "logs/audio/first-source.webm"},
            {"raw_filename": "logs/audio/second-source.webm"},
        ],
        repo_root=tmp_path,
        image_filename="latest-sts-audio-cover.jpg",
        captions=[{"speaker": "Robot 790", "start_ms": 1200, "text": "stitched line"}],
    )

    assert result["status"] == "ok"
    assert result["filename"].endswith("-sts-audio-session-picture.mp4")
    assert result["latest"] == "logs/audio/latest-sts-audio-picture.mp4"
    assert result["raw_latest"] == "logs/audio/latest-sts-audio-source.webm"
    assert result["chunk_count"] == 2
    assert result["captioned"] is True
    assert (tmp_path / result["latest"]).read_bytes() == b"fake session mp4"
    assert (tmp_path / result["raw_latest"]).read_bytes() == b"firstsecond"


def test_finalize_audio_recording_session_requires_two_chunks(tmp_path) -> None:
    audio_dir = tmp_path / "logs" / "audio"
    audio_dir.mkdir(parents=True)
    only = audio_dir / "only-source.webm"
    only.write_bytes(b"only")

    try:
        sts_page_server.finalize_audio_recording_session(
            [{"raw_filename": "logs/audio/only-source.webm"}],
            repo_root=tmp_path,
        )
    except ValueError as exc:
        assert "At least two audio chunks" in str(exc)
    else:
        raise AssertionError("Expected finalizing a single chunk to fail")


def test_finalize_audio_recording_session_rejects_non_list_chunks(tmp_path) -> None:
    try:
        sts_page_server.finalize_audio_recording_session("logs/audio/one.webm", repo_root=tmp_path)
    except ValueError as exc:
        assert "Audio chunks must be a list" in str(exc)
    else:
        raise AssertionError("Expected non-list chunks to fail")


def test_recording_caption_cards_split_short_word_groups(monkeypatch) -> None:
    monkeypatch.setenv("ROBOT_790_CAPTION_WORDS_PER_CARD", "2")

    cards = sts_page_server._recording_caption_cards(
        [{"speaker": "Robot 790", "start_ms": 1000, "text": "one two three four five"}],
        duration_s=5.0,
    )

    assert [card[2] for card in cards] == ["one two", "three four", "five"]
    assert cards[0][0] < cards[0][1] <= cards[1][0]


def test_recording_audio_filter_can_trim_silence(monkeypatch) -> None:
    monkeypatch.setenv("ROBOT_790_AUDIO_TRIM_SILENCE", "true")
    monkeypatch.setenv("ROBOT_790_AUDIO_TRIM_THRESHOLD", "-42dB")
    monkeypatch.setenv("ROBOT_790_AUDIO_TRIM_SILENCE_S", "1.25")
    monkeypatch.setenv("ROBOT_790_AUDIO_TRIM_KEEP_S", "0.2")

    value = sts_page_server._recording_audio_filter(trim_silence=True)

    assert value.startswith("aresample=async=1:first_pts=0,silenceremove=")
    assert "start_threshold=-42dB" in value
    assert value.count("start_threshold=-42dB") == 2
    assert "start_duration=1.250" in value
    assert "start_silence=0.200" in value
    assert ",areverse,silenceremove=" in value


def test_recorded_audio_path_stays_inside_audio_dir(tmp_path) -> None:
    path = sts_page_server.recorded_audio_path("../latest-sts-audio-picture.mp4", tmp_path)

    assert path == tmp_path / "logs" / "audio" / "latest-sts-audio-picture.mp4"


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

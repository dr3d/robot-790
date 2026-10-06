from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from robot_790d import media_cast
from robot_790d.media_cast import CastMediaClient, CastMediaSettings, extract_youtube_video_id


def test_extract_youtube_video_id_accepts_id_watch_and_shorts_urls() -> None:
    assert extract_youtube_video_id("abc123") == "abc123"
    assert extract_youtube_video_id("https://www.youtube.com/watch?v=abc123&t=10") == "abc123"
    assert extract_youtube_video_id("https://youtube.com/shorts/short123") == "short123"
    assert extract_youtube_video_id("https://youtu.be/shortlink123") == "shortlink123"


def test_search_youtube_uses_flat_limited_results(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeYoutubeDl:
        def __init__(self, options: dict[str, object]) -> None:
            captured["options"] = options

        def __enter__(self) -> "FakeYoutubeDl":
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def extract_info(self, query: str, download: bool) -> dict[str, object]:
            captured["query"] = query
            captured["download"] = download
            return {
                "entries": [
                    {
                        "id": "video123",
                        "title": "Robot video",
                        "channel": "Local Robotics",
                        "duration": 53,
                        "url": "https://www.youtube.com/watch?v=video123",
                    }
                ]
            }

    def fake_import_module(name: str) -> object:
        if name == "yt_dlp":
            return SimpleNamespace(YoutubeDL=FakeYoutubeDl)
        raise ModuleNotFoundError(name)

    monkeypatch.setattr(media_cast.importlib, "import_module", fake_import_module)

    result = CastMediaClient().search_youtube("robot 790", max_results=12)

    assert captured["query"] == "ytsearch5:robot 790"
    assert captured["download"] is False
    assert result["status"] == "ok"
    assert result["results"] == [
        {
            "video_id": "video123",
            "title": "Robot video",
            "channel": "Local Robotics",
            "duration_s": 53,
            "url": "https://www.youtube.com/watch?v=video123",
        }
    ]


def test_play_youtube_sends_video_to_matching_cast(monkeypatch) -> None:
    played: dict[str, object] = {}
    bind_data = {"name": "Python", "device": "REMOTE_CONTROL", "id": "original-id"}
    fake_cast = SimpleNamespace(
        cast_info=SimpleNamespace(
            friendly_name="Living Room TV",
            host=SimpleNamespace(host="192.168.0.45", port=8009),
            model_name="Receiver",
            manufacturer="Test",
            uuid="uuid-1",
        ),
        wait=MagicMock(),
        disconnect=MagicMock(),
        register_handler=MagicMock(),
    )

    class FakeYoutubeController:
        def __init__(self, timeout: float) -> None:
            played["timeout"] = timeout

        def play_video(self, video_id: str) -> None:
            assert bind_data["name"] == "Eric Robot-790"
            played["video_id"] = video_id

    fake_pychromecast = SimpleNamespace(
        get_chromecasts=MagicMock(return_value=([fake_cast], object())),
        discovery=SimpleNamespace(stop_discovery=MagicMock()),
    )

    def fake_import_module(name: str) -> object:
        if name == "pychromecast":
            return fake_pychromecast
        if name == "pychromecast.controllers.youtube":
            return SimpleNamespace(YouTubeController=FakeYoutubeController)
        if name == "casttube.YouTubeSession":
            return SimpleNamespace(BIND_DATA=bind_data)
        raise ModuleNotFoundError(name)

    monkeypatch.setattr(media_cast.importlib, "import_module", fake_import_module)

    result = CastMediaClient(CastMediaSettings(timeout_s=4.0)).play_youtube(video_id="video123")

    assert result["status"] == "ok"
    assert result["action"] == "play_youtube"
    assert played == {"timeout": 4.0, "video_id": "video123"}
    assert bind_data == {"name": "Eric Robot-790", "device": "REMOTE_CONTROL", "id": "original-id"}
    fake_cast.wait.assert_called_once_with(timeout=4.0)
    fake_cast.register_handler.assert_called_once()
    fake_pychromecast.discovery.stop_discovery.assert_called_once()


def test_show_image_sends_direct_image_url_to_matching_cast(monkeypatch) -> None:
    media_controller = SimpleNamespace(
        play_media=MagicMock(),
        block_until_active=MagicMock(),
    )
    fake_cast = SimpleNamespace(
        cast_info=SimpleNamespace(
            friendly_name="Living Room TV",
            host=SimpleNamespace(host="192.168.0.45", port=8009),
            model_name="Receiver",
            manufacturer="Test",
            uuid="uuid-1",
        ),
        wait=MagicMock(),
        disconnect=MagicMock(),
        media_controller=media_controller,
    )
    fake_pychromecast = SimpleNamespace(
        get_chromecasts=MagicMock(return_value=([fake_cast], object())),
        discovery=SimpleNamespace(stop_discovery=MagicMock()),
    )

    def fake_import_module(name: str) -> object:
        if name == "pychromecast":
            return fake_pychromecast
        raise ModuleNotFoundError(name)

    monkeypatch.setattr(media_cast.importlib, "import_module", fake_import_module)

    result = CastMediaClient(CastMediaSettings(timeout_s=4.0)).show_image(
        image_url="https://example.com/robot.jpg",
        title="Robot 790",
    )

    assert result["status"] == "ok"
    assert result["action"] == "show_image"
    assert result["content_type"] == "image/jpeg"
    fake_cast.wait.assert_called_once_with(timeout=4.0)
    media_controller.play_media.assert_called_once_with(
        "https://example.com/robot.jpg",
        "image/jpeg",
        title="Robot 790",
        thumb="https://example.com/robot.jpg",
        stream_type="BUFFERED",
        metadata={
            "metadataType": 4,
            "title": "Robot 790",
            "images": [{"url": "https://example.com/robot.jpg"}],
        },
    )
    media_controller.block_until_active.assert_called_once_with(timeout=4.0)


def test_show_image_requires_direct_image_url() -> None:
    result = CastMediaClient(CastMediaSettings(timeout_s=4.0)).show_image(
        image_url="https://example.com/gallery",
    )

    assert result == {
        "status": "error",
        "error": "Provide a direct HTTP or HTTPS image URL ending in jpg, jpeg, png, webp, or gif.",
    }


def test_status_reports_inactive_cast_playback(monkeypatch) -> None:
    media_status = SimpleNamespace(
        player_state="IDLE",
        idle_reason="CANCELLED",
        media_session_id=None,
        content_id=None,
        content_type=None,
        stream_type=None,
    )
    media_controller = SimpleNamespace(
        status=media_status,
        update_status=MagicMock(),
    )
    fake_cast = SimpleNamespace(
        cast_info=SimpleNamespace(
            friendly_name="Living Room TV",
            host=SimpleNamespace(host="192.168.0.45", port=8009),
            model_name="Receiver",
            manufacturer="Test",
            uuid="uuid-1",
        ),
        wait=MagicMock(),
        disconnect=MagicMock(),
        media_controller=media_controller,
    )
    fake_pychromecast = SimpleNamespace(
        get_chromecasts=MagicMock(return_value=([fake_cast], object())),
        discovery=SimpleNamespace(stop_discovery=MagicMock()),
    )

    def fake_import_module(name: str) -> object:
        if name == "pychromecast":
            return fake_pychromecast
        raise ModuleNotFoundError(name)

    monkeypatch.setattr(media_cast.importlib, "import_module", fake_import_module)

    result = CastMediaClient(CastMediaSettings(timeout_s=4.0)).status()

    assert result["status"] == "ok"
    assert result["action"] == "status"
    assert result["playback_active"] is False
    assert result["receiver_status"]["player_state"] == "IDLE"
    media_controller.update_status.assert_called_once_with()


@pytest.fixture
def cast_connections(monkeypatch):
    """Discovery owns active and never-started connections until cleanup."""
    calls = []

    def connection(name, started):
        worker = SimpleNamespace(ident=1 if started else None)
        worker.disconnect = MagicMock(side_effect=lambda: calls.append((name, "signal")))
        cast = SimpleNamespace(
            cast_info=SimpleNamespace(friendly_name=name, uuid=name, model_name="Receiver", manufacturer="Test"),
            socket_client=worker,
            wait=MagicMock(),
            disconnect=MagicMock(side_effect=lambda **_kw: calls.append((name, "disconnect"))),
            media_controller=SimpleNamespace(
                play_media=MagicMock(), block_until_active=MagicMock(),
                stop=MagicMock(), update_status=MagicMock(),
                status=SimpleNamespace(player_state="PLAYING"),
            ),
        )
        return cast

    selected = connection("Living Room TV", True)
    other = connection("Other TV", True)
    unopened = connection("Unopened TV", False)
    connections = [selected, other, unopened]
    browser = object()

    def stop_discovery(actual_browser):
        assert actual_browser is browser
        # Closing Zeroconf while any active connection can reconnect caused
        # the real worker's exception/retry loop and the 12 GB log.
        assert calls == [
            ("Living Room TV", "disconnect"), ("Other TV", "disconnect"),
            ("Unopened TV", "signal"),
        ]
        calls.append(("discovery", "stop"))

    module = SimpleNamespace(
        get_chromecasts=MagicMock(return_value=(connections, browser)),
        discovery=SimpleNamespace(stop_discovery=MagicMock(side_effect=stop_discovery)),
    )
    monkeypatch.setattr(media_cast.importlib, "import_module", lambda _name: module)
    monkeypatch.setattr(CastMediaClient, "_play_youtube_video", MagicMock())
    return SimpleNamespace(calls=calls, module=module, selected=selected, other=other, unopened=unopened)


@pytest.mark.parametrize("action", ["list_devices", "status", "stop", "show_image", "play_youtube"])
def test_cast_actions_close_all_connections_before_discovery(action, cast_connections):
    client = CastMediaClient(CastMediaSettings(timeout_s=0.5))
    arguments = {"show_image": {"image_url": "https://example.com/test.jpg"},
                 "play_youtube": {"video_id": "test"}}.get(action, {})

    result = getattr(client, action)(**arguments)

    assert result["status"] == "ok"
    cast_connections.selected.disconnect.assert_called_once_with(timeout=0.5)
    cast_connections.other.disconnect.assert_called_once_with(timeout=0.5)
    cast_connections.unopened.disconnect.assert_not_called()  # no joining an unstarted thread
    cast_connections.unopened.socket_client.disconnect.assert_called_once_with()
    assert cast_connections.calls[-1] == ("discovery", "stop")
    if action == "status":
        assert result["playback_active"] is True
        cast_connections.selected.media_controller.stop.assert_not_called()


def test_missing_cast_still_closes_every_discovered_connection(cast_connections):
    result = CastMediaClient().status(device_name="Missing TV")

    assert result["status"] == "error"
    cast_connections.selected.wait.assert_not_called()
    assert cast_connections.calls[-1] == ("discovery", "stop")


@pytest.mark.parametrize("action", ["status", "stop", "show_image", "play_youtube"])
def test_failed_cast_wait_still_closes_connections(action, cast_connections):
    cast_connections.selected.wait.side_effect = TimeoutError("receiver unavailable")
    arguments = {"show_image": {"image_url": "https://example.com/test.jpg"},
                 "play_youtube": {"video_id": "test"}}.get(action, {})

    result = getattr(CastMediaClient(), action)(**arguments)

    assert result["status"] == "error"
    assert "receiver unavailable" in result["error"]
    assert cast_connections.calls[-1] == ("discovery", "stop")


def test_device_payload_failure_still_cleans_up_discovery(monkeypatch, cast_connections):
    monkeypatch.setattr(CastMediaClient, "_device_payload", MagicMock(side_effect=ValueError("bad device")))

    with pytest.raises(ValueError, match="bad device"):
        CastMediaClient().status()

    assert cast_connections.calls[-1] == ("discovery", "stop")


def test_disconnect_failure_does_not_skip_other_connections(cast_connections, caplog):
    def fail_disconnect(**_kwargs):
        cast_connections.calls.append(("Living Room TV", "disconnect"))
        raise TimeoutError("join timed out after stop was signalled")

    cast_connections.selected.disconnect.side_effect = fail_disconnect

    result = CastMediaClient().status()

    assert result["status"] == "ok"
    assert cast_connections.calls[-1] == ("discovery", "stop")
    assert "Failed to disconnect Cast connection" in caplog.text

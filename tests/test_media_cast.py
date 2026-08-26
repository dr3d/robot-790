from types import SimpleNamespace
from unittest.mock import MagicMock

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
    fake_cast = SimpleNamespace(
        cast_info=SimpleNamespace(
            friendly_name="Living Room TV",
            host=SimpleNamespace(host="192.168.0.45", port=8009),
            model_name="Receiver",
            manufacturer="Test",
            uuid="uuid-1",
        ),
        wait=MagicMock(),
        register_handler=MagicMock(),
    )

    class FakeYoutubeController:
        def __init__(self, timeout: float) -> None:
            played["timeout"] = timeout

        def play_video(self, video_id: str) -> None:
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
        raise ModuleNotFoundError(name)

    monkeypatch.setattr(media_cast.importlib, "import_module", fake_import_module)

    result = CastMediaClient(CastMediaSettings(timeout_s=4.0)).play_youtube(video_id="video123")

    assert result["status"] == "ok"
    assert result["action"] == "play_youtube"
    assert played == {"timeout": 4.0, "video_id": "video123"}
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

from __future__ import annotations

import importlib
import logging
import os
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qs, urlparse

logger = logging.getLogger(__name__)

DEFAULT_CAST_DEVICE_NAME = "Living Room TV"
DEFAULT_CAST_TIMEOUT_S = 10.0
CAST_DEVICE_NAME_ENV = "ROBOT_790_CAST_DEVICE_NAME"
CAST_TIMEOUT_S_ENV = "ROBOT_790_CAST_TIMEOUT_S"
CAST_KNOWN_HOSTS_ENV = "ROBOT_790_CAST_KNOWN_HOSTS"

IMAGE_CONTENT_TYPES = {
    ".gif": "image/gif",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


@dataclass(frozen=True)
class CastMediaSettings:
    device_name: str = DEFAULT_CAST_DEVICE_NAME
    timeout_s: float = DEFAULT_CAST_TIMEOUT_S
    known_hosts: tuple[str, ...] = ()


def settings_from_env() -> CastMediaSettings:
    raw_timeout = os.getenv(CAST_TIMEOUT_S_ENV, "").strip()
    try:
        timeout_s = float(raw_timeout) if raw_timeout else DEFAULT_CAST_TIMEOUT_S
    except ValueError:
        logger.warning("Invalid %s=%r, using default.", CAST_TIMEOUT_S_ENV, raw_timeout)
        timeout_s = DEFAULT_CAST_TIMEOUT_S

    known_hosts = tuple(
        host.strip() for host in os.getenv(CAST_KNOWN_HOSTS_ENV, "").replace(";", ",").split(",") if host.strip()
    )
    return CastMediaSettings(
        device_name=os.getenv(CAST_DEVICE_NAME_ENV, DEFAULT_CAST_DEVICE_NAME).strip() or DEFAULT_CAST_DEVICE_NAME,
        timeout_s=timeout_s,
        known_hosts=known_hosts,
    )


def extract_youtube_video_id(value: str) -> str:
    candidate = value.strip()
    if not candidate:
        raise ValueError("Expected a YouTube video ID or URL.")

    parsed = urlparse(candidate)
    if not parsed.scheme and "/" not in candidate and "?" not in candidate:
        return candidate

    hostname = (parsed.hostname or "").lower()
    if hostname.endswith("youtu.be"):
        video_id = parsed.path.strip("/").split("/", maxsplit=1)[0]
    else:
        video_id = parse_qs(parsed.query).get("v", [""])[0]
        if not video_id and "/shorts/" in parsed.path:
            video_id = parsed.path.split("/shorts/", maxsplit=1)[1].split("/", maxsplit=1)[0]

    if not video_id:
        raise ValueError(f"Could not find a YouTube video ID in {value!r}.")
    return video_id


def image_content_type(image_url: str) -> str | None:
    path = urlparse(image_url).path.lower()
    for suffix, content_type in IMAGE_CONTENT_TYPES.items():
        if path.endswith(suffix):
            return content_type
    return None


def normalize_image_url(image_url: str) -> str:
    value = image_url.strip()
    if not value:
        return value
    # Wikimedia rejects a few thumbnail widths; 330px is usually available for commons thumbs.
    return value.replace("/287px-", "/330px-")


def _is_youtube_pairing_error(exc: Exception) -> bool:
    message = str(exc).casefold()
    return "get_lounge_token_batch" in message or "screen_ids parameter error" in message


class CastMediaClient:
    def __init__(self, settings: CastMediaSettings | None = None) -> None:
        self.settings = settings or settings_from_env()

    def list_devices(self) -> dict[str, object]:
        pychromecast = importlib.import_module("pychromecast")
        chromecasts, browser = pychromecast.get_chromecasts(
            timeout=self.settings.timeout_s,
            known_hosts=list(self.settings.known_hosts) or None,
        )
        try:
            return {"status": "ok", "tool": "cast_media", "action": "devices", "devices": [
                self._device_payload(cast) for cast in chromecasts
            ]}
        finally:
            pychromecast.discovery.stop_discovery(browser)

    def search_youtube(self, query: str, max_results: int = 3) -> dict[str, object]:
        results = self._search_youtube_entries(query, max_results)
        return {"status": "ok", "tool": "cast_media", "action": "search_youtube", "query": query, "results": results}

    def play_youtube(
        self,
        *,
        query: str | None = None,
        video_id: str | None = None,
        device_name: str | None = None,
    ) -> dict[str, object]:
        selected_video_id = extract_youtube_video_id(video_id) if video_id else None
        selected_result: dict[str, object] | None = None
        if not selected_video_id:
            if not query:
                return {"status": "error", "error": "Provide either query or video_id for YouTube playback."}
            results = self._search_youtube_entries(query, 1)
            if not results:
                return {"status": "error", "error": f"No YouTube results for {query!r}.", "query": query}
            selected_result = results[0]
            selected_video_id = str(selected_result["video_id"])

        pychromecast = importlib.import_module("pychromecast")
        cast, devices, browser = self._find_cast(device_name)
        try:
            if cast is None:
                target = device_name or self.settings.device_name
                return {
                    "status": "error",
                    "error": f"Cast device not found: {target}",
                    "target": target,
                    "devices": devices,
                }
            cast.wait(timeout=self.settings.timeout_s)
            youtube = importlib.import_module("pychromecast.controllers.youtube")
            try:
                self._play_youtube_video(cast, youtube, selected_video_id)
                recovered = False
            except Exception as exc:
                if not _is_youtube_pairing_error(exc):
                    raise
                logger.warning("Resetting Cast receiver after YouTube pairing failure: %s", exc)
                cast.quit_app(timeout=self.settings.timeout_s)
                time.sleep(1.0)
                cast.wait(timeout=self.settings.timeout_s)
                self._play_youtube_video(cast, youtube, selected_video_id)
                recovered = True
        except Exception as exc:
            logger.warning("Failed to cast YouTube video %s: %s", selected_video_id, exc)
            return {
                "status": "error",
                "error": f"Failed to cast YouTube video: {type(exc).__name__}: {exc}",
                "video_id": selected_video_id,
                "device": self._device_payload(cast),
                "result": selected_result,
            }
        finally:
            pychromecast.discovery.stop_discovery(browser)

        return {
            "status": "ok",
            "tool": "cast_media",
            "action": "play_youtube",
            "video_id": selected_video_id,
            "url": f"https://www.youtube.com/watch?v={selected_video_id}",
            "device": self._device_payload(cast),
            "result": selected_result,
            "recovered": recovered,
        }

    def show_image(
        self,
        *,
        image_url: str,
        title: str | None = None,
        device_name: str | None = None,
    ) -> dict[str, object]:
        selected_image_url = normalize_image_url(image_url)
        parsed_image_url = urlparse(selected_image_url)
        content_type = image_content_type(selected_image_url)
        if parsed_image_url.scheme not in {"http", "https"} or not parsed_image_url.netloc or content_type is None:
            return {
                "status": "error",
                "error": "Provide a direct HTTP or HTTPS image URL ending in jpg, jpeg, png, webp, or gif.",
            }

        pychromecast = importlib.import_module("pychromecast")
        cast, devices, browser = self._find_cast(device_name)
        try:
            if cast is None:
                target = device_name or self.settings.device_name
                return {
                    "status": "error",
                    "error": f"Cast device not found: {target}",
                    "target": target,
                    "devices": devices,
                }
            cast.wait(timeout=self.settings.timeout_s)
            display_title = title.strip()[:80] if title else "Robot 790 image"
            cast.media_controller.play_media(
                selected_image_url,
                content_type,
                title=display_title,
                thumb=selected_image_url,
                stream_type="BUFFERED",
                metadata={
                    "metadataType": 4,
                    "title": display_title,
                    "images": [{"url": selected_image_url}],
                },
            )
            cast.media_controller.block_until_active(timeout=self.settings.timeout_s)
        except Exception as exc:
            logger.warning("Failed to cast image %s: %s", selected_image_url, exc)
            return {
                "status": "error",
                "error": f"Failed to cast image: {type(exc).__name__}: {exc}",
                "image_url": selected_image_url,
                "device": self._device_payload(cast),
                "receiver_status": self._media_status_payload(cast),
            }
        finally:
            pychromecast.discovery.stop_discovery(browser)

        return {
            "status": "ok",
            "tool": "cast_media",
            "action": "show_image",
            "image_url": selected_image_url,
            "content_type": content_type,
            "title": title.strip()[:80] if title else None,
            "device": self._device_payload(cast),
            "receiver_status": self._media_status_payload(cast),
        }

    def stop(self, device_name: str | None = None) -> dict[str, object]:
        pychromecast = importlib.import_module("pychromecast")
        cast, devices, browser = self._find_cast(device_name)
        try:
            if cast is None:
                target = device_name or self.settings.device_name
                return {
                    "status": "error",
                    "error": f"Cast device not found: {target}",
                    "target": target,
                    "devices": devices,
                }
            cast.wait(timeout=self.settings.timeout_s)
            try:
                cast.media_controller.stop()
            except Exception:
                cast.quit_app(timeout=self.settings.timeout_s)
        except Exception as exc:
            logger.warning("Failed to stop Cast playback: %s", exc)
            return {"status": "error", "error": f"Failed to stop Cast playback: {type(exc).__name__}: {exc}"}
        finally:
            pychromecast.discovery.stop_discovery(browser)

        return {"status": "ok", "tool": "cast_media", "action": "stop", "device": self._device_payload(cast)}

    def _find_cast(self, device_name: str | None) -> tuple[Any | None, list[dict[str, object]], Any]:
        pychromecast = importlib.import_module("pychromecast")
        target = (device_name or self.settings.device_name).strip().casefold()
        chromecasts, browser = pychromecast.get_chromecasts(
            timeout=self.settings.timeout_s,
            known_hosts=list(self.settings.known_hosts) or None,
        )
        devices = [self._device_payload(cast) for cast in chromecasts]
        for cast in chromecasts:
            if str(cast.cast_info.friendly_name).casefold() == target:
                return cast, devices, browser
        return None, devices, browser

    def _play_youtube_video(self, cast: Any, youtube: Any, video_id: str) -> None:
        controller = youtube.YouTubeController(timeout=self.settings.timeout_s)
        cast.register_handler(controller)
        controller.play_video(video_id)

    def _search_youtube_entries(self, query: str, max_results: int) -> list[dict[str, object]]:
        if not query.strip():
            raise ValueError("YouTube search query is required.")

        ytdlp = importlib.import_module("yt_dlp")
        result_count = max(1, min(int(max_results), 5))
        options = {"quiet": True, "extract_flat": True, "skip_download": True, "noplaylist": True}
        with ytdlp.YoutubeDL(options) as downloader:
            payload = downloader.extract_info(f"ytsearch{result_count}:{query}", download=False)

        entries = payload.get("entries") if isinstance(payload, dict) else []
        results: list[dict[str, object]] = []
        for entry in entries or []:
            if not isinstance(entry, dict):
                continue
            video_id = str(entry.get("id") or "").strip()
            if not video_id:
                continue
            results.append(
                {
                    "video_id": video_id,
                    "title": entry.get("title"),
                    "channel": entry.get("channel") or entry.get("uploader"),
                    "duration_s": entry.get("duration"),
                    "url": entry.get("url") or f"https://www.youtube.com/watch?v={video_id}",
                }
            )
        return results

    def _device_payload(self, cast: Any) -> dict[str, object]:
        cast_info = cast.cast_info
        host = getattr(cast_info, "host", None)
        return {
            "name": cast_info.friendly_name,
            "host": getattr(host, "host", host),
            "port": getattr(host, "port", None),
            "model": cast_info.model_name,
            "manufacturer": cast_info.manufacturer,
            "uuid": str(cast_info.uuid),
        }

    def _media_status_payload(self, cast: Any) -> dict[str, object]:
        status = getattr(getattr(cast, "media_controller", None), "status", None)
        if status is None:
            return {}
        return {
            "player_state": getattr(status, "player_state", None),
            "idle_reason": getattr(status, "idle_reason", None),
            "media_session_id": getattr(status, "media_session_id", None),
            "content_id": getattr(status, "content_id", None),
            "content_type": getattr(status, "content_type", None),
            "stream_type": getattr(status, "stream_type", None),
        }

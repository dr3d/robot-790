"""Bounded still-frame access to the operator-configured ESP32 camera."""

import threading
import time
from urllib.parse import urlsplit

import httpx

MAX_FRAME_BYTES = 2 * 1024 * 1024
FRAME_LOCK = threading.Lock()


def camera_config(value: object) -> dict[str, object]:
    raw = value if isinstance(value, dict) else {}
    base_url = str(raw.get("base_url", "http://esp32-cam.local/")).strip()
    url = urlsplit(base_url)
    if (url.scheme not in {"http", "https"} or not url.hostname or url.username or url.password
            or url.path not in {"", "/"} or url.query or url.fragment):
        raise ValueError("ESP32 camera base_url must be an HTTP origin without credentials or a path.")
    rotation = raw.get("rotation_degrees", -90)
    if type(rotation) is not int or rotation not in {-90, 0, 90, 180}:
        raise ValueError("ESP32 camera rotation_degrees must be -90, 0, 90, or 180.")
    interval = raw.get("preview_interval_ms", 1000)
    if type(interval) is not int or not 500 <= interval <= 10000:
        raise ValueError("ESP32 camera preview_interval_ms must be 500..10000.")
    return {"enabled": raw.get("enabled") is True, "base_url": base_url.rstrip("/") + "/",
            "rotation_degrees": rotation, "preview_interval_ms": interval}


def capture_frame(config: dict[str, object], *, client: httpx.Client | None = None) -> bytes:
    if config.get("enabled") is not True:
        raise ValueError("ESP32 camera is disabled in runtime configuration.")
    if not FRAME_LOCK.acquire(blocking=False):
        raise RuntimeError("ESP32 camera is busy with another snapshot. Try again shortly.")
    owned_client = client is None
    try:
        client = client or httpx.Client(timeout=5.0, trust_env=False, follow_redirects=False)
        started = time.monotonic()
        # No caller-supplied URL/path and no redirect following: this is not a general proxy.
        with client.stream("GET", str(config["base_url"]) + "jpg", follow_redirects=False) as response:
            response.raise_for_status()
            if response.headers.get("content-type", "").split(";", 1)[0].strip() != "image/jpeg":
                raise ValueError("ESP32 camera did not return a JPEG frame.")
            body = bytearray()
            for chunk in response.iter_bytes(chunk_size=16384):
                body.extend(chunk)
                if len(body) > MAX_FRAME_BYTES or time.monotonic() - started > 8:
                    raise ValueError("ESP32 camera frame exceeded the size or time limit.")
        if not body.startswith(b"\xff\xd8") or not body.endswith(b"\xff\xd9"):
            raise ValueError("ESP32 camera returned an incomplete JPEG frame.")
        return bytes(body)
    finally:
        if owned_client and client is not None:
            client.close()
        FRAME_LOCK.release()

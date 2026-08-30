import logging
from dataclasses import dataclass
from urllib.parse import urljoin

import httpx

logger = logging.getLogger(__name__)

DEFAULT_FACE_URL = "http://esp32-eyes.local/"
DEFAULT_TIMEOUT_S = 0.8


@dataclass(frozen=True)
class FaceSettings:
    base_url: str = DEFAULT_FACE_URL
    timeout_s: float = DEFAULT_TIMEOUT_S


class Esp32FaceClient:
    """HTTP client for the ESP32 face controller."""

    def __init__(self, settings: FaceSettings, http_client: httpx.Client | None = None) -> None:
        self._base_url = settings.base_url.rstrip("/") + "/"
        self._client = http_client or httpx.Client(timeout=settings.timeout_s)

    def state(self) -> dict[str, object]:
        return self._request("GET", "state")

    def control(self, payload: dict[str, object]) -> dict[str, object]:
        return self._request("POST", "control", payload)

    def emotion(
        self,
        name: str,
        duration_s: float | None = None,
        color: str | None = None,
    ) -> dict[str, object]:
        payload: dict[str, object] = {"name": name}
        if duration_s is not None:
            payload["duration"] = duration_s
        if color:
            payload["color"] = color
        return self._request("POST", "emotion", payload)

    def expression(self, name: str, duration_s: float) -> dict[str, object]:
        return self._request("POST", "expression", {"name": name, "duration": duration_s})

    def beat(self, name: str) -> dict[str, object]:
        return self._request("POST", "beat", {"name": name})

    def style(self, name: str) -> dict[str, object]:
        return self._request("POST", "style", {"name": name})

    def mouth(
        self,
        style: str | None = None,
        shape: str | None = None,
        talking: bool | None = None,
        energy: float | None = None,
        duration_s: float | None = None,
        auto: bool = False,
    ) -> dict[str, object]:
        payload: dict[str, object] = {}
        if auto:
            payload["auto"] = True
        if style:
            payload["style"] = style
        if shape:
            payload["shape"] = shape
        if talking is not None:
            payload["talking"] = talking
        if energy is not None:
            payload["energy"] = energy
        if duration_s is not None:
            payload["duration"] = duration_s
        return self._request("POST", "mouth", payload)

    def gaze(
        self,
        x: float,
        y: float,
        duration_s: float = 1.2,
        move_ms: int = 160,
    ) -> dict[str, object]:
        return self._request(
            "POST",
            "gaze",
            {"x": x, "y": y, "duration": duration_s, "move_ms": move_ms},
        )

    def gaze_auto(self) -> dict[str, object]:
        return self._request("POST", "gaze", {"gaze": "auto"})

    def sleep(self, duration_s: float = 0.0) -> dict[str, object]:
        return self._request("POST", "sleep", {"duration": duration_s})

    def release(self) -> dict[str, object]:
        return self._request("POST", "release", {})

    def close(self) -> None:
        self._client.close()

    def _request(
        self,
        method: str,
        path: str,
        payload: dict[str, object] | None = None,
    ) -> dict[str, object]:
        url = urljoin(self._base_url, path)
        try:
            response = self._client.request(method, url, json=payload)
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            logger.warning("ESP32 face request failed: %s %s: %s", method, url, exc)
            return {"error": f"{type(exc).__name__}: {exc}", "url": url}
        if isinstance(data, dict):
            if data.get("ok") is False:
                return {"error": str(data.get("error", "ESP32 face returned ok=false")), "url": url, "response": data}
            return {"status": "ok", "url": url, "response": data}
        return {"error": "ESP32 face returned a non-object response", "url": url, "response": data}

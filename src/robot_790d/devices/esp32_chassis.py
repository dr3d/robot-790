import logging
from dataclasses import dataclass
from urllib.parse import urljoin

import httpx

logger = logging.getLogger(__name__)

DEFAULT_CHASSIS_URL = "http://esp32-chassis.local/"
DEFAULT_TIMEOUT_S = 0.8


@dataclass(frozen=True)
class ChassisSettings:
    base_url: str = DEFAULT_CHASSIS_URL
    timeout_s: float = DEFAULT_TIMEOUT_S


class Esp32ChassisClient:
    """HTTP client for the ESP32 tracked chassis controller."""

    def __init__(self, settings: ChassisSettings, http_client: httpx.Client | None = None) -> None:
        self._base_url = settings.base_url.rstrip("/") + "/"
        self._client = http_client or httpx.Client(timeout=settings.timeout_s)

    def status(self) -> dict[str, object]:
        return self._request("GET", "api/status")

    def tank(self, left: float, right: float, duration_s: float | None = None) -> dict[str, object]:
        params: dict[str, object] = {"left": left, "right": right}
        if duration_s is not None:
            params["duration_ms"] = int(duration_s * 1000)
        return self._request("POST", "api/tank", params=params)

    def twist(self, velocity: float, turn: float, duration_s: float | None = None) -> dict[str, object]:
        params: dict[str, object] = {"v": velocity, "w": turn}
        if duration_s is not None:
            params["duration_ms"] = int(duration_s * 1000)
        return self._request("POST", "api/twist", params=params)

    def stop(self) -> dict[str, object]:
        return self._request("POST", "api/stop")

    def estop(self) -> dict[str, object]:
        return self._request("POST", "api/estop")

    def clear(self) -> dict[str, object]:
        return self._request("POST", "api/clear")

    def close(self) -> None:
        self._client.close()

    def _request(
        self,
        method: str,
        path: str,
        params: dict[str, object] | None = None,
    ) -> dict[str, object]:
        url = urljoin(self._base_url, path)
        try:
            response = self._client.request(method, url, params=params)
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            logger.warning("ESP32 chassis request failed: %s %s: %s", method, url, exc)
            return {"error": f"{type(exc).__name__}: {exc}", "url": url}
        if isinstance(data, dict):
            if data.get("ok") is False:
                return {
                    "error": str(data.get("error", "ESP32 chassis returned ok=false")),
                    "url": url,
                    "response": data,
                }
            return {"status": "ok", "url": url, "response": data}
        return {"error": "ESP32 chassis returned a non-object response", "url": url, "response": data}

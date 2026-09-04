from __future__ import annotations

import argparse
import json
import time
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlsplit

import httpx

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8792
DEFAULT_REACHY_URL = "http://reachy-mini.local:8000/"


@dataclass(frozen=True)
class ReachyAdapterSettings:
    daemon_url: str = DEFAULT_REACHY_URL
    allow_motion: bool = False
    timeout_s: float = 2.0


class ReachyAdapterState:
    def __init__(self, host: str, port: int, settings: ReachyAdapterSettings) -> None:
        self.started_at = time.time()
        self.host = host
        self.port = port
        self.settings = settings
        self.client = httpx.Client(base_url=settings.daemon_url.rstrip("/") + "/", timeout=settings.timeout_s)
        self.mood = "curious"
        self.mouth: dict[str, Any] = {
            "present": False,
            "display_role": "reachy_motion",
            "style": "gesture",
            "shape": "neutral",
            "manual": False,
            "talking": False,
            "energy": 0.35,
            "text_active": False,
            "text": "",
        }
        self.gaze = {"manual": False, "now": {"x": 0.0, "y": 0.0, "z": 0.0}, "target": {"x": 0.0, "y": 0.0, "z": 0.0}}
        self.director = "none"
        self.last_error = ""
        self.last_daemon_state: dict[str, Any] = {}

    def snapshot(self) -> dict[str, Any]:
        daemon = self._get("api/daemon/status")
        full_state = self._get("api/state/full")
        motor_status = self._get("api/motors/status")
        media_status = self._get("api/media/status")
        if isinstance(full_state, dict):
            self.last_daemon_state = full_state
        reachable = not _has_error(daemon)
        daemon_body = daemon if isinstance(daemon, dict) else {}
        full_body = full_state if isinstance(full_state, dict) else {}
        motor_body = motor_status if isinstance(motor_status, dict) else {}
        media_body = media_status if isinstance(media_status, dict) else {}
        return {
            "ok": reachable,
            "running": reachable,
            "name": "Robot 790 Reachy Mini Adapter",
            "hostname": "reachy-mini",
            "mdns_url": f"http://{self.host}:{self.port}/",
            "ip": self.host,
            "wifi_mode": "adapter",
            "firmware": {
                "target": "reachy-mini-embodiment-adapter",
                "version": "0.1.0",
                "features": "state,gaze,mood,beats,sleep,release,reachy_daemon_proxy,motion_gated",
            },
            "uptime_ms": int((time.time() - self.started_at) * 1000),
            "message": "reachy adapter ready" if reachable else "reachy daemon unreachable",
            "motion_enabled": self.settings.allow_motion,
            "daemon": _compact(daemon_body),
            "reachy": {
                "daemon_url": self.settings.daemon_url,
                "daemon_version": daemon_body.get("version"),
                "robot_name": daemon_body.get("robot_name"),
                "wireless_version": daemon_body.get("wireless_version"),
                "wlan_ip": daemon_body.get("wlan_ip"),
                "backend_ready": (daemon_body.get("backend_status") or {}).get("ready")
                if isinstance(daemon_body.get("backend_status"), dict)
                else None,
                "motor_mode": motor_body.get("mode") or full_body.get("control_mode"),
                "media_available": media_body.get("available"),
                "media_released": media_body.get("released"),
                "face_target": daemon_body.get("face_target"),
            },
            "mood": self.mood,
            "eye_mood": self.mood,
            "style": "reachy",
            "mouth": self.mouth,
            "director": self.director,
            "touch": False,
            "imu": bool(daemon_body.get("wireless_version")),
            "camera": True,
            "display": False,
            "eyes": False,
            "external_eyes": False,
            "gaze": self._state_gaze(full_body),
            "head_pose": full_body.get("head_pose"),
            "body_yaw": full_body.get("body_yaw"),
            "antennas_position": full_body.get("antennas_position"),
            "doa": full_body.get("doa"),
            "last_error": self.last_error,
            "updated_at": time.time(),
        }

    def release(self) -> dict[str, Any]:
        self.director = "release"
        self.mood = "curious"
        self.gaze = {
            "manual": False,
            "now": {"x": 0.0, "y": 0.0, "z": 0.0},
            "target": {"x": 0.0, "y": 0.0, "z": 0.0},
        }
        return self.snapshot()

    def sleep(self) -> dict[str, Any]:
        self.director = "sleep"
        self.mood = "sleep"
        if self.settings.allow_motion:
            self._post("api/move/play/goto_sleep", {})
        return self.snapshot()

    def set_mood(self, name: str) -> dict[str, Any]:
        self.mood = _clean_token(name, "curious")
        self.director = f"mood:{self.mood}"
        if self.settings.allow_motion and self.mood in {"happy", "curious", "focused", "confused", "sleepy", "sleep"}:
            self._post("api/move/goto", _goto_payload_for_mood(self.mood))
        return self.snapshot()

    def set_gaze(self, payload: dict[str, Any]) -> dict[str, Any]:
        if str(payload.get("gaze") or "").lower() == "auto" or payload.get("auto") is True:
            self.gaze["manual"] = False
            self.director = "gaze:auto"
            return self.snapshot()
        x = _clamp_float(payload.get("x"), -1.0, 1.0, 0.0)
        y = _clamp_float(payload.get("y"), -1.0, 1.0, 0.0)
        self.gaze = {"manual": True, "now": {"x": x, "y": y, "z": 0.0}, "target": {"x": x, "y": y, "z": 0.0}}
        self.director = "gaze"
        if self.settings.allow_motion:
            self._post("api/move/goto", _goto_payload_for_gaze(x, y))
        return self.snapshot()

    def set_mouth(self, payload: dict[str, Any]) -> dict[str, Any]:
        if payload.get("auto") is True or payload.get("clear") is True:
            self.mouth.update({"manual": False, "talking": False, "text_active": False, "text": ""})
            return self.snapshot()
        if "shape" in payload and payload["shape"]:
            self.mouth["shape"] = _clean_token(payload["shape"], "neutral")
        if "talking" in payload:
            self.mouth["talking"] = bool(payload["talking"])
        if "energy" in payload:
            self.mouth["energy"] = _clamp_float(payload["energy"], 0.0, 1.0, 0.35)
        if "text" in payload:
            text = str(payload.get("text") or "")[:180]
            self.mouth["text"] = text
            self.mouth["text_active"] = bool(text)
        self.mouth["manual"] = True
        self.director = "mouth"
        return self.snapshot()

    def beat(self, name: str) -> dict[str, Any]:
        beat = _clean_token(name, "thoughtful")
        self.director = beat
        self.mood = {
            "slow_smile": "happy",
            "affection": "happy",
            "inspect": "focused",
            "thoughtful": "curious",
            "daydream": "curious",
            "mischief": "mischief",
            "confused": "confused",
            "focus_lock": "focused",
            "double_take": "surprised",
            "goofy": "goofy",
            "drowsy": "sleepy",
            "robot_scan": "focused",
            "wary": "suspicious",
            "startle": "surprised",
        }.get(beat, "curious")
        if self.settings.allow_motion:
            self._post("api/move/goto", _goto_payload_for_beat(beat))
        return self.snapshot()

    def control(self, payload: dict[str, Any]) -> dict[str, Any]:
        if payload.get("sleep") is True:
            return self.sleep()
        if payload.get("release") is True:
            return self.release()
        mood = payload.get("emotion") or payload.get("expression") or payload.get("mood") or payload.get("name")
        if mood:
            return self.set_mood(str(mood))
        if isinstance(payload.get("gaze"), dict):
            return self.set_gaze(payload["gaze"])
        if isinstance(payload.get("mouth"), dict):
            return self.set_mouth(payload["mouth"])
        return self.snapshot()

    def _state_gaze(self, full_state: dict[str, Any]) -> dict[str, Any]:
        if self.gaze["manual"]:
            return self.gaze
        pose = full_state.get("head_pose") if isinstance(full_state, dict) else None
        if not isinstance(pose, dict):
            return self.gaze
        x = _clamp_float(pose.get("yaw"), -0.6, 0.6, 0.0) / 0.6
        y = _clamp_float(pose.get("pitch"), -0.6, 0.6, 0.0) / 0.6
        target = {"x": x, "y": y, "z": 0.0}
        return {"manual": False, "now": target, "target": target}

    def _get(self, path: str) -> Any:
        try:
            response = self.client.get(path)
            response.raise_for_status()
            self.last_error = ""
            return response.json()
        except Exception as exc:
            self.last_error = f"{type(exc).__name__}: {exc}"
            return {"error": self.last_error}

    def _post(self, path: str, payload: dict[str, Any]) -> Any:
        try:
            response = self.client.post(path, json=payload)
            response.raise_for_status()
            self.last_error = ""
            return response.json()
        except Exception as exc:
            self.last_error = f"{type(exc).__name__}: {exc}"
            return {"error": self.last_error}


class ReachyAdapterHandler(BaseHTTPRequestHandler):
    adapter_state: ReachyAdapterState

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlsplit(self.path)
        if parsed.path in {"/", "/state", "/api/status", "/status"}:
            self._send_json(200, self.adapter_state.snapshot())
            return
        if parsed.path in {"/moods", "/mouth_shapes", "/mouth_styles", "/styles", "/eye_modes", "/beats"}:
            self._send_json(200, _list_payload(parsed.path))
            return
        self._send_json(404, {"ok": False, "error": "unknown endpoint"})

    def do_POST(self) -> None:
        parsed = urlsplit(self.path)
        payload = self._read_json()
        if parsed.path in {"/control", "/api/control"}:
            self._send_json(200, self.adapter_state.control(payload))
            return
        if parsed.path in {"/mood", "/emotion", "/expression"}:
            name = str(
                payload.get("name")
                or payload.get("mood")
                or payload.get("emotion")
                or payload.get("expression")
                or ""
            )
            self._send_json(200, self.adapter_state.set_mood(name))
            return
        if parsed.path == "/gaze":
            self._send_json(200, self.adapter_state.set_gaze(payload))
            return
        if parsed.path == "/mouth":
            self._send_json(200, self.adapter_state.set_mouth(payload))
            return
        if parsed.path == "/release":
            self._send_json(200, self.adapter_state.release())
            return
        if parsed.path == "/sleep":
            self._send_json(200, self.adapter_state.sleep())
            return
        if parsed.path == "/beat":
            self._send_json(200, self.adapter_state.beat(str(payload.get("name") or payload.get("beat") or "")))
            return
        if parsed.path == "/style":
            self._send_json(200, self.adapter_state.snapshot())
            return
        self._send_json(404, {"ok": False, "error": "unknown endpoint"})

    def log_message(self, format: str, *args: object) -> None:
        return

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0:
            return {}
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except json.JSONDecodeError:
            return {}
        return data if isinstance(data, dict) else {}

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def _goto_payload_for_gaze(x: float, y: float) -> dict[str, Any]:
    return {
        "head_pose": {"x": 0.0, "y": 0.0, "z": 0.0, "roll": 0.0, "pitch": y * 0.25, "yaw": x * 0.35},
        "duration": 0.8,
        "interpolation": "minjerk",
    }


def _goto_payload_for_mood(mood: str) -> dict[str, Any]:
    return _goto_payload_for_beat(
        {
            "happy": "slow_smile",
            "curious": "thoughtful",
            "focused": "focus_lock",
            "confused": "confused",
            "sleepy": "drowsy",
            "sleep": "drowsy",
        }.get(mood, "thoughtful")
    )


def _goto_payload_for_beat(beat: str) -> dict[str, Any]:
    head = {"x": 0.0, "y": 0.0, "z": 0.0, "roll": 0.0, "pitch": 0.0, "yaw": 0.0}
    antennas = [0.0, 0.0]
    body_yaw: float | None = None
    if beat == "inspect":
        head.update({"pitch": 0.12, "yaw": -0.25})
    elif beat == "thoughtful":
        head.update({"roll": -0.12, "pitch": 0.08})
    elif beat == "slow_smile":
        head.update({"pitch": -0.08})
        antennas = [0.25, -0.25]
    elif beat == "double_take":
        head.update({"yaw": 0.35})
        antennas = [0.35, 0.35]
    elif beat == "focus_lock":
        head.update({"pitch": 0.06})
    elif beat == "confused":
        head.update({"roll": 0.18})
        antennas = [-0.15, 0.15]
    elif beat == "drowsy":
        head.update({"pitch": 0.22})
        antennas = [-0.35, 0.35]
    elif beat == "robot_scan":
        body_yaw = 0.18
    return {"head_pose": head, "antennas": antennas, "body_yaw": body_yaw, "duration": 0.8, "interpolation": "minjerk"}


def _clean_token(value: object, fallback: str) -> str:
    text = str(value or "").strip().lower().replace(" ", "_").replace("-", "_")
    return text or fallback


def _clamp_float(value: object, low: float, high: float, fallback: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    return max(low, min(high, number))


def _compact(value: dict[str, Any]) -> dict[str, Any]:
    return json.loads(json.dumps(value)) if isinstance(value, dict) else {}


def _has_error(value: object) -> bool:
    return isinstance(value, dict) and bool(value.get("error"))


def _list_payload(path: str) -> dict[str, Any]:
    values = {
        "/moods": ["curious", "happy", "focused", "confused", "sleepy", "sleep", "mischief", "surprised"],
        "/mouth_shapes": ["neutral", "open", "smile", "sleep"],
        "/mouth_styles": ["gesture"],
        "/styles": ["reachy"],
        "/eye_modes": ["normal"],
        "/beats": [
            "slow_smile",
            "inspect",
            "thoughtful",
            "mischief",
            "confused",
            "focus_lock",
            "double_take",
            "drowsy",
            "robot_scan",
            "wary",
            "startle",
        ],
    }.get(path, [])
    return {"ok": True, path.strip("/") or "values": values}


def main() -> None:
    parser = argparse.ArgumentParser(description="Robot 790 Reachy Mini embodiment adapter.")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--daemon-url", default=DEFAULT_REACHY_URL)
    parser.add_argument("--allow-motion", action="store_true")
    parser.add_argument("--timeout", type=float, default=2.0)
    args = parser.parse_args()

    settings = ReachyAdapterSettings(
        daemon_url=args.daemon_url,
        allow_motion=args.allow_motion,
        timeout_s=args.timeout,
    )
    handler = type("ConfiguredReachyAdapterHandler", (ReachyAdapterHandler,), {})
    handler.adapter_state = ReachyAdapterState(args.host, args.port, settings)
    server = ThreadingHTTPServer((args.host, args.port), handler)
    mode = "motion enabled" if args.allow_motion else "motion gated"
    print(f"Robot 790 Reachy Mini adapter: http://{args.host}:{args.port}/ ({mode})", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()

from __future__ import annotations

import argparse
import json
import re
import shutil
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit


WEB_ROOT = Path(__file__).resolve().parents[2] / "web" / "face-sim"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8791
EYE_MODES = {"normal", "crossed", "swapped", "googly"}
BROWSER_FACE_RECORDING_URL_PREFIX = "/recorded-face/"
MAX_BROWSER_FACE_RECORDING_BYTES = 250 * 1024 * 1024


def _default_state() -> dict[str, Any]:
    return {
        "ok": True,
        "running": True,
        "name": "Robot 790 Browser Face",
        "hostname": "browser-face",
        "mdns_url": f"http://{DEFAULT_HOST}:{DEFAULT_PORT}/",
        "ip": DEFAULT_HOST,
        "wifi_mode": "simulated",
        "firmware": {
            "target": "browser-face-sim",
            "version": "0.1.0",
            "features": "state,mood,gaze,eye_modes,mouth,nose_glow,idle_canvas,cors",
        },
        "uptime_ms": 0,
        "free_heap": 0,
        "psram": False,
        "display": True,
        "display_flipped": False,
        "display_rotation": 0,
        "eyes": True,
        "external_eyes": False,
        "integrated_viewports": True,
        "idle": True,
        "eyes_animate": True,
        "autonomous": True,
        "mood": "curious",
        "eye_mood": "curious",
        "style": "robot",
        "eye_mode": "normal",
        "mood_override": False,
        "gaze_override": False,
        "status_tint_override": False,
        "sleeping": False,
        "director": "none",
        "touch": False,
        "imu": False,
        "sd": False,
        "camera": False,
        "backlight": 255,
        "message": "browser face ready",
        "mouth": {
            "present": True,
            "buffered": True,
            "display_role": "browser_face",
            "style": "human",
            "shape": "neutral",
            "manual": False,
            "talking": False,
            "energy": 0.45,
            "talk_level": 0,
            "text_active": False,
            "text": "",
            "text_mode": "",
            "text_color": "",
        },
        "wifi": {
            "mode": "simulated",
            "connected": True,
            "ip": DEFAULT_HOST,
            "hostname": "browser-face",
            "mdns_url": f"http://{DEFAULT_HOST}:{DEFAULT_PORT}/",
        },
        "gaze": {
            "manual": False,
            "now": {"x": 0.0, "y": 0.0, "z": 420.0},
            "target": {"x": 0.0, "y": 0.0, "z": 420.0},
        },
        "blink": {
            "active": False,
            "wink": False,
            "eye": "both",
            "duration_ms": 180,
            "remaining_ms": 0,
        },
        "updated_at": time.time(),
    }


class FaceSimState:
    def __init__(self, host: str, port: int) -> None:
        self.started_at = time.time()
        self.command_lock = threading.Lock()
        self.commands: list[dict[str, Any]] = []
        self.state = _default_state()
        url = f"http://{host}:{port}/"
        self.state["mdns_url"] = url
        self.state["ip"] = host
        self.state["wifi"]["ip"] = host
        self.state["wifi"]["mdns_url"] = url

    def snapshot(self) -> dict[str, Any]:
        state = json.loads(json.dumps(self.state))
        state["uptime_ms"] = int((time.time() - self.started_at) * 1000)
        return state

    def queue_capture_to_eye(self, payload: dict[str, Any]) -> dict[str, Any]:
        command = {
            "seq": time.time_ns(),
            "type": "capture_to_eye",
            "created_at": time.time(),
            "sts_url": str(payload.get("sts_url") or "http://127.0.0.1:8790/").strip(),
            "reason": str(payload.get("reason") or "").strip()[:160],
        }
        with self.command_lock:
            self.commands.append(command)
            self.commands = self.commands[-50:]
        self._touch()
        return {
            "ok": True,
            "tool": "capture_browser_face_to_eye",
            "queued": True,
            "seq": command["seq"],
            "message": "browser face capture queued",
        }

    def list_commands(self, after: int = 0, limit: int = 10) -> dict[str, Any]:
        safe_after = max(0, int(after or 0))
        safe_limit = max(1, min(50, int(limit or 10)))
        with self.command_lock:
            commands = [command for command in self.commands if int(command.get("seq") or 0) > safe_after][:safe_limit]
            latest_seq = int(self.commands[-1]["seq"]) if self.commands else safe_after
        return {
            "ok": True,
            "commands": commands,
            "latest_seq": commands[-1]["seq"] if commands else latest_seq,
        }

    def release(self) -> dict[str, Any]:
        self.state["idle"] = True
        self.state["eyes_animate"] = True
        self.state["autonomous"] = True
        self.state["mood_override"] = False
        self.state["gaze_override"] = False
        self.state["sleeping"] = False
        self.state["director"] = "none"
        self.state["mouth"]["manual"] = False
        self.state["mouth"]["talking"] = False
        self.state["mouth"]["shape"] = "neutral"
        self.state["mouth"]["energy"] = 0.45
        self.state["mouth"]["text_active"] = False
        self.state["mouth"]["text"] = ""
        target = {"x": 0.0, "y": 0.0, "z": 420.0}
        self.state["gaze"]["manual"] = False
        self.state["gaze"]["now"] = target
        self.state["gaze"]["target"] = target
        self._touch()
        return self.snapshot()

    def sleep(self) -> dict[str, Any]:
        self.state["sleeping"] = True
        self.state["autonomous"] = False
        self.state["mood"] = "sleep"
        self.state["eye_mood"] = "sleep"
        self.state["mouth"]["shape"] = "sleep"
        self.state["mouth"]["talking"] = False
        self.state["mouth"]["manual"] = False
        self._touch()
        return self.snapshot()

    def set_mood(self, name: str, color: str = "") -> dict[str, Any]:
        mood = _clean_token(name, fallback="curious")
        self.state["sleeping"] = mood == "sleep"
        self.state["autonomous"] = False
        self.state["mood_override"] = True
        self.state["mood"] = mood
        self.state["eye_mood"] = mood
        if color:
            self._set_color(color)
        self._touch()
        return self.snapshot()

    def set_style(self, name: str = "", eye_mode: str = "") -> dict[str, Any]:
        if name:
            self.state["style"] = _clean_token(name, fallback="robot")
        if eye_mode:
            self.state["eye_mode"] = _clean_eye_mode(eye_mode)
        self._touch()
        return self.snapshot()

    def set_gaze(self, payload: dict[str, Any]) -> dict[str, Any]:
        if str(payload.get("gaze") or "").lower() == "auto" or payload.get("auto") is True:
            self.state["gaze_override"] = False
            self.state["gaze"]["manual"] = False
            self._touch()
            return self.snapshot()
        x = _clamp_float(payload.get("x"), -1.0, 1.0, 0.0) * 64.6
        y = _clamp_float(payload.get("y"), -1.0, 1.0, 0.0) * 48.0
        target = {"x": x, "y": y, "z": 420.0}
        self.state["gaze_override"] = True
        self.state["gaze"]["manual"] = True
        self.state["gaze"]["now"] = target
        self.state["gaze"]["target"] = target
        self._touch()
        return self.snapshot()

    def set_mouth(self, payload: dict[str, Any]) -> dict[str, Any]:
        mouth = self.state["mouth"]
        if payload.get("auto") is True:
            mouth["manual"] = False
            mouth["talking"] = False
            mouth["text_active"] = False
            mouth["text"] = ""
            self._touch()
            return self.snapshot()
        if "style" in payload and payload["style"]:
            mouth["style"] = _clean_token(payload["style"], fallback="human")
        if "shape" in payload and payload["shape"]:
            mouth["shape"] = _clean_token(payload["shape"], fallback="neutral")
        if "talking" in payload:
            mouth["talking"] = bool(payload["talking"])
        if "energy" in payload:
            mouth["energy"] = _clamp_float(payload["energy"], 0.0, 1.0, 0.45)
        if "text" in payload:
            text = str(payload.get("text") or "")[:180]
            mouth["text"] = text
            mouth["text_active"] = bool(text)
            mouth["text_mode"] = str(payload.get("mode") or payload.get("text_mode") or "center")
            mouth["text_color"] = str(payload.get("color") or payload.get("text_color") or "")
        if payload.get("clear") is True:
            mouth["text"] = ""
            mouth["text_active"] = False
        mouth["manual"] = True
        self._touch()
        return self.snapshot()

    def control(self, payload: dict[str, Any]) -> dict[str, Any]:
        if payload.get("sleep") is True:
            result = self.sleep()
        elif payload.get("release") is True:
            result = self.release()
        else:
            result = self.snapshot()
        if "idle" in payload or "autonomous" in payload or "animate" in payload:
            enabled = bool(payload.get("idle", payload.get("autonomous", payload.get("animate", True))))
            self.state["idle"] = enabled
            self.state["eyes_animate"] = enabled
            self.state["autonomous"] = enabled
            result = self.snapshot()
        mood = payload.get("emotion") or payload.get("expression") or payload.get("mood") or payload.get("name")
        if mood:
            result = self.set_mood(str(mood), color=str(payload.get("color") or ""))
        if isinstance(payload.get("gaze"), dict):
            result = self.set_gaze(payload["gaze"])
        if "eye_mode" in payload or "mode" in payload:
            result = self.set_style(eye_mode=str(payload.get("eye_mode") or payload.get("mode") or ""))
        if isinstance(payload.get("eyes"), dict):
            eyes = payload["eyes"]
            result = self.set_style(
                name=str(eyes.get("style") or eyes.get("name") or ""),
                eye_mode=str(eyes.get("eye_mode") or eyes.get("mode") or ""),
            )
        if isinstance(payload.get("mouth"), dict):
            result = self.set_mouth(payload["mouth"])
        if payload.get("color"):
            self._set_color(str(payload.get("color")))
            result = self.snapshot()
        self._touch()
        return result

    def beat(self, name: str) -> dict[str, Any]:
        beat = _clean_token(name, fallback="thoughtful")
        mood_for_beat = {
            "slow_smile": "happy",
            "affection": "affection",
            "inspect": "focused",
            "thoughtful": "curious",
            "daydream": "wonder",
            "mischief": "mischief",
            "confused": "confused",
            "focus_lock": "focused",
            "double_take": "surprised",
            "goofy": "goofy",
            "silly": "silly",
            "drowsy": "sleepy",
            "robot_scan": "robotic",
            "wary": "suspicious",
            "startle": "surprised",
        }.get(beat, "curious")
        self.state["director"] = beat
        return self.set_mood(mood_for_beat)

    def _set_color(self, color: str) -> None:
        value = str(color or "").strip()
        if value.lower() in {"", "auto", "clear", "neutral"}:
            self.state["status_tint_override"] = False
            self.state.pop("status_tint", None)
        else:
            self.state["status_tint_override"] = True
            self.state["status_tint"] = value

    def _touch(self) -> None:
        self.state["updated_at"] = time.time()


def _clean_token(value: object, fallback: str) -> str:
    text = str(value or "").strip().lower().replace(" ", "_").replace("-", "_")
    return text or fallback


def _clean_eye_mode(value: object) -> str:
    text = _clean_token(value, fallback="normal")
    if text in {"default", "auto", "clear", "straight"}:
        return "normal"
    if text in {"cross", "cross_eye", "cross_eyed", "crosseyed"}:
        return "crossed"
    if text in {"swap", "swap_eyes", "swapped_eyes"}:
        return "swapped"
    if text in {"googly_eyes", "loose", "loose_eyes"}:
        return "googly"
    return text if text in EYE_MODES else "normal"


def _clamp_float(value: object, low: float, high: float, fallback: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    return max(low, min(high, number))


def _int_param(params: dict[str, list[str]], name: str, default: int) -> int:
    try:
        return int((params.get(name) or [default])[0])
    except (TypeError, ValueError):
        return default


class FaceSimHandler(SimpleHTTPRequestHandler):
    sim_state: FaceSimState

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlsplit(self.path)
        if parsed.path.startswith(BROWSER_FACE_RECORDING_URL_PREFIX):
            self._handle_face_recording(parsed.path)
            return
        if parsed.path in {"/state", "/api/status", "/status"}:
            self._send_json(200, self.sim_state.snapshot())
            return
        if parsed.path in {"/commands", "/api/commands"}:
            params = parse_qs(parsed.query)
            after = _int_param(params, "after", 0)
            limit = _int_param(params, "limit", 10)
            self._send_json(200, self.sim_state.list_commands(after=after, limit=limit))
            return
        if parsed.path in {"/moods", "/mouth_shapes", "/mouth_styles", "/styles", "/eye_modes", "/beats"}:
            self._send_json(200, _list_payload(parsed.path))
            return
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlsplit(self.path)
        if parsed.path in {"/recording", "/api/recording"}:
            self._handle_face_recording_upload()
            return
        payload = self._read_json()
        if parsed.path in {"/control", "/api/control"}:
            self._send_json(200, self.sim_state.control(payload))
            return
        if parsed.path in {"/mood", "/emotion", "/expression"}:
            name = str(payload.get("name") or payload.get("mood") or payload.get("emotion") or payload.get("expression") or "")
            self._send_json(200, self.sim_state.set_mood(name, color=str(payload.get("color") or "")))
            return
        if parsed.path == "/style":
            self._send_json(
                200,
                self.sim_state.set_style(
                    name=str(payload.get("name") or payload.get("style") or ""),
                    eye_mode=str(payload.get("eye_mode") or payload.get("mode") or ""),
                ),
            )
            return
        if parsed.path == "/gaze":
            self._send_json(200, self.sim_state.set_gaze(payload))
            return
        if parsed.path == "/mouth":
            self._send_json(200, self.sim_state.set_mouth(payload))
            return
        if parsed.path == "/release":
            self._send_json(200, self.sim_state.release())
            return
        if parsed.path == "/sleep":
            self._send_json(200, self.sim_state.sleep())
            return
        if parsed.path == "/beat":
            self._send_json(200, self.sim_state.beat(str(payload.get("name") or payload.get("beat") or "")))
            return
        if parsed.path in {"/capture_to_eye", "/api/capture_to_eye"}:
            self._send_json(200, self.sim_state.queue_capture_to_eye(payload))
            return
        self._send_json(404, {"ok": False, "error": "unknown endpoint"})

    def _handle_face_recording_upload(self) -> None:
        try:
            data = self._read_raw_body(MAX_BROWSER_FACE_RECORDING_BYTES)
            filename = self.headers.get("X-Robot790-Filename") or self.headers.get("X-Face-Recording-Name") or ""
            result = save_browser_face_recording(data, filename)
        except ValueError as exc:
            self._send_json(400, {"ok": False, "error": str(exc)})
            return
        self._send_json(200, result)

    def _handle_face_recording(self, path: str) -> None:
        filename = path[len(BROWSER_FACE_RECORDING_URL_PREFIX) :]
        try:
            recording_path = browser_face_recording_path(filename)
        except ValueError:
            self.send_error(404, "Browser face recording not found.")
            return
        if not recording_path.exists() or not recording_path.is_file():
            self.send_error(404, "Browser face recording not found.")
            return
        self.send_response(200)
        self.send_header("Content-Type", "video/webm")
        self.send_header("Content-Length", str(recording_path.stat().st_size))
        self.end_headers()
        with recording_path.open("rb") as handle:
            shutil.copyfileobj(handle, self.wfile)

    def translate_path(self, path: str) -> str:
        parsed = urlsplit(path)
        relative = parsed.path.lstrip("/") or "index.html"
        if "/" in relative or "\\" in relative:
            relative = "index.html"
        target = WEB_ROOT / relative
        if not target.exists():
            target = WEB_ROOT / "index.html"
        return str(target)

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

    def _read_raw_body(self, max_bytes: int) -> bytes:
        try:
            length = int(self.headers.get("Content-Length") or "0")
        except ValueError:
            raise ValueError("Invalid recording upload length.")
        if length <= 0:
            raise ValueError("Nothing to record.")
        if length > max_bytes:
            raise ValueError("Browser face recording is too large.")
        data = self.rfile.read(length)
        if not data:
            raise ValueError("Nothing to record.")
        return data

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def _list_payload(path: str) -> dict[str, Any]:
    values = {
        "/moods": [
            "neutral",
            "calm",
            "curious",
            "surprised",
            "suspicious",
            "afraid",
            "angry",
            "sad",
            "sleepy",
            "sleep",
            "goofy",
            "silly",
            "robotic",
            "calculating",
            "wonder",
            "glitchy",
            "happy",
            "excited",
            "delighted",
            "bashful",
            "bored",
            "focused",
            "confused",
            "helpful",
            "proud",
            "mischief",
            "affection",
        ],
        "/mouth_shapes": [
            "neutral",
            "smile",
            "big_smile",
            "smirk_left",
            "smirk_right",
            "open",
            "o",
            "wide",
            "tongue",
            "frown",
            "grimace",
            "sneer",
            "sleep",
        ],
        "/mouth_styles": ["human", "robot"],
        "/styles": ["friendly", "classic", "cartoony", "robot", "sinister", "sleepy"],
        "/eye_modes": ["normal", "crossed", "swapped", "googly"],
        "/beats": [
            "slow_smile",
            "affection",
            "inspect",
            "thoughtful",
            "daydream",
            "mischief",
            "confused",
            "focus_lock",
            "double_take",
            "goofy",
            "silly",
            "drowsy",
            "robot_scan",
            "wary",
            "startle",
        ],
    }.get(path, [])
    key = path.strip("/") or "values"
    return {"ok": True, key: values}


def _safe_recording_filename(value: str) -> str:
    name = Path(str(value or "")).name.strip()
    if not name:
        name = f"browser-face-{time.strftime('%Y%m%d-%H%M%S')}.webm"
    stem = Path(name).stem
    suffix = Path(name).suffix.lower()
    stem = re.sub(r"[^A-Za-z0-9_. -]+", "-", stem).strip(" .-_")
    stem = re.sub(r"[-\s]+", "-", stem) or "browser-face"
    if suffix not in {".webm", ".mp4"}:
        suffix = ".webm"
    return f"{stem}{suffix}"


def browser_face_recording_path(filename: str, repo_root: Path | None = None) -> Path:
    root = repo_root or Path(__file__).resolve().parents[2]
    recording_dir = (root / "logs" / "browser-face").resolve()
    recording_dir.mkdir(parents=True, exist_ok=True)
    path = (recording_dir / _safe_recording_filename(filename)).resolve()
    if recording_dir != path.parent:
        raise ValueError("Browser face recording path escaped the recording directory.")
    return path


def save_browser_face_recording(data: bytes, filename: str = "", repo_root: Path | None = None) -> dict[str, object]:
    if not data:
        raise ValueError("Nothing to record.")
    if len(data) > MAX_BROWSER_FACE_RECORDING_BYTES:
        raise ValueError("Browser face recording is too large.")
    path = browser_face_recording_path(filename, repo_root)
    path.write_bytes(data)
    latest = browser_face_recording_path("latest-browser-face.webm", repo_root)
    shutil.copyfile(path, latest)
    return {
        "ok": True,
        "tool": "save_browser_face_recording",
        "filename": path.name,
        "path": str(path),
        "url": f"{BROWSER_FACE_RECORDING_URL_PREFIX}{path.name}",
        "latest": latest.name,
        "latest_url": f"{BROWSER_FACE_RECORDING_URL_PREFIX}{latest.name}",
        "bytes": len(data),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Robot 790 browser face simulator.")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    args = parser.parse_args()

    if not (WEB_ROOT / "index.html").exists():
        raise SystemExit(f"Missing face sim page: {WEB_ROOT / 'index.html'}")

    handler = type("ConfiguredFaceSimHandler", (FaceSimHandler,), {})
    handler.sim_state = FaceSimState(args.host, args.port)
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Robot 790 browser face sim: http://{args.host}:{args.port}/", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import subprocess
import threading
import time
from datetime import datetime
from email import policy
from email.parser import BytesParser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlsplit

import httpx

from robot_790d.brain_status import get_brain_status, get_gpu_status
from robot_790d.image_generation import GENERATED_IMAGE_URL_PREFIX, generate_image, generated_image_path
from robot_790d.media_cast import CastMediaClient
from robot_790d.note_files import list_note_files, read_note_file, write_note_file
from robot_790d.smart_home import control_smart_home_device
from robot_790d.weather import DEFAULT_WEATHER_LOCATION, lookup_weather
from robot_790d.web_search import search_web

AUDIO_RECORDING_URL_PREFIX = "/recorded-audio/"
MIN_AUDIO_RECORDING_CHUNK_SECONDS = 30.0
DEFAULT_CURRENT_EMBODIMENT = (
    "Your current embodiment is a local ESP32-driven face: eye displays, mouth display, voice, "
    "and optional tracked chassis tools when connected."
)
DEFAULT_BODY_TRAJECTORY = (
    "Your body is an evolving 790-inspired robot platform; treat live runtime state and tool results "
    "as the authority on what you can currently do."
)
DEFAULT_SESSION_BEHAVIOR_RULES = [
    (
        "Do not reflexively repeat the user's phrasing back as confirmation; answer with the next useful "
        "consequence, a new observation, or a short clarifying question."
    ),
    (
        "Only restate the user's words when correcting a misheard term, naming a specific thing they asked "
        "you to track, or making a deliberate revision."
    ),
]
RUNTIME_CONFIG_PATH = Path("config") / "runtime.json"
BASE_SESSION_PROMPT_PATH = Path("prompts") / "robot-790-realtime-system.md"
OPERATOR_COMMANDS_PATH = Path("logs") / "operator_commands.jsonl"
SENSING_EYE_INBOX_LOCK = threading.Lock()
SENSING_EYE_INBOX_LATEST: dict[str, object] | None = None
MAX_SENSING_EYE_DATA_URL_CHARS = 8 * 1024 * 1024


class StsPageHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        parsed = urlsplit(self.path)
        if parsed.path.startswith("/api/sensing-eye/"):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
        if parsed.path in {"", "/", "/index.html"} or parsed.path.endswith((".html", ".css", ".js")):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlsplit(self.path)
        if parsed.path.startswith(GENERATED_IMAGE_URL_PREFIX):
            self._handle_generated_image(parsed.path)
            return
        if parsed.path.startswith(AUDIO_RECORDING_URL_PREFIX):
            self._handle_audio_recording(parsed.path)
            return
        if parsed.path == "/api/runtime-config":
            self._handle_runtime_config()
            return
        if parsed.path == "/api/search":
            self._handle_search(parsed.query)
            return
        if parsed.path == "/api/weather":
            self._handle_weather(parsed.query)
            return
        if parsed.path == "/api/brain/status":
            self._handle_brain_status()
            return
        if parsed.path == "/api/gpu/status":
            self._handle_gpu_status()
            return
        if parsed.path == "/api/notes/read":
            self._handle_note_read(parsed.query)
            return
        if parsed.path == "/api/notes/list":
            self._handle_note_list()
            return
        if parsed.path == "/api/operator/poll":
            self._handle_operator_poll(parsed.query)
            return
        if parsed.path == "/api/sensing-eye/inbox":
            self._handle_sensing_eye_inbox_poll(parsed.query)
            return
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlsplit(self.path)
        if parsed.path == "/api/notes/write":
            self._handle_note_write()
            return
        if parsed.path == "/api/logs/record":
            self._handle_log_record()
            return
        if parsed.path == "/api/audio/record":
            self._handle_audio_record()
            return
        if parsed.path == "/api/audio/finalize":
            self._handle_audio_finalize()
            return
        if parsed.path == "/api/brain2/mull":
            self._handle_brain2_mull()
            return
        if parsed.path == "/api/images/generate":
            self._handle_image_generate()
            return
        if parsed.path == "/api/cast":
            self._handle_cast()
            return
        if parsed.path == "/api/smart-home":
            self._handle_smart_home()
            return
        if parsed.path == "/api/realtime/restart":
            self._handle_realtime_restart()
            return
        if parsed.path == "/api/realtime/unload":
            self._handle_realtime_unload()
            return
        if parsed.path == "/api/operator/enqueue":
            self._handle_operator_enqueue()
            return
        if parsed.path == "/api/sensing-eye/inbox":
            self._handle_sensing_eye_inbox_push()
            return
        self._send_json(404, {"status": "error", "error": "Unknown API endpoint."})

    def _handle_search(self, query_string: str) -> None:
        params = parse_qs(query_string)
        query = _first_param(params, "q") or _first_param(params, "query") or ""
        max_results = _int_param(params, "max_results", 5)
        payload = search_web(query, max_results=max_results)
        status_code = 200 if payload.get("status") == "ok" else 400
        self._send_json(status_code, payload)

    def _handle_weather(self, query_string: str) -> None:
        params = parse_qs(query_string)
        location = (
            _first_param(params, "location")
            or _first_param(params, "q")
            or DEFAULT_WEATHER_LOCATION
        )
        unit = _first_param(params, "unit") or "fahrenheit"
        payload = lookup_weather(location, unit=unit)
        status_code = 200 if payload.get("status") == "ok" else 400
        self._send_json(status_code, payload)

    def _handle_brain_status(self) -> None:
        self._send_json(200, get_brain_status())

    def _handle_gpu_status(self) -> None:
        self._send_json(200, get_gpu_status())

    def _handle_runtime_config(self) -> None:
        self._send_json(200, runtime_config())

    def _handle_operator_poll(self, query_string: str) -> None:
        params = parse_qs(query_string)
        after = _int_param(params, "after", 0)
        limit = _int_param(params, "limit", 10)
        try:
            payload = list_operator_commands(after=after, limit=limit)
        except OSError as exc:
            self._send_json(400, {"status": "error", "error": str(exc)})
            return
        self._send_json(200, payload)

    def _handle_operator_enqueue(self) -> None:
        try:
            payload = self._read_json_body()
            result = enqueue_operator_command(
                str(payload.get("text") or ""),
                kind=str(payload.get("kind") or "user_text"),
                source=str(payload.get("source") or "codex"),
            )
        except (OSError, ValueError) as exc:
            self._send_json(400, {"status": "error", "error": str(exc)})
            return
        self._send_json(200, result)

    def _handle_sensing_eye_inbox_poll(self, query_string: str) -> None:
        params = parse_qs(query_string)
        after = _int_param(params, "after", 0)
        self._send_json(200, poll_sensing_eye_inbox(after=after))

    def _handle_sensing_eye_inbox_push(self) -> None:
        try:
            payload = self._read_json_body()
            result = push_sensing_eye_image(payload)
        except ValueError as exc:
            self._send_json(400, {"status": "error", "error": str(exc)})
            return
        self._send_json(200, result)

    def _handle_note_read(self, query_string: str) -> None:
        params = parse_qs(query_string)
        filename = _first_param(params, "filename") or _first_param(params, "name") or ""
        try:
            note = read_note_file(None, filename)
        except FileNotFoundError:
            self._send_json(404, {"status": "error", "error": "Note file not found."})
            return
        except (OSError, ValueError) as exc:
            self._send_json(400, {"status": "error", "error": str(exc)})
            return
        self._send_json(
            200,
            {"status": "ok", "tool": "read_text_file", "filename": note.filename, "content": note.content},
        )

    def _handle_note_list(self) -> None:
        try:
            filenames = list_note_files()
        except OSError as exc:
            self._send_json(400, {"status": "error", "error": str(exc)})
            return
        self._send_json(200, {"status": "ok", "tool": "list_text_files", "files": filenames})

    def _handle_note_write(self) -> None:
        try:
            payload = self._read_json_body()
            note = write_note_file(
                None,
                str(payload.get("filename") or payload.get("name") or ""),
                str(payload.get("content") or ""),
                str(payload.get("mode") or "overwrite"),
            )
        except (OSError, ValueError) as exc:
            self._send_json(400, {"status": "error", "error": str(exc)})
            return
        self._send_json(
            200,
            {
                "status": "ok",
                "tool": "write_text_file",
                "filename": note.filename,
                "path": str(note.path),
                "characters": len(note.content),
            },
        )

    def _handle_log_record(self) -> None:
        try:
            payload = self._read_json_body()
            result = record_log_snapshot(
                str(payload.get("source") or "session"),
                str(payload.get("content") or ""),
            )
        except (OSError, ValueError) as exc:
            self._send_json(400, {"status": "error", "error": str(exc)})
            return
        self._send_json(200, result)

    def _handle_audio_record(self) -> None:
        try:
            content, mime_type, image_filename, cover_image, cover_image_mime, cover_image_name, captions = (
                self._read_audio_record_body(max_bytes=250 * 1024 * 1024)
            )
            result = record_audio_snapshot(
                content,
                mime_type,
                image_filename=self.headers.get("X-Robot-790-Image-Filename") or "",
                form_image_filename=image_filename,
                cover_image=cover_image,
                cover_image_mime=cover_image_mime,
                cover_image_name=cover_image_name,
                captions=captions,
            )
        except (OSError, ValueError) as exc:
            self._send_json(400, {"status": "error", "error": str(exc)})
            return
        self._send_json(200, result)

    def _handle_audio_finalize(self) -> None:
        try:
            payload = self._read_json_body()
            result = finalize_audio_recording_session(
                payload.get("chunks") or [],
                image_filename=str(payload.get("image_filename") or ""),
                captions=_normalize_recording_captions(payload.get("captions") or []),
            )
        except (OSError, ValueError) as exc:
            self._send_json(400, {"status": "error", "error": str(exc)})
            return
        self._send_json(200 if result.get("status") == "ok" else 400, result)

    def _handle_image_generate(self) -> None:
        try:
            payload = self._read_json_body()
            result = generate_image(
                str(payload.get("prompt") or ""),
                title=str(payload.get("title") or ""),
                provider=str(payload.get("provider") or "").strip() or None,
                size=str(payload.get("size") or "").strip() or None,
                model=str(payload.get("model") or "").strip() or None,
                quality=str(payload.get("quality") or "").strip() or None,
                repo_root=Path(__file__).resolve().parents[2],
            )
        except (OSError, ValueError) as exc:
            self._send_json(400, {"status": "error", "error": str(exc)})
            return
        status_code = 200 if result.get("status") == "ok" else 400
        self._send_json(status_code, result)

    def _handle_generated_image(self, path: str) -> None:
        filename = unquote(path.removeprefix(GENERATED_IMAGE_URL_PREFIX))
        try:
            image_path = generated_image_path(filename, Path(__file__).resolve().parents[2])
        except ValueError:
            self.send_error(404, "Generated image not found.")
            return
        if not image_path.is_file():
            self.send_error(404, "Generated image not found.")
            return
        content = image_path.read_bytes()
        content_type = mimetypes.guess_type(image_path.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def _handle_audio_recording(self, path: str) -> None:
        filename = unquote(path.removeprefix(AUDIO_RECORDING_URL_PREFIX))
        try:
            audio_path = recorded_audio_path(filename, Path(__file__).resolve().parents[2])
        except ValueError:
            self.send_error(404, "Audio recording not found.")
            return
        if not audio_path.is_file():
            self.send_error(404, "Audio recording not found.")
            return
        content = audio_path.read_bytes()
        content_type = mimetypes.guess_type(audio_path.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def _handle_cast(self) -> None:
        try:
            payload = self._read_json_body()
            result = _dispatch_cast(payload)
        except (ModuleNotFoundError, ValueError) as exc:
            self._send_json(400, {"status": "error", "error": str(exc)})
            return
        status_code = 200 if result.get("status") == "ok" else 400
        self._send_json(status_code, result)

    def _handle_brain2_mull(self) -> None:
        try:
            payload = self._read_json_body()
            result = mull_second_brain(payload)
        except (OSError, ValueError) as exc:
            self._send_json(400, {"status": "error", "error": str(exc)})
            return
        status_code = 200 if result.get("status") == "ok" else 400
        self._send_json(status_code, result)

    def _handle_smart_home(self) -> None:
        try:
            payload = self._read_json_body()
            result = control_smart_home_device(
                str(payload.get("device") or ""),
                str(payload.get("action") or "status"),
            )
        except (OSError, ValueError) as exc:
            self._send_json(400, {"status": "error", "error": str(exc)})
            return
        status_code = 200 if result.get("status") == "ok" else 400
        self._send_json(status_code, result)

    def _handle_realtime_restart(self) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        script_path = repo_root / "scripts" / "restart_realtime_gold.ps1"
        if not script_path.exists():
            self._send_json(500, {"status": "error", "error": f"Missing restart script at {script_path}."})
            return
        try:
            payload = self._read_json_body()
        except (json.JSONDecodeError, ValueError) as exc:
            self._send_json(400, {"status": "error", "error": str(exc)})
            return
        preset = str(payload.get("preset") or "qwen27-mtp-vlow").strip()
        allowed_presets = {"qwen27-mtp-vlow", "qwen27", "qwen9", "qwen4", "nemotron30", "openai", "custom"}
        if preset not in allowed_presets:
            self._send_json(400, {"status": "error", "error": f"Unsupported model preset: {preset}."})
            return
        model = str(payload.get("model") or "").strip()
        reasoning = str(payload.get("reasoning") or "none").strip()
        if reasoning not in {"", "low", "medium", "xhigh", "none"}:
            self._send_json(400, {"status": "error", "error": f"Unsupported reasoning mode: {reasoning}."})
            return
        tts_dtype = str(payload.get("tts_dtype") or "bfloat16").strip()
        if tts_dtype not in {"bfloat16", "float16"}:
            self._send_json(400, {"status": "error", "error": f"Unsupported TTS precision: {tts_dtype}."})
            return
        try:
            context_length = int(payload.get("context_length") or 131072)
        except (TypeError, ValueError):
            self._send_json(400, {"status": "error", "error": "Context length must be a number."})
            return
        context_length = max(4096, min(262144, context_length))
        try:
            parallel = int(payload.get("parallel") or 0)
        except (TypeError, ValueError):
            self._send_json(400, {"status": "error", "error": "Parallel must be a number."})
            return
        if parallel:
            parallel = max(1, min(8, parallel))
        if preset == "custom":
            if not model:
                self._send_json(400, {"status": "error", "error": "Custom LM Studio preset needs a model key."})
                return
            if any(character in model for character in "\r\n"):
                self._send_json(400, {"status": "error", "error": "Custom model key cannot contain newlines."})
                return
            if len(model) > 240:
                self._send_json(400, {"status": "error", "error": "Custom model key is too long."})
                return

        logs_dir = repo_root / "logs"
        logs_dir.mkdir(parents=True, exist_ok=True)
        out_log = logs_dir / "sts-realtime-restart.out.log"
        err_log = logs_dir / "sts-realtime-restart.err.log"
        creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        try:
            with out_log.open("ab") as stdout, err_log.open("ab") as stderr:
                process = subprocess.Popen(
                    [
                        "powershell.exe",
                        "-NoProfile",
                        "-ExecutionPolicy",
                        "Bypass",
                        "-File",
                        str(script_path),
                        "-Preset",
                        preset,
                        "-Model",
                        model,
                        "-Reasoning",
                        reasoning,
                        "-ContextLength",
                        str(context_length),
                        "-Parallel",
                        str(parallel),
                        "-TtsDtype",
                        tts_dtype,
                    ],
                    cwd=repo_root,
                    stdout=stdout,
                    stderr=stderr,
                    creationflags=creationflags,
                )
        except OSError as exc:
            self._send_json(500, {"status": "error", "error": str(exc)})
            return

        self._send_json(
            202,
            {
                "status": "ok",
                "tool": "restart_realtime_server",
                "preset": preset,
                "pid": process.pid,
                "message": "Realtime backend restart started.",
            },
        )

    def _handle_realtime_unload(self) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        script_path = repo_root / "scripts" / "unload_realtime.ps1"
        if not script_path.exists():
            self._send_json(500, {"status": "error", "error": f"Missing unload script at {script_path}."})
            return

        logs_dir = repo_root / "logs"
        logs_dir.mkdir(parents=True, exist_ok=True)
        out_log = logs_dir / "sts-realtime-unload.out.log"
        err_log = logs_dir / "sts-realtime-unload.err.log"
        creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        try:
            with out_log.open("ab") as stdout, err_log.open("ab") as stderr:
                process = subprocess.Popen(
                    [
                        "powershell.exe",
                        "-NoProfile",
                        "-ExecutionPolicy",
                        "Bypass",
                        "-File",
                        str(script_path),
                    ],
                    cwd=repo_root,
                    stdout=stdout,
                    stderr=stderr,
                    creationflags=creationflags,
                )
        except OSError as exc:
            self._send_json(500, {"status": "error", "error": str(exc)})
            return

        self._send_json(
            202,
            {
                "status": "ok",
                "tool": "unload_realtime_server",
                "pid": process.pid,
                "message": "Realtime backend stop and LM Studio unload started.",
            },
        )

    def _read_json_body(self) -> dict[str, Any]:
        length_header = self.headers.get("Content-Length") or "0"
        try:
            length = int(length_header)
        except ValueError as exc:
            raise ValueError("Invalid Content-Length.") from exc
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        parsed = json.loads(raw.decode("utf-8"))
        if not isinstance(parsed, dict):
            raise ValueError("JSON body must be an object.")
        return parsed

    def _read_binary_body(self, max_bytes: int) -> bytes:
        length_header = self.headers.get("Content-Length") or "0"
        try:
            length = int(length_header)
        except ValueError as exc:
            raise ValueError("Invalid Content-Length.") from exc
        if length <= 0:
            raise ValueError("Nothing to record.")
        if length > max_bytes:
            raise ValueError("Recording is too large.")
        return self.rfile.read(length)

    def _read_audio_record_body(
        self,
        max_bytes: int,
    ) -> tuple[bytes, str, str, bytes, str, str, list[dict[str, object]]]:
        content_type = self.headers.get("Content-Type") or ""
        if not content_type.lower().startswith("multipart/form-data"):
            return (
                self._read_binary_body(max_bytes),
                content_type,
                "",
                b"",
                "",
                "",
                [],
            )

        body = self._read_binary_body(max_bytes)
        header = f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("utf-8")
        message = BytesParser(policy=policy.default).parsebytes(header + body)
        if not message.is_multipart():
            raise ValueError("Invalid recording form upload.")

        audio = b""
        audio_mime = ""
        image_filename = ""
        cover_image = b""
        cover_image_mime = ""
        cover_image_name = ""
        captions: list[dict[str, object]] = []
        for part in message.iter_parts():
            if part.get_content_disposition() != "form-data":
                continue
            field_name = str(part.get_param("name", header="content-disposition") or "")
            payload = part.get_payload(decode=True) or b""
            if field_name == "audio":
                audio = payload
                audio_mime = part.get_content_type()
            elif field_name == "cover_image":
                cover_image = payload
                cover_image_mime = part.get_content_type()
                cover_image_name = str(part.get_filename() or "")
            elif field_name == "image_filename":
                image_filename = payload.decode(part.get_content_charset() or "utf-8", errors="replace").strip()
            elif field_name == "captions":
                caption_text = payload.decode(part.get_content_charset() or "utf-8", errors="replace").strip()
                captions = _parse_recording_captions(caption_text)

        if not audio:
            raise ValueError("Nothing to record.")
        return (
            audio,
            audio_mime or "audio/webm",
            image_filename,
            cover_image,
            cover_image_mime,
            cover_image_name,
            captions,
        )

    def _send_json(self, status_code: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def _first_param(params: dict[str, list[str]], name: str) -> str | None:
    values = params.get(name)
    if not values:
        return None
    return values[0]


def _int_param(params: dict[str, list[str]], name: str, default: int) -> int:
    value = _first_param(params, name)
    try:
        return int(value) if value is not None else default
    except ValueError:
        return default


def _env_text(name: str) -> str:
    return " ".join((os.getenv(name) or "").split())


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, ""))
    except ValueError:
        return default


def runtime_config(repo_root: Path | None = None) -> dict[str, object]:
    root = repo_root or Path(__file__).resolve().parents[2]
    payload = _load_runtime_config_file(root)
    config_error = payload.pop("_error", "")
    current_embodiment = _env_text("ROBOT_790_CURRENT_EMBODIMENT") or _runtime_string(
        payload,
        "current_embodiment",
        DEFAULT_CURRENT_EMBODIMENT,
    )
    body_trajectory = _env_text("ROBOT_790_BODY_TRAJECTORY") or _runtime_string(
        payload,
        "body_trajectory",
        DEFAULT_BODY_TRAJECTORY,
    )
    idle_level12_cooldown_s = _env_float(
        "ROBOT_790_IDLE_LEVEL12_COOLDOWN_S",
        _runtime_float(payload, "idle_level12_cooldown_s", 12.0),
    )
    result: dict[str, object] = {
        "status": "ok",
        "current_embodiment": current_embodiment,
        "body_trajectory": body_trajectory,
        "idle_level12_cooldown_s": idle_level12_cooldown_s,
        "base_session_prompt": _load_base_session_prompt(root),
        "base_session_prompt_source": str(BASE_SESSION_PROMPT_PATH).replace("\\", "/"),
        "session_behavior_rules": _runtime_string_list(
            payload,
            "session_behavior_rules",
            DEFAULT_SESSION_BEHAVIOR_RULES,
        ),
        "default_embodiment": _runtime_string(payload, "default_embodiment", ""),
        "embodiments": _runtime_embodiments(payload.get("embodiments")),
    }
    if config_error:
        result["config_warning"] = config_error
    return result


def _load_runtime_config_file(repo_root: Path) -> dict[str, object]:
    path = repo_root / RUNTIME_CONFIG_PATH
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except (OSError, json.JSONDecodeError) as exc:
        return {"_error": f"Could not load {RUNTIME_CONFIG_PATH}: {exc}"}
    return parsed if isinstance(parsed, dict) else {"_error": f"{RUNTIME_CONFIG_PATH} must contain a JSON object."}


def _load_base_session_prompt(repo_root: Path) -> str:
    path = repo_root / BASE_SESSION_PROMPT_PATH
    try:
        return path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return ""
    except OSError:
        return ""


def _runtime_string(payload: dict[str, object], key: str, default: str) -> str:
    value = payload.get(key)
    if isinstance(value, str):
        normalized = " ".join(value.split())
        if normalized:
            return normalized
    return default


def _runtime_float(payload: dict[str, object], key: str, default: float) -> float:
    try:
        return float(payload.get(key, default))
    except (TypeError, ValueError):
        return default


def _runtime_string_list(payload: dict[str, object], key: str, default: list[str]) -> list[str]:
    value = payload.get(key)
    if not isinstance(value, list):
        return list(default)
    rules = [" ".join(str(item).split()) for item in value if " ".join(str(item).split())]
    return rules or list(default)


def _runtime_embodiments(value: object) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    embodiments: list[dict[str, str]] = []
    for item in value[:20]:
        if not isinstance(item, dict):
            continue
        key = " ".join(str(item.get("key") or "").split())
        label = " ".join(str(item.get("label") or "").split())
        face_url = " ".join(str(item.get("face_url") or "").split())
        description = " ".join(str(item.get("description") or "").split())
        if not key or not face_url:
            continue
        embodiments.append(
            {
                "key": key,
                "label": label or key,
                "face_url": face_url,
                "description": description,
            }
        )
    return embodiments


def enqueue_operator_command(
    text: str,
    *,
    kind: str = "user_text",
    source: str = "codex",
    repo_root: Path | None = None,
) -> dict[str, object]:
    command_text = str(text or "").replace("\r\n", "\n").strip()
    if not command_text:
        raise ValueError("Operator command text is required.")
    if len(command_text) > 8000:
        raise ValueError("Operator command text is too long.")

    command_kind = str(kind or "user_text").strip().lower()
    if command_kind not in {"user_text", "say_text"}:
        raise ValueError("Unsupported operator command kind.")

    command_source = " ".join(str(source or "codex").split())[:80] or "codex"
    root = repo_root or Path(__file__).resolve().parents[2]
    path = root / OPERATOR_COMMANDS_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    command = {
        "seq": time.time_ns(),
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "kind": command_kind,
        "source": command_source,
        "text": command_text,
    }
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(command, ensure_ascii=True) + "\n")
    return {
        "status": "ok",
        "tool": "enqueue_operator_command",
        "command": command,
        "path": str(path),
    }


def list_operator_commands(
    *,
    after: int = 0,
    limit: int = 10,
    repo_root: Path | None = None,
) -> dict[str, object]:
    root = repo_root or Path(__file__).resolve().parents[2]
    path = root / OPERATOR_COMMANDS_PATH
    safe_after = max(0, int(after or 0))
    safe_limit = max(1, min(50, int(limit or 10)))
    commands: list[dict[str, object]] = []
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        lines = []
    for line in lines[-1000:]:
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(item, dict):
            continue
        try:
            seq = int(item.get("seq") or 0)
        except (TypeError, ValueError):
            continue
        if seq <= safe_after:
            continue
        commands.append(
            {
                "seq": seq,
                "created_at": str(item.get("created_at") or ""),
                "kind": str(item.get("kind") or "user_text"),
                "source": str(item.get("source") or "codex"),
                "text": str(item.get("text") or ""),
            }
        )
        if len(commands) >= safe_limit:
            break
    return {
        "status": "ok",
        "tool": "list_operator_commands",
        "after": safe_after,
        "commands": commands,
        "latest_seq": commands[-1]["seq"] if commands else safe_after,
    }


def push_sensing_eye_image(payload: dict[str, Any]) -> dict[str, object]:
    global SENSING_EYE_INBOX_LATEST
    if not isinstance(payload, dict):
        raise ValueError("Sensing-eye push body must be an object.")
    data_url = str(payload.get("image_data_url") or payload.get("data_url") or "").strip()
    if not data_url:
        raise ValueError("Missing sensing-eye image data.")
    if len(data_url) > MAX_SENSING_EYE_DATA_URL_CHARS:
        raise ValueError("Sensing-eye image is too large.")
    if not re.match(r"^data:image/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$", data_url, flags=re.IGNORECASE):
        raise ValueError("Sensing-eye image must be a PNG, JPEG, or WebP data URL.")

    source = re.sub(r"[^A-Za-z0-9_. -]+", " ", str(payload.get("source") or "browser_face")).strip()[:80] or "browser_face"
    filename = _safe_media_filename(str(payload.get("filename") or "")) or f"{source.replace(' ', '-')}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.jpg"
    state = payload.get("state") if isinstance(payload.get("state"), dict) else {}
    item = {
        "seq": time.time_ns(),
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "source": source,
        "filename": filename,
        "image_data_url": re.sub(r"\s+", "", data_url),
        "reason": str(payload.get("reason") or "").strip()[:160],
        "state": state,
    }
    with SENSING_EYE_INBOX_LOCK:
        SENSING_EYE_INBOX_LATEST = item
    return {
        "status": "ok",
        "tool": "push_sensing_eye_image",
        "seq": item["seq"],
        "source": source,
        "filename": filename,
    }


def poll_sensing_eye_inbox(after: int = 0) -> dict[str, object]:
    safe_after = max(0, int(after or 0))
    with SENSING_EYE_INBOX_LOCK:
        item = dict(SENSING_EYE_INBOX_LATEST or {})
    if item and int(item.get("seq") or 0) > safe_after:
        return {
            "status": "ok",
            "item": item,
            "latest_seq": item["seq"],
        }
    return {
        "status": "ok",
        "item": None,
        "latest_seq": int(item.get("seq") or safe_after) if item else safe_after,
    }


def _bounded_float_env(name: str, default: float, *, minimum: float, maximum: float) -> float:
    value = _env_float(name, default)
    return max(minimum, min(maximum, value))


def _bounded_int_env(name: str, default: int, *, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, ""))
    except ValueError:
        value = default
    return max(minimum, min(maximum, value))


def record_log_snapshot(source: str, content: str, repo_root: Path | None = None) -> dict[str, object]:
    safe_source = _safe_log_source(source)
    normalized_content = str(content).replace("\r\n", "\n").strip()
    if not normalized_content:
        raise ValueError("Nothing to record.")

    root = repo_root or Path(__file__).resolve().parents[2]
    live_dir = root / "logs" / "live"
    live_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    filename = f"{timestamp}-{safe_source}.txt"
    latest_name = f"latest-{safe_source}.txt"
    model_string = _current_model_string(root)
    header = [
        "Robot 790 Live Log Snapshot",
        "===========================",
        f"Recorded: {datetime.now().isoformat(timespec='seconds')}",
        f"Source: {safe_source}",
        f"Model: {model_string}",
        "",
    ]
    body = "\n".join(header) + normalized_content + "\n"
    path = live_dir / filename
    latest_path = live_dir / latest_name
    path.write_text(body, encoding="utf-8")
    latest_path.write_text(body, encoding="utf-8")
    return {
        "status": "ok",
        "tool": "record_log_snapshot",
        "source": safe_source,
        "model": model_string,
        "filename": f"logs/live/{filename}",
        "latest": f"logs/live/{latest_name}",
        "path": str(path),
        "characters": len(body),
    }


def _safe_log_source(source: str) -> str:
    value = str(source or "session").strip().lower()
    if value not in {
        "conversation",
        "events",
        "session",
        "brain2_mulling",
        "recording_stop_report",
        "first_contact_report",
        "first_contact_direct_probe",
    }:
        value = "session"
    return value


def mull_second_brain(payload: dict[str, Any]) -> dict[str, object]:
    conversation = re.sub(r"\s+", " ", str(payload.get("conversation") or "")).strip()
    if len(conversation) < 12:
        raise ValueError("Brain 2 needs recent conversation to mull.")
    recent_idle = str(payload.get("recent_idle") or "").strip()
    recent_brain2 = str(payload.get("recent_brain2") or "").strip()
    voice_shape = str(payload.get("voice_shape") or "").strip()
    mode = str(payload.get("mode") or "person").strip().lower()
    if mode not in {"person", "thread", "question"}:
        mode = "person"
    try:
        person_focus = int(float(payload.get("person_focus") or 5))
    except (TypeError, ValueError):
        person_focus = 5
    person_focus = max(0, min(10, person_focus))

    base_url = (
        os.getenv("ROBOT_790_BRAIN2_BASE_URL")
        or os.getenv("ROBOT_790_OPENAI_LLM_BASE_URL")
        or "http://127.0.0.1:1234/v1"
    ).strip().rstrip("/")
    model = (
        os.getenv("ROBOT_790_BRAIN2_MODEL")
        or os.getenv("ROBOT_790_OPENAI_LLM_MODEL")
        or "qwen3.8-27b-nvfp4-mtp"
    ).strip()
    if model == "qwen/qwen3.8-27b" and os.getenv("ROBOT_790_ALLOW_BRAIN2_OLD_QWEN27", "").lower() not in {"1", "true", "yes"}:
        model = "qwen3.8-27b-nvfp4-mtp"
    api_key = os.getenv("ROBOT_790_BRAIN2_API_KEY") or os.getenv("ROBOT_790_OPENAI_LLM_API_KEY") or os.getenv("OPENAI_API_KEY") or "none"
    headers = {"Content-Type": "application/json"}
    if api_key and api_key.lower() not in {"none", "null", "false"}:
        headers["Authorization"] = f"Bearer {api_key}"

    system = (
        "You are Brain 2 for Robot 790, spoken name Eric. You do not speak aloud. "
        "You are a private recent-conversation ruminator that may write one tiny mouth-display aside. "
        "Mull the human in the room as an interesting person, not as a patient or customer. "
        "Stay curious, dry, compact, and non-caretaking. Do not diagnose mood, do not flatter, do not google the user, "
        "and do not claim certainty about private thoughts. Prefer one concrete observed conversational pattern. "
        "Do not repeat your own recent Brain 2 observations; either advance the thought, revise it, or return empty strings. "
        "Return only JSON with keys mouth_text, question, revision_candidate, should_surface, reason. "
        "mouth_text must be 96 characters or less. revision_candidate is empty unless you want Brain 1 to later "
        "publicly take back, correct, or complicate an earlier claim; write it as a compact note such as "
        "'I said X; thinking about it more, Y.'"
    )
    user = "\n\n".join(
        part
        for part in [
            f"Mode: {mode}. Person-focus: {person_focus}/10.",
            "Recent conversation:",
            conversation[-2600:],
            f"Recent input prosody tags: {voice_shape[-500:]}" if voice_shape else "",
            f"Recent idle outputs:\n{recent_idle[-900:]}" if recent_idle else "",
            f"Recent Brain 2 outputs to avoid repeating:\n{recent_brain2[-1100:]}" if recent_brain2 else "",
            (
                "Task: produce one mouth-display thought fragment. If a useful question is forming, include it as question. "
                "If an earlier claim needs revision, include it as revision_candidate for the speaking brain to consider later. "
                "Use should_surface true only when it is worth showing on the mouth during a pause. "
                "If the only available thought is a repeat of recent Brain 2 output, return empty strings with should_surface false."
            ),
        ]
        if part
    )
    request = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.55,
        "max_tokens": 320,
        "stream": False,
    }
    if "api.openai.com" not in base_url.lower():
        request["reasoning_effort"] = "none"
        request["chat_template_kwargs"] = {"enable_thinking": False}

    try:
        with httpx.Client(timeout=45) as client:
            response = client.post(f"{base_url}/chat/completions", headers=headers, json=request)
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        return {"status": "error", "tool": "mull_second_brain", "error": f"Brain 2 request failed: {exc}"}

    raw_text = _chat_completion_text(data)
    parsed = _parse_second_brain_json(raw_text)
    if parsed:
        mouth_text = _clean_second_brain_text(parsed.get("mouth_text") if "mouth_text" in parsed else parsed.get("text"), 96)
    else:
        mouth_text = _clean_second_brain_text(raw_text, 96)
    question = _clean_second_brain_text(parsed.get("question") or "", 140)
    revision_candidate = _clean_second_brain_text(parsed.get("revision_candidate") or "", 240)
    reason = _clean_second_brain_text(parsed.get("reason") or "", 220)
    if not mouth_text and not question and not revision_candidate:
        return {"status": "error", "tool": "mull_second_brain", "error": "Brain 2 returned no usable output."}
    return {
        "status": "ok",
        "tool": "mull_second_brain",
        "model": model,
        "mode": mode,
        "person_focus": person_focus,
        "mouth_text": mouth_text,
        "question": question,
        "revision_candidate": revision_candidate,
        "should_surface": bool(parsed.get("should_surface", True)),
        "reason": reason,
        "raw_text": raw_text[:1000],
    }


def _chat_completion_text(data: dict[str, Any]) -> str:
    choices = data.get("choices")
    if not isinstance(choices, list) or not choices:
        return ""
    first = choices[0]
    if not isinstance(first, dict):
        return ""
    message = first.get("message")
    if isinstance(message, dict):
        content = message.get("content")
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            return " ".join(str(part.get("text") or "") for part in content if isinstance(part, dict)).strip()
    text = first.get("text")
    return str(text or "").strip()


def _parse_second_brain_json(text: str) -> dict[str, Any]:
    value = str(text or "").strip()
    if not value:
        return {}
    if value.startswith("```"):
        value = re.sub(r"^```(?:json)?\s*", "", value, flags=re.IGNORECASE).strip()
        value = re.sub(r"\s*```$", "", value).strip()
    match = re.search(r"\{[\s\S]*\}", value)
    if match:
        value = match.group(0)
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _clean_second_brain_text(text: object, limit: int) -> str:
    value = re.sub(r"\s+", " ", str(text or "")).strip()
    value = value.strip("`\"' ")
    value = re.sub(r"^(mouth_text|question|revision_candidate|reason)\s*:\s*", "", value, flags=re.IGNORECASE)
    return value[:limit].rstrip()


def record_audio_snapshot(
    content: bytes,
    mime_type: str,
    repo_root: Path | None = None,
    *,
    image_filename: str = "",
    form_image_filename: str = "",
    cover_image: bytes = b"",
    cover_image_mime: str = "",
    cover_image_name: str = "",
    captions: list[dict[str, object]] | None = None,
) -> dict[str, object]:
    if not content:
        raise ValueError("Nothing to record.")

    root = repo_root or Path(__file__).resolve().parents[2]
    audio_dir = root / "logs" / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    extension = _audio_extension(mime_type)
    raw_filename = f"{timestamp}-sts-audio-source.{extension}"
    raw_latest_name = f"latest-sts-audio-source.{extension}"
    raw_path = audio_dir / raw_filename
    raw_latest_path = audio_dir / raw_latest_name
    raw_path.write_bytes(content)
    raw_latest_path.write_bytes(content)

    image_path = _selected_recording_cover_image(
        root,
        audio_dir,
        timestamp,
        cover_image=cover_image,
        cover_image_mime=cover_image_mime,
        cover_image_name=cover_image_name,
        image_filename=image_filename or form_image_filename,
    )
    mp4_filename = f"{timestamp}-sts-audio-picture.mp4"
    mp4_latest_name = "latest-sts-audio-picture.mp4"
    mp4_path = audio_dir / mp4_filename
    mp4_latest_path = audio_dir / mp4_latest_name
    safe_captions = _normalize_recording_captions(captions or [])
    conversion = _make_picture_audio_mp4(raw_path, mp4_path, image_path, root, captions=safe_captions)
    if conversion.get("status") != "ok":
        return {
            "status": "error",
            "tool": "record_audio_snapshot",
            "error": str(conversion.get("error") or "Could not convert audio recording to MP4."),
            "raw_filename": f"logs/audio/{raw_filename}",
            "raw_latest": f"logs/audio/{raw_latest_name}",
            "raw_path": str(raw_path),
            "bytes": len(content),
            "mime_type": mime_type or "application/octet-stream",
        }
    mp4_latest_path.write_bytes(mp4_path.read_bytes())
    return {
        "status": "ok",
        "tool": "record_audio_snapshot",
        "filename": f"logs/audio/{mp4_filename}",
        "latest": f"logs/audio/{mp4_latest_name}",
        "url": f"{AUDIO_RECORDING_URL_PREFIX}{mp4_filename}",
        "latest_url": f"{AUDIO_RECORDING_URL_PREFIX}{mp4_latest_name}",
        "path": str(mp4_path),
        "raw_filename": f"logs/audio/{raw_filename}",
        "raw_latest": f"logs/audio/{raw_latest_name}",
        "raw_path": str(raw_path),
        "bytes": mp4_path.stat().st_size,
        "raw_bytes": len(content),
        "mime_type": mime_type or "application/octet-stream",
        "image_filename": image_path.name,
        "image_path": str(image_path),
        "cover_source": "sensing_eye" if cover_image else "generated_or_placeholder",
        "duration_s": conversion.get("duration_s"),
        "trimmed_silence": conversion.get("trimmed_silence", False),
        "captioned": bool(safe_captions) and bool(conversion.get("captioned", False)),
        "caption_events": len(safe_captions),
    }


def finalize_audio_recording_session(
    chunks: list[object],
    repo_root: Path | None = None,
    *,
    image_filename: str = "",
    captions: list[dict[str, object]] | None = None,
) -> dict[str, object]:
    root = repo_root or Path(__file__).resolve().parents[2]
    audio_dir = root / "logs" / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    if not isinstance(chunks, list):
        raise ValueError("Audio chunks must be a list.")
    ordered_chunks = _recording_long_enough_chunks(_recording_chunks_in_timeline_order(chunks))
    chunk_paths = _recording_chunk_paths(ordered_chunks, root)
    if len(chunk_paths) < 2:
        raise ValueError("At least two audio chunks of 30 seconds or more are required to finalize a spliced recording.")

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    raw_filename = f"{timestamp}-sts-audio-session-source.webm"
    raw_latest_name = "latest-sts-audio-source.webm"
    raw_path = audio_dir / raw_filename
    raw_latest_path = audio_dir / raw_latest_name
    concat = _concat_audio_sources(chunk_paths, raw_path, root)
    if concat.get("status") != "ok":
        return {
            "status": "error",
            "tool": "finalize_audio_recording_session",
            "error": str(concat.get("error") or "Could not splice audio chunks."),
            "chunk_count": len(chunk_paths),
        }
    raw_latest_path.write_bytes(raw_path.read_bytes())

    mp4_filename = f"{timestamp}-sts-audio-session-picture.mp4"
    mp4_latest_name = "latest-sts-audio-picture.mp4"
    mp4_path = audio_dir / mp4_filename
    mp4_latest_path = audio_dir / mp4_latest_name
    safe_captions = _normalize_recording_captions(captions or [])
    picture_chunk_paths = _recording_chunk_picture_paths(ordered_chunks, root)
    conversion: dict[str, object]
    image_path: Path | None = None
    video_spliced = False
    temporary_picture_chunk_paths: list[Path] = []
    if len(picture_chunk_paths) == len(chunk_paths) and not _recording_chunks_need_cover_rebuild(ordered_chunks):
        conversion = _concat_picture_audio_mp4s(picture_chunk_paths, mp4_path, root)
        if conversion.get("status") == "ok":
            video_spliced = True
        else:
            image_path = _selected_recording_final_image(root, audio_dir, image_filename)
            conversion = _make_picture_audio_mp4(raw_path, mp4_path, image_path, root, captions=safe_captions)
    elif _recording_chunks_have_cover_metadata(ordered_chunks):
        rebuilt = _make_recording_chunk_picture_mp4s(ordered_chunks, chunk_paths, root, audio_dir, mp4_path, image_filename)
        if rebuilt.get("status") == "ok":
            temporary_picture_chunk_paths = list(rebuilt.get("paths") or [])
            conversion = _concat_picture_audio_mp4s(temporary_picture_chunk_paths, mp4_path, root)
            if conversion.get("status") == "ok":
                video_spliced = True
            else:
                image_path = _selected_recording_final_image(root, audio_dir, image_filename)
                conversion = _make_picture_audio_mp4(raw_path, mp4_path, image_path, root, captions=safe_captions)
        else:
            image_path = _selected_recording_final_image(root, audio_dir, image_filename)
            conversion = _make_picture_audio_mp4(raw_path, mp4_path, image_path, root, captions=safe_captions)
    else:
        image_path = _selected_recording_final_image(root, audio_dir, image_filename)
        conversion = _make_picture_audio_mp4(raw_path, mp4_path, image_path, root, captions=safe_captions)
    for temporary_path in temporary_picture_chunk_paths:
        try:
            temporary_path.unlink()
        except FileNotFoundError:
            pass
    if conversion.get("status") != "ok":
        return {
            "status": "error",
            "tool": "finalize_audio_recording_session",
            "error": str(conversion.get("error") or "Could not convert spliced recording to MP4."),
            "raw_filename": f"logs/audio/{raw_filename}",
            "raw_latest": f"logs/audio/{raw_latest_name}",
            "raw_path": str(raw_path),
            "chunk_count": len(chunk_paths),
        }
    mp4_latest_path.write_bytes(mp4_path.read_bytes())
    caption_events = _recording_chunk_caption_count(ordered_chunks) if video_spliced else len(safe_captions)
    captioned = _recording_chunks_captioned(ordered_chunks) if video_spliced else bool(safe_captions) and bool(conversion.get("captioned", False))
    return {
        "status": "ok",
        "tool": "finalize_audio_recording_session",
        "filename": f"logs/audio/{mp4_filename}",
        "latest": f"logs/audio/{mp4_latest_name}",
        "url": f"{AUDIO_RECORDING_URL_PREFIX}{mp4_filename}",
        "latest_url": f"{AUDIO_RECORDING_URL_PREFIX}{mp4_latest_name}",
        "path": str(mp4_path),
        "raw_filename": f"logs/audio/{raw_filename}",
        "raw_latest": f"logs/audio/{raw_latest_name}",
        "raw_path": str(raw_path),
        "bytes": mp4_path.stat().st_size,
        "raw_bytes": raw_path.stat().st_size,
        "mime_type": "video/webm",
        "image_filename": image_path.name if image_path else _recording_last_image_filename(ordered_chunks),
        "image_path": str(image_path) if image_path else "",
        "duration_s": conversion.get("duration_s"),
        "trimmed_silence": conversion.get("trimmed_silence", False),
        "captioned": captioned,
        "caption_events": caption_events,
        "chunk_count": len(chunk_paths),
        "skipped_short_chunks": max(0, len(chunks) - len(ordered_chunks)),
        "video_spliced": video_spliced,
        "crossfaded": bool(conversion.get("crossfaded", False)),
        "crossfade_s": conversion.get("crossfade_s"),
    }


def _recording_chunks_in_timeline_order(chunks: list[object]) -> list[object]:
    def sort_key(item: tuple[int, object]) -> tuple[int, float, int]:
        position, chunk = item
        if not isinstance(chunk, dict):
            return (1, float(position), position)
        try:
            index = float(chunk.get("index"))  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return (1, float(position), position)
        return (0, index, position)

    return [chunk for _position, chunk in sorted(enumerate(chunks[:200]), key=sort_key)]


def _recording_long_enough_chunks(chunks: list[object]) -> list[object]:
    kept: list[object] = []
    for chunk in chunks[:200]:
        if not isinstance(chunk, dict):
            kept.append(chunk)
            continue
        try:
            duration = float(chunk.get("duration_s"))  # type: ignore[arg-type]
        except (TypeError, ValueError):
            kept.append(chunk)
            continue
        if duration >= MIN_AUDIO_RECORDING_CHUNK_SECONDS:
            kept.append(chunk)
    return kept


def _recording_chunk_paths(chunks: list[object], repo_root: Path) -> list[Path]:
    paths: list[Path] = []
    for chunk in chunks[:200]:
        filename = ""
        if isinstance(chunk, dict):
            filename = str(chunk.get("raw_filename") or chunk.get("filename") or "")
        else:
            filename = str(chunk or "")
        if not filename:
            continue
        path = recorded_audio_path(filename, repo_root)
        if not path.is_file():
            raise ValueError(f"Audio chunk not found: {filename}")
        if path.suffix.lower() not in {".webm", ".m4a", ".wav", ".ogg"}:
            raise ValueError(f"Unsupported audio chunk type: {path.name}")
        paths.append(path)
    return paths


def _recording_chunk_picture_paths(chunks: list[object], repo_root: Path) -> list[Path]:
    paths: list[Path] = []
    for chunk in chunks[:200]:
        if not isinstance(chunk, dict):
            return []
        filename = str(chunk.get("filename") or "")
        if not filename:
            return []
        try:
            path = recorded_audio_path(filename, repo_root)
        except ValueError:
            return []
        if not path.is_file() or path.suffix.lower() != ".mp4":
            return []
        paths.append(path)
    return paths


def _recording_chunks_need_cover_rebuild(chunks: list[object]) -> bool:
    for chunk in chunks[:200]:
        if not isinstance(chunk, dict):
            return True
        if _recording_chunk_cover_is_placeholder(chunk):
            return True
    return False


def _recording_chunks_have_cover_metadata(chunks: list[object]) -> bool:
    for chunk in chunks[:200]:
        if not isinstance(chunk, dict):
            continue
        if str(chunk.get("image_filename") or "").strip():
            return True
        if str(chunk.get("cover_source") or "").strip():
            return True
    return False


def _recording_chunk_cover_is_placeholder(chunk: dict[str, object]) -> bool:
    source = str(chunk.get("cover_source") or "").strip().lower()
    image = _safe_media_filename(str(chunk.get("image_filename") or "")).lower()
    return not image or "placeholder" in image or "placeholder" in source or source == "fallback"


def _recording_image_path_for_filename(repo_root: Path, audio_dir: Path, image_filename: str = "") -> Path | None:
    safe_name = _safe_media_filename(image_filename)
    if not safe_name:
        return None
    audio_image = audio_dir / safe_name
    if audio_image.is_file() and _is_ffmpeg_image(audio_image):
        return audio_image
    try:
        generated_image = generated_image_path(safe_name, repo_root)
    except ValueError:
        return None
    if generated_image.is_file() and _is_ffmpeg_image(generated_image):
        return generated_image
    return None


def _recording_chunk_image_paths(
    chunks: list[object],
    repo_root: Path,
    audio_dir: Path,
    fallback_image_filename: str = "",
) -> list[Path]:
    fallback = _selected_recording_final_image(repo_root, audio_dir, fallback_image_filename)
    raw_images: list[tuple[Path | None, bool]] = []
    first_real: Path | None = None
    for chunk in chunks[:200]:
        if not isinstance(chunk, dict):
            raw_images.append((None, True))
            continue
        image_path = _recording_image_path_for_filename(repo_root, audio_dir, str(chunk.get("image_filename") or ""))
        is_placeholder = _recording_chunk_cover_is_placeholder(chunk)
        raw_images.append((image_path, is_placeholder))
        if image_path is not None and not is_placeholder and first_real is None:
            first_real = image_path

    selected: list[Path] = []
    last_real: Path | None = None
    for index, (image_path, is_placeholder) in enumerate(raw_images):
        if image_path is not None:
            selected.append(image_path)
        elif last_real is not None:
            selected.append(last_real)
        elif first_real is not None:
            selected.append(first_real)
        else:
            selected.append(fallback)
        if image_path is not None and not is_placeholder:
            last_real = image_path
    return selected


def _make_recording_chunk_picture_mp4s(
    chunks: list[object],
    audio_paths: list[Path],
    repo_root: Path,
    audio_dir: Path,
    output_path: Path,
    image_filename: str = "",
) -> dict[str, object]:
    image_paths = _recording_chunk_image_paths(chunks, repo_root, audio_dir, image_filename)
    if len(image_paths) != len(audio_paths):
        return {"status": "error", "error": "Audio chunk and image chunk counts do not match."}
    paths: list[Path] = []
    try:
        for index, (audio_path, image_path) in enumerate(zip(audio_paths, image_paths)):
            chunk = chunks[index] if index < len(chunks) and isinstance(chunks[index], dict) else {}
            captions = _normalize_recording_captions(chunk.get("captions") if isinstance(chunk.get("captions"), list) else [])
            chunk_mp4 = output_path.with_name(f"{output_path.stem}.chunk-{index:03d}.mp4")
            conversion = _make_picture_audio_mp4(audio_path, chunk_mp4, image_path, repo_root, captions=captions)
            if conversion.get("status") != "ok":
                return {"status": "error", "error": conversion.get("error") or "Could not convert chunk to MP4."}
            paths.append(chunk_mp4)
        return {"status": "ok", "paths": paths}
    except (OSError, subprocess.SubprocessError, ValueError) as exc:
        return {"status": "error", "error": str(exc)}


def _recording_chunk_caption_count(chunks: list[object]) -> int:
    total = 0
    for chunk in chunks[:200]:
        if not isinstance(chunk, dict):
            continue
        try:
            total += max(0, int(float(chunk.get("caption_events") or 0)))
        except (TypeError, ValueError):
            pass
    return total


def _recording_chunks_captioned(chunks: list[object]) -> bool:
    return any(isinstance(chunk, dict) and bool(chunk.get("captioned")) for chunk in chunks[:200])


def _recording_last_image_filename(chunks: list[object]) -> str:
    for chunk in reversed(chunks[:200]):
        if isinstance(chunk, dict):
            value = _safe_media_filename(str(chunk.get("image_filename") or ""))
            if value:
                return value
    return ""


def _selected_recording_final_image(repo_root: Path, audio_dir: Path, image_filename: str = "") -> Path:
    image_path = _recording_image_path_for_filename(repo_root, audio_dir, image_filename)
    if image_path is not None:
        return image_path
    return _selected_recording_image(repo_root, image_filename)


def _concat_audio_sources(audio_paths: list[Path], output_path: Path, repo_root: Path) -> dict[str, object]:
    concat_list = output_path.with_name(f"{output_path.stem}.concat.txt")
    try:
        concat_list.write_text(
            "".join(f"file '{_ffmpeg_concat_path(path)}'\n" for path in audio_paths),
            encoding="utf-8",
        )
        _run_ffmpeg(
            [
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(concat_list),
                "-c",
                "copy",
                str(output_path),
            ],
            repo_root,
        )
        return {"status": "ok"}
    except (OSError, subprocess.SubprocessError, ValueError) as exc:
        return {"status": "error", "error": str(exc)}
    finally:
        try:
            concat_list.unlink()
        except FileNotFoundError:
            pass


def _concat_picture_audio_mp4s(video_paths: list[Path], output_path: Path, repo_root: Path) -> dict[str, object]:
    crossfade_s = _audio_recording_chunk_crossfade_s()
    if len(video_paths) > 1 and crossfade_s >= 0.05:
        crossfaded = _concat_picture_audio_mp4s_with_crossfade(video_paths, output_path, repo_root, crossfade_s)
        if crossfaded.get("status") == "ok":
            return crossfaded
    return _concat_picture_audio_mp4s_plain(video_paths, output_path, repo_root)


def _concat_picture_audio_mp4s_plain(video_paths: list[Path], output_path: Path, repo_root: Path) -> dict[str, object]:
    concat_list = output_path.with_name(f"{output_path.stem}.video-concat.txt")
    try:
        concat_list.write_text(
            "".join(f"file '{_ffmpeg_concat_path(path)}'\n" for path in video_paths),
            encoding="utf-8",
        )
        _run_ffmpeg(
            [
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(concat_list),
                "-vf",
                "fps=24,format=yuv420p",
                "-af",
                "aresample=async=1:first_pts=0",
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-profile:v",
                "baseline",
                "-level",
                "3.0",
                "-pix_fmt",
                "yuv420p",
                "-crf",
                "34",
                "-c:a",
                "aac",
                "-b:a",
                "48k",
                "-ac",
                "1",
                "-ar",
                "24000",
                "-movflags",
                "+faststart",
                str(output_path),
            ],
            repo_root,
        )
        return {
            "status": "ok",
            "duration_s": round(_probe_duration(output_path, repo_root), 3),
            "trimmed_silence": False,
            "captioned": False,
            "crossfaded": False,
        }
    except (OSError, subprocess.SubprocessError, ValueError) as exc:
        return {"status": "error", "error": str(exc)}
    finally:
        try:
            concat_list.unlink()
        except FileNotFoundError:
            pass


def _concat_picture_audio_mp4s_with_crossfade(
    video_paths: list[Path],
    output_path: Path,
    repo_root: Path,
    crossfade_s: float,
) -> dict[str, object]:
    try:
        durations = [_probe_duration(path, repo_root) for path in video_paths]
        fade_s = min(crossfade_s, *(max(0.05, duration / 4) for duration in durations))
        if fade_s < 0.05:
            return {"status": "error", "error": "Chunk crossfade duration too short."}
        fade_text = f"{fade_s:.3f}"
        args = ["-y"]
        for path in video_paths:
            args.extend(["-i", str(path)])

        filters: list[str] = []
        for index in range(len(video_paths)):
            duration = durations[index]
            video_filters = [
                f"[{index}:v]fps=24",
                "scale=512:512:force_original_aspect_ratio=decrease",
                "pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black",
                "format=yuv420p",
                "setpts=PTS-STARTPTS",
            ]
            audio_filters = [
                f"[{index}:a]aresample=async=1:first_pts=0",
                "aformat=sample_rates=24000:channel_layouts=mono",
                "asetpts=PTS-STARTPTS",
            ]
            if index > 0:
                video_filters.append(f"fade=t=in:st=0:d={fade_text}")
                audio_filters.append(f"afade=t=in:st=0:d={fade_text}")
            if index < len(video_paths) - 1:
                fade_out_start = max(0.0, duration - fade_s)
                video_filters.append(f"fade=t=out:st={fade_out_start:.3f}:d={fade_text}")
                audio_filters.append(f"afade=t=out:st={fade_out_start:.3f}:d={fade_text}")
            filters.append(
                f"{','.join(video_filters)}[v{index}]"
            )
            filters.append(
                f"{','.join(audio_filters)}[a{index}]"
            )

        concat_inputs = "".join(f"[v{index}][a{index}]" for index in range(len(video_paths)))
        filters.append(f"{concat_inputs}concat=n={len(video_paths)}:v=1:a=1[vout][aout]")

        args.extend(
            [
                "-filter_complex",
                ";".join(filters),
                "-map",
                "[vout]",
                "-map",
                "[aout]",
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-profile:v",
                "baseline",
                "-level",
                "3.0",
                "-pix_fmt",
                "yuv420p",
                "-crf",
                "34",
                "-c:a",
                "aac",
                "-b:a",
                "48k",
                "-ac",
                "1",
                "-ar",
                "24000",
                "-movflags",
                "+faststart",
                str(output_path),
            ]
        )
        _run_ffmpeg(args, repo_root)
        return {
            "status": "ok",
            "duration_s": round(_probe_duration(output_path, repo_root), 3),
            "trimmed_silence": False,
            "captioned": False,
            "crossfaded": True,
            "crossfade_s": round(fade_s, 3),
        }
    except (OSError, subprocess.SubprocessError, ValueError) as exc:
        return {"status": "error", "error": str(exc)}


def _parse_recording_captions(value: str) -> list[dict[str, object]]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return _normalize_recording_captions(parsed)


def _normalize_recording_captions(captions: list[dict[str, object]]) -> list[dict[str, object]]:
    normalized: list[dict[str, object]] = []
    for item in captions[:800]:
        if not isinstance(item, dict):
            continue
        text = re.sub(r"\s+", " ", str(item.get("text") or "")).strip()
        if not text:
            continue
        try:
            start_ms = int(float(item.get("start_ms") or 0))
        except (TypeError, ValueError):
            start_ms = 0
        normalized.append(
            {
                "speaker": re.sub(r"\s+", " ", str(item.get("speaker") or "Robot 790")).strip()[:40],
                "start_ms": max(0, start_ms),
                "text": text[:500],
            }
        )
    return sorted(normalized, key=lambda entry: int(entry["start_ms"]))


def recorded_audio_path(filename: str, repo_root: Path | None = None) -> Path:
    safe_name = _safe_media_filename(filename)
    if not safe_name:
        raise ValueError("Missing audio filename.")
    root = repo_root or Path(__file__).resolve().parents[2]
    return root / "logs" / "audio" / safe_name


def _audio_extension(mime_type: str) -> str:
    value = mime_type.split(";", 1)[0].strip().lower()
    if value in {"audio/webm", "video/webm"}:
        return "webm"
    if value in {"audio/mp4", "audio/x-m4a"}:
        return "m4a"
    if value in {"audio/wav", "audio/wave", "audio/x-wav"}:
        return "wav"
    if value == "audio/ogg":
        return "ogg"
    return "webm"


def _selected_recording_image(repo_root: Path, image_filename: str = "") -> Path:
    if image_filename.strip():
        try:
            path = generated_image_path(image_filename, repo_root)
            if path.is_file() and _is_ffmpeg_image(path):
                return path
        except ValueError:
            pass

    image_dir = generated_image_path("placeholder.png", repo_root).parent
    candidates = [
        path
        for path in image_dir.glob("*")
        if path.is_file() and _is_ffmpeg_image(path)
    ]
    if candidates:
        return max(candidates, key=lambda path: path.stat().st_mtime)
    return _write_recording_placeholder(repo_root)


def _selected_recording_cover_image(
    repo_root: Path,
    audio_dir: Path,
    timestamp: str,
    *,
    cover_image: bytes = b"",
    cover_image_mime: str = "",
    cover_image_name: str = "",
    image_filename: str = "",
) -> Path:
    if cover_image:
        cover_path = _write_recording_cover_image(
            audio_dir,
            timestamp,
            cover_image,
            mime_type=cover_image_mime,
            original_name=cover_image_name,
        )
        if _is_ffmpeg_image(cover_path):
            return cover_path
    return _selected_recording_image(repo_root, image_filename)


def _write_recording_cover_image(
    audio_dir: Path,
    timestamp: str,
    content: bytes,
    *,
    mime_type: str = "",
    original_name: str = "",
) -> Path:
    extension = _cover_image_extension(mime_type, original_name)
    if not extension:
        raise ValueError("Recording cover image must be png, jpg, jpeg, or webp.")
    cover_filename = f"{timestamp}-sts-audio-cover{extension}"
    latest_filename = f"latest-sts-audio-cover{extension}"
    cover_path = audio_dir / cover_filename
    latest_path = audio_dir / latest_filename
    cover_path.write_bytes(content)
    latest_path.write_bytes(content)
    return cover_path


def _cover_image_extension(mime_type: str = "", original_name: str = "") -> str:
    value = mime_type.split(";", 1)[0].strip().lower()
    if value in {"image/jpeg", "image/jpg"}:
        return ".jpg"
    if value == "image/png":
        return ".png"
    if value == "image/webp":
        return ".webp"
    suffix = Path(_safe_media_filename(original_name)).suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg", ".webp"}:
        return ".jpg" if suffix == ".jpeg" else suffix
    return ""


def _is_ffmpeg_image(path: Path) -> bool:
    return path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}


def _write_recording_placeholder(repo_root: Path) -> Path:
    image_dir = generated_image_path("placeholder.png", repo_root).parent
    image_dir.mkdir(parents=True, exist_ok=True)
    path = image_dir / "recording-placeholder.svg"
    if not path.exists():
        path.write_text(
            """<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<rect width="1024" height="1024" fill="#101114"/>
<rect x="64" y="64" width="896" height="896" rx="48" fill="#151b1d" stroke="#60d394" stroke-width="6"/>
<text x="512" y="470" fill="#f4efe6" text-anchor="middle"
      font-family="Segoe UI, sans-serif" font-size="76" font-weight="700">Robot 790</text>
<text x="512" y="560" fill="#9ec7d8" text-anchor="middle"
      font-family="Segoe UI, sans-serif" font-size="42">STS recording</text>
</svg>
""",
            encoding="utf-8",
        )
    return path


def _make_picture_audio_mp4(
    audio_path: Path,
    output_path: Path,
    image_path: Path,
    repo_root: Path,
    *,
    captions: list[dict[str, object]] | None = None,
) -> dict[str, object]:
    temp_audio = output_path.with_name(f"{output_path.stem}.tmp.m4a")
    temp_captions = output_path.with_name(f"{output_path.stem}.captions.ass")
    trimmed = False
    try:
        audio_filter = _recording_audio_filter(trim_silence=True)
        _run_ffmpeg(
            [
                "-y",
                "-i",
                str(audio_path),
                "-vn",
                "-af",
                audio_filter,
                "-c:a",
                "aac",
                "-b:a",
                "48k",
                "-ac",
                "1",
                "-ar",
                "24000",
                str(temp_audio),
            ],
            repo_root,
        )
        duration = _probe_duration(temp_audio, repo_root)
        if duration <= 0:
            raise ValueError("Converted audio has no measurable duration.")
        trimmed = _audio_recording_trim_enabled()
    except (OSError, subprocess.SubprocessError, ValueError) as exc:
        if not _audio_recording_trim_enabled():
            return {"status": "error", "error": str(exc)}
        try:
            temp_audio.unlink()
        except FileNotFoundError:
            pass
        try:
            _run_ffmpeg(
                [
                    "-y",
                    "-i",
                    str(audio_path),
                    "-vn",
                    "-af",
                    _recording_audio_filter(trim_silence=False),
                    "-c:a",
                    "aac",
                    "-b:a",
                    "48k",
                    "-ac",
                    "1",
                    "-ar",
                    "24000",
                    str(temp_audio),
                ],
                repo_root,
            )
            duration = _probe_duration(temp_audio, repo_root)
            if duration <= 0:
                raise ValueError("Converted audio has no measurable duration.")
        except (OSError, subprocess.SubprocessError, ValueError) as fallback_exc:
            return {"status": "error", "error": f"{exc}; fallback failed: {fallback_exc}"}

    try:
        captioned = _write_recording_caption_file(temp_captions, captions or [], duration)
        vf = "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black"
        if captioned:
            vf = f"{vf},fps=24,ass=filename={_ffmpeg_filter_path(temp_captions, repo_root)}"
        else:
            vf = f"{vf},fps=1"
        _run_ffmpeg(
            [
                "-y",
                "-loop",
                "1",
                "-i",
                str(image_path),
                "-i",
                str(temp_audio),
                "-t",
                f"{duration:.3f}",
                "-vf",
                vf,
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-tune",
                "stillimage",
                "-profile:v",
                "baseline",
                "-level",
                "3.0",
                "-pix_fmt",
                "yuv420p",
                "-crf",
                "34",
                "-c:a",
                "copy",
                "-shortest",
                "-movflags",
                "+faststart",
                str(output_path),
            ],
            repo_root,
        )
        return {
            "status": "ok",
            "duration_s": round(duration, 3),
            "trimmed_silence": trimmed,
            "captioned": captioned,
        }
    except (OSError, subprocess.SubprocessError, ValueError) as exc:
        return {"status": "error", "error": str(exc)}
    finally:
        try:
            temp_audio.unlink()
        except FileNotFoundError:
            pass
        try:
            temp_captions.unlink()
        except FileNotFoundError:
            pass


def _recording_audio_filter(*, trim_silence: bool) -> str:
    filters = ["aresample=async=1:first_pts=0"]
    if _audio_recording_cleanup_enabled():
        highpass_hz = _bounded_float_env("ROBOT_790_AUDIO_HIGHPASS_HZ", 90.0, minimum=20.0, maximum=250.0)
        deboom_hz = _bounded_float_env("ROBOT_790_AUDIO_DEBOOM_HZ", 180.0, minimum=80.0, maximum=500.0)
        deboom_gain_db = _bounded_float_env("ROBOT_790_AUDIO_DEBOOM_GAIN_DB", -4.5, minimum=-18.0, maximum=0.0)
        debox_hz = _bounded_float_env("ROBOT_790_AUDIO_DEBOX_HZ", 320.0, minimum=120.0, maximum=900.0)
        debox_gain_db = _bounded_float_env("ROBOT_790_AUDIO_DEBOX_GAIN_DB", -2.5, minimum=-18.0, maximum=0.0)
        filters.extend(
            [
                f"highpass=f={highpass_hz:.1f}",
                f"equalizer=f={deboom_hz:.1f}:t=q:w=1.1:g={deboom_gain_db:.1f}",
                f"equalizer=f={debox_hz:.1f}:t=q:w=1.0:g={debox_gain_db:.1f}",
                "acompressor=threshold=-20dB:ratio=2:attack=8:release=80:makeup=1",
                "alimiter=limit=0.97",
            ]
        )
    if trim_silence and _audio_recording_trim_enabled():
        threshold = _env_text("ROBOT_790_AUDIO_TRIM_THRESHOLD") or "-45dB"
        silence_s = _bounded_float_env("ROBOT_790_AUDIO_TRIM_SILENCE_S", 0.8, minimum=0.1, maximum=5.0)
        start_keep_s = _bounded_float_env("ROBOT_790_AUDIO_TRIM_KEEP_S", 0.65, minimum=0.0, maximum=2.0)
        end_keep_s = _bounded_float_env("ROBOT_790_AUDIO_TRIM_END_KEEP_S", 1.65, minimum=0.0, maximum=4.0)
        start_trim = (
            "silenceremove="
            "start_periods=1:"
            f"start_duration={silence_s:.3f}:"
            f"start_threshold={threshold}:"
            f"start_silence={start_keep_s:.3f}"
        )
        end_trim = (
            "silenceremove="
            "start_periods=1:"
            f"start_duration={silence_s:.3f}:"
            f"start_threshold={threshold}:"
            f"start_silence={end_keep_s:.3f}"
        )
        filters.extend([start_trim, "areverse", end_trim, "areverse"])
    return ",".join(filters)


def _audio_recording_chunk_crossfade_s() -> float:
    return _bounded_float_env("ROBOT_790_AUDIO_CHUNK_CROSSFADE_S", 0.35, minimum=0.0, maximum=2.0)


def _write_recording_caption_file(path: Path, captions: list[dict[str, object]], duration_s: float) -> bool:
    if not captions or not _audio_recording_captions_enabled():
        return False
    cards = _recording_caption_cards(captions, duration_s)
    if not cards:
        return False
    lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        "PlayResX: 512",
        "PlayResY: 512",
        "WrapStyle: 2",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        (
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
            "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, "
            "Shadow, Alignment, MarginL, MarginR, MarginV, Encoding"
        ),
        (
            "Style: Default,Segoe UI,38,&H00FFFFFF,&H000000FF,&H00100F0D,&HAA000000,"
            "-1,0,0,0,100,100,0,0,1,5,2,2,36,36,46,1"
        ),
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    for start_s, end_s, text in cards:
        if end_s <= start_s:
            continue
        lines.append(
            f"Dialogue: 0,{_ass_time(start_s)},{_ass_time(end_s)},Default,,0,0,0,,{_ass_escape(text)}"
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return True


def _recording_caption_cards(captions: list[dict[str, object]], duration_s: float) -> list[tuple[float, float, str]]:
    words_per_card = _bounded_int_env("ROBOT_790_CAPTION_WORDS_PER_CARD", 3, minimum=1, maximum=8)
    offset_ms = _bounded_int_env("ROBOT_790_CAPTION_OFFSET_MS", -150, minimum=-3000, maximum=3000)
    min_card_s = _bounded_float_env("ROBOT_790_CAPTION_MIN_CARD_S", 0.35, minimum=0.1, maximum=2.0)
    max_card_s = _bounded_float_env("ROBOT_790_CAPTION_MAX_CARD_S", 1.4, minimum=0.2, maximum=4.0)
    cards: list[tuple[float, float, str]] = []
    sorted_captions = _normalize_recording_captions(captions)
    for index, caption in enumerate(sorted_captions):
        text = str(caption.get("text") or "").strip()
        words = re.findall(r"\S+", text)
        if not words:
            continue
        start_s = max(0.0, (int(caption["start_ms"]) + offset_ms) / 1000)
        next_start_s = duration_s
        if index + 1 < len(sorted_captions):
            next_start_s = max(start_s + 0.2, (int(sorted_captions[index + 1]["start_ms"]) + offset_ms) / 1000)
        chunk_count = max(1, (len(words) + words_per_card - 1) // words_per_card)
        estimated_s = max(min_card_s, min(max_card_s * chunk_count, len(words) * 0.22))
        span_s = max(min_card_s, min(next_start_s - start_s, estimated_s, duration_s - start_s))
        if span_s <= 0:
            continue
        chunks = [" ".join(words[i : i + words_per_card]) for i in range(0, len(words), words_per_card)]
        card_s = max(min_card_s, min(max_card_s, span_s / max(1, len(chunks))))
        cursor = start_s
        for chunk in chunks:
            end_s = min(duration_s, cursor + card_s)
            if end_s <= cursor:
                break
            cards.append((cursor, end_s, chunk))
            cursor = end_s
            if cursor >= start_s + span_s:
                break
    return cards[:1200]


def _ffmpeg_filter_path(path: Path, repo_root: Path) -> str:
    try:
        value = path.resolve().relative_to(repo_root.resolve()).as_posix()
    except ValueError:
        value = path.resolve().as_posix().replace(":", r"\:")
    return "'" + value.replace("\\", r"\\").replace("'", r"\'") + "'"


def _ffmpeg_concat_path(path: Path) -> str:
    return path.resolve().as_posix().replace("'", r"'\''")


def _ass_escape(value: str) -> str:
    return str(value).replace("\\", r"\\").replace("{", r"\{").replace("}", r"\}").replace("\n", r"\N")


def _ass_time(seconds: float) -> str:
    total_centiseconds = max(0, int(round(seconds * 100)))
    centiseconds = total_centiseconds % 100
    total_seconds = total_centiseconds // 100
    secs = total_seconds % 60
    minutes = (total_seconds // 60) % 60
    hours = total_seconds // 3600
    return f"{hours}:{minutes:02d}:{secs:02d}.{centiseconds:02d}"


def _audio_recording_captions_enabled() -> bool:
    value = os.getenv("ROBOT_790_AUDIO_CAPTIONS", "false").strip().lower()
    return value not in {"0", "false", "no", "off"}


def _audio_recording_trim_enabled() -> bool:
    value = os.getenv("ROBOT_790_AUDIO_TRIM_SILENCE", "true").strip().lower()
    return value not in {"0", "false", "no", "off"}


def _audio_recording_cleanup_enabled() -> bool:
    value = os.getenv("ROBOT_790_AUDIO_CLEANUP", "true").strip().lower()
    return value not in {"0", "false", "no", "off"}


def _run_ffmpeg(args: list[str], cwd: Path) -> None:
    completed = subprocess.run(
        ["ffmpeg", *args],
        check=False,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        cwd=str(cwd),
        timeout=180,
    )
    if completed.returncode != 0:
        tail = (completed.stderr or completed.stdout or "").strip().splitlines()[-4:]
        raise ValueError("ffmpeg failed: " + " | ".join(tail))


def _probe_duration(path: Path, cwd: Path) -> float:
    completed = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        check=False,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        cwd=str(cwd),
        timeout=30,
    )
    if completed.returncode != 0:
        raise ValueError("ffprobe failed.")
    try:
        return float((completed.stdout or "").strip())
    except ValueError as exc:
        raise ValueError("ffprobe returned no duration.") from exc


def _safe_media_filename(filename: str) -> str:
    value = Path(str(filename or "").replace("\\", "/")).name
    return re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip(".-")


def _current_model_string(repo_root: Path) -> str:
    runtime = _read_realtime_runtime_args()
    try:
        status = get_brain_status(repo_root)
    except Exception:
        status = {}

    model = status.get("model")
    if not isinstance(model, dict):
        model = {}

    parts: list[str] = []
    lm_studio = model.get("lm_studio")
    active_model = lm_studio.get("active_model") if isinstance(lm_studio, dict) else None
    llm_model = runtime.get("model_name")
    if isinstance(active_model, dict):
        llm_model = llm_model or active_model.get("identifier") or active_model.get("model")
    if not llm_model:
        llm_model = model.get("llm_model")
    if llm_model:
        parts.append(f"llm={llm_model}")

    reasoning = runtime.get("responses_api_reasoning_effort")
    if not reasoning and runtime.get("_running"):
        reasoning = "omitted"
    if not reasoning:
        reasoning = model.get("reasoning_effort")
    if reasoning:
        parts.append(f"reasoning={reasoning}")

    audio_max_tokens = runtime.get("responses_api_audio_max_tokens") or model.get("audio_max_tokens")
    if audio_max_tokens:
        parts.append(f"audio_max_tokens={audio_max_tokens}")

    if isinstance(active_model, dict):
        context_window = active_model.get("context_window_tokens")
        parallel = active_model.get("parallel_predictions")
        status_text = active_model.get("status")
        if context_window:
            parts.append(f"context={context_window}")
        if parallel:
            parts.append(f"parallel={parallel}")
        if status_text:
            parts.append(f"lm_status={status_text}")

    return " / ".join(parts) if parts else "unknown"


def _read_realtime_runtime_args() -> dict[str, str]:
    command = _read_realtime_commandline()
    if not command:
        return {}
    args = {
        key: value
        for key in ("model_name", "responses_api_reasoning_effort", "responses_api_audio_max_tokens")
        if (value := _command_arg(command, key))
    }
    args["_running"] = "true"
    return args


def _read_realtime_commandline() -> str:
    try:
        completed = subprocess.run(
            [
                "powershell.exe",
                "-NoProfile",
                "-Command",
                (
                    "Get-CimInstance Win32_Process | "
                    "Where-Object { $_.CommandLine -match '-m robot_790d\\.realtime_entry' } | "
                    "Select-Object -First 1 -ExpandProperty CommandLine"
                ),
            ],
            check=False,
            capture_output=True,
            encoding="utf-8",
            errors="replace",
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return ""
    return (completed.stdout or "").strip()


def _command_arg(command: str, name: str) -> str | None:
    match = re.search(rf"--{re.escape(name)}\s+(?:\"([^\"]+)\"|'([^']+)'|(\S+))", command)
    if not match:
        return None
    return next((group for group in match.groups() if group), None)


def _dispatch_cast(payload: dict[str, Any]) -> dict[str, object]:
    action = str(payload.get("action") or "").strip().lower()
    if not action:
        return {"status": "error", "error": "Missing required argument: action"}

    client = CastMediaClient()
    try:
        if action == "devices":
            return client.list_devices()
        if action == "search_youtube":
            return client.search_youtube(str(payload.get("query") or "").strip(), int(payload.get("max_results") or 3))
        if action == "play_youtube":
            return client.play_youtube(
                query=str(payload.get("query") or "").strip() or None,
                video_id=str(payload.get("video_id") or "").strip() or None,
                device_name=str(payload.get("device_name") or "").strip() or None,
            )
        if action == "show_image":
            return client.show_image(
                image_url=str(payload.get("image_url") or "").strip(),
                title=str(payload.get("title") or "").strip() or None,
                device_name=str(payload.get("device_name") or "").strip() or None,
            )
        if action == "stop":
            return client.stop(str(payload.get("device_name") or "").strip() or None)
    except ModuleNotFoundError as exc:
        return {"status": "error", "error": f"Missing Cast media dependency: {exc.name}"}
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}

    return {"status": "error", "error": f"Unsupported cast_media action: {action}"}


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the Robot 790 STS page and local helper APIs.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8790)
    parser.add_argument("--directory", type=Path, default=Path(__file__).resolve().parents[2] / "web" / "sts")
    args = parser.parse_args()

    handler = partial(StsPageHandler, directory=str(args.directory))
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Starting Robot 790 STS page at http://{args.host}:{args.port}/")
    print(f"Serving {args.directory}")
    server.serve_forever()


if __name__ == "__main__":
    main()

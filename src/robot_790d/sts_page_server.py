from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import subprocess
from datetime import datetime
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlsplit

from robot_790d.brain_status import get_brain_status
from robot_790d.image_generation import GENERATED_IMAGE_URL_PREFIX, generate_image, generated_image_path
from robot_790d.media_cast import CastMediaClient
from robot_790d.note_files import list_note_files, read_note_file, write_note_file
from robot_790d.smart_home import control_smart_home_device
from robot_790d.weather import DEFAULT_WEATHER_LOCATION, lookup_weather
from robot_790d.web_search import search_web

AUDIO_RECORDING_URL_PREFIX = "/recorded-audio/"


class StsPageHandler(SimpleHTTPRequestHandler):
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
        if parsed.path == "/api/notes/read":
            self._handle_note_read(parsed.query)
            return
        if parsed.path == "/api/notes/list":
            self._handle_note_list()
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

    def _handle_runtime_config(self) -> None:
        current_embodiment = (
            _env_text("ROBOT_790_CURRENT_EMBODIMENT")
            or (
                "Your current embodiment is a local ESP32-driven face: eye displays, mouth display, voice, "
                "and optional tracked chassis tools when connected."
            )
        )
        body_trajectory = (
            _env_text("ROBOT_790_BODY_TRAJECTORY")
            or (
                "Your body is an evolving 790-inspired robot platform; treat live runtime state and tool results "
                "as the authority on what you can currently do."
            )
        )
        self._send_json(
            200,
            {
                "status": "ok",
                "current_embodiment": current_embodiment,
                "body_trajectory": body_trajectory,
                "idle_level12_cooldown_s": _env_float("ROBOT_790_IDLE_LEVEL12_COOLDOWN_S", 12.0),
            },
        )

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
            content = self._read_binary_body(max_bytes=250 * 1024 * 1024)
            result = record_audio_snapshot(
                content,
                self.headers.get("Content-Type") or "",
                image_filename=self.headers.get("X-Robot-790-Image-Filename") or "",
            )
        except (OSError, ValueError) as exc:
            self._send_json(400, {"status": "error", "error": str(exc)})
            return
        self._send_json(200, result)

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
        preset = str(payload.get("preset") or "qwen27").strip()
        allowed_presets = {"qwen27", "qwen9", "qwen4", "nemotron30", "openai"}
        if preset not in allowed_presets:
            self._send_json(400, {"status": "error", "error": f"Unsupported model preset: {preset}."})
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


def _bounded_float_env(name: str, default: float, *, minimum: float, maximum: float) -> float:
    value = _env_float(name, default)
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
    if value not in {"conversation", "events", "session"}:
        value = "session"
    return value


def record_audio_snapshot(
    content: bytes,
    mime_type: str,
    repo_root: Path | None = None,
    *,
    image_filename: str = "",
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

    image_path = _selected_recording_image(root, image_filename)
    mp4_filename = f"{timestamp}-sts-audio-picture.mp4"
    mp4_latest_name = "latest-sts-audio-picture.mp4"
    mp4_path = audio_dir / mp4_filename
    mp4_latest_path = audio_dir / mp4_latest_name
    conversion = _make_picture_audio_mp4(raw_path, mp4_path, image_path, root)
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
        "duration_s": conversion.get("duration_s"),
        "trimmed_silence": conversion.get("trimmed_silence", False),
    }


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
) -> dict[str, object]:
    temp_audio = output_path.with_name(f"{output_path.stem}.tmp.m4a")
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
                "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black,fps=1",
                "-c:v",
                "libx264",
                "-preset",
                "veryslow",
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
        return {"status": "ok", "duration_s": round(duration, 3), "trimmed_silence": trimmed}
    except (OSError, subprocess.SubprocessError, ValueError) as exc:
        return {"status": "error", "error": str(exc)}
    finally:
        try:
            temp_audio.unlink()
        except FileNotFoundError:
            pass


def _recording_audio_filter(*, trim_silence: bool) -> str:
    filters = ["aresample=async=1:first_pts=0"]
    if trim_silence and _audio_recording_trim_enabled():
        threshold = _env_text("ROBOT_790_AUDIO_TRIM_THRESHOLD") or "-45dB"
        silence_s = _bounded_float_env("ROBOT_790_AUDIO_TRIM_SILENCE_S", 0.8, minimum=0.1, maximum=5.0)
        keep_s = _bounded_float_env("ROBOT_790_AUDIO_TRIM_KEEP_S", 0.15, minimum=0.0, maximum=2.0)
        edge_trim = (
            "silenceremove="
            "start_periods=1:"
            f"start_duration={silence_s:.3f}:"
            f"start_threshold={threshold}:"
            f"start_silence={keep_s:.3f}"
        )
        filters.extend([edge_trim, "areverse", edge_trim, "areverse"])
    return ",".join(filters)


def _audio_recording_trim_enabled() -> bool:
    value = os.getenv("ROBOT_790_AUDIO_TRIM_SILENCE", "true").strip().lower()
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

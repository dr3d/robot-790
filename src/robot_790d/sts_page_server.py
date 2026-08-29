from __future__ import annotations

import argparse
import json
import mimetypes
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
from robot_790d.weather import DEFAULT_WEATHER_LOCATION, lookup_weather
from robot_790d.web_search import search_web


class StsPageHandler(SimpleHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed = urlsplit(self.path)
        if parsed.path.startswith(GENERATED_IMAGE_URL_PREFIX):
            self._handle_generated_image(parsed.path)
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
        if parsed.path == "/api/images/generate":
            self._handle_image_generate()
            return
        if parsed.path == "/api/cast":
            self._handle_cast()
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

    def _handle_image_generate(self) -> None:
        try:
            payload = self._read_json_body()
            result = generate_image(
                str(payload.get("prompt") or ""),
                title=str(payload.get("title") or ""),
                provider=str(payload.get("provider") or "").strip() or None,
                size=str(payload.get("size") or "").strip() or None,
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

    def _handle_cast(self) -> None:
        try:
            payload = self._read_json_body()
            result = _dispatch_cast(payload)
        except (ModuleNotFoundError, ValueError) as exc:
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

from __future__ import annotations

import argparse
import json
import subprocess
from datetime import datetime
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit

from robot_790d.media_cast import CastMediaClient
from robot_790d.note_files import list_note_files, read_note_file, write_note_file
from robot_790d.web_search import search_web


class StsPageHandler(SimpleHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed = urlsplit(self.path)
        if parsed.path == "/api/search":
            self._handle_search(parsed.query)
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
        max_results = _first_param(params, "max_results") or "5"
        payload = search_web(query, max_results=max_results)
        status_code = 200 if payload.get("status") == "ok" else 400
        self._send_json(status_code, payload)

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
                "preset": "gold",
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
    header = [
        "Robot 790 Live Log Snapshot",
        "===========================",
        f"Recorded: {datetime.now().isoformat(timespec='seconds')}",
        f"Source: {safe_source}",
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

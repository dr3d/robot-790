from __future__ import annotations

import argparse
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit

from robot_790d.web_search import search_web


class StsPageHandler(SimpleHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed = urlsplit(self.path)
        if parsed.path == "/api/search":
            self._handle_search(parsed.query)
            return
        super().do_GET()

    def _handle_search(self, query_string: str) -> None:
        params = parse_qs(query_string)
        query = _first_param(params, "q") or _first_param(params, "query") or ""
        max_results = _first_param(params, "max_results") or "5"
        payload = search_web(query, max_results=max_results)
        status_code = 200 if payload.get("status") == "ok" else 400
        self._send_json(status_code, payload)

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

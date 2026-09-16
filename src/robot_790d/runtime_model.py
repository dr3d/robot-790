"""Share the launcher's local model selection with background LLM callers."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

SELECTION_PATH = Path(__file__).resolve().parents[2] / "logs" / "active-llm.json"


def _local(url: str) -> bool:
    return urlsplit(url).hostname in {"localhost", "127.0.0.1", "::1"}


def select_model(model: str, base_url: str) -> None:
    if not model.strip() or any(c in model for c in "\r\n"):
        raise ValueError("A valid model identifier is required")
    SELECTION_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = SELECTION_PATH.with_suffix(f".{os.getpid()}.tmp")
    temporary.write_text(json.dumps({"model": model.strip(), "base_url": base_url}), encoding="utf-8")
    os.replace(temporary, SELECTION_PATH)


def local_runtime_model(base_url: str = "http://127.0.0.1:1234/v1") -> str | None:
    if not _local(base_url):
        return None
    try:
        selected = json.loads(SELECTION_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    # Invalid state must not silently reload the legacy model.
    if not isinstance(selected, dict) or not isinstance(selected.get("model"), str) or not selected["model"].strip():
        raise ValueError("Invalid active LLM selection; restart the realtime server")
    if not _local(str(selected.get("base_url", ""))):
        raise ValueError("Local background LLM work is disabled while the selected brain is remote")
    return selected["model"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--base-url", required=True)
    args = parser.parse_args()
    select_model(args.model, args.base_url)

"""Speech-model choices and capabilities, separate from numeric precision."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

MODEL_SIZES = ("0.6B", "1.7B")


def model_path(size: str) -> Path:
    if size not in MODEL_SIZES:
        raise ValueError("Speech model must be 0.6B or 1.7B.")
    root = os.environ.get("ROBOT_790_TTS_MODEL_DIR")
    directory = Path(root) if root else Path.home() / "ComfyUI_windows_portable/ComfyUI/models/TTS"
    return directory / f"Qwen3-TTS-12Hz-{size}-CustomVoice"


def model_installed(size: str) -> bool:
    directory = model_path(size)
    return (directory / "config.json").is_file() and any(directory.glob("*.safetensors"))


def describe_tts(args: dict[str, str]) -> dict[str, Any]:
    model = args.get("qwen3_tts_model_name", "").replace("\\", "/").rstrip("/").rsplit("/", 1)[-1]
    size = next((size for size in MODEL_SIZES if model.lower() == f"qwen3-tts-12hz-{size}-customvoice".lower()), None)
    running = args.get("_running") == "true"
    precision = args.get("qwen3_tts_dtype")
    return {
        "status": "ok",
        "active": {
            "running": running,
            "model": size if running else None,
            "label": model if running else "Speech server stopped",
            "precision": precision if running and precision in {"bfloat16", "float16"} else None,
            "style_instructions": (size == "1.7B") if running and size else None,
        },
        "models": [
            {"id": size, "installed": model_installed(size), "style_instructions": size == "1.7B"}
            for size in MODEL_SIZES
        ],
    }

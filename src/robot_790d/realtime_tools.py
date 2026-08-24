import asyncio
import json
import os
from dataclasses import dataclass
from typing import Any

from robot_790d.behavior import BehaviorDaemon
from robot_790d.devices.esp32_face import DEFAULT_FACE_URL, Esp32FaceClient, FaceSettings
from robot_790d.state import Affect, RobotMode

try:
    from speech_to_speech.api.openai_realtime.audio_client import ToolResult
except ImportError:

    @dataclass(frozen=True)
    class ToolResult:  # type: ignore[no-redef]
        result: dict[str, object]
        create_response: bool = False


TOOLS: list[dict[str, object]] = [
    {
        "type": "function",
        "name": "set_robot_mode",
        "description": "Set Robot 790's face behavior state while the realtime voice loop changes turn state.",
        "parameters": {
            "type": "object",
            "properties": {
                "mode": {
                    "type": "string",
                    "enum": [mode.value for mode in RobotMode],
                    "description": "The high-level robot state to show on the face.",
                },
                "energy": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1,
                    "description": "Optional speaking or animation energy from 0.0 to 1.0.",
                },
            },
            "required": ["mode"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "play_face_beat",
        "description": "Play one named autonomous face beat, such as mischief, scan, or blink-heavy idling.",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Beat name understood by the ESP32 face firmware.",
                }
            },
            "required": ["name"],
            "additionalProperties": False,
        },
    },
]


async def execute_tool(name: str, arguments: dict[str, object] | str | None) -> ToolResult:
    """speech-to-speech tool entrypoint for Robot 790 face/body cues."""
    parsed = _parse_arguments(arguments)

    if name == "set_robot_mode":
        result = await asyncio.to_thread(_set_robot_mode, parsed)
    elif name == "play_face_beat":
        result = await asyncio.to_thread(_play_face_beat, parsed)
    else:
        result = {"status": "error", "error": f"Unknown Robot 790 tool: {name}"}

    return ToolResult(result, create_response=False)


def _set_robot_mode(arguments: dict[str, object]) -> dict[str, object]:
    raw_mode = str(arguments.get("mode", "")).strip().lower()
    if not raw_mode:
        return {"status": "error", "error": "Missing required argument: mode"}

    try:
        mode = RobotMode(raw_mode)
    except ValueError:
        allowed = ", ".join(mode.value for mode in RobotMode)
        return {"status": "error", "error": f"Unsupported mode '{raw_mode}'. Expected one of: {allowed}"}

    energy = _float_argument(arguments.get("energy"), default=0.55)
    daemon, face = _build_daemon()
    try:
        result = daemon.set_mode(mode, Affect(energy=energy))
    finally:
        face.close()

    return {"status": "ok", "tool": "set_robot_mode", "mode": mode.value, "face": result}


def _play_face_beat(arguments: dict[str, object]) -> dict[str, object]:
    beat_name = str(arguments.get("name", "")).strip()
    if not beat_name:
        return {"status": "error", "error": "Missing required argument: name"}

    daemon, face = _build_daemon()
    try:
        result = daemon.play_beat(beat_name)
    finally:
        face.close()

    return {"status": "ok", "tool": "play_face_beat", "beat": beat_name, "face": result}


def _build_daemon() -> tuple[BehaviorDaemon, Esp32FaceClient]:
    base_url = os.getenv("ROBOT_790_FACE_URL", DEFAULT_FACE_URL)
    timeout_s = _float_argument(os.getenv("ROBOT_790_FACE_TIMEOUT_S"), default=0.8)
    face = Esp32FaceClient(FaceSettings(base_url=base_url, timeout_s=timeout_s))
    return BehaviorDaemon(face), face


def _parse_arguments(arguments: dict[str, object] | str | None) -> dict[str, object]:
    if arguments is None:
        return {}
    if isinstance(arguments, dict):
        return arguments
    try:
        data: Any = json.loads(arguments)
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def _float_argument(value: object, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default

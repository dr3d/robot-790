import asyncio
import json
import os
import threading
import time
from dataclasses import dataclass
from typing import Any

from robot_790d.behavior import BehaviorDaemon
from robot_790d.devices.esp32_chassis import DEFAULT_CHASSIS_URL, ChassisSettings, Esp32ChassisClient
from robot_790d.devices.esp32_face import DEFAULT_FACE_URL, Esp32FaceClient, FaceSettings
from robot_790d.memory import forget_fact, remember_fact
from robot_790d.state import Affect, RobotMode
from robot_790d.web_search import search_web

try:
    from speech_to_speech.api.openai_realtime.audio_client import ToolResult
except ImportError:

    @dataclass(frozen=True)
    class ToolResult:  # type: ignore[no-redef]
        result: dict[str, object]
        create_response: bool = False


MAX_CHASSIS_DURATION_S = 5.0
_CHASSIS_DRIVE_LOCK = threading.Lock()

TOOLS: list[dict[str, object]] = [
    {
        "type": "function",
        "name": "set_robot_mode",
        "description": (
            "Set Robot 790's face behavior state while the realtime voice loop changes turn state. "
            "Use sleeping when the user says go to sleep, close your eyes, or sleep."
        ),
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
        "description": (
            "Play one named autonomous face beat when the user asks for a funny face, silly face, "
            "expressive action, scan, double take, or animated beat."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "enum": [
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
                        "drowsy",
                        "robot_scan",
                        "wary",
                        "startle",
                    ],
                    "description": "Beat name supported by the ESP32 face firmware.",
                }
            },
            "required": ["name"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "set_face_mood",
        "description": (
            "Set a specific Robot 790 ESP32 face mood when the user asks for an emotion, "
            "mood, or expression by name."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "enum": [
                        "calm",
                        "curious",
                        "surprised",
                        "suspicious",
                        "afraid",
                        "angry",
                        "sleepy",
                        "sleep",
                        "goofy",
                        "robotic",
                        "wonder",
                        "glitchy",
                        "happy",
                        "delighted",
                        "bashful",
                        "bored",
                        "focused",
                        "confused",
                        "proud",
                        "mischief",
                        "affection",
                    ],
                    "description": "Mood name supported by the ESP32 face firmware.",
                },
                "duration": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 30,
                    "description": "Seconds to hold the mood. Use 0 for the firmware default.",
                },
            },
            "required": ["name"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "set_eye_gaze",
        "description": (
            "Aim Robot 790's eyes at a simple normalized gaze target when the user asks the robot to look "
            "left, right, up, down, center, or at a particular direction."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "x": {
                    "type": "number",
                    "minimum": -1,
                    "maximum": 1,
                    "description": "Normalized left/right gaze target from -1.0 to 1.0.",
                },
                "y": {
                    "type": "number",
                    "minimum": -1,
                    "maximum": 1,
                    "description": "Normalized up/down gaze target from -1.0 to 1.0.",
                },
                "duration": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 30,
                    "description": "Seconds to hold the gaze. Use 0 to hold until released.",
                },
                "move_ms": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 2000,
                    "description": "Transition time in milliseconds.",
                },
            },
            "required": ["x", "y"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "set_chassis",
        "description": (
            "Control Robot 790's optional ESP32 tracked chassis with exactly one immediate command: status, "
            "stop, e-stop, clear e-stop, tank drive, or twist drive. Never queue, chain, or choreograph "
            "multi-step drive sequences. Prefer slow, short moves. If the user asks for full or maximum speed, "
            "use 1.0, matching the chassis web UI max-speed value; the firmware applies the voltage duty cap."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["status", "stop", "estop", "clear", "tank", "twist"],
                    "description": "Chassis action. Use estop for urgent safety and stop when movement should end.",
                },
                "left": {
                    "type": "number",
                    "minimum": -1.0,
                    "maximum": 1.0,
                    "description": "Left track speed for tank action, -1.0 reverse to 1.0 forward.",
                },
                "right": {
                    "type": "number",
                    "minimum": -1.0,
                    "maximum": 1.0,
                    "description": "Right track speed for tank action, -1.0 reverse to 1.0 forward.",
                },
                "velocity": {
                    "type": "number",
                    "minimum": -1.0,
                    "maximum": 1.0,
                    "description": "Forward/reverse velocity for twist action, -1.0 reverse to 1.0 forward.",
                },
                "turn": {
                    "type": "number",
                    "minimum": -1.0,
                    "maximum": 1.0,
                    "description": "Turn rate for twist action, -1.0 left to 1.0 right.",
                },
                "duration_s": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": MAX_CHASSIS_DURATION_S,
                    "description": "Optional movement duration for one firmware-timed segment, capped at 5 seconds.",
                },
            },
            "required": ["action"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "remember_fact",
        "description": (
            "Persist one named fact only when the user explicitly asks Robot 790 to remember it. "
            "Use stable facts such as names, preferences, projects, or robot setup details. "
            "Do not save passwords, addresses, payment data, medical details, or fleeting chatter."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Short snake_case memory key, such as user_name or current_project.",
                },
                "fact": {
                    "type": "string",
                    "description": "One short sentence containing the fact to remember.",
                },
            },
            "required": ["name", "fact"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "forget_fact",
        "description": "Remove one named persistent fact when the user explicitly asks Robot 790 to forget it.",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Short snake_case memory key to remove.",
                }
            },
            "required": ["name"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "search_web",
        "description": (
            "Search the web for current information and return compact title, snippet, and URL results. "
            "Call this directly when the user asks Robot 790 to search, look something up, check the web, "
            "find current information, or learn what is happening now."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query."},
                "max_results": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 10,
                    "default": 5,
                    "description": "Maximum number of search results to return.",
                },
            },
            "required": ["query"],
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
    elif name == "set_face_mood":
        result = await asyncio.to_thread(_set_face_mood, parsed)
    elif name == "set_eye_gaze":
        result = await asyncio.to_thread(_set_eye_gaze, parsed)
    elif name == "set_chassis":
        result = await asyncio.to_thread(_set_chassis, parsed)
    elif name == "remember_fact":
        result = await asyncio.to_thread(_remember_fact, parsed)
    elif name == "forget_fact":
        result = await asyncio.to_thread(_forget_fact, parsed)
    elif name == "search_web":
        result = await asyncio.to_thread(_search_web, parsed)
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


def _set_face_mood(arguments: dict[str, object]) -> dict[str, object]:
    mood_name = str(arguments.get("name", "")).strip()
    if not mood_name:
        return {"status": "error", "error": "Missing required argument: name"}

    duration = _float_argument(arguments.get("duration"), default=0.0)
    duration = _clamp(duration, 0.0, 30.0)
    _daemon, face = _build_daemon()
    try:
        result = face.emotion(mood_name, duration_s=duration or None)
    finally:
        face.close()

    return {"status": "ok", "tool": "set_face_mood", "mood": mood_name, "face": result}


def _set_eye_gaze(arguments: dict[str, object]) -> dict[str, object]:
    x = _clamp(_float_argument(arguments.get("x"), default=0.0), -1.0, 1.0)
    y = _clamp(_float_argument(arguments.get("y"), default=0.0), -1.0, 1.0)
    duration = _clamp(_float_argument(arguments.get("duration"), default=2.0), 0.0, 30.0)
    move_ms = int(_clamp(_float_argument(arguments.get("move_ms"), default=180.0), 0.0, 2000.0))

    _daemon, face = _build_daemon()
    try:
        result = face.gaze(x, y, duration_s=duration, move_ms=move_ms)
    finally:
        face.close()

    return {"status": "ok", "tool": "set_eye_gaze", "x": x, "y": y, "duration": duration, "face": result}


def _set_chassis(arguments: dict[str, object]) -> dict[str, object]:
    action = str(arguments.get("action", "")).strip().lower()
    if not action:
        return {"status": "error", "error": "Missing required argument: action"}

    chassis = _build_chassis()
    try:
        if action == "status":
            return {"status": "ok", "tool": "set_chassis", "action": action, "chassis": chassis.status()}
        if action == "stop":
            return {"status": "ok", "tool": "set_chassis", "action": action, "chassis": chassis.stop()}
        if action == "estop":
            return {"status": "ok", "tool": "set_chassis", "action": action, "chassis": chassis.estop()}
        if action == "clear":
            return {"status": "ok", "tool": "set_chassis", "action": action, "chassis": chassis.clear()}
        if action == "tank":
            left = _clamp(_float_argument(arguments.get("left"), default=0.0), -1.0, 1.0)
            right = _clamp(_float_argument(arguments.get("right"), default=0.0), -1.0, 1.0)
            return _run_chassis_drive(chassis, action, arguments, lambda duration: chassis.tank(left, right, duration))
        if action == "twist":
            velocity = _clamp(_float_argument(arguments.get("velocity"), default=0.0), -1.0, 1.0)
            turn = _clamp(_float_argument(arguments.get("turn"), default=0.0), -1.0, 1.0)
            return _run_chassis_drive(
                chassis,
                action,
                arguments,
                lambda duration: chassis.twist(velocity, turn, duration),
            )
    finally:
        chassis.close()

    return {"status": "error", "error": f"Unsupported chassis action: {action}"}


def _run_chassis_drive(
    chassis: Esp32ChassisClient,
    action: str,
    arguments: dict[str, object],
    drive_once: Any,
) -> dict[str, object]:
    if not _CHASSIS_DRIVE_LOCK.acquire(blocking=False):
        return {
            "status": "error",
            "error": "Chassis drive command already in progress; refusing to queue another movement.",
            "queued": False,
        }
    try:
        duration_s = _clamp(_float_argument(arguments.get("duration_s"), default=0.0), 0.0, MAX_CHASSIS_DURATION_S)
        duration_arg = duration_s if duration_s > 0 else None
        drive_result = drive_once(duration_arg)
        if duration_s <= 0:
            return {
                "status": "ok",
                "tool": "set_chassis",
                "action": action,
                "duration_s": 0.0,
                "queued": False,
                "chassis": drive_result,
            }

        time.sleep(duration_s)
        stop_result = chassis.stop()
        errors = [
            result["error"]
            for result in (drive_result, stop_result)
            if isinstance(result, dict) and "error" in result
        ]
        if errors:
            return {
                "status": "error",
                "error": "; ".join(str(error) for error in errors),
                "queued": False,
                "drive": drive_result,
                "stop": stop_result,
            }
        return {
            "status": "ok",
            "tool": "set_chassis",
            "action": action,
            "duration_s": duration_s,
            "commands_sent": 1,
            "queued": False,
            "drive": drive_result,
            "stop": stop_result,
        }
    finally:
        _CHASSIS_DRIVE_LOCK.release()


def _remember_fact(arguments: dict[str, object]) -> dict[str, object]:
    name = str(arguments.get("name", "")).strip()
    fact = str(arguments.get("fact", "")).strip()
    if not name:
        return {"status": "error", "error": "Missing required argument: name"}
    if not fact:
        return {"status": "error", "error": "Missing required argument: fact"}

    stored = remember_fact(os.getenv("ROBOT_790_INSTANCE_PATH"), name, fact)
    if stored is None:
        return {"status": "error", "error": "Memory fact was empty or invalid"}
    return {"status": "ok", "tool": "remember_fact", "name": stored.name, "fact": stored.fact}


def _forget_fact(arguments: dict[str, object]) -> dict[str, object]:
    name = str(arguments.get("name", "")).strip()
    if not name:
        return {"status": "error", "error": "Missing required argument: name"}

    removed = forget_fact(os.getenv("ROBOT_790_INSTANCE_PATH"), name)
    if removed is None:
        return {"status": "error", "error": f"No memory fact named '{name}'"}
    return {"status": "ok", "tool": "forget_fact", "name": removed.name, "removed": removed.fact}


def _search_web(arguments: dict[str, object]) -> dict[str, object]:
    query = str(arguments.get("query", "")).strip()
    max_results = arguments.get("max_results", 5)
    return search_web(query, max_results=max_results)


def _build_daemon() -> tuple[BehaviorDaemon, Esp32FaceClient]:
    base_url = os.getenv("ROBOT_790_FACE_URL", DEFAULT_FACE_URL)
    timeout_s = _float_argument(os.getenv("ROBOT_790_FACE_TIMEOUT_S"), default=0.8)
    face = Esp32FaceClient(FaceSettings(base_url=base_url, timeout_s=timeout_s))
    return BehaviorDaemon(face), face


def _build_chassis() -> Esp32ChassisClient:
    base_url = os.getenv("ROBOT_790_CHASSIS_URL", DEFAULT_CHASSIS_URL)
    timeout_s = _float_argument(os.getenv("ROBOT_790_CHASSIS_TIMEOUT_S"), default=0.8)
    return Esp32ChassisClient(ChassisSettings(base_url=base_url, timeout_s=timeout_s))


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


def _clamp(value: float, low: float, high: float) -> float:
    return min(max(value, low), high)

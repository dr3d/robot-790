import asyncio
import json
import os
import threading
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

from robot_790d.behavior import BehaviorDaemon
from robot_790d.devices.esp32_chassis import DEFAULT_CHASSIS_URL, ChassisSettings, Esp32ChassisClient
from robot_790d.devices.esp32_face import DEFAULT_FACE_URL, Esp32FaceClient, FaceSettings
from robot_790d.media_cast import CastMediaClient
from robot_790d.memory import forget_fact, remember_fact
from robot_790d.note_files import list_note_files, read_note_file, write_note_file
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
        "name": "set_eye_style",
        "description": (
            "Set Robot 790's eye rendering style when the user explicitly asks for eye style, "
            "robot eyes, friendly eyes, classic eyes, cartoony eyes, sinister/red eyes, or sleepy eyes."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "enum": ["friendly", "classic", "cartoony", "robot", "sinister", "sleepy"],
                    "description": "Eye style supported by the ESP32 face firmware.",
                }
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
        "name": "set_mouth",
        "description": (
            "Set Robot 790's mouth style or shape when the user asks for a human mouth, robot mouth, "
            "smile, smirk, frown, grimace, sneer, open mouth, talking mouth, sleeping mouth, or auto mouth."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "style": {
                    "type": "string",
                    "enum": ["human", "robot"],
                    "description": "Optional mouth renderer style.",
                },
                "shape": {
                    "type": "string",
                    "enum": [
                        "neutral",
                        "smile",
                        "smirk_left",
                        "smirk_right",
                        "open",
                        "wide",
                        "frown",
                        "grimace",
                        "sneer",
                        "sleep",
                    ],
                    "description": "Optional mouth shape.",
                },
                "talking": {
                    "type": "boolean",
                    "description": "Whether the mouth should animate as talking.",
                },
                "energy": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1,
                    "description": "Optional mouth animation energy.",
                },
                "duration": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 30,
                    "description": "Seconds to hold the manual mouth. Use 0 to hold until released.",
                },
                "auto": {
                    "type": "boolean",
                    "description": "True releases the mouth back to autonomous firmware control.",
                },
            },
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
    {
        "type": "function",
        "name": "cast_media",
        "description": (
            "Search YouTube, play videos, show direct image URLs, list Cast receivers, or stop playback on "
            "Robot 790's configured Chromecast-compatible TV. Use this when the user asks to show, watch, "
            "cast, play, or put YouTube videos or pictures on the TV."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["devices", "search_youtube", "play_youtube", "show_image", "stop"],
                    "description": "Media action to perform.",
                },
                "query": {
                    "type": "string",
                    "description": "YouTube search query. For play_youtube, this plays the first matching result.",
                },
                "video_id": {
                    "type": "string",
                    "description": "YouTube video ID or watch/shorts URL to play directly.",
                },
                "device_name": {
                    "type": "string",
                    "description": "Optional Cast device name. Defaults to Living Room TV.",
                },
                "image_url": {
                    "type": "string",
                    "description": "Direct HTTP or HTTPS image URL for show_image.",
                },
                "title": {
                    "type": "string",
                    "description": "Optional short title for a cast image.",
                },
                "max_results": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 5,
                    "description": "Number of YouTube search results to return for search_youtube.",
                },
            },
            "required": ["action"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "show_web_page",
        "description": (
            "Open or display an HTTP or HTTPS web page from a client UI. Use this when the user asks "
            "to show, open, display, or bring up a website, article, document page, search result page, "
            "dashboard, or other normal web page in the UI."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "HTTP or HTTPS URL for the web page to display."},
                "title": {"type": "string", "description": "Optional short label for the web page."},
            },
            "required": ["url"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "write_text_file",
        "description": (
            "Write or append plain text to a Robot 790 note file only when the user explicitly asks to save, write, "
            "append, or put text into a named file. Use .txt by default unless the user explicitly names .md."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "filename": {
                    "type": "string",
                    "description": (
                        "Relative filename inside Robot 790's notes folder. "
                        "If no extension is given, .txt is used."
                    ),
                },
                "content": {"type": "string", "description": "Plain text content to write."},
                "mode": {
                    "type": "string",
                    "enum": ["overwrite", "append"],
                    "default": "overwrite",
                    "description": "overwrite replaces the file; append adds to the end.",
                },
            },
            "required": ["filename", "content"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "read_text_file",
        "description": "Read a .txt or .md note file from Robot 790's notes folder when the user explicitly asks.",
        "parameters": {
            "type": "object",
            "properties": {
                "filename": {
                    "type": "string",
                    "description": (
                        "Relative filename inside Robot 790's notes folder. "
                        "If no extension is given, .txt is used."
                    ),
                }
            },
            "required": ["filename"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "list_text_files",
        "description": "List Robot 790 note files when the user explicitly asks what notes or text files exist.",
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
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
    elif name == "set_eye_style":
        result = await asyncio.to_thread(_set_eye_style, parsed)
    elif name == "set_eye_gaze":
        result = await asyncio.to_thread(_set_eye_gaze, parsed)
    elif name == "set_mouth":
        result = await asyncio.to_thread(_set_mouth, parsed)
    elif name == "set_chassis":
        result = await asyncio.to_thread(_set_chassis, parsed)
    elif name == "remember_fact":
        result = await asyncio.to_thread(_remember_fact, parsed)
    elif name == "forget_fact":
        result = await asyncio.to_thread(_forget_fact, parsed)
    elif name == "search_web":
        result = await asyncio.to_thread(_search_web, parsed)
    elif name == "cast_media":
        result = await asyncio.to_thread(_cast_media, parsed)
    elif name == "show_web_page":
        result = await asyncio.to_thread(_show_web_page, parsed)
    elif name == "write_text_file":
        result = await asyncio.to_thread(_write_text_file, parsed)
    elif name == "read_text_file":
        result = await asyncio.to_thread(_read_text_file, parsed)
    elif name == "list_text_files":
        result = await asyncio.to_thread(_list_text_files)
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


def _set_eye_style(arguments: dict[str, object]) -> dict[str, object]:
    style_name = str(arguments.get("name", "")).strip()
    if not style_name:
        return {"status": "error", "error": "Missing required argument: name"}

    _daemon, face = _build_daemon()
    try:
        result = face.style(style_name)
    finally:
        face.close()

    return {"status": "ok", "tool": "set_eye_style", "style": style_name, "face": result}


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


def _set_mouth(arguments: dict[str, object]) -> dict[str, object]:
    auto = bool(arguments.get("auto", False))
    style = str(arguments.get("style", "")).strip() or None
    shape = str(arguments.get("shape", "")).strip() or None
    talking = arguments.get("talking")
    talking_bool = bool(talking) if talking is not None else None
    energy = (
        _clamp(_float_argument(arguments.get("energy"), default=0.65), 0.0, 1.0)
        if arguments.get("energy") is not None
        else None
    )
    duration = (
        _clamp(_float_argument(arguments.get("duration"), default=0.0), 0.0, 30.0)
        if arguments.get("duration") is not None
        else None
    )

    if not auto and style is None and shape is None and talking_bool is None and energy is None:
        return {"status": "error", "error": "Missing mouth style, shape, talking, energy, or auto=true"}

    _daemon, face = _build_daemon()
    try:
        result = face.mouth(
            style=style,
            shape=shape,
            talking=talking_bool,
            energy=energy,
            duration_s=duration,
            auto=auto,
        )
    finally:
        face.close()

    return {
        "status": "ok",
        "tool": "set_mouth",
        "style": style,
        "shape": shape,
        "talking": talking_bool,
        "auto": auto,
        "face": result,
    }


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


def _cast_media(arguments: dict[str, object]) -> dict[str, object]:
    action = str(arguments.get("action", "")).strip().lower()
    if not action:
        return {"status": "error", "error": "Missing required argument: action"}

    client = CastMediaClient()
    try:
        if action == "devices":
            return client.list_devices()
        if action == "search_youtube":
            query = str(arguments.get("query") or "").strip()
            max_results = int(_clamp(_float_argument(arguments.get("max_results"), default=3.0), 1.0, 5.0))
            return client.search_youtube(query, max_results)
        if action == "play_youtube":
            return client.play_youtube(
                query=str(arguments.get("query") or "").strip() or None,
                video_id=str(arguments.get("video_id") or "").strip() or None,
                device_name=str(arguments.get("device_name") or "").strip() or None,
            )
        if action == "show_image":
            return client.show_image(
                image_url=str(arguments.get("image_url") or "").strip(),
                title=str(arguments.get("title") or "").strip() or None,
                device_name=str(arguments.get("device_name") or "").strip() or None,
            )
        if action == "stop":
            return client.stop(str(arguments.get("device_name") or "").strip() or None)
    except ModuleNotFoundError as exc:
        return {"status": "error", "error": f"Missing Cast media dependency: {exc.name}"}
    except ValueError as exc:
        return {"status": "error", "error": str(exc)}

    return {"status": "error", "error": f"Unsupported cast_media action: {action}"}


def _show_web_page(arguments: dict[str, object]) -> dict[str, object]:
    url = str(arguments.get("url") or "").strip()
    title = str(arguments.get("title") or "").strip()
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return {"status": "error", "error": "url must be an HTTP or HTTPS web page URL"}

    result: dict[str, object] = {"status": "ok", "tool": "show_web_page", "url": url, "source": "web"}
    if title:
        result["title"] = title[:80]
    return result


def _write_text_file(arguments: dict[str, object]) -> dict[str, object]:
    filename = str(arguments.get("filename") or arguments.get("name") or "").strip()
    content = str(arguments.get("content") or "")
    mode = str(arguments.get("mode") or "overwrite")
    if not filename:
        return {"status": "error", "error": "Missing required argument: filename"}

    try:
        note = write_note_file(os.getenv("ROBOT_790_INSTANCE_PATH"), filename, content, mode=mode)
    except (OSError, ValueError) as exc:
        return {"status": "error", "error": str(exc)}

    return {
        "status": "ok",
        "tool": "write_text_file",
        "filename": note.filename,
        "path": str(note.path),
        "characters": len(note.content),
    }


def _read_text_file(arguments: dict[str, object]) -> dict[str, object]:
    filename = str(arguments.get("filename") or arguments.get("name") or "").strip()
    if not filename:
        return {"status": "error", "error": "Missing required argument: filename"}

    try:
        note = read_note_file(os.getenv("ROBOT_790_INSTANCE_PATH"), filename)
    except FileNotFoundError:
        return {"status": "error", "error": "Note file not found"}
    except (OSError, ValueError) as exc:
        return {"status": "error", "error": str(exc)}

    return {"status": "ok", "tool": "read_text_file", "filename": note.filename, "content": note.content}


def _list_text_files() -> dict[str, object]:
    try:
        filenames = list_note_files(os.getenv("ROBOT_790_INSTANCE_PATH"))
    except OSError as exc:
        return {"status": "error", "error": str(exc)}
    return {"status": "ok", "tool": "list_text_files", "files": filenames}


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

from __future__ import annotations

import argparse
import json
import math
import time
from copy import deepcopy
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Event, RLock, Thread
from typing import Any, cast
from urllib.parse import urlsplit

import httpx

from robot_790d.reachy_motion import MoveEvents, beat_frames, prefer_ipv4

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8792
DEFAULT_REACHY_URL = "http://127.0.0.1:8000/"
SUPPORTED_MOODS = ("curious", "happy", "focused", "confused", "sleepy", "sleep")
RECORDED_DATASET = "pollen-robotics/reachy-mini-emotions-library"
# Rounded-up clip durations, plus daemon initial positioning allowance in the waiter.
# Dataset revision inspected: 85dd1b4e12b0dcb67119e495c44022e2b62c91cf.
RECORDED_BEATS = {
    "affection": ("loving1", 6.0),
    "daydream": ("thoughtful1", 6.0),
    "startle": ("surprised1", 3.0),
    "wary": ("fear1", 4.0),
    "goofy": ("dance2", 18.0),
    "silly": ("dance3", 19.0),
}
SUPPORTED_BEATS = (
    "slow_smile",
    "inspect",
    "thoughtful",
    "confused",
    "focus_lock",
    "double_take",
    "drowsy",
    "robot_scan",
) + tuple(RECORDED_BEATS)


@dataclass(frozen=True)
class ReachyAdapterSettings:
    daemon_url: str = DEFAULT_REACHY_URL
    allow_motion: bool = False
    timeout_s: float = 2.0


class ReachyAdapterState:
    def __init__(self, host: str, port: int, settings: ReachyAdapterSettings) -> None:
        self.started_at = time.time()
        self.host = host
        self.port = port
        self.settings = settings
        self.lock = RLock()
        self.client = httpx.Client(
            base_url=settings.daemon_url.rstrip("/") + "/",
            timeout=settings.timeout_s,
            trust_env=False,
            transport=httpx.HTTPTransport(local_address="0.0.0.0" if prefer_ipv4(settings.daemon_url) else None),
        )
        self.move_events = MoveEvents(settings.daemon_url, settings.timeout_s)
        self.sequence: dict[str, Any] | None = None
        self.sequence_cancel = Event()
        self.sequence_thread: Thread | None = None
        self.mood = "curious"
        self.mouth: dict[str, Any] = {
            "present": False,
            "display_role": "reachy_motion",
            "style": "gesture",
            "shape": "neutral",
            "manual": False,
            "talking": False,
            "energy": 0.35,
            "text_active": False,
            "text": "",
        }
        self.gaze: dict[str, Any] = {"manual": False, "target": {"x": 0.0, "y": 0.0, "z": 0.0}}
        self.gaze_hold_until = 0.0
        self.expression_hold_until = 0.0
        self.director = "none"
        self.last_error = ""
        self.last_daemon_state: dict[str, Any] = {}
        self.cached_reads: dict[str, Any] = {}
        self.state_observed_at: float | None = None
        self.last_motion: dict[str, Any] | None = None
        self.owned_moves: set[str] = set()
        self.routine_move: str | None = None
        self.routine_action = ""
        self.sleep_requested = False

    def snapshot(self, *, refresh: bool = True) -> dict[str, Any]:
        with self.lock:
            if refresh:
                for path in ("api/daemon/status", "api/state/full", "api/motors/status", "api/media/status"):
                    self.cached_reads[path] = self._get(path)
                self.state_observed_at = time.time()
            return deepcopy(self._snapshot())

    def _snapshot(self) -> dict[str, Any]:
        if self.last_motion and self.last_motion.get("uuid"):
            event = self.move_events.get(self.last_motion["uuid"])
            if event and event["type"] != "move_started":
                self.last_motion["completion"] = event["type"]
        daemon = self.cached_reads.get("api/daemon/status", {"error": "not yet read"})
        full_state = self.cached_reads.get("api/state/full", {})
        motor_status = self.cached_reads.get("api/motors/status", {})
        media_status = self.cached_reads.get("api/media/status", {})
        if isinstance(full_state, dict) and not _has_error(full_state):
            self.last_daemon_state = full_state
        reachable = not _has_error(daemon)
        daemon_body = daemon if isinstance(daemon, dict) else {}
        full_body = full_state if isinstance(full_state, dict) else {}
        motor_body = motor_status if isinstance(motor_status, dict) else {}
        media_body = media_status if isinstance(media_status, dict) else {}
        return {
            "ok": reachable,
            "running": reachable,
            "name": "Robot 790 Reachy Mini Adapter",
            "hostname": "reachy-mini",
            "mdns_url": f"http://{self.host}:{self.port}/",
            "ip": self.host,
            "wifi_mode": "adapter",
            "firmware": {
                "target": "reachy-mini-embodiment-adapter",
                "version": "0.3.1",
                "features": "state,gaze,mood,beats,sleep,wake,stop,release,motion_receipts,motion_gated",
            },
            "uptime_ms": int((time.time() - self.started_at) * 1000),
            "message": "reachy adapter ready" if reachable else "reachy daemon unreachable",
            "motion_enabled": self.settings.allow_motion,
            "daemon": _compact(daemon_body),
            "reachy": {
                "daemon_url": self.settings.daemon_url,
                "daemon_version": daemon_body.get("version"),
                "robot_name": daemon_body.get("robot_name"),
                "wireless_version": daemon_body.get("wireless_version"),
                "wlan_ip": daemon_body.get("wlan_ip"),
                "backend_ready": (daemon_body.get("backend_status") or {}).get("ready")
                if isinstance(daemon_body.get("backend_status"), dict)
                else None,
                "motor_mode": motor_body.get("mode") or full_body.get("control_mode"),
                "media_available": media_body.get("available"),
                "media_released": media_body.get("released"),
                "face_target": daemon_body.get("face_target"),
            },
            "mood": self.mood,
            "eye_mood": self.mood,
            "style": "reachy",
            "mouth": self.mouth,
            "director": self.director,
            "touch": False,
            "imu": False,
            "camera": False,
            "display": False,
            "eyes": False,
            "external_eyes": False,
            "gaze": self._state_gaze(full_body),
            "head_pose": full_body.get("head_pose"),
            "body_yaw": full_body.get("body_yaw"),
            "antennas_position": full_body.get("antennas_position"),
            "doa": full_body.get("doa"),
            "last_error": self.last_error,
            "last_motion": self.last_motion,
            "sequence": self.sequence,
            "motion_events": {"connected": self.move_events.ready.is_set(), "error": self.move_events.last_error},
            "state_errors": {path: body["error"] for path, body in self.cached_reads.items() if _has_error(body)},
            "state_observed_at": self.state_observed_at,
            "state_age_s": max(0.0, time.time() - self.state_observed_at)
            if self.state_observed_at is not None else None,
            "capabilities": {
                "moods": list(SUPPORTED_MOODS),
                "beats": list(SUPPORTED_BEATS),
                "recorded_performances": {
                    name: {"dataset": RECORDED_DATASET, "move": move, "duration_s": duration,
                           "audio": "dataset_sound_if_present"}
                    for name, (move, duration) in RECORDED_BEATS.items()
                },
                "gaze": "head yaw/pitch",
                "mouth": "metadata only; no display or speech animation",
                "camera_stream": False,
                "imu_readings": False,
                "completion_tracking": True,
                "sequences": True,
                "lifecycle_priority": "automatic cues yield to explicit gesture/gaze holds",
                "release": "clear expression holds only; not wake, park, or stop",
                "stop": "cancel this adapter's running moves only; not motor disable",
                "wake": "explicit daemon wake routine; may enable motors",
            },
            "updated_at": time.time(),
        }

    def release(self, *, automatic: bool = False) -> dict[str, Any]:
        with self.lock:
            if automatic and self._expression_held():
                return self._reply("held", "Automatic release ignored while an explicit expression is held.")
            self.director = "release"
            self.gaze["manual"] = False
            self.gaze_hold_until = 0.0
            self.expression_hold_until = 0.0
            return self._reply("released", "Expression holds cleared; no wake, park, or stop was requested.")

    def sleep(self) -> dict[str, Any]:
        with self.lock:
            result = self._move("sleep", "api/move/play/goto_sleep", {})
            if result["ok"]:
                self.sleep_requested = True
                self.expression_hold_until = 0.0
                self.mood = "sleep"
                self.gaze["manual"] = False
                result.update({"mood": self.mood, "eye_mood": self.mood})
                result["gaze"]["manual"] = False
            return result

    def wake(self) -> dict[str, Any]:
        with self.lock:
            result = self._move("wake", "api/move/play/wake_up", {})
            if result["ok"]:
                self.sleep_requested = False
                self.expression_hold_until = 0.0
                self.gaze["manual"] = False
                result["gaze"]["manual"] = False
            return result

    def stop(self) -> dict[str, Any]:
        with self.lock:
            self._interrupt_sequence()
            if not self.settings.allow_motion:
                return self._reply("gated", "Motion is disabled; restart the adapter with -AllowMotion.")
            running = self._running_moves()
            if isinstance(running, dict):
                return self._reply("failed", running["error"])
            stopped, error = self._cancel_owned(running)
            if error:
                return self._reply("failed", error, stopped_uuids=stopped)
            self.director = "stop"
            self.gaze["manual"] = False
            self.expression_hold_until = 0.0
            self.last_error = ""
            self.last_motion = {"status": "stopped", "stopped_uuids": stopped}
            return self._reply(
                "stopped", "Adapter-owned moves cancelled; motors remain in their current mode.", stopped_uuids=stopped
            )

    def set_mood(self, name: str) -> dict[str, Any]:
        return self.control({"mood": name})

    def set_gaze(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.control({"gaze": payload})

    def set_mouth(self, payload: dict[str, Any]) -> dict[str, Any]:
        with self.lock:
            if payload.get("text") or payload.get("style"):
                return self._reply("unsupported", "Reachy has no mouth display, captions, or mouth styles.")
            self._update_mouth(payload)
            return self._reply("metadata_only", "Speech metadata stored; no mouth display or animation is wired.")

    def _update_mouth(self, payload: dict[str, Any]) -> None:
        if payload.get("auto") is True:
            self.mouth.update({"manual": False, "talking": False})
            return
        if payload.get("clear") is True:
            self.mouth.update({"text_active": False, "text": ""})
            return
        pose_touched = False
        if "shape" in payload and payload["shape"]:
            self.mouth["shape"] = _clean_token(payload["shape"], "neutral")
            pose_touched = True
        if "talking" in payload:
            self.mouth["talking"] = bool(payload["talking"])
            pose_touched = True
        if "energy" in payload:
            self.mouth["energy"] = _clamp_float(payload["energy"], 0.0, 1.0, 0.35)
            pose_touched = True
        if "text" in payload:
            text = str(payload.get("text") or "")[:180]
            self.mouth["text"] = text
            self.mouth["text_active"] = bool(text)
        if pose_touched:
            self.mouth["manual"] = True
        self.director = "mouth"

    def beat(self, name: str, *, automatic: bool = False) -> dict[str, Any]:
        with self.lock:
            beat = _clean_token(name, "")
            if beat not in SUPPORTED_BEATS:
                return self._reply(
                    "unsupported", f"Unsupported Reachy beat: {beat!r}.", supported_beats=list(SUPPORTED_BEATS)
                )
            if automatic and self._expression_held():
                return self._reply("held", "Body cue ignored while an explicit expression is held.")
            if not self.settings.allow_motion:
                return self._reply("gated", "Motion is disabled; restart the adapter with -AllowMotion.")
            if not self.move_events.ready.is_set():
                return self._reply("gated", "Completion stream is unavailable; no sequence was started.")
            recorded = RECORDED_BEATS.get(beat)
            if recorded:
                move, duration = recorded
                frames = [{"duration": duration}]
                result = self._move(
                    f"beat:{beat}", f"api/move/play/recorded-move-dataset/{RECORDED_DATASET}/{move}", {}
                )
            else:
                frames = beat_frames(beat)
                result = self._move(f"beat:{beat}", "api/move/goto", frames[0])
            if result["ok"]:
                hold = max(6.6, sum(step["duration"] for step in frames) + 1.5)
                self.expression_hold_until = time.monotonic() + hold
                self.sequence_cancel = Event()
                self.sequence = {
                    "id": result["uuid"],
                    "name": beat,
                    "status": "running",
                    "steps": len(frames),
                    "completed_steps": 0,
                    "uuid": result["uuid"],
                    "duration_s": sum(step["duration"] for step in frames),
                    "source": "recorded_dataset" if recorded else "sts_sequence",
                }
                if recorded:
                    self.sequence.update({"dataset": RECORDED_DATASET, "move": recorded[0],
                                          "audio": "dataset_sound_if_present"})
                self.sequence_thread = Thread(
                    target=self._run_sequence,
                    args=(self.sequence, frames, self.sequence_cancel),
                    daemon=True,
                    name=f"reachy-{beat}",
                )
                self.sequence_thread.start()
                self.gaze["manual"] = False
                self.mood = {
                    "slow_smile": "happy",
                    "inspect": "focused",
                    "thoughtful": "curious",
                    "confused": "confused",
                    "focus_lock": "focused",
                    "double_take": "surprised",
                    "drowsy": "sleepy",
                    "robot_scan": "focused",
                }.get(beat, self.mood)
                result.update({"mood": self.mood, "eye_mood": self.mood})
                result["gaze"]["manual"] = False
                result.update({"sequence": deepcopy(self.sequence), "hold_seconds": hold})
            return result

    def _interrupt_sequence(self) -> None:
        self.sequence_cancel.set()
        if self.sequence and self.sequence["status"] == "running":
            self.sequence["status"] = "interrupted"
            print(json.dumps({"event": "reachy_sequence_interrupted", "at": time.time(), **self.sequence}), flush=True)

    def _run_sequence(self, sequence: dict[str, Any], frames: list[dict[str, Any]], cancelled: Event) -> None:
        for index, target in enumerate(frames):
            event = self.move_events.wait(sequence["uuid"], target["duration"] + 2, cancelled)
            with self.lock:
                if cancelled.is_set() or self.sequence is not sequence:
                    return
                print(
                    json.dumps(
                        {
                            "event": "reachy_step_receipt",
                            "at": time.time(),
                            "sequence": sequence["id"],
                            "name": sequence["name"],
                            "step": index + 1,
                            **event,
                        }
                    ),
                    flush=True,
                )
                if event["type"] != "move_completed":
                    sequence.update({"status": event["type"], "error": event.get("details", "")})
                    self.last_error = f"{sequence['name']} halted: {event['type']} {event.get('details', '')}"
                    # Stop the known UUID if it is still running; never retry an unknown dispatch.
                    running = self._running_moves()
                    if isinstance(running, set):
                        self._cancel_owned(running)
                    return
                sequence["completed_steps"] = index + 1
                if index + 1 == len(frames):
                    sequence["status"] = "completed"
                    return
                result = self._move(f"beat:{sequence['name']}", "api/move/goto", frames[index + 1], interrupt=False)
                if not result["ok"]:
                    sequence.update({"status": "failed", "error": result.get("error", "Movement refused.")})
                    return
                sequence["uuid"] = result["uuid"]

    def close(self) -> None:
        self.stop()
        if self.sequence_thread:
            self.sequence_thread.join(timeout=self.settings.timeout_s + 1)
        self.move_events.close()
        self.client.close()

    def control(self, payload: dict[str, Any]) -> dict[str, Any]:
        with self.lock:
            automatic = payload.get("source") == "lifecycle"
            for key, action in (
                ("sleep", self.sleep),
                ("wake", self.wake),
                ("stop", self.stop),
                ("release", lambda: self.release(automatic=automatic)),
            ):
                if payload.get(key) is True:
                    return action()
            if any(key in payload for key in ("idle", "autonomous", "animate", "color", "style")):
                return self._reply("unsupported", "Reachy has no idle-animation loop, face color, or eye style here.")
            mood = payload.get("emotion") or payload.get("expression") or payload.get("mood") or payload.get("name")
            mood = _clean_token(mood, "")
            if mood and mood not in SUPPORTED_MOODS:
                return self._reply(
                    "unsupported", f"Unsupported Reachy mood: {mood!r}.", supported_moods=list(SUPPORTED_MOODS)
                )
            gaze = payload.get("gaze")
            mouth = payload.get("mouth")
            if any(key in payload and not isinstance(payload[key], dict) for key in ("gaze", "mouth")):
                return self._reply("invalid", "Gaze and mouth controls must be objects.")
            if isinstance(mouth, dict) and (mouth.get("text") or mouth.get("style")):
                return self._reply("unsupported", "Reachy has no mouth display, captions, or mouth styles.")
            auto = isinstance(gaze, dict) and (gaze.get("auto") is True or gaze.get("gaze") == "auto")
            manual = isinstance(gaze, dict) and not auto
            gaze = gaze if isinstance(gaze, dict) else {}
            if manual and not any(key in gaze for key in ("x", "y")):
                return self._reply("invalid", "Gaze requires x or y, or auto: true.")
            if manual and any(not _finite_number(gaze[key]) for key in ("x", "y") if key in gaze):
                return self._reply("invalid", "Gaze coordinates must be finite numbers.")
            if automatic and self._expression_held():
                if isinstance(mouth, dict):
                    self._update_mouth(mouth)
                return self._reply("held", "Automatic cue ignored while an explicit expression is held.")
            if not mood and not manual:
                if auto:
                    self.gaze["manual"] = False
                    self.expression_hold_until = 0.0
                if isinstance(mouth, dict):
                    return self.set_mouth(mouth)
                if auto:
                    return self._reply("released", "Gaze hold cleared; no movement requested.")
                return self._reply("unsupported", "No supported Reachy control was supplied.")

            target = _goto_payload_for_mood(mood) if mood else _goto_payload_for_gaze(0, 0)
            held = self._gaze_held() and not auto
            if manual:
                x = _clamp_float(gaze.get("x"), -1.0, 1.0, 0.0)
                y = _clamp_float(gaze.get("y"), -1.0, 1.0, 0.0)
                target["duration"] = _clamp_float(gaze.get("move_ms"), 600, 2000, 800) / 1000
            elif held:
                x, y = self.gaze["target"]["x"], self.gaze["target"]["y"]
            if manual or held:
                target["head_pose"].update({"yaw": x * 0.35, "pitch": y * 0.25})
            result = self._move(f"mood:{mood}" if mood else "gaze", "api/move/goto", target)
            if result["ok"]:
                if mood:
                    self.mood = mood
                if manual:
                    hold = _clamp_float(gaze.get("duration"), 0, 30, 2)
                    self.gaze = {"manual": not automatic, "target": {"x": x, "y": y, "z": 0.0}}
                    self.gaze_hold_until = (
                        time.monotonic() + hold + target["duration"] + 0.3 if hold else math.inf
                    ) if not automatic else 0.0
                elif auto:
                    self.gaze["manual"] = False
                if isinstance(mouth, dict):
                    self._update_mouth(mouth)
                if not automatic:
                    hold = _clamp_float(payload.get("duration"), 0, 30, 5) or 5
                    self.expression_hold_until = (
                        self.gaze_hold_until if manual else time.monotonic() + hold + target["duration"] + 0.3
                    )
                result.update(
                    {
                        "mood": self.mood,
                        "eye_mood": self.mood,
                        "gaze": self._state_gaze(self.cached_reads.get("api/state/full", {})),
                        "mouth": deepcopy(self.mouth),
                    }
                )
            return result

    def _gaze_held(self) -> bool:
        return bool(self.gaze["manual"] and time.monotonic() < self.gaze_hold_until)

    def _expression_held(self) -> bool:
        return (
            bool(self.sequence and self.sequence["status"] == "running")
            or time.monotonic() < self.expression_hold_until
            or self._gaze_held()
        )

    def _state_gaze(self, full_state: dict[str, Any]) -> dict[str, Any]:
        pose = full_state.get("head_pose") if isinstance(full_state, dict) else None
        now = None
        if isinstance(pose, dict) and all(_finite_number(pose.get(key)) for key in ("yaw", "pitch")):
            now = {
                "x": _clamp_float(float(pose["yaw"]) / 0.35, -1, 1, 0),
                "y": _clamp_float(float(pose["pitch"]) / 0.25, -1, 1, 0),
                "z": 0.0,
            }
        return {
            "manual": self._gaze_held(),
            "now": now,
            "target": deepcopy(self.gaze["target"]),
            "measured": now is not None,
        }

    def _reply(self, status: str, message: str, **extra: Any) -> dict[str, Any]:
        ok = status not in {"failed", "gated", "unsupported", "invalid", "busy"}
        result = self.snapshot(refresh=False)
        result.update({"ok": ok, "status": status, "message": message, **extra})
        if not ok:
            result["error"] = message
        return result

    def _running_moves(self) -> set[str] | dict[str, str]:
        running = self._get("api/move/running")
        if not isinstance(running, list) or any(
            not isinstance(item, dict) or not item.get("uuid") for item in running
        ):
            return {"error": f"Cannot inspect running moves: {running}"}
        return {str(item["uuid"]) for item in running}

    def _cancel_owned(self, running: set[str]) -> tuple[list[str], str]:
        self.owned_moves.intersection_update(running)
        stopped: list[str] = []
        for uuid in sorted(self.owned_moves):
            result = self._post("api/move/stop", {"uuid": uuid})
            if _has_error(result):
                self.last_error = str(result["error"])
                return stopped, self.last_error
            stopped.append(uuid)
            self.owned_moves.remove(uuid)
        return stopped, ""

    def _move(self, action: str, path: str, payload: dict[str, Any], *, interrupt: bool = True) -> dict[str, Any]:
        started = time.perf_counter()

        def fail(status: str, message: str) -> dict[str, Any]:
            self.last_error = message
            self.last_motion = {"status": status, "action": action, "error": message}
            return self._reply(status, message)

        if not self.settings.allow_motion:
            return fail("gated", "Motion is disabled; restart the adapter with -AllowMotion.")
        if self.sleep_requested and action not in {"wake", "sleep"}:
            return fail("gated", "Sleep was requested; explicitly wake Reachy before sending gestures.")
        daemon = self._get("api/daemon/status")
        motors = self._get("api/motors/status")
        self.cached_reads.update({"api/daemon/status": daemon, "api/motors/status": motors})
        if _has_error(daemon) or _has_error(motors):
            return fail("failed", f"Reachy readiness read failed: {daemon if _has_error(daemon) else motors}")
        backend = daemon.get("backend_status") if isinstance(daemon, dict) else None
        if not isinstance(backend, dict) or backend.get("ready") is not True:
            return fail("failed", "Reachy backend is not ready.")
        if action != "wake" and (not isinstance(motors, dict) or motors.get("mode") != "enabled"):
            return fail("gated", "Reachy motors are not enabled. Wake deliberately in Reachy Control or with /wake.")
        running = self._running_moves()
        if isinstance(running, dict):
            return fail("failed", running["error"])
        if running - self.owned_moves:
            return fail("busy", "Another controller has a running move; wait before moving Reachy.")
        if self.routine_move in running and action == self.routine_action:
            return self._reply(
                "accepted",
                "The same wake/sleep routine is already running.",
                uuid=self.routine_move,
                completion="unverified",
                target=deepcopy(payload),
            )
        if self.routine_move in running and action not in {"wake", "sleep"}:
            return fail("busy", "Reachy's wake/sleep routine is still running; wait for it to finish.")
        if interrupt:
            self._interrupt_sequence()
        _, error = self._cancel_owned(running)
        if error:
            return fail("failed", error)
        receipt = self._post(path, payload)
        if _has_error(receipt):
            return fail("failed", str(receipt["error"]))
        if not isinstance(receipt, dict) or not receipt.get("uuid"):
            return fail("failed", "Reachy did not return a move UUID; movement outcome is unknown.")
        uuid = str(receipt["uuid"])
        self.owned_moves.add(uuid)
        if action in {"wake", "sleep"}:
            self.routine_move = uuid
            self.routine_action = action
        self.director = action
        self.last_error = ""
        self.last_motion = {
            "status": "accepted",
            "action": action,
            "uuid": uuid,
            "completion": "unverified",
            "target": deepcopy(payload),
            "dispatch_ms": round((time.perf_counter() - started) * 1000, 2),
        }
        print(json.dumps({"event": "reachy_motion", "at": time.time(), **self.last_motion}), flush=True)
        return self._reply(
            "accepted",
            "Daemon accepted the move; completion has not been verified.",
            uuid=uuid,
            completion="unverified",
            target=deepcopy(payload),
        )

    def _get(self, path: str) -> Any:
        try:
            response = self.client.get(path)
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            return {"error": f"{type(exc).__name__}: {exc}"}

    def _post(self, path: str, payload: dict[str, Any]) -> Any:
        try:
            response = self.client.post(path, json=payload)
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            return {"error": f"{type(exc).__name__}: {exc}"}


class ReachyAdapterHandler(BaseHTTPRequestHandler):
    adapter_state: ReachyAdapterState

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlsplit(self.path)
        if parsed.path in {"/", "/state", "/api/status", "/status"}:
            self._send_json(200, self.adapter_state.snapshot())
            return
        if parsed.path in {"/moods", "/mouth_shapes", "/mouth_styles", "/styles", "/eye_modes", "/beats"}:
            self._send_json(200, _list_payload(parsed.path))
            return
        self._send_json(404, {"ok": False, "error": "unknown endpoint"})

    def do_POST(self) -> None:
        parsed = urlsplit(self.path)
        try:
            payload = self._read_json()
        except (ValueError, UnicodeDecodeError) as exc:
            self._send_json(400, {"ok": False, "error": f"Invalid JSON request: {exc}"})
            return
        if parsed.path in {"/control", "/api/control"}:
            self._send_json(200, self.adapter_state.control(payload))
            return
        if parsed.path in {"/mood", "/emotion", "/expression"}:
            self._send_json(200, self.adapter_state.control(payload))
            return
        if parsed.path == "/gaze":
            self._send_json(200, self.adapter_state.set_gaze(payload))
            return
        if parsed.path == "/mouth":
            self._send_json(200, self.adapter_state.set_mouth(payload))
            return
        if parsed.path == "/release":
            self._send_json(200, self.adapter_state.release(automatic=payload.get("source") == "lifecycle"))
            return
        if parsed.path == "/sleep":
            self._send_json(200, self.adapter_state.sleep())
            return
        if parsed.path == "/wake":
            self._send_json(200, self.adapter_state.wake())
            return
        if parsed.path == "/stop":
            self._send_json(200, self.adapter_state.stop())
            return
        if parsed.path == "/beat":
            self._send_json(
                200,
                self.adapter_state.beat(
                    str(payload.get("name") or payload.get("beat") or ""),
                    automatic=payload.get("source") in {"lifecycle", "brain2"},
                ),
            )
            return
        if parsed.path == "/style":
            self._send_json(200, {"ok": False, "status": "unsupported", "error": "Reachy has no eye styles."})
            return
        self._send_json(404, {"ok": False, "error": "unknown endpoint"})

    def log_message(self, format: str, *args: object) -> None:
        return

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length") or "0")
        if length < 0 or length > 16384:
            raise ValueError("body must be at most 16384 bytes")
        if length == 0:
            return {}
        data = json.loads(self.rfile.read(length).decode("utf-8"))
        if not isinstance(data, dict):
            raise ValueError("body must be an object")
        return data

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def _goto_payload_for_gaze(x: float, y: float) -> dict[str, Any]:
    return {
        "head_pose": {"x": 0.0, "y": 0.0, "z": 0.0, "roll": 0.0, "pitch": y * 0.25, "yaw": x * 0.35},
        "duration": 0.8,
        "interpolation": "minjerk",
    }


def _goto_payload_for_mood(mood: str) -> dict[str, Any]:
    if mood not in SUPPORTED_MOODS:
        raise ValueError(f"Unsupported Reachy mood: {mood}")
    return _goto_payload_for_beat(
        {
            "happy": "slow_smile",
            "curious": "thoughtful",
            "focused": "focus_lock",
            "confused": "confused",
            "sleepy": "drowsy",
            "sleep": "drowsy",
        }.get(mood, "thoughtful")
    )


def _goto_payload_for_beat(beat: str) -> dict[str, Any]:
    if beat not in SUPPORTED_BEATS or beat in RECORDED_BEATS:
        raise ValueError(f"Unsupported Reachy beat: {beat}")
    head = {"x": 0.0, "y": 0.0, "z": 0.0, "roll": 0.0, "pitch": 0.0, "yaw": 0.0}
    antennas = [0.0, 0.0]
    body_yaw: float | None = None
    if beat == "inspect":
        head.update({"pitch": 0.12, "yaw": -0.25})
    elif beat == "thoughtful":
        head.update({"roll": -0.12, "pitch": 0.08})
    elif beat == "slow_smile":
        head.update({"pitch": -0.08})
        antennas = [0.25, -0.25]
    elif beat == "double_take":
        head.update({"yaw": 0.35})
        antennas = [0.35, 0.35]
    elif beat == "focus_lock":
        head.update({"pitch": 0.06})
    elif beat == "confused":
        head.update({"roll": 0.18})
        antennas = [-0.15, 0.15]
    elif beat == "drowsy":
        head.update({"pitch": 0.22})
        antennas = [-0.35, 0.35]
    elif beat == "robot_scan":
        body_yaw = 0.18
    return {"head_pose": head, "antennas": antennas, "body_yaw": body_yaw, "duration": 0.8, "interpolation": "minjerk"}


def _clean_token(value: object, fallback: str) -> str:
    text = str(value or "").strip().lower().replace(" ", "_").replace("-", "_")
    return text or fallback


def _clamp_float(value: object, low: float, high: float, fallback: float) -> float:
    try:
        number = float(cast(Any, value))
    except (TypeError, ValueError, OverflowError):
        return fallback
    return max(low, min(high, number)) if math.isfinite(number) else fallback


def _finite_number(value: object) -> bool:
    try:
        return not isinstance(value, bool) and math.isfinite(float(cast(Any, value)))
    except (TypeError, ValueError, OverflowError):
        return False


def _compact(value: dict[str, Any]) -> dict[str, Any]:
    return cast(dict[str, Any], json.loads(json.dumps(value))) if isinstance(value, dict) else {}


def _has_error(value: object) -> bool:
    return isinstance(value, dict) and bool(value.get("error"))


def _list_payload(path: str) -> dict[str, Any]:
    values = {
        "/moods": list(SUPPORTED_MOODS),
        "/mouth_shapes": [],
        "/mouth_styles": [],
        "/styles": [],
        "/eye_modes": [],
        "/beats": list(SUPPORTED_BEATS),
    }.get(path, [])
    return {"ok": True, path.strip("/") or "values": values}


def main() -> None:
    parser = argparse.ArgumentParser(description="Robot 790 Reachy Mini embodiment adapter.")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--daemon-url", default=DEFAULT_REACHY_URL)
    parser.add_argument("--allow-motion", action="store_true")
    parser.add_argument("--timeout", type=float, default=2.0)
    args = parser.parse_args()

    settings = ReachyAdapterSettings(
        daemon_url=args.daemon_url,
        allow_motion=args.allow_motion,
        timeout_s=args.timeout,
    )
    state = ReachyAdapterState(args.host, args.port, settings)
    handler = type("ConfiguredReachyAdapterHandler", (ReachyAdapterHandler,), {"adapter_state": state})
    state.move_events.start()
    server = ThreadingHTTPServer((args.host, args.port), handler)
    mode = "motion enabled" if args.allow_motion else "motion gated"
    print(f"Robot 790 Reachy Mini adapter: http://{args.host}:{args.port}/ ({mode})", flush=True)
    try:
        server.serve_forever()
    finally:
        state.close()
        server.server_close()


if __name__ == "__main__":
    main()

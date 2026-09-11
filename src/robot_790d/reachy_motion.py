"""Finite Reachy gestures and daemon completion receipts; interpolation stays on Reachy."""

from __future__ import annotations

import json
import socket
import time
from collections import OrderedDict
from threading import Event, Lock, Thread
from typing import Any
from urllib.parse import urlsplit

from websockets.sync.client import connect


def prefer_ipv4(url: str) -> bool:
    # Windows may advertise an unreachable mDNS IPv6 address before the working IPv4 one.
    return (urlsplit(url).hostname or "").lower().endswith(".local")


class MoveEvents:
    def __init__(self, daemon_url: str, timeout: float = 2.0) -> None:
        self.url = daemon_url.rstrip("/").replace("http://", "ws://", 1).replace("https://", "wss://", 1)
        self.url += "/api/move/ws/updates"
        self.timeout = timeout
        self.ready = Event()
        self.closed = Event()
        self.lock = Lock()
        self.receipts: OrderedDict[str, dict[str, Any]] = OrderedDict()
        self.thread: Thread | None = None
        self.last_error = ""

    def start(self) -> None:
        self.thread = Thread(target=self._listen, name="reachy-move-events", daemon=True)
        self.thread.start()

    def close(self) -> None:
        self.closed.set()
        if self.thread:
            self.thread.join(timeout=self.timeout + 2)

    def get(self, uuid: str) -> dict[str, Any] | None:
        with self.lock:
            return self.receipts.get(uuid)

    def wait(self, uuid: str, timeout: float, cancelled: Event) -> dict[str, Any]:
        deadline = time.monotonic() + timeout
        while not cancelled.is_set() and not self.closed.is_set():
            receipt = self.get(uuid)
            if receipt and receipt["type"] != "move_started":
                return receipt
            if not self.ready.is_set():
                return {"type": "unverified", "details": "Completion stream disconnected."}
            if time.monotonic() >= deadline:
                return {"type": "unverified", "details": "Timed out waiting for daemon completion."}
            cancelled.wait(0.025)
        return {"type": "move_cancelled", "details": "Sequence interrupted."}

    def _listen(self) -> None:
        while not self.closed.is_set():
            sock = None
            try:
                if prefer_ipv4(self.url):
                    parsed = urlsplit(self.url)
                    port = parsed.port or (443 if parsed.scheme == "wss" else 80)
                    address = socket.getaddrinfo(parsed.hostname, port, socket.AF_INET, socket.SOCK_STREAM)[0]
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.settimeout(self.timeout)
                    sock.connect(address[4])
                    # The connect deadline must not become the receive thread's idle deadline.
                    sock.settimeout(None)
                with connect(self.url, sock=sock, proxy=None, open_timeout=self.timeout, close_timeout=1) as ws:
                    self.ready.set()
                    self.last_error = ""
                    while not self.closed.is_set():
                        try:
                            event = json.loads(ws.recv(timeout=0.25))
                        except TimeoutError:
                            continue
                        if (
                            not isinstance(event, dict)
                            or event.get("type")
                            not in {"move_started", "move_completed", "move_cancelled", "move_failed"}
                            or not isinstance(event.get("uuid"), str)
                        ):
                            continue
                        with self.lock:
                            self.receipts[event["uuid"]] = event
                            self.receipts.move_to_end(event["uuid"])
                            while len(self.receipts) > 128:
                                self.receipts.popitem(last=False)
            except Exception as exc:
                self.last_error = f"{type(exc).__name__}: {exc}"
            finally:
                self.ready.clear()
                if sock:
                    sock.close()
            self.closed.wait(1)


def frame(
    *,
    pitch: float = 0,
    yaw: float = 0,
    roll: float = 0,
    antennas: tuple[float, float] = (0, 0),
    body: float | None = None,
    duration: float = 0.8,
) -> dict[str, Any]:
    return {
        "head_pose": {"x": 0.0, "y": 0.0, "z": 0.0, "roll": roll, "pitch": pitch, "yaw": yaw},
        "antennas": list(antennas),
        "body_yaw": body,
        "duration": duration,
        "interpolation": "minjerk",
    }


def beat_frames(name: str) -> list[dict[str, Any]]:
    # Angles are radians. No translation, bounded travel, and no streaming raw motor targets.
    sequences = {
        "slow_smile": [
            frame(pitch=-0.06, antennas=(0.15, -0.15)),
            frame(pitch=-0.12, roll=-0.06, antennas=(0.55, -0.55), duration=1.2),
            frame(pitch=-0.06, antennas=(0.30, -0.30)),
        ],
        "double_take": [
            frame(yaw=-0.22, antennas=(0.1, -0.1)),
            frame(yaw=0.03),
            frame(yaw=-0.35, roll=-0.08, antennas=(0.5, 0.15)),
            frame(yaw=-0.15, antennas=(0.15, -0.15)),
        ],
        "drowsy": [
            frame(pitch=0.12, antennas=(-0.2, 0.2)),
            frame(pitch=0.25, roll=0.08, antennas=(-0.5, 0.5), duration=1.2),
            frame(pitch=0.06, antennas=(-0.1, 0.1)),
            frame(pitch=0.22, antennas=(-0.35, 0.35), duration=1.2),
        ],
        "robot_scan": [
            frame(yaw=-0.25, body=-0.18, antennas=(0.15, -0.15), duration=1.2),
            frame(yaw=0.25, body=0.18, antennas=(0.15, -0.15), duration=1.6),
            frame(body=0, duration=1.2),
        ],
        "thoughtful": [
            frame(roll=-0.18, pitch=0.08, antennas=(0.25, 0.05)),
            frame(roll=-0.08, pitch=0.04, antennas=(0.1, 0.0)),
        ],
        "confused": [
            frame(roll=0.18, antennas=(-0.3, 0.1)),
            frame(roll=-0.14, antennas=(0.1, 0.3)),
            frame(roll=0.1, antennas=(-0.15, 0.15)),
        ],
        "inspect": [
            frame(pitch=0.10, yaw=-0.25, antennas=(0.2, -0.05)),
            frame(pitch=-0.06, yaw=-0.18, roll=0.1, antennas=(0.05, -0.2)),
            frame(),
        ],
        "focus_lock": [frame(pitch=0.08, antennas=(0.15, -0.15)), frame(pitch=0.03)],
    }
    return sequences[name]

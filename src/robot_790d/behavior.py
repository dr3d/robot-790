from robot_790d.devices.esp32_face import Esp32FaceClient
from robot_790d.state import Affect, RobotMode


class BehaviorDaemon:
    """Coordinate high-level Robot 790 behavior cues."""

    def __init__(self, face: Esp32FaceClient | None = None) -> None:
        self.face = face

    def set_mode(self, mode: RobotMode, affect: Affect | None = None) -> dict[str, object]:
        if self.face is None:
            return {"status": "skipped", "reason": "face controller is not configured", "mode": mode.value}

        current_affect = affect or Affect()
        if mode == RobotMode.IDLE:
            return self.face.release()
        if mode == RobotMode.LISTENING:
            payload: dict[str, object] = {
                "emotion": "curious",
                "mouth": {"shape": "neutral", "talking": False, "duration": 1.0},
            }
            if current_affect.color:
                payload["color"] = current_affect.color
            return self.face.control(payload)
        if mode == RobotMode.THINKING:
            payload = {
                "expression": "focused",
                "duration": 2.5,
                "gaze": {"x": 0.0, "y": -0.25, "duration": 2.5, "move_ms": 260},
            }
            if current_affect.color:
                payload["color"] = current_affect.color
            return self.face.control(payload)
        if mode == RobotMode.SPEAKING:
            payload = {
                "emotion": "happy",
                "mouth": {
                    "shape": "open",
                    "talking": True,
                    "energy": _clamp(current_affect.energy, 0.0, 1.0),
                    "duration": 2.4,
                },
            }
            if current_affect.color:
                payload["color"] = current_affect.color
            return self.face.control(payload)
        if mode == RobotMode.SLEEPING:
            return self.face.sleep(0.0)
        return {"error": f"Unhandled mode: {mode.value}"}

    def play_beat(self, name: str) -> dict[str, object]:
        if self.face is None:
            return {"status": "skipped", "reason": "face controller is not configured", "beat": name}
        return self.face.beat(name)


def _clamp(value: float, low: float, high: float) -> float:
    return min(max(value, low), high)

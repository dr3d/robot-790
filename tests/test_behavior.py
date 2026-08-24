from robot_790d.behavior import BehaviorDaemon
from robot_790d.state import Affect, RobotMode


class FakeFace:
    def __init__(self) -> None:
        self.calls: list[tuple[str, object]] = []

    def control(self, payload: dict[str, object]) -> dict[str, object]:
        self.calls.append(("control", payload))
        return {"status": "ok"}

    def release(self) -> dict[str, object]:
        self.calls.append(("release", None))
        return {"status": "ok"}

    def sleep(self, duration_s: float = 0.0) -> dict[str, object]:
        self.calls.append(("sleep", duration_s))
        return {"status": "ok"}

    def beat(self, name: str) -> dict[str, object]:
        self.calls.append(("beat", name))
        return {"status": "ok"}


def test_speaking_sets_talking_mouth_energy() -> None:
    face = FakeFace()
    daemon = BehaviorDaemon(face)  # type: ignore[arg-type]

    daemon.set_mode(RobotMode.SPEAKING, Affect(energy=0.72))

    assert face.calls == [
        (
            "control",
            {
                "emotion": "happy",
                "mouth": {"shape": "open", "talking": True, "energy": 0.72, "duration": 2.4},
            },
        )
    ]


def test_idle_releases_face() -> None:
    face = FakeFace()
    daemon = BehaviorDaemon(face)  # type: ignore[arg-type]

    daemon.set_mode(RobotMode.IDLE)

    assert face.calls == [("release", None)]


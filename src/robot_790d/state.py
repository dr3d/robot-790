from dataclasses import dataclass
from enum import StrEnum


class RobotMode(StrEnum):
    IDLE = "idle"
    LISTENING = "listening"
    THINKING = "thinking"
    SPEAKING = "speaking"
    SLEEPING = "sleeping"


@dataclass(frozen=True)
class Affect:
    energy: float = 0.45
    valence: float = 0.0
    attention: float = 0.5
    certainty: float = 0.5
    mischief: float = 0.0


@dataclass(frozen=True)
class Gaze:
    x: float = 0.0
    y: float = 0.0
    z: float | None = None
    duration_s: float = 2.0
    move_ms: int = 180


@dataclass(frozen=True)
class RobotState:
    mode: RobotMode = RobotMode.IDLE
    mood: str = "calm"
    beat: str = "none"
    affect: Affect = Affect()
    gaze: Gaze = Gaze()


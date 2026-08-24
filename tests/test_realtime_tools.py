from robot_790d import realtime_tools
from robot_790d.behavior import BehaviorDaemon
from robot_790d.memory import list_facts


class FakeFace:
    def __init__(self) -> None:
        self.closed = False
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

    def close(self) -> None:
        self.closed = True


def test_realtime_tool_catalog_exposes_robot_actions() -> None:
    names = {str(tool["name"]) for tool in realtime_tools.TOOLS}

    assert names == {"set_robot_mode", "play_face_beat", "remember_fact", "forget_fact"}


def test_set_robot_mode_tool_drives_behavior(monkeypatch) -> None:
    face = FakeFace()

    def build_daemon() -> tuple[BehaviorDaemon, FakeFace]:
        return BehaviorDaemon(face), face

    monkeypatch.setattr(realtime_tools, "_build_daemon", build_daemon)

    result = realtime_tools._set_robot_mode({"mode": "speaking", "energy": 0.8})

    assert result["status"] == "ok"
    assert result["mode"] == "speaking"
    assert face.closed is True
    assert face.calls == [
        (
            "control",
            {
                "emotion": "happy",
                "mouth": {"shape": "open", "talking": True, "energy": 0.8, "duration": 2.4},
            },
        )
    ]


def test_play_face_beat_tool_drives_behavior(monkeypatch) -> None:
    face = FakeFace()

    def build_daemon() -> tuple[BehaviorDaemon, FakeFace]:
        return BehaviorDaemon(face), face

    monkeypatch.setattr(realtime_tools, "_build_daemon", build_daemon)

    result = realtime_tools._play_face_beat({"name": "mischief"})

    assert result["status"] == "ok"
    assert result["beat"] == "mischief"
    assert face.closed is True
    assert face.calls == [("beat", "mischief")]


def test_memory_tools_persist_named_facts(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("ROBOT_790_INSTANCE_PATH", str(tmp_path))

    remembered = realtime_tools._remember_fact(
        {"name": "user_name", "fact": "The user's name is Dave."}
    )
    forgotten = realtime_tools._forget_fact({"name": "user_name"})

    assert remembered == {
        "status": "ok",
        "tool": "remember_fact",
        "name": "user_name",
        "fact": "The user's name is Dave.",
    }
    assert forgotten == {
        "status": "ok",
        "tool": "forget_fact",
        "name": "user_name",
        "removed": "The user's name is Dave.",
    }
    assert list_facts(tmp_path) == []

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

    def emotion(
        self,
        name: str,
        duration_s: float | None = None,
        color: str | None = None,
    ) -> dict[str, object]:
        payload: dict[str, object] = {"name": name, "duration": duration_s}
        if color:
            payload["color"] = color
        self.calls.append(("emotion", payload))
        return {"status": "ok"}

    def gaze(self, x: float, y: float, duration_s: float = 1.2, move_ms: int = 160) -> dict[str, object]:
        self.calls.append(("gaze", {"x": x, "y": y, "duration": duration_s, "move_ms": move_ms}))
        return {"status": "ok"}

    def close(self) -> None:
        self.closed = True


class FakeChassis:
    def __init__(self) -> None:
        self.closed = False
        self.calls: list[tuple[str, object]] = []

    def status(self) -> dict[str, object]:
        self.calls.append(("status", None))
        return {"status": "ok"}

    def tank(self, left: float, right: float, duration_s: float | None = None) -> dict[str, object]:
        self.calls.append(("tank", {"left": left, "right": right, "duration": duration_s}))
        return {"status": "ok"}

    def twist(self, velocity: float, turn: float, duration_s: float | None = None) -> dict[str, object]:
        self.calls.append(("twist", {"velocity": velocity, "turn": turn, "duration": duration_s}))
        return {"status": "ok"}

    def stop(self) -> dict[str, object]:
        self.calls.append(("stop", None))
        return {"status": "ok"}

    def estop(self) -> dict[str, object]:
        self.calls.append(("estop", None))
        return {"status": "ok"}

    def clear(self) -> dict[str, object]:
        self.calls.append(("clear", None))
        return {"status": "ok"}

    def close(self) -> None:
        self.closed = True


def test_realtime_tool_catalog_exposes_robot_actions() -> None:
    names = {str(tool["name"]) for tool in realtime_tools.TOOLS}

    assert names == {
        "set_robot_mode",
        "play_face_beat",
        "set_face_mood",
        "set_eye_style",
        "set_eye_gaze",
        "set_mouth",
        "set_chassis",
        "remember_fact",
        "forget_fact",
        "search_web",
        "get_weather",
        "get_brain_status",
        "show_web_page",
        "generate_image",
        "cast_media",
        "set_smart_home_device",
        "write_text_file",
        "read_text_file",
        "list_text_files",
    }


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


def test_set_face_mood_tool_drives_face(monkeypatch) -> None:
    face = FakeFace()

    def build_daemon() -> tuple[BehaviorDaemon, FakeFace]:
        return BehaviorDaemon(face), face

    monkeypatch.setattr(realtime_tools, "_build_daemon", build_daemon)

    result = realtime_tools._set_face_mood({"name": "glitchy", "duration": 4})

    assert result["status"] == "ok"
    assert result["tool"] == "set_face_mood"
    assert result["mood"] == "glitchy"
    assert face.closed is True
    assert face.calls == [("emotion", {"name": "glitchy", "duration": 4.0})]


def test_set_face_mood_tool_can_set_status_color(monkeypatch) -> None:
    face = FakeFace()

    def build_daemon() -> tuple[BehaviorDaemon, FakeFace]:
        return BehaviorDaemon(face), face

    monkeypatch.setattr(realtime_tools, "_build_daemon", build_daemon)

    result = realtime_tools._set_face_mood({"name": "affection", "duration": 3, "color": "pink"})

    assert result["status"] == "ok"
    assert result["color"] == "pink"
    assert face.closed is True
    assert face.calls == [("emotion", {"name": "affection", "duration": 3.0, "color": "pink"})]


def test_set_eye_gaze_tool_drives_face(monkeypatch) -> None:
    face = FakeFace()

    def build_daemon() -> tuple[BehaviorDaemon, FakeFace]:
        return BehaviorDaemon(face), face

    monkeypatch.setattr(realtime_tools, "_build_daemon", build_daemon)

    result = realtime_tools._set_eye_gaze({"x": 2, "y": -0.5, "duration": 4, "move_ms": 250})

    assert result["status"] == "ok"
    assert result["tool"] == "set_eye_gaze"
    assert result["x"] == 1.0
    assert result["y"] == -0.5
    assert face.closed is True
    assert face.calls == [("gaze", {"x": 1.0, "y": -0.5, "duration": 4.0, "move_ms": 250})]


def test_set_chassis_maps_status_stop_and_estop(monkeypatch) -> None:
    chassis = FakeChassis()
    monkeypatch.setattr(realtime_tools, "_build_chassis", lambda: chassis)

    status = realtime_tools._set_chassis({"action": "status"})
    stop = realtime_tools._set_chassis({"action": "stop"})
    estop = realtime_tools._set_chassis({"action": "estop"})
    clear = realtime_tools._set_chassis({"action": "clear"})

    assert status["status"] == "ok"
    assert stop["status"] == "ok"
    assert estop["status"] == "ok"
    assert clear["status"] == "ok"
    assert chassis.calls == [
        ("status", None),
        ("stop", None),
        ("estop", None),
        ("clear", None),
    ]


def test_set_chassis_tank_clamps_values(monkeypatch) -> None:
    chassis = FakeChassis()
    monkeypatch.setattr(realtime_tools, "_build_chassis", lambda: chassis)

    result = realtime_tools._set_chassis({"action": "tank", "left": 1, "right": "-1"})

    assert result["status"] == "ok"
    assert result["queued"] is False
    assert chassis.closed is True
    assert chassis.calls == [("tank", {"left": 1.0, "right": -1.0, "duration": None})]


def test_set_chassis_timed_twist_stops_after_duration(monkeypatch) -> None:
    chassis = FakeChassis()
    monkeypatch.setattr(realtime_tools, "_build_chassis", lambda: chassis)

    result = realtime_tools._set_chassis({"action": "twist", "velocity": 0.2, "turn": -0.1, "duration_s": 0.01})

    assert result["status"] == "ok"
    assert result["commands_sent"] == 1
    assert chassis.closed is True
    assert chassis.calls == [
        ("twist", {"velocity": 0.2, "turn": -0.1, "duration": 0.01}),
        ("stop", None),
    ]


def test_set_chassis_refuses_overlapping_drive(monkeypatch) -> None:
    chassis = FakeChassis()
    monkeypatch.setattr(realtime_tools, "_build_chassis", lambda: chassis)

    acquired = realtime_tools._CHASSIS_DRIVE_LOCK.acquire(blocking=False)
    assert acquired is True
    try:
        result = realtime_tools._set_chassis({"action": "twist", "velocity": 0.2, "turn": 0.0, "duration_s": 0.1})
    finally:
        realtime_tools._CHASSIS_DRIVE_LOCK.release()

    assert result["status"] == "error"
    assert result["queued"] is False
    assert "refusing to queue" in str(result["error"])
    assert chassis.calls == []


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


def test_search_web_tool_uses_shared_helper(monkeypatch) -> None:
    def fake_search(query: str, max_results: object = 5) -> dict[str, object]:
        return {"status": "ok", "tool": "search_web", "query": query, "max_results": max_results, "results": []}

    monkeypatch.setattr(realtime_tools, "search_web", fake_search)

    result = realtime_tools._search_web({"query": "current robot news", "max_results": 3})

    assert result == {
        "status": "ok",
        "tool": "search_web",
        "query": "current robot news",
        "max_results": 3,
        "results": [],
    }


def test_get_weather_tool_uses_shared_helper(monkeypatch) -> None:
    def fake_weather(location: str, unit: str = "fahrenheit") -> dict[str, object]:
        return {"status": "ok", "tool": "get_weather", "location": location, "unit": unit}

    monkeypatch.setattr(realtime_tools, "lookup_weather", fake_weather)

    result = realtime_tools._get_weather({"unit": "celsius"})

    assert result == {
        "status": "ok",
        "tool": "get_weather",
        "location": "Salem, Massachusetts",
        "unit": "celsius",
    }


def test_get_brain_status_tool_uses_shared_helper(monkeypatch) -> None:
    def fake_brain_status() -> dict[str, object]:
        return {"status": "ok", "tool": "get_brain_status", "context": {"pressure_estimate": "light"}}

    monkeypatch.setattr(realtime_tools, "read_brain_status", fake_brain_status)

    assert realtime_tools._get_brain_status() == {
        "status": "ok",
        "tool": "get_brain_status",
        "context": {"pressure_estimate": "light"},
    }


def test_cast_media_tool_dispatches_to_client(monkeypatch) -> None:
    class FakeCastMediaClient:
        def play_youtube(self, **kwargs: object) -> dict[str, object]:
            return {"status": "ok", "tool": "cast_media", "action": "play_youtube", **kwargs}

    monkeypatch.setattr(realtime_tools, "CastMediaClient", FakeCastMediaClient)

    result = realtime_tools._cast_media({"action": "play_youtube", "query": "pterodactyl facts"})

    assert result == {
        "status": "ok",
        "tool": "cast_media",
        "action": "play_youtube",
        "query": "pterodactyl facts",
        "video_id": None,
        "device_name": None,
    }


def test_smart_home_tool_uses_shared_helper(monkeypatch) -> None:
    def fake_smart_home(device: str = "", action: str = "status") -> dict[str, object]:
        return {"status": "ok", "tool": "set_smart_home_device", "device": device, "action": action}

    monkeypatch.setattr(realtime_tools, "control_smart_home_device", fake_smart_home)

    result = realtime_tools._set_smart_home_device({"device": "living room light", "action": "turn_on"})

    assert result == {
        "status": "ok",
        "tool": "set_smart_home_device",
        "device": "living room light",
        "action": "turn_on",
    }


def test_show_web_page_accepts_http_url() -> None:
    result = realtime_tools._show_web_page({"url": "https://example.com/robot", "title": "Robot"})

    assert result == {
        "status": "ok",
        "tool": "show_web_page",
        "url": "https://example.com/robot",
        "source": "web",
        "title": "Robot",
    }


def test_show_web_page_rejects_non_http_url() -> None:
    result = realtime_tools._show_web_page({"url": "file:///secret.html"})

    assert result == {"status": "error", "error": "url must be an HTTP or HTTPS web page URL"}


def test_generate_image_tool_uses_shared_helper(monkeypatch) -> None:
    def fake_generate_image(
        prompt: str,
        *,
            title: str = "",
            provider: str | None = None,
            size: str | None = None,
            model: str | None = None,
            quality: str | None = None,
        ) -> dict[str, object]:
            return {
                "status": "ok",
                "tool": "generate_image",
                "prompt": prompt,
                "title": title,
                "provider": provider,
                "size": size,
                "model": model,
                "quality": quality,
                "url": "/generated-images/test.png",
            }

    monkeypatch.setattr(realtime_tools, "generate_image", fake_generate_image)

    result = realtime_tools._generate_image({"prompt": "a clockwork lighthouse", "title": "lighthouse"})

    assert result == {
        "status": "ok",
        "tool": "generate_image",
        "prompt": "a clockwork lighthouse",
        "title": "lighthouse",
        "provider": None,
        "size": None,
        "model": None,
        "quality": None,
        "url": "/generated-images/test.png",
    }


def test_text_file_tools_use_instance_notes_folder(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("ROBOT_790_INSTANCE_PATH", str(tmp_path))

    written = realtime_tools._write_text_file({"filename": "session_summary", "content": "Robot 790 is awake."})
    read = realtime_tools._read_text_file({"filename": "session_summary"})
    listed = realtime_tools._list_text_files()

    assert written["status"] == "ok"
    assert written["filename"] == "session_summary.txt"
    assert read == {
        "status": "ok",
        "tool": "read_text_file",
        "filename": "session_summary.txt",
        "content": "Robot 790 is awake.",
    }
    assert listed == {"status": "ok", "tool": "list_text_files", "files": ["session_summary.txt"]}

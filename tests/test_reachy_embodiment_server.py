from __future__ import annotations

import json
import time
from http.server import ThreadingHTTPServer
from threading import Thread

import httpx
import pytest

from robot_790d import reachy_embodiment_server as reachy


class FakeDaemon:
    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.ready = True
        self.mode = "enabled"
        self.running: set[str] = set()
        self.fail_post = False
        self.fail_get: str | None = None
        self.missing_uuid = False
        self.pose = {"yaw": 0.0, "pitch": 0.0}
        self.sequence = 0

    @property
    def posts(self) -> list[httpx.Request]:
        return [request for request in self.requests if request.method == "POST"]

    def handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        path = request.url.path
        if request.method == "POST":
            if self.fail_post:
                return httpx.Response(500, json={"detail": "motor failure"})
            if path == "/api/move/stop":
                self.running.discard(json.loads(request.content)["uuid"])
                return httpx.Response(200, json={"message": "Stopped move"})
            self.sequence += 1
            uuid = f"00000000-0000-0000-0000-{self.sequence:012d}"
            return httpx.Response(200, json={} if self.missing_uuid else {"uuid": uuid})
        if path == self.fail_get:
            return httpx.Response(503, json={"detail": "temporarily unavailable"})
        bodies = {
            "/api/daemon/status": {
                "version": "1.10.0",
                "wireless_version": True,
                "backend_status": {"ready": self.ready},
            },
            "/api/motors/status": {"mode": self.mode},
            "/api/state/full": {"head_pose": self.pose, "control_mode": self.mode},
            "/api/media/status": {"available": True},
            "/api/move/running": [{"uuid": uuid} for uuid in self.running],
        }
        return httpx.Response(200, json=bodies[path])


@pytest.fixture
def adapter():
    state = reachy.ReachyAdapterState("127.0.0.1", 8792, reachy.ReachyAdapterSettings(allow_motion=True))
    state.client.close()
    daemon = FakeDaemon()
    state.client = httpx.Client(base_url="http://fixture/", transport=httpx.MockTransport(daemon.handle))
    state.move_events.ready.set()
    yield state, daemon
    state._interrupt_sequence()
    if state.sequence_thread:
        state.sequence_thread.join(timeout=3)
    state.client.close()


def test_failed_move_stays_failed_after_healthy_state_and_mouth_reads(adapter) -> None:
    state, daemon = adapter
    daemon.fail_post = True
    result = state.set_gaze({"x": 0.7, "y": 0.1})
    assert result["ok"] is False
    assert result["status"] == "failed"
    assert result["error"]
    assert state.gaze["manual"] is False
    snapshot = state.snapshot()
    assert snapshot["ok"] is True  # Connectivity is separate from the last action.
    assert snapshot["last_error"] == result["error"]
    assert snapshot["last_motion"]["status"] == "failed"
    state.set_mouth({"talking": True})
    assert state.last_error == result["error"]
    daemon.fail_post = False
    assert state.beat("thoughtful")["status"] == "accepted"
    assert state.last_error == ""


def test_gated_adapter_does_not_send_any_daemon_requests(adapter) -> None:
    state, daemon = adapter
    state.settings = reachy.ReachyAdapterSettings(allow_motion=False)
    for action in (lambda: state.beat("thoughtful"), state.wake, state.sleep, state.stop):
        result = action()
        assert result["ok"] is False
        assert result["status"] == "gated"
    assert daemon.requests == []


@pytest.mark.parametrize("ready,mode,status", [(False, "enabled", "failed"), (True, "disabled", "gated")])
def test_readiness_prevents_gestures_without_enabling_motors(adapter, ready, mode, status) -> None:
    state, daemon = adapter
    daemon.ready, daemon.mode = ready, mode
    result = state.beat("thoughtful")
    assert result["status"] == status
    assert result["ok"] is False
    assert daemon.posts == []


def test_receipt_is_acceptance_not_completion_and_gaze_is_measured(adapter) -> None:
    state, daemon = adapter
    state.snapshot()
    result = state.set_gaze({"x": 0.8, "y": -0.4})
    assert result["status"] == "accepted"
    assert result["completion"] == "unverified"
    assert result["uuid"] == state.last_motion["uuid"]
    assert result["gaze"]["target"]["x"] == 0.8
    assert result["gaze"]["now"]["x"] == 0.0
    daemon.pose = {"yaw": 0.28, "pitch": -0.1}
    measured = state.snapshot()["gaze"]
    assert measured["measured"] is True
    assert measured["now"]["x"] == pytest.approx(0.8)
    assert measured["now"]["y"] == pytest.approx(-0.4)
    daemon.fail_get = "/api/state/full"
    failed = state.snapshot()
    assert failed["gaze"]["now"] is None
    assert failed["gaze"]["measured"] is False
    assert failed["state_errors"]["api/state/full"]


def test_missing_receipt_is_not_success(adapter) -> None:
    state, daemon = adapter
    daemon.missing_uuid = True
    result = state.beat("thoughtful")
    assert result["ok"] is False
    assert "UUID" in result["error"]
    assert not state.owned_moves


def test_control_merges_mood_gaze_and_mouth_in_one_move(adapter) -> None:
    state, daemon = adapter
    result = state.control(
        {
            "expression": "focused",
            "gaze": {"x": 0.34, "y": -0.22, "move_ms": 280},
            "mouth": {"talking": True, "energy": 0.6},
        }
    )
    assert result["ok"] is True
    assert len(daemon.posts) == 1
    target = json.loads(daemon.posts[0].content)
    assert target["head_pose"]["yaw"] == pytest.approx(0.34 * 0.35)
    assert target["head_pose"]["pitch"] == pytest.approx(-0.22 * 0.25)
    assert target["duration"] == 0.6  # Do not copy display-speed moves onto physical motors.
    assert result["mouth"]["talking"] is True
    assert result["mood"] == "focused"


def test_speaking_respects_gaze_hold_until_expiry(adapter) -> None:
    state, daemon = adapter
    state.set_gaze({"x": 0.6, "y": -0.3, "duration": 2})
    state.control({"emotion": "happy", "mouth": {"talking": True}})
    target = json.loads(daemon.posts[-1].content)
    assert target["head_pose"]["yaw"] == pytest.approx(0.6 * 0.35)
    assert target["head_pose"]["pitch"] == pytest.approx(-0.3 * 0.25)
    assert target["antennas"] == [0.25, -0.25]
    state.gaze_hold_until = 0
    state.set_mood("happy")
    assert json.loads(daemon.posts[-1].content)["head_pose"]["yaw"] == 0


@pytest.mark.parametrize("beat", ["robot_scan", "drowsy", "confused"])
def test_lifecycle_cues_cannot_cancel_explicit_beat(adapter, beat) -> None:
    state, daemon = adapter
    receipt = state.beat(beat)
    daemon.running = {receipt["uuid"]}
    posts = len(daemon.posts)
    for cue in (
        {"emotion": "happy", "mouth": {"talking": True}},
        {"expression": "focused", "gaze": {"x": 0, "y": 0}},
        {"expression": "focused", "gaze": {"x": 0.34, "y": -0.22}},
        {"release": True},
    ):
        result = state.control({**cue, "source": "lifecycle"})
        assert result["ok"] and result["status"] == "held"
        assert state.last_motion["uuid"] == receipt["uuid"]
        assert state.last_motion["target"] == reachy.beat_frames(beat)[0]
    assert state.release(automatic=True)["status"] == "held"
    assert len(daemon.posts) == posts
    assert state.mood == receipt["mood"]
    assert state.mouth["talking"] is True
    # A new explicit command still supersedes the previous gesture.
    assert state.beat("inspect")["status"] == "accepted"
    assert [request.url.path for request in daemon.posts][-2:] == ["/api/move/stop", "/api/move/goto"]


def test_automatic_cues_resume_after_hold_and_do_not_create_their_own_hold(adapter, monkeypatch) -> None:
    state, daemon = adapter
    clock = [100.0]
    monkeypatch.setattr(reachy.time, "monotonic", lambda: clock[0])
    state.beat("confused")
    assert state.expression_hold_until == pytest.approx(106.6)
    state._interrupt_sequence()
    clock[0] = 107
    assert state.control({"source": "lifecycle", "emotion": "happy"})["status"] == "accepted"
    assert state.control({"source": "lifecycle", "expression": "focused"})["status"] == "accepted"
    assert state.expression_hold_until < clock[0]
    state.set_gaze({"x": 0.4, "duration": 0})
    assert state.release(automatic=True)["status"] == "held"
    state.set_gaze({"auto": True})
    assert state.release(automatic=True)["status"] == "released"


def test_lifecycle_coordinate_gaze_does_not_block_the_next_speaking_pose(adapter) -> None:
    state, daemon = adapter
    for gaze in ({"x": 0, "y": 0}, {"x": 0.34, "y": -0.22, "duration": 2.5}):
        result = state.control({"source": "lifecycle", "expression": "focused", "gaze": gaze})
        assert result["status"] == "accepted"
        assert result["gaze"]["manual"] is False
        assert not state._expression_held()
    result = state.control({"source": "lifecycle", "emotion": "happy", "mouth": {"talking": True}})
    assert result["status"] == "accepted"
    assert len(daemon.posts) == 3
    target = json.loads(daemon.posts[-1].content)
    assert target["head_pose"]["yaw"] == 0
    assert target["antennas"] == [0.25, -0.25]
    assert state.release(automatic=True)["status"] == "released"


def test_pose_age_is_measurement_age_not_action_receipt_age(adapter, monkeypatch) -> None:
    state, _ = adapter
    clock = [100.0]
    monkeypatch.setattr(reachy.time, "time", lambda: clock[0])
    assert state.snapshot(refresh=False)["state_age_s"] is None
    assert state.snapshot()["state_age_s"] == 0
    clock[0] = 130.0
    result = state.set_gaze({"x": 0.2, "y": 0})
    assert result["state_observed_at"] == 100
    assert result["state_age_s"] == 30
    assert result["updated_at"] == 130
    assert state.snapshot()["state_age_s"] == 0


def test_failed_beat_does_not_reserve_motion_and_stop_clears_hold(adapter) -> None:
    state, daemon = adapter
    daemon.fail_post = True
    assert state.beat("confused")["status"] == "failed"
    assert not state._expression_held()
    daemon.fail_post = False
    state.beat("drowsy")
    assert state._expression_held()
    state.stop()
    assert not state._expression_held()
    state.beat("inspect")
    state.release()
    assert state._expression_held()  # Releasing holds does not abort a running sequence.
    state.stop()
    assert not state._expression_held()


def test_auto_and_release_clear_hold_without_waking_or_moving(adapter) -> None:
    state, daemon = adapter
    state.set_gaze({"x": 0.5, "duration": 0})
    assert state._gaze_held()
    daemon.requests.clear()
    assert state.set_gaze({"auto": True})["status"] == "released"
    assert not state._gaze_held()
    assert state.release()["status"] == "released"
    assert daemon.requests == []


def test_sleep_latches_until_explicit_wake_and_idle_is_not_wake(adapter) -> None:
    state, daemon = adapter
    sleep = state.sleep()
    assert sleep["status"] == "accepted"
    assert daemon.posts[-1].url.path == "/api/move/play/goto_sleep"
    state.release()
    assert state.set_mood("happy")["status"] == "gated"
    daemon.mode = "disabled"
    wake = state.wake()
    assert wake["status"] == "accepted"
    assert daemon.posts[-1].url.path == "/api/move/play/wake_up"
    assert state.sleep_requested is False
    daemon.running = {wake["uuid"]}
    daemon.mode = "enabled"
    assert state.beat("thoughtful")["status"] == "busy"
    assert all("set_mode" not in request.url.path for request in daemon.posts)


def test_stop_only_cancels_adapter_owned_moves(adapter) -> None:
    state, daemon = adapter
    receipt = state.beat("thoughtful")
    daemon.running = {receipt["uuid"], "other-controller-move"}
    stopped = state.stop()
    assert stopped["stopped_uuids"] == [receipt["uuid"]]
    assert daemon.running == {"other-controller-move"}
    assert state.owned_moves == set()
    assert json.loads(daemon.posts[-1].content) == {"uuid": receipt["uuid"]}


def test_repeated_wake_does_not_restart_an_active_wake_routine(adapter) -> None:
    state, daemon = adapter
    first = state.wake()
    daemon.running = {first["uuid"]}
    second = state.wake()
    assert second["uuid"] == first["uuid"]
    assert len(daemon.posts) == 1


@pytest.mark.parametrize("payload", [{"gaze": "bad"}, {"mouth": []}, {"expression": "happy", "gaze": None}])
def test_malformed_compound_controls_cannot_partially_move(adapter, payload) -> None:
    state, daemon = adapter
    assert state.control(payload)["status"] == "invalid"
    assert daemon.posts == []


def test_new_target_cancels_previous_owned_move_but_not_foreign_moves(adapter) -> None:
    state, daemon = adapter
    first = state.beat("thoughtful")
    daemon.running = {first["uuid"]}
    assert state.set_gaze({"x": -0.3})["status"] == "accepted"
    assert [request.url.path for request in daemon.posts][-2:] == ["/api/move/stop", "/api/move/goto"]
    daemon.running.add("foreign")
    before = len(daemon.posts)
    assert state.beat("confused")["status"] == "busy"
    assert len(daemon.posts) == before


def test_failed_cancellation_does_not_submit_new_movement(adapter) -> None:
    state, daemon = adapter
    first = state.beat("thoughtful")
    daemon.running = {first["uuid"]}
    daemon.fail_post = True
    result = state.beat("confused")
    assert result["ok"] is False
    assert daemon.posts[-1].url.path == "/api/move/stop"
    assert len(daemon.posts) == 2


@pytest.mark.parametrize("name", ["mischief", "wary", "startle", "affection", "daydream", "goofy", "silly", ""])
def test_unimplemented_beats_are_rejected_without_movement(adapter, name) -> None:
    state, daemon = adapter
    result = state.beat(name)
    assert result["status"] == "unsupported"
    assert name not in result["supported_beats"]
    assert daemon.requests == []


def test_capability_lists_only_advertise_implemented_actions(adapter) -> None:
    state, _ = adapter
    for beat in reachy._list_payload("/beats")["beats"]:
        assert reachy._goto_payload_for_beat(beat)["duration"] >= 0.6
    for mood in reachy._list_payload("/moods")["moods"]:
        assert reachy._goto_payload_for_mood(mood)
    assert reachy._list_payload("/mouth_shapes")["mouth_shapes"] == []
    snapshot = state.snapshot()
    assert snapshot["imu"] is False
    assert snapshot["camera"] is False
    assert snapshot["reachy"]["media_available"] is True


def test_accepted_beat_receipt_matches_its_new_mood_and_cleared_gaze_hold(adapter) -> None:
    state, _ = adapter
    state.set_gaze({"x": 0.4, "duration": 0})
    result = state.beat("confused")
    assert result["mood"] == result["eye_mood"] == state.mood == "confused"
    assert result["gaze"]["manual"] is False


def test_overflowing_motion_timing_falls_back_to_bounded_default(adapter) -> None:
    state, daemon = adapter
    assert state.set_gaze({"x": 0.2, "move_ms": 10**400})["ok"] is True
    assert json.loads(daemon.posts[-1].content)["duration"] == 0.8


def test_speech_metadata_does_not_poll_daemon_or_claim_animation(adapter) -> None:
    state, daemon = adapter
    for index in range(20):
        result = state.set_mouth({"talking": True, "energy": 0.5, "speech": {"seq": index}})
        assert result["status"] == "metadata_only"
    assert daemon.requests == []
    assert state.set_mouth({"text": "hello"})["ok"] is False
    assert state.set_mouth({"auto": True})["mouth"]["talking"] is False


@pytest.mark.parametrize("coordinate", [float("nan"), float("inf"), -float("inf"), "bad", True])
def test_invalid_coordinates_never_reach_daemon(adapter, coordinate) -> None:
    state, daemon = adapter
    assert state.set_gaze({"x": coordinate})["status"] == "invalid"
    assert daemon.requests == []


def test_extreme_coordinates_and_timing_are_bounded(adapter) -> None:
    state, daemon = adapter
    assert state.set_gaze({"x": 999, "y": -999, "move_ms": 999999})["ok"] is True
    payload = json.loads(daemon.posts[-1].content)
    assert payload["head_pose"]["yaw"] == 0.35
    assert payload["head_pose"]["pitch"] == -0.25
    assert payload["duration"] == 2


def test_http_invalid_json_cannot_default_to_a_gesture(adapter) -> None:
    state, daemon = adapter
    handler = type("TestReachyHandler", (reachy.ReachyAdapterHandler,), {"adapter_state": state})
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with httpx.Client(base_url=f"http://127.0.0.1:{server.server_port}", trust_env=False) as client:
                for content in (b"{bad", b"[]", b"null", b"\xff"):
                    response = client.post("/beat", content=content)
                    assert response.status_code == 400
                    assert response.json()["ok"] is False
                assert client.post("/beat", json={}).json()["status"] == "unsupported"
                assert client.post("/style", json={"name": "friendly"}).json()["ok"] is False
                assert client.post("/mood", json={"name": "happy", "color": "red"}).json()["ok"] is False
                assert client.post("/release", json={}).json()["status"] == "released"
                assert daemon.posts == []
                assert client.post("/wake", json={}).json()["status"] == "accepted"
                assert daemon.posts[-1].url.path == "/api/move/play/wake_up"
                assert client.post("/stop", json={}).json()["status"] == "stopped"
        finally:
            server.shutdown()
            thread.join(timeout=3)


def await_condition(predicate) -> None:
    deadline = time.monotonic() + 2
    while not predicate() and time.monotonic() < deadline:
        time.sleep(0.01)
    assert predicate()


def complete_step(state, daemon, event_type="move_completed") -> None:
    uuid = state.sequence["uuid"]
    daemon.running.discard(uuid)
    with state.move_events.lock:
        state.move_events.receipts[uuid] = {"type": event_type, "uuid": uuid, "details": "test receipt"}


@pytest.mark.parametrize("name", reachy.SUPPORTED_BEATS)
def test_sequences_wait_for_completion_and_only_report_completed_after_last_receipt(adapter, name) -> None:
    state, daemon = adapter
    frames = reachy.beat_frames(name)
    result = state.beat(name)
    assert result["sequence"]["status"] == "running"
    assert result["hold_seconds"] >= sum(step["duration"] for step in frames)
    assert len(daemon.posts) == 1
    for index, target in enumerate(frames):
        assert json.loads(daemon.posts[-1].content) == target
        assert state.sequence["completed_steps"] == index
        complete_step(state, daemon)
        # Read under the adapter lock: a completed step and the next UUID are one transition.
        await_condition(lambda: state.snapshot(refresh=False)["sequence"]["completed_steps"] == index + 1)
    assert state.sequence["status"] == "completed"
    assert len(daemon.posts) == len(frames)
    assert state.snapshot()["last_motion"]["completion"] == "move_completed"


@pytest.mark.parametrize("event_type", ["move_failed", "move_cancelled"])
def test_non_completion_receipt_halts_sequence(adapter, event_type) -> None:
    state, daemon = adapter
    state.beat("double_take")
    complete_step(state, daemon, event_type)
    await_condition(lambda: state.sequence["status"] == event_type)
    assert len(daemon.posts) == 1
    assert event_type in state.last_error


def test_lost_completion_stream_stops_owned_move_and_does_not_advance(adapter) -> None:
    state, daemon = adapter
    result = state.beat("robot_scan")
    daemon.running.add(result["uuid"])
    state.move_events.ready.clear()
    await_condition(lambda: state.sequence["status"] == "unverified")
    assert [request.url.path for request in daemon.posts] == ["/api/move/goto", "/api/move/stop"]
    assert not daemon.running
    assert state.beat("thoughtful")["status"] == "gated"


def test_stop_invalidates_future_steps_even_if_a_late_completion_arrives(adapter) -> None:
    state, daemon = adapter
    result = state.beat("double_take")
    daemon.running.add(result["uuid"])
    state.stop()
    complete_step(state, daemon)
    state.sequence_thread.join(timeout=1)
    assert not state.sequence_thread.is_alive()
    assert state.sequence["status"] == "interrupted"
    assert len(daemon.posts) == 2


def test_brain2_cannot_replace_explicit_beat(adapter) -> None:
    state, daemon = adapter
    state.beat("robot_scan")
    result = state.beat("slow_smile", automatic=True)
    assert result["status"] == "held"
    assert len(daemon.posts) == 1


def test_next_step_rechecks_foreign_controller_and_motor_gate(adapter) -> None:
    state, daemon = adapter
    state.beat("double_take")
    daemon.running.add("foreign")
    complete_step(state, daemon)
    await_condition(lambda: state.sequence["status"] == "failed")
    assert len(daemon.posts) == 1
    assert "Another controller" in state.last_error


def test_gesture_frames_are_bounded_and_distinct() -> None:
    fingerprints = set()
    for name in reachy.SUPPORTED_BEATS:
        frames = reachy.beat_frames(name)
        assert 2 <= len(frames) <= 4
        assert sum(step["duration"] for step in frames) <= 5
        for step in frames:
            head = step["head_pose"]
            assert all(head[axis] == 0 for axis in ("x", "y", "z"))
            assert abs(head["yaw"]) <= 0.35
            assert abs(head["pitch"]) <= 0.25
            assert abs(head["roll"]) <= 0.18
            assert max(map(abs, step["antennas"])) <= 0.55
            assert abs(step["body_yaw"] or 0) <= 0.18
            assert 0.8 <= step["duration"] <= 1.6
        fingerprints.add(json.dumps(frames))
    assert len(fingerprints) == len(reachy.SUPPORTED_BEATS)


def test_mdns_transport_prefers_ipv4_but_does_not_pin_a_dhcp_address() -> None:
    assert reachy.prefer_ipv4("http://reachy-mini.local:8000/")
    assert not reachy.prefer_ipv4("http://127.0.0.1:8000/")
    assert not reachy.prefer_ipv4("http://[::1]:8000/")

import io
import json

import httpx
import pytest

from robot_790d import network_camera as camera
from robot_790d import sts_page_server as server


def enabled_config():
    return camera.camera_config({"enabled": True})


def test_camera_defaults_and_invalid_config(tmp_path):
    assert camera.camera_config(None)["enabled"] is False
    for invalid in ({"base_url": "file:///etc/passwd"}, {"base_url": "http://user:pw@cam/"},
                    {"base_url": "http://cam/other"}, {"rotation_degrees": 45},
                    {"preview_interval_ms": True}):
        with pytest.raises(ValueError):
            camera.camera_config(invalid)
    (tmp_path / "config").mkdir()
    (tmp_path / "config/runtime.json").write_text(json.dumps({
        "esp32_camera": {"base_url": "file:///etc/passwd"},
    }), encoding="utf-8")
    config = server.runtime_config(tmp_path)
    assert config["esp32_camera"]["enabled"] is False
    assert "ESP32 camera" in config["config_warning"]


def test_snapshot_only_uses_fixed_jpg_route_and_releases_lock():
    requests = []
    def respond(request):
        requests.append(request)
        return httpx.Response(200, headers={"content-type": "image/jpeg"}, content=b"\xff\xd8test\xff\xd9")
    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        for _ in range(2):
            assert camera.capture_frame(enabled_config(), client=client).startswith(b"\xff\xd8")
    assert all(r.method == "GET" and str(r.url) == "http://esp32-cam.local/jpg" for r in requests)
    assert not camera.FRAME_LOCK.locked()


@pytest.mark.parametrize("response", [
    httpx.Response(302, headers={"location": "http://other/private"}),
    httpx.Response(503),
    httpx.Response(200, headers={"content-type": "text/html"}, content=b"error"),
    httpx.Response(200, headers={"content-type": "image/jpeg"}, content=b"\xff\xd8truncated"),
    httpx.Response(200, headers={"content-type": "image/jpeg"}, content=b"x" * (camera.MAX_FRAME_BYTES + 1)),
])
def test_bad_responses_do_not_become_images_or_follow_redirects(response):
    requests = []
    def respond(request):
        requests.append(request)
        return response
    with httpx.Client(transport=httpx.MockTransport(respond), follow_redirects=True) as client:
        with pytest.raises((ValueError, httpx.HTTPError)):
            camera.capture_frame(enabled_config(), client=client)
    assert len(requests) == 1
    assert not camera.FRAME_LOCK.locked()


def test_disabled_busy_and_timeout_are_explicit():
    with pytest.raises(ValueError, match="disabled"):
        camera.capture_frame(camera.camera_config(None))
    camera.FRAME_LOCK.acquire()
    try:
        with pytest.raises(RuntimeError, match="busy"):
            camera.capture_frame(enabled_config())
    finally:
        camera.FRAME_LOCK.release()
    def timeout(request):
        raise httpx.ReadTimeout("Camera occupied", request=request)
    with httpx.Client(transport=httpx.MockTransport(timeout)) as client:
        with pytest.raises(httpx.ReadTimeout):
            camera.capture_frame(enabled_config(), client=client)
    assert not camera.FRAME_LOCK.locked()


def test_frame_route_is_binary_uncached_and_ignores_url_parameters(monkeypatch):
    handler = object.__new__(server.StsPageHandler)
    handler.path = "/api/camera/esp32/frame?url=http://not-the-camera/private"
    handler.wfile = io.BytesIO()
    statuses, headers = [], {}
    handler.send_response = statuses.append
    handler.send_header = lambda key, value: headers.update({key: value})
    handler.end_headers = lambda: None
    monkeypatch.setattr(server, "runtime_config", lambda: {"esp32_camera": enabled_config()})
    def frame(config):
        assert config["base_url"] == "http://esp32-cam.local/"
        return b"\xff\xd8test\xff\xd9"
    monkeypatch.setattr(server, "capture_frame", frame)
    handler.do_GET()
    assert statuses == [200]
    assert headers["Content-Type"] == "image/jpeg"
    assert headers["Cache-Control"] == "no-store"
    assert headers["X-Camera-Rotation"] == "-90"
    assert int(headers["Content-Length"]) == len(handler.wfile.getvalue())


def test_frame_route_returns_clear_unavailable_error(monkeypatch):
    handler = object.__new__(server.StsPageHandler)
    replies = []
    handler._send_json = lambda code, payload: replies.append((code, payload))
    monkeypatch.setattr(server, "runtime_config", lambda: {"esp32_camera": enabled_config()})
    def unavailable(_):
        raise httpx.ReadTimeout("Camera occupied")
    monkeypatch.setattr(server, "capture_frame", unavailable)
    handler._handle_esp32_camera_frame()
    assert replies[0][0] == 502
    assert "Camera occupied" in replies[0][1]["error"]

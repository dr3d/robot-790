import httpx
import pytest

from robot_790d import sts_page_server


@pytest.mark.parametrize("units,ready", [
    ([{"state": "idle"}], True),
    ([{"state": "active"}], False),
    ([{"state": "draining"}], False),
    ([{"state": "stuck"}], False),
    ([{"state": "active"}, {"state": "idle"}], True),
])
def test_readiness_probes_warmed_pool_without_claiming_a_session(monkeypatch, units, ready):
    requests, replies = [], []

    def get(url, **kwargs):
        requests.append((url, kwargs))
        return httpx.Response(200, json={"units": units}, request=httpx.Request("GET", url))

    monkeypatch.setattr(sts_page_server.httpx, "get", get)
    handler = object.__new__(sts_page_server.StsPageHandler)
    handler.path = "/api/realtime/ready"
    monkeypatch.setattr(handler, "_send_json", lambda status, payload: replies.append((status, payload)))
    handler.do_GET()
    assert requests == [("http://127.0.0.1:8765/v1/pool", {"timeout": 1.0, "trust_env": False})]
    assert replies == [(200, {"ready": ready})]


@pytest.mark.parametrize("failure", [
    httpx.ConnectError("starting"), httpx.ReadTimeout("unresponsive"),
    500, "bad json", "[]", '{"units":[]}', '{"units":[null]}',
])
def test_unavailable_or_invalid_service_keeps_connect_disabled(monkeypatch, failure):
    replies = []

    def get(url, **kwargs):
        if isinstance(failure, Exception):
            raise failure
        return httpx.Response(failure if isinstance(failure, int) else 200,
                              text=failure if isinstance(failure, str) else "",
                              request=httpx.Request("GET", url))

    monkeypatch.setattr(sts_page_server.httpx, "get", get)
    handler = object.__new__(sts_page_server.StsPageHandler)
    monkeypatch.setattr(handler, "_send_json", lambda status, payload: replies.append((status, payload)))
    handler._handle_realtime_ready()
    assert replies == [(503, {"ready": False})]

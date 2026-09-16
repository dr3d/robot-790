import json
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from http.server import ThreadingHTTPServer

import httpx
import pytest

from robot_790d import sts_page_server
from robot_790d.idle_art import IdleArtService, validate_proposal
from robot_790d.sts_page_server import _brain2_response_format

PROPOSAL = {"prompt": "A tiny observatory built inside a brass teacup.", "title": "Tea observatory"}


def arm(service):
    return service.arm({"run_id": str(uuid.uuid4()), "consent": True, "model": "test", "quality": "low"})


def job(grant, proposal=PROPOSAL):
    return {**grant, "job_id": str(uuid.uuid4()), "proposal": proposal}


def test_permission_no_quota_and_durable_idempotency(tmp_path):
    calls = []

    def render(*args, **kwargs):
        calls.append((args, kwargs))
        return {"status": "ok", "filename": "art.png", "url": "/generated-images/art.png"}

    service = IdleArtService(tmp_path, render)
    grant = arm(service)
    assert service.available(grant)
    request = job(grant)
    result = service.render(request)
    assert result["filename"] == "art.png"
    assert service.available(grant)
    assert service.render(request) == result
    with pytest.raises(ValueError, match="already attempted"):
        service.render(job(grant))
    restarted = IdleArtService(tmp_path, render)
    new_grant = restarted.arm({"run_id": grant["run_id"], "consent": True})
    assert restarted.render({**request, **new_grant}) == result
    second = restarted.render(job(new_grant, {**PROPOSAL, "prompt": "A tiny harbor built inside a copper kettle."}))
    assert second["status"] == "ok"
    record = json.loads((tmp_path / "logs/idle-art" / f"{grant['run_id']}.json").read_text())
    assert record["attempts"][0]["result"]["filename"] == "art.png"
    assert grant["token"] not in json.dumps(record)
    assert len(calls) == 2


def test_failure_is_not_retried_but_does_not_block_new_ideas(tmp_path):
    def fail(*args, **kwargs):
        raise TimeoutError("provider timeout")

    service = IdleArtService(tmp_path, fail)
    grant = arm(service)
    request = job(grant)
    result = service.render(request)
    assert result["status"] == "error"
    assert service.available(grant)
    assert service.render(request) == result
    with pytest.raises(ValueError):
        service.render(job(grant))


def test_concurrent_requests_and_revoke_inflight(tmp_path):
    started, finish = threading.Event(), threading.Event()

    def render(*args, **kwargs):
        started.set()
        assert finish.wait(3)
        return {"status": "ok", "filename": "late.png"}

    service = IdleArtService(tmp_path, render)
    grant = arm(service)
    with ThreadPoolExecutor() as pool:
        future = pool.submit(service.render, job(grant))
        assert started.wait(3)
        try:
            with pytest.raises(ValueError, match="already in flight"):
                service.render(job(grant))
            service.revoke(grant)
            assert not service.available(grant)
        finally:
            finish.set()
        assert future.result()["filename"] == "late.png"
    record = json.loads((tmp_path / "logs/idle-art" / f"{grant['run_id']}.json").read_text())
    assert record["attempts"][0]["state"] == "complete"


def test_consent_revoke_and_invalid_data(tmp_path):
    now = [0]
    service = IdleArtService(tmp_path, clock=lambda: now[0])
    with pytest.raises(ValueError):
        service.arm({"run_id": str(uuid.uuid4()), "consent": "true"})
    with pytest.raises(ValueError):
        service.arm({"run_id": "../../outside", "consent": True})
    assert not service.available(None)
    grant = arm(service)
    assert not service.available({**grant, "token": "wrong"})
    with pytest.raises(ValueError):
        service.render(job(grant, {"prompt": "", "title": "bad"}))
    assert service.available(grant)
    now[0] = 8 * 3600 + 1
    assert service.available(grant)
    service.revoke(grant)
    assert not service.available(grant)
    with pytest.raises(ValueError):
        service.render(job(grant))


def test_schema_and_proposal_are_opt_in():
    ordinary = _brain2_response_format(None, [])["json_schema"]["schema"]
    enabled = _brain2_response_format(None, [], True)["json_schema"]["schema"]
    headline = _brain2_response_format([{"url": "https://example.org"}], [], True)["json_schema"]["schema"]
    assert "art_prompt" not in ordinary["properties"]
    assert "art_prompt" in enabled["required"]
    assert "art_prompt" not in headline["properties"]
    for value in (None, {}, {"prompt": "x" * 1201, "title": "a"}, {"prompt": PROPOSAL["prompt"], "title": 1}):
        assert validate_proposal(value) is None
    assert validate_proposal(PROPOSAL) == PROPOSAL


def test_http_routes_with_fake_provider(tmp_path, monkeypatch):
    calls = []

    def render(*args, **kwargs):
        calls.append(args)
        return {"status": "ok", "filename": "test.png", "url": "/generated-images/test.png"}

    monkeypatch.setattr(sts_page_server, "IDLE_ART", IdleArtService(tmp_path, render))
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(sts_page_server.StsPageHandler, directory=str(tmp_path)))
    thread = threading.Thread(target=server.serve_forever)
    thread.start()
    try:
        with httpx.Client(base_url=f"http://127.0.0.1:{server.server_port}") as client:
            response = client.post("/api/idle-art/arm", json={"run_id": str(uuid.uuid4()), "consent": True})
            assert response.status_code == 200
            grant = response.json()
            request = job(grant)
            first = client.post("/api/idle-art/render", json=request)
            assert first.status_code == 200
            assert client.post("/api/idle-art/render", json=request).json() == first.json()
            assert len(calls) == 1
            assert client.post("/api/idle-art/revoke", json=grant).status_code == 200
            assert client.post("/api/idle-art/render", json=job(grant)).status_code == 400
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)

from __future__ import annotations

import json
import time
from threading import Event, Thread

from websockets.sync.server import serve

from robot_790d import reachy_motion


def test_ipv4_completion_stream_survives_quiet_longer_than_connect_timeout(monkeypatch) -> None:
    monkeypatch.setattr(reachy_motion, "prefer_ipv4", lambda _: True)
    send_receipt, finished = Event(), Event()
    connections = []

    def handler(ws):
        connections.append(ws)
        if send_receipt.wait(5):
            ws.send(json.dumps({"type": "move_completed", "uuid": "after-silence"}))
        finished.wait(5)

    with serve(handler, "127.0.0.1", 0) as server:
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        events = reachy_motion.MoveEvents(f"http://127.0.0.1:{server.socket.getsockname()[1]}", timeout=0.5)
        try:
            events.start()
            assert events.ready.wait(2)
            time.sleep(1.2)
            assert events.ready.is_set(), events.last_error
            send_receipt.set()
            receipt = events.wait("after-silence", timeout=2, cancelled=Event())
            assert receipt["type"] == "move_completed"
            assert len(connections) == 1
            assert events.last_error == ""
        finally:
            events.close()
            send_receipt.set()
            finished.set()
            server.shutdown()
            thread.join(timeout=3)

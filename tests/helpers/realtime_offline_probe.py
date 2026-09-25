"""Warm the real voice pipeline on a test port, denying non-loopback sockets.

Run only with no other voice pipeline occupying its GPU memory. This isolated
process exits after readiness; it never opens an Eric conversation or a mic.
"""

import ipaddress
import json
import os
import runpy
import sys
import threading
import time
import urllib.request


PORT = 18765
blocked = []


def loopback(host):
    if host == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def network_guard(event, args):
    if event == "socket.getaddrinfo":
        host = args[0]
    elif event == "socket.connect" and isinstance(args[1], tuple):
        host = args[1][0]
    else:
        return
    if not loopback(host):
        blocked.append({"event": event, "host": str(host)})
        raise OSError("Offline startup probe denied non-loopback network access")


def watch():
    start = time.monotonic()
    pool = None
    # Ignore HTTP proxy settings: the probe contacts only its own local server.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    while time.monotonic() - start < 180:
        try:
            with opener.open(f"http://127.0.0.1:{PORT}/v1/pool", timeout=1) as response:
                pool = json.load(response)
            if any(unit.get("state") == "idle" for unit in pool.get("units", [])):
                break
        except (OSError, ValueError):
            pass
        time.sleep(1)
    ready = bool(pool and any(unit.get("state") == "idle" for unit in pool.get("units", [])))
    print(json.dumps({"offline_probe": {
        "ready": ready, "blocked_attempts": blocked,
        "elapsed_seconds": round(time.monotonic() - start, 2),
        "hf_offline": os.environ.get("HF_HUB_OFFLINE"),
        "transformers_offline": os.environ.get("TRANSFORMERS_OFFLINE"),
    }}), flush=True)
    # All work belongs to this disposable probe; no live session was admitted.
    os._exit(0 if ready and not blocked else 1)


if __name__ == "__main__":
    os.environ.pop("ROBOT_790_ALLOW_MODEL_DOWNLOADS", None)
    sys.addaudithook(network_guard)
    threading.Thread(target=watch, daemon=True).start()
    sys.argv = ["robot-790-offline-probe", "--mode", "realtime", "--ws_host", "127.0.0.1",
                "--ws_port", str(PORT), "--num_pipelines", "1", *sys.argv[1:]]
    runpy.run_module("robot_790d.realtime_entry", run_name="__main__")

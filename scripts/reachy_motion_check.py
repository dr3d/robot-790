"""Read-only timing by default. --move explicitly exercises bounded gestures and stop."""

from __future__ import annotations

import argparse
import json
import time
from datetime import datetime
from pathlib import Path

import httpx

from robot_790d.reachy_motion import prefer_ipv4


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adapter", default="http://127.0.0.1:8792/")
    parser.add_argument("--daemon", default="http://reachy-mini.local:8000/")
    parser.add_argument("--move", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report: dict = {"at": datetime.now().astimezone().isoformat(), "timings": [], "gestures": []}
    for mode in ("default", "ipv4"):
        for sample in range(3):
            transport = httpx.HTTPTransport(local_address="0.0.0.0" if mode == "ipv4" else None)
            with httpx.Client(base_url=args.daemon, transport=transport, timeout=4, trust_env=False) as client:
                started = time.perf_counter()
                response = client.get("api/daemon/status")
                response.raise_for_status()
                report["timings"].append(
                    {"mode": mode, "sample": sample, "seconds": round(time.perf_counter() - started, 4)}
                )
    with httpx.Client(base_url=args.adapter, timeout=10, trust_env=False) as client:

        def state() -> dict:
            response = client.get("state")
            response.raise_for_status()
            return response.json()

        def post(path: str, payload: dict) -> dict:
            response = client.post(path, json=payload)
            response.raise_for_status()
            result = response.json()
            if not result.get("ok"):
                raise RuntimeError(f"{path}: {result}")
            return result

        report["initial"] = state()
        print(json.dumps(report["timings"]), flush=True)
        if args.move:
            initial = report["initial"]
            if not initial.get("motion_enabled") or not initial.get("motion_events", {}).get("connected"):
                raise RuntimeError("Motion or completion stream is not ready.")
            if (initial.get("sequence") or {}).get("status") == "running":
                raise RuntimeError("A gesture is already running.")
            try:
                for name in (
                    "slow_smile",
                    "double_take",
                    "drowsy",
                    "robot_scan",
                    "thoughtful",
                    "confused",
                    "inspect",
                    "focus_lock",
                ):
                    start = time.perf_counter()
                    receipt = post("beat", {"name": name})
                    entry = {
                        "name": name,
                        "acceptance_s": round(time.perf_counter() - start, 4),
                        "receipt": receipt,
                        "samples": [],
                    }
                    report["gestures"].append(entry)
                    # Reproduce the old overwrite bug while each explicit gesture runs.
                    cue = post("control", {"source": "lifecycle", "emotion": "happy", "mouth": {"talking": True}})
                    if cue["status"] != "held":
                        raise RuntimeError("Lifecycle cue did not yield to explicit gesture.")
                    deadline = time.monotonic() + 12
                    while time.monotonic() < deadline:
                        current = state()
                        entry["samples"].append(
                            {
                                key: current.get(key)
                                for key in ("sequence", "head_pose", "antennas_position", "body_yaw")
                            }
                        )
                        status = (current.get("sequence") or {}).get("status")
                        if status != "running":
                            if status != "completed":
                                raise RuntimeError(f"{name}: {status}")
                            break
                        time.sleep(0.12)
                    else:
                        raise RuntimeError(f"{name} did not complete in time")
                    print(f"{name}: completed, dispatch {entry['acceptance_s']:.3f}s", flush=True)

                post("beat", {"name": "double_take"})
                time.sleep(0.2)
                report["stop"] = post("stop", {})
                time.sleep(1)
                stopped = state()
                report["after_stop"] = stopped
                if stopped["sequence"]["status"] != "interrupted" or stopped["sequence"]["completed_steps"]:
                    raise RuntimeError("Stop failed to prevent subsequent steps.")
                daemon_transport = httpx.HTTPTransport(local_address="0.0.0.0" if prefer_ipv4(args.daemon) else None)
                with httpx.Client(base_url=args.daemon, transport=daemon_transport, timeout=4) as daemon:
                    running = daemon.get("api/move/running").json()
                    report["running_after_stop"] = running
                    if any(row["uuid"] in report["stop"]["stopped_uuids"] for row in running):
                        raise RuntimeError("Stopped adapter move remains running.")
                print("stop: interrupted first step; no later steps dispatched", flush=True)
            finally:
                post("stop", {})
                # Small explicit recenter, not wake, sleep, parking, or motor disable.
                report["recenter"] = post(
                    "control", {"emotion": "focused", "gaze": {"x": 0, "y": 0}, "mouth": {"talking": False}}
                )
                time.sleep(1)
                report["final"] = state()
                if args.output:
                    args.output.parent.mkdir(parents=True, exist_ok=True)
                    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
        if args.output and not args.move:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()

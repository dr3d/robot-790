"""Opt-in, bounded LM Studio telemetry. Never stores prompts or model output."""

from __future__ import annotations

import argparse
import json
import logging
import math
import os
import queue
import re
import subprocess
import threading
import time
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_event(line: str) -> list[dict]:
    """Keep numeric prediction stats and recognized engine diagnostics only."""
    try:
        event = json.loads(line)
    except (ValueError, TypeError):
        return []
    if not isinstance(event, dict) or not isinstance(event.get("data"), dict):
        return []
    data = event["data"]
    base = {"observed_at": utc_now(), "engine_timestamp_ms": event.get("timestamp")}
    for key in ("modelIdentifier", "engineName", "engineVersion", "instanceReference", "pid"):
        if isinstance(data.get(key), (str, int)):
            base[key] = data[key]
    if data.get("type") == "llm.prediction.output":
        stats = data.get("stats")
        if not isinstance(stats, dict):
            return []
        allowed = (
            "tokensPerSecond",
            "timeToFirstTokenSec",
            "totalTimeSec",
            "promptTokensCount",
            "predictedTokensCount",
            "totalTokensCount",
        )
        numbers = {
            key: stats[key]
            for key in allowed
            if isinstance(stats.get(key), (int, float)) and math.isfinite(stats[key])
        }
        return [{**base, "kind": "prediction_stats", **numbers}] if numbers else []
    if data.get("type") != "runtime.log" or not isinstance(data.get("message"), str):
        return []
    records = []
    for message in data["message"].splitlines():
        slot = re.search(r"slot\s+(\w+):\s+id\s+(\d+)\s*\|\s*task\s+(-?\d+)\s*\|\s*(.*)", message)
        if not slot:
            eviction = re.search(
                r"making room for prompt cache entry, removing oldest entry \(size = ([\d.]+) MiB\)", message
            )
            if eviction:
                records.append({**base, "kind": "cache_eviction", "size_mib": float(eviction[1])})
            continue
        context = {**base, "slot": int(slot[2]), "task": int(slot[3])}
        body = slot[4]
        timing = re.fullmatch(
            r"(prompt eval|eval|total) time\s*=\s*([\d.]+) ms /\s*(\d+) tokens(?:\s*\(.*\))?", body.strip()
        )
        if timing:
            kind = {"prompt eval": "prompt_eval", "eval": "generation", "total": "total"}[timing[1]]
            record = {**context, "kind": kind, "milliseconds": float(timing[2]), "tokens": int(timing[3])}
            speed = re.search(r"([\d.]+) tokens per second", body)
            if speed:
                record["tokens_per_second"] = float(speed[1])
            records.append(record)
        elif body.startswith("selected slot by "):
            selection = "prefix_similarity" if "LCP similarity" in body else "lru" if "LRU" in body else "other"
            record = {**context, "kind": "slot_selection", "method": selection}
            for name in ("f_sim_best", "f_keep"):
                match = re.search(rf"{name}\s*=\s*([\d.]+)", body)
                if match:
                    record[name] = float(match[1])
            records.append(record)
        elif body.startswith("processing task,"):
            records.append({**context, "kind": "task_start"})
        elif body.startswith("stop processing:"):
            match = re.search(r"n_tokens\s*=\s*(\d+), truncated\s*=\s*(\d+)", body)
            if match:
                records.append(
                    {**context, "kind": "task_end", "resident_tokens": int(match[1]), "truncated": int(match[2])}
                )
    return records


def acquire_lock(path: Path):
    handle = path.open("a+b")
    if path.stat().st_size == 0:
        handle.write(b"0")
        handle.flush()
    handle.seek(0)
    try:
        if os.name == "nt":
            import msvcrt

            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl

            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        handle.close()
        return None
    return handle


def write_status(path: Path, status: dict) -> None:
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps({**status, "updated_at": utc_now()}, indent=2), encoding="utf-8")
    temporary.replace(path)


def capture(lms: str, directory: Path, hours: float) -> int:
    directory.mkdir(parents=True, exist_ok=True)
    lock = acquire_lock(directory / "capture.lock")
    if lock is None:
        print("LLM metrics capture already running.", flush=True)
        return 0
    stop_file = directory / "stop.request"
    stop_file.unlink(missing_ok=True)
    status_path = directory / "status.json"
    status = {
        "state": "starting",
        "pid": os.getpid(),
        "started_at": utc_now(),
        "max_hours": hours,
        "records": 0,
        "streams": {},
        "last_metric_at": None,
    }
    handler = RotatingFileHandler(
        directory / "engine.jsonl", maxBytes=10 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger = logging.getLogger("robot790.llm_metrics")
    logger.setLevel(logging.INFO)
    logger.propagate = False
    logger.addHandler(handler)
    messages: queue.Queue = queue.Queue(maxsize=4096)
    processes = []
    threads = []

    def read_stream(source, process):
        try:
            for line in process.stdout:
                messages.put((source, line))
        finally:
            messages.put((source, None))

    result = 0
    try:
        write_status(status_path, status)
        for source in ("runtime", "model"):
            command = [lms, "log", "stream", "--source", source, "--json"]
            if source == "model":
                command += ["--filter", "output", "--stats"]
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
            processes.append(process)
            status["streams"][source] = {"pid": process.pid, "ready": False}
            thread = threading.Thread(target=read_stream, args=(source, process), daemon=True)
            thread.start()
            threads.append(thread)
        logger.info(json.dumps({"kind": "capture_start", **status}))
        deadline = time.monotonic() + hours * 3600
        next_status = 0.0
        while time.monotonic() < deadline and not stop_file.exists():
            try:
                source, line = messages.get(timeout=0.5)
            except queue.Empty:
                source, line = "", ""
            if source and line is None:
                status.update(state="failed", error=f"{source} log stream ended; restart capture")
                result = 1
                break
            if source:
                if "Streaming logs from LM Studio" in line:
                    status["streams"][source]["ready"] = True
                for record in parse_event(line):
                    status["streams"][source]["ready"] = True
                    logger.info(json.dumps(record))
                    status["records"] += 1
                    status["last_metric_at"] = record["observed_at"]
                if all(item["ready"] for item in status["streams"].values()):
                    status["state"] = "recording"
            if time.monotonic() >= next_status:
                write_status(status_path, status)
                next_status = time.monotonic() + 2
        if status["state"] != "failed":
            status["state"] = "stopped"
            status["reason"] = "operator stop" if stop_file.exists() else "time limit"
    except (OSError, KeyboardInterrupt) as exc:
        status.update(state="failed", error=type(exc).__name__)
        result = 1
    finally:
        for process in processes:
            if process.poll() is None:
                process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        for thread in threads:
            thread.join(timeout=1)
        for process in processes:
            process.stdout.close()
        logger.info(json.dumps({"kind": "capture_stop", **status}))
        write_status(status_path, status)
        handler.close()
        logger.removeHandler(handler)
        lock.close()
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lms", required=True)
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--hours", type=float, default=8)
    args = parser.parse_args()
    if not math.isfinite(args.hours) or not 0 < args.hours <= 24:
        parser.error("hours must be greater than zero and at most 24")
    raise SystemExit(capture(args.lms, args.directory, args.hours))


if __name__ == "__main__":
    main()

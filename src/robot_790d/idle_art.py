"""Operator-enabled idle art with durable receipts, serialization and no retries."""

from __future__ import annotations

import json
import secrets
import threading
import time
import uuid
from pathlib import Path

from robot_790d.image_generation import MAX_PROMPT_CHARS, generate_image


def validate_proposal(value: object, *, min_prompt_chars: int = 12, max_prompt_chars: int = 1200) -> dict | None:
    if not isinstance(value, dict):
        return None
    prompt, title = value.get("prompt"), value.get("title")
    if not isinstance(prompt, str) or not isinstance(title, str):
        return None
    if not min_prompt_chars <= len(prompt.strip()) <= max_prompt_chars or not 1 <= len(title.strip()) <= 80:
        return None
    return {"prompt": prompt.strip(), "title": title.strip()}


class IdleArtService:
    def __init__(self, root: Path, renderer=generate_image, clock=time.time):
        self.root = root
        self.renderer = renderer
        self.clock = clock
        self.lock = threading.Lock()
        self.grants: dict[str, dict] = {}
        self.inflight: set[str] = set()

    def _path(self, run_id: str) -> Path:
        try:
            if str(uuid.UUID(run_id)) != run_id:
                raise ValueError
        except (ValueError, TypeError, AttributeError):
            raise ValueError("Invalid idle-art run ID") from None
        return self.root / "logs" / "idle-art" / f"{run_id}.json"

    def _read(self, run_id: str) -> dict:
        path = self._path(run_id)
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        return {"run_id": run_id, "attempts": []}

    def _write(self, record: dict) -> None:
        path = self._path(record["run_id"])
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(record, indent=2), encoding="utf-8")
        temporary.replace(path)

    def arm(self, payload: dict) -> dict:
        run_id = payload.get("run_id")
        if payload.get("consent") is not True:
            raise ValueError("Idle art requires explicit operator consent")
        with self.lock:
            record = self._read(run_id)
            token = secrets.token_urlsafe(32)
            self.grants[run_id] = {
                "token": token,
                "model": str(payload.get("model") or "")[:120],
                "quality": str(payload.get("quality") or "")[:24],
            }
            record["armed_at"] = self.clock()
            self._write(record)
            return {"status": "ok", "run_id": run_id, "token": token}

    def _authorized(self, payload: object) -> bool:
        if not isinstance(payload, dict):
            return False
        run_id, token = payload.get("run_id"), payload.get("token")
        if not isinstance(run_id, str) or not isinstance(token, str):
            return False
        grant = self.grants.get(run_id)
        return bool(grant and secrets.compare_digest(grant["token"], token))

    def available(self, payload: object) -> bool:
        with self.lock:
            return self._authorized(payload) and payload["run_id"] not in self.inflight

    def revoke(self, payload: dict) -> dict:
        with self.lock:
            if self._authorized(payload):
                del self.grants[payload["run_id"]]
        return {"status": "ok"}

    def render(self, payload: dict) -> dict:
        proposal = validate_proposal(payload.get("proposal"), min_prompt_chars=1, max_prompt_chars=MAX_PROMPT_CHARS)
        if not proposal:
            raise ValueError("Invalid idle-art proposal")
        size = payload.get("size", "1024x1024")
        if not isinstance(size, str) or size not in {"1024x1024", "1536x1024", "1024x1536", "auto"}:
            raise ValueError("Idle-art size must be 1024x1024, 1536x1024, 1024x1536 or auto")
        with self.lock:
            if not self._authorized(payload):
                raise ValueError("Idle-art permission absent or revoked")
            run_id = payload["run_id"]
            record = self._read(run_id)
            job_id = payload.get("job_id")
            self._path(job_id)  # Validate the client idempotency key without using it as a path.
            previous = next((job for job in record["attempts"] if job["job_id"] == job_id), None)
            if previous:
                if "result" in previous:
                    return {**previous["result"], "idle_art_run": run_id, "idle_art_job": job_id}
                raise ValueError("Idle-art job already submitted; outcome pending or unknown, not retried")
            if run_id in self.inflight:
                raise ValueError("An idle-art render is already in flight")
            if any(job["prompt"] == proposal["prompt"] for job in record["attempts"]):
                raise ValueError("This exact idle-art proposal was already attempted; not retried")
            grant = dict(self.grants[run_id])
            attempt = {"job_id": job_id, "state": "started", "started_at": self.clock(), **proposal}
            record["attempts"].append(attempt)
            # Reserve durably BEFORE contacting a paid provider, including failures/timeouts.
            self._write(record)
            self.inflight.add(run_id)
        try:
            result = self.renderer(
                proposal["prompt"],
                title=proposal["title"],
                size=size,
                model=grant["model"] or None,
                quality=grant["quality"] or None,
                repo_root=self.root,
            )
        except Exception as exc:
            result = {"status": "error", "error": str(exc)}
        with self.lock:
            try:
                record = self._read(run_id)
                attempt = next(job for job in record["attempts"] if job["job_id"] == job_id)
                attempt.update(
                    state="complete" if result.get("status") == "ok" else "failed",
                    completed_at=self.clock(),
                    result=result,
                )
                self._write(record)
            finally:
                self.inflight.discard(run_id)
        return {**result, "idle_art_run": run_id, "idle_art_job": job_id}

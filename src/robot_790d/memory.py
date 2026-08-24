from __future__ import annotations

import json
import os
import threading
import time
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

SCHEMA_VERSION = 1
MAX_FACTS = 80
MAX_NAME_CHARS = 48
MAX_FACT_CHARS = 320
MEMORY_FILENAME = "memory.v1.json"

_STORE_LOCK = threading.Lock()


@dataclass(frozen=True)
class NamedFact:
    name: str
    fact: str
    updated_at: int

    def to_json(self) -> dict[str, object]:
        return {
            "name": self.name,
            "fact": self.fact,
            "updatedAt": self.updated_at,
        }


def memory_path_for_instance(instance_path: str | Path | None = None) -> Path:
    if instance_path is not None:
        return Path(instance_path).expanduser() / MEMORY_FILENAME

    env_path = os.getenv("ROBOT_790_MEMORY_PATH")
    if env_path:
        return Path(env_path).expanduser()

    data_home = os.getenv("XDG_DATA_HOME")
    data_root = Path(data_home).expanduser() if data_home else Path.home() / ".local" / "share"
    return data_root / "robot-790" / MEMORY_FILENAME


def normalize_fact_name(name: str) -> str:
    normalized = "_".join(name.lower().strip().replace("-", "_").split())
    normalized = "".join(ch for ch in normalized if ch.isalnum() or ch == "_")
    return normalized[:MAX_NAME_CHARS].strip("_")


def normalize_fact_text(text: str) -> str:
    normalized = " ".join(text.split()).strip()
    if len(normalized) <= MAX_FACT_CHARS:
        return normalized
    return f"{normalized[: MAX_FACT_CHARS - 3]}..."


def _now_ms() -> int:
    return int(time.time() * 1000)


def _fact_from_json(value: object) -> NamedFact | None:
    if not isinstance(value, Mapping):
        return None

    name = value.get("name")
    fact = value.get("fact")
    updated_at = value.get("updatedAt")
    if not isinstance(name, str) or not isinstance(fact, str):
        return None
    if not isinstance(updated_at, (int, float)):
        return None

    normalized_name = normalize_fact_name(name)
    normalized_fact = normalize_fact_text(fact)
    if not normalized_name or not normalized_fact:
        return None
    return NamedFact(name=normalized_name, fact=normalized_fact, updated_at=int(updated_at))


def _read_memory_file(path: Path) -> list[NamedFact]:
    try:
        raw = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return []
    except OSError:
        return []

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []

    if not isinstance(parsed, Mapping):
        return []

    facts_value = parsed.get("facts")
    if not isinstance(facts_value, list):
        return []

    facts: list[NamedFact] = []
    seen: set[str] = set()
    for item in facts_value:
        fact = _fact_from_json(item)
        if fact is None or fact.name in seen:
            continue
        seen.add(fact.name)
        facts.append(fact)
    return facts[:MAX_FACTS]


def _write_memory_file(path: Path, facts: list[NamedFact]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": SCHEMA_VERSION,
        "facts": [fact.to_json() for fact in facts[:MAX_FACTS]],
    }
    tmp_path = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        tmp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        tmp_path.replace(path)
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass


def list_facts(instance_path: str | Path | None = None) -> list[NamedFact]:
    with _STORE_LOCK:
        return list(_read_memory_file(memory_path_for_instance(instance_path)))


def remember_fact(instance_path: str | Path | None, name: str, fact: str) -> NamedFact | None:
    normalized_name = normalize_fact_name(name)
    normalized_fact = normalize_fact_text(fact)
    if not normalized_name or not normalized_fact:
        return None

    path = memory_path_for_instance(instance_path)
    with _STORE_LOCK:
        facts = _read_memory_file(path)
        stored = NamedFact(name=normalized_name, fact=normalized_fact, updated_at=_now_ms())
        remaining = [item for item in facts if item.name != normalized_name]
        _write_memory_file(path, [stored, *remaining][:MAX_FACTS])
        return stored


def forget_fact(instance_path: str | Path | None, name: str) -> NamedFact | None:
    normalized_name = normalize_fact_name(name)
    if not normalized_name:
        return None

    path = memory_path_for_instance(instance_path)
    with _STORE_LOCK:
        facts = _read_memory_file(path)
        removed = next((item for item in facts if item.name == normalized_name), None)
        if removed is None:
            return None
        _write_memory_file(path, [item for item in facts if item.name != normalized_name])
        return removed


def clear_facts(instance_path: str | Path | None = None) -> None:
    path = memory_path_for_instance(instance_path)
    with _STORE_LOCK:
        _write_memory_file(path, [])


def format_memory_for_prompt(instance_path: str | Path | None = None) -> str:
    facts = list_facts(instance_path)
    if not facts:
        return ""

    bullets = "\n".join(f"- {fact.name}: {fact.fact}" for fact in facts)
    return "\n".join(
        [
            "Persistent named facts you remember about the user and Robot 790's context:",
            bullets,
            "Use these facts naturally. Do not recite them as a list unless asked.",
        ]
    )

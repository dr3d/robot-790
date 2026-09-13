"""Resumable offline summary experiment; never installs variants or changes history.

Run with python -m robot_790d.summary_chunk_lab SOURCE --output logs/TRIAL.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import time
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

import httpx

from robot_790d.session_preparation import session_transcript
from robot_790d.summary_chunks import (
    COMPACT_MERGE_PROMPT,
    EXTRACT_PROMPT,
    MERGE_PROMPT,
    VERSION,
    chunk_input,
    memory_request,
    merge_batches,
    merge_input,
    parse_memories,
    split_transcript,
)

Completion = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]


def digest(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def write_json(path: Path, value: Any) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(path)


async def local_completion(request: dict[str, Any]) -> dict[str, Any]:
    async def require_idle() -> None:
        # Fresh monitor connection avoids stale keepalive failures during long inference.
        async with httpx.AsyncClient(timeout=5, trust_env=False) as monitor:
            response = await monitor.get("http://127.0.0.1:8765/v1/pool")
            response.raise_for_status()
            if response.json()["in_use"] != 0:
                raise RuntimeError("Live STS takes priority; rerun later to resume checkpoints.")

    await require_idle()
    async with httpx.AsyncClient(timeout=360, trust_env=False) as client:
        task = asyncio.create_task(client.post("http://127.0.0.1:1234/v1/chat/completions", json=request))
        try:
            while not task.done():
                await asyncio.wait({task}, timeout=5)
                if not task.done():
                    await require_idle()
            response = await task
            response.raise_for_status()
            return response.json()
        finally:
            if not task.done():
                task.cancel()
            await asyncio.gather(task, return_exceptions=True)


async def run_experiment(
    source: Path, output: Path, *, model: str, target_chars: int = 4000,
    overlap_turns: int = 2, extract_thinking: bool = False, merge_thinking: bool = True,
    compact: bool = False,
    extraction_from: Path | None = None,
    complete: Completion = local_completion,
) -> dict[str, Any]:
    raw = source.read_bytes()
    source_hash = hashlib.sha256(raw).hexdigest()
    turns, chunks = split_transcript(
        session_transcript(raw.decode("utf-8-sig")), target_chars=target_chars, overlap_turns=overlap_turns,
    )
    if not turns:
        raise ValueError("No transcript turns found; no experiment was created.")
    if source.resolve().is_relative_to(output.resolve()):
        raise ValueError("Experiment output must not contain the source file.")
    merge_prompt = COMPACT_MERGE_PROMPT if compact else MERGE_PROMPT
    manifest = {
        "version": VERSION, "source": str(source.resolve()), "source_sha256": source_hash,
        "model": model, "target_chars": target_chars, "overlap_turns": overlap_turns,
        "extract_thinking": extract_thinking, "merge_thinking": merge_thinking,
        "prompt_sha256": digest([EXTRACT_PROMPT, merge_prompt]),
        "turns": len(turns), "chunks": len(chunks),
    }
    output.mkdir(parents=True, exist_ok=True)
    manifest_path = output / "manifest.json"
    if manifest_path.exists():
        if json.loads(manifest_path.read_text(encoding="utf-8")) != manifest:
            raise ValueError("Trial identity changed. Use a new output directory; old evidence is preserved.")
    elif any(output.iterdir()):
        raise ValueError("Output is nonempty without a manifest; use a new directory.")
    else:
        write_json(manifest_path, manifest)
    if extraction_from is not None:
        donor = json.loads((extraction_from / "manifest.json").read_text(encoding="utf-8"))
        if donor["source_sha256"] != source_hash:
            raise ValueError("Extraction donor has different source content.")
    write_json(output / "source-turns.json", [{"id": i, "text": turn} for i, turn in enumerate(turns)])

    async def stage(name: str, prompt: str, data: Any, thinking: bool, owned: set[int] | None = None):
        request = memory_request(prompt, data, model=model, thinking=thinking)
        key = digest(request)
        path = output / f"{name}.json"
        allowed = {item["id"] for item in data["source_turns"]}
        cached = path
        if not cached.exists() and owned is not None and extraction_from is not None:
            cached = extraction_from / path.name
        if cached.exists():
            record = json.loads(cached.read_text(encoding="utf-8"))
            if record["request_sha256"] != key or digest(record["request"]) != key:
                raise ValueError(f"Checkpoint request changed: {name}. Use a new trial directory.")
            items = parse_memories(record["response"], allowed, owned)
            if cached != path:
                record["reused_from"] = str(cached.resolve())
                write_json(path, record)
            print(f"{name}: reused checkpoint ({len(items)} memories)", flush=True)
            return items
        started = time.monotonic()
        record = {"request_sha256": key, "request": request}
        try:
            record["response"] = await complete(request)
            record["elapsed_seconds"] = time.monotonic() - started
            items = parse_memories(record["response"], allowed, owned)
        except (Exception, asyncio.CancelledError) as exc:
            record.update(error=repr(exc), elapsed_seconds=time.monotonic() - started)
            write_json(output / f"{name}.failed-{time.time_ns()}.json", record)
            raise
        write_json(path, record)
        print(f"{name}: {len(items)} memories, {record['elapsed_seconds']:.1f}s", flush=True)
        return items

    candidates = []
    for chunk in chunks:
        candidates.extend(await stage(
            f"extract-{chunk.index:03d}", EXTRACT_PROMPT, chunk_input(chunk, turns),
            extract_thinking, set(chunk.owned_ids),
        ))
    write_json(output / "candidates.json", candidates)
    sections = []
    # Bounded section consolidation avoids recursively dropping evidence to force
    # an arbitrarily long session into one model call. Cross-section dedup is future work.
    for i, batch in enumerate(merge_batches(candidates, turns)):
        sections.append(await stage(f"merge-{i:03d}", merge_prompt, merge_input(batch, turns), merge_thinking))
    if hashlib.sha256(source.read_bytes()).hexdigest() != source_hash:
        raise ValueError("Source changed during preparation; checkpoints retained, no final draft written.")
    result = {
        "status": "draft-unreviewed", "source_sha256": source_hash,
        "candidate_count": len(candidates), "sections": sections,
        "memory_count": sum(map(len, sections)), "chunk_count": len(chunks),
        "consolidation": "single" if len(sections) <= 1 else "sectioned-no-global-dedup",
    }
    write_json(output / "result.json", result)
    lines = ["EXPERIMENTAL MEMORY DRAFT - NOT INSTALLED", f"Source SHA256: {source_hash}", ""]
    for i, section in enumerate(sections):
        if len(sections) > 1:
            lines.extend([f"Section {i + 1}", ""])
        for item in section:
            lines.extend([item["text"], f"Source turns: {item['source_turn_ids']}", ""])
    (output / "summary.txt").write_text("\n".join(lines), encoding="utf-8")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--model", default="qwen3.8-27b-nvfp4-mtp")
    parser.add_argument("--target-chars", type=int, default=4000)
    parser.add_argument("--overlap-turns", type=int, default=2)
    parser.add_argument("--extract-thinking", action="store_true")
    parser.add_argument("--no-merge-thinking", action="store_true")
    parser.add_argument("--compact", action="store_true")
    parser.add_argument(
        "--extraction-from", type=Path, help="Reuse matching extraction receipts to isolate consolidation",
    )
    args = parser.parse_args()
    # Keep this lab's artifacts away from the production session/variant paths.
    logs = Path("logs").resolve()
    if not args.output.resolve().is_relative_to(logs):
        parser.error("--output must be inside this workspace's logs directory")
    result = asyncio.run(run_experiment(
        args.source, args.output, model=args.model, target_chars=args.target_chars,
        overlap_turns=args.overlap_turns, extract_thinking=args.extract_thinking,
        merge_thinking=not args.no_merge_thinking,
        compact=args.compact,
        extraction_from=args.extraction_from,
    ))
    print(json.dumps({k: v for k, v in result.items() if k != "sections"}, indent=2))


if __name__ == "__main__":
    main()

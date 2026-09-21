"""Artifact-only context-compaction rehearsal. Never installs live history.

python -m robot_790d.context_overflow_lab BUNDLE --output logs/TRIAL [--summarize]
The optional model work uses the existing resident-model, live-session-aware lab.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from robot_790d.context_excerpts import excerpt_request as source_excerpt_request
from robot_790d.context_excerpts import parse_excerpt_selection as parse_excerpt_selection
from robot_790d.session_preparation import session_transcript, transcript_turns
from robot_790d.summary_chunk_lab import digest, local_completion, run_experiment, write_json
from robot_790d.summary_chunks import chunk_input, split_transcript

VERSION = "context-overflow-rehearsal-v1"
MODEL = "qwen3.8-27b-nvfp4-mtp"


def excerpt_request(data: dict[str, Any]) -> dict[str, Any]:
    return source_excerpt_request(data, model=MODEL)


def excerpt_memories(turns: list[str], selected: set[int]) -> list[dict[str, Any]]:
    ids = sorted({j for i in selected for j in range(max(0, i - 1), min(len(turns), i + 2))})
    return [
        {"source_turn_ids": [i], "text": turns[i]}
        for i in ids
        if not re.match(r"^\[[^]]+\] (?:You|System): ", turns[i])
    ]


async def run_excerpts(output: Path) -> dict[str, Any]:
    if not output.resolve().is_relative_to(Path("logs").resolve()):
        raise ValueError("Rehearsals must stay under logs.")
    source = output / "prefix.txt"
    source_hash = sha256(source)
    turns, chunks = split_transcript(
        session_transcript(source.read_text(encoding="utf-8")), target_chars=10000, overlap_turns=2
    )
    directory = output / "summary"
    directory.mkdir(exist_ok=True)
    selected: set[int] = set()
    for chunk in chunks:
        request = excerpt_request(chunk_input(chunk, turns))
        key = digest(request)
        path = directory / f"select-{chunk.index:03d}.json"
        if path.exists():
            record = json.loads(path.read_text(encoding="utf-8"))
            if record["request_sha256"] != key or digest(record["request"]) != key:
                raise ValueError("Excerpt checkpoint changed; use a new trial.")
        else:
            record = {"request_sha256": key, "request": request, "response": await local_completion(request)}
            write_json(path, record)
        ids = parse_excerpt_selection(record["response"], set(chunk.owned_ids))
        selected.update(ids)
        print(f"select-{chunk.index:03d}: {len(ids)} source turns", flush=True)
    if sha256(source) != source_hash:
        raise ValueError("Source changed during excerpt selection.")
    result = {
        "source_sha256": source_hash,
        "method": "verbatim-excerpts-with-adjacent-context",
        "selected_turn_ids": sorted(selected),
        "sections": [excerpt_memories(turns, selected)],
    }
    write_json(directory / "result.json", result)
    return result


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def seconds(clock: str) -> int:
    """Read either pane-local clocks or backend-local usage clocks."""
    fmt = "%I:%M:%S %p" if clock.endswith(("AM", "PM")) else "%H:%M:%S"
    value = datetime.strptime(clock.split(",")[0], fmt)
    return value.hour * 3600 + value.minute * 60 + value.second


def turn_clock(turn: str) -> int:
    return seconds(turn[1 : turn.index("]")])


def checkpoint(usage: list[dict[str, Any]], limit: int, fraction: float) -> dict[str, Any] | None:
    if type(limit) is not int or limit <= 0 or not 0 < fraction < 1:
        raise ValueError("A positive context limit and a fraction between zero and one are required.")
    return next((row for row in usage if row["input_tokens"] >= limit * fraction), None)


def partition(turns: list[str], recent_turns: int) -> dict[str, Any]:
    if type(recent_turns) is not int or recent_turns < 1:
        raise ValueError("Keep at least one recent turn.")
    boundary = max(0, len(turns) - recent_turns)
    # Source records remain verbatim. Semantics are the summarizer's responsibility.
    protected = [
        {"source_turn_id": i, "text": turn}
        for i, turn in enumerate(turns[:boundary])
        if re.match(r"^\[[^]]+\] (?:You|System): ", turn)
    ]
    recent = [{"source_turn_id": i, "text": turns[i]} for i in range(boundary, len(turns))]
    return {"boundary": boundary, "protected": protected, "recent": recent}


def receipt_index(tools: list[dict[str, Any]], cutoff: int) -> list[dict[str, Any]]:
    """Keep exact outcome identity, not bulky result bodies or inferred intentions."""
    fields = ("status", "filename", "saved_filename", "source_image", "staged", "id", "characters", "error")
    return [
        {
            "event_index": i,
            "time": row["time"],
            "tool": row["name"],
            "outcome": {key: row["result"][key] for key in fields if key in row["result"]},
        }
        for i, row in enumerate(tools)
        if seconds(row["time"]) <= cutoff
    ]


def validate_candidate(
    candidate: dict[str, Any], turns: list[str], receipts: list[dict[str, Any]], recent: int
) -> None:
    expected = partition(turns, recent)
    if candidate["protected"] != expected["protected"] or candidate["recent"] != expected["recent"]:
        raise ValueError("Protected evidence or recent history changed.")
    if candidate["tool_receipts"] != receipts:
        raise ValueError("Tool outcome index changed.")
    for item in candidate["memories"]:
        ids = item["source_turn_ids"]
        if not ids or any(type(i) is not int or not 0 <= i < expected["boundary"] for i in ids):
            raise ValueError("Memory cites material outside the compacted prefix.")
        if candidate.get("method") == "verbatim-excerpts-with-adjacent-context":
            if len(ids) != 1 or item["text"] != turns[ids[0]]:
                raise ValueError("An extractive memory must be an exact original turn.")
    if not candidate["memories"] and expected["boundary"]:
        raise ValueError("An empty draft cannot replace a nonempty prefix.")


def prepare(
    bundle: Path,
    output: Path,
    *,
    at: str,
    limit: int,
    fraction: float,
    recent: int,
    b2_at: tuple[str, ...] = (),
) -> dict[str, Any]:
    if not output.resolve().is_relative_to(Path("logs").resolve()):
        raise ValueError("Rehearsals must stay under logs, away from live notes and variants.")
    if output.exists():
        raise ValueError("Use a new output directory; earlier trials are evidence.")
    source = bundle / "session-note.txt"
    analysis_path = bundle / "analysis.json"
    analysis = json.loads(analysis_path.read_text(encoding="utf-8-sig"))
    all_turns = transcript_turns(session_transcript(source.read_text(encoding="utf-8-sig")))
    clocks = [turn_clock(turn) for turn in all_turns]
    if clocks != sorted(clocks):
        raise ValueError("This rehearsal requires same-day ordered local clocks; midnight needs ISO event alignment.")
    hit = checkpoint(analysis["usage"], limit, fraction)
    if at == "threshold" and hit is None:
        raise ValueError("No recorded request crossed the proposed threshold.")
    cutoff = seconds(hit["time"]) if at == "threshold" and hit else clocks[-1]
    turns = [turn for turn in all_turns if turn_clock(turn) <= cutoff]
    split = partition(turns, recent)
    if not split["boundary"]:
        raise ValueError("Not enough history for a prefix rehearsal.")
    receipts = receipt_index(analysis["tools"], cutoff)
    output.mkdir(parents=True)
    prefix = "Transcript\n----------\n" + "\n".join(turns[: split["boundary"]]) + "\n"
    (output / "prefix.txt").write_text(prefix, encoding="utf-8")
    write_json(output / "source-turns.json", turns)
    manifest = {
        "version": VERSION,
        "source": str(source.resolve()),
        "source_sha256": sha256(source),
        "analysis_source": str(analysis_path.resolve()),
        "analysis_sha256": sha256(analysis_path),
        "at": at,
        "cutoff_local_seconds": cutoff,
        "context_limit": limit,
        "trigger_fraction": fraction,
        "first_trigger_receipt": hit,
        "recent_turns": recent,
        "prefix_turns": split["boundary"],
        "total_turns": len(turns),
        "prefix_sha256": sha256(output / "prefix.txt"),
        "scope": "Current-session transcript and outcomes only; not a replay of the full provider request.",
        "excluded": [
            "loaded prior-session text",
            "system prompt",
            "tool schemas",
            "historical image pixels",
            "unlogged private messages and exact tool-call arguments",
        ],
    }
    write_json(output / "manifest.json", manifest)
    write_json(output / "protected.json", split)
    write_json(output / "tool-receipts.json", receipts)
    # Reconstruct only the documented transcript window, not absent B2 request payloads.
    b2_checks = []
    for clock in b2_at:
        visible = [turn for turn in all_turns if turn_clock(turn) <= seconds(clock)]
        users = [turn for turn in visible if re.match(r"^\[[^]]+\] You: ", turn)]
        b2_checks.append(
            {
                "time": clock,
                "latest_user_utterance": users[-1] if users else None,
                "last_18_transcript_entries": visible[-18:],
                "limitation": "Upper bound reconstructed from transcript; runtime snapshot/pixels not reproduced.",
            }
        )
    write_json(output / "b2-window-checks.json", b2_checks)
    return manifest


def finalize(output: Path) -> dict[str, Any]:
    if not output.resolve().is_relative_to(Path("logs").resolve()):
        raise ValueError("Rehearsals must stay under logs.")
    manifest = json.loads((output / "manifest.json").read_text(encoding="utf-8"))
    if sha256(Path(manifest["source"])) != manifest["source_sha256"]:
        raise ValueError("Original source changed; draft not installed or finalized.")
    if sha256(output / "prefix.txt") != manifest["prefix_sha256"]:
        raise ValueError("Prefix changed; draft not finalized.")
    result = json.loads((output / "summary" / "result.json").read_text(encoding="utf-8"))
    if result["source_sha256"] != manifest["prefix_sha256"]:
        raise ValueError("Summary belongs to a different prefix.")
    turns = json.loads((output / "source-turns.json").read_text(encoding="utf-8"))
    receipts = json.loads((output / "tool-receipts.json").read_text(encoding="utf-8"))
    analysis_path = Path(manifest["analysis_source"])
    if sha256(analysis_path) != manifest["analysis_sha256"]:
        raise ValueError("Analysis source changed.")
    original_turns = transcript_turns(session_transcript(Path(manifest["source"]).read_text(encoding="utf-8-sig")))
    expected_turns = [turn for turn in original_turns if turn_clock(turn) <= manifest["cutoff_local_seconds"]]
    expected_receipts = receipt_index(
        json.loads(analysis_path.read_text(encoding="utf-8-sig"))["tools"], manifest["cutoff_local_seconds"]
    )
    if turns != expected_turns or receipts != expected_receipts:
        raise ValueError("Rehearsal evidence changed relative to the source.")
    candidate = {
        "status": "offline-draft-not-installed",
        "source_sha256": manifest["source_sha256"],
        "method": result.get("method", "paraphrased-summary"),
        "memories": [item for section in result["sections"] for item in section],
        **partition(turns, manifest["recent_turns"]),
        "tool_receipts": receipts,
        "meaning": "Historical evidence, not current sensor state. Proposals are not completed experiments.",
    }
    validate_candidate(candidate, turns, receipts, manifest["recent_turns"])
    write_json(output / "candidate.json", candidate)
    lines = [
        "OFFLINE CONTEXT REHEARSAL - NOT INSTALLED",
        candidate["meaning"],
        "Transcript speakers: You = Scott (operator); Robot 790 / Eric = Eric (robot).",
    ]
    if candidate["method"] == "verbatim-excerpts-with-adjacent-context":
        older = {item["source_turn_ids"][0]: item["text"] for item in candidate["memories"]}
        older.update({item["source_turn_id"]: item["text"] for item in candidate["protected"]})
        lines += ["", "Older Selected Passages In Original Order", "----------------------------------------"]
        lines += [f"[source turn {i}] {text}" for i, text in sorted(older.items())]
    else:
        lines += ["", "Memory Draft", "------------"]
        lines += [f"{item['text']} [source turns {item['source_turn_ids']}]" for item in candidate["memories"]]
        lines += ["", "Protected Operator And System Evidence", "--------------------------------------"]
        lines += [entry["text"] for entry in candidate["protected"]]
    for heading, entries in (("Recent Verbatim Conversation", candidate["recent"]),):
        lines += ["", heading, "-" * len(heading)]
        lines += [entry["text"] for entry in entries]
    lines += ["", "Tool Outcomes (Historical)", "--------------------------", json.dumps(receipts, ensure_ascii=False)]
    rendered = "\n".join(lines) + "\n"
    (output / "candidate.txt").write_text(rendered, encoding="utf-8")
    original = "\n".join(turns)
    checks = {
        "protected_entries": len(candidate["protected"]),
        "recent_entries": len(candidate["recent"]),
        "tool_outcomes": len(receipts),
        "memory_items": len(candidate["memories"]),
        "transcript_characters": len(original),
        "candidate_characters_including_receipts": len(rendered),
        "token_savings": None,
        "token_savings_reason": "No complete provider request or tokenizer/image accounting captured.",
        "structural_checks": "pass",
        "semantic_accuracy": "requires source review; valid citations are not proof",
        "live_installation": False,
    }
    write_json(output / "checks.json", checks)
    return checks


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--at", choices=("threshold", "end"), default="threshold")
    parser.add_argument("--context-limit", type=int, default=131072)
    parser.add_argument("--trigger-fraction", type=float, default=0.8)
    parser.add_argument("--recent-turns", type=int, default=32)
    parser.add_argument("--summarize", action="store_true")
    parser.add_argument("--extractive", action="store_true", help="Select exact passages instead of paraphrasing")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument(
        "--b2-at", action="append", default=[], help="Local pane clock for a B2 transcript-window check"
    )
    args = parser.parse_args()
    if not args.output.resolve().is_relative_to(Path("logs").resolve()):
        parser.error("Rehearsals must stay under logs.")
    if not args.resume:
        prepare(
            args.bundle,
            args.output,
            at=args.at,
            limit=args.context_limit,
            fraction=args.trigger_fraction,
            recent=args.recent_turns,
            b2_at=tuple(args.b2_at),
        )
    else:
        manifest = json.loads((args.output / "manifest.json").read_text(encoding="utf-8"))
        if (
            sha256(Path(manifest["source"])) != manifest["source_sha256"]
            or sha256(args.output / "prefix.txt") != manifest["prefix_sha256"]
        ):
            raise ValueError("Resume source changed; use a new trial.")
        previous_result = args.output / "summary" / "result.json"
        if previous_result.exists():
            result = json.loads(previous_result.read_text(encoding="utf-8"))
            is_extractive = result.get("method") == "verbatim-excerpts-with-adjacent-context"
            if is_extractive != args.extractive:
                raise ValueError("Do not change methods in an existing trial.")
    if args.summarize:
        if args.extractive:
            asyncio.run(run_excerpts(args.output))
        else:
            asyncio.run(
                run_experiment(
                    args.output / "prefix.txt",
                    args.output / "summary",
                    model=MODEL,
                    target_chars=10000,
                    overlap_turns=2,
                    compact=True,
                )
            )
        print(json.dumps(finalize(args.output), indent=2))


if __name__ == "__main__":
    main()

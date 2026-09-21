"""Offline, resumable full-request compaction rehearsal. Never installs context."""

from __future__ import annotations

import argparse
import asyncio
import base64
import copy
import hashlib
import json
import re
import time
from pathlib import Path
from typing import Any

from robot_790d.context_compaction import fold_runtime_snapshots
from robot_790d.context_excerpts import render_excerpts
from robot_790d.context_overflow_lab import excerpt_request, parse_excerpt_selection
from robot_790d.summary_chunk_lab import digest, local_completion, write_json
from robot_790d.summary_chunks import chunk_input, split_transcript

VERSION = "context-wire-lab-v2"
NOTE_HEADER = re.compile(r"^\[([^\]\r\n]+\.(?:txt|md))\]\n", re.M)
TRANSCRIPT = re.compile(r"^Transcript(?: Since Clean Connect)?\n-+\n", re.M)


def historical_blocks(system: str) -> list[dict[str, Any]]:
    """Use the captured note envelope, never reload possibly newer source notes."""
    headers = list(NOTE_HEADER.finditer(system))
    blocks = []
    for i, header in enumerate(headers):
        if not header[1].startswith("sessions/"):
            continue
        end = headers[i + 1].start() if i + 1 < len(headers) else len(system)
        # The final note must not swallow body/voice instructions after its text.
        embodiment = system.find("\nCurrent Robot 790 embodiment:", header.end(), end)
        if embodiment >= 0:
            end = embodiment
        body = system[header.end():end]
        marker = TRANSCRIPT.search(body)
        if marker is None:
            raise ValueError(f"Unsupported historical note format: {header[1]}")
        blocks.append({"name": header[1], "start": header.end() + marker.end(), "end": end})
    if not blocks or len({b["name"] for b in blocks}) != len(blocks):
        raise ValueError("Expected unique captured historical session blocks.")
    return blocks


def apply_excerpts(wire: dict[str, Any], replacements: list[dict[str, Any]]) -> dict[str, Any]:
    candidate = copy.deepcopy(wire)
    system = candidate["messages"][0]["content"]
    if candidate["messages"][0]["role"] != "system":
        raise ValueError("Expected initial system message.")
    blocks = historical_blocks(system)
    if [b["name"] for b in blocks] != [r["name"] for r in replacements]:
        raise ValueError("Historical replacement identity mismatch.")
    for block, replacement in reversed(list(zip(blocks, replacements, strict=True))):
        original = system[block["start"]:block["end"]]
        if digest(original) != replacement["source_sha256"]:
            raise ValueError("Historical source changed.")
        text, _ = render_excerpts(original, set(replacement["selected"]))
        system = system[:block["start"]] + text + system[block["end"]:]
    candidate["messages"][0]["content"] = system
    return candidate


def image_metadata(message: dict[str, Any]) -> dict[str, Any]:
    parts = message.get("content")
    if not isinstance(parts, list):
        raise ValueError("Expected image parts.")
    labels = [p["text"] for p in parts if p.get("type") == "text"
              and p.get("text", "").startswith("[STS sensing image]\n")]
    if len(labels) != 1:
        raise ValueError("Image provenance missing or ambiguous.")
    raw = labels[0].removeprefix("[STS sensing image]\n").split("\n[End STS sensing image]")[0]
    metadata = json.loads(raw)
    if not isinstance(metadata, dict):
        raise ValueError("Invalid image provenance.")
    return metadata


def asset_for(metadata: dict[str, Any], manifest: dict[str, Any], image_dir: Path) -> tuple[Path, str]:
    name = metadata["name"]
    if Path(name).name != name or "/" in name or "\\" in name:
        raise ValueError("Unsafe image identity.")
    matches = [a for a in manifest["images"] if Path(a["name"]).stem == Path(name).stem]
    if len(matches) != 1:
        raise ValueError("Image artifact missing or ambiguous.")
    entry = matches[0]
    source = (image_dir / entry["name"]).resolve()
    if not source.is_relative_to(image_dir.resolve()):
        raise ValueError("Image path escapes evidence directory.")
    raw = source.read_bytes()
    if len(raw) != entry["bytes"] or hashlib.sha256(raw).hexdigest() != entry["sha256"]:
        raise ValueError("Image hash/size mismatch.")
    mime = "image/jpeg" if source.suffix.lower() in (".jpg", ".jpeg") else "image/png"
    return source, f"data:{mime};base64," + base64.b64encode(raw).decode("ascii")


def image_variant(
    wire: dict[str, Any], manifest: dict[str, Any], image_dir: Path, *, keep: int | None,
    allow_recalled_source: bool = False,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    if keep is not None and (type(keep) is not int or keep < 1):
        raise ValueError("Keep at least the current image.")
    candidate = copy.deepcopy(wire)
    indexes = [i for i, m in enumerate(candidate["messages"]) if isinstance(m.get("content"), list)
               and any(p.get("type") == "image_url" for p in m["content"])]
    retained = set(indexes if keep is None else indexes[-keep:])
    references = []
    for i in indexes:
        message = candidate["messages"][i]
        meta = image_metadata(message)
        source, url = asset_for(meta, manifest, image_dir)
        image_parts = [p for p in message["content"] if p.get("type") == "image_url"]
        if len(image_parts) != 1:
            raise ValueError("Expected one image per provenance envelope.")
        part = image_parts[0]
        recorded = part["image_url"]["url"]
        if not isinstance(recorded, dict):
            raise ValueError("Expected scrubbed capture, not live image bytes.")
        if recorded.get("omitted_data_url_characters") != len(url):
            if not allow_recalled_source or meta.get("source") != "sensing-eye filesystem":
                raise ValueError("Reconstructed image differs from captured payload length.")
            references.append({"message_index": i, "kind": "recalled_image_source_substitution",
                               "saved_filename": source.name, "captured_url_chars": recorded.get(
                                   "omitted_data_url_characters"), "replay_url_chars": len(url),
                               "reason": "Recall re-encodes browser canvas without saving those new bytes."})
        if i in retained:
            part["image_url"]["url"] = url
        else:
            saved_name = "logs/sensing-eye/" + source.name
            message["content"] = [p if p is not part else {
                "type": "text",
                "text": "[Historical image reference: " + saved_name
                        + "; original pixels are retained on disk, not attached to this request.]",
            } for p in message["content"]]
            references.append({"message_index": i, "metadata": meta, "saved_filename": saved_name})
    return candidate, references


def completion_request(wire: dict[str, Any], *, question: str, max_tokens: int = 1) -> dict[str, Any]:
    request = {"model": wire["model"], "messages": copy.deepcopy(wire["messages"]),
               **copy.deepcopy(wire["request_options"]), **copy.deepcopy(wire.get("extra_body", {})),
               "stream": False, "max_tokens": max_tokens, "tool_choice": "none"}
    request["messages"].append({"role": "user", "content": question})
    return request


def measurement_request(wire: dict[str, Any]) -> dict[str, Any]:
    request = completion_request(wire, question="Offline diagnostic: reply OK only.")
    # tool_choice=none omits tool schemas from this backend's prompt rendering.
    # This lab never dispatches returned tool calls; preserve native rendering.
    request["tool_choice"] = wire["request_options"].get("tool_choice", "auto")
    return request


async def checkpoint_call(directory: Path, name: str, request: dict[str, Any]) -> dict[str, Any]:
    target = directory / f"{name}.json"
    key = digest(request)
    if target.exists():
        record = json.loads(target.read_text(encoding="utf-8"))
        if record["request_sha256"] != key or digest(record["request"]) != key:
            raise ValueError("Checkpoint identity changed; use a new output directory.")
        cached = record["response"]
        if not isinstance(cached, dict):
            raise ValueError("Invalid checkpoint response.")
        return cached
    record = {"request_sha256": key, "request": request}
    started = time.monotonic()
    try:
        response = await local_completion(request)
        record["response"] = response
        record["elapsed_seconds"] = time.monotonic() - started
    except (Exception, asyncio.CancelledError) as exc:
        record["error"] = repr(exc)
        record["elapsed_seconds"] = time.monotonic() - started
        write_json(directory / f"{name}.failed-{time.time_ns()}.json", record)
        raise
    write_json(target, record)
    print(f"{name}: {record['elapsed_seconds']:.1f}s", flush=True)
    return response


async def rehearse(
    wire_path: Path, evidence: Path, output: Path, checks_path: Path, *, allow_recalled_source: bool = False,
    fold_runtime: bool = False,
) -> dict[str, Any]:
    if not output.resolve().is_relative_to(Path("logs").resolve()):
        raise ValueError("Offline output must stay under logs.")
    if wire_path.resolve().is_relative_to(output.resolve()) or evidence.resolve().is_relative_to(output.resolve()):
        raise ValueError("Output must not contain the source evidence.")
    wire = json.loads(wire_path.read_text(encoding="utf-8"))
    assets = json.loads((evidence / "analysis.json").read_text(encoding="utf-8"))
    checks = json.loads(checks_path.read_text(encoding="utf-8"))
    identity = {"version": VERSION, "source": str(wire_path.resolve()), "source_hash": digest(wire),
                "images_hash": digest(assets["images"]), "checks_hash": digest(checks),
                "allow_recalled_source": allow_recalled_source, "fold_runtime": fold_runtime}
    output.mkdir(parents=True, exist_ok=True)
    manifest = output / "manifest.json"
    if manifest.exists():
        if json.loads(manifest.read_text(encoding="utf-8")) != identity:
            raise ValueError("Trial identity changed; use a new directory.")
    elif any(output.iterdir()):
        raise ValueError("Nonempty output without manifest.")
    else:
        write_json(manifest, identity)
    system = wire["messages"][0]["content"]
    replacements = []
    for index, block in enumerate(historical_blocks(system)):
        source = system[block["start"]:block["end"]]
        turns, chunks = split_transcript(source, target_chars=10000, overlap_turns=2)
        selected: set[int] = set()
        for chunk in chunks:
            request = excerpt_request(chunk_input(chunk, turns))
            request["model"] = wire["model"]
            response = await checkpoint_call(output, f"select-{index:02d}-{chunk.index:02d}", request)
            selected.update(parse_excerpt_selection(response, set(chunk.owned_ids)))
        text, receipt = render_excerpts(source, selected)
        replacements.append({"name": block["name"], **receipt, "text": text})
    write_json(output / "excerpts.json", replacements)
    compact = apply_excerpts(wire, replacements)
    variants = {"baseline": (wire, None), "excerpts": (compact, None), "excerpts-image-refs": (compact, 2)}
    if fold_runtime:
        folded, fold_receipt = fold_runtime_snapshots(wire)
        compact_folded, _ = fold_runtime_snapshots(compact)
        write_json(output / "runtime-fold.json", fold_receipt)
        variants = {"baseline": (wire, None), "runtime-only": (folded, None),
                    "runtime-excerpts": (compact_folded, None), "runtime-excerpts-image-refs": (compact_folded, 2)}
    result: dict[str, Any] = {"installed": False, "variants": {}, "identity": identity}
    for name, (candidate, keep) in variants.items():
        restored, references = image_variant(
            candidate, assets, evidence / "completed-run" / "images", keep=keep,
            allow_recalled_source=allow_recalled_source,
        )
        request = measurement_request(restored)
        response = await checkpoint_call(output, f"measure-native-tools-{name}", request)
        tokens = response["usage"]["prompt_tokens"]
        parsed = await recall_checks(restored, checks, output, name)
        grades = grade_recall(parsed, checks)
        result["variants"][name] = {"prompt_tokens": tokens, "percent_64k": round(tokens / 65536 * 100, 2),
                                    "references": references, "answers": parsed, **grades}
        write_json(output / "results.json", result)
        print(f"{name}: {tokens} input tokens, answers {grades['answers_passed']}/{grades['total']}, "
              f"supported answers {grades['passed']}/{grades['total']}", flush=True)
    if digest(json.loads(wire_path.read_text(encoding="utf-8"))) != identity["source_hash"]:
        raise ValueError("Original request changed during rehearsal.")
    result["source_unchanged"] = True
    baseline = result["variants"]["baseline"]
    result["admission"] = {
        name: {"within_rehearsal_target": entry["prompt_tokens"] <= 65536 * 0.70,
               "no_recall_regression_in_this_sample": entry["answers_passed"] >= baseline["answers_passed"],
               "no_supported_answer_regression_in_this_sample": entry["passed"] >= baseline["passed"],
               "all_checks_pass": entry["passed"] == entry["total"],
               "ready_for_live_installation": False}
        for name, entry in result["variants"].items() if name != "baseline"
    }
    result["measurement"] = "Native tool rendering; one-token generation; no tool execution or live installation."
    write_json(output / "results.json", result)
    return result


async def recall_checks(
    wire: dict[str, Any], checks: dict[str, Any], output: Path, name: str,
) -> dict[str, Any]:
    if "probes" not in checks:
        request = completion_request(wire, question=checks["question"], max_tokens=1024)
        request["temperature"] = 0.2
        request["response_format"] = {"type": "json_schema", "json_schema": {
            "name": "memory_check", "strict": True, "schema": checks["schema"]}}
        answers = await checkpoint_call(output, f"recall-{name}", request)
        return parse_recall(answers)
    results = {}
    for probe in checks["probes"]:
        key = probe["key"]
        if not re.fullmatch(r"[a-z_]+", key) or key in results:
            raise ValueError("Invalid or duplicate probe identity.")
        request = completion_request(wire, question=(
            "Private offline memory check, not spoken dialogue. Answer only this question. "
            "First copy one or more short, exact quotes from the supplied history supporting your answer, "
            "then answer. A remembered proposal is not a completed experiment. "
            "If the evidence is absent, return no quotes and answer unknown.\n" + probe["question"]
            + "\nAnswer with one of these labels: " + ", ".join(probe["choices"])
        ), max_tokens=512)
        request["temperature"] = 0
        request["response_format"] = {"type": "json_schema", "json_schema": {
            "name": "evidence_recall", "strict": True, "schema": {
                "type": "object", "properties": {
                    "quotes": {"type": "array", "maxItems": 6, "items": {"type": "string"}},
                    "answer": {"type": "string"}},
                "required": ["quotes", "answer"], "additionalProperties": False}}}
        answer = parse_recall(await checkpoint_call(output, f"probe-{name}-{key}", request))
        evidence_ok = quotes_supported(wire, answer.get("quotes"))
        results[key] = {**answer, "quotes_found_in_context": evidence_ok}
    return results


def grade_recall(answers: dict[str, Any], checks: dict[str, Any]) -> dict[str, Any]:
    """Keep recall accuracy distinct from exact-quote copying, without relaxing either."""
    if "probes" in checks:
        expected = {probe["key"]: probe["expected"] for probe in checks["probes"]}
        answer_score = {key: answers.get(key, {}).get("answer") == value for key, value in expected.items()}
        quote_score = {key: answers.get(key, {}).get("quotes_found_in_context") is True for key in expected}
        score = {key: answer_score[key] and quote_score[key] for key in expected}
    else:
        answer_score = {key: answers.get(key) == value for key, value in checks["expected"].items()}
        quote_score = None
        score = dict(answer_score)
    return {"answer_score": answer_score, "quote_score": quote_score, "score": score,
            "answers_passed": sum(answer_score.values()),
            "quotes_passed": sum(quote_score.values()) if quote_score is not None else None,
            "passed": sum(score.values()), "total": len(score)}


def parse_recall(response: dict[str, Any]) -> dict[str, Any]:
    choice = response["choices"][0]
    if choice["finish_reason"] != "stop" or choice["message"].get("tool_calls"):
        raise ValueError("Recall test did not finish normally.")
    parsed = json.loads(choice["message"]["content"])
    if not isinstance(parsed, dict):
        raise ValueError("Invalid recall object.")
    return parsed


def quotes_supported(wire: dict[str, Any], quotes: Any) -> bool:
    if not isinstance(quotes, list) or not quotes or any(not isinstance(q, str) or not q.strip() for q in quotes):
        return False
    texts = []
    for message in wire["messages"]:
        content = message.get("content")
        if isinstance(content, str):
            texts.append(content)
        elif isinstance(content, list):
            texts.extend(p["text"] for p in content if p.get("type") == "text")
    sources = [" ".join(t.split()) for t in texts]
    return all(any(" ".join(q.split()) in source for source in sources) for q in quotes)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("wire", type=Path)
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--checks", type=Path, required=True)
    parser.add_argument("--allow-recalled-image-source", action="store_true")
    parser.add_argument("--fold-runtime", action="store_true")
    args = parser.parse_args()
    asyncio.run(rehearse(args.wire, args.evidence, args.output, args.checks,
                        allow_recalled_source=args.allow_recalled_image_source, fold_runtime=args.fold_runtime))


if __name__ == "__main__":
    main()

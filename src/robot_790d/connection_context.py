"""Connection-only context accounting and source-bound excerpt preparation."""

from __future__ import annotations

import asyncio
import hashlib
import json
import threading
from pathlib import Path
from typing import Any, cast

import httpx

from robot_790d.continuity import continuity_session_metadata, format_continuity_session_variant
from robot_790d.note_files import read_note_file
from robot_790d.runtime_model import local_runtime_model
from robot_790d.session_preparation import session_transcript
from robot_790d.summary_chunks import chunk_input, split_transcript

VERSION = "connection-excerpts-v1"
PREPARE_LOCK = threading.Lock()
DEFAULTS = {
    "enabled": True,
    "growth_tokens": 32768,
    "b2_tokens": 6144,
    "output_tokens": 2048,
    "margin_tokens": 1024,
    "warning_tokens": 4096,
    "history_start_index": 1,
    "history_min_recent_sessions": 1,
}


def budget_config(value: Any) -> dict[str, Any]:
    supplied = value if isinstance(value, dict) else {}
    result = {**DEFAULTS, **{key: supplied[key] for key in DEFAULTS if key in supplied}}
    if type(result["enabled"]) is not bool:
        raise ValueError("connection_context.enabled must be boolean.")
    for key in DEFAULTS.keys() - {"enabled"}:
        if type(result[key]) is not int or not 0 <= result[key] <= 1_000_000:
            unit = "session count/index" if key.startswith("history_") else "token count"
            raise ValueError(f"connection_context.{key} must be a nonnegative {unit}.")
    return result


def budget_receipt(tokens: int, window: int, config: dict[str, Any]) -> dict[str, Any]:
    policy = budget_config(config)
    if type(tokens) is not int or tokens < 0 or type(window) is not int or window <= 0:
        raise ValueError("Valid provider token count and loaded context window are required.")
    headroom = sum(policy[key] for key in ("b2_tokens", "output_tokens", "margin_tokens"))
    ceiling = window - headroom
    budget = ceiling - policy["growth_tokens"]
    return {
        "status": "ok", "policy": policy, "prompt_tokens": tokens, "context_window_tokens": window,
        "startup_budget_tokens": budget, "live_input_ceiling_tokens": ceiling,
        "growth_available_tokens": max(0, ceiling - tokens), "fits": budget >= tokens,
        "basis": (
            "Startup estimate from loaded-model tokenizer and chat template, native tools and STS voice wrapper; "
            "no generation. Actual request usage remains authoritative."
        ),
    }


def measure_connection(payload: dict[str, Any], config: dict[str, Any]) -> dict[str, Any]:
    import lmstudio as lms
    from speech_to_speech.LLM.voice_prompt import build_voice_system_prompt

    instructions = payload.get("instructions")
    runtime = payload.get("runtime", "")
    tools = payload.get("tools", [])
    if not isinstance(instructions, str) or not instructions.strip() or len(instructions) > 1_000_000:
        raise ValueError("Missing or oversized connection instructions.")
    if not isinstance(runtime, str) or len(runtime) > 100_000 or not isinstance(tools, list) or len(tools) > 256:
        raise ValueError("Invalid initial runtime or tool catalogue.")
    native_tools = []
    for tool in tools:
        if not isinstance(tool, dict) or tool.get("type") != "function" or not isinstance(tool.get("name"), str):
            raise ValueError("Unsupported realtime tool definition.")
        native_tools.append({"type": "function", "function": {
            key: tool[key] for key in ("name", "description", "parameters", "strict") if key in tool
        }})
    model_name = local_runtime_model()
    if not model_name:
        raise ValueError("No local runtime model selected; start STS before checking its context budget.")
    # list_loaded never downloads, loads or swaps a model.
    lms.set_sync_api_timeout(15)
    with lms.Client("127.0.0.1:1234") as client:
        model = next((item for item in client.llm.list_loaded() if item.identifier == model_name), None)
        if model is None:
            raise ValueError("The selected STS model is not loaded in LM Studio.")
        messages = [{"role": "system", "content": build_voice_system_prompt(instructions)}]
        if runtime:
            messages.append({"role": "assistant", "content": runtime})
        messages.append({"role": "user", "content": "Hello."})
        formatted = model.apply_prompt_template(cast(Any, {"messages": messages}),
                                                opts=cast(Any, {"toolDefinitions": native_tools}))
        tokens = len(model.tokenize(formatted))
        result = budget_receipt(tokens, model.get_context_length(), config)
    return {**result, "model": model_name}


def digest(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def write_checkpoint(path: Path, value: Any) -> None:
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(path)


async def idle_completion(request: dict[str, Any]) -> dict[str, Any]:
    async def require_idle() -> None:
        async with httpx.AsyncClient(timeout=5, trust_env=False) as monitor:
            response = await monitor.get("http://127.0.0.1:8765/v1/pool")
            response.raise_for_status()
            if response.json()["in_use"] != 0:
                raise ValueError("A live STS session takes priority; connect preparation canceled.")

    await require_idle()
    async with httpx.AsyncClient(timeout=90, trust_env=False) as client:
        task = asyncio.create_task(client.post("http://127.0.0.1:1234/v1/chat/completions", json=request))
        try:
            while not task.done():
                await asyncio.wait({task}, timeout=1)
                if not task.done():
                    await require_idle()
            response = await task
            response.raise_for_status()
            await require_idle()
            result = response.json()
            if not isinstance(result, dict):
                raise ValueError("Invalid excerpt completion response.")
            return result
        finally:
            if not task.done():
                task.cancel()
            await asyncio.gather(task, return_exceptions=True)


async def prepare_excerpt(
    filename: str, *, instance_path: str | Path | None = None, cache_root: Path | None = None,
    complete: Any = idle_completion,
) -> dict[str, Any]:
    from robot_790d.context_excerpts import excerpt_request, parse_excerpt_selection, render_excerpts

    name = filename.replace("\\", "/")
    if not name.startswith("sessions/") or len(Path(name).parts) != 2 or not name.endswith(".txt"):
        raise ValueError("Only a current, source session can be compacted at Connect.")
    source = read_note_file(instance_path, name)
    metadata = continuity_session_metadata(source.content)
    if not metadata:
        raise ValueError("Not an original session note; no content changed.")
    source_hash = hashlib.sha256(source.content.encode()).hexdigest()
    model = local_runtime_model()
    if not model:
        raise ValueError("No local model selected for connection preparation.")
    transcript = session_transcript(source.content)
    turns, chunks = split_transcript(transcript, target_chars=10000, overlap_turns=2)
    if len(chunks) > 64:
        raise ValueError("Session exceeds bounded Connect preparation; prepare it offline first.")
    directory = (cache_root or Path(__file__).resolve().parents[2] / "logs" / "connection-context") / digest(
        {"version": VERSION, "source": source_hash, "filename": source.filename, "model": model})
    directory.mkdir(parents=True, exist_ok=True)
    selected: set[int] = set()
    for chunk in chunks:
        request = excerpt_request(chunk_input(chunk, turns), model=model)
        key = digest(request)
        path = directory / f"chunk-{chunk.index:03d}.json"
        if path.exists():
            record = json.loads(path.read_text(encoding="utf-8"))
            if record["request_sha256"] != key or digest(record["request"]) != key:
                raise ValueError("Excerpt cache identity mismatch; originals are unchanged.")
        else:
            record = {"request_sha256": key, "request": request, "response": await complete(request)}
            parse_excerpt_selection(record["response"], set(chunk.owned_ids))
            write_checkpoint(path, record)
        selected.update(parse_excerpt_selection(record["response"], set(chunk.owned_ids)))
    if read_note_file(instance_path, name).content != source.content or local_runtime_model() != model:
        raise ValueError("Source or model changed during connection preparation; retry Connect.")
    text, receipt = render_excerpts(transcript, selected)
    content = format_continuity_session_variant(
        body="Connection-time source excerpts\n\nTranscript\n----------\n" + text,
        source_session_filename=source.filename, source_sha256=source_hash, variant="summary", reviewed=False,
        source_created_label=str(metadata["created"]), created_label=str(metadata["created"]),
    )
    result = {"status": "ok", "filename": source.filename, "content": content,
              "source_sha256": source_hash, "method": VERSION, "selection_model": model, "receipt": receipt}
    write_checkpoint(directory / "result.json", result)
    return result

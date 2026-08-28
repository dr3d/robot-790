from __future__ import annotations

import re
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any

DEFAULT_TAIL_BYTES = 2_000_000


def get_brain_status(repo_root: str | Path | None = None) -> dict[str, Any]:
    """Read local Robot 790 realtime diagnostics from recent logs."""
    root = Path(repo_root).expanduser().resolve() if repo_root else Path(__file__).resolve().parents[2]
    logs_dir = root / "logs"
    err_path = logs_dir / "sts-realtime.err.log"
    out_path = logs_dir / "sts-realtime.out.log"
    events_path = logs_dir / "live" / "latest-events.txt"
    conversation_path = logs_dir / "live" / "latest-conversation.txt"

    err_text = _tail_text(err_path)
    out_text = _tail_text(out_path)
    live_events_text = _tail_text(events_path, max_bytes=500_000)
    live_conversation_text = _tail_text(conversation_path, max_bytes=500_000)

    latest_response = _parse_latest_response(err_text)
    token_usage = _parse_latest_token_usage(err_text)
    model = _parse_startup(out_text, err_text)
    runtime_args = _read_realtime_runtime_args(root)
    if runtime_args.get("model_name"):
        model["llm_model"] = runtime_args["model_name"]
    if runtime_args.get("responses_api_reasoning_effort"):
        model["reasoning_effort"] = runtime_args["responses_api_reasoning_effort"]
    elif runtime_args.get("_running"):
        model["reasoning_effort"] = "omitted"
    if runtime_args.get("responses_api_audio_max_tokens"):
        model["audio_max_tokens"] = _int_or_none(runtime_args["responses_api_audio_max_tokens"])
    lm_studio = _read_lm_studio_status(model.get("llm_model"))
    if lm_studio:
        model["lm_studio"] = lm_studio
        active = lm_studio.get("active_model")
        if isinstance(active, dict):
            model["context_window_tokens"] = active.get("context_window_tokens")
            model["parallel_predictions"] = active.get("parallel_predictions")
    performance = _parse_performance(err_text)
    session = _parse_session(err_text, live_events_text, live_conversation_text)
    _add_estimated_throughput(performance, latest_response, token_usage)
    context = _parse_context(latest_response, token_usage, model)

    return {
        "status": "ok",
        "tool": "get_brain_status",
        "source": "local_logs",
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "model": model,
        "session": session,
        "latest_response": latest_response,
        "performance": performance,
        "context": context,
        "log_files": {
            "realtime_err": _file_info(err_path),
            "realtime_out": _file_info(out_path),
            "latest_events": _file_info(events_path),
            "latest_conversation": _file_info(conversation_path),
        },
        "notes": _build_notes(model, latest_response, performance, context),
    }


def _tail_text(path: Path, max_bytes: int = DEFAULT_TAIL_BYTES) -> str:
    try:
        size = path.stat().st_size
        with path.open("rb") as handle:
            if size > max_bytes:
                handle.seek(size - max_bytes)
            data = handle.read(max_bytes)
    except OSError:
        return ""
    return data.decode("utf-8", errors="replace")


def _file_info(path: Path) -> dict[str, Any]:
    try:
        stat = path.stat()
    except OSError:
        return {"path": str(path), "exists": False}
    return {
        "path": str(path),
        "exists": True,
        "bytes": stat.st_size,
        "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
    }


def _parse_startup(out_text: str, err_text: str) -> dict[str, Any]:
    model: dict[str, Any] = {
        "llm_model": _latest_group(out_text, r"^LLM model:\s*(.+)$"),
        "reasoning_effort": _latest_group(out_text, r"^LLM reasoning effort:\s*(.+)$"),
        "audio_max_tokens": _int_or_none(_latest_group(out_text, r"^LLM audio max tokens:\s*(\d+)\s*$")),
        "tts_model": _latest_group(out_text, r"^TTS model:\s*(.+)$"),
        "tts_prompt": _latest_group(out_text, r"^TTS instruct:\s*(.+)$"),
        "system_prompt_path": _latest_group(out_text, r"^Prompt:\s*(.+)$"),
        "stt_model": _latest_group(err_text, r"Loading Parakeet TDT model:\s*(.+?)\s+on\s+(\S+)"),
        "llm_model_from_runtime": _latest_group(err_text, r"\[([^\]]+)\]\s+Running chat completion"),
    }
    if not model["llm_model"] and model["llm_model_from_runtime"]:
        model["llm_model"] = model["llm_model_from_runtime"]
    return model


def _parse_latest_response(text: str) -> dict[str, Any]:
    pattern = re.compile(
        r"Response done \(status=(?P<status>[^)]+)\).*?"
        r"this response:\s*input_tokens=(?P<input>\d+),\s*"
        r"output_tokens=(?P<output>\d+),\s*audio=(?P<audio>[\d.]+)s\s*\|\s*"
        r"cumulative:\s*input_tokens=(?P<cinput>\d+),\s*"
        r"output_tokens=(?P<coutput>\d+),\s*audio=(?P<caudio>[\d.]+)s",
        re.IGNORECASE,
    )
    matches = list(pattern.finditer(text))
    if not matches:
        return {"status": "unavailable"}
    latest = _response_from_match(matches[-1])
    measured = [match for match in matches if int(match.group("input")) > 0]
    if measured and measured[-1] != matches[-1]:
        latest["previous_measured_response"] = _response_from_match(measured[-1])
    return latest


def _response_from_match(match: re.Match[str]) -> dict[str, Any]:
    return {
        "status": match.group("status"),
        "input_tokens": int(match.group("input")),
        "output_tokens": int(match.group("output")),
        "audio_seconds": float(match.group("audio")),
        "cumulative_input_tokens": int(match.group("cinput")),
        "cumulative_output_tokens": int(match.group("coutput")),
        "cumulative_audio_seconds": float(match.group("caudio")),
    }


def _parse_latest_token_usage(text: str) -> dict[str, Any]:
    pattern = re.compile(r"Token usage \(response\):\s*input=(?P<input>\d+),\s*output=(?P<output>\d+)")
    matches = list(pattern.finditer(text))
    if not matches:
        return {"status": "unavailable"}
    match = matches[-1]
    return {"status": "ok", "input_tokens": int(match.group("input")), "output_tokens": int(match.group("output"))}


def _parse_performance(text: str) -> dict[str, Any]:
    return {
        "llm_handler_seconds": _float_or_none(_latest_group(text, r"ChatCompletionsApiModelHandler:\s*([\d.]+)\s*s")),
        "tts_time_to_first_audio_seconds": _float_or_none(_latest_group(text, r"Qwen3-TTS TTFA:\s*([\d.]+)s")),
        "turn_to_first_speech_seconds": _float_or_none(
            _latest_group(text, r"Last speech detected to first speech out:\s*([\d.]+)s")
        ),
        "tts_generated_audio_seconds": _float_or_none(
            _latest_group(text, r"Qwen3-TTS generated\s*([\d.]+)s audio in")
        ),
        "tts_generation_seconds": _float_or_none(
            _latest_group(text, r"Qwen3-TTS generated\s*[\d.]+s audio in\s*([\d.]+)s")
        ),
        "tts_realtime_factor": _float_or_none(_latest_group(text, r"RTF:\s*([\d.]+)")),
        "prompt_tokens_per_second": _float_or_none(
            _latest_group(text, r"prompt eval time.*?,\s*([\d.]+)\s+tokens per second")
        ),
        "decode_tokens_per_second": _float_or_none(
            _latest_group(text, r"(?<!prompt )eval time.*?,\s*([\d.]+)\s+tokens per second")
        ),
        "stt_final_seconds": _float_or_none(_latest_group(text, r"Parakeet final STT done.*?total=([\d.]+)s")),
        "last_interrupt_cancelled": "speech during response: cancelled" in text[-40_000:]
        or "speech during pending response: cancelled" in text[-40_000:],
    }


def _parse_session(err_text: str, events_text: str, conversation_text: str) -> dict[str, Any]:
    return {
        "latest_conversation_messages": _int_or_none(
            _latest_group(err_text, r"Running chat completion on conversation with\s*(\d+)\s*messages")
        ),
        "tool_list_latest": _latest_group(err_text, r"Tools:\s*(\[.*?\])"),
        "recent_event_lines": _count_nonempty_lines(events_text),
        "recent_conversation_lines": _count_nonempty_lines(conversation_text),
        "latest_transcript": _latest_group(err_text, r"Transcription completed \(language=[^)]+\):\s*(.+)$"),
    }


def _read_lm_studio_status(preferred_model: str | None = None) -> dict[str, Any] | None:
    try:
        completed = subprocess.run(
            ["lms", "ps"],
            check=False,
            capture_output=True,
            encoding="utf-8",
            errors="replace",
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    text = (completed.stdout or "") + "\n" + (completed.stderr or "")
    models = _parse_lms_ps(text)
    active = _choose_lm_studio_model(models, preferred_model)
    return {
        "available": completed.returncode == 0,
        "active_model": active,
        "loaded_models": models,
        "raw_status": _compact_lms_ps(text),
    }


def _parse_lms_ps(text: str) -> list[dict[str, Any]]:
    models: list[dict[str, Any]] = []
    pattern = re.compile(
        r"^(?P<identifier>\S+)\s+"
        r"(?P<model>\S+)\s+"
        r"(?P<status>\S+)\s+"
        r"(?P<size>[\d.]+\s+\S+)\s+"
        r"(?P<context>\d+)\s+"
        r"(?P<parallel>\d+)\s+"
        r"(?P<device>\S+)"
        r"(?:\s+(?P<ttl>.+))?$"
    )
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("IDENTIFIER") or line.startswith("No models"):
            continue
        match = pattern.match(line)
        if not match:
            continue
        models.append(
            {
                "identifier": match.group("identifier"),
                "model": match.group("model"),
                "status": match.group("status"),
                "size": match.group("size"),
                "context_window_tokens": int(match.group("context")),
                "parallel_predictions": int(match.group("parallel")),
                "device": match.group("device"),
                "ttl": (match.group("ttl") or "").strip() or None,
            }
        )
    return models


def _choose_lm_studio_model(models: list[dict[str, Any]], preferred_model: str | None) -> dict[str, Any] | None:
    if not models:
        return None
    preferred = str(preferred_model or "").strip().lower()
    if preferred:
        for model in models:
            identifier = str(model.get("identifier", "")).lower()
            model_name = str(model.get("model", "")).lower()
            if identifier == preferred or model_name == preferred:
                return model
    return models[0]


def _read_realtime_runtime_args(repo_root: Path) -> dict[str, str]:
    command = _read_realtime_commandline(repo_root)
    if not command:
        return {}
    args = {
        key: value
        for key in ("model_name", "responses_api_reasoning_effort", "responses_api_audio_max_tokens")
        if (value := _command_arg(command, key))
    }
    args["_running"] = "true"
    return args


def _read_realtime_commandline(repo_root: Path) -> str:
    try:
        completed = subprocess.run(
            [
                "powershell.exe",
                "-NoProfile",
                "-Command",
                (
                    "Get-CimInstance Win32_Process | "
                    "Where-Object { $_.CommandLine -match '-m robot_790d\\.realtime_entry' } | "
                    "Select-Object -First 1 -ExpandProperty CommandLine"
                ),
            ],
            check=False,
            capture_output=True,
            encoding="utf-8",
            errors="replace",
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return ""
    command = (completed.stdout or "").strip()
    if str(repo_root).lower() not in command.lower():
        return ""
    return command


def _command_arg(command: str, name: str) -> str | None:
    match = re.search(rf"--{re.escape(name)}\s+(?:\"([^\"]+)\"|'([^']+)'|(\S+))", command)
    if not match:
        return None
    return next((group for group in match.groups() if group), None)


def _compact_lms_ps(text: str) -> str:
    lines = [line.rstrip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines[-8:])


def _add_estimated_throughput(
    performance: dict[str, Any],
    latest_response: dict[str, Any],
    token_usage: dict[str, Any],
) -> None:
    output_tokens = latest_response.get("output_tokens")
    if not isinstance(output_tokens, int) or output_tokens <= 0:
        output_tokens = token_usage.get("output_tokens")
    llm_seconds = performance.get("llm_handler_seconds")
    if isinstance(output_tokens, int) and output_tokens > 0 and isinstance(llm_seconds, float) and llm_seconds > 0:
        performance["estimated_end_to_end_output_tokens_per_second"] = round(output_tokens / llm_seconds, 2)
        performance["estimated_throughput_basis"] = (
            "response output tokens divided by ChatCompletionsApiModelHandler seconds"
        )
    elif not performance.get("prompt_tokens_per_second") and not performance.get("decode_tokens_per_second"):
        performance["estimated_end_to_end_output_tokens_per_second"] = None
        performance["estimated_throughput_basis"] = "unavailable"


def _parse_context(
    latest_response: dict[str, Any],
    token_usage: dict[str, Any],
    model: dict[str, Any] | None = None,
) -> dict[str, Any]:
    input_tokens = latest_response.get("input_tokens")
    if not isinstance(input_tokens, int) or input_tokens <= 0:
        previous = latest_response.get("previous_measured_response")
        if isinstance(previous, dict):
            input_tokens = previous.get("input_tokens")
    if not isinstance(input_tokens, int) or input_tokens <= 0:
        input_tokens = token_usage.get("input_tokens")
    pressure = "unknown"
    if isinstance(input_tokens, int):
        if input_tokens >= 48_000:
            pressure = "very_crowded"
        elif input_tokens >= 32_000:
            pressure = "crowded"
        elif input_tokens >= 16_000:
            pressure = "moderate"
        else:
            pressure = "light"
    context_window = model.get("context_window_tokens") if isinstance(model, dict) else None
    window_usage_percent = None
    remaining_context_tokens = None
    if isinstance(input_tokens, int) and isinstance(context_window, int) and context_window > 0:
        window_usage_percent = round(input_tokens / context_window * 100, 1)
        remaining_context_tokens = max(0, context_window - input_tokens)
    return {
        "last_input_tokens": input_tokens if isinstance(input_tokens, int) else None,
        "context_window_tokens": context_window if isinstance(context_window, int) else None,
        "remaining_context_tokens": remaining_context_tokens,
        "window_usage_percent": window_usage_percent,
        "pressure_estimate": pressure,
        "pressure_basis": (
            "last response input token count compared with configured thresholds; "
            "context window is read from LM Studio when available"
        ),
    }


def _build_notes(
    model: dict[str, Any],
    latest_response: dict[str, Any],
    performance: dict[str, Any],
    context: dict[str, Any],
) -> list[str]:
    notes: list[str] = []
    if latest_response.get("status") == "unavailable":
        notes.append("Last response token usage was not found in Robot 790 logs.")
    elif latest_response.get("input_tokens") == 0 and latest_response.get("previous_measured_response"):
        notes.append(
            "Latest response was cancelled or token-empty; context pressure uses the previous measured response."
        )
    if not performance.get("prompt_tokens_per_second") and not performance.get("decode_tokens_per_second"):
        if performance.get("estimated_end_to_end_output_tokens_per_second") is not None:
            notes.append(
                "Exact llama.cpp eval tok/sec was not found, so throughput is estimated from STS response timing."
            )
        else:
            notes.append("Exact LLM tok/sec was not found in Robot 790 logs; LM Studio file logging is currently off.")
    if not model.get("llm_model"):
        notes.append("LLM model name was not found in the startup log.")
    if context.get("context_window_tokens") is None:
        notes.append("Context window size was not found; context pressure is an inference, not a measured maximum.")
    return notes


def _latest_group(text: str, pattern: str) -> str | None:
    matches = list(re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE))
    if not matches:
        return None
    match = matches[-1]
    if len(match.groups()) > 1:
        return " ".join(group for group in match.groups() if group is not None).strip()
    value = match.group(1)
    return value.strip() if value is not None else None


def _int_or_none(value: object) -> int | None:
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


def _float_or_none(value: object) -> float | None:
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return None


def _count_nonempty_lines(text: str) -> int:
    return sum(1 for line in text.splitlines() if line.strip())

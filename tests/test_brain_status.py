from robot_790d.brain_status import (
    _normalize_lms_ps_json,
    _parse_lms_ps,
    _summarize_pdh_gpu_engine_values,
    get_brain_status,
    get_gpu_status,
)


def log_line(source: str, message: str) -> str:
    return f"2026-08-28 00:49:46,247 - {source} - INFO - {message}"


def test_brain_status_parses_latest_runtime_logs(tmp_path) -> None:
    logs = tmp_path / "logs"
    live = logs / "live"
    live.mkdir(parents=True)
    (logs / "sts-realtime.out.log").write_text(
        "\n".join(
            [
                "Starting Robot 790 realtime voice with Qwen3-TTS speaker Eric",
                "LLM model: qwen/qwen3.8-27b",
                "LLM reasoning effort: low",
                "LLM audio max tokens: 64",
                r"TTS model: C:\models\Qwen3-TTS",
                "Prompt: D:\\_PROJECTS\\robot-790\\prompts\\robot-790-reachy-no-tools.md",
            ]
        ),
        encoding="utf-8",
    )
    (logs / "sts-realtime.err.log").write_text(
        "\n".join(
            [
                log_line("speech_to_speech.LLM.base_openai_compatible_language_model", "Tools: []"),
                log_line(
                    "speech_to_speech.api.openai_realtime.service",
                    "Token usage (response): input=35508, output=192",
                ),
                log_line(
                    "speech_to_speech.TTS.qwen3_tts_handler",
                    "Qwen3-TTS generated 8.05s audio in 2.72s (RTF: 2.96, custom_voice)",
                ),
                log_line("speech_to_speech.TTS.qwen3_tts_handler", "Qwen3-TTS TTFA: 0.21s (custom_voice)"),
                log_line(
                    "speech_to_speech.TTS.qwen3_tts_handler",
                    "Last speech detected to first speech out: 6.216s (turn=turn_8 rev=0)",
                ),
                log_line(
                    "speech_to_speech.api.openai_realtime.handlers.response",
                    "Response done (status=completed) - this response: input_tokens=35508, output_tokens=192, "
                    "audio=1.49s | cumulative: input_tokens=13702625, output_tokens=1107433, audio=4585.82s",
                ),
            ]
        ),
        encoding="utf-8",
    )
    (live / "latest-events.txt").write_text("[12:00:00 AM] connected\n", encoding="utf-8")
    (live / "latest-conversation.txt").write_text("[12:00:01 AM] Robot 790: hello\n", encoding="utf-8")

    result = get_brain_status(tmp_path)

    assert result["status"] == "ok"
    assert result["model"]["llm_model"] == "qwen/qwen3.8-27b"
    assert result["model"]["reasoning_effort"] == "low"
    assert result["model"]["audio_max_tokens"] == 64
    assert result["latest_response"]["input_tokens"] == 35508
    assert result["latest_response"]["cumulative_audio_seconds"] == 4585.82
    assert result["performance"]["tts_realtime_factor"] == 2.96
    assert result["performance"]["turn_to_first_speech_seconds"] == 6.216
    assert result["context"]["pressure_estimate"] == "crowded"


def test_brain_status_tolerates_missing_logs(tmp_path) -> None:
    result = get_brain_status(tmp_path)

    assert result["status"] == "ok"
    assert result["latest_response"]["status"] == "unavailable"
    assert result["context"]["pressure_estimate"] == "unknown"
    assert result["log_files"]["realtime_err"]["exists"] is False


def test_brain_status_context_uses_previous_measured_response_after_cancel(tmp_path) -> None:
    logs = tmp_path / "logs"
    logs.mkdir()
    (logs / "sts-realtime.out.log").write_text("LLM model: qwen/qwen3.8-27b\n", encoding="utf-8")
    (logs / "sts-realtime.err.log").write_text(
        "\n".join(
            [
                "Response done (status=completed) - this response: input_tokens=35508, output_tokens=192, "
                "audio=1.49s | cumulative: input_tokens=13702625, output_tokens=1107433, audio=4585.82s",
                "Response done (status=cancelled) - this response: input_tokens=0, output_tokens=0, "
                "audio=2.23s | cumulative: input_tokens=13702625, output_tokens=1107433, audio=4588.05s",
            ]
        ),
        encoding="utf-8",
    )

    result = get_brain_status(tmp_path)

    assert result["latest_response"]["status"] == "cancelled"
    assert result["latest_response"]["previous_measured_response"]["input_tokens"] == 35508
    assert result["context"]["last_input_tokens"] == 35508
    assert result["context"]["pressure_estimate"] == "crowded"


def test_brain_status_context_reports_window_usage(monkeypatch, tmp_path) -> None:
    logs = tmp_path / "logs"
    logs.mkdir()
    (logs / "sts-realtime.out.log").write_text("LLM model: qwen/qwen3.8-27b\n", encoding="utf-8")
    (logs / "sts-realtime.err.log").write_text(
        "Response done (status=completed) - this response: input_tokens=32768, output_tokens=64, audio=1.49s "
        "| cumulative: input_tokens=32768, output_tokens=64, audio=1.49s",
        encoding="utf-8",
    )
    monkeypatch.setattr(
        "robot_790d.brain_status._read_lm_studio_status",
        lambda _preferred=None: {
            "available": True,
            "active_model": {"context_window_tokens": 131072, "parallel_predictions": 1},
            "loaded_models": [],
            "raw_status": "",
        },
    )

    result = get_brain_status(tmp_path)

    assert result["context"]["last_input_tokens"] == 32768
    assert result["context"]["context_window_tokens"] == 131072
    assert result["context"]["remaining_context_tokens"] == 98304
    assert result["context"]["window_usage_percent"] == 25.0


def test_brain_status_reports_runtime_specimen(monkeypatch, tmp_path) -> None:
    logs = tmp_path / "logs"
    config = tmp_path / "config"
    logs.mkdir()
    config.mkdir()
    (logs / "sts-realtime.out.log").write_text("LLM model: qwen3.8-27b-nvfp4-mtp\n", encoding="utf-8")
    (logs / "sts-realtime.err.log").write_text("", encoding="utf-8")
    (config / "runtime_specimen.json").write_text(
        """
        {
          "schema": 1,
          "specimens": [
            {
              "model": "qwen3.8-27b-nvfp4-mtp",
              "quantization": {
                "weights": "NVFP4",
                "kv_cache_key": "q8_0",
                "kv_cache_value": "q5_0"
              },
              "observations": {
                "vram_gain_gb": 1.2,
                "audit_status": "pending_ear_test"
              }
            }
          ]
        }
        """,
        encoding="utf-8",
    )
    monkeypatch.setattr("robot_790d.brain_status._read_lm_studio_status", lambda _preferred=None: None)

    result = get_brain_status(tmp_path)

    specimen = result["model"]["runtime_specimen"]
    assert specimen["quantization"]["kv_cache_key"] == "q8_0"
    assert specimen["quantization"]["kv_cache_value"] == "q5_0"
    assert specimen["observations"]["vram_gain_gb"] == 1.2
    assert "Runtime specimen records KV cache as k=q8_0, v=q5_0." in result["notes"]
    assert "Runtime specimen audit status: pending_ear_test." in result["notes"]


def test_brain_status_parses_lm_studio_status() -> None:
    models = _parse_lms_ps(
        "\n".join(
            [
                "IDENTIFIER          MODEL               STATUS    SIZE        CONTEXT    PARALLEL    DEVICE    TTL",
                "qwen/qwen3.8-27b    qwen/qwen3.8-27b    IDLE      17.74 GB    131072     "
                "1           Local     60m / 1h",
            ]
        )
    )

    assert models == [
        {
            "identifier": "qwen/qwen3.8-27b",
            "model": "qwen/qwen3.8-27b",
            "status": "IDLE",
            "size": "17.74 GB",
            "context_window_tokens": 131072,
            "parallel_predictions": 1,
            "device": "Local",
            "ttl": "60m / 1h",
        }
    ]


def test_brain_status_normalizes_lm_studio_json() -> None:
    models = _normalize_lms_ps_json(
        [
            {
                "identifier": "qwen3.8-27b-nvfp4-mtp",
                "model": "qwen3.8-27b-nvfp4-mtp",
                "status": "IDLE",
                "size": "15.79 GB",
                "contextLength": 131072,
                "parallelPredictions": 2,
                "device": "Local",
            }
        ]
    )

    assert models == [
        {
            "identifier": "qwen3.8-27b-nvfp4-mtp",
            "model": "qwen3.8-27b-nvfp4-mtp",
            "status": "IDLE",
            "size": "15.79 GB",
            "context_window_tokens": 131072,
            "parallel_predictions": 2,
            "device": "Local",
            "ttl": None,
        }
    ]


def test_gpu_status_parses_nvidia_smi(monkeypatch) -> None:
    class Completed:
        returncode = 0
        stdout = "NVIDIA GeForce RTX 5090, 55, 31949, 32256, 46\n"
        stderr = ""

    monkeypatch.setattr("robot_790d.brain_status.subprocess.run", lambda *_args, **_kwargs: Completed())
    monkeypatch.setattr("robot_790d.brain_status._read_windows_gpu_engine_utilization", lambda: None)

    result = get_gpu_status()

    assert result["status"] == "ok"
    assert result["source"] == "nvidia-smi"
    assert result["primary"]["name"] == "NVIDIA GeForce RTX 5090"
    assert result["primary"]["utilization_percent"] == 55.0
    assert result["primary"]["memory_used_gb"] == 31.2
    assert result["primary"]["memory_total_gb"] == 31.5
    assert result["primary"]["memory_usage_percent"] == 99.0
    assert result["primary"]["temperature_c"] == 46.0


def test_gpu_status_prefers_windows_task_manager_style_utilization(monkeypatch) -> None:
    class Completed:
        returncode = 0
        stdout = "NVIDIA GeForce RTX 5090, 6, 31949, 32256, 46\n"
        stderr = ""

    monkeypatch.setattr("robot_790d.brain_status.subprocess.run", lambda *_args, **_kwargs: Completed())
    monkeypatch.setattr(
        "robot_790d.brain_status._read_windows_gpu_engine_utilization",
        lambda: {
            "source": "windows-pdh",
            "sampled_at": "2026-09-04T17:20:00",
            "three_d_percent": 43.0,
            "all_percent": 45.0,
            "by_luid": {"0x0_0x1": {"3D": 43.0}},
        },
    )

    result = get_gpu_status()

    assert result["status"] == "ok"
    assert result["source"] == "windows-pdh+nvidia-smi"
    assert result["utilization_source"] == "windows-pdh GPU Engine engtype_3D"
    assert result["primary"]["utilization_percent"] == 43.0
    assert result["primary"]["nvidia_utilization_percent"] == 6.0
    assert result["primary"]["memory_used_gb"] == 31.2


def test_summarize_pdh_gpu_engine_values_groups_3d_by_luid() -> None:
    result = _summarize_pdh_gpu_engine_values(
        {
            "pid_1_luid_0x00000000_0x000151B5_phys_0_eng_0_engtype_3D": 12.25,
            "pid_2_luid_0x00000000_0x000151B5_phys_0_eng_1_engtype_3D": 4.05,
            "pid_3_luid_0x00000000_0x000151B5_phys_0_eng_2_engtype_Copy": 2,
            "pid_4_luid_0x00000000_0x00016A21_phys_0_eng_0_engtype_Compute": 3,
        }
    )

    assert result is not None
    assert result["three_d_percent"] == 16.3
    assert result["all_percent"] == 21.3
    assert result["by_luid"]["0x00000000_0x000151B5"]["3D"] == 16.3
    assert result["by_luid"]["0x00000000_0x000151B5"]["Copy"] == 2.0


def test_gpu_status_tolerates_missing_nvidia_smi(monkeypatch) -> None:
    def fail_run(*_args, **_kwargs):
        raise FileNotFoundError("nvidia-smi")

    monkeypatch.setattr("robot_790d.brain_status.subprocess.run", fail_run)
    monkeypatch.setattr("robot_790d.brain_status._read_windows_gpu_engine_utilization", lambda: None)

    result = get_gpu_status()

    assert result["status"] == "unavailable"
    assert result["source"] == "nvidia-smi"

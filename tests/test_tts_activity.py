from datetime import datetime

from robot_790d.tts_activity import parse_tts_activity, read_tts_activity


def ms(second):
    return datetime(2026, 9, 17, 13, 0, second).timestamp() * 1000


def line(second, message, pipeline=0, source="speech_to_speech.TTS.qwen3_tts_handler"):
    return f"2026-09-17 13:00:{second:02d},000 - [pipeline {pipeline}] {source} - INFO - {message}"


def test_completion_marks_compute_duration_not_audio_duration():
    result = parse_tts_activity(line(20, "Qwen3-TTS generated 40.00s audio in 7.00s (RTF: 5.71)"), ms(25))
    assert result["active"] is False
    assert result["intervals"] == [{"start_ms": ms(13), "end_ms": ms(20)}]


def test_live_ttfa_reconstructs_start_then_completion_corrects_interval():
    first = line(10, "Qwen3-TTS TTFA: 0.50s (custom_voice)")
    result = parse_tts_activity(first, ms(12))
    assert result["active"] is True
    assert result["intervals"] == [{"start_ms": ms(10) - 500, "end_ms": ms(12)}]
    text = first + "\n" + line(14, "Qwen3-TTS generated 18.00s audio in 4.50s")
    result = parse_tts_activity(text, ms(16))
    assert result["active"] is False
    assert result["intervals"] == [{"start_ms": ms(10) - 500, "end_ms": ms(14)}]


def test_cancel_releases_only_its_pipeline():
    text = "\n".join([line(10, "Qwen3-TTS TTFA: 0.50s", 0),
                      line(11, "Qwen3-TTS TTFA: 0.25s", 1),
                      line(12, "Response cancelled, listening re-enabled", 0, "handlers.response")])
    result = parse_tts_activity(text, ms(13))
    assert result["active"] is True
    assert result["intervals"] == [{"start_ms": ms(10) - 500, "end_ms": ms(12)},
                                   {"start_ms": ms(11) - 250, "end_ms": ms(13)}]


def test_stale_crashed_or_restarted_process_cannot_leave_live_tint_stuck():
    text = line(10, "Qwen3-TTS TTFA: 0.50s")
    assert parse_tts_activity(text, ms(10) + 61_000)["intervals"] == []
    assert parse_tts_activity(text, ms(10) + 121_000)["intervals"] == []
    assert parse_tts_activity("", ms(20))["active"] is False


def test_llm_and_playback_do_not_count_as_tts_generation():
    text = "\n".join([line(10, "ChatCompletionsApiModelHandler: 22.497 s", source="baseHandler"),
                      line(11, "Last speech detected to first speech out: 200.1s"),
                      "2026-99-17 13:00:10,000 - Qwen3-TTS TTFA: 0.50s",
                      line(30, "Qwen3-TTS TTFA: 0.50s")])
    assert parse_tts_activity(text, ms(20))["intervals"] == []


def test_reader_missing_log_and_truncation(tmp_path):
    assert read_tts_activity(tmp_path)["status"] == "unavailable"
    (tmp_path / "logs").mkdir()
    log = tmp_path / "logs/sts-realtime.err.log"
    log.write_bytes(b"x" * 150_000 + b"\nno synthesis\n")
    assert read_tts_activity(tmp_path)["intervals"] == []
    log.write_text("")
    assert read_tts_activity(tmp_path)["intervals"] == []


def test_gpu_payload_keeps_hardware_values_and_adds_activity(monkeypatch):
    from robot_790d import brain_status
    hardware = {"status": "ok", "primary": {"utilization_percent": 82}}
    activity = {"status": "ok", "active": True, "intervals": []}
    monkeypatch.setattr(brain_status, "_get_gpu_hardware_status", lambda: hardware)
    monkeypatch.setattr(brain_status, "read_tts_activity", lambda: activity)
    assert brain_status.get_gpu_status() == {**hardware, "tts_activity": activity}
    assert "tts_activity" not in hardware

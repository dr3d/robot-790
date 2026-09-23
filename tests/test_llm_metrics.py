import json

from robot_790d.llm_metrics import acquire_lock, parse_event


def runtime(message):
    return json.dumps(
        {
            "timestamp": 123,
            "data": {
                "type": "runtime.log",
                "message": message,
                "modelIdentifier": "test",
                "instanceReference": "instance",
                "pid": 42,
            },
        }
    )


def test_multiline_timings_and_release():
    rows = parse_event(
        runtime(
            "98.25 I slot print_timing: id  1 | task 8076 | prompt eval time = 183.80 ms / 4 tokens "
            "(45.95 ms per token, 21.76 tokens per second)\r\n"
            "98.25 I slot print_timing: id  1 | task 8076 | eval time = 0.00 ms / 1 tokens "
            "(0.00 ms per token, 0.00 tokens per second)\r\n"
            "98.25 I slot print_timing: id  1 | task 8076 | total time = 183.80 ms / 5 tokens\r\n"
            "98.25 I slot release: id 1 | task 8076 | stop processing: n_tokens = 55, truncated = 0"
        )
    )
    assert [row["kind"] for row in rows] == ["prompt_eval", "generation", "total", "task_end"]
    assert rows[0]["tokens"] == 4
    assert rows[0]["milliseconds"] == 183.8
    assert rows[0]["tokens_per_second"] == 21.76
    assert rows[3]["resident_tokens"] == 55
    assert all(row["task"] == 8076 and row["slot"] == 1 for row in rows)
    assert all(row["pid"] == 42 for row in rows)


def test_slot_selection_is_not_invented_task_attribution():
    rows = parse_event(
        runtime(
            "98 I slot get_availabl: id 1 | task -1 | selected slot by LCP similarity, "
            "f_sim_best = 0.999 (> 0.100 thold), f_keep = 1.000\n"
            "98 I slot launch_slot_: id 1 | task 25 | processing task, is_child = 0"
        )
    )
    assert rows[0]["task"] == -1
    assert rows[0]["method"] == "prefix_similarity"
    assert rows[0]["f_sim_best"] == 0.999
    assert rows[1]["kind"] == "task_start"
    assert "cached_tokens" not in rows[0]


def test_lru_and_eviction():
    selection = parse_event(runtime("I slot get_availabl: id 0 | task -1 | selected slot by LRU, t_last = 5438"))
    assert selection[0]["method"] == "lru"
    rows = parse_event(
        runtime("W srv alloc: - making room for prompt cache entry, removing oldest entry (size = 688.332 MiB)")
    )
    assert rows[0]["kind"] == "cache_eviction"
    assert rows[0]["size_mib"] == 688.332
    assert "slot" not in rows[0]


def test_model_stats_never_save_text_or_arbitrary_fields():
    rows = parse_event(
        json.dumps(
            {
                "timestamp": 5,
                "data": {
                    "type": "llm.prediction.output",
                    "output": "SECRET ANSWER",
                    "input": "SECRET PROMPT",
                    "stats": {
                        "timeToFirstTokenSec": 1.2,
                        "promptTokensCount": 47000,
                        "predictedTokensCount": 204,
                        "totalTimeSec": 17,
                        "unknown": "SECRET",
                    },
                },
            }
        )
    )
    assert rows[0]["timeToFirstTokenSec"] == 1.2
    assert rows[0]["predictedTokensCount"] == 204
    assert "SECRET" not in json.dumps(rows)


def test_oversized_cache_state_is_distinct_from_eviction_and_has_no_invented_slot():
    rows = parse_event(runtime(
        "770 W srv alloc: - prompt state size 8194.865 MiB exceeds cache size limit 8192.000 MiB, skipping"
    ))
    assert len(rows) == 1
    assert rows[0]["kind"] == "cache_save_skipped"
    assert rows[0]["reason"] == "state_exceeds_limit"
    assert rows[0]["state_mib"] == 8194.865
    assert rows[0]["limit_mib"] == 8192
    assert "slot" not in rows[0] and "task" not in rows[0]


def test_cache_restore_diagnostics_do_not_capture_arbitrary_runtime_text():
    rows = parse_event(runtime(
        "I slot update_slots: id 1 | task 25 | forcing full prompt re-processing due to lack of cache data "
        "(engine explanation SECRET)\n"
        "W slot prompt_load: id 1 | task 25 | failed to load prompt from cache\n"
        "I slot prompt: id 1 | task 25 | SECRET PROMPT"
    ))
    assert [row["kind"] for row in rows] == ["cache_reprocess", "cache_restore_failed"]
    assert all(row["slot"] == 1 and row["task"] == 25 for row in rows)
    assert "SECRET" not in json.dumps(rows)


def test_ignored_input_and_unrecognized_engine_text():
    for line in (
        "Streaming logs from LM Studio",
        "null",
        "[]",
        "{}",
        '{"data": []}',
        '{"data": {"type": "llm.prediction.input", "input": "SECRET"}}',
        runtime("I slot prompt: id 0 | task 25 | SECRET PROMPT"),
        runtime("W srv alloc: - prompt state size .. MiB exceeds cache size limit 8192 MiB, skipping"),
    ):
        assert parse_event(line) == []


def test_cache_capacity_and_checkpoint_diagnostics_are_numeric_not_prompt_content():
    rows = parse_event(runtime(
        "T srv update: - cache state: 2 prompts, 8500.100 MiB (limits: 8192.000 MiB, 131072 tokens, 131072 est)\n"
        "T srv update: - prompt 0xDEADBEEF: 102387 tokens, checkpoints: 8, 7683.806 MiB SECRET\n"
        "W srv clear: purging slot 1 with 102387 tokens\n"
        "T slot cache: id 1 | task -1 | saving idle slot to prompt cache\n"
        "T slot prompt_clear: id 1 | task -1 | clearing prompt with 102387 tokens\n"
        "T slot update: id 1 | task 2800 | restored context checkpoint "
        "(pos_min = 100000, pos_max = 101000, n_tokens = 101001, n_past = 101001, size = 40.500 MiB) SECRET\n"
        "T slot update: id 1 | task 2800 | erased invalidated context checkpoint "
        "(pos_min = 100000, pos_max = 101000, n_tokens = 101001, n_swa = 0, pos_next = 0, size = 40.500 MiB)\n"
        "T slot prompt: id 1 | task 2800 | SECRET PROMPT"
    ))
    assert [row["kind"] for row in rows] == ["cache_state", "cache_entry", "slot_purged",
        "idle_slot_cache_save", "slot_prompt_clear", "context_checkpoint", "context_checkpoint"]
    assert rows[0]["limit_mib"] == 8192
    assert rows[1]["tokens"] == 102387 and rows[1]["checkpoints"] == 8
    assert "slot" not in rows[1] and "task" not in rows[1]
    assert rows[5]["n_past"] == 101001
    assert rows[6]["pos_next"] == 0
    assert "SECRET" not in json.dumps(rows) and "DEADBEEF" not in json.dumps(rows)


def test_duplicate_capture_lock(tmp_path):
    first = acquire_lock(tmp_path / "lock")
    assert first is not None
    try:
        assert acquire_lock(tmp_path / "lock") is None
    finally:
        first.close()
    next_lock = acquire_lock(tmp_path / "lock")
    assert next_lock is not None
    next_lock.close()


def test_prompt_capacity_and_context_shift_are_numeric_only():
    rows = parse_event(runtime(
        "I slot update_slots: id 1 | task 42 | new prompt, n_ctx_slot = 131072, n_keep = 0, task.n_tokens = 128500\n"
        "I slot update_slots: id 1 | task 42 | context shift, n_keep = 8, n_left = 131000, n_discard = 65500 SECRET\n"
        "I slot update_slots: id 1 | task 42 | context shift, SECRET"
    ))
    assert [r["kind"] for r in rows] == ["prompt_start", "context_shift"]
    assert rows[0]["n_ctx_slot"] == 131072 and rows[0]["n_tokens"] == 128500
    assert rows[1]["n_discard"] == 65500
    assert "SECRET" not in json.dumps(rows)

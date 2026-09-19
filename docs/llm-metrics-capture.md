# LLM Cache and Timing Capture

Opt-in passive telemetry for an idle-and-return experiment. It neither sends
inference requests nor changes the model, context, slots, prompts or voice path.
It can attach to already-running LM Studio; STS does not need a restart.

```powershell
.\scripts\start_llm_metrics.ps1
.\scripts\start_llm_metrics.ps1 -Stop
```

Codex can own the hidden process; the operator need not manage a terminal.
`start_realtime_eric_qwen3.ps1 -CaptureLlmMetrics` also starts it. It is off by
default and independent of a conversation disconnect so post-session activity
can be distinguished from the run. Default lifetime is eight hours; `-Hours`
accepts a positive value up to 24. Repeated starts do not duplicate an active
collector or extend its deadline. A stop request takes effect on the next loop.

## Output

`logs/live/llm-metrics/status.json` records heartbeat, process/stream state,
record count and latest metric timestamp. `state: recording` means both stream
listeners are ready, not that a model is currently generating. An ended stream
marks the capture failed and stops its companion; restart capture after restoring
LM Studio. Nothing silently switches models or restarts inference.

`engine.jsonl` plus up to three rotated backups is capped at approximately
40 MiB. Save these with the PM evidence before subsequent runs rotate them.
Runtime messages are split into individual typed records. Full prompts, model
output, arbitrary runtime log text, and server access logs are NOT persisted.
The model-output stream is received in memory solely to extract numeric stats.

Captured when the installed engine emits them:

- `prompt_eval`: actually evaluated prompt tokens, milliseconds and tokens/sec.
- `generation`: generated token count, milliseconds and tokens/sec.
- `total`: engine timing total (not end-to-end speech latency).
- `slot_selection`: slot, LRU or prefix similarity, reported similarity/keep ratios.
- `task_start` / `task_end`: runtime task IDs, resident tokens, truncation flag.
- `cache_eviction`: engine's oldest-prompt-cache-entry eviction and size.
- `cache_save_skipped`: a single saved prompt state exceeds the RAM cache limit;
  records state/limit MiB, not a guessed slot or brain. This is not ordinary eviction.
- `cache_reprocess` / `cache_restore_failed`: recognized missing-cache-data or
  failed-restore diagnostics, when emitted at the runtime's logging level.
- `prediction_stats`: LM Studio's prompt/output counts, time to first token,
  total prediction time and generation speed.

Records carry receipt UTC time, LM Studio event timestamp, model identity and,
for runtime events, engine process/instance/slot/task identifiers when supplied.
The engine can batch several lines under one event timestamp; task boundaries
and reported durations are more precise than pretending those lines each arrived
at their actual computation time.

Prediction stats do not include a runtime task ID in the observed API. Match
them cautiously by model and time alongside STS/B2 logs; parallel completions can
be ambiguous. Do not invent per-brain attribution or a cache-hit percentage.
Selection events with task -1 describe selection before a task is assigned.
Evictions without a slot/task are likewise not attributed to a particular brain.
Counts labelled input tokens in ordinary STS logs include cached input: they are
not counts of newly evaluated tokens. Engine resident-token counts are not cache
hits either. Hybrid recurrent attention may require some prefix reevaluation.

## Trial

Continue the loaded thread, converse, let it idle, then speak again. Leave the
model, slots and normal behavior unchanged. The collector includes B2 and headline
selection even when no headline is used. Compare the returning B1 request's prompt
evaluation with its model TTFT, total generation time and STS first-audio time.
This separates cache refill from hidden-output draining and speech latency.

These are version-dependent engine diagnostics (tested with LM Studio's llama.cpp
runtime 2.38.0 and 2.41.0), not a stable public inference API contract. Unknown log lines are
ignored rather than persisted. `tests/test_llm_metrics.py` covers the observed
multiline format, safe filtering and duplicate-process lock.

## First Measured Idle Return (2026-09-16)

Evidence: `logs/runs/20260916-122936-instrumented-idle-return/postmortem.md`.
After extended idle and a B2-selected headline, the returning B1 request evaluated
all 47,536 input tokens: 14.854 seconds prefill, 16.644 seconds to first audio.
The very next exchange evaluated 93 of 47,688 tokens in 0.254 seconds, with
1.326 seconds to first audio. This confirms a cold return, not context exhaustion.

Two slots were serving three distinct prompt families: full conversation,
isolated idle speech, and B2. Earlier short-idle return reused substantial context
even after LRU selection. Later headline/deeper-idle work preceded complete
reevaluation, but the trace does not identify the particular evicted snapshot
or prove web use alone caused it. Preserve the conversation prefix across idle
work as the next measured repair target; do not infer permanent per-brain slots.

## Oversized Cache State (2026-09-19)

Four full refills in the Salem image run took 16.24-29.63 seconds, while B1/B2
kept their respective slot numbers. Context reached only 57.8%. An isolated
reproduction on CUDA12 runtime 2.41.0 exposed a different cause from the earlier
idle-prefix repair: a saved prompt state reached 8194.865 MiB, above the engine's
8192 MiB RAM prompt-cache limit. The following B1 return reevaluated 59,844 tokens.

Reducing the model's `context_checkpoints` from 32 to 8 kept all ten test returns
warm; the matching failing request evaluated 31 tokens in 0.421 seconds instead
of 59,844 in 20.458 seconds. This changes saved rewind states, **not** history,
context length (131072), slots (2), prompts or idle behavior. Fewer checkpoints
can reduce reuse for a deep rewind; full context remains available.
An additional ten-cycle test reached 81.6K input tokens; all returns stayed
warm, with the final return evaluating 31 tokens in 0.488 seconds.

The tested setting is in this workstation's model-specific LM Studio default:
`llm.load.llama.contextCheckpoints: 8` for `qwen3.8-27b-nvfp4-mtp`. Other models
are unchanged. New machines should verify the effective value after load via
`GET /api/v1/models` (`loaded_instances[].config.context_checkpoints`). The CLI
does not expose this setting directly. Do not confuse the RAM snapshot limit
with GPU KV placement or the context meter.
An ordinary CLI unload/reload with the gold launcher's model/context/parallel
arguments was verified to retain the new eight-checkpoint default.

Private evidence/backup and reproduction: `logs/runs/20260919-095428-salem-image-cache-refills/`.
The original collector discarded oversized-state warnings; their cause cannot
be proved retrospectively for each original stall. The added `cache_save_skipped`
record closes that gap.

Live acceptance on September 19, 10:33-10:58: the image-heavy Boston continuation
started at 41,839 input tokens and ended at 83,743 (31.9% to 63.9%). After the
initial 11.79-second prefill, all 56 completed measured B1 calls reused at least
90.1% of the prompt, median 98.4%, with no full refill or recognized cache-save/
restore failure. Subsequent prefill median was 1.07 seconds, worst 8.90 seconds.
The last user return reused 95.0%, evaluating 4,216 tokens in 3.36 seconds.
This validates the change for this run, not every future workload. A separate
idle-art delivery defect and one filtered-output retry were not cache failures.
Evidence and reproducible numeric analysis:
`logs/runs/20260919-105831-boston-idle-art-handoff/`.

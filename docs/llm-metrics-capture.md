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
runtime 2.38.0), not a stable public inference API contract. Unknown log lines are
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

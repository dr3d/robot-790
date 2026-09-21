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

## Request-Shape Receipts (2026-09-21)

Updated realtime and page servers also emit `requests-<pid>.jsonl` while this
collector's status is recording, its heartbeat is fresh, and its deadline has
not expired. This needs one server restart to install, but later capture
start/stop operations need no restart. Each process rotates at 5 MiB with two
backups (15 MiB per process). Old process files can be archived with their run.

Receipts contain B1/B2/headline role, request ID, model, message count, image-part
count, text character count, serialized byte count, hashes of messages/system/
tools/options, and common leading-message count versus that connection's previous
request. They never persist prompts, image data, tool arguments, or responses.
B1 IDs match the ordinary `B1 request usage` log. End receipts include elapsed
provider-stream time, outcome and usage where available; a cancelled-before-send
request can have only a start receipt. Elapsed time is not exclusively prefill.

Compare request receipts with engine metrics when a reported 128K prompt becomes
69K: did the submitted message count/content change, did only the current image
or options change, or did the engine report fewer tokens for still-growing input?
These distinguish hypotheses; hash equality is NOT a KV-cache hit percentage.
Engine `new prompt` and `context shift` messages now preserve recognized numeric
capacity/discard fields when emitted. Unknown log text remains excluded.

Diagnostics fail open on I/O failure and stop producing new request receipts
after the collector stops/expires or its heartbeat is more than 30 seconds old.
They do not change context handling, send additional inference requests, restart
the model, or reset STT. `ROBOT_790_METRICS_DIR` can select a different receipt/
status directory for isolated tests; normal use shares `logs/live/llm-metrics`.

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

## Outgoing Note Delivery Audit (2026-09-21)

Checkpoint status: the September 21 trial collector was stopped, provider output
sampling disarmed, and the live delivery-audit expectation file moved into the
private run evidence. These checks are off during normal operation. Request-shape
hashing and delivery scans return before doing prompt work when the collector is
inactive; provider sampling likewise requires an active request ticket. The
ordinary context meter, request usage and GPU/TTS graph do not depend on these
temporary diagnostics. The hooks remain available for deliberate rearming.

For the resumed-memory investigation, prepare explicit expectations from a saved
session without changing the selected session or its notes:

```powershell
.\.venv\Scripts\python.exe -m robot_790d.delivery_audit sessions/session-20260921-102635-049.txt --hours 2
```

This writes a bounded local `logs/live/llm-metrics/delivery-audit.json` containing
copies of the expected ordinary notes/history. It contains private note text;
keep it with local diagnostics, not in Git. Routed setup cards are rejected
because their per-brain projections need a different comparison. Preparation
uses the current history policy but does not run inference or session preparation.

While the passive collector is active and the expectation file has not expired,
each B1 `request_start` includes `delivery_audit`: target index, expected text
SHA-256, character count, presence, and message/part/character location. Results
never include the note text or filenames. This compares complete expected bodies,
not just a filename or search word. It normalizes line endings and trims expected
trailing whitespace, matching the note wrapper's formatting. Offsets are Unicode
character positions in normalized message parts, not token depths. A tool receipt
match is distinguished from a system-message match.

The hook inspects the actual serialized message list handed to the B1 provider
adapter. It does not alter prompts, schedule calls, change history order, or verify
the model's attention. The subsequent successful request receipt establishes that
the request completed, not that the provider internally retained every token.
Do not label a later tool-result match as proof the note was present at Connect.
An absent body means a mismatch to this expected snapshot; check legitimate note
edits, selected session, admission excerpts and settings before calling it a fault.

Limits: 20 targets, 1 MiB expectation file, four reported locations per target,
two-hour default expiry, and existing rotated request-log limits. Missing/expired
expectations disable the check; malformed expectations report `unavailable` and
never block generation. Delete the expectation file to disable early. The realtime
process must be restarted once to load the new diagnostic code; no model reload,
browser refresh, or full wire capture is required.

## Temporary Provider Output Samples (2026-09-21)

For the intermittent spoken-planning defect, explicitly arm a private response
capture after starting passive metrics:

```powershell
.\scripts\start_llm_metrics.ps1 -Hours 2
.\.venv\Scripts\python.exe -m robot_790d.provider_output_capture --hours 2
```

The realtime process needs one restart to install this hook; subsequent arming
or stopping needs no restart. It does not reload the LLM or modify requests.
`--stop` disables capture for new requests. Both an active metrics receipt and
an unexpired `logs/live/llm-metrics/provider-output-capture.json` are required.

`provider-output-<pid>.jsonl` links to existing request receipts by request ID.
It samples the first choice's `content`, `reasoning_content`, `reasoning`, and
`refusal` text before normalization and private-output filtering. Chunk sequence
and original field boundaries preserve split think tags and an orphan closing
tag. Fields inside one chunk are simultaneous for this purpose; their JSON key
order does not establish temporal order. Non-streamed responses use the same
field allowlist. Finish reason and explicit reasoning options are recorded.
This observes SDK-parsed provider output, not raw HTTP packets or model internals.

Unlike ordinary metrics, these files contain private generated text, potentially
including recalled personal information. Keep them local; do not publish them.
No prompt, image bytes, tool arguments or arbitrary response metadata are copied.
Limits are 24 responses per arm per realtime process, 16,384 total captured text
characters and 2,048 sampled chunks per response, two-hour default expiry, and
1 MiB log rotation with two backups. Truncation is labeled and affects capture
only, never speech or model output. A process restart resets the per-process
counter; the absolute expiry still applies. Re-arming also resets the counter.

Logging occurs once at response termination, including cancellation; a process
kill may lose an in-flight sample. Capture failures do not block generation.
The normal cancellation owner still closes the original provider stream.
Write exceptions now produce a content-free warning in the realtime log.

Verify actual records with
`python -m robot_790d.provider_output_capture --status`. This reads and parses
the files and reports counts without exposing generated text. Do not infer an
empty capture from Windows directory-listing size metadata on an open file:
the September 21 trial-2 capture was initially reported as zero bytes there,
but the preserved copy already contained all 18 records. That was an inspection
error, not a failed writer. Persistence tests now use the real disk sink.

Suggested comparison: select the same saved 10:26 parent for each short trial,
say hello, then ask for the year-long-trip plan without opening files. Keep
successful and failed trials. Do not continue from a test session or change
personality, idle cadence, context order, or provider options between trials.

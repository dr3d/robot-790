# Assessment Follow-Through: First Bug-Fix Batch

The assessment was read-only. The pre-fix checkpoint is `ec13d10` on `master`.
This note records the subsequent implemented changes, not just recommendations.
The continuity/classroom run ending at 15:24:16 was still a pre-fix run.

## Implemented

- **Recurring timers:** omitted or null delays now use the configured cadence for
  GPU watch and standing routines. Explicit zero retains the existing minimum
  delay. Blocked and failed ticks no longer fall back to 500 ms / 1 second.
- **Core memory:** enabled `core/erics_memories.txt` has reserved room in the
  loaded-note character budget and cannot be evicted by the eight-note limit.
  Existing note order is preserved. Empty Connect still includes enabled core
  memory; unchecking its box excludes it.
- **Note writes:** the read/append/replace transaction is serialized across
  threads and processes using a per-notes-root OS lock. Each write uses a unique
  temporary file, flushes it, and atomically replaces the destination. Failed
  replacement leaves the previous note intact. The hidden `.note-write.lock`
  file is synchronization metadata, not a memory note or another transcript.
- **Transcript extraction:** ordinary underlined headings and a bare occurrence
  of the passivation title no longer truncate/split the conversation. Extracted
  session notes retain the original record text, including unfamiliar sections,
  instead of rebuilding it only from recognized fields. Existing on-disk
  transcripts were not rewritten or swept.
- **Device receipts:** Python face and chassis wrappers report top-level failure
  when their underlying result failed or was skipped. Timed chassis actions
  check both drive and stop receipts. Browser face/chassis calls also reject
  failed device receipts even when HTTP itself succeeded. This does not turn
  command acceptance into proof of physical movement.
- **Volume instructions:** the file-based system prompt now matches the existing
  browser fallback: explicit speaker-volume requests use the UI control tool,
  and zero means mute. Other personality and loop-pressure rules are unchanged.

## Verification

- Before implementation, targeted reproductions failed on both timer defaults,
  missing core memory, concurrent appends, truncated extraction, and contradictory
  success receipts.
- Full Python suite: **158 passed**. One existing Starlette/httpx deprecation
  warning; no test failures.
- Browser-source regression suite: **19 passed**, including compilation of the
  complete inline scripts. Run with `node --test tests/sts_runtime.test.cjs`.
- Ruff passed on the six changed Python source/test files. `git diff --check`
  passed.
- Read-only HTTP check of `http://127.0.0.1:8790/` confirmed the running page server
  serves the fixed scheduler and core-memory code.
- No hardware commands, live-session interruption, or server restart was used
  for verification. Tests used fake devices and temporary note directories.

## Activation And Remaining Work

The already-open browser tab still needs a reload to run the new JavaScript.
The STS page/API server and realtime worker need restarting to import the changed
Python modules. Do that at an intentional session boundary, not mid-conversation.
Serving the new HTML does not mean an existing tab has adopted it.

During the later post-edit test preflight, the stale page/API service was refreshed.
The passivation file's SHA-256 was unchanged across that refresh. The operator still
needs to reload the browser page and start realtime before the continuation run.
The LAN gateway's shared port numbers also exposed a stop-helper issue: Caddy is
now excluded from backend stop selection. Three fixture-based PowerShell checks
cover all-service, realtime-only, and page-only stopping without touching hardware.

This batch does **not** repair session ownership/cancellation across halt and
reconnect, checkpoint-failure recovery, the cumulative transcript contract,
Brain2's missing runtime evidence, the chassis watchdog, or API access boundaries.
Those findings remain open. Note-write locking serializes cooperating writers;
it does not provide revision conflicts for intentional overwrites or an archive.
The existing 64,000-character prompt budget and 200,000-character note limit also
remain. The readable transcript format is not a fully unambiguous structured
serialization format; retaining the raw source protects text during extraction.

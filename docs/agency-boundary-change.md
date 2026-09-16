# Agency Boundary Change

September 16, 2026. Pre-change checkpoint: `74312a6` on `master`.
First removal pass from the [agency/language audit](sts-agency-and-language-audit-2026-09-16.md).

## Removed

- English remember/forget/write classifiers, assistant-offer permission windows,
  lexical fact-grounding and placeholder classifiers.
- Direct sleep/wake actuation inferred from transcript words. Explicit UI
  controls and model-selected body tools remain.
- Idle topic dictionaries, controller-chosen queries and rotating rhetorical
  lanes. B1 now chooses research within the existing idle read/search scope.
- Phrase/theme-based exhaustion penalties and automatic B2 loop brakes.
  B2 assessments remain fallible advice, not mandatory directions.
- Tool-specific spoken confirmations and private search/draw/show, recall-only
  and session-map continuation planners. Results return to the real conversation
  with a general opportunity to continue.

## Preserved Boundaries

Enabled tool switches are checked before execution. Memory/file tools retain
argument validation, size limits and existing storage boundaries. Request
meaning and whether a fact is worth saving are model responsibilities. Existing
model guidance to respect the operator's requests remains; an English verb is
no longer treated as proof of authorization.

Memory names now preserve Unicode letters/numbers. Before mutation, the previous
browser memory value is saved under the existing key plus `.history`, capped at
50 snapshots. Forget removes active memory, not recovery snapshots; this is not
secure erasure. Failure to preserve the prior value aborts the active write.

Call-ID deduplication, connection freshness, capability checks, motion limits,
verified completion receipts and audio ownership remain. Continuations wait for
actual playback drain, including speech longer than 30 seconds. A new utterance
prevents automatic old work but does not discard a completed result. Superseded
images stay on disk without replacing the current eye. Unknown paid-generation
outcomes block automatic generation retry in the same turn.

`config/runtime.json.tool_continuation.max_rounds` defaults to 8. At this general
execution limit, the final continuation is tool-disabled and receives the limit
as factual context, not a sentence to repeat. It is not a prescribed action list.

Idle keeps its read/search allowlist, not unattended motion or memory writes.
The separately enabled B2 idle-art route is unchanged. Full tool schemas stay
stable for cache reuse; idle scope is stated and enforced at execution.

## Prompt Disclosure

The file-backed creature identity, setup cards, temperature and model selection
are unchanged. Runtime-generated prompts changed substantially: timing, current
state, optional advice and capability scope replace the per-lane idle director.
General continuation explains receipts and leaves actions, wording and silence
to Eric. B2 assessments are data rather than new rhetorical commands.

Ordinary idle now uses default-conversation assistant/tool history write-back.
The backend still builds from full B1 history and appends temporary scheduler
context only at the tail. That context is not saved as a user utterance. The
browser no longer injects a second assistant copy. Explicit isolated experiments
retain their out-of-band, speech-only behavior.

## Verification and Limits

Offline tests cover capability gates across English/Spanish/Japanese input,
Unicode memory identity, recovery snapshots, general continuations, cancellation,
disabled tools, long playback, round limits, motor receipts and full-history idle
write-back. These are mechanism tests, not proof of improved creative quality or
perfect model interpretation.

Verification at this change: 411 JavaScript tests and 623 Python tests passed,
including real handler history pairing for idle tool calls and results. The
Python run has one existing Starlette/httpx deprecation warning. Documentation
links and whitespace checks also pass. No live model-quality or hardware trial
is claimed by these checks.

This is not full multilingual support. Voice configuration, non-Latin note/image
lookup and speech segmentation need separate work. Older experimental,
re-engagement and watch prompts, plus the broader base/tool instructions, have
not undergone wholesale consolidation. Explicit verbatim playback and
operator-requested number-only watches are not ordinary tool confirmations.

Live comparison should hold model/history/card constant: research, drawing and
eye staging; a long answer; an interruption; then an idle return. Check actual
receipts and cache metrics, not promises. Refresh STS while disconnected after
restarting realtime, since both sides of the idle-history protocol changed.

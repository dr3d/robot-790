# September 19 Stabilization Plan

Approved direction: low-risk, high-value repairs before new capabilities. The
repository-wide review extends beyond the September 17 recent-regression audit;
older mechanisms can now be examined, but successful companion behavior remains
the baseline. Follow the [companion design contract](companion-design-contract.md).

## Invariants

- Preserve full-context B1 idle, imagination, personality, the longstanding
  response-length policy, model settings, and existing idle cadence.
- Models interpret meaning; STS handles permissions, evidence, execution,
  scheduling, storage and public-audio ownership.
- Add regression cases before repairs and keep commits small and reversible.
- Disclose prompt changes separately. Do not restart an active conversation.
- Back up and verify private history/assets before changes that migrate or move
  them. Git checkpoints alone do not back up ignored notes or runtime data.

## First Batch: Storage Safety

Implemented in source, deployment pending:

- Approximate note lookup preserves Unicode letters and combining marks using
  NFC normalization. Exact paths still win. Ambiguous normalized paths return a
  bounded list of candidates instead of the first file; this also protects
  deletion, which shares the resolver. Punctuation-only names require an exact
  path. No existing files are renamed or rewritten.
- Generated image names retain the timestamp/provider/title and add a UUID.
  Images and JSON sidecars are each flushed to a same-directory temporary file
  and published without replacing an existing destination. Windows uses
  non-replacing rename; POSIX uses hard-link publication and fails closed if the
  filesystem cannot support it. Old image filenames remain readable.
- Publication is atomic per file, not a two-file transaction. A crash or metadata
  failure after image publication can leave an image without its sidecar; no
  automatic paid generation retry has been added.

Tests reproduce the old Unicode/ambiguity errors for both read and delete, cover
the page handler's error receipts, generate concurrent same-title mock images
under a frozen clock, verify metadata pairing, refuse destination collisions,
and inject flush/publication failures. No real image provider is used.

Verification: 824 Python tests and 450 JavaScript tests pass; changed Python files
pass Ruff. The existing upstream Starlette/httpx deprecation warning remains.

These are Python server changes. A page-server restart loads both; a realtime
restart also refreshes its directly imported note/image helpers. Browser refresh
alone cannot deploy them. No prompt, model, firmware or UI changes are required.

## Remaining Sequence

1. **Baseline and recovery:** verify a separate private-data backup, record the
   working dependency/model/firmware versions, and make model-launch errors
   fail explicitly. Preserve a representative rich session for comparisons.
2. **History reliability:** lossless resume fallback when LLM preparation fails
   or exceeds 96,000 characters; preparation must not block conversation.
   Protect the live save-parent during archiving and add interrupted-archive
   recovery. These remain open; the first batch does not repair them.
3. **Context admission:** admit instruction-bearing cards whole; report actual
   note/history inclusion and context pressure. No silent summarization or
   eviction. Chunked summary preparation remains separate experimental work.
4. **Initiative delivery:** retain B2 questions through busy periods; validate
   advice against evidence and guidance revisions. Semantic reassessment stays
   with models, not English phrase classifiers. Preserve useful parallel work.
5. **Tool recovery:** deliver denied-action receipts for bounded model-chosen
   recovery without terminating unrelated permitted work. Preserve scope checks,
   interruption ownership and protection against duplicate paid operations.
6. **Boundaries:** remove remaining English intent gates and canned mouth
   dialogue; harden consequential APIs after inventorying browser/device callers;
   pin inference dependencies and test private upstream API compatibility.
7. **Lifecycle consolidation:** extract focused ownership modules only after
   behavior is covered; add whole-session event replays for long playback,
   delayed inference, interruption, tools, idle, stale results and reconnect.

## Acceptance

Code tests are necessary, not evidence by themselves of a better companion.
Compare the same model/settings in a fresh card-free session and a rich continued
thread. Exercise search, draw, show, long speech, B2 delivery, normal and accelerated
idle, and return after an absence. Observe initiative, developing ideas, shared
task continuity, truthful receipts, no overlapping voice and return latency.

New brains, expanded choreography, model experiments, automatic summaries and a
backend-runtime migration are not prerequisites for this stabilization pass.

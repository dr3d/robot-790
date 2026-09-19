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

## Second Batch: History Protection

Implemented in source, deployment pending:

- Auto history uses the original source if its requested prepared form is
  missing, stale, invalid, unreadable or unprepared. This includes sessions above
  the unchanged 96,000-character preparation limit. Valid prepared forms remain
  preferred; the default summary policy is unchanged.
- Connect returns immediately with that available history instead of enqueuing
  model preparation. Explicit Prepare forms and post-session preparation are
  unchanged. Receipts retain requested/actual forms, source SHA-256, sizes and
  the fallback reason. Unreadable selected originals still fail visibly.
- This fallback adds no truncation, rewriting, derivative writes or new LLM
  requests. It does not fix the browser's separate per-note/aggregate context
  caps, promise every returned character reaches B1, or solve archive recovery.
- Page-server restart deploys this batch; servers were left running unchanged.
  No prompt, idle behavior, firmware or model settings were edited.

Verification: 835 Python tests and 450 JavaScript tests pass; changed Python
files pass Ruff. The existing upstream Starlette/httpx warning remains. New
tests cover missing/stale/unsafe/unreadable forms, the 96K preparation failure,
valid generated and reviewed variants, unchanged membership, API Connect/preview
without enqueueing, backup hashes, literal paths, destination collisions and
source-root exclusions. Independent rechecking found zero backup hash mismatches.
These are offline mechanism tests, not a live companion continuation.

### Private Backup And Recovery

Run `powershell -NoProfile -File scripts/backup_private_history.ps1` from the
repo. It copies `notes/`, `logs/`, `config/`, `.env` and `qwen3_tts.env` when
present into a fresh ignored `backups/history-*` directory. This includes active
and archived session notes, derivatives, receipts, eye assets, generated images
and audio still in those source trees. Already moved external archives and
external note roots are not implicitly included. An environment override for
the notes root is rejected rather than falsely reported as protected.

Verified September 19 snapshot:
`backups/history-20260919-075435-b79f0a7c/`, 2,894 files, 961,704,388 bytes.
Source revision before this batch: `51e1809`. The snapshot's
`backup-manifest.json` records every relative path, byte length and SHA-256.
The utility checks source/copy/source hashes and verifies all final copies again.
Open logs can be read without stopping their writers; repeated concurrent changes
fail the operation. No source is moved or changed. Existing targets and linked
source entries are rejected. A manifest is written only after verification;
earlier incomplete attempts must not be treated as verified backups.

This is a per-file backup made while servers run, **not** a cross-file atomic
snapshot. New files created after enumeration are outside its inventory. It is
on the same disk, so it protects against editing mistakes, not disk loss. Keep
an additional private off-device copy before a migration. Environment files and
conversation data may be sensitive; never publish these backups.

For recovery, first stop writes at a disconnected boundary and preserve the
current data separately. Verify the backup files against its manifest, then
restore the selected notes and their referenced assets to the recorded relative
paths. Review configuration/environment differences before restoring them.
Do not restore over live servers or bulk-replace current history without checking
what was created since the backup. No automatic restore/migration was attempted.

## Remaining Sequence

1. **Baseline and recovery:** private-data backup is verified locally; still
   record the working dependency/model/firmware versions and make model-launch errors
   fail explicitly. Preserve a representative rich session for comparisons.
2. **History reliability:** preparation-blocking resume is repaired in source.
   Still protect the live save-parent during archiving and add interrupted-archive
   recovery. These archive issues remain open.
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

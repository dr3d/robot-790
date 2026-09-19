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

## Checkpoint Status

The batches below retain their original implementation and deployment notes.
For subsequent activation, test counts and live acceptance evidence, use
[Engineering Status](engineering-status.md). Whole-card admission and idle-art
handoff repairs are now implemented, and the page helper has been restarted.
No legacy archive migration or general memory-budget redesign was performed.

One later, explicit operator-requested exception to the initial cadence freeze:
four existing idle timing values were shortened so ordinary 1x operation offers
the thinking opportunities previously sought with 10x Lab Speed. Human priority,
audio ownership, full-context idle and personality prompts remain unchanged.
Sustained live acceptance of that new timing baseline is still pending.

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

## Third Batch: Archive Safety

Implemented in source, deployment pending:

- Single-session Archive now follows Archive Branch's disconnect requirement,
  enforced by the page server's existing browser activity leases. Connect also
  revalidates its selected save-parent after acquiring that lease, before opening
  the realtime socket. An archive during history preflight fails Connect clearly
  instead of starting a conversation whose parent is already gone.
- New archives journal their source, destination, SHA-256 file inventory and
  phase in private `logs/archive-transactions/`. All session text, existing
  variants/receipts and available unchanged eye assets/sidecars are copied and
  verified before any original is removed. Copies use flushed temporary files
  and non-replacing publication. The source session is removed last.
- Retry uses the same journal/package, including after a process restart or an
  interrupted final completion receipt. It verifies both copies and surviving
  originals again, preserves new active references to shared assets, refuses
  modified/colliding files, and still protects the last active session.
- Preparation cannot write new derivatives or update its on-disk receipt while
  an archive transaction exists. This prevents a late failed job from changing
  a receipt that recovery expects to match.
- Existing missing/changed asset warnings are retained. I/O failures now stop
  the archive instead of reporting success while part of the move failed.

Recovery is explicit, not a startup mutation. Inspect
`GET /api/continuity/archive-recovery` for pending/invalid journals. With STS
disconnected, retry Archive for the same source filename, or send that filename
as `session_filename` to the existing `POST /api/continuity/archive` endpoint.
This works even if the final source removal succeeded before the completion
receipt was saved. Investigate invalid journals or hash mismatches against the
private backup; do not delete the journal to force a new archive. For a partially
completed branch, recover its pending session first, then preview/confirm the
remaining branch again. No full-branch rollback or automatic recovery is claimed.

Boundaries: old archive packages have no transaction journal and are not
retroactively repaired or migrated. Activity leases are cooperative browser
heartbeats, not proof of every process's liveness; avoid archiving during a page
server restart or failed heartbeat. Manual/external edits during an archive can
stop recovery for review. This is per-session crash recovery, not an atomic
whole-branch operation or protection from disk failure. Originals or verified
copies remain at interruption points; the earlier backup is the safety net.

Verification: 847 Python tests and 451 JavaScript tests pass. The existing
Starlette/httpx deprecation warning remains. New archive code, continuity and
regression tests pass Ruff; pre-existing style findings remain in the larger
page-server/preparation modules. Failure injection covers copy/cleanup/receipt
interruptions, partial writes, changed files, invalid paths, shared references,
preparation interference, active-browser refusal, the last active session and
the Connect preflight race.

No real session was archived/moved during implementation. Tests use temporary
fixtures. No prompts, summary policy, model settings, idle cadence or hardware
were changed. Deploy with a page-server restart and STS refresh at a disconnected
boundary; the earlier storage fixes also need a realtime restart if still pending.

## Fourth Batch: Contained Follow-ups

September 19 contained follow-up: browser-side unpin lookup now preserves Unicode
letters/marks, rejects empty punctuation matches and ambiguous normalized names,
and honors folder-qualified requests. Exact filenames still win. Three regressions
first reproduced removal of an unrelated/ambiguous pin; all 454 JavaScript tests
pass after the fix. This matches the earlier backend lookup safety rule without
changing memory budgets or note contents. Refresh STS to load it.

Another contained follow-up retains valid B2 questions in the existing bounded
private advisory queue during busy periods, instead of logging and discarding
them. Existing turn-boundary delivery, stale-result checks, guidance-revision
invalidation, B1 discretion and public-mouth ownership are unchanged. No new
speech request, idle wakeup, cadence adjustment or prompt wording was added.
All 457 JavaScript tests pass, including busy/quiet retention, stale rejection,
guidance changes and the existing 12-candidate bound. Other B2 evidence-freshness
and delivery cases remain open; this is not a wholesale B2 repair.

The final contained change instruments the existing B1 note formatter without
changing its text, order or budgets. Each pin now reports full/partial/omitted/
disabled admission in the memory/context views, runtime estimate and
`list_pinned_notes` receipt. Per-file versus aggregate clipping is distinguished;
ordinary pin-limit removals are logged. Declared `## STS NOTE 1` instructions
receive an explicit warning count if partial or omitted. Legacy untagged notes
still report their admission status but are not semantically classified.

These are character counts of the browser-assembled B1 note section, including
its wrappers/notices, not proof of provider transmission, exact token usage, KV
occupancy or B2 guidance admission. They are computed on inspection, not a new
per-inference log stream. No note text or B2-private guidance is put into the
receipts. Prompt SHA-256 goldens for empty, clipped-card and rich-history/core
cases match the pre-instrumentation formatter.

**Historical risk boundary at the diagnostic checkpoint:** whole-card admission
was not yet fixed. The 4,500-character
ordinary-note view, 64,000-character total note budget and eight-pin replacement
policy remain. Automatically reserving more for cards would change which history
survives; rejecting oversized loads or increasing the budget also changes the
experience. Stop here for an explicit admission policy, rather than silently
making those choices. Further tool-continuation and broad B2 freshness changes
also need their own bounded design and live acceptance, not another quick rule.

September 19 follow-up preparation: [Complete Setup-Card Admission](setup-card-admission-plan-2026-09-19.md)
proposes a separate bounded instruction allowance, complete per-brain snapshots
and explicit rejection instead of clipping/automatic card eviction. It includes
lifecycle, prefix-stability and regression checks. The operator subsequently
authorized this and the image handoff as separate repairs, recorded below.

This batch only requires an STS refresh, but earlier Python repairs still await
the documented server restarts. No active browser/session/server was disturbed.
Final verification: 847 Python tests and 465 JavaScript tests pass; the existing
Starlette/httpx warning remains. No real LLM, speech, paid art or hardware trial
was run. Prompt goldens cover the assembly-preserving diagnostic change, while
mechanism tests cover the actual unpin and B2 retention repairs.

## Separate Follow-Ups: Cards And Image Handoff

Complete optional-card admission now has a separate eight-card / 32,000-unit
rendered B1 allowance. Failed loads preserve the old complete snapshots; ordinary
pin churn cannot evict cards. Rich history retains its existing allowance and
ordering. Card-free prompts and all card wording are unchanged. See the admission
record for provider-acknowledgement limits and required live acceptance.

The image handoff repair prevents a rejected render from clearing the preview
and stranding a completed background image. Automatic delivery and B1's move tool
share single-owner staging, with truthful job status and late-result protection.
No new initiative restrictions, rhetoric, quotas or paid retries were introduced.

## Remaining Sequence

1. **Baseline and recovery:** private-data backup is verified locally; still
   record the working dependency/model/firmware versions and make model-launch errors
   fail explicitly. Preserve a representative rich session for comparisons.
2. **History reliability:** preparation-blocking resume, connected archive guards
   and journaled per-session archive recovery are repaired in source. Deployment
   and live disconnected-boundary acceptance remain pending. Legacy partial
   archives require case-by-case inspection rather than an automatic migration.
3. **Context admission:** complete optional-card admission is repaired and needs
   live acceptance. Ordinary/history limits remain inspectable but unchanged;
   broader model-context capacity and provider acknowledgement remain separate.
   Chunked summary preparation remains experimental work.
4. **Initiative delivery:** busy-period B2 questions are retained; still validate
   all advice against evidence and guidance revisions. Semantic reassessment stays
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

# Session Notes Road Readiness

## Assessment

The project has a coherent direction and demonstrated useful interactions.
Ordinary session notes, explicit context selection, compound body/image tools,
and evidence-backed postmortems are worth building on. The implementation needs
a focused reliability pass before repeated sessions become dependable memory.

The immediate gap is between the simplicity of the intended model and the
browser state that still influences it. Removing the continuity pointer was a
useful simplification, but it did not make loading a session deterministic.

This review covers the current working tree: context and creature architecture,
continuity storage, browser loading/saving, asynchronous tool completion, Brain2,
prompt assembly, the earlier assessment and fixes, and selected recent PMs and
original Daily Driver artifacts. It is not another full-corpus reading or a
live hardware/network test. References describe the reviewed source and may
move. The original review was read-only; the follow-up below records changes
made afterward in the same publishing pass.

## Follow-Up In Current Working Tree

Implemented after the review:

- Connect, Connect Previous, and Connect Select now rebuild the run from a
  fresh selected session note instead of merging with stale browser-pinned
  notes.
- Session restore re-reads the selected note and its saved pinned-note receipt
  from disk, then replaces the browser pin list with that exact restore set.
  The ordinary eight-note pin cap no longer evicts dependencies during a
  continuity restore.
- Fresh continuity connects clear the old hot transcript, Brain2 tail, search
  receipts, sensing-eye staging, and in-flight lane flags before opening the
  websocket.
- Tool calls, Brain2 mulls, and websocket event handlers are tagged with a
  realtime session generation so late completions from an old run cannot send
  results or mutate follow-up state in the next run.
- Graceful Disconnect treats a failed session-note write as a blocking error.
  If there are no accepted conversation lines, it can still close without
  writing a new session note.

Still open from this review: exact context-inclusion receipts, caption-rename
reference integrity, richer verifier/Brain2 receipt feeds, and controlled
daily-driver replay trials.

## Findings In Priority Order

### 1. Session Restoration Still Depends On The Existing Browser State

`loadCurrentContinuitySession` loads the chosen note, skips dependencies already
present in `loadedNoteContexts`, and preserves other loaded notes. Consequently:

- A note from another run can remain pinned although the selected session did
  not request it.
- A dependency edited on disk can retain its old browser-held content. The
  loader can report that the disk file changed without actually loading it.
- The plain Connect path retains the old conversation array. The saved
  transcript function serializes that entire array, so successive disconnects
  in one tab can create overlapping session records.
- Connect Previous explicitly clears more state than ordinary Connect and
  Connect Selected. Selection buttons do not currently share one restore
  contract.

These were reproduced using the shipped functions in an isolated Node VM. A
selected note with one dependency retained an unrelated old-branch note and
the dependency's old content. A normal reconnect followed by a new turn saved
both the previous run's and the new run's test markers.

Recommendation: make every connect mode construct a fresh run from an explicit
selection and its current pin list. Reset transient state consistently. Give
each run a transcript boundary, so its note contains that sit-down exactly
once. Keep prior sessions as referenced notes with their gap annotations.
Unpinning must remain the operator's control over future context.

Sources: `web/sts/index.html:5310`, `:12124`, `:15242`, `:18530`, `:18584`.

### 2. Late Work Can Cross Session Boundaries; Disconnect Can Outrun Saving

`handleFunctionCall` awaits a tool and then sends its result through the global
`ws`. It does not check that the socket/session is still the one that originated
the call. In an isolated reproduction, a call started in session A sent its
function result into replacement session B. Brain2 completion also updates
shared state after an awaited request without checking session ownership.

The Disconnect handler treats writing the session note as an optional runtime
step. A failed or timed-out save returns null and disconnection continues.
The transcript may still exist in the page or exit logs, but the normal resume
path can select the older session. `Promise.race` timeouts do not cancel the
underlying work. Saving also begins before activity is halted, leaving a
window in which additional accepted turns/results can arrive after the snapshot.

Recommendation: assign each live run an explicit generation identifier. Every
tool, Brain2 request, socket callback, and deferred surface belongs to that run;
late completions must not mutate a successor. Use cancellation where possible,
and still reject stale completions when cancellation is unavailable. Already
executed external actions need a receipt even if the conversation has stopped.

For Disconnect, stop admitting new work, settle or explicitly account for
pending input, capture a fixed transcript boundary, and record a durable save
receipt. Make failure visible and recoverable. Keep Halt's deliberate immediate
stop semantics distinct from successful saving.

Sources: `web/sts/index.html:10377`, `:10401`, `:12119`, `:15255`, `:15513`,
`:17459`, `:19329`.

### 3. Pinned Does Not Currently Mean Fully Included

Current limits include eight loaded notes, 4,500 characters per ordinary note,
64,000 per transcript note, 64,000 across loaded-note prompt blocks, and 200,000
characters per disk note. The model's configured 131K context is not the same
budget as these character limits.

Reproductions:

- Restoring nine dependencies reported nine restored and no failures, while
  only seven dependencies plus the selected session remained pinned.
- The actual Daily Driver `boot_eric.txt` has 12,076 characters. Its ordinary
  pinned prompt view retains the first 4,500. This does not imply that the
  original read-tool response was also limited to 4,500; it means a later boot
  does not reproduce that full read through the pinned-note block.
- A sufficiently long transcript consumed the non-core note budget and omitted
  another pinned note entirely. Core memory was correctly preserved.

Recommendation: produce a context assembly receipt from the same code that
builds the prompt. Show requested files, actually included files/spans, clipping,
and exclusions. Preserve pin selection separately from prompt budgeting so
loading a ninth file cannot silently rewrite what the next run is expected to
inherit. Check save capacity before the exit boundary. A useful near-term
implementation can be explicit limits and recovery; automatic summarization
does not have to come first.

Sources: `web/sts/index.html:3015`, `:4980`, `:5669`, `:5750`;
`src/robot_790d/note_files.py:13`, `:136`.

### 4. Caption Renames Need Reference Integrity

Session filenames are used as parent references and pinned dependencies.
The storage layer resolves those literal filenames. Renaming an ancestor for
its PM caption can leave descendants referencing a missing file, and saving
from a browser still holding the old parent name can fail validation.
The caption-name test currently creates an additional captioned copy; it does
not test renaming an ancestor with existing descendants.

Recommendation: keep the timestamp as stable, visible identity and make caption
changes preserve reference resolution, or update all affected references through
one controlled rename operation. This can remain ordinary files. Store a small
versioned metadata block in the session note and use one parsing contract;
metadata boundaries should not depend on arbitrary transcript prose.

Sources: `src/robot_790d/continuity.py:121`, `:259`;
`tests/test_continuity.py:111`.

### 5. Brain2 And PMs Need Clear Evidence Boundaries

Brain2 is instructed to notice missing action receipts, but its current request
contains recent conversation, recent idle output, recent B2 output, and prosody.
It does not receive a structured current tool/image receipt feed. It can provide
valuable conversational observations; this input does not support a dependable
operational verifier.

Some polished confirmations are runtime-authored. For example,
`embodimentFollowupText` supplies the "same Eric, different body" response.
Eric's selection of the embodiment tool remains meaningful evidence. The
wording of that confirmation should be attributed to the runtime in behavioral
analysis.

The lesson proposition already distinguishes candidates from tested lessons.
Strengthen one point: receipts establish that an action happened; they do not
establish why a particular prompt caused it or whether a proposed lesson will
generalize. Eric's explanation helps generate a hypothesis. Repeated comparisons
provide the evidence for promoting it.

Recommendation: give any verifier compact current action/image receipts with
origin, timestamp, and run identity. Keep deterministic checks in runtime code.
Label model-generated speech, exact runtime confirmations, and supplied B2/PM
interpretation in the evidence record. Freeze the actually used prompt/config
and note versions in the PM bundle for comparisons; live notes can stay editable.

Sources: `web/sts/index.html:10377`, `:17453`, `:19216`;
`src/robot_790d/sts_page_server.py:1431`;
`docs/articles/a-working-proposition-about-lessons.md`;
`curation/postmortems/20260907-175329-daily-driver-empty-boot/postmortem.md`.

## What The Project Is Doing Right

- **A coherent interaction target.** The face, voice, shared images, tool use,
  and continuity are converging on a room companion who can participate in
  an activity. The pose-gallery and Daily Driver evidence contains specific
  successes as well as failures.
- **Operator-editable context.** Core identity, ordinary notes, session
  selection, and unpinning give Scott practical authorship over the next run.
  Timestamp plus caption serves both machine ordering and human recognition.
- **Tools at the level of intent.** Pose/label/capture and generated-image-to-eye
  workflows let Eric translate a situation into an action. They reduce the
  amount of low-level procedure Scott has to narrate.
- **Runtime truth and receipts.** Current observations overriding historical
  claims is the correct rule. Atomic note writes and corrected device failure
  propagation are substantive improvements already made.
- **An inspectable laboratory.** Conversation, events, B2 output, session note,
  and video in a PM folder are useful evidence. Preserving failures makes the
  archive substantially more valuable than a collection of selected successes.
- **Separable identity and embodiment.** Creature configuration and body
  adapters give a sensible direction for other faces or characters. The
  separation is partial, but the architectural boundary is useful.

The apartment gateway also improves on the earlier assessment's network
baseline: the page launcher defaults to loopback and the Caddy configuration
restricts subnet and browser origin. This review inspected configuration only;
it did not test deployment or device trust. Multiple active controllers and
powered chassis operation still need their own ownership and stop guarantees
before those become routine workflows.

## Recommended Next Work

1. Checkpoint the current working tree on the current branch before behavioral
   changes. Existing HEAD alone does not contain all the reviewed work.
2. Repair session boundaries and stale asynchronous completion together. Test
   normal Connect, Previous, Select, and Empty through the same lifecycle.
3. Add honest context inclusion and durable-save reporting, including long-note
   and caption-rename cases. Retain the simple files-first architecture.
4. Run a small repeatable set of daily-driver trials, recording what changed
   between them. Use these as the gate for behavioral lessons and prompt edits.

Useful acceptance trials:

- Boot Daily Driver, add a unique banter marker, disconnect, then Previous.
  The marker must remain in the saved banter note and be absent from the
  reconstructed Daily Driver context.
- Repeat several connect/disconnect cycles in the same tab and after reload.
  Each note contains its own run once; expected pins and gap chronology agree.
- Edit and unpin notes, then restore. The next prompt contains current contents
  of exactly the selected notes; omitted/clipped material is reported.
- Delay a tool/B2 result, halt, and reconnect. No old result enters the new run.
- Force save failure, exceed the note budget, and rename an ancestor. Each case
  has an explicit, recoverable result and preserves the existing archive.
- Repeat one natural pose/image workflow and one standing routine. Verify
  actual artifacts, cadence, stop response, and operator interventions.
- Mine one candidate lesson, test with and without it using comparable context,
  vary the wording, and include a one-shot request that should not start a loop.

After those guarantees are in place, extract session lifecycle and context
assembly from the large STS page as the repairs warrant. Prefer small modules
with observable inputs and outputs. Broad prompt polishing, new memory stores,
and more supervisory model lanes should follow evidence of a specific need.

## Verification

Existing targeted backend tests: **96 passed** across continuity, note files,
STS page server, and realtime tools. Browser-source suite after the follow-up:
**32 passed**, including new regressions for stale browser-pin restoration and
late async tool completion. Passing unit checks still do not settle live
lifecycle correctness.

The reproduction harnesses used shipped JavaScript functions with stubbed
network/device operations. They exercised stale dependency loading, unrelated
pin retention, pin eviction, transcript boundaries, delayed tool completion,
and context clipping. They did not operate Eric or alter live session records.

The next milestone is dependable continuation with observable context and
reliable actions, while keeping the conversational freedom that makes Eric
interesting to spend time with.

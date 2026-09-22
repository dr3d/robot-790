# STS Lifecycle Ownership

September 20, 2026. Starting baseline: `2472bbd`, published on `master`.

## Aim

Reduce the risk that fixing one transition breaks another. The problem is not
the page's byte count: multiple callbacks share ownership of session validity,
speech, tools and scheduling. Moving functions into files without settling that
ownership would preserve the problem.

Eric and B2 keep choosing meaning, initiative and content. STS owns execution,
permissions, receipts, persistence and exclusive access to public speech.
This work must not introduce English intent classifiers, prescribed dialogue,
shorter answers, new quiet periods or a setup-card requirement.

## Current Ownership Map

Functions below are in `web/sts/index.html` unless a module is named. These are
current responsibilities, not a claim that they already form isolated modules.

| Responsibility | Current entry points / state | Boundary risk |
| --- | --- | --- |
| Connection identity | `realtime-connection.js` owns socket, generation and stopped state; page adapters `activeRealtimeSession`, `realtimeConnected`, `send` | An awaited operation retains an old socket or generation. A stop is not the same as a new connection. |
| Normal connection transitions | `realtime-connection.js` owns the single operation token; `runConnectionTransition` adapts UI; Connect/Previous/selected/Disconnect wrappers compose preparation and save functions | Competing preparations must not mutate shared context. A session-map move needs the same token through save and destination arrival. Backend controls remain separate; unused explicit-reset controls are retired. |
| Current-socket closure | `realtime-connection.js` owns the idempotent close promise and stopped state; `handleRealtimeClose` / `cleanupClosedRealtime` adapt page resources and recovery UI | Reconnect cannot race pending close cleanup. The stopped unsaved transcript must survive until Disconnect/save succeeds. Explicit backend controls and page exit are not a crash-save protocol. |
| Stop, save, reconnect work | `saveAndDisconnectRealtime`, `saveEricContinuitySnapshot`, `quiesceRealtimeForSave`, `haltRealtimeActivity`, `openRealtimeConnection`, `resetSessionContextForConnection`, `clearHotConversationState` | Snapshot preparation owns one bounded final-transcript wait and the empty/save decision; frozen retries do not wait again. Device cleanup and save orchestration remain page-owned. Final transcription must survive stop, but new speech and effects must not. Failed saving must block destructive reset. |
| Response dispatch | `handleEvent`, `responseActive`, `suppressedResponseIds` | Provider response completion is not audible completion. Canceled responses and old events must not revive work. |
| Tool batch and continuation | `tool-continuation.js` owns pending count, done flag, drain timer, call-ID deduplication, user activity timestamp and round state; page adapters execute tools and dispatch requests | Results and response completion arrive in either order. Receipts may survive an interruption while automatic continuation must not. |
| Audible output | `audio-playback.js` owns playback state; page adapters `playPcm16Bytes`, `flushAudioQueue`, `outputAudioActive`, `stopPlaybackNow` | Audio setup is asynchronous; scheduled audio can outlive inference. Wall-clock time cannot prove playback has finished. |
| Turn completion | `armAssistantUtteranceFinished`, `checkAssistantUtteranceFinished`, `noteConversationActivity` | Idle/reengagement can start too early if generation completion is mistaken for speech completion. |
| Generated-image presentation | `generateImage`, `showGeneratedImage`, `moveGeneratedImageToSensingEye`, preview/eye generations | Artifact creation, preview display and eye staging are separate successes. A retained image must remain retrievable without another render. |
| Idle art | `idle-art.js`, browser grant and staging callbacks | Existing single-owner controller must not acquire a competing owner during extraction. Permission, job completion and staging have different lifetimes. |
| Idle/B2 opportunities | `brain2BlockedReason`, idle/reengagement scheduling, B2 advisory and speech queues | Private advice and public speech have different readiness conditions. Fixing ownership must not suppress useful parallel thought or proactive conversation. |

## Invariants To Preserve

1. Only the current connection can dispatch new model work or public effects.
2. Stopping can still accept the final in-flight user transcript for saving.
3. A failed save cannot silently become a fresh session and erase unsaved text.
4. A late tool from an old connection cannot decrement the new connection's
   pending count, mutate its eye or release its continuation.
5. A new user turn can invalidate old presentation/automatic continuation without
   discarding a successfully created artifact or its receipt in the same session.
6. Tool continuation requires both completed tool work and response completion,
   then an actually drained audio path. Duplicate completions do not double-send.
7. Pending audio setup, queued bytes and scheduled sources all count as busy.
   Stop invalidates pending setup as well as stopping existing sources.
8. Tools remain model-selected. Execution checks, bounded continuations and
   unknown-paid-outcome protection are not conversation scripts.

## Groundwork Implemented

`tests/sts_lifecycle_replay.test.cjs` composes the production event dispatcher,
session guards/reset, tool handoff, image generation/retrieval and audio functions
inside one deterministic fixture. Existing tool and image fixtures are shared
under `tests/helpers/` instead of duplicated. Seven replay tests cover:

- Generation interrupted by user activity, retained receipt, exact retrieval,
  actual speech drain, then reconnect cleanup.
- Tool completion before/after response completion, including duplicate done.
- Old socket/tool completion while new connection work is pending.
- Canceled response with a late successful artifact.
- Stopped-session final transcription while late audio/tool events are ignored.
- Failed-save reset refusal.
- Pending audio setup and an already-captured timer callback after reconnect.

These are composed mechanism tests, not complete browser-session simulations.
Network responses, DOM/image decoding, audio hardware, eye saving, idle-art
permission checks, B2 scheduling and durable conversation saving are mocked.
Reconnect invokes the real reset/guards, but not the full Connect/Disconnect UI
or save pipeline. No live model, paid image service or device is invoked.
Page-function extraction follows existing tests and depends on page formatting.
The audio owner is now imported through its module export; fixtures also load
the actual page initializer to exercise the production callback wiring.

## First Production Extraction: Audio Playback Owner

**Implemented September 20; live acceptance in progress.** The steps below were
the extraction boundary; September 21 receipts and remaining checks are below:

1. Move playback queue, source scheduling, pending setup tokens, playback
   generation and stop/drain checks into one small module. Preserve sample rate,
   chunking, gain, recording destination and scheduling offsets exactly.
2. Keep existing page entry points as adapters initially. Inject browser audio
   setup and recording/mouth callbacks; do not duplicate audio state in page and
   module. The playback owner reports busy/drained, not what Eric should say.
3. Run current audio tests and these composed replays against that implementation.
   Add a browser-backed audio-clock check before treating the extraction as done.
4. Accept live long speech, user interruption, tool follow-up, disconnect during
   speech and reconnect before moving another ownership boundary.

Do not simultaneously move prompts, B2 reasoning, persistence or idle policy.
The subsequent extraction is the tool-continuation owner documented below.
A wholesale backend migration is not required.

`audio-playback.js` exports `create` in the same browser/CommonJS pattern as the
existing STS modules. Its API is `enqueue`, `flush`, `play`, `clearQueue`, `stop`,
`isActive` and `isPlaying`. `onSettled` reports a source or setup completion;
it is not a whole-conversation completion event. The page still checks its
assistant-finish flag and the owner's busy state before releasing scheduling.
No private playback sets or queue counters are mirrored in the page.

All 558 JavaScript tests pass, including the original seven composed replays and
20 focused audio tests. All 129 page-server Python tests pass. Real Web Audio in
headless Edge verified sequential starts, nonzero recording-tap signal despite
muted gain, a frozen suspended clock remaining busy, and Stop removing a queued
six-second schedule before a fresh 30 ms start. The real disconnected page loaded
the module successfully on desktop/mobile. The browser check is reproducible via
`tests/sts_audio_playback.browser.cjs`; it never connects to Eric or opens devices.

Activation is a disconnected page refresh, not a backend/model restart. Prompts,
permissions, sentence batching, flush thresholds, voice and idle cadence are
unchanged. Keep the autonomous-art run as a live behavioral comparison; this
structural change should not be perceptible as a different Eric.

## Second Production Extraction: Tool Continuation Owner

Implemented September 21; resumed-thread live comparison passed the exercised
paths that evening. Remaining coverage is listed below.
`web/sts/tool-continuation.js` owns pending calls, response-done readiness,
duplicate call IDs, continuation rounds/scope, source names and the audio-drain
timer. Page adapters retain tool execution, receipts, permissions, prompt
construction and socket dispatch. Readiness consumers read the owner directly;
there are no mirrored page counters. Existing test fixtures alias old names to
the actual module through the production initializer, not a second algorithm.

The existing 100 ms drain poll, default/configured round limits, 512-ID and
eight-source bookkeeping bounds are unchanged. This adds no new restrictions.
The continuation prompt, tool catalogue, idle policy, image staging choices,
context assembly and model/TTS settings are unchanged. A canceled timer callback
already queued before reset cannot clear the new owner's timer.

Verification: 609 JavaScript tests pass, including ten new owner checks;
969 Python tests pass (one existing Starlette/httpx deprecation warning),
including a separate 144-test page-server run. Before/after wire packets matched for normal,
idle, exhausted, denied and interrupted fixture scenarios. The real Edge check
now composes both owners: no follow-up while actual Web Audio is active, exactly
one after drain. Desktop/mobile page loads have no JavaScript errors. No live
model, microphone, hardware action or paid render was used by these checks.

The baseline is the 22:22-22:28 Harbor Courtesy Engine run, saved as
`session-20260921-222825-511.txt`, with evidence preserved in
`logs/runs/20260921-2228-tool-continuation-baseline/`. It completed the multi-step
task and adapted after interruption. STT changed "ferry" to "fairy"; one fully
filtered reply recovered before eye staging. Both predate this extraction.

The 22:42-22:49 post-extraction run used Connect Previous from exactly that parent.
Nine successful tool calls (three searches, three renders, three eye loads)
produced nine follow-ups. Playback interruption, revision, idle web research/B2
contributions and cancellation on Disconnect worked; the session and three eye
assets saved. No backend warnings/errors or output-filter recovery were recorded.
First audio on ordinary user turns took 1.356-3.858 seconds; startup was 17.635
seconds, similar to baseline. Context went from 40.9% to 51.6%, without overflow.
Evidence: `logs/runs/20260921-2249-tool-continuation-comparison/`.

The model needed a nudge to draw after clarifying ferry versus fairy, and the
final passenger design drifted from the original weir fact. These are content
observations, not failed tool continuations. This comparison supports the rich
resumed-thread path, not fresh card-free acceptance or all remaining transitions.
Activation remains a disconnected page refresh; no backend/model restart.

## Next Boundary: Stop, Save And Reconnect

September 21 review checkpoint: `1f52674` on `master` records the accepted
audio/tool baseline and comparison notes. Review/test groundwork was committed
as `e067a54` before repairs. Repair progress is recorded below; prompts, model
settings and conversational timing remain unchanged.

### Findings Before Extraction

**September 22 scope reduction:** Scott never uses the alternate Save + Halt /
Start Eric workflow. Its control, event wiring and dedicated functions are now
removed. Keep the shared saving/guard logic used by Disconnect, and test only
Disconnect followed by Connect. The review and repair receipts below describe
the earlier code; the alternate route is no longer a live acceptance item.

Do not move all the current flags into a class and call the problem solved.
There are separate authorities: permission to act on a connection, ownership
of a save attempt, acknowledgment of durable storage, and device cleanup.

Offline fault injection against the actual page orchestration reproduced:

| Fault | Current result | Required distinction |
| --- | --- | --- |
| Session write succeeds; note reload fails | Disconnect says save failed. Retry writes another session, parents it to the first, and has already cleared the original eye-asset list. The first saved artifact remains; this is duplicate lineage, not demonstrated file loss. | Committed save versus failed optional refresh. Retry must reuse an acknowledged receipt. |
| Eye-inbox flush outlives the outer 16-second save wait | UI permits retry, but the old promise is still running. After retry saves successfully, releasing the old flush starts another write and changes current session selection. | A wait timeout does not cancel underlying work. Expired attempts must not start writes or mutate a newer attempt. |
| Save + Halt succeeds, then Start Eric | Start clears `continuitySaveHalted` before `connect`; the retained transcript and stop flag make `connect` reject it as unsaved. | A saved run remains saved until successful new-session preparation takes ownership. |
| Old five-second cleanup timer fires during a newer exit | It clears the newer `intentionalExitCleanupInProgress` flag. | Cleanup completion belongs to a particular operation, not a shared wall-clock timer. |

Sources: `saveEricContinuitySnapshot`, `runtimeStep`, `disconnectRealtime`,
`startContinuityEric`, `endIntentionalExitCleanupSoon` in the page. The inbox fetch
has no local abort deadline. The storage API currently creates a new filename on
each save and has no idempotency key. Aborting a fetch alone would not establish
whether the server already committed a write.

Diagnostic reproductions are preserved in
`logs/maintenance/lifecycle-review/reproduce.cjs`. They record the defects at the
`e067a54` checkpoint, not the intended contract, and are separate from the passing
suite. Their pre-repair assertions are expected to fail as fixes land; use the
desired-behavior regressions in `sts_save_lifecycle.test.cjs` for acceptance.
These are injected failures, not claims that the recent live run experienced them.

Repair progress: cleanup release now carries the identity returned when that
operation began. Both a captured old timer and an old operation finishing late
are unable to release a newer cleanup. All five exit callers pass the identity;
the existing five-second grace period is unchanged. Two regressions and the
focused save/idle/camera suite pass (49 tests). Live acceptance remains pending.

The second repair routes Start Eric through normal connection preparation,
including transcript reset and current saved-history loading. It no longer
clears the acknowledged-save flag before connection succeeds. Tests cover
successful restart, failed preparation followed by retry, and refusal to bypass
an actually unsaved stopped session. The focused save/navigation/replay suite
passes all 34 tests; live Save + Halt / Start Eric acceptance remains pending.

The third repair treats a failed optional note reload as a post-save warning,
not failure of the acknowledged disk write. Disconnect and Save + Halt still
complete; ordinary connection preparation reads the saved history on resume.
Two regressions exercise both exit routes, including resumed connection without
a second write (15 save-lifecycle tests pass). This does not yet fix the broader
timeout/unknown-outcome case: a whole-snapshot timeout can still outlive its
underlying work. That requires the transaction and receipt work below, not a
larger timeout or a claim that optional-refresh handling solved every save race.

Commits: cleanup identity `15282dc`, Start Eric `79a263e`, acknowledged-save versus
optional reload `e6126aa`. September 22 verification: all 624 JavaScript and 969
Python tests pass (one existing Starlette/httpx deprecation warning). The isolated
Edge/Web Audio check passes, including desktop/mobile page loading and unchanged
audio-drain/tool-continuation ordering. The startup popup fixture now pauses at
the new connection entry point while preserving its synchronous-open assertion.
No server restart, model call or paid generation was used for these checks.
These three repairs are ready for a disconnected page refresh and a live trial;
transaction timeout/unknown-outcome repair and ownership extraction remain next.

### Ordered Work

1. **Keep the small cleanup repair and one connection path.** Cleanup now has an
   operation identity so an old release cannot end a new cleanup. The alternate
   startup route has been removed. Preserve tests for ordinary connection
   success and failure/retry. Do not alter browser audio or tool owners here.
2. **Establish the save transaction contract before extraction.** Settle accepted
   final speech and eye work, then freeze one payload with its real parent and
   asset list. Track the attempt independently of UI cleanup. A durable save
   receipt is authoritative even if reloading/pinning the note or refreshing the
   map fails; report those failures separately. A retry of the same attempt must
   not invent another branch. Do not clear assets before acknowledgment.
3. **Handle unknown write outcomes explicitly.** Guard every post-await effect
   with attempt identity; canceled preparation must not later submit a write.
   For an already-submitted request whose reply is lost, use a persisted
   request identity and matching-payload receipt/readback in the storage API.
   Reuse it on retry; reject reuse with different content. Abort is cleanup, not
   proof of non-commit. Cover server restart and concurrent retries using real
   temporary storage. Do not infer success from a timeout or blindly resubmit.
4. **Extract connection/transition ownership after those behaviors pass.** One
   owner for current socket/generation, stop state and a single in-flight
   transition. Cover Connect, Empty, Previous, selected/map jumps and Disconnect.
   Retain thin page adapters for UI, context assembly,
   transport and resource owners. No mirrored flags or second save algorithm.
5. **Handle unexpected closure and page exit as separate work.** Read the socket
   close, server restart/halt/unload, Reset To Pinned, Clear Latest and pagehide
   paths before consolidation. Their semantics differ: explicit discard, stop,
   durable save and emergency cleanup are not interchangeable. Do not silently
   add automatic saving, reconnection, resubmission or a new unload guarantee.

Each production repair/extraction gets its own commit and a narrow rollback.
Preserve accepted artifacts when work is interrupted; suppress stale effects,
not the fact that a completed artifact exists. Reuse the audio/tool owners for
stop and drain. Do not centralize their internals in a new all-purpose controller.

### Verification And Operator Trial

Eight new `sts_save_lifecycle.test.cjs` checks compose the real stop/save functions,
transcript settling and save-request serialization. They cover successful saves,
explicit rejection and retry, final transcription, duplicate clicks, empty stop,
map-refresh failure, no-reload session jumps and Save + Halt. Storage, note-body
formatting/loading, sockets and devices are simulated. These do not yet exercise
the actual HTTP/durable-storage path together or establish the four defects fixed.

At this review: all 617 JavaScript tests pass; all 13 existing Python continuity
tests pass against temporary storage. The prior full Python suite remains the
969-test baseline, not a new full-suite run. No live model/device calls were made.

Before production extraction, add desired-behavior regressions for all four
findings, lost HTTP acknowledgments, reconnect after save failure, an old socket's
late close, concurrent connection preparation, and late paid-art completion.
Then use an isolated browser/page-server fixture with temporary notes to exercise
real HTTP saving and socket/device teardown. Never induce disk/transport failure
against Scott's actual session files. Do not add permanent verbose instrumentation.

The human trial remains small: resume the rich thread, request a long answer,
interrupt, disconnect during speech, then reconnect and check the last accepted
exchange and the single new branch in the map. Use a marker such as "the kettle
is named Tuesday" to distinguish
history delivery from a fluent guess, while verifying the saved file directly.
No deliberate speech, sentence-count, idle-initiative or tool-choice change is an
acceptable side effect of this work. Keep fresh card-free acceptance open too.

### Save Transaction Repair: September 22

Ordered steps 2 and 3 are implemented on ordinary Disconnect. The browser
settles the existing final-transcript/image work, freezes a request UUID and
payload, and retains them for retry. Preparation checks its attempt and session
identity after each wait. Once submitted, a timeout means an unknown outcome,
not proof of failure: retry sends the same payload to
`POST /api/continuity/save-transaction`. The old save endpoint remains available
for legacy callers; the new browser never falls back to it.

The server writes a preparation journal before the session file, then records
the receipt. The journal preserves the exact source content and pinned/asset
receipts, including the originally chosen filename. A restart or concurrent
retry verifies/completes that file, rather than allocating another. Reusing an
identity with different input is rejected. Exclusive creation prevents
overwriting another note; changed/missing acknowledged files or an archive
transaction fail closed without resurrecting history. Failure to write optional
CTX telemetry or the final journal update does not negate a written source.

Journals live in `logs/continuity-saves/<note-root-key>/`, outside model-visible
notes. These are recovery state, not expendable debug logs: retain them with
the corresponding history and do not sweep pending journals into routine log
cleanup. No additional request tracing or raw-model capture was enabled.

Acknowledgment applies only to the still-current stop attempt. An old response
may finish its own receipt but cannot select history or clear a newer session's
assets. Optional readback/map refresh run outside the save deadline and check
session/selection ownership before pinning or rendering. All pre-existing final
transcription timing, audio stop, recording and pane-snapshot behavior remains.

Regressions cover hung preparation, lost acknowledgments, late replies,
malformed receipts, old-server rejection, duplicate clicks, unchanged payloads,
fresh-process recovery, simultaneous processes, interrupted publication,
edited/deleted/archived sources, and original parent/eye-asset retention.
`sts_save_transaction_http.cjs`, invoked by the Python temporary-server test,
composes actual page save functions, HTTP routing and durable storage. Its
socket/device/formatting adapters are simulated; this is not a real-microphone
test or browser-crash recovery. A browser refresh still loses an unsubmitted
snapshot; keep a failed-save tab open and retry Disconnect.

Verification: 634 JavaScript tests and 990 Python tests pass, with one existing
Starlette/httpx deprecation warning. Isolated Edge page/audio checks pass. The
page server has been restarted for the new endpoint without restarting the
model or TTS; a disconnected page refresh loads the browser half of the change.

The September 22 08:01-08:04 paired live trial passed the ordinary resumed-thread
path: two complete save journals matched their source notes and original parents;
the second Connect loaded the first save and all prior ancestry. Both retained
the same successfully recalled eye asset. Scott confirmed continuity was good.
The first Disconnect canceled active TTS; the second followed drained speech.
Optional readback finished after socket close without affecting acknowledgment.
No duplicate note or failed tool/save was observed. The slow initial LLM replies
remain a separate observation, not a save regression; subsequent requests began
audio in 1.2-1.6 seconds. These short trials did not exercise sustained idle/B2,
fresh card-free comparison, or an actual live save retry. Evidence:
`logs/runs/20260922-0804-disconnect-continuity-acceptance/postmortem.md`.

The accepted baseline and paired-run notes are checkpointed as `d0dbebe`.
Connection ownership is proceeding in smaller steps below. Do not expand this
repair into unexpected-close, emergency Halt or page-unload semantics.

### Connection Identity Extraction: September 22

First part of ordered step 4 only: `realtime-connection.js` owns current socket,
generation and stopped state. Its `invalidate`, `adopt`, `requestStop`,
`isCurrent`, `isActive`, `isConnected` and `send` methods preserve the existing
decisions and wire serialization. Reset still advances the generation before
context preparation; adopting the new socket advances it again. Stop does not
erase identity: final transcription and current-socket cleanup still need it.
There is no new prompt, timer, network request, retry or automatic reconnect.

All production consumers read the owner directly. Existing test fixtures alias
the old names to that same module for compatibility, not to a second state
implementation. The page still owns preparation, save transactions, transition
coordination, socket event handling and resource cleanup. This extraction does
not yet serialize competing connection preparations or guarantee page-exit
recovery. Those are separate changes, not implied benefits of moving state.

Verification: all 641 JavaScript and 990 Python tests pass; the existing
Starlette/httpx deprecation warning remains. Seven new tests compare old/new
connection predicates and packet serialization, exercise stop/invalidate/adopt,
ignore old socket open/close/error callbacks through the real page functions,
and accept only the current socket's final transcription while stopped. The
HTTP/durable-save tests now compose the new owner too. Isolated Edge checks
confirm the real page loads it without legacy state globals or JavaScript
errors, with unchanged audio/tool-drain behavior. No live session was opened.

Activation is a disconnected page refresh, with no server/model restart.
The September 22 09:21-09:26 live pair passed ordinary resumed-thread acceptance.
The new script was served before connection. Run 2 loaded run 1 and its ancestry,
increasing history from eight sessions to nine. Both saves had complete journals
matching their source notes and retained eye hashes. The final Disconnect stopped
buffered speech after TTS generation had already completed; cancellation, durable
save and socket release were recorded. Scott reported very good continuity.
Interruption, tool follow-up and brief B2/idle activity also worked. A recovered
eye-inbox poll failure and a contained private-output warning are watch items,
not demonstrated lifecycle regressions. Initial LLM latency remains separate.
Evidence: `logs/runs/20260922-0926-connection-owner-acceptance/postmortem.md`.

This acceptance is checkpointed as `52a3dc9`. Concurrent preparation, page-exit
recovery and long unattended operation were not exercised by the live pair.
No runtime repair followed that PM; the subsequent transition work is below.

### Single Normal Transition: September 22

`realtime-connection.js` now owns one private operation token. Its
`runTransition(kind, operation, parent)` executes immediately when available,
retains ownership until the returned promise settles, and releases on either
success or failure. Only an explicit current parent token permits composition;
an expired token is rejected. Competing requests are not queued or automatically
retried. Socket identity and operation ownership have different lifetimes.

Connect/Empty, Previous, selected-session loading, Disconnect and session-map
execution enter through this owner. A session-map move still drains speech
before acquiring the token, allowing user speech/Disconnect to cancel a pending
move as before. Once executing, the same token covers save, destination loading,
arrival checking and mic restoration. Nested callers await their child work;
children cannot release the parent. The separate `continuitySaveBusy` flag is
gone. The existing backend-control button hold is distinct from operation
ownership; it is not a second normal-transition algorithm.

The page retains thin entry wrappers and UI rendering. Existing work moved to
`openRealtimeConnection`, `preparePreviousConnection`,
`prepareSelectedConnection`, `saveAndDisconnectRealtime` and
`completeSessionMapMove`. Connection setup/transport was checked byte-for-byte
against the accepted body, apart from the function name; the save body differs
only by its name and removal of the replaced busy flag. There is no new prompt,
context selection, timer, save payload, automatic image staging or idle policy.

Before repair, three deterministic fixtures reproduced competing Connect/Empty
preparations, Connect clearing the transcript during post-close snapshot saving,
and Disconnect running against half-loaded connection context. All now pass.
Fifteen new tests also cover six delayed setup stages, every normal entry point,
Previous/selected preparation and retry, UI unlock attempted during cleanup,
real save-then-selected-connect composition, expired tokens and exception release.
The prior synchronous popup-opening assertions still pass.

Verification: 656 JavaScript tests and 990 Python tests pass, including the real
HTTP/temporary-disk transaction tests. The existing Starlette/httpx deprecation
warning remains. Isolated Edge checks load the real page, hold an operation,
attempt competing entries and a premature UI unlock, then verify release.
Audio-clock/tool-drain and desktop/mobile checks still pass; no live model,
microphone or paid generation was invoked. Reproduction and suite receipts are
under `logs/maintenance/lifecycle-review/connection-transition-*`.

Live acceptance of the normal path passed September 22, 10:29-10:35, on `1f69646`.
A fresh page/module fetch preceded two resumed-thread runs. The second loaded
the first saved session plus its ancestry; both journals matched their sources
and four eye-asset hashes. Both backend sessions released within half a second
of cancellation. The second Disconnect stopped buffered speech well after
generation had completed. Scott reported great continuity. Search/render/staging,
retained-image recovery and microphone interruptions also ran; no runtime repair
was needed. B2 passes went stale on user activity, so sustained idle/advice is
not established by this pair. Startup remained about 24 seconds to first audio.
Evidence: `logs/runs/20260922-1035-transition-owner-acceptance/postmortem.md`.
Run 2's save is verified; its next live resume has not yet occurred. There is no
need to deliberately double-click or inject failed saves into real history;
the race fixtures cover those cases. No server/model restart is required.

Next boundary after that checkpoint was ordered step 5: unexpected closure, emergency backend controls,
explicit Reset To Pinned/Clear Latest and page exit. They do not all pass through
this owner yet. Do not claim cancellation of arbitrary pending backend work,
browser-crash recovery or a new unload guarantee. Review/test those semantics
separately before consolidating them.

## Acceptance And Gaps

### Unexpected-Close Groundwork

September 22 checkpoint: `2887027` preserves the accepted normal-transition owner
and 10:29-10:35 live notes. This preparation changes tests/documentation only.
It is safe to proceed narrowly, not to combine every remaining exit into one
operation with assumed identical semantics.

| Path | Present contract / boundary |
| --- | --- |
| Normal Disconnect | Stop, settle accepted input, commit a session, then close and finish device/snapshot cleanup under the operation owner. Preserve this accepted path. |
| Unexpected current-socket close | Stop cameras/schedulers, asynchronously stop mic/recording and snapshot panes. No continuity transaction. UI currently unlocks before that cleanup settles. |
| Old socket close/error | Identity guard rejects callbacks belonging to another socket/generation. Preserve this before any resource or UI effect. |
| Socket error without close | Reports the error; do not treat this notification alone as a save receipt or automatic reconnect request. |
| Reset To Pinned / Clear Latest | Explicit scratch-state discard; connected reset stops mic, closes, clears, reconnects and restores mic. Not a save action and not yet covered by normal transition ownership. |
| Halt / Restart / Unload | Explicit backend actions, with different ordering and asynchronous UI timers. Snapshotting is not a continuity save. Do not silently promote these into save-and-resume flows. |
| beforeunload / pagehide | Recording warning and best-effort log beacons, camera/popout/idle-art cleanup. Not a crash-safe save protocol. |

The isolated fixture registers callbacks through the actual `connect` function,
uses the production connection owner and UI-lock adapter, and can compose the
real audio owner/page wiring and real `stopMic`. Storage, UI, audio clock, media
devices and transport are simulated; no live server/model/hardware is contacted.

Four baseline reproductions at `2887027`:

1. Current socket close calls `clearAudioQueue`, which removes queued bytes but
   does not stop already scheduled Web Audio sources. A 30-second source remains
   active. Normal Disconnect already calls `stopPlaybackNow` before closure.
2. An audio setup promise already awaiting playback initialization can resolve
   after unexpected closure and still schedule a source. The close path changes
   neither the playback generation nor the stopped flag used by that owner.
3. An unexpected close leaves `stopped` false and enables Connect; subsequent
   connection preparation clears the unsaved hot transcript without a continuity
   transaction. Pane snapshots can retain evidence but do not establish a saved
   branch. No existing on-disk session is deleted in this reproduction.
4. The UI permits reconnect while old `stopMic` awaits `AudioContext.close()`.
   Assigning fresh mic resources before that promise resolves lets old teardown
   clear the new references. The fixture reproduces that interleaving, not a
   claim that the last live reconnect hit it.

Diagnostic: `logs/maintenance/lifecycle-review/unexpected-close-reproduce.cjs`.
It asserts the known unsafe baseline, not desired acceptance, and must be updated
or retired as each defect is fixed. Do not add these expectations to the passing
regression suite. Output and suite receipt are retained alongside it.

Twelve desired preservation checks in `tests/sts_socket_close.test.cjs` pass:
retained words/assets/parent without invented saves; scheduler/UI cleanup;
stale close/error rejection; error-versus-close distinction; failed opening;
intentional-close delegation; normal Disconnect composing the actual callback;
three recording states; visible async cleanup failures; and old mic tracks
stopped before awaiting context closure. All 668 JavaScript tests pass.
Python/production behavior is unchanged; the prior 990-test Python result is
not a new run. Browser-backed unexpected-close coverage is still needed.

Proceed in this order, each as a separate production change:

1. **Stop local playback on current-socket closure.** Reuse `stopPlaybackNow` so
   both scheduled sources and pending setup are invalidated. Keep the stale
   callback guard. Add desired regressions for reproductions 1/2 and a real,
   muted Web Audio check. Do not mix persistence or backend controls into this.
2. **Own unexpected cleanup and preserve unsaved work.** Capture resource identity
   across awaits, coordinate with an already-running normal Disconnect, and
   prevent a new Connect from discarding unsaved text or racing resource cleanup.
   Expose recovery through the existing Disconnect/save path, without automatic
   saving, reconnection, backend restarts or invented durable-success claims.
   Test close during opening, saving, failed save and repeated stop/retry. Keep
   intentional discard separate so resets are not accidentally made impossible.
3. **Extract the proven close orchestration.** Reuse existing connection, audio
   and tool owners rather than moving their state into a new general controller.
   Only after this passes, separately scope explicit resets, backend actions and
   page exit. Late backend-control timers and recorder completion still require
   their own ownership checks; this groundwork does not pronounce them safe.

For Scott, no new trial or refresh is needed now. After the first repair, repeat
normal Connect -> brief exchange -> Disconnect during speech -> Connect, to
ensure its established behavior stays intact. Induce unexpected loss only in
an isolated test, never by killing the backend during valuable unsaved dialogue.

#### First Repair: Socket-Close Audio

Implemented September 22 after preparation checkpoint `fdde834`. The close
callback replaces `clearAudioQueue()` with existing `stopPlaybackNow()`, after
the current-socket guard and existing scheduler/assistant-finish cleanup. The
audio owner already invalidates pending setup and stops scheduled sources;
no second cancellation algorithm, owner flag or timing adjustment is added.
The same call safely repeats after normal Disconnect has already stopped audio.
It also releases the mouth cue. Persistence, cleanup ownership, context and
conversation policy remain unchanged.

Six new regressions bring the socket-close suite to 18 and the full JavaScript
suite to 674 passing tests. All 990 Python tests also pass, with the existing
Starlette/httpx deprecation warning. Before repair, the running/suspended scheduled-audio
and pending-setup cases failed. Stale socket closure, repeated stop, fresh audio
after reconnect and error-without-close are covered without changing semantics.

The existing isolated Edge smoke now includes the actual page close callback
with real Web Audio. It verifies nonzero signal before closure and silence
afterward, both scheduled sources stopped, no source created by delayed setup,
and fresh audio unaffected by old sockets closing. Connection preparation,
transport and external effects are simulated; network writes/live sockets are
blocked, and no real mic/model/device is used. This is browser audio acceptance,
not a complete real-server unexpected-loss test. Existing audio-clock, tool-drain
and responsive-page checks pass as well.

Evidence: `logs/maintenance/lifecycle-review/close-audio-before.log`,
`close-audio-suite.log`, `close-audio-pytest.log`, `close-audio-browser.log`, and
`close-audio-reproduction.json`. The diagnostic now expects the two audio defects
to be absent; the unsaved-transcript and late-mic-cleanup reproductions still
hold and remain next. The original baseline reproduction JSON is preserved.
September 22, 12:28-12:37: the paired live trial on `94b3d3d` passed normal-path
regression acceptance. A fresh page fetch preceded Run 1; Run 2 connected without
another refresh. Both mid-speech Disconnects canceled active TTS and completed
their continuity saves. Run 2 loaded Run 1's save and directly recalled Priya
and Chamber Seven without tools. Four minutes of story playback in Run 1 drained
before the next B1 idle response, with B2 advice remaining private. Scott reports
both abrupt cutoffs worked correctly. Evidence:
`logs/runs/20260922-1237-socket-audio-acceptance/postmortem.md`.

This does not exercise a real unexpected network/server loss; isolated browser
tests supply that close-callback audio coverage. Do not combine the next ownership
repair or explicit-discard/backend/page-exit semantics into this audio repair.

#### Second Repair: Owned Close Cleanup

Implemented September 22 after the paired acceptance of `94b3d3d` above. No
new general controller: the existing realtime connection owner now provides
`close(socket, generation, cleanup)`, `closing`, and computed `busy`. It marks
the current connection stopped synchronously, publishes one cleanup promise,
rejects competing normal transitions until settlement, and deduplicates repeat
close callbacks. Old identities cannot acquire cleanup ownership or release a
newer close. A normal transition and transport closure can overlap without
either pretending to own the other's asynchronous work.

The former large inline callback is now `handleRealtimeClose` plus a page
resource adapter, `cleanupClosedRealtime`. The resource adapter calls the
existing `haltRealtimeActivity`; there is no longer a second scheduler/audio
stop list in the close listener. UI and device references stay in the page for
now; persistence remains with the already tested save transaction. The wrapper
releases controls only for the same connection after both owners settle.

Recovery contract:

- No automatic saving, reconnecting or backend restarting. Unsaved text, loaded
  notes, parent and eye assets remain available. Once cleanup settles, Disconnect
  is enabled to save/retry. Connect/Empty/Previous/selected loading cannot silently
  replace the stopped unsaved transcript. A failed opening with no dialogue can
  be retried without manufacturing a session.
- Normal Disconnect still owns its post-save cleanup. Delegation is tied to the
  originating socket/generation, not merely the five-second exit grace flag.
  Transport loss before a durable save receipt performs device cleanup even if
  that pending save ultimately fails. Failed-save retry stays locked while any
  loss cleanup remains outstanding.
- `stopMic` detaches old resource references and updates stopped UI before its
  context-close await. Its completion cannot null new resources or reset new UI.
  `startMic` verifies connection and stream identity after permission and device
  discovery; stale setup stops only its own returned stream. Audio callbacks also
  reject replaced sessions. Audio constraints/format/timing are unchanged.

Verification: all 692 JavaScript and 990 Python tests pass (one existing
Starlette/httpx deprecation warning). The initial eight added regressions failed
before repair. Coverage also includes loss during a successful/failed save,
loss immediately after failed saving, delayed recording finalization, every
history-replacement route, stale mic setup, normal mic streaming, owner failure
release and stale completion. The four baseline fault-injection outcomes are
now all false; the diagnostic was updated while old baseline receipts remain.

The isolated Edge suite still verifies real Web Audio stop/drain, fresh audio
after stale closure, and desktop/mobile page loading. It additionally uses a
disposable localhost WebSocket server and destroys TCP without a close frame.
The actual browser reports code 1006 and exercises the actual close callback,
UI locks, mic-stop orchestration, retained dialogue, failed-save retry and a
second connection. Model work, mic resources and save receipt are simulated;
no live backend, hardware or persistence writes occur. This is stronger than
manually invoking a close callback, but not a full real-device outage trial.

Evidence under `logs/maintenance/lifecycle-review/`: `close-owner-suite.log`,
`close-owner-pytest.log`, `close-owner-browser.log`, `close-owner-reproduction.json`.
Browser results/screenshots are also in `logs/maintenance/audio-owner-browser/`.

September 22, 13:17-13:26: live normal-path acceptance passed. Fresh page/module
GETs preceded Run 1; Run 2 used the same page without refreshing. Run 1 canceled
active TTS, while Run 2 stopped after playback drained. Both continuity saves
are complete and exactly match their frozen drafts. The second run loaded the
first plus its ancestry, restarted the microphone and recalled the Reachy
exchange without tools. An external embodiment fetch failed and the multi-voice
input confused speaker identity; these are separate from lifecycle acceptance.
Evidence: `logs/runs/20260922-1326-close-owner-acceptance/postmortem.md`.

No live outage was induced; the disposable-socket browser test supplies that
coverage. Run 2's next live resume remains untested. No server/model restart or
additional repair follows from this PM. Prompts, tool choice, context assembly,
idle policy, speech length and model settings remain unchanged.

The next step after this acceptance is recorded below. This work does not
provide browser-crash persistence, cancel arbitrary backend jobs, or settle
ownership of every backend-control timer or recorder timeout.

### Unused Explicit Resets Retired

September 22 checkpoint: `c9d55b0` preserves the accepted close owner and both
paired acceptance PM references. Scott confirmed he does not use Save Latest,
Clear Latest or Reset To Pinned. Remove that unused branch of the lifecycle
instead of migrating it into the owner: panel, filename/reset-after-save inputs,
handlers, button updater and private save/reset helpers. The only consumer of
`waitForRealtimeOpen`, `timestampForFilename` and `writeOperatorNoteFile` was that
branch; those helpers are removed too. Shared formatting, conversation reset,
`waitForRealtimeClose`, transactional Disconnect saving and tool note writing
remain. The memory-loading checkbox moves unchanged to Pinned Notes.

`sts_explicit_exit.test.cjs` adds ten isolated characterization tests for the
retained Halt/Restart/Unload and page-exit paths, plus two removal/UI assertions.
It exercises actual page functions and the current close owner against fake
transport, backend endpoints, mic/recording resources and timers. These are
contract checks, not proof that arbitrary concurrent backend actions are safe.
No production backend/page-exit logic changes in this step. Pagehide remains
best-effort cleanup/log beacons; none of these controls becomes a continuity save.

All 704 JavaScript and 990 Python tests pass (one existing Starlette/httpx
deprecation warning). Isolated Edge checks retain real-audio and TCP-loss
coverage and verify the remaining memory checkbox at desktop/mobile sizes.
Receipts: `logs/maintenance/lifecycle-review/unused-thread-controls-*.log`;
screenshots under `logs/maintenance/audio-owner-browser/`. Normal live regression
acceptance remains pending: refresh disconnected, resume, converse, Disconnect,
and reconnect. No model restart or special destructive action is needed.

September 22, 17:08-17:16 follow-up: two normal runs saved exactly against their
journals; the second recalled the unfinished game directly from history. All
three saved eye assets matched their hashes. Fresh-page activation of the UI
removal is not independently established by these artifacts. Two completed
images stayed out of the preview after intervening user input, then reached the
eye by exact retrieval; the third displayed normally. This is the older preview
freshness contract, separate from session cleanup. Do not turn it into forced eye
staging or prescribed dialogue. PM: `logs/runs/20260922-1716-headline-game-preview/postmortem.md`.

Next: reproduce backend-control timer/cleanup races offline before migrating
their ownership. Preserve explicit backend intent and emergency Halt access;
do not casually route it behind a potentially stuck normal transition. Keep page
exit and browser-crash persistence separate. Prompts, idle/B2 opportunities,
context assembly, tool choice, voice and model settings are unchanged.

### Thumbnail Ownership: September 22

For the preview repair, see
[Voice Does Not Cancel Thumbnails](engineering-status.md#voice-does-not-cancel-thumbnails).
The 17:08-17:16 PM led to an explicitly requested contract refinement: a completed
model-requested picture may update its still-current thumbnail after voice
interrupts its turn, but cannot resume speech or stage the eye automatically.
Session/request identity and manual clear/replacement still govern preview
ownership. Eye and continuation guards remain turn-scoped. Four previously
failing assertions now pass; all 712 JavaScript and 990 Python tests and isolated
Edge checks pass (one existing Starlette/httpx warning). This is separate from
the backend-control refactor. The historical PM records behavior before repair.

Live foreground acceptance passed at 18:00-18:06: three interrupted renders
kept their thumbnails, three model-chosen eye transfers succeeded, and a fourth
uninterrupted render displayed normally. The new log entries confirm activation.
Save source/journal and all three eye hashes match. One overlapping model request
was rejected without another render. Scott accepted the experience. PM:
`logs/runs/20260922-1806-thumbnail-acceptance/postmortem.md`.

That run also exposed duplicate transcript-settle waits: 4,576ms in the
Disconnect wrapper and 4,555ms in the snapshot function for the same unfinished
input. The final "Good work" remained partial and was not a saved accepted turn;
the completed journal correctly ends with the preceding accepted conversation.
This is a small follow-up ownership issue, not a failed transaction. Characterize
late-final/retry/direct-snapshot behavior before consolidating the wait budget.
Do not silently accept partial STT or remove the final-transcript grace period.

### Live Acceptance Progress: September 21

The 21:17-21:23 resumed-thread run exercised microphone interruption and
disconnect during speech. The browser recorded playback barge-in, the backend
canceled the old response, and Eric accepted the changed subject. On disconnect,
TTS canceled, the session and two eye assets saved, and the socket closed. Scott
independently confirmed that speech fully ceased. He reports a subsequent run
underway; that run still needs its own delivery check.

The same day's focused audio/lifecycle suite passed all 27 tests, and the real
Edge audio-clock check passed again without connecting to Eric. The earlier
19:41-20:20 run supplied a 25-minute idle interval and a 3.591-second logged
return-to-speech result. These are partial acceptance receipts, not a complete
release-gate pass: sustained long speech, fresh card-free comparison, and the
remaining transitions below are not all established by these two runs.

A separate image-ordering miss occurred: one foreground render was described
before eye staging; the second followed generate/stage/describe correctly. Do
not label every image path gated or bundle a behavioral repair into extraction.
Private PM evidence is retained under
`logs/runs/20260921-2124-audio-acceptance/` and
`logs/runs/20260921-2020-guest-introduction-idle/`.

The subsequent 21:24-21:36 resumed run exercised sustained speech: the
Consequence Postponement Engine lecture generated 230.43 seconds of audio.
Text finished at 21:27:40 and backend response completion at 21:28:26, but the
browser did not return to idle until 21:31:17. No new B1 response or B2 spoken
aside started during the lecture; Scott reported an excellent run. His next
turn received first speech output in 2.479 seconds. This closes the sustained
long-speech check for the resumed-thread path, not all remaining coverage.
The foreground describe-before-eye issue repeated on the first new image and
recovered after a reminder; keep it separate from audio ownership acceptance.
Evidence: `logs/runs/20260921-2136-consequence-engine-long-speech/`.

**Operator disposition, September 21:** occasionally forgetting to stage a
picture before discussing it is acceptable and easily corrected in conversation.
It is not a repair item or an extraction acceptance blocker. Do not add a gate,
prompt rule or automatic choreography to enforce this ordering. Actual failures
to retrieve or stage a requested image remain execution issues; this disposition
concerns the model's choice of when to do it, not broken tools.

The choice itself is also a useful continuity signal for Scott: voluntarily
staging before describing can demonstrate an instruction sustained across
sessions; returning to prompt-description can suggest that thread has weakened.
It is a behavioral observation, not proof that context was omitted. Automatically
staging every creation would conceal this signal. Preserve the model's choice
unless the operator explicitly requests automatic staging.

### Final-Transcript Wait Consolidated: September 22

Accepted baseline `cd3a281` precedes this change. The 18:00-18:06 live run paid
the same final-STT wait twice, without receiving a final result. Snapshot
preparation now owns that wait and decides whether an empty connection should
skip its note. Disconnect calls preparation even when no lines have arrived yet;
it no longer maintains its own pre-save wait or premature line-count decision.
Direct snapshots still reject empty input unless explicitly allowed to skip.
Frozen save retries bypass preparation; the payload, request ID and parent are
unchanged. The existing generation/attempt checks reject expired preparation.

Seven new tests cover unfinished drafts, late final speech, empty connections,
direct snapshots, frozen retries, expiration and session-map departure. Three
regression assertions failed before repair. All 719 JavaScript and 990 Python
tests and the isolated Edge suite pass. No STT partial is promoted and no timing constant,
prompt, idle policy or backend-control path is changed. Live acceptance is next:
refresh disconnected, resume, talk, Disconnect, then check continuity on Connect.
Evidence: `logs/maintenance/lifecycle-review/transcript-settle-*.log`.

The 19:04-19:09 normal-path trial saved the final accepted exchange and closed
cleanly; journal/disk equality and 21 prior-pin receipts pass. Final STT had
already settled 18 seconds before Disconnect, so neither the pending-draft
edge nor fresh-build activation is established by its zero-wait result. That
edge remains covered offline; no contrived repeat or behavior change is needed.
PM: `logs/runs/20260922-1909-genius-recall-and-save/postmortem.md`.

### Remaining Coverage

- Save HTTP/disk failure recovery is now covered above; real browser/socket/
  device teardown, full selected-session transitions and live acceptance remain.
- B2 advisory revision/freshness, private-to-public delivery and idle arbitration
  in the composed replay, including normal and accelerated idle.
- Page unload, real socket closure and recording teardown in a browser-backed
  transition suite. Suspended Web Audio is now checked in Edge, but this does
  not replace real conversation and device acceptance.
- Clearer retained-artifact preview behavior; current exact retrieval into the
  eye is functional but can leave the Imagined Image preview empty.

The first replay batch found no new production defect. It does not establish that
these untested boundaries are sound. The subsequent audio extraction changes
ownership, not the intended playback behavior, prompts, cooldowns, permissions,
context assembly or model settings.

## Release Gate

Keep each extraction in a separate commit. Compare a fresh card-free session and
a rich resumed thread using the same model/settings: long answers, search/draw/
show, interruption, idle/B2 initiative and return from an absence. Revert only
the extraction if it changes delivery or liveliness unexpectedly; do not disguise
a lifecycle regression with a new behavioral prompt or silence rule.

See [Engineering Status](engineering-status.md) and the broader
[Stabilization Plan](stabilization-plan-2026-09-19.md) for work outside this boundary.

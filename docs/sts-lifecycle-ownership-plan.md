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
| Connection identity | `activeRealtimeSession`, `send`, `realtimeSessionGeneration`, `ws`, `realtimeStopRequested` | An awaited operation retains an old socket or generation. A stop is not the same as a new connection. |
| Stop, save, reconnect | `quiesceRealtimeForSave`, `haltRealtimeActivity`, `disconnectRealtime`, `resetSessionContextForConnection`, `clearHotConversationState` | Cleanup is spread across functions; final transcription must survive stop, but new speech and effects must not. Failed saving must block destructive reset. |
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
audio/tool baseline and comparison notes. The review below adds tests and a work
plan only. No production lifecycle, prompt, timing or model change has shipped.

### Findings Before Extraction

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
`logs/maintenance/lifecycle-review/reproduce.cjs`. They assert the current defects
for diagnosis, not the intended contract, and are separate from the passing suite.
These are injected failures, not claims that the recent live run experienced them.

### Ordered Work

1. **Close the two small flag defects separately.** Give intentional cleanup an
   operation identity so an old release cannot end a new cleanup. Route Start
   Eric through the ordinary guarded fresh-context connection path without
   clearing the successful-save state prematurely. Test startup failure/retry as
   well as success. Do not simultaneously alter browser audio or tool owners.
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
   transition. Cover Connect, Empty, Previous, selected/map jumps, Start Eric,
   Disconnect and Save + Halt. Retain thin page adapters for UI, context assembly,
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
exchange and the single new branch in the map. Test Save + Halt / Start Eric once
separately. Use a marker such as "the kettle is named Tuesday" to distinguish
history delivery from a fluent guess, while verifying the saved file directly.
No deliberate speech, sentence-count, idle-initiative or tool-choice change is an
acceptable side effect of this work. Keep fresh card-free acceptance open too.

## Acceptance And Gaps

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

### Remaining Coverage

- Full stop/save/reconnect and failed-save retry replay with the actual durable
  save pipeline, including final transcription and session-map transitions.
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

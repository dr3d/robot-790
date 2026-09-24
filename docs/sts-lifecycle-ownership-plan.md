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

## Current Agenda

Checkpoint `5bcccbe` contains the file-write receipt path, waiting foreground
image admission, numeric cache diagnostics and updated acceptance notes.
The preceding full verification passed 817 JavaScript / 1,005 Python tests and
isolated Edge checks; the September 23 pre-commit recheck passed 60 focused
JavaScript / 156 Python tests. Ordinary Hotel Note continuation passed; its
saved artifacts do not independently prove B2 receipt-payload delivery, and no
image overlap occurred. The large-context cache refill remains separate and open.

The bounded B2 evidence-packet extraction below is implemented after `8f5825f`,
with empty/resumed/rich-history and paired note/reconnect acceptance recorded
below. This checkpoint includes that extraction, tests and acceptance notes.
This is not private-advice scheduling or a universal scheduler.
Deferred body-cue ownership was considered
but is Reachy-only today; leave it parked with the unused Halt/Unload work.

The extraction is committed as `a4c05b4`. Subsequent diagnostics maintenance
restores canonical live-log routing for amber TTS telemetry and narrows the
empty B2 export fallback to actual B2 event prefixes. The 10:12-10:19 resumed
trial confirms both repairs, continuity and saving. Its S3 face-control receipt
delays remain a separate investigation, not justification for behavioral tuning.
See `logs/runs/20260923-1019-s3-face/postmortem.md`.

### Implemented Step: B2 Request Boundary

Implemented after `424b933`, with ordinary live acceptance below. The work started
with characterization of `requestBrain2Mull`, then extracted only the request
payload/HTTP completion boundary behind explicit page adapters. The existing
evidence assembler is already independent; the next risk is accepting a result
after its session, user turn or note guidance has changed.

1. Freeze complete outgoing payloads for normal, manual and headline requests,
   including optional art/body inputs. Preserve ordering and omitted fields.
2. Test deferred responses across socket replacement, generation changes, new
   user input/speech, changed setup cards and note guidance, HTTP errors and
   malformed JSON. Characterize existing prompt-ledger side effects and exactly
   when `brain2LastEvidence` updates, including stale/error precedence.
3. Extract only after those tests pass against the current page. Leave
   `triggerBrain2Mull` scheduling, backoff, advisory candidate selection, speech
   delivery and headline/art dispatch where they are. No new abort policy,
   cooldowns, limits, language rules or prompt edits in this step.
4. Reuse the isolated browser request-capture test, run the full JS suite and
   focused serializer checks, then one ordinary resume/brief idle/Disconnect.
   Offline deferred-response tests must cover the late-result race; the operator
   need not time a disconnect to manufacture it.

`brain2-request.js` now builds the exact outgoing payload and handles response
parsing, freshness checks and accepted-evidence publication through explicit
page adapters. It has no persistent state, timers or scheduler ownership.
The page reads runtime inputs and supplies fetch, current-state and logging
adapters. `triggerBrain2Mull` and all prompts remain unchanged.

Twenty-six complete baseline cases were captured before editing production code,
then independently reproduced from committed `424b933`. Tests compare serialized
HTTP bodies, returned values, accepted evidence identity and diagnostic order.
Coverage includes normal/manual/headline/empty-headline requests, optional art
and body inputs, Unicode, socket/generation/evidence changes, changed note
guidance, new speech, updated assistant output, errors and delayed JSON parsing.
Preserved details include stale HTTP results winning over error handling,
network rejections remaining rejections, and current-context prompt diagnostics
being recorded before the newer-user-input check. A stopped flag alone is not
a new request-level guard: the existing outer trigger still owns that check.

Verification: 864 JavaScript tests, 147 focused page-server Python tests and the
isolated Edge suite pass. The browser checks actual page request capture and a
late old-session error arriving after a newer-session result has been accepted;
the old result is stale and cannot overwrite accepted evidence. No live model,
hardware or external API request is used by those browser fixtures. Logs:
`logs/maintenance/lifecycle-review/b2-request-{suite,python,browser}.log`.

Live acceptance: refresh disconnected, resume the current thread, converse,
leave a brief idle interval, interrupt normally and Disconnect. BrowserFace
keeps the separately observed S3 transport delay out of this comparison.
No special timing, new notes, server restart or settings change is needed.
Live acceptance, 10:37-10:49 September 23: nine B2 requests, a selected headline
used by B1, six idle responses after the final human turn, optional B2 monitor
speech and real interruption all functioned. Both note tools succeeded; the
selected unpin is absent from the complete saved pin list. Nineteen pins and
two screenshots verify; final context 73.27%. No B2/tool errors. The initial
34.009s startup, two private-output suppression warnings and repeated/mistaken
B2 advice remain observations, not a declared cache fix. No post-idle returning
human probe occurred. PM: `logs/runs/20260923-1049-pinned-titles/postmortem.md`.
This supports scoped acceptance of the extraction; the subsequent pinned-title
UI/tool-result improvement is separate. Stop and rescope if subsequent work
requires moving the scheduler or changing stale semantics.

Follow-up acceptance, 11:07-11:16 September 23: an earlier ferry branch resumed
with seven pins; retained-image recall, four requested draw/stage operations,
idle continuation, headline advice and a movie-search topic change succeeded.
B2 made ten requests with nine unclipped advice deliveries. Human return to
first speech was 2.736s; initial startup was still 21.424s. A fifth idle image
finished after the returning user spoke and was retained on disk without
replacing the eye. Disconnect during reported playback halted the face/audio
path and released the backend pipeline; seven pin and six eye-asset receipts
verify, and preparation is ready. Context grew 45.87% to 61.26%. No B2/tool
errors. Two B2 staging reminders aged while their requests were in flight;
no duplicate staging followed. No pin-list/unpin call exercised friendly titles
in this run. No runtime or prompt changes resulted from the PM:
`logs/runs/20260923-1116-ferry-branch/postmortem.md`.

Acceptance decision: Scott accepts the roughly 21-second initial response on
this roughly half-window branch. Do not optimize that startup cost as part of
the refactor. Preserve initiative, continuity and responsive warm turns;
unexpected post-idle cache rebuilds remain a distinct investigation.

### Implemented Step: Response Completion Ownership

Implemented after `84ff44e`, following accepted B2 checkpoint `b622597` and a
separate archive-documentation commit. `response-completion.js` owns the active
model-response flag and the four utterance-finish fields. The page no longer
mirrors them. It routes validated audio/model completion events to the owner;
the owner waits for both model work and the audio owner's queue to settle before
marking utterance completion. Actual waveform playback stays in `audio-playback.js`.

The completion dispatcher preserves cancellation handling, tool continuation,
routine-specific completion, image-protection release, face-idle scheduling and
diagnostic order via explicit page adapters. The page retains socket/generation
validation, transcript handling, lane-origin flags and policy-specific effects.
This is not a wholesale event-handler or scheduler rewrite. The active-state
read/write substitutions in other page functions are mechanical, not new guards.

Preserved details: initial 100ms completion check, 150ms busy recheck, idle
provenance ORed across rearming, no utterance-duration ceiling, and the existing
distinction between clearing the timer and clearing pending state. Error/stop
paths clear the same state at the same points. Model completion with outstanding
tools is still owned by the tool-follow-up path. No prompts, greetings, response
lengths, idle pacing, cache settings or permission policy changed.

Before production edits, 20 cases were frozen from committed `84ff44e`. They
compare complete resulting state and ordered effects, not only callback counts:
text/audio completion, delayed audio, repeated settlement, new model work before
drain, idle origin, routine origins, pending tools, image protection, cancelled
navigation, missing response IDs, bounded suppression history, errors, stopped
and replaced sockets, rejected flushes, timer-only clear and duplicate done.
Independent replay from Git reproduces the fixture. Existing lifecycle/tool
replays, attention pacing, B2 and context-order suites continue to pass with
legacy test inputs aliased to the real owner, not parallel test state.

All 918 JavaScript tests, 147 page-server tests and isolated Edge checks pass.
The browser uses real Web Audio through the actual page adapters, verifies that
model completion leaves pending state while queued audio drains, then emits one
finish. A subsequent stop clears pending work/audio; an old socket's done event
cannot release new work. Live sockets and mutating/external requests are blocked,
including exit beacons. Logs:
`logs/maintenance/lifecycle-review/response-completion-{suite,python,browser}.log`.

Size checkpoint: main HTML 22,181 -> 22,156 lines; 1,001,458 -> 1,000,491 bytes.
Net page reduction 25 lines / 967 bytes; new module 68 lines / 2,428 bytes.
Total production bytes grow 1,461. State ownership is improved; overall source
size is not reduced, and the giant HTML remains substantial. Keep reporting
this honestly rather than counting moved lines as net deletion.

Paired live acceptance September 23, 18:36-18:45 passes. Two successful draw/
stage/explain sequences, ordinary idle development, actual B1 mid-speech stop,
specific reconnect continuity and B2 monitor cancellation all behaved correctly.
Tool continuation waited for playback, including a real HTTP 429 image-credit
failure. The second stop was B2 monitor speech after B1 drained, not a second
B1 interruption. Both journals and every pinned-note/eye-asset receipt verify;
derivatives ready in about 4-5s. No room-audio recording, so acoustic claims
remain limited to the operator report and playback callbacks. PM/evidence:
`logs/runs/20260923-1845-completion-pair/postmortem.md`.
Accepted for checkpoint; image lifecycle is the next larger extraction candidate,
with scheduling policy left until its component owners are better separated.

### Implemented Step: B2 Private Advisory Ownership

Implemented after `ea5132f`; automated and exercised live acceptance pass.
`brain2-advisories.js` owns acceptance and storage of private notes, questions
and revisions, note-guidance filtering, snapshot/protocol formatting, per-socket
delivery deduplication, and loop-evidence counts. Five page globals move into
the owner; diagnostics, continuity exports and status UI read its lists directly.
No duplicated production state remains in the page.

Existing behavior is intentionally preserved: 12 retained candidates per list,
four eligible items before snapshot selection, latest eligible note after user
activity, persistent question/revision candidates, existing steering freshness,
legacy loop-marker handling, and exact private-packet text. This step neither
adds limits nor changes their values. First-contact candidate clearing preserves
delivery identity; full context reset clears it. Private work still survives
busy public audio, and accepted advice arriving during speech uses the existing
turn-boundary delivery. No scheduling, personality or model changes.

Characterization was captured from committed `ea5132f` before moving production
code. Twenty-three checkpoints compare complete state, output text, packets and
side-effect order for empty/current/stale guidance, all three candidate types,
bounded retention, loop evidence, busy delivery, failed sends, deduplication,
socket changes and resets. Existing asynchronous trigger tests still compare
36 baseline traces, including stale replies after reconnect or device waits.
Formatting hashes from the previous checkpoint remain equal after reversing
adapter names. Additional instance/reset tests use the real production owner.

All 915 JavaScript tests and 147 page-server Python tests pass. Isolated Edge
loads the real page and verifies delivery during user speech, no public chat
insertion, duplicate suppression, note freshness, actual hot-context reset and
delivery after reset. Live sockets, external/mutating HTTP and exit beacons
are isolated; these tests do not converse with Eric or change saved sessions.

Size checkpoint: HTML 22,262 -> 22,181 lines, 1,007,171 -> 1,001,458 LF-normalized
bytes. Net -81 lines / -5,713 bytes; new owner 158 lines / 8,080 bytes. The
total production code grows by 2,367 bytes, so this is structural progress and
a modest page reduction, not overall code deletion. Future checkpoints should
continue reporting both ownership and net page reduction. Larger completion
and image-lifecycle responsibilities remain ahead; do not broaden this step
into a scheduler rewrite merely to obtain a larger deletion count.

Operator trial: refresh while disconnected; resume normally, do one search or
picture task, leave a few minutes for B2/idle, return, then disconnect (during
speech is fine). Reconnect once without refreshing, exchange a few words and
disconnect. Check that private advice still helps, stale advice does not leak,
and continuity remains intact. Prompts and idle initiative should feel unchanged.
Logs: `logs/maintenance/lifecycle-review/b2-advisories-{suite,python,browser}.log`.
Paired trial, September 23 17:56-18:04: requested draw/stage, B2 advice, headline
delivery, brief idle, human return and both speech cutoffs pass. Reconnect without
refresh loads the correct parent; both saves prepare successfully, 21 pin
references and one image verify. A late B2 result is discarded during the second
stop while active TTS is cancelled. The initial idle-led opening is a new request
over saved history, not old speech crossing the session boundary. Startup cost
and two preexisting-class private-output suppression warnings remain observations,
not reasons to alter greetings or cadence. Ready for checkpoint. Evidence:
`logs/runs/20260923-1804-advisory-reconnect/postmortem.md`.
Next structural candidate after acceptance: response/turn-completion ownership,
starting with characterization of model completion versus audible completion.

### Implemented Step: B2 In-Flight Ownership

Implemented after `07c7916`; exercised live paths accepted. `brain2-work.js` owns the
current request token and busy/headline indicators. Admission still uses the
page's existing `brain2BlockedReason`; the owner also refuses a second start
while occupied. Completion must match both the actual request token and its
captured socket/generation. Reset invalidates the token. Page consumers read
the owner directly; no mirrored global busy flags remain.

The scope stays small: scheduling, cooldown/backoff calculations, success/error
counters, headline/art dispatch, advice queues and public delivery remain in
the page. Payload/context construction stays in the preceding modules. No
prompts, cadence, permissions, limits or model settings changed. This owner
does not abort an HTTP request or retract an already-submitted device action.

One explicit cleanup correction: `haltRealtimeActivity` previously cleared
general B2 busy state but could leave headline-busy set. Stop now clears both
and an invalidated request's finally block cannot refresh controls/reschedule
work. Context-only clearing still clears headline indication without claiming
the outstanding request finished; normal connection preparation resets both.

Verification: 36 complete event/state traces were frozen from committed
`07c7916` before production changes and reproduced independently afterward.
They match the extracted implementation for normal/manual/headline work,
blocked admissions, errors/backoff, quiet/held/deferred/revision/advice/art/body
results, user activity during headlines, and reconnect while request/body/mouth
work is pending. Eight unchanged scheduling/context/dispatch functions have
baseline hashes. Focused owner/trigger tests additionally cover duplicate
completion, same-connection token replacement, two genuinely pending requests
across reconnect, and the actual halt adapter clearing both indicators.

All 911 JavaScript tests and 147 page-server Python tests pass. Isolated Edge
checks the real page with deferred mocked B2 HTTP replies: duplicate starts
remain blocked, an old error cannot release newer work, current advice arrives,
buttons release on current completion, and stop invalidates headline occupancy.
The browser test blocks live sockets and external/mutating HTTP and does not
call the live model or devices. Logs are
`logs/maintenance/lifecycle-review/b2-work-{before,suite,python,browser}.log`.

Live trial September 23, 12:38-12:53: module GET confirmed before connection;
resume, normal interaction, idle/B2 headline work, search, two generated/staged
pictures, return and disconnect during speech exercised successfully. B2 made
17 requests, delivered 11 untruncated nonempty notes and rejected two stale
results. No B2/tool errors. Return was 3.859s; save plus eight pins/eight assets
verified. A pending-B2 reconnect race was not exercised live; tests cover it.
The independent post-save summary validator rejected a System-turn citation;
original continuity is intact, derivative failure remains open. Recall also
needed operator correction, so acceptance is scoped to ownership, not perfect
memory. Evidence: `logs/runs/20260923-1253-hatch-shell/postmortem.md`.
Next candidate after acceptance is private B2 advisory ownership, starting with
characterization of freshness/revision/delivery and preserving current policy.

## Implemented Step: B2 Evidence Packet

September 23: `brain2-evidence.js` now assembles the packet from explicit inputs;
`brain2EvidenceSnapshot()` in `web/sts/index.html` remains the runtime adapter.
It reads transcript metadata, session identity, runtime/tool receipts, note
guidance and previous-snapshot state. This packet determines both
what B2 sees and whether the scheduler considers evidence changed. Making that
contract explicit is more useful than moving unrelated page helpers wholesale.
The bounded implementation follows this contract:

1. Characterize the existing packet with fixed-clock, literal expected fixtures
   before extracting it. Cover empty/new/resumed sessions, amended human input,
   assistant output IDs, previous-sample counters, normal and accelerated idle,
   image/write/search receipts, stale-session writes, card-free use and changed
   note guidance. Preserve JSON field ordering and fingerprint strings, not just
   equivalent-looking text. Existing transcript-role parsing stays unchanged.
2. Add a small `brain2-evidence.js` module with explicit input and return values.
   The page remains the adapter for DOM/runtime readings, note routing and the
   clock. The module assembles the packet; it must not fetch, schedule, send,
   speak, alter notes, or decide what advice should reach B1. Previous-evidence
   ownership and its update-on-accepted-response rule remain where they are.
3. Retain every current window, field, guidance rule and freshness condition.
   Time alone must not change the fingerprint; real receipt changes must.
   No new truncation, semantic filtering, biography rules, idle cooldowns or
   prompts. This step preserves policy rather than revisiting it.
4. Exercise the real page request path in the isolated browser: record a fake
   successful write, capture the outgoing B2 request, and assert that its compact
   receipt is included without the document body. Exercise the server serializer
   too. Keep this distinguished from proof of an actual live model request.
   Do not add broad prompt logging; a live prompt-ledger export can close that
   separate verification gap when available.
5. Run focused packet/freshness tests, the whole JavaScript suite, the existing
   Python evidence-serializer checks and the beacon-isolated browser suite.
   Compare old/new complete packets and prove unchanged page behavior before
   a normal live trial. No live model calls or hardware commands in tests.

Stop and rescope if this needs a scheduler rewrite, B1 context changes, altered
advisory selection, new language interpretation or changed runtime semantics.
Keep the implementation in its own reversible commit after live acceptance.

Verification: captured 14 complete serialized baseline packets from `8f5825f`
before editing production code; they still match byte-for-byte after extraction,
including fingerprints and field order. A literal empty-packet assertion, frozen
input checks and Unicode preservation supplement those fixtures. All 834
JavaScript tests and 147 focused page-server Python tests pass. The isolated Edge
suite captures the actual page-generated B2 HTTP payload after a fake write:
the compact success receipt is present, the note body is absent, internal
fingerprint/user-key fields stay off wire, and accepted evidence updates normally.
The Python serializer consumes the same baseline fixtures and preserves the write
receipt. These are automated boundary checks, not retroactive proof of the prior
live run's model input. The initial check ran focused Python tests; the final
checkpoint reran all 1,006 Python and 834 JavaScript tests, the isolated Edge
suite and focused Ruff successfully. Python retains its existing dependency
deprecation warning. Initial logs:
`logs/maintenance/lifecycle-review/b2-evidence-{suite,python,browser}.log`.
Final logs: `logs/maintenance/lifecycle-review/b2-evidence-checkpoint-{suite,python,browser}.log`.

Live acceptance after implementation: refresh while disconnected, Connect to
the current thread, ask Eric to save a short note about the conversation, then
talk normally, leave a short idle gap and return. Disconnect as usual. Check
continuity, receipt visibility, B2 initiative and normal speech handoffs; no
contrived image collision, long lecture or destructive control test is needed.
The existing page server serves the new module; a browser refresh while
disconnected is sufficient. No model/server restart, settings change, extra
instrumentation or hardware activation is needed. The following live trials
were performed on one unchanged build before this checkpoint; `8f5825f` is the
published predecessor on master.

Live acceptance, 07:44-07:51 September 23: the module was fetched before Connect,
history loaded, all six tool calls succeeded, and the real note, three pinned
files and one eye asset verify against receipts. B2 completed ten requests
without errors/clipping; stale work was rejected on human return. Return speech
took 2.264s / 2.206s. Five idle responses plus a tool follow-up kept the conversation
active, although the same visual-provenance caveat recurred. No timing or prompt
adjustment was made to conceal that content tendency. Ordinary extraction
acceptance passes; live receipt-payload capture and natural image overlap remain
separate checks. PM: `logs/runs/20260923-0751-scotts-day/postmortem.md`.

Expanded testing requested by Scott: the 08:13-08:25 resumed follow-up again
passes tools and exact saving, but shows persistent thematic repetition and
confusion about three operator uploads versus a generated image. The last
museum drop was staged/saved yet not usefully discussed. B2's proposed correction
also miscounted provenance. These are observations, not a demonstrated change
from the byte-equivalent packet extraction. No post-idle spoken return occurred.
The extraction remained uncommitted and unchanged for the Connect Empty comparison.
PM: `logs/runs/20260923-0825-photo-comparison/postmortem.md`.

Expanded comparison, 08:29-08:38: genuine Connect Empty, no parent/history,
successful image generation/staging, real playback interruption, six idle starts
and a 2.819s human return after B2 fetched a headline that B1 used. Verified save
and asset hashes pass; context ended at 20.39%. The prior photo-caveat orbit did
not recur; B2 nevertheless repeated an identical question three times. This
extends mechanical acceptance without establishing a content regression or
proving the separate high-context cache issue fixed. No note-write or image
collision probe occurred. A distinct pre-existing 96-character mouth-text cap
sent a mid-word fragment into the optional spoken monitor; keep any repair
separate from this evidence extraction and from private-advice behavior.
No tuning or commit in this PM. Evidence:
`logs/runs/20260923-0838-floating-teenagers/postmortem.md`.

Rich-history acceptance, 08:46-09:06: a branch from September 22 12:35 loaded
thirteen ancestor sessions plus profile/core (fifteen notes total). During 16m15s
without human speech, B2 and B1 developed the old story, completed three idle-art
jobs and used two news selections. Return speech took 5.344s; an unrelated
question then took 1.967s. Context grew 54.33% -> 66.10%, and the complete save,
fifteen pins and three assets verify. This supports sustained rich-history
operation on the unchanged extraction. Startup took 26.627s, early greetings
and themes repeated, and eleven private-output filter warnings remain recorded.
No foreground/idle render-contention or live write-payload probe was performed;
the cache issue is not closed. No tuning or commit in this PM. Evidence:
`logs/runs/20260923-0906-chamber-seven/postmortem.md`.

Paired foreground acceptance, 09:32-09:39: a note was written, revised in place,
read back identically to disk and performed. Playback interruption switched to
weather; Connect on the same page then recalled the exact revision without a
file read. Both saves, all 17/18 pin hashes and the parent chain verify. Context
ended near 61%; no backend warnings/errors. The scope is sufficient to checkpoint
this extraction without another long trial. Initial greetings still took about
28-30s; live B2 receipt-payload capture and render contention remain untested.
Amber telemetry's log-path mismatch and a pre-existing empty-B2 export fallback
matching face JSON are separate repair candidates, not extraction regressions.
No runtime edits/restart/commit in this PM. Evidence:
`logs/runs/20260923-0939-note-rehearsal-pair/postmortem.md`.

## Implemented Step: Deferred B2 Surface

Implemented after accepted spoken-monitor checkpoint `49fada9`; the 22:26-22:38
run accepts ordinary deferred delivery and mid-speech cleanup. `deferBrain2Surface`, `scheduleBrain2Surface` and
`maybeSurfaceDeferredBrain2` now delegate to `brain2-surface.js`. The scope below
isolates the pending mouth/voice item and timeout, not private advisory generation
or the whole idle scheduler. Offline fixtures reproduced races; the law-vending
live run itself did not expose a new deferred-delivery failure.

1. Reproduce the existing behavior offline: ordinary deferred delivery, a newer
   item replacing an older one, B2 disable, voice already delivered, current
   busy/expiry handling, and Disconnect/reconnect while a timer or mouth request
   is outstanding. Explicitly invoke captured old callbacks after replacement.
2. Give the pending item and timer one owner. Old callbacks must not drain or
   clear a replacement item or publish into a different session. Keep page
   adapters for display, speech eligibility, logging and the current clock.
3. Preserve the 1,200 ms retry, existing lab-speed/expiry calculation, latest-item
   replacement behavior and mouth/voice distinction. No new cooldown, suppression
   policy, content interpretation, replay of interrupted speech or B2 prompts.
4. Run focused tests, the complete JavaScript suite and the beacon-isolated
   browser checks. Stop and rescope if this needs private-advice freshness rules,
   changes to B1 turn scheduling or new decisions about what Eric should say.
5. After implementation, the live trial is ordinary: refresh disconnected,
   resume the rich thread, have a multi-step exchange, leave a short idle gap,
   return to talking and Disconnect. Existing tests exercise races; Scott need
   not engineer failures or provoke another long TTS batch. Compare continuity,
   initiative and public-speech handoffs with the law-vending baseline.

Implementation verification: five of the initial 13 probes failed on the old
code. All 20 focused cases and all 808 JavaScript tests now pass. The isolated
Edge suite uses real page handlers with captured timers, mocked speech/device
calls and blocked persistence, exercising old callbacks after replacement,
delayed display completion, save-stop/reconnect, once-only speech and the voice
monitor checkbox. Latest-pane hashes are unchanged. Logs:
`logs/maintenance/lifecycle-review/brain2-surface-{before,focused,suite,browser}.log`.
Python was not rerun for this page-only change.

Live acceptance: three held asides delivered once in gaps, one additional monitor
aside, an active idle conversation, three idle-art jobs and a clean mid-speech
Disconnect. The saved draft, 27 pins and three eye assets all verify. Race
coverage remains automated, not a claim of deliberately exercised live races.
The measured 48.876-second full prompt refill is a separate cache finding, not
accepted as fixed by this extraction. PM:
`logs/runs/20260922-2238-cold-shelf/postmortem.md`.

The owner checks item/session identity as well as timer identity. Deferred
display options carry a validity check across the asynchronous mouth request;
already-submitted physical commands are not canceled. Ordinary completion still
logs, remembers and optionally speaks the same text. The page no longer mirrors
the pending item or timer. Existing age/retry settings are unchanged; no extra
quiet policy or advisory filtering was introduced.

Separate follow-ups: inspect B2's visibility of successful file-write receipts,
and investigate the image-associated 48-second B1 delay using existing evidence.
Neither is a prerequisite for this bounded extraction or a reason to change
Eric's persona. Scott chose a 4,096 TTS cap as the clipping mitigation; batching
redesign is parked unless the symptom returns. No further work on unused
Halt/Unload paths, context policy or a universal scheduler is bundled here.

## Implemented Step: Spoken-Monitor Ownership

September 22 checkpoint scope: Restart cleanup and readiness are accepted on the
exercised paths below. Move next to B2's optional browser-speech monitor, not a
general idle/scheduling rewrite. The 20:13-20:25 PM records a monitor utterance
starting after human speech resumed. The gravity-restaurant run does not add
another proven overlap: B2 finished just before B1's first audio.

1. Reproduce delayed browser `onstart` and late end/error callbacks offline,
   across human speech resumption, B1 audio, monitor disable and Disconnect.
   Include interrupted/finalizing human turns, not just the current VAD flag.
2. Give that monitor's queue/callback lifetime one owner outside the page.
   Recheck permission to speak at actual dispatch/start; expired work must not
   revive an old voice or clear a newer utterance's state.
3. Preserve private B2 advice, mouth-display behavior, model selection, prompts,
   idle cadence and Eric's response length. Do not use this repair to add quiet
   policy, content filtering or a new universal scheduler.
4. Verify in isolated browser fixtures before asking for a normal conversation:
   long answer, a little idle, return to speaking, then ordinary Disconnect.
   No deliberate mic noise, racing controls or risky unsaved exits needed.

Stop and rescope if the repair requires redesigning B1 playback, backend turns,
or advisory freshness. Further Halt/Unload, recorder-internal and page-crash
work remain separate. Checkpoint this accepted state before implementation.

Implemented after checkpoint `1b9ce11`. `brain2-speech.js` owns the optional
browser monitor's utterance identity, cancellation and microphone echo tail.
The page supplies voice settings and current eligibility. Admission and delayed
`onstart` both check human-turn/B1 occupancy; a pending human turn counts even
after VAD stops. Accepted human activity and arriving B1 audio invalidate the
monitor immediately. B1 inference alone does not interrupt an already-running
aside. Disconnect, monitor disable and existing session cleanup use the same
owner. Old callbacks cannot cancel newer speech or change its microphone state.

A mouth-display request captures the monitor revision before awaiting its device
reply. The display still completes, but cannot launch stale voice after human/B1
activity or replacement speech. Private advice, mouth text, existing deferred
surface policy, prompts and idle scheduling are unchanged. There is no automatic
replay of an interrupted monitor utterance. Normal completion keeps the existing
500 ms microphone echo tail; explicit cancellation clears it as before.

Verification: 13 of the initial 14 offline probes failed before the repair;
all 28 monitor tests and all 788 JavaScript tests now pass. Isolated Edge checks
real page/event wiring, native utterance objects and the stop path, with browser
speech dispatch mocked: no live model, microphone or audible speech. Correction:
page-exit beacons escaped route isolation and wrote 21:23 test pane snapshots;
no corresponding session-note write was found. Those snapshots are excluded from
live evidence. The checkpoint harness now intercepts beacons before page code;
the rerun exercises three pagehide snapshots and leaves latest-pane hashes
unchanged. All 788 tests and the isolated browser suite pass again. The tests
establish callback ownership, not room-audio acceptance. Logs:
`logs/maintenance/lifecycle-review/brain2-speech-{before,suite,browser}.log`.
Python was not rerun for this page-only change; checkpoint coverage was 1,002
passes. The 21:36-21:53 continuation passed the ordinary path: four monitor
asides, return from idle, a long answer and normal Disconnect, without logged
overlap. No monitor cancellation race occurred; those cases retain offline
coverage only. Save integrity and continuity passed. The possible missing
lighthouse sentence instead matches an oversized backend TTS batch, separate
from this browser owner. Preserve that distinction and Eric's answer length.
Evidence: `logs/runs/20260922-2153-law-vending/postmortem.md`.

## Accepted Step: Restart Cleanup

Prepared September 22 after accepted feedback checkpoint `9b56e40`, then committed
as plan `8555bce`. Implementation passes offline checks; the live pair confirms
continuity/stop behavior and exposed a readiness gap, now addressed below. Scott uses Restart
to reboot STS; he does not use Halt or Unload. Further work on those controls is
parked until practical use exposes a problem. Keep their current implementation
and existing regression tests, but do not expand this into a general exit rewrite.

The reproduced Restart risk was after asynchronous cleanup, not its status timer:
`restartRealtimeServer` waited for recording, mic and pane snapshots, then read
the current global socket and cleared audio. An old operation could resume after
resources had changed. The original implementation scope was:

1. Extend `tests/helpers/sts_exit_harness.cjs` with delayed/rejected recording,
   mic and snapshot completion. Reproduce a late old Restart after a replacement
   connection, repeated Restart, and Restart during a normal save/connection
   transition. No real backend commands or devices in these fixtures.
2. Make the smallest Restart-only ownership repair supported by those tests.
   Capture the resources it owns and reuse the existing connection/audio owners
   and compatible cleanup helpers. A stale operation must not close a newer
   socket, clear newer audio or send another stale restart request.
3. Preserve the existing restart endpoint and model-setting intent, retained
   unsaved words/parent/eye assets, no automatic continuity save, and no automatic
   reconnect. Do not simply call save-and-Disconnect: its save contract differs.
   Keep already-submitted/unknown backend outcomes distinct from work not yet
   dispatched; do not invent automatic POST retries.
4. Run the full JavaScript suite and isolated browser checks, including normal
   Disconnect/save retry and recording-off paths. Broaden Python tests if the
   eventual change crosses the backend boundary. Keep the intermittent Windows
   note-replacement failure separate rather than silently fixing it here.
5. When ready, the safe live trial is ordinary Disconnect and confirmed save,
   then Restart, then Connect to the same thread and a brief exchange. Do not
   ask Scott to race controls or risk an unsaved conversation. A normal-session
   run alone does not establish live Restart coverage.

Stop and rescope if the patch requires changing save semantics, backend process
lifecycle, recorder design, Halt/Unload behavior, or a broad new command queue.
No changes to prompts, B2 policy, idle cadence, speech length, context assembly,
model settings or Eric's discretion over tool use belong in this work.

Implementation: `restartRealtimeServer` uses the existing `runConnectionTransition`
owner; `restartRealtimeBackend` is its captured-session cleanup/request adapter.
Each deferred cleanup and the deferred HTTP dispatch rechecks socket/generation
and intentional-cleanup identity. The model payload is captured at the click,
not read after device waits. Repeated requests and competing Connect/Disconnect
work are skipped, not queued. Already-running normal transitions take priority.

The backend launch receipt has a 30-second wait, with unknown-outcome logging
and no automatic retry if it is lost. This releases browser ownership without
claiming to cancel an already-sent request. The existing five-second completion
status delay remains, not a backend-ready probe. No automatic save or reconnect;
retained unsaved words still require Disconnect/save before Connect.

Verification: 21 added cases and all 756 JavaScript tests pass; 13 of the initial
17 probes failed before repair. Isolated Edge passes real-button/mock-backend
checks, including delayed cleanup and replaced-session cancellation, alongside
the existing real Web Audio and TCP-loss suites. Initial browser failure was an
incomplete fake socket (`send` missing), corrected before the successful rerun.
Python was not rerun; its last full result remains 990 passes with the separately
recorded intermittent note-replacement observation. Evidence:
`logs/maintenance/lifecycle-review/restart-cleanup-*.log`.

Live acceptance: refresh disconnected, Connect to the current thread, exchange
a short story beat, Disconnect and confirm saving, Restart once, then Connect
normally and continue that beat. A little idle and Disconnect during speech
complete the check. Do not race controls or change model settings for this trial.
See [Engineering Status](engineering-status.md#restart-cleanup-ownership).

Still outside scope: recorder-internal late-finalization ownership, cancellation
of already-submitted backend commands, Halt/Unload orchestration and page-crash
persistence. No live backend was restarted in automated verification.

September 22 live pair, 20:13-20:25: normal continuation across Restart and
mid-playback Disconnect passed. Both journals/disk notes and all pin hashes
match; the second run recalls the first run's new reflection idea. Two Connect
attempts failed before STT/TTS startup completed: Restart requested 20:15:19,
backend ready 20:16:42, successful connection 20:17:17. The five-second status
delay is misleading in practical use. Next work is an actual readiness receipt,
not a longer guessed timer, with stale-result protection and no restart retry or
auto-connect. Separately note one B2 monitor callback starting after human speech
resumed; preserve initiative and test voice handoff rather than tuning content.
PM: `logs/runs/20260922-2025-restart-continuity-pair/postmortem.md`.

Readiness follow-up, September 22: the small `realtime-readiness.js` owner now
gates the main and session-map Connect controls on the existing warmed pool's
free-slot response, proxied read-only by the page server. Checks are single-flight,
bounded and discarded across Restart/socket acquisition; existing transition
locks remain authoritative. No auto-connect, backend retry, model call or persona
change. The five-second feedback timer no longer determines Connect availability.
760 JavaScript tests, 156 focused Python tests and isolated browser readiness
checks pass. Activated around 20:47 using the existing page-only stop/start
scripts after the initial restart command was rejected. The stale page API had
returned 404 despite realtime being ready; UI Restart does not restart that API.
The real endpoint and enabled browser controls are now verified without opening
a conversation or restarting the models again. See
[Connect Readiness](engineering-status.md#connect-readiness).

September 22 follow-on acceptance, 20:56-21:06: ordinary Connect, three successful
image/eye chains (one autonomous idle render), normal speech-drain waits and a
complete Disconnect save passed. All 25 pin hashes and three eye hashes match;
final context was 75.42%. No new B2/human overlap was established. Preserve this
as a baseline for the next narrowly scoped spoken-monitor ownership fixture;
do not suppress private B2 work or change idle cadence. PM:
`logs/runs/20260922-2106-gravity-restaurant/postmortem.md`.

## Current Ownership Map

Functions below are in `web/sts/index.html` unless a module is named. These are
current responsibilities, not a claim that they already form isolated modules.

| Responsibility | Current entry points / state | Boundary risk |
| --- | --- | --- |
| Connection identity | `realtime-connection.js` owns socket, generation and stopped state; page adapters `activeRealtimeSession`, `realtimeConnected`, `send` | An awaited operation retains an old socket or generation. A stop is not the same as a new connection. |
| Normal connection transitions | `realtime-connection.js` owns the single operation token; `runConnectionTransition` adapts UI; Connect/Previous/selected/Disconnect wrappers compose preparation and save functions; Restart uses it through cleanup and launch receipt | Competing preparations must not mutate shared context. A session-map move needs the same token through save and destination arrival. Halt/Unload remain separate; unused explicit-reset controls are retired. |
| Current-socket closure | `realtime-connection.js` owns the idempotent close promise and stopped state; `handleRealtimeClose` / `cleanupClosedRealtime` adapt page resources and recovery UI | Reconnect cannot race pending close cleanup. The stopped unsaved transcript must survive until Disconnect/save succeeds. Explicit backend controls and page exit are not a crash-save protocol. |
| Backend-control feedback | `backend-control-feedback.js` owns latest feedback identity, status timer and button release; page adapters retain request/cleanup logic | Old replies/timers must not overwrite a newer connection or command. Feedback invalidation does not cancel an already submitted backend command. |
| Stop, save, reconnect work | `saveAndDisconnectRealtime`, `saveEricContinuitySnapshot`, `quiesceRealtimeForSave`, `haltRealtimeActivity`, `openRealtimeConnection`, `resetSessionContextForConnection`, `clearHotConversationState` | Snapshot preparation owns one bounded final-transcript wait and the empty/save decision; frozen retries do not wait again. Device cleanup and save orchestration remain page-owned. Final transcription must survive stop, but new speech and effects must not. Failed saving must block destructive reset. |
| Response dispatch | `handleEvent` validates events; `response-completion.js` owns model-active state and completion dispatch; page retains `suppressedResponseIds` | Provider response completion is not audible completion. Canceled responses and old events must not revive work. |
| Tool batch and continuation | `tool-continuation.js` owns pending count, done flag, drain timer, call-ID deduplication, user activity timestamp and round state; page adapters execute tools and dispatch requests | Results and response completion arrive in either order. Receipts may survive an interruption while automatic continuation must not. |
| Audible output | `audio-playback.js` owns playback state; page adapters `playPcm16Bytes`, `flushAudioQueue`, `outputAudioActive`, `stopPlaybackNow` | Audio setup is asynchronous; scheduled audio can outlive inference. Wall-clock time cannot prove playback has finished. |
| Optional B2 monitor | `brain2-speech.js` owns browser utterances and echo tail; `brain2-surface.js` owns deferred mouth/voice delivery and its timer | Old timers or device replies must not publish into a replacement item/session. Already-submitted device commands cannot be unsent. Private advice remains separate. |
| Turn completion | `response-completion.js` owns pending state, idle provenance and timer; thin page adapters retain activity/idle policy | Idle/reengagement can start too early if generation completion is mistaken for speech completion. |
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

- Backend-control feedback is extracted and isolated race tests pass (735 total
  JavaScript tests). Eight assertions failed on the prior implementation. The
  owner cancels superseded timers, rejects captured callbacks and late HTTP
  completions, scopes connection-status changes, and keeps emergency Halt
  available during Restart/Unload. Endpoint semantics and cleanup ordering are
  unchanged. Evidence: `logs/maintenance/lifecycle-review/backend-feedback-*.log`.
  Python full rerun passes 990 tests; an initial concurrent-append Windows
  permission failure passed targeted recheck and remains recorded separately
  in Engineering Status rather than attributed to this JavaScript extraction.
  The 19:39-19:44 live smoke run preserved normal conversation, render/eye
  handoff, B2 delivery and exact continuity save; Scott reports a good result.
  No backend controls were exercised, so race coverage remains offline.
  PM: `logs/runs/20260922-1944-glass-submarine-acceptance/postmortem.md`.
- Restart dispatch/cleanup now uses captured ownership and the connection
  transition, as specified above; offline checks and the exercised live
  continuation/stop paths pass. Readiness activation and the following normal
  connection are verified. B2 spoken-monitor ownership now passes its offline
  checks and ordinary live continuation. Deferred mouth/voice delivery now also
  passes automated checks and ordinary live continuation with mid-speech stop.
  Already-submitted backend commands and recorder-internal finalization are
  separate lifetimes, not canceled by a feedback or connection guard. Halt and
  Unload remain deferred.
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

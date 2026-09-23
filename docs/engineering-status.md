# Engineering Status

Reviewed September 22, 2026. This is the maintained engineering view; session
postmortems remain evidence of their particular runs. A successful test or an
expressive session is not a guarantee about extended live operation.

## Working Baseline

September 22 checkpoint, following `8555bce`: Restart cleanup ownership and
Connect readiness are accepted on the exercised paths below. The live pair
confirms continuity and mid-playback stopping; the readiness endpoint is now
served, and the gravity-restaurant run confirms subsequent ordinary connection,
image/eye work, autonomous idle art and complete saving. These are scoped
acceptance results, not a guarantee about every lifecycle transition.

The current checkpoint includes optional B2 spoken-monitor ownership,
preserving private advice and existing idle behavior. It passes offline/browser
checks and the 21:36-21:53 ordinary live continuation. That run did not provoke
a monitor cancellation race. See the
[implementation and scope](sts-lifecycle-ownership-plan.md#implemented-step-spoken-monitor-ownership).
Further Halt/Unload work is parked until needed. The earlier intermittent Windows
note-write test observation remains documented below, separate from these repairs.

Checkpoint verification: 760 JavaScript tests, all 1,002 Python tests and the
isolated Edge suite pass. Python reports the existing Starlette/httpx deprecation
warning; no test retry was needed in this run. Browser routes block live model,
backend-control and persistence calls, apart from their disposable test fixtures;
the later B2 checks exposed a page-exit beacon isolation gap, documented below.
Logs: `logs/maintenance/lifecycle-review/checkpoint-restart-readiness-*.log`.

### B2 Monitor Speech Ownership

After checkpoint `1b9ce11`, `brain2-speech.js` owns the optional browser voice's
queued/active utterance, stale callbacks and microphone echo tail. Human-turn
activity and incoming B1 audio cancel that voice; delayed starts recheck current
occupancy, including the pending turn after VAD stops. Old start/end/error events
cannot cancel a replacement or clear its active state. A delayed mouth-display
reply can still display text but cannot revive a superseded voice request.

This changes execution only: no prompt, personality, private-advice, response
length or idle-cadence changes. A currently speaking monitor aside may finish
during B1 inference, but yields when B1 audio arrives. Existing monitor disable,
Disconnect and session cleanup use the same owner. Actual cancellations get a
short reason in the existing B2 log, without duplicating the utterance text.

All 788 JavaScript tests and the isolated Edge suite pass, including 28 monitor
tests. The browser uses native utterance objects with mocked dispatch, actual
page events and save-stop quiescing, without live model/device requests or audible
test speech. Correction: page-exit beacons did write test pane snapshots at 21:23,
despite route interception. These are not conversation evidence; no corresponding
session-note write was found. The checkpoint harness now intercepts beacons in
its initialization script, before page code. A real pagehide dispatch exercises
three intercepted snapshots; all latest-pane hashes remain unchanged after the
suite. This changes test isolation only, not production page-exit behavior.
Python is unchanged and was not rerun; its checkpoint result remains 1,002 passes.
Evidence: `logs/maintenance/lifecycle-review/brain2-speech-*.log`.
Checkpoint rerun: all 788 JavaScript tests and isolated Edge checks pass;
`logs/maintenance/lifecycle-review/brain2-checkpoint-{suite,browser}.log`.

The 21:36-21:53 continuation exercised four monitor asides, return from idle,
a long answer and ordinary Disconnect, with no logged overlap with human speech
or the recap. No cancellation race occurred; those cases remain offline coverage,
not room-audio proof. No recording was supplied for audible-content verification.

### Law Vending Acceptance

September 22, 21:36-21:53: the Connect-time policy accepted nine middle-session
excerpts, preserving the oldest and 13 newest sessions. Broad recall worked
without file-reading tools; this is qualitative evidence, not a recall benchmark.
All 26 source pins and three retained eye assets verify. Final measured context
was 103,689/131,072 (79.11%), with no live compaction or overflow. Eric developed
the invention during idle, made two further pictures and saved `tuesday.txt`.
B2 later claimed the write receipt was absent; the receipt and file both exist.

Scott's possible skipped lighthouse sentence has a concrete TTS match: its
paragraph ends a 2,280-character coalesced input estimated at 3,112 codec tokens,
above the configured 3,072 cap. Probable tail clipping, not proven missing words;
the logs do not record actual cap exhaustion and no audio recording was supplied.
The four recap batches generated 195.91 seconds of audio. Their drain timing
explains the delayed spoken save confirmation; the file write itself succeeded.

No runtime changes were made during the PM. Evidence:
`logs/runs/20260922-2153-law-vending/postmortem.md`, with frozen sources, hashes
and a reproducible analysis script.

### TTS Budget and Next Work

After the PM, Scott chose the small configuration adjustment: the launcher now
passes 4,096 rather than 3,072 as the maximum audio-token budget per TTS request.
PowerShell syntax and the one-line change are checked. Activation requires an
STS restart; activation and another near-limit utterance are not verified here.
No batching, answer-length or prompt change is included. Treat this as a practical
mitigation, not proof that arbitrary-length inputs cannot truncate. Further TTS
batching work is deferred unless clipping recurs; no forced stress run is needed.

Next architecture task: isolate the deferred B2 mouth/voice item's timer and
lifetime, beginning with offline stale-timer, replacement and reconnect fixtures.
Keep the current timing, expiry and eligibility rules, private advice and idle
initiative unchanged. This is proposed work, not an additional runtime repair.
See the [bounded next step](sts-lifecycle-ownership-plan.md#next-step-deferred-b2-surface).

Keep two evidence questions separate from that extraction: the 48-second
image-associated B1 wait (cache refill remains unproven), and whether B2 receives
the successful file-write receipt before advising that it is missing. Inspect
existing request/receipt records first; do not add behavioral restrictions or a
general logging expansion. Halt/Unload, recorder internals, a universal scheduler
and further context-policy changes remain outside this next step.

### Connect Readiness

September 22: at Scott's request, Connect availability now checks the existing
realtime `/v1/pool` endpoint through a same-origin, read-only
`/api/realtime/ready` proxy. The standard local service on port 8765 only serves
this endpoint after pipeline warmup. An idle slot means Connect may be offered;
an unavailable, unresponsive, occupied or draining service keeps it disabled.
This is not a model inference test or a promise of instant replies.

`realtime-readiness.js` owns the single in-flight check and invalidation identity.
The main page checks every two seconds while disconnected and outside connection
or backend-control work; a Restart or socket acquisition invalidates an old
result. Existing lifecycle locks still win. Connect, Previous, Empty, Selected
and the separate session-map Connect button use the gate. Archiving is not
blocked by service unavailability. Checks make no WebSocket/model requests,
change no prompts, never retry Restart and never connect automatically.

Verification: 760 JavaScript tests and 156 focused Python page-server/readiness
tests pass. The isolated browser suite also checks that Restart's five-second
feedback timer cannot enable Connect while readiness is false, and that the map
button disables again if service readiness is lost. Evidence:
`logs/maintenance/lifecycle-review/readiness-*.log`.

Activated September 22, about 20:47. The initial page-server restart command was
rejected before execution; refreshing against that old server left Connect
disabled because the new endpoint returned 404. The UI's Restart button only
restarts realtime, so using it did not update the page API. The existing
`stop_sts.ps1 -PageOnly` and `start_sts_page.ps1` scripts completed activation
without another model/backend restart. Verified HTTP 200 `{"ready": true}` and,
in an isolated browser using the real endpoint, enabled Connect/Previous/Empty
with no session opened. Already-refreshed pages recover on their next poll.

### Gravity Restaurant Acceptance

September 22, 20:56-21:06: ordinary Connect after readiness activation worked.
The saved chain is `202505-220 -> 210637-965`; journal content, all 25 source-pin
hashes and all three eye-asset hashes match disk. Three images rendered,
displayed and were voluntarily staged; the third was autonomous idle art.
Final measured context was 98,858/131,072 (75.42%), up 10,684 tokens. No live
compaction, tool denial or image-preview failure appeared.

First audio took 38.596 seconds after the opening utterance; later direct spoken
replies took 2.203-2.696 seconds. Apparent minute-long image handoffs align with
queued speech draining, including one 137.90-second answer. B2 supplied ten
unclipped notes; the sphere question shows advisory uptake. No new B2/human
overlap is established: the closest B2/B1 handoff ended about 83 ms before B1's
first backend audio. The earlier over-human callback remains the next focused
fixture candidate. Normal final Disconnect/save passed; this was not another
mid-speech stop test. The physics/fiction boundary and repeated opening are
content caveats, not reasons to reduce initiative. No runtime changes in this PM.
Evidence: `logs/runs/20260922-2106-gravity-restaurant/postmortem.md`.

### Restart Cleanup Ownership

September 22, after checkpoint `8555bce`: Restart now uses the existing connection
transition owner through cleanup and the backend launch receipt. Repeated Restart,
Connect and Disconnect do not start competing work during that transition;
Restart also defers to a save, connection preparation or socket cleanup already
in progress. Nothing is queued to run later.

The adapter captures socket/generation, intentional-cleanup identity and the
requested model payload before waiting. It rechecks ownership before starting
and after settling recording, mic and pane-snapshot steps, and immediately before
dispatch. Expired work cannot close a replacement socket, clear its audio or send
a stale restart request. Existing status-feedback ownership remains separate.

The launch-receipt wait is bounded at 30 seconds so a lost HTTP reply releases
the transition. This is not a model-startup, inference or speech limit; the
endpoint acknowledges launching a separate restart process. A missing receipt
logs an unknown backend outcome, not proof that no restart happened, and never
automatically retries. Existing device wait budgets and the five-second status
delay remain unchanged; that status delay is not a backend-readiness check.

No automatic continuity save or reconnect was added. Unsaved words, parent and
eye assets survive, with Disconnect available to save before reconnecting.
No backend/Python, Halt/Unload, prompt, model-setting value, idle/B2 policy or
speech behavior changed. The recorder's own late finalization callbacks and
arbitrary already-submitted backend-command races are not solved by this change.

Verification: 21 new unit/integration cases; the initial 17-case probe reproduced
13 failures before repair. All 756 JavaScript tests pass. Isolated Edge exercises
the real Restart button with delayed fake snapshots/HTTP, checks exclusion and
stale-session cancellation, and retains audio, image-preview, network-loss and
save-retry coverage. No live restart, model or persistence writes in these
fixtures. The first browser attempt exposed a missing `send` method in its fake
socket; after correcting the fixture, the complete suite passed. Python was not
rerun for this browser-only change. Logs: `logs/maintenance/lifecycle-review/restart-cleanup-*.log`.

Live acceptance, on the same thread:
1. Refresh STS while disconnected, then ordinary **Connect**.
2. Briefly continue the story, for example: "Let's pick up the glass submarine.
   Give me the captain's next ridiculous problem."
3. **Disconnect** and wait for the session-note save to finish.
4. In **Server Management**, press **Restart** once. Let the normal backend
   startup finish, then ordinary **Connect**, not Previous or Empty.
5. Ask "Where did we leave the captain?" Have a short exchange, allow a little
   idle, then **Disconnect** during speech if convenient.

Check continuity, normal mic/speech, one voice, no old audio returning, and clean
final saving. No racing controls, special setup card or forced image step is
needed. A page refresh loads this JavaScript; the Restart is the acceptance
exercise, not required to deploy browser code. Leave the prior checkpoint as the
accepted baseline until this live run is reviewed.

September 22, 20:13-20:25: both runs reviewed. The save chain is
`194422-258 -> 201509-778 -> 202505-220`; both journals are complete, disk content
matches exactly and all 23/24 pinned-source hashes match. Eric recalled the new
lagging-reflection detail after Restart and developed the story in six idle
responses with identifiable B2 contributions. The final Disconnect cut queued
speech: cancellation at 20:25:05.136, socket close at .522, pipeline release at
.563, with all accepted words saved. Final context was 67.92%; one older session
was excerpted at connection time, with the newest 20 left intact.

The Restart UX is not fully accepted: clicks to Connect failed at 20:15:46 and
20:16:10 while STT/TTS were still starting. Backend readiness was 20:16:42, about
83 seconds after the Restart click, versus the existing five-second UI timer.
Launch acknowledgement is not readiness; that distinction is the next repair,
without automatic restart retries or automatic reconnect. A separate B2 monitor
aside began at 20:24:45 after human speech resumed at 20:24:44.921. Record this as
a monitor-handoff test candidate, not two overlapping B1 voices or a reason to
reduce initiative. Room-audio impact is unverified; recording was disabled.
No runtime changes were made during this review. The PM and 25 evidence files:
`logs/runs/20260922-2025-restart-continuity-pair/postmortem.md`.

### Backend-Control Feedback Ownership

September 22: `04a8aa8` checkpoints the single transcript-wait repair and the
19:04-19:09 normal-path acceptance notes, including the unexercised pending-STT
caveat. The accepted bounded extraction is `backend-control-feedback.js`: one owner
for Halt/Restart/Unload button release and delayed status callbacks.

Previously, a late Restart/Unload reply or completion timer could relabel a newer
connection as Disconnected/Unloaded, or release controls belonging to a newer
backend action. Eight new regression cases reproduced those failures before
repair. Each feedback operation now has its own identity; a newer backend action
cancels the old timer, and captured callbacks/late failures cannot complete the
new action. Connection-specific updates also check socket, generation, normal
transition and intentional-cleanup identity. An expired connection's final
backend operation still releases its own controls without changing the new
connection's status. Halt remains available during Restart/Unload; Restart and
Unload are disabled while Halt is pending.

Scope is deliberately feedback only. Existing backend endpoints, payloads,
cleanup ordering, recording/device waits and four/five-second status delays are
unchanged. This does not cancel a backend request already sent, serialize all
backend commands, or make the remaining cleanup races safe. Page exit remains
best effort. No prompts, context, idle/B2 policy or speech behavior changed.

All 735 JavaScript tests pass, including preserved endpoint/no-auto-save/no-auto-
reconnect contracts, late HTTP success/failure, superseded timers, pending
connection preparation and mic-control protection after a stale Halt receipt.
Isolated Edge loads the actual module and verifies its button wiring, including
emergency Halt availability, alongside the existing audio/thumbnail/network-loss
suite. No live server-control endpoint, model or device was exercised. Evidence:
`logs/maintenance/lifecycle-review/backend-feedback-*.log`.

Python verification: the first full run had 989 passes and one `WinError 5`
failure replacing a temporary note in the multiprocess concurrent-append test.
Both threaded/process cases passed on immediate targeted recheck; the full rerun
passed all 990 tests (the existing Starlette/httpx warning remains). The initial
failure log is retained, not overwritten. No Python/storage code changed here;
the intermittent note-replacement failure remains an observation to investigate
if it recurs, not a resolved storage defect.

Refresh while disconnected and use ordinary Connect/conversation/Disconnect for
a page smoke check. There is no need to press unused server controls against a
valuable session; deliberate race coverage is offline. The next separate step
is Restart command/device cleanup ownership, not further dialogue tuning.
Scott uses Restart to reboot STS, but does not use Halt or Unload. Further work
on those two controls is parked until actual use exposes a need; retain their
existing behavior and tests without expanding that workstream.

September 22, 19:39-19:44: Scott reports a funny, good normal-path run. Twenty
prior sessions loaded; multi-part replies, one render/preview/eye transfer and
three unclipped B2 notes worked. Two B2 monitor asides have timing consistent
with separation from B1 speech. The final note matches its journal, all 22 prior
pin receipts are `ok`, and the eye hash matches. Disconnect saved and closed
within the same displayed second; final context was 69.6%. No backend controls
were used, so this is normal-path acceptance, not live race or unique build-
activation proof. Startup latency and one factual-content wobble are recorded
separately; no runtime repair follows. Evidence:
`logs/runs/20260922-1944-glass-submarine-acceptance/postmortem.md`.

### One Final-Transcript Wait

September 22: `cd3a281` checkpoints the accepted thumbnail repair, retired
controls, acceptance notes and refreshed public documentation. The next small
repair is implemented and awaiting a refreshed live run: snapshot preparation
now owns the single bounded final-STT wait. Disconnect no longer waits once
before calling a snapshot function that waits again. The 4.5-second budget and
120 ms polling interval are unchanged; this is not a faster STT model or a
promise that every draft will finalize.

Empty connections are checked after settling, so a late first utterance can
still create a session note. An unfinished draft is not promoted; an actually
empty connection closes without a note. Retries of an already frozen transaction
reuse that payload without another wait. Direct snapshots retain their default
empty-transcript error, and session-map departures still avoid reloading the
departing history. Expired preparation cannot submit a late second save.

Seven focused tests cover these cases. The persistent-draft replay reproduced
9120 ms before the repair and 4560 ms afterward; three regression assertions
failed before the change. All 719 JavaScript and 990 Python tests pass (one
existing Starlette/httpx deprecation warning), including reconnect, late speech
and frozen-payload retry coverage. Isolated Edge audio, thumbnail
and network-loss/recovery checks pass. Evidence:
`logs/maintenance/lifecycle-review/transcript-settle-*.log`.

Refresh while disconnected, resume the same thread, exchange a few words and
Disconnect normally. Check the saved final accepted line and reconnect
continuity. This repair does not alter prompts, idle/B2 policy, context,
thumbnail ownership, server controls or model settings. No server restart is
needed; backend-control cleanup remains a separate next boundary.

September 22, 19:04-19:09: normal-path live acceptance passed. The final user
line was accepted about 18 seconds before Disconnect; the note saved and socket
closed in the next clock second, with no transcript wait required. The saved
draft matches disk exactly and all 21 prior-pin receipts are `ok`. This does not
exercise the pending-draft edge or independently prove page-build activation;
that edge retains its offline regression coverage. A repeated two-sentence joke
was present verbatim in loaded history, not evidence of missing context. No
behavioral repair follows. Evidence:
`logs/runs/20260922-1909-genius-recall-and-save/postmortem.md`.

### Voice Does Not Cancel Thumbnails

September 22: the 17:08-17:16 paired PM established two successful renders whose
Imagined Image thumbnails were suppressed by intervening microphone input.
Scott requested a preview-only repair. `generateImage` now distinguishes the
current preview/session from the current conversational turn. Foreground and
model-selected idle renders can finish their thumbnail after voice interrupts;
receipts accurately report `displayed: true`, `staged: false`, `retained: true`
when the old turn was superseded. No new speech, eye transfer or render is forced.

Disconnect, socket replacement/closure, session generation changes, revoked idle
permission, manual Clear and a newer preview still block stale display. The
existing continuation and eye-retrieval guards remain. The separate B2-proposal
controller's automatic delivery policy is unchanged; this repairs the two
`generate_image` routes observed in the PM, not an idle-policy redesign.

Four focused thumbnail assertions failed before repair and pass afterward.
All 712 JavaScript and 990 Python tests pass (one existing Starlette/httpx
deprecation warning), including the real idle-art controller with fake
rendering, stale-result cases and canceled speech. Isolated Edge confirms decoded
thumbnail pixels, IMG READY, enabled controls and unchanged eye state at desktop
and mobile sizes; existing audio/network-loss checks also pass. No paid image,
live model or hardware action was used. Evidence:
`logs/maintenance/lifecycle-review/thumbnail-voice-*.log` and
`logs/maintenance/audio-owner-browser/image-preview-{desktop,mobile}.png`.

September 22, 18:00-18:06: live foreground acceptance passed. Three interrupted
renders displayed their thumbnails via the new log path; a fourth uninterrupted
render also displayed. Eric chose three successful eye transfers separately.
The extra drawing was a distinct model request, not a controller retry; one
overlapping request was correctly rejected before another render. The session
save exactly matches its frozen journal, and all three eye hashes match disk.
Scott confirms the result worked well. Live idle-tool coverage is not claimed.
Evidence: `logs/runs/20260922-1806-thumbnail-acceptance/postmortem.md`.

One separate lifecycle follow-up surfaced: Disconnect waited about 4.5 seconds
twice for the same unfinished final STT draft, once in the disconnect wrapper
and again in the snapshot function. Saving and shutdown succeeded, but the final
partial "Good work" was never finalized and is only in the pane log, not the
continuity note. Consolidate the wait budget with regression tests; do not
promote partial transcripts or mix that repair into image behavior. The separate
follow-up is documented above under One Final-Transcript Wait.

### Unused Thread Controls Retired

September 22: `c9d55b0` checkpoints the accepted socket-close owner and paired
13:17-13:26 acceptance notes. Scott confirmed that Save Latest, Clear Latest
and Reset To Pinned are unused. Their Latest Thread panel, filename/reset-after-
save inputs, event handlers and dedicated helpers are now removed: 189 lines
out of the main page, including the independent discard/reconnect path.

The existing Load Eric memories on refresh checkbox moves to Pinned Notes with
the same ID, default and persistence. Normal Connect/Previous/Empty, session-map
loading, Disconnect's transactional save, Eric's authored-note/raw-capture tools,
pinning and existing stored notes are unchanged. Shared conversation formatting,
reset and socket-close helpers remain. No prompt, idle, context, TTS, model or
runtime instrumentation changes are included. Halt/Restart/Unload and page-exit
production behavior are unchanged.

Ten new isolated characterization tests preserve those backend/page-exit
contracts, including rejection and delayed completion; two more guard removal
and the retained memory control. All 704 JavaScript and 990 Python tests pass
(the existing Starlette/httpx deprecation warning remains). Edge passes
desktop/mobile layout checks, real-audio stop/drain and disposable-socket network
loss/recovery. Its screenshots confirm the memory checkbox fits under Pinned
Notes. No live Eric connection, device action or persistence write was exercised.
Evidence: `logs/maintenance/lifecycle-review/unused-thread-controls-*.log` and
`logs/maintenance/audio-owner-browser/pinned-notes-{desktop,mobile}.png`.

September 22, 17:08-17:16: the paired normal-path trial preserved continuity,
saved both sessions exactly against their journals and retained all three new
eye assets. Run 2 recalled the unfinished headline game before using any tool.
The reviewed artifacts do not independently confirm a fresh page fetch after
the control removal, so its activation evidence remains limited. No cleanup
regression was observed. Two missing thumbnails were the pre-existing
interrupted-generation preview guard, not failed renders: new microphone input
arrived while rendering, and exact retrieval later staged both images in the
eye without restoring their Imagined Image previews. The third uninterrupted
render displayed normally. This is a separate UI ownership task, not automatic
eye staging or a prompt change. Final measured context was 67.4%. Evidence:
`logs/runs/20260922-1716-headline-game-preview/postmortem.md`.

Refresh while disconnected to pick up the UI removal if not already refreshed.
No special reset trial or server/model restart is required.
Next ownership work: reproduce late backend-control completion and cleanup races
offline, then change one boundary at a time without taking away emergency Halt.
These preservation tests alone do not establish that every race is safe.

### Owned Unexpected Close

September 22: following the accepted `94b3d3d` audio repair, the existing
`realtime-connection.js` owner now owns current-socket closure as well as normal
transitions. One close promise deduplicates cleanup, marks the connection stopped
immediately, and prevents Connect/Previous/selected/Disconnect from racing
unfinished cleanup. The page's close listener is a small adapter; its cleanup
reuses `haltRealtimeActivity` instead of a second scheduler/audio stop list.

Unexpected loss retains unsaved words, loaded history, parent and eye assets.
After cleanup, the existing Disconnect action can save/retry; Connect cannot
silently replace that transcript. There is no automatic save, reconnect or backend
restart. Intentional cleanup is scoped to its socket/generation so a previous
exit's grace period cannot suppress cleanup in a newly connected run. Loss during
an unfinished or failed save still finalizes devices. Mic stop releases old
references before awaiting context closure; delayed mic permission/device setup
and audio callbacks are checked against the originating connection.

Verification: 692 JavaScript tests and 990 Python tests pass (the existing
Starlette/httpx deprecation warning remains). Eight initial regressions failed
against the prior code before this repair. The four original isolated defects
no longer reproduce. Headless Edge passes the existing real-audio and
desktop/mobile checks plus a real TCP-drop test against a disposable localhost
WebSocket: code 1006, locked cleanup, retained words, failed-save retry, successful
save/reconnect and stale-close rejection. Model work, microphone resources and
save receipts in that browser test are simulated; no live session, persistence
writes or hardware actions are used. Evidence under
`logs/maintenance/lifecycle-review/`: `close-owner-suite.log`,
`close-owner-pytest.log`, `close-owner-browser.log`, and
`close-owner-reproduction.json`.

September 22, 13:17-13:26: the paired live trial passed normal-path regression
acceptance. The new page/module were fetched before Run 1, with no refresh before
Run 2. Run 1 canceled active TTS; Run 2's final playback had drained before its
stop. Both saves exactly match their frozen drafts; Run 2 loaded the first save
and recalled the Reachy exchange without tools. The mic restarted successfully
on the reused page. A failed external Reachy body switch and speaker-identity
confusion are recorded separately, not treated as cleanup regressions. Evidence:
`logs/runs/20260922-1326-close-owner-acceptance/postmortem.md`.

No need to deliberately break a valuable live session. This is not crash-safe
browser persistence, and explicit resets, backend-control timers and page exit
remain separately scoped work. Nothing changed Eric's prompts, context assembly,
tools, idle timing, voice, model settings or runtime instrumentation.

### Socket-Close Audio Stop

September 22: the first repair following `fdde834` is implemented. The current
WebSocket's close handler now uses existing `stopPlaybackNow` instead of only
clearing queued bytes. That stops scheduled sources, invalidates pending audio
setup and releases the speech-mouth cue. The existing stale-socket guard remains
before cleanup. This is one production-line change; no prompts, idle timing,
context/save behavior, model settings or runtime instrumentation changed.

Three regressions failed before the repair and pass afterward (running clock,
suspended clock, and pending setup). Additional checks preserve fresh-session
audio against old close events, repeat-stop safety and error-without-close
behavior. All 674 JavaScript and 990 Python tests pass (one existing Starlette/
httpx deprecation warning). The isolated Edge check uses the actual
page close callback and real Web Audio: two scheduled sources stop, analyser
signal disappears, delayed setup creates no source, and fresh audio survives
stale close events. Transport/preparation are simulated; no model, mic or device
action is used. Existing audio-drain and desktop/mobile smoke checks also pass.

At the audio-only checkpoint, unexpected-close unsaved-state recovery and late
mic-cleanup ownership still reproduced offline. The separate repair above now
addresses those boundaries. Do not kill a server during valuable unsaved
conversation to test them.

September 22, 12:28-12:37: paired live acceptance on `94b3d3d` passed the
normal Disconnect/reconnect path. The repaired page was fetched before the
first run; the second Connect used the same page without a refresh. Both
Disconnects canceled active response/TTS work and committed complete continuity
saves. The second run loaded the first save and recalled Priya and Chamber Seven
without tools. A 240-second story also drained before the next B1 idle response,
while B2 supplied private advice without overlapping public speech. Scott
confirmed both abrupt cutoffs worked correctly. This is normal-path regression
acceptance, not a live unexpected-network-loss test. Evidence and content notes:
`logs/runs/20260922-1237-socket-audio-acceptance/postmortem.md`.

### Unexpected-Close Preparation

September 22: `2887027` checkpoints the accepted normal transition owner and its
paired live acceptance notes. The next boundary is prepared, not activated:
unexpected WebSocket closure first, with explicit resets, backend emergency
controls and page exit remaining separate. No production files, prompts, model
settings, context handling, idle timing or instrumentation changed in this step.

Offline fault injection against actual page callbacks reproduced scheduled
audio surviving an unexpected close, pending audio setup starting after close,
Connect clearing an unsaved hot transcript, and old asynchronous mic cleanup
clearing newly assigned mic references. These are synthetic edge cases, not
failures attributed to the two good live runs. Pane snapshots may preserve text;
they are not a committed continuity session.

Twelve preservation tests now exercise current/stale close callbacks, normal
Disconnect composition, failed opening, recording finalization and cleanup
errors. All 668 JavaScript tests pass. The separate diagnostic reproduces known
unsafe behavior and is not a passing acceptance gate for those defects.
First production step should only stop scheduled/pending playback on current
socket closure, with stale sockets still ignored. Then address cleanup ownership
and unsaved-state recovery before extracting shared close orchestration.
See [Lifecycle Ownership](sts-lifecycle-ownership-plan.md#unexpected-close-groundwork).
No refresh or new operator run is needed for this test/documentation preparation.

### Connection Transition Owner

September 22: accepted identity-owner checkpoint and live notes are preserved
as `52a3dc9`. The next step adds a single in-flight operation to
`realtime-connection.js`. Connect, Empty, Previous, selected-session loads,
session-map moves and Disconnect now share that authority. Intentional nested
save/connect steps carry the same operation token; competing actions are ignored
or rejected, not queued for later. The old independent save-busy flag is removed.

Three offline reproductions established the need: two preparations could start
before either created a socket; Connect could begin while Disconnect still saved
its pane snapshots; and Disconnect could run against half-loaded context.
These paths now pass, including failure/retry and selected/Previous composition.
Start controls remain unavailable through Disconnect cleanup even after the
socket-close callback runs. No new controls, delays or runtime tracing were added.

Verification: 656 JavaScript tests, 990 Python tests and isolated Edge checks pass
(one existing Starlette/httpx deprecation warning). The real browser verifies
control locking and release without connecting to Eric. Connection preparation
and transport bodies match the prior checkpoint; save orchestration differs only
by removal of the replaced busy flag. Prompts, context assembly, idle policy,
audio/tool scheduling and save receipts are unchanged.

September 22, 10:29-10:35: the paired resumed-thread trial on `1f69646` passed
the exercised normal path. A fresh module fetch preceded the runs; the second
Connect loaded the first save plus its ancestry (10 to 11 sessions). Both
complete transaction journals matched their saved sources and all four eye-asset
hashes. Both Disconnects released their backend sessions within half a second
of cancellation; the second stopped queued speech after generation had finished.
Scott reported great continuity. A wrong initial image choice recovered after
clarification, without redrawing; no runtime repair was made. Startup still took
about 24 seconds to first audio, while ordinary subsequent turns were much faster.
Private PM: `logs/runs/20260922-1035-transition-owner-acceptance/postmortem.md`.
Live failed-save/concurrent-click and sustained idle coverage are not claimed.
No server/model restart is needed. Emergency backend controls,
Reset To Pinned/Clear Latest, unexpected closure and page exit remain separate
lifecycle work; this does not claim a universal transition controller.

### Connection Identity Owner

September 22: after the accepted save/resume checkpoint `d0dbebe`,
`web/sts/realtime-connection.js` now owns the current socket, session generation
and stopped state. Page consumers read that owner directly; active-session
checks and guarded sends use it. There are no mirrored production globals.
The existing generation boundaries, stop behavior and final-transcription
exception are preserved. Prompts, idle policy, context assembly and the
transactional save sequence have not changed.

This was the first part of connection extraction, not a completed lifecycle
controller. The subsequent transition step is recorded above; context
preparation, save orchestration, device cleanup and unexpected closure still
have page-owned responsibilities.

Verification: 641 JavaScript tests, 990 Python tests and isolated Edge checks
pass (one existing Starlette/httpx deprecation warning). Tests compare the old
connection predicates and sent packets, reject stale socket callbacks, and keep
the final user transcript during Disconnect. Edge loads the real page and all
three owners without connecting to Eric; audio/tool-drain checks still pass.
The September 22 09:21-09:26 paired resumed-thread trial passed the exercised
paths: the second Connect loaded the first save plus its ancestry (eight to
nine sessions), both transaction journals matched disk sources and eye hashes,
and the final Disconnect stopped a run with queued speech after generation had
already completed. Scott reported very good continuity. Brief B2/idle activity
and microphone interruption also ran. One eye-inbox fetch failed then recovered;
one private-output fragment was filtered before speech/history. Neither showed
a connection regression. Startup still took about 21-22 seconds; later user
turns reached first audio in 1.5-3.9 seconds. No runtime repair was made.
Private paired PM: `logs/runs/20260922-0926-connection-owner-acceptance/postmortem.md`.
Concurrent preparation, page-exit recovery and extended idle remain separate
coverage. Activation needs only a disconnected refresh, not a server restart.

### Transactional Disconnect Saves

September 22: normal Disconnect now freezes one save identity, transcript,
parent, asset list and measured context receipt. Retries reuse that request;
the page server journals it outside the note shelf and returns the same saved
session after a lost reply or server restart. Different contents cannot reuse
the identity, and replay will not overwrite, resurrect or duplicate an edited,
deleted or archived session. Timed-out preparation cannot submit a late save.

Optional note reload and map refresh no longer delay the disk acknowledgment.
Their late replies cannot pin old history or repoint a newer session. The
ordinary Connect/Disconnect workflow is unchanged; no prompts, model settings,
idle policy or image choreography changed. This completes the save-contract
and unknown-write-outcome steps preceding lifecycle extraction.

Verification includes temporary-disk interruption/restart/concurrent-process
tests and actual page save orchestration through HTTP to an isolated page
server, with intentionally lost replies. Devices/socket teardown in that HTTP
fixture are simulated; separate Edge checks cover real page loading and audio.
All 634 JavaScript tests and 990 Python tests pass; the existing Starlette/httpx
deprecation warning remains. Edge checks pass against the restarted page server.
Browser-close recovery and broader connection ownership remain separate work.
An unsaved failed Disconnect still requires keeping the tab open and retrying.

Activation requires the updated **page server** and a disconnected page refresh,
not an LLM or TTS restart. The new transactional endpoint deliberately fails on
an old page server instead of silently falling back to unsafe writes.
The page server was restarted and checked locally; no realtime connection was
active, and the model/voice servers were left running. Refresh before resuming.

Live acceptance, September 22, 08:01-08:04: two short ordinary Connect/Disconnect
runs saved two complete, matching transaction journals with the correct chain.
The second Connect loaded the first save plus its ancestry (six historical
sessions became seven). Retained-image lookup/staging worked in both, with one
matching eye-asset receipt in each save. Scott confirmed continuity was good.
Run 1 stopped active TTS cleanly; run 2 completed readback after socket closure
without invalidating the save. No save/tool error or duplicate session was found.
Startup still took about 20/17 seconds, mostly in B1; subsequent requests began
audio in 1.2-1.6 seconds. These short runs do not establish sustained idle/B2 or
live failed-save recovery. No further repair was made. Private paired PM:
`logs/runs/20260922-0804-disconnect-continuity-acceptance/postmortem.md`.

### One Save And Resume Workflow

September 22: at Scott's request, the unused Save + Halt / Start Eric control and
alternate implementation have been removed, not merely hidden. Use Disconnect
to save/stop and Connect to resume. Server Management retains only Halt, Restart
and Unload. The save acknowledgment and cleanup-timer fixes remain on the normal
path; the shared unsaved-session guard remains. The previous request to test the
alternate buttons is withdrawn. Tests now exercise Disconnect/Connect instead.
Refresh while disconnected to load this UI change; no server restart is needed.
Verification: 622 JavaScript tests and 157 page-server/continuity Python tests
pass. Isolated Edge checks confirm only the three backend controls remain,
desktop/mobile layout fits, and audio/tool-drain checks still pass. The operator
guide now shows the current panel. No prompts, model settings or idle policy changed.

### Tool Continuation Owner Extracted

September 21: `web/sts/tool-continuation.js` now owns pending tool calls,
response completion readiness, duplicate IDs, round state and audio-drain
waiting. The page still executes tools, checks permissions and constructs the
unchanged follow-up prompt. No prompts, model settings, idle behavior, tool
limits or automatic image-staging behavior changed.

All 609 JavaScript tests and 969 Python tests pass, with one existing
Starlette/httpx deprecation warning; the 144 focused page-server tests also
passed separately. Real
Edge/Web Audio checks confirm that a follow-up waits for playback to drain.
Before/after fixture wire packets match for ordinary, idle, exhausted, denied
and interrupted continuations. The preceding live checks include a 230-second
lecture, microphone interruption, stop-during-speech, reconnect and long-idle
return; these validate the audio baseline, not the new extraction in live use.

The 22:42-22:49 post-extraction comparison passed the exercised resumed-thread
paths from the same parent: nine successful tool calls/follow-ups, interruption,
revision, idle research with B2, and clean cancellation/save on Disconnect. No
backend warnings/errors were recorded. Ordinary replies reached first audio in
1.356-3.858 seconds; startup remained about 18 seconds. This is not full lifecycle
acceptance. The [ownership plan](sts-lifecycle-ownership-plan.md) records the
comparison and remaining coverage. Occasional forgotten eye staging remains an
accepted conversational continuity signal, not a repair item. Activation needs
only a disconnected page refresh, not a backend/model restart.

### Lifecycle Review Before The Next Extraction

Checkpoint `1f52674` preserves that accepted state. Offline review then reproduced
four failure-path defects: duplicate session creation after successful save but
failed reload; timed-out preparation continuing after retry; Start Eric rejecting
its own saved transcript; and stale cleanup timers clearing newer cleanup state.
These were not observed failures in the accepted live comparison. Repair those
transitions before moving their ownership;
the [ordered work plan](sts-lifecycle-ownership-plan.md#next-boundary-stop-save-and-reconnect)
separates save receipts, unknown write outcomes, connection identity and cleanup.

Eight new simulated stop/save orchestration tests bring the JavaScript suite to
617 passing tests. The 13 Python continuity tests also pass with temporary disk
storage. This is not yet an integrated browser-to-durable-storage failure test,
and the injected defects were not fixed by that review. The first repair now
guards cleanup release with operation identity, including late finally blocks;
49 focused tests pass. Start Eric now uses normal connection preparation and
retains saved-state acknowledgment until startup succeeds; 34 focused
save/navigation/replay tests pass, including failure and retry. A failed optional
note reload now warns without invalidating the disk-save acknowledgment; both
exit paths and resume without a duplicate write are covered (15 save-lifecycle
tests pass). The remaining timeout/unknown-write-outcome work and live acceptance
remain open. No diagnostics or servers were changed.

September 22 verification of these three separately committed repairs: 624
JavaScript tests, 969 Python tests, and isolated Edge/Web Audio/page-load checks
pass. One existing Starlette/httpx deprecation warning remains. Activation is a
disconnected page refresh; no backend restart is required. The next production
change was the save timeout/unknown-outcome protocol, now completed above before
lifecycle extraction. The dated counts here describe those earlier checkpoints.

### Full Notes And Stable Live Context

September 21 checkpoint: ordinary notes no longer suffer a second silent
4,500-character per-file clip, 64K aggregate clip, or eight-file pin eviction
after context admission. Connection-time tokenizer budgeting remains in force;
live note reads measure the full B1 receipt before activation. Routed setup-card
admission remains separate. Long saved transcripts and variants have a distinct
storage allowance; ordinary note tools retain their existing storage limit.

The loaded-note system prefix stays fixed for a connected socket. Explicitly
loaded revisions and unpins are appended at safe conversation boundaries rather
than rebuilding the system prefix. A completed read receipt is reused instead
of duplicating its full body. Reconnect assembles current pinned content anew.
Writing a file does not itself activate a new pinned revision.

Repeated resumes of the same rich parent showed normal conversation and warm
subsequent requests after initial connection prefill. Complete outgoing-body
audits verified all expected notes in the measured requests. These are delivery
and cache receipts, not guarantees of model recall. One earlier run spoke answer
drafting aloud; later trials did not reproduce it. Its cause remains unresolved.
The final trial also exposed a usability gap: reading a note pins it, but there
is no explicit pin tool and its read description does not explain that side
effect. That repair is deferred, not claimed complete in this checkpoint.

Temporary engine streaming, request-shape receipts, note-delivery checks and
private response samples were disabled after the trials. Diagnostic code remains
opt-in for a future recurrence. Normal usage/context reporting and GPU/TTS display
remain enabled. No personality, idle cadence, or model setting changed for this
checkpoint. See [Connection Context](connection-context.md) and
[Metrics Capture](llm-metrics-capture.md) for boundaries and rearming procedures.

The local cleanup archived 58 sessions, retaining 27 recent/dependency sessions.
All retained ancestry/pin references and 173 distinct eye assets verified; no
archive transactions remain pending. Older snapshots and diagnostic bundles moved
to the adjacent private archive with checksums and recovery manifests. This did
not publish session contents or modify core notes.

Checkpoint verification: 969 Python tests and 599 JavaScript tests pass, including
documentation-link checks. The Python suite reports one existing Starlette/httpx
deprecation warning. New diagnostic/storage test modules pass the undefined-name
and unused-import checks. Detailed capture is confirmed stopped and disarmed.

### Save-Time Context In Session Map

September 20: new session saves carry the latest measured B1 input-token count,
its original context-window size, model identifier when known, and observation
time. The list and lineage nodes display `CTX n%`; selected details expose the
original counts/time. Switching model windows later does not recalculate history.
This is the last measured request, not a peak, B2 occupancy, or resume estimate.
Older/missing/invalid receipts stay unknown, without transcript-length guesses.

The optional source-hashed receipt lives beside session variants as
`<session>.context.json`, not in the transcript or automatic memory load. It
archives with its session. Receipt-write failure reports a warning without
turning an authoritative transcript save into a failed Disconnect. No additional
model request, prompting, context rewrite or detailed logging is required.

Verification: 941 Python tests and 590 JavaScript tests pass. Headless Edge
verified known/unknown values, original 65K versus 128K windows,
selection details, and desktop/mobile layouts with no JavaScript errors or new
text clipping. Tests cover persistence, archival, stale hashes, optional telemetry
failure, reconnect reset and exclusion of isolated/aggregated usage. The existing
continuity module's mypy errors remain; the changed measurement helpers add none.
September 20 evening live acceptance: the refreshed 21:34-21:45 Mars homecoming
run saved 80,849 / 131,072 tokens in the source-bound sidecar, and the live session
list API returns that receipt (CTX 62% with the map's rounding). This verifies
live capture/save/readback; the map rendering itself was previously checked in QA.

### Connection-Time Context Budget

September 20: Connect now checks a complete startup estimate with LM Studio's
loaded-model tokenizer and native tool template. It reserves 32K tokens for new
conversation plus explicit B2/output/margin allowances. When needed, it tries
cached, source-linked excerpts of the middle sessions before opening the socket.
Session indices run oldest-first: `N` defaults to 1, protecting the opening
session. Condensation stops as soon as the budget fits, leaving the largest newest
tail (`M`) intact, with at least one recent session protected by default. Both
boundaries are explicit configuration. It does not install live folding,
automatically reconnect, change idle
pace, or rewrite source sessions, pins or personality instructions.

An isolated browser check admitted the rich branch unchanged at the currently
loaded 128K window, with about 62.4K growth room after headroom. Simulated smaller
windows exercised actual excerpt preparation and rejection: 96K fits after
excerpting session 1 only, leaving session 0 and the newest three intact. With
both ends protected, 65K does not fit this branch with an 8K/16K/32K reserve. Empty
Connect fits at 65K with the default reserve. No model settings or live session
were changed for these checks. Live acceptance of condensation remains pending.

Verification: 927 Python tests and 583 JavaScript tests pass. Isolated headless
Edge loaded the page without JavaScript errors; checks exercised raw admission,
middle-only excerpts, impossible budgets, unchanged-source failures, and cached
preparation without a live websocket, TTS, microphone, camera or image generation.

Activation and unchanged-history live admission are now verified. The page server
restarted September 20 at 15:12, and the refreshed 21:34 connection admitted three
prior sessions: 54,989 startup tokens, 66,867 growth room, 131,072 window, zero
sessions excerpted. The first measured request was 55,583 tokens. Live middle-
session condensation and overflow recovery remain unvalidated. An earlier run
without admission/save receipts appears to have used an unrefreshed browser tab.

See [Connection-Time Context Budget](connection-context.md) for settings,
activation, source-preservation rules and measured limits. This replaces the
previous immediate plan for automatic mid-session rollover; overflow recovery
itself remains unfinished.

### Offline Context Overflow Rehearsal

September 20: `context_overflow_lab.py` prepares source-bound candidate memories
from saved PM artifacts using the existing chunked summarizer. It preserves
operator/System evidence, recent exchanges, and compact tool outcomes; it never
installs a live replacement. Tests also reproduce B2's stale-request exposure
when completion leaves its bounded transcript/receipt windows, and verify that
a provider context error does not itself compact shared idle history.

Live overflow management remains unfinished. The transcript-only rehearsal cannot
establish full-request savings or explain a usage drop without request captures. See
[Context Overflow Rehearsal](context-overflow-rehearsal.md) for scope and the
remaining deployment gates. Raw trial outputs remain private under `logs/`.

The follow-on `context_wire_lab.py` automates full-request comparison with
verified image artifacts and source-linked recall checks. Its first candidate
was rejected for insufficient shared-65K headroom. The initial bundled recall
scores were also weak, but clearer individual probes subsequently recovered all
12 baseline answers; those earlier scores did not establish memory loss.
Answer accuracy and literal quote support are now reported separately.

`context_compaction.py` can fold superseded controller runtime/alone-state
snapshots at a closed tool boundary. It preserves dialogue, receipts, image
records, other controller sections and the latest state. This is a pure offline
primitive, not a per-request filter or installed rollover. The lab also protects
older reply starts and marks excerpt gaps. Native tool schemas are included in
size measurements; recall probes disable tools and do not validate live task
execution. See the rehearsal report for measured candidates and deployment gates.

### B2 Advice And Combined Audit

September 20: private `note_for_eric` now allows 1,000 characters instead of
280 on both ordinary and headline mulls. The compact one-sentence advice prompt,
generation token budgets, 96-character mouth/monitor aside, and B1 admission
rules are unchanged. Each returned note carries original/delivered character
counts and an explicit truncation flag, recorded alongside B2 activity.

`logs/live/latest-companion_audit.txt` adds a chronological view of the current
conversation transcript and private B2 events. It uses full UTC timestamps to
order across midnight and keeps the transcript's local clocks and speaker names.
Existing conversation, B2 and event logs remain separate and unchanged in purpose.
The audit is included in automatic, manual, recording-stop and disconnect
snapshots, with best-effort unload saving. It requires no audio recording.

Private advice, mouth dispatch, queued monitor speech, and browser speech
start/end callbacks have distinct labels. None proves that sound reached the
room. Transcript replacements appear in their final form, not as a token-stream
replay. The combined audit never enters B1 or B2 memory; it cannot retroactively
add missing playback receipts to old runs. Oversize advice still has a safety
cap, now observable rather than silently assumed intact.

Restart the page server and refresh STS while disconnected to activate both
halves. No realtime/model restart or prompt change is required.

Verification: 565 JavaScript tests and 885 Python tests pass (one existing
Starlette/httpx deprecation warning). An isolated headless Edge check loaded
the served page with no JavaScript errors and confirmed full-length advice in
the audit, absent from the ordinary transcript. No model generation or live
conversation was used. The page server was restarted; operator refresh and
live acceptance remain pending.

### Audio Playback Owner Extracted

September 20: `web/sts/audio-playback.js` now owns queued PCM, flush timers,
pending browser setup, scheduled sources, playback generation and audio-clock
busy/playing checks. The page keeps its existing entry points as adapters, with
one owner and no mirrored playback state. Microphone policy, gain/recording
setup, mouth cues and conversation scheduling remain with the page.

Preserved: 16 kHz mono PCM, 9,600-byte immediate flush threshold, 120 ms tail
timer, 30 ms scheduling lead, sequential playback, recording tap, stop and stale
connection guards. No prompt, output filter, sentence limit, voice setting,
context assembly, B2 or idle policy changes. No server or live session restarted.

558 JavaScript tests and 129 focused page-server Python tests pass. Existing
audio, microphone and composed lifecycle regressions now use the exported owner
through the actual page wiring. Eleven added tests cover batching, PCM order,
gain/recording connections, playing versus queued state, errors and late callbacks.
A headless Edge check used real Web Audio clocks and signal sampling to verify
serialization, suspension, stop/restart and a live recording tap behind muted
playback gain. The actual STS page loaded the new module on desktop/mobile with
no JavaScript errors. No model, mic, camera, paid art or live websocket was used.

Refresh STS while disconnected to activate. **Live acceptance remains pending:**
long speech, an interruption, draw/show, idle, return and disconnect/reconnect.
Do not extract the next owner until delivery and initiative still feel right.
See the [ownership plan](sts-lifecycle-ownership-plan.md) for the remaining scope.

### Lifecycle Groundwork

The stable checkpoint is published as `2472bbd`. The separate
[lifecycle ownership map](sts-lifecycle-ownership-plan.md) identifies current
owners, preservation rules, coverage gaps and the first proposed extraction:
audio playback ownership. Seven new composed replay tests exercise real page
functions across tools, retained images, audio drain, cancellation, stop and
reconnect guards. External services, hardware and durable saving are mocked;
these are not complete end-to-end session tests. No production behavior or
prompts changed in this groundwork. That checkpoint passed 547 JavaScript tests.

### September 20 Checkpoint

The public overview now includes bounded denied-tool recovery, idle note writing,
retained-image retrieval, startup failure checks and disabled experimental deep
thinking. Sidebar resizing now permits up to 930px (previously 620px), still
bounded by 48% of the viewport; the default and 225px minimum are unchanged.
Browser drag tests covered 2560, 1440, 980 and 390px widths without page overflow
or JavaScript errors. Existing successful behavior remains the baseline for the
next lifecycle ownership/transition-testing work, not a mandate for a rewrite.

### Experimental Deep Thinking Disabled

September 20, after the context-and-mirror run: STS no longer advertises
`deliberate_once`. The browser gates both manual Think and model entry points,
including the shared request boundary, before any network or conversation
mutation. Think/depth controls are disabled and the status pill reads THINK OFF.
The experimental implementation and backend endpoint remain available in source,
but normal STS cannot invoke them. No model, B2, idle or sampling change.

Prompt change disclosed: removed the paragraph directing "think harder" and
similar requests into `deliberate_once`, from both the served base prompt and
browser fallback. There is no replacement behavioral script. Prior prompt
snapshots are historical and were not regenerated.

Refresh STS while disconnected, then Connect to resume. The page and base prompt
are read from disk by the running page server; no server or LM Studio restart is
required. Tests cover absent tool advertisement, blocked direct/manual requests,
disabled controls and unchanged normal Send/Say availability.

### Retained Generated-Image Retrieval

September 20: the September 19 Valles Marineris failure was a retrieval gap,
not a lost image. Generation completed after an interruption and correctly kept
the artifact on disk without replacing the current display. The move tool only
consulted the preview or pending idle delivery, so it could not use that receipt.

`move_generated_image_to_sensing_eye` now accepts an optional exact `filename`.
It reads that artifact through the existing bounded `/generated-images/` route
and uses normal eye saving/staging. It needs no in-memory artifact list, works
after a refresh when the filename is known, and makes no generation request.
Without a filename, the existing preview/pending-image behavior remains. A
missing or invalid filename does not fall back to a different picture. Pending
idle delivery retains single-owner staging and exact-identity checks.

Late generation receipts now explicitly report `retained: true`,
`displayed: false`, `staged: false`, and the exact retrieval tool arguments.
Retrieval cannot overwrite newer user/session, eye or preview activity during
loading or eye saving. An unrelated preview is left alone. This changes the
move tool's schema/description and artifact receipts, not personality prompts,
idle timing, permissions, B2 scheduling or model-chosen task order.

All 537 JavaScript tests pass. New regressions first reproduced the gap, then
covered interrupted generation to exact retrieval, refresh-independent lookup,
missing/unsafe names, unchanged preview moves, asynchronous freshness and pending
idle ownership. A read-only request for the actual failed-run image returned
HTTP 200 with 1,450,847 bytes of PNG data. No paid generation, private-note write,
server restart or active-session change was made. The subsequent September 20
live run retrieved two retained generated images by exact filename and staged
both successfully. The Imagined Image preview remained empty and an extra render
was initiated during the first completion; those are separate remaining workflow
issues. No additional diagnostic run was needed to implement the repair.

### Note Writing During Idle

September 20: ordinary full-context idle now permits `write_text_file` when
the operator's local-file tools are enabled. The September 19 Tool Recovery
Probe established the unwanted restriction: research succeeded, the idle write
was denied, and saving only succeeded after Scott returned. That scope-only
ban is removed; a new user utterance is no longer required to allow the write.

This uses the same notes-root sandbox, supported extensions, size limits and
atomic writer as conversation. Existing append/overwrite semantics are unchanged;
this is not a new create-only policy or protection for individual note folders.
The separate remember/forget tools, physical effects and other excluded idle
capabilities are not newly enabled. File tools off still means no file writes.
First Contact's existing tool exclusion remains. No English consent detector,
new checkbox, tool-description change, personality edit or extra model call.

All 528 JavaScript tests and 52 focused Python note-storage tests pass. The new
fixture first reproduced the denied research-to-note path, then exercised the
normal writer with intercepted I/O and continuation. No private note was written
by these tests. Refresh STS while disconnected to activate, then resume the same
thread; no server restart needed. Live model acceptance remains pending.

### Denied-Tool Recovery

September 19 follow-up: a scope denial now returns its structured, non-retryable
receipt through the existing general continuation instead of terminating the
whole batch. Successful sibling receipts remain available before that response.
Eric can choose permitted work, a reply or silence; STS does not choose an
alternative tool or supply a spoken line. Disabled effects remain blocked.

Recovery consumes the existing `tool_continuation.max_rounds` allowance (8 by
default). Exhaustion permits the existing final tool-disabled response; any
provider-emitted tool beyond that boundary receives a budget receipt without
execution or another automatic response. A new user turn or ordinary scheduled
idle opportunity resets its own budget as before. No new cooldown or permanent
quiet state is introduced.

All 526 JavaScript tests pass. Regressions cover denial plus successful siblings,
permitted recovery, repeated denials, duplicate call IDs, playback drain, new
user activity, disconnect, and a provider ignoring the final tool-disabled
boundary. Unknown paid-generation outcomes still prohibit automatic paid retry,
including after a denial. The old terminal behavior was reproduced first.
Personality and general follow-up prompts, tool catalogue, permissions, B2
scheduling, model settings and idle timing are unchanged.

Browser-only repair: refresh while disconnected, then resume the existing
thread. No server restart or active-session change was performed. Live
acceptance remains pending. This is distinct from the latest interrupted-image
retention/retrieval gap and B2's tool-continuation scheduling exclusion; neither
is claimed fixed by this change.

### Explicit Startup Failures

September 19 follow-up: the normal gold launcher now checks native exit codes
after both `lms unload` and `lms load`, matching the existing restart path's
fail-fast policy. A failed unload prevents cleanup/load/server launch; a failed
load prevents subsequent cleanup/server launch. The error identifies the failed
phase and exit code. Model choice, context size, parallel slots and successful
startup arguments are unchanged.

The regression fixture first reproduced an unload failure falling through to
server launch. All six launcher checks now pass: two argument-forwarding cases,
unload failure, load failure, missing CLI and successful preload. Tests execute
the real script statements with inert model/process/server substitutes; no live
model was unloaded and no service restarted. This verifies exit-code handling,
not model readiness or recovery after a failed load. Dependency/version capture
and broader startup health checks remain separate work.

### September 19 Checkpoint

Current source combines complete optional-card admission, compact searchable
file receipts, idle Eye recall and image-handoff repairs, the measured cache
investigation, TimerCam integration/auto-exposure, and small sidebar layout
improvements. Personality prompt files are unchanged in this batch; tool
descriptions, routed-card assembly and four explicit idle timing values changed.
Setup cards are optional, not a requirement for baseline companionship.

The page helper was restarted after the camera addition; camera proxy and
browser checks passed. This checkpoint does not restart services or change
the loaded model. Earlier dated sections below preserve their original
deployment/test status; later activation records supersede those statements.
The latest full suite passes 521 JavaScript and 871 Python tests, with one
existing Starlette/httpx deprecation warning. Scoped Ruff checks retain the same
six pre-existing page-server findings; the other checked changed Python files
pass. Optional detailed LLM capture remains off. Private notes, PMs, images and
firmware fallback binaries are not part of the Git checkpoint.

The latest Empty Connect Mars trial completed five image generations, all five
Eye transfers, and one search without failed tool receipts. Context rose from
14.6% to 32.8%; median first server audio was 2.24 seconds and the final reply
1.39 seconds. These are end-to-end measurements, not an exact cache-reuse test.
Audio recording was off. B1 resisted the fictional premise initially and twice
described a generated picture before inspecting it; B2 noticed the correction
but did not ensure consistent follow-through. One filtered reply recovered on
retry. No prompt repair was made in response to this PM.

Remaining acceptance work includes sustained idle at the new 1x baseline,
queued background-art race paths in live use, and model-driven TimerCam use.
The Mars run did not exercise those paths, file lookup, or chassis controls.
Keep permission/execution repairs separate from interpretation and personality;
do not turn these behavioral gaps into English phrase-matching rules.

### ESP32 Camera Into Sensing Eye

September 19: added an optional ESP32 Camera section beneath Browser Live
Camera, with snapshot preview and Capture To Eye. A separate
`capture_esp32_camera` tool gives B1 the same one-shot saved/staged image path.
`set_esp32_camera` adds matching on/off and optional capture-on-start control;
both tool descriptions identify the camera as TimerCam as well as ESP32.
Preview alone never supplies visual context, writes image memories, or invokes
the model. No personality, browser-camera, motor or idle-permission changes.
New tool description only; no behavioral prompt repair.

The page helper reads only the operator-configured camera's `/jpg` endpoint,
without accepting arbitrary client URLs or following redirects. Reads are
bounded, serialized, JPEG-only and uncached. Preview polls sequentially, stops
on error, and is canceled on Disconnect/page exit. Late captures cannot refill
a cleared eye or cross session/user-request boundaries. Config is under
`esp32_camera` in `config/runtime.json`; no firmware change required.

Live hardware initially accepted TCP but did not answer HTTP. After Scott
closed the chassis camera viewer, `/status` and `/jpg` responded successfully.
This matches the firmware's blocking MJPEG loop. Do not keep a separate MJPEG
viewer open while using STS snapshots. Page helper restarted and the live camera
proxy returned a JPEG. Headless Edge checks at 1440x1000 and 390x844 captured
and decoded actual 240x320 upright frames, exercised preview on/off and the eye
handoff, and verified no page errors. Test saves were intercepted to keep QA
images out of Scott's memories; no live LLM session was opened. All 521 JS and
871 Python tests pass (one existing Starlette/httpx deprecation warning).
Refresh STS while disconnected to load the new controls/tool.

TimerCam brightness follow-up: built the original fixed-exposure firmware as a
local fallback, enabled primary sensor auto-exposure, removed the fixed value
of 220, and flashed `timer-cam-ota` to `192.168.0.252` successfully. The rebooted
board reports `aec=1`, `aec2=0`, `agc=1`; direct JPEG and STS proxy captures both
succeed. The comparison frame is visibly brighter, but this was not a controlled
lighting test. Brightness +1, gain ceiling, QVGA and all other sensor settings
remain unchanged. Source and fallback binary are retained locally under
`logs/maintenance/20260919-timercam-auto-exposure/` (ignored, not for publishing).
Build succeeded for both versions; no changes to chassis firmware or servers.

### Active Idle At Normal Speed

September 19: Scott wants a thinking companion without routinely selecting
10x-plus Lab Speed. Only four existing `idle_timing` configuration values change:
`minimum_gap_s` 90 -> 9, `drift_base_s` 270 -> 27, `drift_step_s` 22.5 -> 2.25,
and `drift_floor_s` 45 -> 8. Independent Drift 1-10 now has the same base waits
at 1x as the previous configuration at 10x: 24.75 down to 8 seconds. Drift 8 is
9 seconds. These are opportunities after activity, not guaranteed speech times.

Human quiet/attention timing, B2 logic, headline cadence, art grants, playback
ownership, user priority, full-context idle, prompts and sampling are unchanged.
This is not a promise to occupy every GPU cycle or a new private-reasoning loop.
Normal B1 idle still waits for existing speech and tool work; B2's existing
fresh-evidence checks and timing apply. No new instrumentation or model calls.
Use Lab Speed 1x for the next trial: 10x now further compresses these waits.
The page helper reads this file on demand; refresh while disconnected to apply.
No server restart is required. Live acceptance remains pending.

### Compact File Lookup

September 19: repaired the oversized catalogue seen in the lighthouse trial.
The existing eye-tool names remain compatible, but now accept a query and return
five compact matches by default (maximum eight), with explicit pagination.
Names, saved reasons and attributed past remarks help find files; old dialogue,
capture-adjacent transcript, duplicate paths/URLs and file contents are not put
back into the conversation just to identify a file. Exact saved IDs can reopen
files beyond the former newest-25 window without listing first. Ambiguity stays
visible: STS returns candidates, not a guessed replacement for the eye.

Replaying that saved 32,414-character receipt through the new projection yields
1,710 characters for the first page (94.7% less), or 558 for a targeted single
match. This is a serialized-character comparison, not measured token/cache/latency
improvement. Existing oversized receipts already in history are not rewritten;
the repair prevents future lookup bloat without invalidating the live prefix.
Ordinary note lookup also defaults to five names, capped at eight. Operator
note shelves and the session map remain unchanged. Known filenames still read
directly. Tool schemas/descriptions change; personality, cadence, idle scope,
sampling and model configuration do not. No new telemetry or model calls.

Offline tests cover bounded payloads, both eye aliases, old-file lookup, exact
identity, ambiguous matches, Unicode, pagination, stale page helpers and recall
freshness. All 506 JavaScript and 861 Python tests pass (the existing
Starlette/httpx warning remains). September 19, 12:35: the page-only restart
succeeded through the standard launcher after the earlier denied attempt.
The served browser lookup functions passed read-only checks against the live
helper: five compact matches across 167 saved files, a single targeted match,
and exact-ID resolution. Boot-note B1/B2 routing also passed. Browser refresh
activates the client changes; conversational acceptance is still pending.
Realtime, LM Studio, TTS and Browser Face stayed running.

### Lighthouse Recovery Trial

September 19, 11:52-12:00: positive continued run. Search/draw/eye/explain,
a second image and recall of the first all succeeded; ambiguous recall recovered
without regenerating. After the 14.787-second opening, first server audio for
user turns was 1.282-2.903 seconds, including 2.642 seconds on return after idle
search. Engine capture was off, so there is no measured cache-reuse percentage.

The deliberate idle write was denied and ended its tool continuation. A new
idle turn delivered the already-researched story, and a real write succeeded
after user return. This is recovery via the scheduler, not validation of a fixed
denial path. The authored note incorrectly claims an idle write succeeded;
execution receipts, not that note, establish the result. B2 also delivered one
assessment already behind completed tool events.

Concrete follow-up: image listing returned 25 records / 32,414 characters;
the adjacent prompt grew 13,037 tokens. Overall context rose 32.3% to 54.4%.
Compact searchable image metadata deserves priority alongside denial recovery.
Two cards survived post-save pin churn; ordinary profile-pin eviction remains
the existing policy. No queued idle-art job or provider rejection occurred,
so those paths were not exercised. No runtime changes made by this PM.
Private evidence: `logs/runs/20260919-120013-lighthouse-recovery-probe/postmortem.md`.

### Context Refill Investigation

September 19: reproduced the long GPU/no-output stretch outside STS. With 32
rewind checkpoints, LM Studio's saved prompt state exceeded its 8 GiB RAM cache
limit; the next return reevaluated 59,844 tokens in 20.46 seconds. Eight checkpoints
kept ten equivalent image/B2/return cycles warm; the failing request became
31 evaluated tokens / 0.42 seconds. Full 128K context, two slots, model, prompts,
history and idle behavior are unchanged. Applied to the active model and its
workstation-specific default; the first image-heavy live acceptance is below.
Another ten-cycle test at 74K-81.6K input tokens also kept every return warm.

The numeric collector now preserves oversized-cache-save and restore-failure
diagnostics without prompt/output text. Eight focused telemetry tests pass.
See [cache measurements and configuration](llm-metrics-capture.md#oversized-cache-state-2026-09-19).

September 19 live continuation (10:33-10:58): after the initial 41,839-token
load, all 56 measured completed B1 calls reused at least 90.1% of their prompt
(median 98.4%); no subsequent full refill or oversized-cache-state warning was
recorded. Context reached 83,743 tokens / 63.9%. Median subsequent prefill was
1.07 seconds, worst 8.90 seconds: positive acceptance, not uniformly instant
inference. One fully filtered private-output reply needed a retry near the end.

### Idle-Art Handoff Repair

September 19 Boston continuation: eleven images generated, nine staged, two
completed background files stranded. A B1 render request can pass the page's
`busy` preflight, clear the image reference, then be rejected by the controller
because a completed result is `ready`. Move-to-eye then sees no image; later
delivery sees the wrapper's clearing as a replacement and retains the file.
The files are intact and idle-art permission was enabled. This is not evidence
for restricting autonomy or rewriting Eric's prompt.

Reproduced using the actual page functions/controller with mock I/O. Repaired
separately from note admission: preflight rejects another render before preview
mutation; automatic and model-requested moves share single-owner staging of the
completed artifact. History distinguishes ready, staged, retained and display
failure. Real user/eye replacement, cancellation and permission revocation still
prevent late delivery. Tests exercise actual page callbacks as well as controller
state; no paid generation, new cooldown or behavioral prompt was used.
Private evidence: `logs/runs/20260919-105831-boston-idle-art-handoff/postmortem.md`.

### Complete Optional Card Admission

September 19: explicitly routed notes now have a separate eight-card / 32,000
UTF-16-unit B1 allowance configured in `config/runtime.json`. Direct loads and
restored threads validate whole sets before mutation; invalid or over-limit
changes fail visibly and preserve prior snapshots. Ordinary pins cannot evict
cards, and cards do not take space from already admitted history. B1/B2 routing
uses the same revisions; private sections stay private and B3/B4 remain inactive.

This changes card-bearing prompt assembly, not card wording or baseline behavior.
Empty Connect still needs no card, and unmarked-note prompt goldens match the
prior formatter. Provider acknowledgement remains the existing session-update
mechanism, not a newly guaranteed atomic B1/B2 transaction. See the
[admission record](setup-card-admission-plan-2026-09-19.md).

Both repairs pass offline mechanism tests; a refreshed, connected continuation
is still required for live acceptance. No real image generation or LLM request
was used in validation.

Verification: 497 JavaScript tests and 857 Python tests pass (one existing
Starlette/httpx warning). Six pre-existing Ruff findings in the page-server
module remain outside this repair. The terminal tool initially rejected the
page-server restart; this was resolved by the successful page-only restart at
12:35 noted above. The runtime-config exposure and typed malformed-card error
are now served by the updated helper. Realtime, LM Studio and TTS were not
restarted or reconfigured.

### Idle Eye Recall

September 19: ordinary full-history idle can now list and recall existing
sensing-eye images/text without the paid-art grant. The old scope denied recall
even when generation was authorized. Generation/staging permissions are otherwise
unchanged; camera capture, eye clearing and session jumps remain outside this
idle allowance. First Contact/performance exclusions still apply.

Recall now rejects asynchronous results superseded by user activity, a replaced
eye, a canceled response or a disconnected/reset session. Its freshness is
independent of the paid-art grant. No personality, cadence, context selection or
spoken-line changes; the stable wire catalogue is unchanged.

Verification: 475 JavaScript tests pass, including 10 new permission/freshness
regressions. No backend code changed and no paid generation was exercised. Refresh
STS to activate; a connected idle-recall trial remains the live acceptance check.

### Contained Browser Repairs

September 19 follow-ups: browser unpin lookup now preserves Unicode letters and
combining marks, rejects ambiguous/punctuation-only matches and respects folders.
Valid B2 questions formed while the public lane is busy now remain in the bounded
private advisory queue for existing turn-boundary delivery. No direct speech,
new idle cadence or prompt wording was introduced; existing stale-result and
guidance-revision checks remain. Broader B2 freshness work is still open.

Pinned-note views and receipts distinguish full, partial, omitted and disabled
B1 admission, including per-file/aggregate clipping and declared instruction
warnings. The formatter's output is unchanged, checked against pre-change prompt
hashes. Pin-limit removals are logged. This measures assembled browser text, not
provider transmission, KV usage or B2 admission. No private guidance/body content
is copied into the diagnostic receipts.

At this earlier diagnostic checkpoint, whole-card admission was not repaired;
the subsequent separate admission repair above resolves that boundary by adding
bounded space and rejecting invalid sets, without removing history. These browser
repairs need refresh; earlier
Python batches still await safe server restarts. No running session was changed.
Verification: 847 Python tests and 465 JavaScript tests pass, with the existing
Starlette/httpx warning. A live companion continuation is still needed to assess
the practical benefit of retained B2 questions; no improvement is inferred from
unit tests alone.

### Archive Safety Stabilization

September 19, third batch (source only, deployment pending): single-session
Archive now rejects connected-browser activity, matching the branch route.
Connect rechecks its save-parent after acquiring its activity lease and before
opening the socket, closing the archive-during-preflight race.

New per-session archives journal a fixed package and hash inventory, copy and
verify all available files before removals, and remove the original session last.
Retry resumes the same package after copy/cleanup/completion-receipt failures,
including across process restarts. Shared asset references and the last active
session are rechecked. Preparation is barred from changing files/receipts under
an archive transaction. Missing/changed asset warnings remain explicit; disk
failures stop archival instead of being counted as successful moves.

The read-only `/api/continuity/archive-recovery` endpoint lists pending work;
the existing Archive POST retries the same source after disconnection. No
automatic startup recovery, whole-branch rollback or legacy-package migration
was added. Cooperative activity leases have heartbeat/restart limitations.
See the [plan and recovery procedure](stabilization-plan-2026-09-19.md).

Verification: 847 Python tests and 451 JavaScript tests pass, with the existing
Starlette/httpx warning. New archive code and tests pass Ruff; older style
findings in the larger page/preparation modules remain outside this batch.
No actual private history/assets were moved, servers restarted, or prompts and
idle behavior changed. Deployment needs a page-server restart and STS refresh;
the preceding storage batch also needs its still-pending realtime restart.

### History Resume Stabilization

September 19, second batch (source only, deployment pending): Auto history uses
the authoritative original when its requested derivative is missing, stale,
unreadable or not validly prepared. Connect no longer queues or waits for LLM
preparation. Ready source-checked sweeps and explicitly enabled summaries retain
their precedence. Inventory receipts identify requested/actual forms, source
hash, sizes and fallback reason. Explicit Prepare forms and post-session
preparation remain unchanged. Missing authoritative sources still fail visibly.

A private copy of notes, logs (including images/audio), configuration and present
environment files was verified by SHA-256: 2,894 files, 961,704,388 bytes. The
repeatable PowerShell backup utility refuses merging and records hashes in a
private manifest. This is same-disk recovery protection, not an off-device backup
or a transactionally consistent snapshot of active servers. See the
[stabilization plan](stabilization-plan-2026-09-19.md) for location and recovery.

Lossless refers to the history API's fallback content, not guaranteed admission
of every character into the model. Browser per-note/aggregate limits are still
present; full context admission remains separate work. Archive recovery was
addressed in the subsequent batch above, not in this resume repair.
No prompt, summary policy, model settings, idle cadence or live servers changed.
Verification: 835 Python tests and 450 JavaScript tests pass; changed Python
files pass Ruff. The existing upstream Starlette/httpx warning remains. No live
LLM generation, history migration or hardware trial was needed.

### Storage Safety Stabilization

September 19: the [stabilization plan](stabilization-plan-2026-09-19.md) starts with
two storage repairs, not behavioral tuning. Approximate note lookup preserves
Unicode and rejects ambiguous normalized paths for both read and delete. Exact
paths and existing title/separator conveniences remain supported. Generated
images now have UUID-suffixed names; image bytes and metadata are each published
atomically without overwriting existing files. Legacy names remain readable.

Regression cases first reproduced the wrong-note selection/deletion and
same-second image overwrite. Tests cover Unicode marks, ambiguity, handler
receipts, concurrent mock generation, collisions, and disk-failure cleanup.
No existing notes/images, prompts, idle timing, model settings or firmware were
changed. No live generation or server restart was performed. Deployment requires
page/realtime server restarts at a safe disconnected boundary, not just refresh.
This first batch did not address long-session resume, archive recovery, context
admission or B2 delivery; the subsequent history batch above addresses only
preparation blocking resume.

Verification: 824 Python tests and 450 JavaScript tests pass. The Python run has
the existing upstream Starlette/httpx deprecation warning. Changed Python files
pass Ruff. Tests use temporary storage and mocked image generation; these results
are not a new live companion or hardware trial.

### Pending Replies And Context Accounting

September 18: native speech replies now emit `response.created` when queued,
before any model output. STS and the backend therefore retain response ownership
through a slow provider wait, using existing completion/failure/cancellation
events to release it. Previously the UI's temporary user-turn hold could expire
while a real reply was pending, admitting an extra idle response. No idle timing,
prompt, card, output-length or creative-initiative changes are part of this fix.

The CTX badge now consumes `robot790.request.usage`, carrying one provider input
count, rather than accumulated `response.done` usage. Original response totals
remain available for workload accounting. Numeric `B1 request usage` records
include request/turn/generation identity without prompt capture; the status API
prefers those counts, skips isolated requests and labels old-log fallback as an
estimate. Neither measure describes KV reuse, physical cache occupancy or VRAM.

The motivating run had an overlapping idle admission during a 45.9-second B1
wait, and response totals that temporarily added two roughly 63K prompts into
126K. This repair removes the overlap opportunity and the misleading sum; it
does **not** establish why that first provider wait was slow. Cache/eval timings
were not captured in that run. Preserve the successful companion behavior and
evaluate another normal continuation before making further performance changes.

Regression coverage exercises native text/audio input, pre-output interruption,
failure, duplicate admission, per-request versus aggregate usage, isolated/stale
usage, and an active reply surviving 90 seconds at 12x lab speed. Deployment
requires a realtime/page-server restart and an STS browser refresh; ordinary
Connect can resume the existing conversation. No LM Studio model swap is needed.
Verification: 803 Python tests and 450 JavaScript tests pass. Page and realtime
servers were restarted with the same model/settings, and the status API and idle
realtime pool were checked. Refresh STS before the next connection. The new
lifecycle still needs a live companion continuation; no paid art trial was run.

### Idle Art Preference

September 18: Idle art now retains the operator's on/off choice in browser
storage, like other tool preferences. Disconnect still revokes its session grant
and discards queued work; reconnect obtains a fresh grant if selected and image
tools are enabled. Image tools can suspend it without erasing the preference.
Default remains off until selected. No quota, timing or personality changes.

Verification: 449 Node tests and seven Python idle-art tests pass, including
refresh/reconnect persistence, explicit off, pending-authorization cancellation,
late-result isolation and failed authorization. No paid images were generated.
Refresh STS after ending the active run to load this client-only change; no
server restart is required.

### Spoken Note Lookup

September 18: the companion-card trial exposed two empty shelf searches for an
existing file: query `setup cards companion robot`, and directory `setup cards`
with query `companion robot`. Paged listing now normalizes spaces, hyphens,
underscores and path separators for search while preserving directory-component
boundaries. Results retain canonical filenames; ambiguous matches remain listed,
not silently chosen. No English vocabulary mapping or prompt changes.

Eight regression cases cover the failed queries, nested scopes, ambiguity and
non-English names; 62 note-file/routing tests pass. Eric independently recovered
and read the exact card during the live run. The later September 18 page-server
restart deployed the lookup fix after that conversation had ended.

### GPU Speech Tint

STS and Browser Face retain their purple total-load trace, with amber segments
where observed Qwen3-TTS synthesis overlaps a sample. No new numbers or Browser
Face labels. This is activity annotation, not per-process GPU attribution: LLM
and TTS can overlap. It uses existing TTFA/completion log timestamps, not speaking
animation or audio playback. First-audio timing identifies in-flight synthesis;
completion timings correct the recent interval. Sampling/logging adds a short
delay; an unclosed activity observation expires after 60 seconds. The reader is
bounded to 128KB and a two-minute window, and missing logs leave the trace purple.
No realtime/TTS pipeline or prompt changes. Both UI servers were restarted;
refresh both pages to load the renderer changes. Verification: 19 Python and 125
JavaScript tests, synthetic-history Playwright screenshots in desktop/narrow
windows, Browser Face amber-pixel checks, and both live telemetry endpoints.

September 18 visual refinement: both graphs now fill to the baseline in matching
purple/amber colors. Speech-active intervals have their own amber area rather
than tinting over purple; amber fill opacity is softened to 24% on both surfaces
(10% for stale Browser Face samples). Browser Face remains free of telemetry labels. Activity
detection and the realtime/TTS pipeline are unchanged. Refresh both pages to load
the updated renderers; no model or realtime-server restart is needed.

### Companion Alignment

The [September 17 alignment audit](companion-alignment-audit-2026-09-17.md) was
corrected after it exceeded the requested scope. Review recent changes against
`74312a6`, not older mechanisms that have worked well. The scoped concerns are
the new indefinite wait (removed), batch-wide termination after a denied tool,
and an assessment-freshness check lost in the recent B2 advisory rewrite.
Inherited note clipping, busy-question handling, response length, capability
policy and broader B2 architecture are not on this repair roster.

The [Companion Design Contract](companion-design-contract.md) is the acceptance
standard: active full-context idle, initiative, shared-task continuity, one public
mouth and model-selected meaning. Repetitive speech is a failure to correct, not
a reason to stop cognition. The audit made no additional runtime or prompt changes;
its prioritized repairs and offline evidence are recorded in the report.
Operator clarification: the longstanding one-sentence default is intentional and
must remain unchanged; it is excluded from companion-alignment repairs.

September 17 follow-up: the [B2 companion advisory trial](b2-companion-advisory-trial.md)
revises B2 role/task wording and the two active cards' B2 sections. Assessment
of completion belongs in private diagnostics; advice to Eric should contribute
content or remain empty, except to honor actual operator instructions. A bounded
local replay improved after the initial revision failed. The 12:46-13:10 live
continuation then completed draw/eye/explain without a reminder, sustained 26
idle turns with clear B2-to-B1 idea uptake, and summarized its evolved idea when
the user returned. No repeated waiting loop appeared. This is a successful rich-
context trial, not a guarantee across setups. 137 focused tests passed before
deployment. B1, timers, sampling, full context and tool execution are unchanged.
PM: `logs/runs/20260917-131021-memory-jar-companion/postmortem.md`.

### Idle Denial Loop

**Latest live result: September 17, 12:46-13:10 successful companion trial.**
The memory-jar premise developed into attention rings, salvage and crystallization
without new user speech for about 22 minutes. B2 supplied concrete possibilities
that B1 elaborated. Return first audio was 3.931s; the ensuing summary 2.640s.
Context grew 29.12% -> 39.59%. One 22.497s idle LLM stretch remains unexplained;
news was fetched twice but not discussed. Lab speed rose from 5x to 12x during
the run. No behavior changes were made in its PM; preserve this working example.

**Earlier live result: September 17, 09:38-10:15 encouraging but incomplete.**
Two draw/eye/explain sequences succeeded after reminders. Thirty-seven idle
dispatches produced sustained creative development, including older-context
connections, but repeated closings and a nearly verbatim final passage remain.
B2 still advises waiting/"capstones"; three headline selections never entered
spoken conversation. Clearing the eye preceded a broader focus, not a history
erase. Context grew 27.35% -> 44.18%; a separate startup overlap has anomalous
usage accounting and needs a targeted test, not a confirmed cache diagnosis.
Only the requested STS 1500px width cap was removed; no further runtime or prompt
changes. PM: `logs/runs/20260917-101518-grandma-cloud-idle/postmortem.md`.

**Earlier live result: September 17, 09:31-09:33 failed after wait-tool removal.**
Eric promised a rain-bottle render/eye/explanation repeatedly but issued zero
tool calls and answered none of the mechanism questions. All three idle turns
again announced quiet. B2 initially treated the unsubmitted render as pending;
later advice did not recover execution. No scope denial or image-provider error
occurred. Context was 29.31% -> 31.11%, with short post-startup response times.
The rollback/prompt smoke test did not establish live recovery. Full PM:
`logs/runs/20260917-093355-rain-bottle-no-actions/postmortem.md`.
No runtime changes were made during that PM; inspect the assembled request and
execution-state evidence before another behavioral patch.

The September 17 00:40-01:15 run completed four draw/eye/explain sequences and
showed no visible repeat of the prior private-text leak, but idle deteriorated
into repeated silence announcements. Lab speed was logged at 7x. B2 flagged
looping 28 times. Idle attempted 31 disallowed `stop_standing_routine` calls and
one disallowed face call; each denial triggered another generic model turn.
The routine-stop tool does not stop ordinary idle, even if permitted. Scope
denials need structured non-retryable handling, and model-selected silence needs
an explicit non-spoken control path, without English behavioral classification.
Context grew 23.49% to 49.35%, including 19,519 tokens during the repetitive
interval. The final first-output wait was 38.729 seconds for another repeated
line and rejected tool call; B2 overlapped, and exact cache/GPU attribution is
unavailable without engine metrics. The diagnostic PM changed no runtime:
`logs/runs/20260917-011514-idle-repeat/postmortem.md`.

The subsequent [denial/yield repair](silent-wait-and-tool-denials.md) ends
automatic continuation after scope denial and carries execution scope into every
followup. Its first version incorrectly allowed an indefinite B1 hold: the
08:22-08:29 run completed draw/eye/explain, then parked on its first idle turn,
despite a fresh B2 headline. Changing to 5x could not override that hold. See
`logs/runs/20260917-082918-idle-silence/postmortem.md`.

The single-turn replacement also failed live: the 08:52-08:58 run repeatedly
announced quiet while B2 advised waiting for input. The latest
[quiet-loop repair](idle-quiet-loop-repair.md) removes the wait-tool experiment,
replaces accumulated B2 assessments with its latest current prose note, keeps
diagnostic steering out of B1, and explicitly restores active-curiosity guidance
in B1/B2 prompts. The one-sentence default, cards, timing and full history remain.
Offline local-model tests improved but do not prove sustained live behavior.
The page server must run the new B2 code; refresh disconnected STS and continue
the rich thread. No model or realtime-server restart is required.

The follow-up PM of that same 08:52-08:58 run also found a separate unresolved
image-error classification bug: an explicit provider HTTP 400 rejection is marked
as an unknown generation outcome, so a subsequent call is blocked locally and
Eric/B2 receive misleading state. Preserve definitive rejection versus ambiguous
transport failure without weakening provider refusals or paid-duplicate guards.
Context rose only 28.50% to 31.51%; the repeated idle lines were fresh generations,
not audio replay. Full findings: `logs/runs/20260917-085854-quiet-loop/postmortem.md`.

### Private Text Reaching Speech

The post-reboot 11:47 PM-12:00 AM continued run completed four render/eye/explain
chains, but B1 echoed the sensing-eye staging instructions before its final eye
move. This text matches the unmarked image wrapper supplied to B1, not the B2
note logged at that moment. An earlier answer also narrated deliberative prose.
The marker guard suppressed two other private dumps but cannot protect unmarked
copies. The final wrapper generated 59.77 seconds of audio; playback drain, not
a minute of measured prefill, accounted for most of the delay before the answer.
Context grew from 19.82% to 32.28%. Repair targets are image metadata/instruction
separation and provider output-channel verification, not English phrase filters.
No runtime changes were made during that PM. Evidence and recommendations:
`logs/runs/20260917-000024-brain-leak/postmortem.md`.

The subsequent [boundary repair](private-output-boundary-repair.md) replaces
the image instruction paragraph with marked provenance, strengthens stable B1
public/private instructions, and filters explicit thinking spans before speech
and history. Tools remain intact. 771 Python and 424 JavaScript tests passed;
two local model smoke checks produced public output or the correct eye tool
without a wrapper echo. Untagged deliberation is addressed by prompting, not an
English classifier; the full resumed conversation still needs a listening test.

### Context Transport Repair

The [September 16 repair](context-transport-repair.md) projects only public B2
advisory fields into B1, pages/searches model note lookups, and stops cumulative
image-receipt replay. SDK image stripping is disabled for live history; shared
idle does not resubmit an already staged picture. Ordinary idle can render and
stage using the existing Idle art grant, with B2 optional. No English intent
classifier, automatic drawing plan or forced speech was restored.

A local 12K-token image/history probe on the already-loaded Qwen model measured
26-29 evaluated tokens and about 0.30 seconds of prefill for retained-image turns,
including idle return. Simulating image removal evaluated all 11,706 tokens in
3.20 seconds. This verifies the specific mutation hazard, not every long pause
in the preceding live session. Long-form creative performance needs a live trial.

The 10:37-10:50 PM follow-up completed two draw/stage/explain acts and kept its
topic during idle. Context rose from 14.1% to 38.1%; this shorter two-image run is
not a full repair validation. Python servers were still the pre-repair processes:
even Eric's targeted `query: "boot eric"` received 452 filenames. Two early mic
barge-ins cancelled playback at sensitivity 5; later short VAD bursts were dropped.
The longest continuous work included 31.5 seconds producing 129 seconds of voice.
An additional 17.8-second first LLM chunk wait remains unattributed without
engine telemetry. PM: `logs/runs/20260916-225011-impossible-science/postmortem.md`.

### Agency Removal Pass

The first live trial (September 16, 9:34-10:00 PM) found a new advisory
serialization bug: complete B2/shared card text stored in each candidate's
internal `noteGuidanceKey` was copied into B1. A four-note reproduction carried
14,088 unnecessary characters. Repeated receipt snapshots and a 447-file note
catalogue also enlarged context. The observed prompt grew from 18,312 to 109,743
tokens; that growth is not all speech or useful memory. Fix transport payloads
without restoring deterministic behavioral direction.

Nine generation/eye moves succeeded, but ordinary idle rejected a later drawing
call because its read/search-only scope excludes image tools. B2 also repeatedly
advised waiting despite an open-ended invitation. The last idle beat waited
55.7 seconds for a first speakable chunk and produced only 65 tokens. Exact
prefill attribution is unavailable because numeric engine capture had expired;
an offline probe confirms consumed-image history mutation as a cache-risk path,
not a measured cause of every stall. PM and reproductions:
`logs/runs/20260916-220001-agency-context-growth/postmortem.md`.
No runtime repairs or prompt changes were made during this PM.

The pre-change state is committed as `74312a6`. The subsequent
[agency boundary change](agency-boundary-change.md) removes English consent
classifiers, direct prose-to-actuation, scripted tool confirmations, narrow
private continuation planners, controller-selected idle research/rhetoric and
semantic silence penalties. General continuation retains capability checks,
receipts, cancellation, a round budget and actual audio drain. Ordinary idle
shares full B1 history and can choose the existing read/search tools.

Runtime-generated instructions changed; creature identity, setup cards, model
and sampling settings did not. Offline verification covers mechanisms; live
creative quality and cache behavior still need comparison. Full multilingual
voice/retrieval support is not implied. The dated checkpoint below describes
the state before this removal.

### September 16 Checkpoint

- B1 idle thinking uses the full conversation history, with stable prompt/tool
  prefixes. A measured return reused about 92% of the prompt with 1.39 seconds
  of prefill, versus a prior 17.46 seconds. This is a run observation, not a
  guarantee: private tool workflows still produced expensive cold transitions.
- [Routed setup notes](brain2-setup-cards.md) keep shared and per-brain guidance
  in the same editable note. B1/B2 are active; B3/B4 sections are reserved.
- [Idle art](idle-art.md) has explicit operator enablement, serialized jobs and
  durable receipts. [Metrics capture](llm-metrics-capture.md) is opt-in.
  [Local model routing](local-model-routing.md) follows the chosen model across
  consumers; it is not automatic parallel loading of different models.
- Browser/S3 speech-mouth and gaze work shares contract data while preserving
  the touch display's lip geometry. The older multi-display firmware does not
  yet have the new speech-cue handler. See the dated entries in the
  [mouth study](browser-mouth-parity-study.md), rather than treating older
  hardware verification statements below as current deployment receipts.
- Session-map Alt+plus expands the selected subtree; Alt+minus also clears
  descendant expansion state. Ordinary expand/collapse behavior is unchanged.

Known failures: a 30-second tool-followup playback timeout can discard pending
work; image recall/action scopes can block useful recovery; English phrase
gates misinterpret negation and do not generalize across languages. The
[agency/language audit](sts-agency-and-language-audit-2026-09-16.md) documents
offline reproductions. The accepted next direction is subtraction of semantic
controllers, not additional scripted behavior. No such removal was included in
the pre-change checkpoint. Technical safety, permissions, identity, receipts,
audio serialization and cache stability remain requirements.

### Earlier Checkpoints

September 14 checkpoint: the latest illustrated Impossible Science run sustained
ten questions and ten on-topic autonomous followups, with twelve generated images.
Some image requests still needed prompting, and the generated summary omitted
much of the later conversation. Preserve full/swept history; summary-based history
loading remains disabled. No audio overlap was reported, but this run was not
recorded by STS for waveform verification. The previous startup greeting loop
remains an open relevance issue, not a proven microphone or rendering fault.

New followup pacing is implemented as a trial: the one-shot attention hold is
replaced with cooling gaps, with runtime settings 8 seconds initial delay,
75 seconds warm attention and 240 seconds fade. The successful run still logged
the old timing, so it does not validate this change. Browser Face also has paler
pink lips and held speech glances. See [pacing and gaze trial](conversation-followup-pacing.md).
All 388 JavaScript tests pass at this checkpoint. The detailed earlier entries
below record their own implementation dates and test counts.

Browser Face human-mouth port: the two-inch S3 drawing is isolated in a Canvas
renderer class, replacing the prior browser-specific human-mouth painter.
Generated executable pose data is shared by Browser Face and all three firmware
variants, with explicit legacy tuning for the older S3 face-brain. Native drawing
code is still separate across C++/JavaScript; hardware has not been flashed.
Checkpoint `6f92283`, before/after pictures, and scope:
[mouth port study](browser-mouth-parity-study.md). Refresh Browser Face to load
the new scripts; no STS prompt or recording-setting changes.

September 13 playback overlap repair is implemented and served. The 45-second
fallback no longer discards live audio ownership. Completion follows source
lifetimes/the audio clock, including pending browser setup; Stop invalidates
pending setup and stops tracked sources. Missed onended events are recovered
only after their scheduled end, not after a wall-clock timeout. No prompt,
response-length, attention timer, or model changes. All 384 JavaScript tests pass,
including nine playback regression tests. A separate headless browser verified
real Web Audio serialization, drain, and Disconnect with silent PCM buffers;
The later operator run reported no overlap; full waveform verification remains
outstanding. Refresh the existing STS tab.

Diagnosis from the latest PM (22:08-22:14, continuing Impossible Science):
the old fallback forgot live Web Audio sources after 45 seconds and allowed
idle speech over them. All three long answers triggered it; duration estimates
support overlap on the trousers and final sunshine replies. PM and repair checks:
`logs/runs/20260913-221447-playback-overlap/postmortem.md`.

Previous PM: September 13, 21:06-21:18, Connect Empty with Impossible Science.
Strong operator-led imaginative Q&A and cross-question callbacks; explicitly
not an interview/engagement trial, and no search handoff occurred. First speech
output for the first six questions was 1.49-2.50 seconds; the seventh was 9.91
seconds. B2 still favored closure (13 of 16 steering results). Recording exists;
finalization crossed the UI timeout, and the summary omitted the final fog and
Tuesday material. Preserve this run as a positive creative baseline without
declaring the task-at-hand continuity issue resolved. No runtime/prompt repairs
made in this PM: `logs/runs/20260913-211829-impossible-science/postmortem.md`.

Previous PM: September 13, 19:57-20:03, Connect Empty with the Curious Interviewer
card. Direct questioning and a real search worked; proactive continuity did
not. The short-pause B1 context omits the loaded card, B2's last-12-chunk evidence
omits the rehearsal agreement, and one attentive beat triggers a hold until the
180-second attention window ends. B2 then endorsed closure rather than returning
to the interview. The 168-second gap was between idle requests, each of which
produced text about two seconds after dispatch. Preserve shared activity across
research and expose it to both pause/B2 contexts before changing timer values
alone. The final reply also narrated a private headline angle. No repairs were
made in this PM. Evidence and proposed tests:
`logs/runs/20260913-200319-curious-interviewer-handoff/postmortem.md`.

September 13 reliability/Reachy follow-through is implemented:

- Fully private, tool-free output now ends through the normal failure lifecycle
  and gets at most one request-local recovery. A second suppression is visible
  in STS. Partial speech and real tool calls are never replayed by this recovery;
  cancellation wins. This adds one recovery instruction, not a persona rewrite.
- Ordinary research can make another search within the existing bounded
  continuation. A search does not authorize drawing. The original three-call
  budget, paid-generation guard, and activity/deadline cancellation remain.
- The launcher defaults to `--chat_size 0 --compact_history false`; a local
  compatibility patch makes zero also disable soft turn-count trimming. This
  removes the inherited 30-turn compression/60-turn eviction triggers. It is
  NOT token-aware compaction or unlimited model context. The provider limit
  still applies; sweeps-only historical loading is unchanged. `-ChatSize` on
  the base launcher can opt back into a positive live-turn bound.
- Six stock Reachy clips now use daemon-side recorded playback through existing
  beat names: affection, daydream, startle, wary, goofy, and silly. The last two
  are 18-19-second dances. Mood poses remain separate. Clips may play their
  bundled sound cues; Eric's TTS routing is unchanged. Completion waits account
  for clip duration, and failed/cancelled/unverified receipts end promptly.

Verification: all 375 Node tests and 146 focused Python tests passed, including
four real-generation lifecycle tests. An isolated synthetic-camera browser
smoke test also passed with writes intercepted.
The live robot's read-only catalog confirms all six clips exist. No physical
choreography trial or new live Eric conversation is claimed by these tests.
The realtime worker was restarted and verified listening on 8765 with the new
history flags; the page and Browser Face servers remain up. Refresh STS before
connecting. The motion-enabled Reachy adapter launch was blocked by the tool
execution policy, so that adapter was not started and physical playback remains
an outstanding verification step. No LM Studio model/configuration was changed.
See the [Reachy cheat sheet](reachy-cheat-sheet.md#stock-performances).

Performance mode is now disabled at its central gate. Its checkbox, preset,
and automatic stage-phrase trigger are removed; legacy saved activation and
pending performance prompts are cleared on load. Stage requests remain ordinary
conversation: no performance-specific history removal, privacy transformation,
tool restrictions, or attention-ramp bypass. This parks the special apparatus,
not Eric's ability to perform. The private-output filter is separate; its
silent-turn recovery is implemented above and still needs a live retest.

Latest PM (September 13, 13:51, `logs/runs/20260913-135146-stage-silent-turn/`)
traced a roughly 115-second apparent reply delay to a fully silent filtered
response, followed by an ordinary idle performance beat. The model finished the
direct response in about 4.5 seconds; the private-controller marker filter
suppressed output and no immediate recovery occurred. "Comedy act" had armed
automatic performance privacy, which also excludes the conversation attention
ramp: drift 7 then waits 112.5 seconds. A terminal filtered-turn result and
bounded fresh-turn recovery were identified as the priority. No live compaction occurred in
this run. Note reading, laughter-cued delivery and audience capture worked;
seven jokes were called six. No runtime repairs were applied in the PM.

The CTX meter now requests the context limit on connection independently of
optional diagnostics, with a throttled retry on measured responses if the limit
is unavailable. It was verified in an isolated browser and needs a page refresh.

Eric now has `set_live_camera` for user-requested camera on/off, with an optional
single-frame capture for combined open-and-look requests. Browser permission
still applies. Disconnect stops all camera tracks before saving, including when
saving fails; late permission results cannot reopen a cancelled stream. Socket
closure also stops the camera. Saved sensing-eye stills are retained. This adds
camera tool-use instructions, not persona changes. Verified with 340 Node tests
and an isolated synthetic-camera browser test; no physical camera or LLM used.

The preceding PM (September 13, 13:09, `logs/runs/20260913-130901-jokes-camera/`)
identified two apparatus issues needing follow-up: ordinary joke research was
misrouted into the image continuation and a requested second search was rejected;
the inherited realtime `chat_size=30`, `compact_history=True` policy compressed
live dialogue mid-run despite roughly 41% context use. This live compactor is
separate from the sweeps-only historical-session policy. Two camera captures
succeeded, then later capture/clear requests produced no calls; the first failure
preceded the compaction splice, so a single causal explanation is not established.
Thread jump/ancestry and session saving worked. No repairs were made in that PM.

B1 conversation generation now explicitly defaults to temperature **0.8**,
including idle and tool-continuation turns. This establishes a known baseline;
it does not establish the effective server default of historical runs.
`ROBOT_790_B1_TEMPERATURE` can override it (0 to 2); the realtime worker prints
the configured default at startup. B2, summary jobs, and the persona prompt
are unchanged. No temperature slider or spoken control is implemented yet.
Other explicit settings are B2 mull **0.55**, production session preparation
**0.2**, chunked-summary lab **0.2**, and private deliberation **0.3**. See the
[temperature audit and proposed summary comparison](summary-research-plan.md#temperature-audit-and-next-experiment)
for research, limits, and the distinction between summary fidelity and coverage.
Inherited realtime warmup and fallback context compaction are also explicitly
pinned to the assumed **0.8** baseline. That legacy compactor is now disabled by default.
Top-p/top-k and other samplers are untouched; temperature experiments are parked.

The daily setup is the local realtime worker, STS page on port 8790, and Browser
Face on 8791, using LM Studio for the configured local model. Browser Face is
the default embodiment. The apartment HTTPS gateway is optional and separate.
The active physical portrait face is `firmware/esp32-s3-face`; the external-eye
targets remain available for existing hardware and experiments. The new C3
0.71-inch and S3 1.28-inch dual-eye projects have animated, blinking bench
firmware and optional Wi-Fi OTA. They do not yet accept STS face commands.
See [Firmware Embodiments](https://github.com/dr3d/robot-790/blob/master/firmware/README.md).

Continuity uses timestamped session files and their direct pinned-note lists.
Connect chooses the newest active session; Previous is chronological; Select
chooses a specific branch; Empty omits session continuity and inherited pins,
but keeps the ordinary prompt and enabled tools, with the optional core note.
No current-session pointer file is required. See the
[context architecture](context-engineering-architecture.md) and illustrated
[STS operator guide](sts-ui-guide.md).

Implemented reliability repairs include configured scheduler retry cadence,
reserved core-memory prompt space, serialized atomic note writes, fresh pin
restoration, rejection of late tool/B2 work from older runs, and visible failures
when graceful session saving fails. Browser-face status clipping now has a
bounded operation, and Context Map expansion state is tracked separately from
control-panel state.

The repository review also corrected Eye salience's missing-preference default
and replaced the public site's incomplete Markdown formatter. Raw/Scrubbed/
Summary selection is now real: a PM-authored derivative is enabled only when its
source filename and SHA-256 still match the selected raw session note.

## September 12 Checkpoint

Stable prompt ordering now puts shared instructions and saved context before
the replaceable embodiment manual; live runtime changes append at turn
boundaries. Tool follow-ups preserve the conversation scaffold instead of
replacing the system prompt. Recent short performance runs sustained roughly
1.4-1.6 second median first-speech latency after startup at about 30-31% context.
Those are local observations, not a general benchmark; first replies still took
about twelve seconds, and no cache-hit rate was measured in those runs.

Auto history prefers source-checked swept sessions, not older summaries, and
falls back to original transcripts when requested forms are unavailable.
The configurable recent-swept/older-summary policy exists, but
`context_history.use_summaries` is false while summary quality is evaluated.
Source manifests determine membership; derivatives do not introduce new pins.
Generated forms and titles are prepared after sessions and remain inspectable.
Long transcripts have a separate chunked-summary lab; queued model swapping is
still a proposal, not an active scheduler feature.

Other accumulated changes include local-time session dates, matching lineage
colors in the list and tree, previewed branch archiving with shared-asset
protection, a lightweight CTX meter and opt-in LLM overview, conversation-detail
filtering, and a graph-only Browser Face nerve display. Cast's sender label is
Eric Robot-790. Ordinary note-writing requests now prefer authored notes.

Recorded performances can be lively without special UI Performance mode, but
resumed history can also encourage verbatim openings and endings. Rehearsal
feedback and curated performance notes are the next experiment, not a trained
weight update or a newly imposed anti-repetition rule. Routine captures remain
private; the published recordings are still explicitly curated selections.

## September 12 Session Navigation

STS now exposes `list_session_map` and `enter_session` with the note/file tools.
The catalogue is paginated metadata from the same active session inventory as
the UI. Navigation resolves an exact unique title or filename, preflights the
source, and queues the existing save/disconnect/Connect Selected lifecycle at
the response boundary after playback drains. Failed saves never advance to the
destination. New user activity, cancellation, or a changed connection invalidates
pending work. The mic's prior running/muted state is restored on arrival.

This adds intentional tool descriptions and receipt instructions, not personality
rules or a continuously injected map. It does not add fuzzy semantic routing,
archive recovery, a new context-loading policy, or automatic movement during
idle. Root prompt snapshots remain unchanged and now also predate these tools.
See the [operator instructions](sts-ui-guide.md#ask-eric-to-enter-a-session).

September 13 live testing exposed a missing lookup-to-entry handoff: Eric found
the right thread, but the speech-only follow-up could not call `enter_session`.
Reading two notes afterward left him in the original empty thread. The repair
adds a private, single-call map continuation for a unique match. New operator
activity, expired lookup, or a changed connection invalidates it; ambiguous
matches require clarification. Listing or importing alone must not move threads.

Arrival now requires the destination connection and matching restored parent.
STS reports the actual loaded historical-session and other-note counts in the
conversation, Events, and a private controller receipt. The ordinary selected
history loader remains authoritative; no new ancestry or summary policy is added.
Two base-prompt lines explicitly distinguish navigation from physical motion,
note reads, and queued-but-not-completed moves. Root snapshots remain unchanged.

Validation: 351 Node tests and 25 Python history tests passed. Read-only model
probes selected entry for two jump requests and no tools for listing, importing,
cancellation, or ambiguity. The live history preview for Genius of the Universe
roleplay returns nine swept historical sessions plus core memory, ten notes.
These checks do not substitute for a live spoken transition; that retest remains.
Refresh STS while disconnected; no backend restart is required. Importing one
past session into the current conversation and the recorder repair are deferred.

## September 12 Authored Notes Default

Spoken requests to save ideas or summarize a discussion now instruct Eric to
compose focused note content. Raw transcript/log capture remains an explicit
source option; missing content and a missing/unknown source fail without writing,
rather than silently dumping the conversation. The old keyword-excerpt
`note_summary` path was removed. Automatic continuity, Save Latest, and
post-session preparation are unchanged.

This is an intentional tool-description and note-instruction change, not a
personality change. Existing root prompt exports have not been refreshed and
their file-writing instructions now predate this change. Reload the STS page
before the next connection to use the new browser tool instructions.

The Gulu Gulu run's consent-gate rejection, speech-only read-to-write follow-up,
clipped TTS, and final greeting loop are not fixed by this default change.
The local PM is `logs/runs/20260912-110122-gulu-performance-file-breakdown/`.
The focused note tests plus the complete Node suite pass (319 tests); live
Eric-authored note generation has not yet been retested.

## September 9-10 Changes

- **One ordinary conversation path.** Connect Empty is a starting pin choice,
  not a separate personality or restricted runtime. Normal Connect operations
  clear transient state and the sensing eye, with generation checks rejecting
  late image loads and mirror captures. The separate Start Eric shortcut present
  at this checkpoint was removed on September 22; the normal Connect path remains.
- **More honest runtime context.** Prompts identify environment values as
  assembly-time snapshots. Recording preferences, browser Cast tracking, and
  attached tools are not presented as proof of recording or device availability.
  Missing-note errors now identify the requested file.
- **Brain2 freshness and privacy.** Timestamped, attributed evidence and change
  checks limit repeated analysis of unchanged material. Invalid structured B2
  output is not used as a speech fallback. A literal advisory-marker guard
  suppresses leaked marked text before TTS; unmarked paraphrases remain a risk.
- **Experimental idle headline reading.** STS can fetch dated BBC RSS snippets
  after two quiet real minutes and give B2 a bounded selection task. Selected
  stories become optional private interests for Eric. Ten-minute retry limits
  are not accelerated by the lab clock. Useful topic drift still needs live
  evaluation; fetching a story is not evidence of reading its full article.
- **Operator controls and diagnostics.** Browser Face's controller choice is
  remembered, and a compact popup can be opened or reused on Connect. Browser
  popup restrictions still apply; Eric's embodiment tool does not open windows.
  Optional `-CaptureLlmWire` records actual model requests locally for inspection.

## Remaining Priorities

September 13 post-archive filesystem audit: 36 active sessions and 25 locally
archived session records checked; all 224 active pins resolve, active forms are source-valid,
and no missing active image anchors or archive asset integrity failures were found.
Thirteen legacy sources require current Auto-history preparation, not recovery.
One separate loader defect remains: explicitly pinned `puppet.txt` has an STS
Session Note header, so Auto misclassifies it as managed session ancestry and
skips it outside `sessions/`. Preserve it as an ordinary note without importing
ancestry. Audit: `logs/mechanism-validation/archive-integrity-audit.md`.

September 13 image-recall PM: two real recalls succeeded, then Gulu Gulu/ferry/
gallery requests produced promises with no calls. All requested images were in
the returned global catalogue and served successfully in read-only checks. A
plain recall confirmation fired after intervening user speech: unlike catalogue
continuations, it lacks originating-turn freshness protection. This is a concrete
scheduler repair, but its causality for later no-call replies is not proven.
The recorder also appears to have retained the prior run's chunk after failed
cleanup, yielding a four-chunk 16m55s aggregate for a five-minute conversation.
Repair recorder session isolation as well as short-chunk finalization. PM:
`logs/runs/20260913-110644-recall-promises/postmortem.md`. No new repair deployed
as part of that PM; preserve cross-thread image access while fixing execution.

September 13 repair: a narrow, configurable image continuation is now implemented
for user-requested search -> generation -> sensing-eye staging. It uses private
next-step selection, one generation per chain, artifact checks, duplicate/stale-call
guards, and playback drain before follow-up. Action receipts now reach B1/B2.
The first same-thread spoken retest failed: repeated execution claims, zero actual
tool calls, and therefore no continuation to exercise. Browser receipts show tools
enabled; exact provider request configuration remains unverified. First-action
initiation must be diagnosed before another operator retest. This does not establish
image perception accuracy or solve general engagement. See the implementation scope in
[the continuation experiment](task-continuation-experiment.md#september-13-first-pass).
Repair validation: 501 Python tests and 345 Node tests passed, plus Ruff and script
parsing. The page/helper server was restarted and the enabled configuration and
new module were verified over HTTP. These tests cover handoffs after a tool call,
not reliable initiation by the live model. The failed run generated no image.

Later September 13 live result: Connect Previous excluded the failure-loop
session, and the same deployed continuation successfully generated/staged three
images, including the complete Hocus Pocus search -> draw -> eye chain without
another prompt. This is a positive handoff validation, not in-loop recovery.
The diagnostic first-action prompt was not deployed. A separate recorder bug
on a discarded short visual-rollover chunk prevented recording restart; only
57 seconds of that run were saved. Repair the recorder before relying on full
audio capture. Local PM: `logs/runs/20260913-093822-gulu-gulu-image-chain/postmortem.md`.

1. **Complete requested work across tool boundaries.** The context-scaffold fix
   does not solve every search-to-drawing or read-to-writing sequence. Most tool
   follow-ups still disallow another tool call; image recall has a bounded
   continuation. The experiment in [Shared Activity And Task Continuation](task-continuation-experiment.md)
   has a narrow image first pass; its general shared-activity state is still proposed. Explicit offer-and-assent file-write consent
   and speech cutoffs around failed tool attempts remain open.
2. **Evaluate engagement and cancellation over long runs.** The attention ramp,
   stale-result guards, and interruptible provider I/O are implemented. They do
   not establish that every pause stays socially engaged or every long-idle
   return is fast. Compare VAD, accepted speech, pending work, and playback;
   preserve intentional immediate-stop behavior.
3. **Improve summaries without losing useful material.** Source hashes and
   speaker citations validate structure and provenance, not semantic accuracy.
   Summaries can omit good endings or mishandle attribution. Sweeps remain the
   default; chunking, more thinking, and model comparisons are experiments.
4. **Preserve dependency intent and explain inclusion.** Display titles no longer
   require source renames. Branch archiving previews descendants and protects
   shared assets, but literal references are not globally rewritten. A session
   whose ancestor was archived may load with a missing-reference warning, and
   a live child can still hold an obsolete save-parent path. Source/form receipts
   exist; exact per-file token inclusion after prompt clipping remains incomplete.
5. **Exercise new transitions live.** Spoken session navigation is implemented
   and fixture-tested, not yet validated in a live conversation. Test successful
   arrival, microphone restoration, cancellation, and failure recovery. Long
   saves, recording rollover, multiple controllers, and physical embodiments
   still need their own operational trials.
6. **Separate evidence from interpretation.** B2 receives attributed dialogue,
   selected runtime fields, and search receipts, not a complete event stream.
   Preserve imagination as imagination and observations as observations. Use
   explicit rehearsal feedback to investigate performance variety rather than
   imposing a blanket repetition ban.

Source-linked variants, automatic preparation, configurable history selection,
and bounded navigation are implemented. General recursive dependency recovery,
learned memory weighting, automatic live summarization, model swapping for
background jobs, and direct model control over server KV state are not.

## Maintenance Boundaries

- STS remains a large single HTML file. Extract lifecycle and context
  assembly into small testable modules as concrete repairs require them.
- The shared face contract checks pose numbers across browser and active
  firmware targets. It does not provide a shared painter or visual equivalence
  across different screen sizes. Browser resize/render soak checks remain useful.
- The strict mypy configuration is not a passing gate: the installed NumPy stubs
  use syntax incompatible with the configured Python 3.11 target. Resolve the
  supported-version/dependency combination and existing typing debt explicitly.
- Hardware watchdogs, multiple-controller ownership, and untrusted-network
  operation need dedicated work before extending beyond the current lab setup.
  The [LAN guide](../scripts/sts-lan.md) states the existing household trust boundary.
- Raw runtime captures and live notes are local, ignored data. Tracked curation
  and `docs/` files become visible wherever the repository is published. PM
  bundles may include more than their written summary. Wire captures preserve
  message text, including personal context; omitted inline media is not text
  redaction. The root prompt-inspection exports remain local and ignored.

## Repeatable Checks

Run from the repository root with the project development environment installed:

```powershell
$testRoot = Join-Path $PWD ('.tmp/pytest-' + [guid]::NewGuid().ToString('N'))
.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --basetemp $testRoot
.\.venv\Scripts\python.exe -m ruff check src tests scripts firmware
.\.venv\Scripts\python.exe scripts/generate_face_contract.py --check
$nodeTests = Get-ChildItem tests -Filter '*.test.cjs' | Select-Object -ExpandProperty FullName
node --test --test-concurrency=1 @nodeTests
powershell -NoProfile -File tests/sts_launch.test.ps1
powershell -NoProfile -File tests/sts_stop.test.ps1
git diff --check
```

The browser-source suite uses isolated fixtures. The docs suite checks Markdown
rendering and local source/catalog links. Launcher tests inspect forwarding
without launching a model; shutdown tests use fake processes.
These checks do not operate hardware or prove microphone/camera operation on a
second device. Builds and media publication still need their appropriate review.

Optional real-browser audio check, with STS already serving on port 8790 and
Playwright plus Edge installed:

```powershell
node tests/sts_audio_playback.browser.cjs
```

If Playwright is installed outside Node's normal module path, set
`ROBOT_790_PLAYWRIGHT_MODULE` to that installed module's path for this command.
The check uses an isolated headless browser, muted synthetic tones, and a
read-only disconnected STS page. Screenshots and results go to the ignored
`logs/maintenance/audio-owner-browser/` directory. It is not an audible voice
quality, full recording teardown or live conversation acceptance test.

September 12 commit review: 499 Python tests and 331 Node tests passed; Ruff,
face-contract generation checks, docs/catalog checks, and launcher/shutdown
fixtures passed. The public catalogue was regenerated. The Python suite reported
one upstream Starlette/httpx deprecation warning. No hardware was moved or flashed,
and no user session was switched during this review. The last dual-eye firmware
build check remains the successful September 10 build, not a new hardware test.

September 17 publication checkpoint: 782 Python tests and 442 Node tests passed,
along with face-contract generation, launcher/shutdown fixtures, and whitespace
checks. The Python suite reports one upstream Starlette/httpx deprecation warning.
Ruff still reports 28 pre-existing import-order/line-length issues, matching the
HEAD baseline in the affected files; the new TTS helper's import ordering was
corrected. No hardware, live session, or model settings were changed for this
publication check. The memory-jar report and edited screen capture are a separate
publication commit from the runtime checkpoint.

## Retired Material

The September 5 scour, September 7 assessment/fix snapshots, and session-road
review were consolidated here. The older pinned-notes architecture guide was
merged into the current context guide. Two promoted PM drafts and one duplicate
transcript were removed while their identical public copies were retained. The
unused tool-free local voice launcher was retired; the documented realtime
launchers remain.

These tracked files remain in Git history. To find a removed document:

```powershell
git log --all -- path/to/removed-file.md
git show COMMIT:path/to/removed-file.md
```

Session evidence, public articles, active notes, recordings, and hardware targets
were not discarded merely because they were older.

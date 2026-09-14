# Engineering Status

Reviewed September 14, 2026. This is the maintained engineering view; session
postmortems remain evidence of their particular runs. A successful test or an
expressive session is not a guarantee about extended live operation.

## Working Baseline

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

Auto history currently loads source-checked swept sessions, not older summaries.
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
  late image loads and mirror captures. Start Eric remains a separate resume
  path with a reset caveat documented in the operator guide.
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

September 12 commit review: 499 Python tests and 331 Node tests passed; Ruff,
face-contract generation checks, docs/catalog checks, and launcher/shutdown
fixtures passed. The public catalogue was regenerated. The Python suite reported
one upstream Starlette/httpx deprecation warning. No hardware was moved or flashed,
and no user session was switched during this review. The last dual-eye firmware
build check remains the successful September 10 build, not a new hardware test.

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

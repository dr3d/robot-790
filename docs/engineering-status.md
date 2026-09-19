# Engineering Status

Reviewed September 19, 2026. This is the maintained engineering view; session
postmortems remain evidence of their particular runs. A successful test or an
expressive session is not a guarantee about extended live operation.

## Working Baseline

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
Long-session resume, archive recovery, context admission and B2 delivery repairs
remain open; this batch does not claim to fix them.

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

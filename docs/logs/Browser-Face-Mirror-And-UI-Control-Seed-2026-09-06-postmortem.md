# Browser Face Mirror And UI Control Seed Run

Run id: `20260906-173027`
Audio/video id: `20260906-172951`
Date: 2026-09-06

## Artifacts

- Conversation: `logs/live/20260906-173027-conversation.txt`
- Brain2 mulling: `logs/live/20260906-173028-brain2_mulling.txt`
- Events: `logs/live/20260906-173030-events.txt`
- Recording stop report: `logs/live/20260906-173031-recording_stop_report.txt`
- Later quick pane aliases: `logs/live/20260906-173036-conversation.txt`, `logs/live/20260906-173036-events.txt`
- Session source audio: `logs/audio/20260906-172951-sts-audio-session-source.webm`
- Session picture video: `logs/audio/20260906-172951-sts-audio-session-picture.mp4`
- Latest media aliases: `logs/audio/latest-sts-audio-source.webm`, `logs/audio/latest-sts-audio-picture.mp4`
- Sensing-eye mirror image: `logs/sensing-eye/browser-face-2026-09-06-21-21-49-610.jpg`

## Artifact Diagnosis

The session media exists and is healthy. `ffprobe` reports a 22:28.59 MP4 with
512x512 H.264 video at 24 fps and mono AAC audio at 24 kHz. `volumedetect`
found real audio: mean volume about -26.5 dB and peak about -4.4 dB.

The audio session was spliced from three chunks with a 0.35 second fade. The
recording-stop path still showed the familiar scary label:

`disconnect step skipped: stop audio recording: timed out after 18s`

In this run that was a cleanup/reporting wart, not a missing-audio failure. The
MP4 was spliced at 5:30:27 PM, then the recording-stop pane snapshots were
saved at 5:30:32 PM.

The browser-face mirror image that finally landed was 720x960. That confirms
the failure mode observed live: the first mirror captures were queued but did
not come back while the browser face was large/fullscreen; after the operator
made the face window smaller, the capture returned and staged into the sensing
eye. After this run, browser-face self-capture was changed to emit a fixed
540x720 JPEG before upload, so future mirror stills should not depend on window
size.

## Run Settings

- Model: `qwen3.8-27b-nvfp4-mtp`
- Reasoning: none
- Context: 131072
- Parallel: 2
- Audio max tokens: 64
- Run began as: Empty Connect / config only
- Tools exposed during this run: 28 tools, not including the later mic UI tool
- Mic during run: on
- Mic interrupt sensitivity: 4/10
- Eric speaker audio: audible at 100%
- Auto audio record: on
- Idle drift: 7/10 curious
- Performance mode: off
- Brain2 mouth: on
- Brain2 voice: Google US English at 34%, 1.10x
- Browser face controller: active after embodiment switch

One report caveat: the final recording-stop report says `B1 context mode:
normal`, but the event log shows the run connected at 5:06:40 PM with `connected
empty context: config-only prompt, startup context omitted`. The current UI
settings block also preserves `last_connection_context_mode: empty_connect`.
Treat the run as an Empty Connect run. The final report appears to have sampled
the browser-side mode after disconnect cleanup reset it.

## Prompt And Tool Receipts

The prompt ledger was captured. At open, B1 received about 5845 instruction
tokens with 28 tools. After browser-face staging updates, session updates rose
to about 5983 instruction tokens. The recording-stop report says 28 tool
follow-up prompts were captured for this page segment; those prompts are in
`logs/live/20260906-173031-recording_stop_report.txt`.

Important follow-up prompt receipts:

- `set_voice`: exact follow-up, "Voice switched to Eric, dry."
- `set_embodiment`: exact follow-up, "I moved to Browser face simulator; same
  Eric, different body."
- face/mouth tools: default compact follow-up prompt with tool_choice none
- failed browser-face captures: exact follow-up saying the face tab had not
  handed back an image yet
- successful browser-face capture: vision-specific follow-up telling B1 to use
  the newly staged browser-face image as a self-image, not a hardware camera
- repeated `get_brain_status`: diagnostics follow-up prompt, asking B1 to answer
  compactly from measured runtime/GPU/context values

The later `LLM mic control` tool was not present in this run. Eric correctly
said it was not wired yet.

## What Happened

The first part was a clean-start test. The operator asked how clean Eric's brain
was. Eric answered correctly: no memories or notes were loaded into the live
Empty Connect context, but the creature spec was still present. That distinction
matters. "Clean" here means no pinned-note/memory/passivated context, not no
identity or no creature configuration.

The Bender probe was useful. When asked to configure himself from memory files
as Bender, Eric refused the impossible version: no saved persona was loaded in
the clean config-only startup. That is the right boundary for this stage. A
Bender note can be tested later, but it should be an explicit loaded overlay,
not a magic assumption.

Then Eric moved into the browser face. That transition worked cleanly. He
called it the rehearsal body: a place where expressions can stretch before they
are mapped onto physical faces. That is the right framing for browser-face now.
It is not just a debug view. It is the expression workbench.

The pose-and-label test exposed two problems and one good design truth. The
problems: Eric struggled to reliably set pose plus label as a coordinated
two-step visual act, and some tool markup leaked into assistant text before the
suppression guard caught it. The good design truth: when the operator spoke,
the listening/focused state overrode the held performance pose. That initially
frustrated the pose test, but it also felt right. Eric's face should show that
he is listening when he is listening.

The zero-duration face hold mental model got stronger in this run. The operator
explicitly taught Eric that setting a pose or mouth text for zero seconds means
hold indefinitely, then cue the next pose manually. That is a good machine
language rule for manual face direction: zero duration means "hold until I say
otherwise."

The mirror-capture failure became fully legible. Eric queued a goofy
pose-and-capture, then a separate self-capture, but both timed out because the
face tab did not push the image back. The operator guessed the image might be
too large and resized the browser face. The next capture landed immediately,
and Eric could inspect the staged self-image. The run directly produced the
post-run fix: browser-face snapshots are now fixed-size before upload.

The next subject was UI control. The operator wanted Eric to be able to change
the mic interrupt slider by voice, for example "set interrupt to three." Eric
understood the shape of the feature and correctly identified that he did not yet
have a tool for it. Brain2 also caught the risk: do not claim self-tuning or UI
adjustment until the tool exists. After the run, this was narrowed into one
exposed tool lane: mic interrupt sensitivity only.

The final technical tangent was live GPU percentage. Eric used `get_brain_status`
several times and gave changing numbers: about 57%, then 84.3%, then 6%, 97%,
7%, and 9%. The behavior was useful because it showed that the GPU number is a
sample, not a stable state. It also showed a product gap: the operator wanted a
terse instrument readout, not explanation. Eric over-explained once, got
corrected, then gave shorter answers.

That led to the "instrument brain" idea. Brain2 is currently an advisory lane,
not an autonomous scheduler. A future Brain3 would be different: a telemetry
instrument loop that samples on a cadence, detects thresholds, and surfaces one
number or one receipt when asked. This should not be bolted onto B1 chatter.
It wants its own lane.

At the end, the operator tested exit semantics. Disconnect acted as hard stop:
halt realtime, close websocket, stop mic, finalize audio, save panes. No
passivation happened. That matches the newer operating model.

## What Worked

- Empty Connect behaved correctly from the user's side: Eric had creature spec
  but not loaded notes/memory/passivated continuity.
- Eric did not pretend a Bender persona was available in clean startup.
- Browser-face embodiment switch worked and produced the right "rehearsal body"
  framing.
- The face pose toolchain mostly worked for moods, mouth shapes, and labels,
  though not yet as a reliable enumerated-performance loop.
- The mirror-capture failure was observable, reproducible, and immediately
  explainable from the user's intervention.
- Brain2 produced useful loop guards during hesitation and a good routine-gap
  warning about not claiming UI self-tuning before the tool existed.
- `get_brain_status` produced live GPU/context receipts, and Eric could shift
  toward terse answers after correction.
- Hard disconnect preserved audio and logs.

## Watch Items

- Recording-stop reports currently risk mislabeling context mode after
  disconnect. Preserve the session's connection mode in the audio-recording
  session state instead of asking current UI state after cleanup.
- Browser-face pose plus mouth-label needs a stronger combined operation. The
  current sequence can lose visible labels or get overridden by listening/focus
  state.
- Tool markup suppression fired during the face-label section. The guard worked,
  but the model still attempted visible tool-call markup in text.
- Brain2 had several `returned no usable output` and `already in flight` events.
  It still helped, but fast idle/fast testing keeps putting pressure on that
  lane.
- The stale KV-cache specimen line still appears in reports as
  `k:q8_0/v:q5_0 / audit=runtime_load_failed`. Keep treating it as failed
  runtime-specimen metadata, not as proof of the actual live cache mode.
- The GPU readout needs a one-number mode. When the user asks "what is it now,"
  Eric should return the requested number and stop.

## Build Follow-Through Already Done

- Added an LLM mic-control lane, but narrowed it to exactly one exposed control:
  `interrupt_sensitivity`.
- Browser-face self-captures now emit fixed 540x720 JPEGs before upload, so
  fullscreen size should no longer break the mirror tool.

## Next Build Implication

The face tools want one higher-level choreographer call for this exact manual
test:

`show_face_pose(name, label=true, hold=true)`

Under the hood it can set mood, mouth text, gaze defaults, clear or preserve
listening overrides appropriately, and return a receipt saying what is visibly
supposed to be up. That is better than making Eric juggle separate mood and
caption calls in conversation.

The telemetry idea wants a different shape:

`Brain3 / instrument lane`

Not a chatty assistant. Not Brain2. A small sampler that owns cadence and
thresholds: GPU %, VRAM, latency, audio-recording finalization, queue pressure,
maybe network/tool health later. B1 should be able to read it or quote it, but
not become the loop.

## Curation Read

This is a strong lab-record run, not a clean public clip by itself.

The best public-facing subject is the mirror moment: Eric tried to inspect his
own browser face, failed because the image path was too large, then succeeded
after the operator resized the face. That is an honest and charming
embodiment/workbench moment: the robot learns the difference between controlling
his face and seeing his face.

The deeper project finding is the UI-control seed. Giving Eric one safe UI knob
is not just convenience. It starts moving control from "operator manipulates a
panel while Eric talks" toward "Eric can participate in tuning the conditions
of the conversation." The right way to grow it is exactly one knob at a time.

Recommended title for the record:

`Browser Face Mirror And The First UI Knob`


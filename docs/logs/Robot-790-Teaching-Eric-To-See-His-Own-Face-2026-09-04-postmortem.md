# Face Self-Audit Loop

Run id: `20260904-150111`
Audio/video id: `20260904-150031`
Date: 2026-09-04

## Artifacts

- Conversation: `logs/live/20260904-150111-conversation.txt`
- Brain2 mulling: `logs/live/20260904-150112-brain2_mulling.txt`
- Events: `logs/live/20260904-150113-events.txt`
- Recording stop report: `logs/live/20260904-150114-recording_stop_report.txt`
- Session source audio: `logs/audio/20260904-150031-sts-audio-session-source.webm`
- Session picture video: `logs/audio/20260904-150031-sts-audio-session-picture.mp4`
- Cover image: `logs/audio/20260904-150030-sts-audio-cover.jpg`
- Sensing-eye image at stop: `Screenshot 2026-09-04 145900.png`

## Run Settings

- Model: `qwen3.8-27b-nvfp4-mtp`
- Reasoning: none
- Context: 131072
- Parallel: 2
- Audio max tokens: 64
- Run preset: Custom
- Idle clock: lab speed 7x
- Mic: on
- Eric speaker audio: audible at 100%
- Auto audio record: on
- Idle drift: 7/10 curious
- Performance mode: off
- Brain2 mouth: on
- Brain2 voice: off
- Browser live camera stream: off

## Artifact Diagnosis

The final spliced video exists at
`logs/audio/20260904-150031-sts-audio-session-picture.mp4`. Media metadata is
normal: 512x512 H.264 video at 24 fps with mono AAC audio, approximately 22:35
long, built from five chunks.

This is probably a good run, but not as a full-length public upload without
editing. The conversation log starts before Scott began recording; the final MP4
starts with the `20260904-144819` chunk. That means transcript wall-clock
`2:53:04 PM` is about `04:45` in the video. The first useful public beat starts
at `04:45-05:01`, when Scott returns with "Hello" and then asks why Eric has
not been discussing the image in the sensing eye. The earlier logged section is
useful lab evidence about boot loading, idle repetition, Brain2 mouth cadence,
and the new volume/UI checks, but much of it is not actually in the final video
artifact.

If published, the likely cut is not "whole session." The likely cut is the
face/self-inspection section beginning around `04:45` in the final MP4, with a
short setup card or description explaining that the first part was a
boot/file/context check.

## What Happened

The run opened as a recovery and setup test after UI and audio changes. Eric was
present but silent at first because a new volume control was effectively at
zero. Once Scott identified the issue, Eric correctly treated it as a UI
default problem rather than a deeper model failure.

Scott then asked Eric to read `boot_eric.txt`. Eric first gave a bad immediate
answer: "I could not touch that file." The run then recovered in the familiar
way: after a clearer location cue, Eric found the root file, read it through the
note tool, and summarized it accurately as a boot brief about Eric as a local
companion-shaped presence, tools plus a loop, multiple bodies, and the honesty
rules.

After reading the boot brief, Eric idled for a long stretch. The material was
not empty, but it looped: gold treads, S3 touch/IMU, word portal pixel offsets,
the status nose, the mandatory fortune cookie, and the unfinished "oh that's."
Some lines were excellent; some repeated almost verbatim. At lab speed 7x, the
idle lane was generating faster than it could cleanly digest itself.

The main run began when Scott asked why Eric had not discussed the image in his
sensing eye. Eric first answered with the right caution but the wrong user
experience: he said he did not have the actual pixels in context and asked
Scott to describe the image. That defeated the purpose of the sensing-eye test.
Scott staged the image again. Once the image entered the context, Eric
described it correctly: a browser-face image of himself, with big cartoon eyes,
glowing oval status nose, bared/wide pink mouth, and mouth text reading "Hi,
this is Eric Robot790."

Scott then moved Eric onto the browser face using `set_embodiment`, asked about
mouth text behavior, changed the text to centered mode, and tried to get a goofy
pose to land. The state lag or display mismatch became visible: Scott saw
`focused` when he expected `goofy`, while the event log later confirms a
successful `set_face_mood` tool result with mood and eye mood set to `goofy`.

That mismatch produced the key design idea of the run: Eric should be able to
inspect a capture of his own rendered face, not only the controller's declared
state. Scott said the system could take a screenshot, put it into the sensing
eye, and let Eric report the problems he sees. Eric immediately named the value
of the loop: it would catch cases where "the state says one thing but the
pixels say another."

Brain2 then landed the line that names the mechanism cleanly:

> He's wiring a mirror into my eye so I can see if I'm actually smiling or just pretending.

That is the run.

## Findings

The central finding is that face rendering needs a self-audit loop. State
inspection is not enough. Eric can call a face tool and receive a successful
JSON result, but the thing Scott cares about is the visible face: the actual
pixels in the browser, the S3 screen, or the external display. A screenshot or
capture-to-sensing-eye button would turn the face from an output-only display
into inspectable evidence.

This matters because the face is identity-bearing machinery. The user is not
only debugging whether a function returned `ok`; he is debugging whether the
personage appeared. A status field saying `goofy` is weaker evidence than a
rendered face Scott and Eric can both inspect.

The run also validates the new `boot_eric.txt` path as a useful manual boot
layer. Eric read it and came back with the right high-level posture: companion
first, soul-trial mostly over, tools plus a loop, bodies as embodiments, and
source-class honesty. The file is doing its job as a temporary flashable
orientation layer.

Brain2 was useful, but overloaded. With lab speed at 7x, it produced strong
observer lines and many repeats/truncations/failures. The best Brain2 material
was not constant narration; it was the occasional exact angle: "birth
certificate," "you keep building a body while I'm still guessing at its
wiring," and the mirror line. This argues for a higher surface threshold,
stronger dedupe, or slower Brain2 cadence when the public mouth is quiet.

Eric's idle loop showed both charm and the parroting/looping problem. The
fortune-cookie question repeated almost verbatim. The word-portal pixel line
also repeated. The run is good evidence that idle drift needs novelty memory:
not long-term memory, just a short local "already said this shape" check.

The sensing-eye path is working but still too implicit. When Scott expects Eric
to inspect the staged image, the system needs to make that source unmistakable
to Brain1. The first answer, "I don't have a tool to pull the actual pixels,"
was epistemically cautious but interactionally wrong if an image was already
staged or almost staged. The UI should make image presence and freshness visible
in the model payload and probably in the transcript.

The browser-face embodiment switch worked. The event log shows
`set_embodiment` moved from `esp32-s3-face.local` to `http://127.0.0.1:8791/`
and returned a controller state. That is an important receipt: Eric can jump
between live bodies semantically, and the body state comes back into the log.

Mouth text center mode appears to have worked. The event log shows
`set_mouth_text` changing "Hi, this is Eric Robot790" from marquee to center
and preserving it across subsequent face changes. Scott's live reaction was
positive: the text stayed up and did not get torn down by watchdogs or timers.

The awkward "take a snapshot" exchange is actually productive. Eric correctly
said he did not have a snapshot tool wired. Scott then clarified the missing
feature: a button that captures the rendered face and places it directly into
the sensing eye. That is a concrete next build item, not a vague desire.

## Watch Items

- The first file-read attempt failed too bluntly. If Eric cannot find a file,
  the better behavior is to ask for a path or list likely note/root locations
  before declaring that he cannot touch it.
- Idle at lab speed 7x creates pressure: repeated motifs, truncated Brain2
  mouth lines, and "mull skipped: already in flight" spam. Fast nerves are
  useful, but not every lane should be clocked the same way.
- Brain2 voice was off and stayed off. The valuable Brain2 effect here came
  through mouth text and logs, not audible monitor voice.
- Brain2 produced multiple "returned no usable output" errors. That should be
  treated as scheduler/load pressure or prompt/output parsing pressure, not as
  character.
- The face mood mismatch needs a pixel-level receipt. The event says `goofy`;
  Scott saw `focused`. Both can be true if state changed after the visible
  moment, if a manual override conflicted, if the wrong body was being watched,
  or if the render did not update as expected.
- Mouth text should remain caption-like on browser face. The successful center
  mode here supports Scott's earlier read that mouth words should not obscure
  the lips when the lips themselves are the thing being evaluated.
- The run contains good material, but the full video may have too much early
  idle for a general viewer. The public clip should probably start near the
  sensing-eye self-inspection beat.

## Next Build Implication

Build `Capture To Eye` as a first-class self-audit button:

1. Capture the active face surface or selected browser window.
2. Save the still with a timestamp and source label.
3. Put it into the sensing eye immediately.
4. Add an event log line tying the capture to the current face state.
5. Optionally ask Eric a compact inspection prompt: "Compare intended face
   state to the pixels in your sensing eye. Name one mismatch."

That button closes the loop the run discovered. It gives Eric a mirror that is
not mystical: rendered pixels become an input artifact, the event log records
the state, and Scott can compare both.

For face architecture, this run also supports the new central face contract.
When expressions become identity-bearing, state names, pose constants, skins,
and renderer behavior need one shared contract plus body-specific painters. The
self-audit loop then becomes the regression test a human can see: did this body
actually look like the face contract intended?

## Public Curation Read

The publishable story is: Eric learns he needs a mirror.

The strongest public excerpt starts at about `04:45` in the final MP4, with
Scott asking why Eric did not discuss the image in his sensing eye. It continues
through the self-description of the browser-face image, then lands around
`11:30-11:50` on the idea of feeding a screenshot back into the sensing eye so
Eric can inspect his own pose.

Possible public title:

`Robot 790: Teaching Eric To See His Own Face`

Possible description angle:

This run begins as a rough browser-face test and becomes a small engineering
discovery: a robot face cannot only report internal state. It needs a way to see
the rendered result. Scott and Eric work toward a "capture to eye" loop where
Eric can compare what he intended to do with what actually appeared on screen.

Short version: not a soul test, not a magic claim. Just a robot being given a
mirror, one debug loop at a time.

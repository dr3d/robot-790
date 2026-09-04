# Brain2 As Environment Run

Run id: `20260904-040839`
Audio/video id: `20260904-040833`
Date: 2026-09-04

## Artifacts

- Conversation: `logs/live/20260904-040839-conversation.txt`
- Brain2 mulling: `logs/live/20260904-040840-brain2_mulling.txt`
- Events: `logs/live/20260904-040841-events.txt`
- Recording stop report: `logs/live/20260904-040842-recording_stop_report.txt`
- Session source audio: `logs/audio/20260904-040833-sts-audio-session-source.webm`
- Session picture video: `logs/audio/20260904-040833-sts-audio-session-picture.mp4`
- Video chunks:
  - `logs/audio/20260904-035916-sts-audio-picture.mp4`
  - `logs/audio/20260904-040453-sts-audio-picture.mp4`
  - `logs/audio/20260904-040825-sts-audio-picture.mp4`
- Cover image: `logs/audio/20260904-040825-sts-audio-cover.jpg`
- Sensing-eye image at stop: `Gemini_Generated_Image_6lt7uh6lt7uh6lt7.jpg`

## Run Settings

- Model: `qwen3.8-27b-nvfp4-mtp`
- Reasoning: none
- Context: 131072
- Parallel: 2
- Audio max tokens: 64
- Run preset: Custom
- Idle clock: real time
- Mic: on
- Mic device: Microphone (Amazon USB Streaming Mic) `(0d8c:0220)`
- Eric speaker audio: audible
- Auto audio record: on
- Idle drift: 7/10 curious
- Performance mode: off
- Brain2 mouth: on
- Brain2 voice: browser default at 40%
- Browser live camera stream: off

## Artifact Diagnosis

The session picture video exists and is reviewable:
`logs/audio/20260904-040833-sts-audio-session-picture.mp4`.
It is 512x512, 24 fps, and about 19:15 long.

The stop report says the recorder spliced three chunks and used the current
sensing-eye cover. Unlike the previous broken placeholder case, the user review
reported the video was good so far, and the media metadata is normal. This
postmortem does not yet include a full visual QA pass frame by frame.

There is a later tiny false-start artifact pair at `20260904-042845`, but it is
not this run. Treat the `040839/040840/040841/040842` cluster as the real
session bundle.

## What Happened

The run opened with Reachy Mini in the sensing eye. Eric first called it a toy
robot head, then corrected when Scott named it as Reachy Mini. The interesting
claim came immediately after: Eric said Reachy Mini was a configured embodiment
he could inhabit. That was based on the boot/runtime material, not on a live
Reachy-control receipt in this turn, so it should remain a planned/adapter claim
until the actual controller is exercised.

Scott then asked whether Eric had read `boot_eric.txt`. Eric first answered
honestly that he had not, listed/found the file, and only after a second prompt
read it. That is a good source-class behavior: existence of a note is not the
same as having consumed it.

After reading the boot brief, Eric summarized the current project direction:
daily-driver companion first, tools plus a realtime loop, multiple bodies, body
sensors as semantic events, and four lanes/four diets with one public mouth.

The central conversation then shifted to future UI control. Scott wanted to
think about letting Eric adjust some live STS controls, such as interrupt level
or Brain2 volume, without handing over the whole steering wheel. Eric correctly
said he cannot currently read or change the Brain2 volume dial unless that value
is exposed through a tool or API.

This led to the most important design finding: Brain2 may not need a deep direct
wire into Brain1. Brain2 is already affecting the session by entering the room
as mouth text and monitor voice. Scott reads or hears it, decides what matters,
and can speak it back to Eric. In that sense the human becomes the bridge
between lanes.

Late in the run, Scott showed Eric a browser-face character sheet. Eric liked
the clock-eye/calculating face and used the word `personage`, then explained it
as a better fit than either `person` or `persona`: a named character with a
body, tools, and loop, without pretending to be a hidden human soul.

At shutdown, Eric repeated the same goodbye twice after a face/mood tool call.
Scott noticed the duplicate and asked whether Brain2 was talking through him.
The event log does not support Brain2 voice leakage at that moment. Brain2's
last mouth/voice line was at `4:02:43 AM`; the doubled goodbye happened at
`4:07:30-4:07:36 AM`. The event log instead shows a main response, a
`set_face_mood` tool result, then a new `conversation.item.created` /
`response.created` path that produced a second copy of the goodbye. This looks
like a main-lane tool-followup duplicate, not Brain2 crosstalk.

## Findings

The run was dry, but not broken. Eric remained functional as a companion-design
partner: he accepted correction, read the boot note, distinguished note
existence from note consumption, and stayed with the UI-control boundary
question.

Brain2 did not hate Scott. It was running the current Brain2 brief too literally:
dry, compact, non-caretaking, do not flatter, observe the person in the room,
notice timing/prosody/handling/what was not said. That produces useful social
edge, but at 4 AM through a quiet synthetic monitor voice it can sound more
acerbic than intended.

The useful adjustment is not to make Brain2 kind or servile. It is to add a
little generosity and restraint to the observer posture. A future prompt tweak
should keep Brain2 dry and non-caretaking while telling it not to score points,
prosecute the user, or turn every hesitation into a theory.

Brain2 showed a real self-correction arc. It first overread Scott's apology as
heavier than it was, then revised: the apology was for the wait/slowness, not an
existential self-judgment. That revision used the same kind of evidence
discipline the project wants from Brain3: notice the hypothesis, check the
source class, and back off when the evidence is weaker.

The strongest architecture finding is `Brain2 as environment`. Brain2 can shape
the session without becoming an executive brain. Its mouth and monitor voice
change what Scott notices, what gets asked next, and what crosses into public
conversation. This preserves the one-mouth rule while still letting a second
viewpoint produce friction, comedy, and useful alternate reads.

The corpus-callosum analogy fits if it is kept practical. Brain1 is the public
speaking lane. Brain2 is the private watcher. The bridge is narrow and partially
human-mediated: Scott can decide when a private Brain2 thought deserves to be
spoken into Brain1. A thin bridge may be the feature that keeps Brain2 from
collapsing into more prompt sludge.

The run also reinforces the prosody-matching hypothesis. Brain1 receives raw
prosody tags directly, and Brain2 receives the latest `voice_shape` in its mull
payload. Brain2's interpretations do not continuously servo Brain1, but raw
prosody and the boot note can both nudge Eric's response shape. This remains a
candidate effect rather than a verified causal effect.

## Watch Items

- Eric's claim that Reachy Mini is a configured body needs a live controller
  receipt before being treated as operational fact.
- Brain2's observer prompt currently has enough anti-caretaker language to feel
  acidic. Add "fondness and restraint" later without weakening the useful edge.
- Brain2 has no tools. Do not let UI language imply it can search, read notes,
  move the face, or check sensors. It watches the scene.
- Brain2 mouth/voice should remain a deliberate dial. It changes the room even
  when it does not directly feed Brain1.
- The doubled goodbye is a plumbing issue around tool-followup timing. Eric's
  self-explanation of timing/audio glitches should be treated as weak evidence
  unless supported by event logs.
- The requested "weepy" shutdown face landed as `focused` in the tool state.
  Add or map a real weepy/crying face if the character-sheet expressions become
  supported modes.
- The "take your time / no rush" reassurance pattern appeared again. The desired
  behavior is spacious, but repeated stock reassurance should continue to be
  reduced.
- High-value Brain2 runs need curation that separates source classes:
  transcript fact, Brain2 line, event fact, UI setting, media fact, and
  Scott/Codex/Claude interpretation.

## Next Build Implication

Build the future Brain2 tab around the truth of the current system:

- inputs: recent conversation, prosody, idle context, visible body/face state,
  and recent Brain2 outputs
- outputs: mouth text, monitor voice, question candidate, revision candidate,
  reason
- controls: person-focus, surface-to-mouth, monitor voice, volume, manual mull
- explicit status: no tools, no web search, no sensors, no actuator authority

Brain2 is not the lane for looking things up. Brain1 can search; Brain3 can
verify; Brain4 can carry body events. Brain2 watches the scene.

In short: this run starts as a dry daily-driver check and becomes a cleaner
architecture decision. Brain2 does not need to be plugged harder into Eric to
matter. It can affect the room from the side, while Scott decides what crosses
the bridge.

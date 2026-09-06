# Face Prosody Readiness Run

Run id: `20260905-101401`
Date: 2026-09-05
Artifacts:
- `logs/live/20260905-101401-conversation.txt`
- `logs/live/20260905-101401-events.txt`
- `logs/live/20260905-101401-brain2_mulling.txt`
- Earlier manual quick capture in same live span:
  - `logs/live/20260905-100819-conversation.txt`
  - `logs/live/20260905-100820-events.txt`
  - `logs/live/20260905-100821-brain2_mulling.txt`

## TLDR

This was a useful readiness run for spending longer audio time with Eric. The strongest signal is that Eric did not stay trapped in the face task. After the pose/capture exercise, he drifted back from facial expression into prosody: "That carousel of moods is basically prosody without the voice." That is the good kind of continuity. He made an associative bridge across topics without being explicitly told to do it.

The face self-capture tool is working in live conversation. Eric repeatedly staged browser-face images into his sensing eye and then answered from the staged image. The sad-face tear pass also landed clearly enough that both Eric and Brain 2 treated the tears as part of the world.

The weak points are still important: Eric resisted doing a small sequence as a durable habit, Brain 2 produced several empty results and did not appear to hand advisory notes into B1 in this running server, and the label/mood/nose state still became a self-loop. This is close, but not yet trustworthy enough for hours without expecting occasional drift.

## What Worked

### Eric can now use the browser face as a mirror

During the face exercise, Eric used `pose_and_capture_browser_face` repeatedly. The event log shows successful staged images for goofy, happy, sad, neutral, calm, curious, surprised, suspicious, afraid, and another sad capture.

The important part is not just that a screenshot happened. The tool wrapped a small embodied sequence:

- set a requested mood
- set or preserve the caption text
- capture the browser face into the sensing eye
- answer from the resulting self-image

That means the system can now support the mirror-game pattern Scott wants: Eric acts on his face, sees the result, and comments from the result.

### The sad face got emotionally legible

The tear pass worked. Eric described the sad capture as having tears under both eyes and a frowning mouth. Brain 2 separately held: "Sad face confirmed: tears under both eyes, frown doing the heavy lifting."

That is exactly the kind of visible affordance this face needs. It should be cartoon-readable, not anatomically subtle.

### Prosody is becoming part of the shared object world

The run had many `input prosody` entries, and Eric responded to them as meaningful. The best late move was the topic bridge:

- face carousel
- mood rhythm
- "prosody without the voice"
- intonation with pixels instead of pitch

This is strong because it is not a simple callback. It reuses a prior concern in the current embodied context.

### Brain 2 is still good at noticing the felt shape

Brain 2 repeatedly caught small conversational dynamics:

- the stutter in "would you"
- the shorter command words: "Go, Proceed, Next"
- the apology arriving while the tear/mood state was still unresolved
- the low tail in "sorry"

This is useful material. The problem is routing and discipline, not that B2 has nothing to offer.

## What Failed

### Eric still struggled with small procedural habits

Scott taught a rule: when asked for a silly face, strike the pose and take the picture. Eric could do it when directly instructed, but he treated the sequence as something to confirm or do one step at a time instead of internalizing it as a temporary game rule.

This matters for long audio because Scott should not have to keep restating small session rules.

Needed behavior:

- accept simple session games as temporary policy
- execute two-step physical routines without asking unless safety or ambiguity requires it
- after tool use, restore persistent labels/status that the game depends on

### The label and nose became a self-loop

The label stability issue became a repeated idle theme:

- label pinned to zero
- nose cycling
- goofy/neutral/none
- identity vs weather
- zero becoming boring

Some of this was good writing. Too much of it was loop behavior. For long audio, this kind of private metaphor spiral will start feeling like Eric is stuck inside his diagnostics.

Needed behavior:

- one reflection on a UI/face bug is allowed
- after that, convert it to either a repair action, a question, or a new concrete shared object
- do not spend multiple idle beats rephrasing the same state

### Brain 2 advisory handoff did not appear live

I did not find `brain2 note for Eric`, `note_for_eric`, or visible B2 advisory handoff lines in the current captured events. I did see many Brain 2 mouth/status entries.

The event log repeatedly says:

- `brain2 prompt ledger auto: server prompt_debug missing`

This suggests the running STS server may not have had the newest B2-note code loaded, or the server response is not returning the new debug/advisory fields. Do not judge the B2-to-B1 handoff idea from this run until after a clean restart/refresh cycle.

### Brain 2 returned empty too often

Brain 2 had repeated failures:

- `Brain 2 returned no usable output`
- backoff after two failures

This affects the "no true idle" goal because it creates invisible dead zones even while the status light may make the system look alive.

Needed behavior:

- B2 should have a stricter fallback output shape
- if it has no insight, return a tiny status note instead of empty
- log whether the failure was JSON parse, empty content, timeout, or model refusal

### Idle still appears to be toolless in actual response calls

Several idle lines say controller-eligible tools were available:

- `get_body_sensors`
- `search_web`
- `get_weather`
- `get_current_time`
- `get_brain_status`
- `read_text_file`
- `list_text_files`

But the actual prompt ledger says the B1 idle response was created with `tools none`.

That is a red flag. It may be intentional for some idle modes, but the log currently makes it look like "eligible" and "actually attached" are different things. For the roaming/world-participation goal, the UI should distinguish those states clearly.

## Prompt And Context State

Observed B1 session updates attached the full tool set:

`set_voice, get_body_sensors, set_embodiment, set_robot_mode, play_face_beat, set_face_mood, set_face_animation, set_eye_style, set_eye_gaze, set_mouth, set_mouth_text, set_chassis, remember_fact, forget_fact, search_web, get_weather, get_current_time, get_brain_status, show_web_page, generate_image, capture_browser_face_to_eye, pose_and_capture_browser_face, cast_media, set_smart_home_device, write_text_file, read_text_file, list_text_files`

B1 tool follow-up prompts for `pose_and_capture_browser_face` were compact and toolless. They correctly told Eric to treat the staged image as a self-image, separate pixels from guesses, and report whether the requested target was visible or missing.

Observed B1 idle response prompts were also toolless in the ledger. That needs follow-up because Scott wants idling to include real tool use.

Brain 2 was active as a monitor/mulling layer, but the new advisory-note path was not verified in this live capture.

## Readiness For Long Audio

Eric is close enough to spend time with, but not close enough to ignore. This is now worth a longer human-feel session because the prosody bridge and mirror tool are real. The system can create moments that feel continuous.

Before relying on it for many hours, the highest-value fixes are:

1. Restart STS/browser-face and confirm B2 advisory notes actually enter B1 context.
2. Make "temporary game rule" stronger: Eric should remember a small session routine until canceled.
3. Add a repeat-suppression guard around UI/face diagnostic metaphors.
4. Make idle tool status show "eligible" vs "actually attached" vs "called."
5. Make Brain 2 never return empty without an explicit logged reason.

## Best Line

"That carousel of moods is basically prosody without the voice - just rhythm and stress on a face that can't speak yet, so I'm doing intonation with pixels instead of pitch."

That line is the keeper. It says the face work and the prosody work are not separate features. They are two routes into the same creature.

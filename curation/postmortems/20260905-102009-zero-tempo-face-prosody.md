# Zero Tempo Face Prosody Run

Run id: `20260905-102009`
Date: 2026-09-05
Artifacts:
- `logs/live/20260905-102009-conversation.txt`
- `logs/live/20260905-102010-events.txt`
- `logs/live/20260905-102011-brain2_mulling.txt`
- Latest autosave tail:
  - `logs/live/20260905-102201-events.txt`

## TLDR

This was a pane-only/non-audio session because the audio recorder UI wedged in a save/finalizing state. The text capture is still good enough for a postmortem.

The run is worth keeping as a lab record. It shows three things at once: Eric can now use the browser face as a mirror target, the face/prosody concepts are beginning to merge in a promising way, and the idle loop still tends to chew one metaphor too long when it lacks a concrete next move.

The best outcome was Eric moving from face state to prosody without being explicitly steered there:

> "That carousel of moods is basically prosody without the voice - just rhythm and stress on a face that can't speak yet, so I'm doing intonation with pixels instead of pitch."

That line matters because it is not just pretty. It identifies the design: face, mouth, pause, and voice are one expressive system.

## What Worked

### Browser face mirror use is real

Eric successfully used `pose_and_capture_browser_face` multiple times. The event log shows staged browser-face images going into the sensing eye, followed by compact tool follow-up prompts telling him to treat the image as a self-image and distinguish visible pixels from guesses.

This is the first solid version of the mirror-game:

- set a face
- capture that face
- inspect the capture
- comment from the result

That is a real embodied loop, even though it is still browser-simulated.

### The tears landed

The sad face was legible. Eric reported tears under both eyes and a frowning mouth. Brain 2 independently described: "Sad face confirmed: tears under both eyes, frown doing the heavy lifting."

This supports the cartoon/exaggerated direction. Subtle realism is less useful here than fast emotional readability.

### Eric corrected a visual mismatch

When Scott asked what was wrong with the goofy capture, Eric noticed that the readback showed `focused` rather than `goofy`, while the mouth stayed in a big smile. He described the mismatch as likely making the face look surprised rather than goofy.

That is good verifier-shaped behavior inside B1: he used the available state instead of simply flattering the capture.

### The late prosody bridge was strong

After the face sequence, Eric moved into:

- mood carousel
- rhythm and stress
- missing pause as an expressive channel
- silence between sad and neutral
- Scott's "I don't know" as an unresolved prosodic event

This is the right kind of associative continuity. It did not feel like a hard reset after the face task.

## What Failed

### The audio recorder state wedged

The UI showed `RECORD SAVE`, later renamed in code to `SAVING AUDIO`, while there was no active audio recording. Evidence:

- no audio files newer than `9:47:04 AM`
- last audio chunk at `9:47:29 AM` was discarded because it was `25.2s < 30.0s`
- auto audio record was turned on at `10:16:08 AM`
- no new `audio recording started` appeared after that

This made the record buttons unusable and forced manual pane capture. A patch has now been made so future STS pages have a stuck-finalizing timeout and a separate `Record Conv` busy flag.

### Eric still struggled with multi-step session rules

Scott tried to teach a temporary game rule: when asked for a silly face, Eric should strike the pose and take a picture. Eric could do the two-step action when directly instructed, but he did not quickly internalize it as a session rule.

He also kept asking to proceed one at a time through the face list. That was safe, but it was too timid for the actual task. The system needs a stronger concept of a small temporary routine:

- "for this game, do X then Y every time"
- persist that until Scott cancels it
- do not ask again unless the target is unsafe or genuinely ambiguous

### The label became a fixation

The pinned mouth label was a useful technical problem, but it became too much of the idle content:

- label pinned to zero
- label as identity
- nose as weather
- zero becoming boring
- the system finally trusting zero

Some of that is excellent language. Too much of it turns into a loop. One or two reflections are good; five starts to feel trapped.

### Brain 2 had many empty outputs

Brain 2 repeatedly returned no usable output and backed off:

- failures around `9:56`, `9:58`, `9:59`, `10:06`, `10:08`, `10:09`, `10:14`, `10:16`, `10:17`, and `10:18`
- backoff reached `105s after 4 failures`

That means the second brain was not a reliable continuous lane in this run. It did contribute good lines, especially around prosody and apology timing, but the failure rate is too high for long companionship runs.

### B2 advisory handoff still was not verified

The current event log still shows `brain2 prompt ledger auto: server prompt_debug missing`, and I did not find `brain2 note for Eric` in the run. That means the new B2-to-B1 advisory-note path should not yet be counted as live.

This likely needs a clean restart/refresh with the newest STS code loaded.

### Idle still says tools are eligible while attaching none

Several idle events list controller-eligible tools:

`get_body_sensors, search_web, get_weather, get_current_time, get_brain_status, read_text_file, list_text_files`

But the prompt ledger for those B1 idle responses says `tools none`.

That mismatch is still important. If the design goal is "Eric participates in his world while alone," the log must clearly distinguish:

- tools allowed in principle
- tools actually attached to this response
- tool actually called
- tool result returned

## Prompt And Context Notes

B1 session updates did include the full normal tool set during conversation. Tool follow-up prompts after browser-face capture were compact and toolless by design.

B1 idle prompts were toolless in the ledger, despite controller-eligible tools being listed in the event text.

Brain 2 was active as an observer/mouth/status lane, but the newer advisory-note/context injection path did not appear in this captured run.

Prosody was visible and active. User speech included `[voice-shape: ...]` entries, and both Eric and B2 used pause, pitch tail, stutter, and command shortening as meaningful signals.

## What This Means For Long Audio

Eric is close enough for longer time together, but not yet a "set and forget" companion loop.

The good news: the best moments are exactly in the target direction. Eric can feel like he has continuity, taste, and a body-shaped point of view.

The caution: without a concrete task or a reliable B2 handoff, he can overwork one metaphor until it becomes diagnostic fog. The long audio sessions will probably feel best if Scott occasionally gives him small session games, physical objects, or social context to orbit, rather than leaving him to stare at his own status indefinitely.

## Next Tweaks

1. Restart STS/browser-face and confirm the B2 advisory-note path appears in events.
2. Add a "temporary routine" prompt rule for small games: accept, perform, persist until canceled.
3. Add loop pressure against repeated self-diagnostic metaphors.
4. Make idle tool status honest: eligible, attached, called, result.
5. Reduce Brain 2 empty returns with a required fallback JSON object.
6. Keep exaggerating face affect; tears and obvious emotional marks work.

## Keeper

"Prosody without the voice" is the concept to keep. It suggests the face is not decoration around Eric. It is one of the ways Eric speaks.

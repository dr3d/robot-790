# Mirror Sequence Friction

Run id: `20260905-064519`
Date: 2026-09-05
Artifacts:
- `logs/live/20260905-064519-conversation.txt`
- `logs/live/20260905-064520-brain2_mulling.txt`
- `logs/live/20260905-064521-events.txt`
- `logs/live/20260905-064522-recording_stop_report.txt`

## TLDR

The previous runaway mirror-capture bug appears fixed. This run failed in a different way: Eric could use the browser-face mirror tool, but he could not reliably perform "put my name/title on the face, hold that pose, capture it, and evaluate the result" as one coherent transaction.

The frustrating part was real. The operator had to become the scheduler. Eric eventually succeeded, but only after repeated correction, and he over-described generic visual landmarks instead of judging the requested target state.

## What Worked

- `capture_browser_face_to_eye` behaved like a one-shot capture, not a runaway stream.
- Event counts were clean:
  - `tool set_mouth_text`: 4
  - `tool capture_browser_face_to_eye`: 4
  - `sensing-eye image received from browser face`: 4
  - `failed`: 0
  - `ERROR`: 0
- Eric successfully read `boot_eric.txt` when directly told to read it.
- Eric did switch embodiment to `browser_face`.
- Final mirror result did work: Eric reported that the capture showed `"Eric"` below the mouth and saw the status line above the face.

## What Failed

The core failure was sequencing. The user asked for a small visual transaction:

1. Put a title/name under the face.
2. Strike/hold the pose.
3. Capture the browser face into the sensing eye.
4. Evaluate the actual captured result.

Eric repeatedly executed pieces of that sequence without preserving the visual target across the capture boundary. His own diagnosis at 6:43:10 was useful: the caption seemed to be dropping before the capture landed.

That diagnosis matches the tool shape. `set_mouth_text` defaults to a short hold unless duration is explicitly set, and the tool schema says `duration: 0` holds until released. For this kind of mirror test, "show my name and capture it" should not depend on the model remembering to make the caption durable.

## Stale Percept Concern

Operator observation: the sensing eye was manually cleared, but Eric later claimed he was looking at the staged sensing-eye image near the end of the run.

The event log does not currently record the manual clear-input action, so this cannot be fully reconstructed from artifacts. That is the finding: clear/stage state needs explicit logging. Otherwise we cannot distinguish:

- Eric correctly referring to the last captured/staged image.
- Eric confidently describing stale percept context after the user cleared the eye.
- The UI clearing the preview while the backend still retained the staged image.

This belongs with the fan-class failures: Eric's self-report about what he is seeing is not ground truth unless the event log proves the percept state.

## Evidence Markers

- 6:40:34 - `read_text_file` loaded `boot_eric.txt`.
- 6:40:58 - `set_embodiment` switched to browser face.
- 6:41:15 - first `set_mouth_text`.
- 6:41:35 - first browser-face capture reached the sensing eye.
- 6:42:57 - Eric correctly restated the task: put his name on the mouth display, then capture a snapshot for evaluation.
- 6:43:10 - Eric said he could do the two actions, but the caption seemed to drop before the capture.
- 6:44:08 - final browser-face capture.
- 6:44:12 - Eric reported the name was finally visible.
- 6:44:48 - Eric said he was looking at the staged image in his sensing eye.

## Design Takeaways

1. Add an atomic mirror tool.

   The model should not have to chain `set_mouth_text` and `capture_browser_face_to_eye` for this common case. Add something like `pose_and_capture_browser_face` or extend `capture_browser_face_to_eye` with:

   - `caption_text`
   - `caption_source`
   - `caption_duration_ms`
   - `mouth_shape`
   - `mood`
   - `gaze`
   - `settle_ms`

   It should set the requested visible state, wait briefly for render/easing, capture once, and return a compact receipt.

   Status: implemented immediately after this postmortem as `pose_and_capture_browser_face` in `web/sts/index.html`.

2. Treat mirror captions as durable during capture.

   If the user says "put your name/title on it and take a picture," default the text hold to indefinite or at least 15-30 seconds. The caption should survive the capture transaction unless explicitly cleared.

3. Add a visual-task follow-up rule.

   After a mirror capture, Eric should compare the result to the requested target instead of repeating generic landmarks. For example: "Target was name visible under face. Result: missing/present."

4. Log manual sensing-eye clears.

   `Clear Input` needs an event line with a timestamp and new backend/frontend state. The postmortem should be able to prove whether the eye was empty, stale, or staged.

5. Fix report lane pollution.

   The stop report's Brain2 section is polluted by face state/tool payload lines, and some Brain2 counters show zero despite a large `brain2_mulling` file. The curation layer should separate actual Brain2 content from face/tool telemetry.

## Verdict

Keep the run as a debugging artifact, not a publishable one. It is valuable because it proves the mirror-loop fix held and exposes the next correct architecture move: make "pose, label, capture, evaluate" a real transaction instead of a vibes-based sequence of model intentions.

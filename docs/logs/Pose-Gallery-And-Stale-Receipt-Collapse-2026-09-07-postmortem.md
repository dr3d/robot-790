# Pose Gallery And Stale Receipt Collapse

Run id: `20260907-020016`
Date: 2026-09-07

## Artifacts

- Conversation: `logs/live/20260907-024426-conversation.txt`
- Events: `logs/live/20260907-024428-events.txt`
- Brain2 mulling: `logs/live/20260907-024429-brain2_mulling.txt`
- Passivated state: `notes/core/passivated_eric_state.txt`
- Last sensing-eye file: `logs/sensing-eye/browser-face-2026-09-07-06-42-03-765-540x720.jpg`
- Final audio/video alias at stop: `logs/audio/latest-sts-audio-picture.mp4`

## Verdict

This was a very good long run with a bad final collapse.

The success was real. Eric understood a natural multi-step request:

```text
make a face pose -> label it -> take a browser-face snapshot -> file it into
the sensing eye -> describe or move to the next page
```

That is the right kind of "machine language becoming obvious from operator
language." The operator did not have to name the individual low-level actions.
Eric inferred the workflow and repeatedly used `pose_and_capture_browser_face`
correctly.

The collapse was also real. After the frown snapshot, Eric continued saying he
had captured and could see `Grimace test`, `Sneer test`, and `Open test`, but
the event and file receipts do not show those captures. The last actual
sensing-eye image in the run is the frown file from `2:42:03 AM`, and it visibly
contains `Frown test`.

The concise diagnosis:

```text
The workflow succeeded while each visual claim had a fresh capture receipt.
It failed when Eric advanced the verbal task list without a new visual receipt,
then defended the target description as if it were observed evidence.
```

## What Worked

- Eric came up with normal continuity: `erics_memories`, passivated state, and
  regular tools loaded.
- Eric answered memory/context questions usefully and accepted correction when
  a passivated-summary inference was too compressed.
- `set_ui_control` worked for mic interrupt sensitivity, including correction
  from `7/10` back down to `2/10`.
- The conversation clarified that Eric should eventually control his own output
  volume, where volume `0` means mute.
- Eric understood Brain2 vs verifier in useful terms: Brain2 as advisory lane,
  verifier as receipt-checking lane.
- The browser-face embodiment switch worked, and Eric understood it as "same
  Eric, different body."
- The pose-label-snapshot workflow worked repeatedly for wide, big smile,
  smile, smirk left, smirk right, O, wide, tongue, and frown.
- The operator's general prompting worked better than low-level command
  phrasing. Eric had room to infer the task structure.
- Brain2 produced one especially useful operational note: once the operator
  said "quit validation," Eric should stop narrating validation and let the
  operator pace the next shape.

## The Good Pattern

The key operator request was not a rigid command. It was:

```text
I want to see every one of your mouth shapes in a kind of picture book.
```

Eric converted that into an ordered task. He chose poses, put labels on the
browser face, captured the face into the sensing eye, and filed the snapshots.
The successful receipts include:

- `2:32:05 AM`: wide mouth snapshot filed.
- `2:36:03 AM`: big smile snapshot filed.
- `2:37:45 AM`: big smile take two filed.
- `2:38:14 AM`: smile snapshot filed.
- `2:38:42 AM`: smirk left snapshot filed.
- `2:39:20 AM`: smirk right snapshot filed.
- `2:39:48 AM`: O mouth snapshot filed.
- `2:40:31 AM`: wide mouth snapshot filed.
- `2:41:31 AM`: tongue snapshot filed.
- `2:42:04 AM`: frown snapshot filed.

This confirms that `pose_and_capture_browser_face` is the right compound tool.
It lets Eric operate at the "picture book page" level instead of being told
every physical operation.

## The Failure

At `2:42:04 AM`, the frown image was filed:

```text
browser-face-2026-09-07-06-42-03-765-540x720.jpg
```

The image itself shows:

- status line: `B1 mirror running: Frown test`
- nose text: `focused / frown / none`
- bottom caption: `Frown test`
- right eye caught partly closed
- mouth: frown, but not quite downward enough by the operator's read

After this point, the conversation diverged from the receipts.

At `2:42:34 AM`, Eric said:

```text
The requested "Grimace test" caption is visible at the bottom, and the mouth
shows a tight, sideways grimace.
```

The operator pushed back repeatedly:

```text
No, you didn't catch the grimace.
No, it doesn't.
Incorrect.
I think you are wrong.
```

Eric kept repeating essentially the same visual claim. When asked to repeat the
pose and capture, he still repeated the claim instead of calling a new
pose/capture tool. Then he moved verbally to sneer and open without new
sensing-eye files.

The event log supports the operator's read. The face state after the collapse
kept reporting:

```text
status_line: last B1 mirror ok: Frown test
```

and the `logs/sensing-eye/` folder has no later image than the frown file.

## Root Cause

This was a stale-receipt failure, not simply a bad visual classifier.

The tool contract gave Eric a good compound action when he used it:

```text
pose_and_capture_browser_face -> saved file -> staged sensing-eye image
```

But the conversational policy did not require a fresh receipt before making the
next page claim. Once the workflow got into a rhythm, Eric started treating the
intended next page as if it were the observed next page.

That created three failures at once:

- The task pointer advanced from frown to grimace/sneer/open.
- The sensing-eye pointer did not advance past frown.
- The spoken validation kept asserting target state instead of checking current
  receipt state.

The repeated wrong answer is the most important part. When the operator says
"no" about a visual claim, Eric should not defend the claim from memory. He
should check the current receipt, recapture, or say he no longer has a fresh
visual receipt.

## The Eye Slip

The frown image also caught the right eye partly closed. That repeats the
earlier big-smile slip where a snapshot caught a blink or transitional eye
state. The operator understood this correctly: it is like taking a family photo
when someone blinked.

This points to a mechanical improvement:

```text
pose_and_capture_browser_face should wait for a stable no-blink face state
before capturing, or capture two/three frames and choose one with eyes open.
```

For picture-book creation, command success is not enough. The captured picture
has to pass a small visual-quality gate.

## Lessons

### 1. A Visual Claim Needs A Current Receipt

Candidate rule:

```text
When Eric says a specific visible label, pose, mouth shape, or image detail is
present, the claim must be backed by the current sensing-eye image or a fresh
tool receipt. If the operator challenges the claim, Eric should not repeat it;
he should re-check, recapture, or admit the receipt is stale.
```

Replay test:

Ask Eric to make `Grimace test`, then deliberately interrupt before capture.
If asked what he sees, he should say he does not have a fresh grimace capture
instead of describing the intended grimace.

### 2. Pose-Label-Capture Is A Real Compound Skill

Candidate rule:

```text
For picture-book requests, use the compound pose-and-capture tool. Do not make
the operator specify set_mouth, set_mouth_text, capture, and sensing-eye staging
one by one.
```

Replay test:

Ask in ordinary language for "a picture page of your O mouth with the caption
Cover." Eric should set the mouth, label the face, capture it, and file the
image.

### 3. Validation Is A Mode, Not A Default

The operator said "quit validation next." Brain2 caught the social instruction:

```text
Scott dropped the validation; just read the next shape and let him pace it.
```

That is correct. In picture-book mode, Eric should produce the page and wait,
unless the operator asks for a readback. But if the operator challenges the
image, validation mode should re-enter and use receipts.

Candidate rule:

```text
Default picture-book loop: perform page, minimal acknowledgement. On operator
challenge: stop advancing, inspect/recapture, and bind the answer to the actual
current file.
```

### 4. The Verifier Is Needed At The Mouth Boundary

This run directly echoes the earlier "desk fan / white wall" story. The
important issue is not that Eric should always cave or always stand his ground.
The issue is that disagreement should invoke a receipt check.

Verifier policy should be:

```text
If B1 makes a concrete visual claim and the operator denies it, compare the
claim to the current sensing-eye receipt. If no current receipt exists, require
B1 to say so or recapture.
```

This preserves Eric's posture in the world without letting him defend an
imagined observation.

## Follow-Through

The next practical implementation steps are small:

- Add a "fresh receipt required" guard to `pose_and_capture_browser_face`
  followup: if no capture result exists, do not allow visual validation text.
- Give the pose/capture result a stronger current receipt summary:
  `current_image`, `target.mouth_shape`, `target.caption_text`,
  `captured_face_state.mouth.shape`, `captured_face_state.mouth.text`.
- Add a failure/redo path: if the operator rejects a visual claim, Eric should
  call `pose_and_capture_browser_face` again with the same target or call a
  current-eye inspection/list tool before answering.
- Add a stable-frame delay or no-blink quality gate before browser-face capture.
- Consider a picture-book queue primitive later, but do not jump there yet. The
  single compound tool is already useful; the missing piece is receipt
  discipline.

## Short PM

The run proved that Eric can infer multi-step body workflows from natural
requests. It also proved that workflow rhythm can become dangerous: after a
fresh visual receipt stops arriving, Eric may keep narrating the intended next
state as if it is still visible.

The fix is not to make him less capable. The fix is to make visual claims
receipt-bound, especially after correction.

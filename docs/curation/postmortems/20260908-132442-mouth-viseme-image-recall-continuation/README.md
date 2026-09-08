# Mouth Viseme And Image Recall Continuation

- Session: 2026-09-08 13:08-13:24 EDT
- Session note: `notes/sessions/20260908-132442-mouth-viseme-image-recall-continuation.txt`
- Parent session: `notes/sessions/20260908-121029-daily-driver-guest-rehearsal-timestamp-check.txt`
- Model receipt: Qwen 27B MTP Fast, `qwen3.8-27b-nvfp4-mtp`, reasoning none, 131072 context, 2 parallel slots

## Summary

This was the next direct child of the Daily Driver guest-rehearsal thread. It
used the same verified six-note boot environment and turned into a compact
mouth-lab session: a nine-state viseme reference went into Sensing Eye, Eric
generated three open-mouth candidates, and each candidate was preserved as an
inspectable image artifact plus an eye-note record.

The striking middle section was not magic, but it is genuinely useful
continuity. When asked for v1 and then v2, STS reopened the already-saved
Sensing Eye records `eye-2` and `eye-3` into B1 context. Later, the older
September 7 image named `daisied-electra` was brought back into the eye as a
preserved artifact. The active system could identify the stored object and
talk about its prior origin while being candid that it did not retain the act
of generating it.

That last test also exposes the important boundary. The source image is a
rusted car with a small floral object on its bumper. Eric initially described
the car accurately, then drifted into an unsupported "seven petals" flower
narrative. So the image-note and provenance machinery successfully carries and
reopens visual artifacts; the model's spoken interpretation still needs a
fresh-image grounding check each time.

## What Held

- The new session is an intact continuation of the prior guest-rehearsal note.
  Its parent and all six pinned dependency receipts currently resolve and match
  their save-time hashes.
- The viseme chart entered Sensing Eye at `1:10:28 PM`, and Eric identified
  the nine intended mouth categories well enough to frame the next engineering
  step as a phoneme-driven mouth set.
- Three generated candidates were retained rather than becoming ephemeral UI
  output: v1 at `1:12:48 PM`, v2 at `1:14:17 PM`, and the more robotic v3 at
  `1:15:32 PM`. Each was moved into Sensing Eye and opened into B1 context.
- At `1:18:11 PM` and `1:18:43 PM`, the system explicitly reopened the saved
  v1 and v2 eye-note records for comparison. This is the concrete same-session
  visual-recall behavior that made the interaction feel continuous.
- The old Daisied Electra source image from September 7 remained available on
  disk, was deliberately placed into the current eye at `1:18:49 PM`, and its
  filename, nearby transcript, and operator context were preserved in the
  new eye-note metadata.
- Eric made the episodic limit legible: he said the artifact and the fact that
  he made it remained, but the act of making it did not. That is appropriately
  narrower than pretending to have a full remembered generation session.
- The operator cleared the staged image before shutdown. The final recording
  report says `Sensing input: none`, leaving a clean next-run test for whether
  any visual residue incorrectly survives without a fresh receipt.

## What Needs Tightening

- The Daisied Electra test proved retrieval of an artifact, not autonomous
  visual recall. The operator explicitly dropped the old image into Sensing
  Eye; B1 then received the current image and metadata. That is the honest
  and valuable mechanism to document.
- Semantic grounding drifted after the initial car description. The later
  "seven petals" story was not supported by the source image, so image-related
  dialogue should remain tied to the active image note or be labeled as an
  interpretation rather than a visual fact.
- The opening time exchange still began with a guessed `12:05 PM` answer.
  Eric then called the clock and corrected to `1:09 PM`. The prompt-wrapper
  repair from the prior PM needs a live regression check: current-time
  questions should get a fresh clock receipt on the first answer.
- The third mouth candidate is closer to the desired robotic direction, but a
  single static open shape is not yet a mouth system. The practical next unit
  is a coherent full viseme set with stable landmark mapping and easing, not
  more isolated open-mouth experiments.

## Retrieval Meaning

For this PM, "image recall" means that STS can retain a visual artifact and
its provenance in Sensing Eye, select or reopen it later, and inject the
current image note into B1 context. It does not mean that B1 is reconstructing
pixels from a hidden internal image store. Keeping those two claims separate
is exactly what makes the observed behavior useful to build on.

## Receipts

- `1:08:28 PM`: clean continuation begins with the prior guest-rehearsal note
  and Daily Driver note present in the pinned environment.
- `1:10:28 PM`: viseme reference chart becomes `eye-1` and is opened into B1
  context.
- `1:12:48 PM`, `1:14:17 PM`, and `1:15:32 PM`: v1, v2, and v3 image
  artifacts are generated.
- `1:12:53 PM`, `1:14:36 PM`, and `1:15:58 PM`: those candidates become
  `eye-2`, `eye-3`, and `eye-4` respectively.
- `1:18:11 PM`: v1 eye note is explicitly reopened into B1 context.
- `1:18:43 PM`: v2 eye note is explicitly reopened into B1 context.
- `1:18:49 PM`: the prior `daisied-electra` artifact becomes `eye-5` in the
  current run.
- `1:19:17 PM`: Eric accurately identifies a rusted car in the active image.
- `1:20:33 PM`: Eric distinguishes retained artifact/provenance from a missing
  memory of the original generation act.
- `1:23:14 PM`: the Daisied Electra sensing input is cleared.
- `1:24:42 PM`: disconnect writes this child session note and recording
  finalization completes immediately afterward.

## Artifacts

- `session-note-original-generated-name.txt`: STS's untouched generated note.
- `session-note-copy.txt`: the active captioned note; only its two
  self-references use the human-readable filename.
- `conversation.txt`, `events.txt`, `brain2_mulling.txt`, and
  `recording-stop-report.txt`: final live-pane and runtime receipts.
- `session-audio-source.webm`, `session-audio-picture.mp4`, and
  `session-audio-cover.jpg`: full-session recording artifacts.
- `viseme-reference-chart.jpg` and its metadata sidecar: the visual brief.
- `generated-viseme-v1.png` through `generated-viseme-v3-robotic.png`, with
  matching JSON: the full-quality generated candidates and prompts.
- `eye-viseme-v1.jpg` through `eye-viseme-v3-robotic.jpg`, with matching JSON:
  the corresponding Sensing Eye records.
- `generated-daisied-electra.png` and JSON: the original September 7 image.
- `recalled-eye-daisied-electra.jpg` and JSON: the current session's
  Sensing Eye record and handoff context.

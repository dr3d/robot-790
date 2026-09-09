# Image Recall Stall And Selector Mismatch

- Session: 2026-09-09 02:06-02:22 EDT
- Session note: notes/sessions/20260909-022235-image-recall-stall-and-selector-mismatch.txt
- Parent session: notes/sessions/20260908-223246-two-voice-skit-curtain-call.txt
- Model receipt: model not scanned
- Saved duration: 16 minutes, 40 seconds

## Summary

This was a short continuity and embodiment run that became a useful Sensing
Eye audit. Robot 790 correctly resumed the previous skit session, identified
the loaded notes, remembered the spirograph work, and accepted three staged
operator images. The run then exposed two separate recall problems.

The first request to return to the previous image was not a GPU job. At
2:17:40 AM, the model listed eye notes and said it was pulling the prior image
up. Its attempted next tool markup was suppressed, so no recall happened then.
After the operator checked in at 2:18:14 AM, the next executable recall at
2:18:18 AM correctly staged eye-1, the original 01_10_23 image. The visible
wait after the premature claim was about 32 seconds; the full request-to-recall
path took about 53 seconds.

At 2:18:50 AM, a new image was accepted, saved, and staged into B1 as eye-3.
The operator then spoke several clear reactions and questions in short bursts
through 2:19:32 AM. Robot 790 did not answer until 2:19:51 AM, first asking
for a repeat, and only described the new image after a second prompt at
2:20:03 AM. That is 19 seconds after the last completed input transcription
and 61 seconds after the image arrived. Image staging also triggered an audio
recording rollover and several B1 session updates. The receipts show no
deliberate_once call, GPU-watch start, image-generation call, or model-timeout
entry in that period. This is a real bad image-and-conversation interaction,
but its cause is not established by the current trace.

The final recall attempt was a separate, deterministic selection error. The
model first listed the notes correctly: original image eye-1 at position 3,
newest image eye-3 at position 1. It then invoked select_sensing_eye_image
with index 1. The tool correctly selected eye-3, but the spoken follow-up and
Browser Face status still described the intended first image. The selector did
not fail; the request was stale or ambiguous, and result truth did not replace
the model's intended story.

## What Held

- The child session resumed from the two-voice skit session and retained the
  expected nine saved note dependencies.
- Each dropped image was saved with a durable Sensing Eye file and opened into
  B1 context. The 2:18:50 AM intake receipt includes eye-3, its filename,
  dimensions, source, nearby transcript, and provenance.
- The first recovery recall selected the correct durable item: eye-1,
  ChatGPT Image Sep 9, 2026, 01_10_23 AM.png.
- The later list operation accurately named the original and current images,
  including their stable session ids. The tool result also retained the actual
  selected item, which made the mismatch auditable rather than mysterious.
- Session audio, final panes, the original generated-note name, and the
  captioned active note are preserved together in this PM bundle.

## What Needs Tightening

- Instrument image-to-response latency. Record explicit timestamps for image
  normalization, filesystem save completion, audio rollover completion, B1
  session update acknowledgement, final input transcription, response creation,
  and first output audio. That will distinguish a rendering, session-update,
  realtime, or model delay without guessing that the GPU is responsible.
- Select by stable id or exact filename after a list. Do not use a mutable
  ordinal such as index 1 to satisfy a request for a named, earlier picture.
  The schema already supports image_id and query; tool guidance should prefer
  image_id from the immediately preceding list result.
- Make post-tool speech and visible status receipt-led. After a recall, name
  result.selected.id and result.selected.name, not the target the model hoped
  it selected. A mismatch should be visible immediately.
- A list followed by a promise to act currently takes another model turn. When
  the next call is malformed or suppressed, the operator hears an action claim
  without an action. Tighten the follow-up so it says the image was found until
  an actual selection receipt arrives.
- A repeat drop is treated as a fresh visual arrival. The client re-encodes,
  saves, and gives it a new eye-N identity; an identical filename overwrites
  the durable file, while a changed name creates another durable record. Add a
  stable content identity or hash, preserve a separate seen-again event, and
  keep the visual node's identity distinct from each arrival event.

## Receipts

- 2:17:40 AM: list_sensing_eye_notes returns the then-current eye-2 and
  original eye-1. Robot 790 says it is pulling up the prior image.
- 2:17:46 AM: tool markup is suppressed, so the promised recall has not run.
- 2:18:18 AM: recall_sensing_eye_note selects eye-1 and stages the original
  01_10_23 image.
- 2:18:50 AM: operator drop creates and stages eye-3, the newer 01_22_25
  image, in B1 context.
- 2:19:32 AM: the final short input burst completes transcription.
- 2:19:51 AM: first delayed reply asks the operator to repeat, 19 seconds
  after the final input and 61 seconds after image staging.
- 2:20:03 AM: next reply identifies the newer yellow face image.
- 2:20:58 AM: the note list correctly says eye-1 is the first face and eye-3
  is the current image.
- 2:21:34 AM: select_sensing_eye_image receives index 1 and truthfully stages
  eye-3. The concurrent Browser Face status incorrectly claims the first image.
- 2:22:54 AM: unrelated disconnect closeout reports an 18-second stop-audio
  timeout; final audio splicing nevertheless completes at 2:23:19 AM.

## Artifacts

- session-note-original-generated-name.txt: preserved uncaptioned source note.
- session-note-copy.txt: active captioned note with two self-references updated.
- conversation.txt, events.txt, and brain2_mulling.txt: final live-pane
  snapshots.
- recording-stop-report.txt: final recording and context receipt.
- session-audio-source.webm, session-audio-picture.mp4, and
  session-audio-cover.jpg: the complete spoken-session recording.

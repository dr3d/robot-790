# Private Output Boundary Repair

September 17, 2026. Follows the post-reboot brain-leak PM at
`logs/runs/20260917-000024-brain-leak/postmortem.md`.

## Changes and Prompt Disclosure

- Image staging now attaches a marked `[STS sensing image]` JSON record with
  identity, name, provenance and media type. It no longer repeats the paragraph
  of administrative directions that Eric recited during the toaster act. A
  generated image is not described as a user-supplied image. No new response is
  requested by staging itself. Historical image messages remain append-only.
- Stable B1 runtime protocol instructions explain that image metadata is private,
  older images are historical evidence, and public text addresses the person
  rather than narrating private deliberation. This **is a prompt change**. It
  explicitly preserves imaginative performance and requested explanations.
  Existing salience handling remains in runtime/idle context rather than each
  image attachment. Personality, setup cards, sampling and model are unchanged.
- The pre-speech/history guard recognizes all current private message starts,
  including image, tool-continuation and recovery markers. It also removes
  explicit `<think>...</think>` spans, handles split tokens and unterminated
  spans, and resumes public output after a closing thinking tag. Nested thinking
  spans are supported; an isolated closing tag is discarded. This is a protocol
  parser, not an English phrase classifier. Ordinary text remains unchanged.
- Tool calls and usage survive suppression. A fully suppressed, tool-free answer
  uses the existing bounded recovery path; it does not retry completed tools.
  Filtering is before TTS, visible transcript events and assistant history.

## Evidence and Limits

The original final leak matches the old image wrapper, not the contemporaneous
B2 result. The installed provider adapter already ignores separate reasoning
fields; tests now exercise that contract for streaming and nonstream responses.
The old run had no raw provider capture, so its untagged deliberation cannot be
attributed conclusively to model behavior versus upstream serialization. The
new prompt addresses it, but unmarked private-sounding prose is deliberately not
deleted by a semantic/English filter. This remains a live-test limitation.

Historical raw transcripts and saved notes were not rewritten. Loading the bad
run still loads that recorded speech. The stable instructions explicitly tell
B1 not to imitate accidental private-text leaks in earlier transcripts.

Verification: **771 Python tests, 424 JavaScript tests passed**. Python reports
the existing Starlette/httpx deprecation warning. Focused tests cover every split
of private markers, thinking spans, multilingual public content, tool retention,
history filtering, two consecutive images and unchanged prior image messages.

Two bounded local requests to the already-loaded model used the new stable
protocol and synthetic histories containing old leaks. The ambiguity probe
answered publicly without deliberative prose; the image probe selected
`move_generated_image_to_sensing_eye` with no spoken wrapper. Both reported zero
reasoning tokens. These are smoke checks, not replay of the full live session.
No tools were executed, no paid images generated, and no audio played. Probe
source and results are saved beside the PM.

## Retest

Deployment: realtime restarted and warmed at 00:07:25 EDT September 17 (PID
25180). The live page returned HTTP 200 with the new image marker and without
the old staging paragraph. LM Studio retained the same model, 131072 context and
two parallel slots. No ongoing wire capture was enabled. Existing lint findings
in the touched Python files remain; the new additions introduce none of those
reported findings. `git diff --check` passed.

Refresh disconnected STS after backend deployment. Continue the same thread to
exercise resistance to its recorded leak; use an earlier clean parent for a less
contaminated comparison. Ask two or three impossible questions using the same
draw / eye / explain routine, then ask a brief ambiguous followup. Check for
internal instructions or analysis reaching speech and for the actual eye move
still completing. Do not infer success solely from a clean transcript: listen
to playback too.

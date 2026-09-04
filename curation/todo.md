# Curation TODO

## Eric Great Time Machine Cover Art

- Media: `docs/media/videos/Eric-Great-Time-Machine-2026-08-29-162843.mp4`
- Current preview: `docs/media/previews/Eric-Great-Time-Machine-2026-08-29-162843.jpg`
- Request: find a better image and replace the cover art/preview for the media item titled `Eric Great Time Machine 2026-08-29 16:28:43`.
- Status: waiting for image choice.

## Docs Article Read/TTS

- Report: article read did not work in the browser.
- Status: parked for later diagnosis.

## Browser Face Replay Renderer

- Goal: post-run artifacts should be able to recreate the browser face video
  from event logs instead of relying only on live screen capture.
- Requirement: replay through the same centralized face rendering code used by
  the browser face, including pupil easing, mouth easing, mood poses, and the
  mouth-text / word-portal layer.
- Design rule: this should not be magic. Face state events, timestamps, renderer
  version, and selected embodiment should be enough to reproduce what Eric's
  face showed during a run.
- Status: parked after adding the immediate browser-face canvas recorder.
# Image / article pins

- Hold `docs/media/images/Uh-Emerence-Not.jpg` as a context image for the
  empty-brain / "uh, emergence, not magic" thread. It explains why Scott was
  chasing the empty-context experiment: not to prove a hidden soul, but to
  understand what the tool/event-loop scaffold contributes when the seed starts
  nearly blank. Revisit with `docs/articles/start-with-nothing-but-tools.md`
  and `docs/articles/why-the-empty-context-worked.md`.

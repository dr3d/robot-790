# Remembered Image Reload, Sensing-Eye Switch

Session: 2026-09-08 00:11-00:18 EDT  
Session note: `notes/sessions/20260908-001758-remembered-image-reload-sensing-eye-switch.txt`  
Parent session: `notes/sessions/20260907-232827-standing-joke-routine-archive-check.txt`

## Summary

This run was a useful continuity shakeout. Eric booted from the prior session chain, generated a new "frustrated at the UI refresh bug" image, moved that generated image into the sensing eye, cleared it, listed prior eye memories, and successfully recalled an older saved image from disk into the sensing eye.

The main failure was switching to a different remembered image after one image had already been recalled. The tool path did not hard-fail, but the selected image kept resolving back to the study-at-night image, making the interaction feel stuck.

## What Worked

- Generated image to sensing eye worked:
  - `20260908-001310-openai-frustrated-at-the-ui-refresh-bug.png`
  - Saved into sensing-eye history as `20260908-001310-openai-frustrated-at-the-ui-refresh-bug.jpg`.
- Remembered image reload worked:
  - Eric listed saved eye memories.
  - `20260907-162426-openai-scott-s-study-at-night.jpg` was recalled from `logs/sensing-eye`.
  - The transcript received explicit system markers for "recalled into eye" and "opened into B1 context."
- The remembered image carried useful memory context:
  - Source, filename, nearby transcript, and last user text were available in metadata.
- Eric's spoken understanding was strong:
  - He understood that old images are a small eye-note library.
  - He identified the current switching failure as a lower-level selection/state problem instead of pretending success.

## What Failed

- After recalling the study-at-night image, follow-up attempts to show "a different one" kept selecting the same image.
- The event log shows the real tool calls selecting the study image repeatedly:
  - `12:14:58` selected `20260907-162426-openai-scott-s-study-at-night.jpg`
  - `12:15:23` selected the same image again
  - `12:15:46` selected the same image twice
  - `12:17:07` selected the same image after clearing
- A later `index=5` selection appeared as suppressed output markup, not a real tool execution. That means Eric tried to express a tool call in text, but the bridge correctly suppressed it rather than executing it.

## Likely Cause

When the older study image was reopened from disk, it became a fresh session-history item and was promoted to the newest/current entry. Later unqualified calls to `select_sensing_eye_image` defaulted back to index `1`, which was now the current study image. So the system looked like it was unable to switch, even though the list itself contained the other images.

This is not primarily a filesystem load failure. It is a selection-default and model-tooling ergonomics failure.

## Fix Applied

`web/sts/index.html` now preserves the difference between:

- an explicit `index: 1`
- no selector supplied at all

When no `index`, `id`, or `query` is supplied and the newest eye note is already current, blank recall now selects the next non-current eye note. Exact index, id, and filename/query recalls still keep their normal behavior.

Regression test added:

- `blank sensing-eye recall skips the already-current newest note`

Verification:

- `node --test tests\sts_runtime.test.cjs`
- 37 tests passed.

## Artifacts

- `session-note-copy.txt`
- `conversation.txt`
- `events.txt`
- `brain2_mulling.txt`
- `session-audio-picture.mp4`
- `session-audio-source.webm`
- `generated-frustrated-ui.png`
- `generated-frustrated-ui.json`
- `eye-frustrated-ui.jpg`
- `eye-frustrated-ui.jpg.json`
- `recalled-eye-study-at-night.jpg`
- `recalled-eye-study-at-night.jpg.json`

## Next Improvements

- Prefer exact `note_id` or filename in Eric's instructions after listing eye memories.
- Consider showing a small "current" marker in the eye-note list so Scott and Eric can both see when index `1` is just the already-open image.
- Log real function-call arguments next to tool results for easier postmortems.

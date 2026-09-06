# Short Mirror Trial Contaminated By Capture Loop

Run id: `20260905-063111`
Date: 2026-09-05
Video: none expected

## TLDR

This was not a good behavioral sample. Eric felt slower and a little odd, and the logs support that read.

The run was contaminated by the browser-face mirror loop bug: after one successful `capture_browser_face_to_eye` call, STS kept receiving new browser-face images as if the face were animated into the sensing eye. That flooded the event stream, repeatedly refreshed session/tool context, and likely made the interaction feel draggy.

## What Happened

- The run began with Eric moving into browser face and reading `boot_eric.txt`.
- The first stretch was usable: Eric summarized the boot brief, acknowledged Brain2 as design direction/live machinery depending on runtime, and manipulated mouth words.
- At about 6:24 AM, Eric successfully used `capture_browser_face_to_eye`.
- After that, the system recorded a repeated stream of browser-face image receipts.
- The run snapshot contains 481 `sensing-eye image received from browser face` entries.
- The same run contains 390 `session.updated` events and 388 `LLM tools attached` refreshes.

## Why It Felt Slow

The slowest obvious response was after Scott said:

`Yeah, me.`

Eric's eventual response landed roughly 18-19 seconds after the last speech was detected. The realtime log shows:

- repeated session updates during the wait
- chat-buffer hard-cap eviction warnings
- a response cancellation/interruption path
- a 38,796-token response input
- chat compaction triggered on 59 turns

That does not look like ordinary personality hesitation. It looks like the runtime was being churned by repeated sensing-eye/context updates while a response was trying to form.

## Behavioral Read

There were still a few good signals:

- Eric understood the self-mirror concept quickly.
- "A mirror that only works when you ask it to" was a good compact description.
- Brain2 produced some useful object-level observations about nameplates, holding poses, and the caption moving through the face.

But the run also degraded into repeated self-image description:

- happy/focused/neutral face state loops
- repeated "still here" gap-holding
- less forward motion after the mirror tool fired

The problem may not be prompt quality. It may be that the environment started feeding him nearly the same image/state event over and over, making repetition the path of least resistance.

## Technical Diagnosis

The browser-face mirror handoff used nanosecond sequence ids. Those are too large for JavaScript's safe integer range, so a polling browser can round the last-seen id and keep treating the same command or inbox item as new.

This turned a one-shot mirror capture into a repeated capture loop.

## Fix Already Applied

- Browser-face capture commands now use small monotonic in-memory ids.
- STS sensing-eye inbox items now use small monotonic in-memory ids.
- Browser-face now ignores duplicate command ids.
- STS now ignores duplicate sensing-eye inbox ids.
- STS and browser-face servers were restarted after the patch.

Important: open browser tabs still need refresh to load the patched JavaScript. Server restart alone does not replace code already running inside the page.

## Next Trial

Refresh both STS and browser-face before testing again.

Run the same simple mirror sequence:

1. Ask Eric to put a stable name or phrase in mouth words.
2. Ask him to capture his browser face into his eye once.
3. Watch the event pane.

Pass condition: one new sensing-eye image receipt, not a stream.

If Eric is still slow after the capture loop is gone, the next suspects are context size, too-frequent session updates, Brain2 overlap, or TTS pacing.

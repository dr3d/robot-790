# Browser Face Mirror Loop Bug

Run id: `20260905-063111`
Date: 2026-09-05

## TLDR

Scott saw the sensing-eye preview look animated and stopped the run because it was unclear whether Eric was taking pictures rapidly.

The logs say yes: the browser face was pushing repeated fresh captures into the sensing eye. This was not intended behavior for the one-shot mirror command.

## Evidence

- A single `capture_browser_face_to_eye` tool call completed at about 6:24 AM.
- Immediately afterward, the event log recorded repeated `sensing-eye image received from browser face` entries.
- The latest event snapshot contained 481 browser-face image receipts, continuing until about 6:31 AM.

## Likely Cause

The handoff used nanosecond timestamps as sequence ids. Those ids are larger than JavaScript's safe integer range, so browser-side `after` polling could round the last-seen id and ask for the same command again.

That made a one-shot capture command behave like a repeated capture loop.

## Fix Applied

- Browser-face capture commands now use a small monotonic in-memory sequence counter.
- STS sensing-eye inbox items now use a small monotonic in-memory sequence counter.
- The browser face now remembers recently handled command ids and refuses to execute the same command twice.
- STS now remembers recently handled sensing-eye inbox ids and refuses to restage the same inbox item twice.

## Next Trial

Restart the STS page server and browser-face server, refresh both pages, then ask Eric for one mirror capture.

Expected result: one new sensing-eye image, not an animated stream.

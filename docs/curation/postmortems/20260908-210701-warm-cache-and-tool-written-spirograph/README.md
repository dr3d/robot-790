# Warm Cache Check And Tool-Written Spirograph

- Session: 2026-09-08 20:59-21:07 EDT
- Session note: `notes/sessions/20260908-210701-warm-cache-and-tool-written-spirograph.txt`
- Parent session: `notes/sessions/20260908-132442-mouth-viseme-image-recall-continuation.txt`
- Model receipt: Qwen 27B MTP Fast, `qwen3.8-27b-nvfp4-mtp`, reasoning none, 131072 context, 2 parallel slots

## Summary

This was a short continuation on top of the mouth-viseme and image-recall
thread, used deliberately as a felt latency check after the prompt-cache
repair. The first fresh-connect diagnostic turn was still cold and measured at
about 12.6 seconds to first speech. After that, ordinary replies were much
quicker, including replies after Brain 2 advisories. This is encouraging
evidence that the recurring Brain 2-driven cold reset is gone, although one
short run is not a full performance benchmark.

The new experiment was practical rather than theatrical: the operator asked
Robot 790 to research and save an interactive Python spirograph program. It
searched the web, then used the real `write_text_file` tool to create
`notes/spirograph.txt`, and used it again to overwrite that first draft with an
interactive version. The saved program is part of this bundle and passes
Python syntax compilation.

The important claim is narrow. This is a successful tool-mediated local file
write with an inspectable receipt, not proof that every spoken programming
request will route to tools correctly or that the generated GUI program has
been exercised in every branch.

## What Held

- Connect latest restored the prior mouth-viseme session and its six expected
  dependencies, for seven loaded notes at connect.
- The opening cold diagnostic answer was followed by concise, responsive turns:
  Fibonacci arrived one second after the user turn, and the later conversational
  replies generally returned in roughly one to six seconds.
- Brain 2 completed advisories at `9:01:04 PM`, `9:01:23 PM`, and `9:05:40 PM`.
  The event log does not show a B1 `session.update` attached to those advisory
  events, which is the behavior the warm-cache repair was meant to preserve.
- Robot 790 searched for current spirograph references before drafting code,
  using the query `Python spirograph program turtle math hypotrochoid
  epicycloid`.
- At `9:04:35 PM`, `write_text_file` created `spirograph.txt` with 761
  characters. At `9:05:13 PM`, the same tool overwrote it with the 3,376
  character interactive version.
- Each write received a deterministic success receipt, and Browser Face showed
  `B1 write ok: spirograph.txt` while the result was active.
- The final source file compiles cleanly under `python -m py_compile`.
- Disconnect wrote the timestamped child session note, finalized the audio
  picture, and captured the live panes.

## What Needs Tightening

- The first response to the file request said that Robot 790 could not write
  files, even though `write_text_file` was enabled. He routed correctly only
  after the operator asked whether he had written the note. Tool availability
  is real; tool-selection confidence needs to become more reliable.
- The program is syntactically valid but has not yet had a live GUI run. Static
  review found that choices `1` and `2` return their Turtle screen without
  calling `screen.mainloop()`; the `both` branch does call it. The first actual
  run should test all three choices before treating it as a finished program.
- The `9:03:48 PM` web-search follow-up did issue a B1 `session.update`.
  That was tied to a new external search receipt, not a Brain 2 advisory, but
  it remains worth measuring separately because any prompt rewrite can disturb
  a warm cache.
- The opening KV-cache diagnosis was contaminated by a rejected historical
  runtime experiment that was being surfaced as current model state. The raw
  transcript preserves that mistake; a post-run status repair now requires an
  explicit verified active-runtime record before such KV or audit metadata is
  presented as live.
- Brain 2 returned no usable output twice. Those failures were brief and did
  not derail the interaction, but they remain visible receipts rather than
  being silently ignored.

## Receipts

- `8:59:32 PM`: Connect latest loads the parent session and six dependency
  notes; the initial B1 prompt ledger reports about 22,886 instruction tokens.
- `9:00:03 PM`: first diagnostic response reports about 12.6 seconds to first
  speech from the fresh connection.
- `9:01:04 PM` and `9:01:23 PM`: Brain 2 produces its first useful advisory
  outputs; later B1 speech remains responsive.
- `9:03:02 PM`: Fibonacci response demonstrates a one-second first transcript
  response during the warmed run.
- `9:03:45 PM`: web search completes with spirograph references.
- `9:04:35 PM`: first verified `write_text_file` receipt creates
  `spirograph.txt`.
- `9:05:13 PM`: second verified write overwrites the same file with the
  interactive version.
- `9:05:40 PM`: Brain 2 marks the spirograph task closed instead of extending
  it.
- `9:07:01 PM`: disconnect saves this child session note; audio finalization
  follows at `9:07:11 PM`.

## Artifacts

- `session-note-original-generated-name.txt`: the untouched note as STS wrote
  it before captioning.
- `session-note-copy.txt`: the active captioned note, with only its two
  self-references updated.
- `conversation.txt`, `events.txt`, `brain2_mulling.txt`, and
  `recording-stop-report.txt`: final transcript and runtime receipts.
- `session-audio-source.webm` and `session-audio-picture.mp4`: the recorded
  spoken session.
- `spirograph.txt`: the exact final local program written through the tool.

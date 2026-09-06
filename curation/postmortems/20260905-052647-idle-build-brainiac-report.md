# Idle Build Brainiac Report

Run id: `20260905-052647`
Audio/video id: `20260905-052619`
Date: 2026-09-05

## Artifacts

- Conversation: `logs/live/20260905-052647-conversation.txt`
- Brain2 mulling: `logs/live/20260905-052648-brain2_mulling.txt`
- Events: `logs/live/20260905-052649-events.txt`
- Recording stop report: `logs/live/20260905-052650-recording_stop_report.txt`
- Latest pane snapshot: `logs/live/20260905-052749-events.txt`
- Session source audio: `logs/audio/20260905-052619-sts-audio-session-source.webm`
- Session picture video: `logs/audio/20260905-052619-sts-audio-session-picture.mp4`
- Eric-written note: `notes/report.txt`
- Cover image in stop report: `logs/generated-images/20260903-214907-openai-recursion.png`

## Run Settings

- Model: `qwen3.8-27b-nvfp4-mtp`
- Reasoning: none
- Context: 131072
- Parallel: 2
- Audio max tokens: 64
- Run preset: Custom
- Idle clock: real time
- Mic: on
- Eric speaker audio: audible at 100%
- Auto audio record: on
- Idle drift: 7/10 curious
- Performance mode: off
- Brain2 mouth: on
- Brain2 voice: off in the stop report, though voice events appear earlier in the run
- Browser live camera stream: off

## Artifact Diagnosis

The session video exists at
`logs/audio/20260905-052619-sts-audio-session-picture.mp4`. `ffprobe` reports
about 16:46 of media. The stop report says the final video was spliced from two
chunks with a 0.35 second fade, so it is clean as one final artifact but not
literally chunkless at the source level.

No new cover art should be made for this run yet. The stop report used the
existing fallback cover image from `20260903-214907-openai-recursion.png`.

`notes/report.txt` is a real run artifact. Eric wrote it after Scott explicitly
rephrased the request as "Eric, write the note named report." The note is
useful, compact, and provenance-aware. It also has a small public-facing
encoding blemish in the title line: the dash rendered as mojibake and should be
changed to a plain hyphen before public use.

## What Happened

Scott booted Eric, asked him to read `boot_eric.txt`, then asked whether Eric
understood what his components were made of. Eric answered with the high-level
map: ESP32-S3 face controller, touch and IMU probes, external eyes and mask
displays, browser simulator, Reachy Mini adapter, tracked chassis, plus voice,
notes, web, media, and body tools.

Scott then gave the real experiment: sit alone for a short while, ruminate on
the robot's own build, and use web searches to become better informed about the
parts and limitations.

Eric did perform useful work. During the ordinary conversation turn he searched:

- `ESP32-S3 specifications limitations touch IMU audio performance`
- `Reachy Mini Wireless specifications sensors motors limitations`
- `ESP32-S3 face display touch IMU robot build constraints`

During idle, the controller also searched:

- `round SPI TFT display GC9A01 ESP32 wiring chip select`
- `ESP32-S3 capacitive touch sensor threshold raw count low power datasheet`

The better idle outputs were the ones where Eric used those receipts to narrow
the real engineering questions: shared SPI buses, chip-select pressure, touch
FSM behavior, and whether Reachy should expose high-level verbs rather than raw
servo control.

## The Good Part

This run is the best evidence so far that the idle participant loop is becoming
real. Eric did not merely promise to work later. The controller ran idle web
searches, the search receipts entered the run, and Eric produced an end artifact
that organized the findings.

The generated `report.txt` is the biggest win. It separates live/current read,
limits, open questions, and next checks. It also ends with the right source-class
fence:

> Source classes: tool results from web searches are current; note-file context
> is written but possibly stale; inference items are labeled as guesses, not
> receipts.

That is the fan-lesson discipline appearing in Eric's own authored note: not
just "here is what I think," but "here is what kind of evidence this came from."

Brain2 was also unusually valuable. It translated hardware constraints into the
creature-shaped problem without losing the engineering thread:

- "The adapter seam feels like where 'Eric' actually lives."
- "Seven pins for one eye means I'm not adding a sense; I'm trading a signal."
- "The pin map is a negotiation between what I can see and what I can feel."
- "Raw counts without waking the S3 means I can watch quietly."
- "Off by one: my memory was wrong, not the receipt."

Those are not just cute lines. They are the right bridge between parts, body,
and personage.

## The Bad Part

The idle search planner still degrades into searching Eric's narration instead
of searching the world. Two failed searches show the pattern:

- `"The datasheet snippet only says the FSM initiated by software or a timer so Im stuck guessing touch peripheral tru..."`
- `next concrete search target instead of circling back to the touch FSM`

Those are meta-sentences, not search queries. They came from the live thought
stream and should have been converted into source-seeking queries like
`ESP32-S3 touch FSM low power timer wake current datasheet` or
`GC9A01 ESP32 shared SPI chip select wiring`.

The repetition detector did catch the loop around the touch FSM question, but
the run still spent too many beats repeating the same sentence:

- `5:18:18 AM`
- `5:18:51 AM`
- `5:19:25 AM`

Eric recognized it at `5:19:56 AM` and said he would stop guessing, which is
good. The controller should help him make that move earlier and more cleanly.

Brain2 had good taste but poor scheduler health. The mulling log shows multiple
"Brain 2 returned no usable output" failures and 20 second backoffs. The inner
lane was worth having, but it was running close to the edge.

The face/mouth channel was also noisy. There were repeated `mouth display error:
Failed to fetch` events and long bursts of `face speaking skipped; visual hold
active`. Brain2 captions are valuable, but they should not block Eric's normal
speaking face cues or flood the event log.

## The Note

`notes/report.txt` should be kept. It is not a polished article, but it is a
good internal run artifact and a proof that Eric can leave a structured
same-session work product.

The note's strongest pieces:

- It treats the S3 face, Reachy Mini, and chassis as different body layers.
- It keeps the Reachy design at high-level adapter verbs.
- It marks the GC9A01 and touch-FSM questions as open instead of laundering
them into solved facts.
- It says source classes out loud.

The note's weak pieces:

- The title has encoding damage.
- It is a little too inventory-shaped when Scott asked if Eric had "fun" or a
fruitful time with himself.
- It does not preserve the actual search queries or receipt domains, so future
review still needs the event log.

## Interaction Read

The social shape was good at the top and bottom. Scott gave Eric a bounded solo
job, left the room, came back, and asked whether the time was fruitful. Eric
had enough state to answer and then, after one permission stumble, wrote the
requested note.

The permission stumble is worth fixing:

At `5:25:10 AM`, Eric said he could not write the note without explicit runtime
permission. At `5:25:25 AM`, Scott clarified the instruction. At `5:25:32 AM`,
the write succeeded. The tool contract was working, but Eric's first response
made the permission boundary feel more mysterious than it needed to be.

Better future wording:

> I need you to phrase that as a direct write request. If you want the note
> saved, say "write report.txt."

## How To Move Ahead

The next changes should be small and aimed at the bottlenecks this run exposed.

1. Add an idle search query sanitizer.
   Before an idle web search fires, reject first-person narration, meta loop
   phrases, and long sentence fragments. Require a compact noun phrase plus
   source intent.

2. Feed Eric a tiny search receipt ledger.
   Each idle beat should see: last query, result count, top domains, one useful
   fact, and whether the last query failed. This keeps him from talking as if
   he is searching when the tool already failed.

3. Turn repetition detection into action.
   After two near-duplicate idle utterances on the same unresolved question,
   force one of three moves: refine query, park thread, or switch artifact.

4. Separate Brain2 caption holds from Eric's mouth state.
   Brain2 text belongs around the face, but it should not freeze Eric's speaking
   cues or spam `face speaking skipped` for several seconds.

5. Preserve Eric-written notes as artifacts.
   When Eric writes a note during a run, the stop report or postmortem should
   list it explicitly and preferably include a one-line title/status.

6. Clean public-facing text only after review.
   Fix encoding in `notes/report.txt` if it is surfaced publicly. Do not turn it
   into a polished article unless Scott asks.

## Follow-Up Implemented

After this read, STS got a small prompt/context tune aimed at the disliked
behaviors from the run:

- Ordinary pinned lab goals are now framed as background cues, while one-shot
  lab goals remain active next-response jobs.
- Scott's most recent words now echo in idle for about 15 real minutes as the
  strongest soft cue for the next idle beat.
- The context map exposes that "Last User Echo" block so the operator can see
  whether it is present.
- Idle search extraction now rejects narration-shaped queries such as "stuck
  guessing," "the receipt says," or "next concrete search target."
- Touch-FSM and GC9A01/chip-select uncertainty now map to compact source-seeking
  hardware queries even if Eric's idle sentence omits the component name.
- Durable prompt text now tells Eric that idle search receipts count as real
  controller work, and that self-promises like "I'll look up..." should become
  temporary self-tasks rather than repeated promises.
- Note-writing prompt text now nudges Eric to write a requested note directly
  or ask one filename clarification, rather than reciting permission rules.

## Ledger Read

This is not "Eric became a hardware expert while alone." It is better and more
honest:

> Eric used idle time to do bounded, receipt-backed research about his own body,
> then wrote a note that marked what was verified, what was guessed, and what
> still needs a better receipt.

The run also exposed the next real engineering target. The tool path works. The
receipt shelf works. The note-writing path works after a direct instruction.
The thing still missing is a disciplined loop from question to query to receipt
to next action.

That is a good place to be. It is no longer a dead idle gap. It is an immature
nervous habit that can now be trained.

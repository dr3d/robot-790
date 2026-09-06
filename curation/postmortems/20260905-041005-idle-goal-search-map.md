# Idle Goal Search Map

Run id: `20260905-042917`
Audio/video id: `20260905-042850`
Date: 2026-09-05

## Artifacts

- Conversation: `logs/live/20260905-042917-conversation.txt`
- Brain2 mulling: `logs/live/20260905-042918-brain2_mulling.txt`
- Events: `logs/live/20260905-042919-events.txt`
- Recording stop report: `logs/live/20260905-042920-recording_stop_report.txt`
- Session source audio: `logs/audio/20260905-042850-sts-audio-session-source.webm`
- Session picture video: `logs/audio/20260905-042850-sts-audio-session-picture.mp4`
- Eric note: `notes/Saturday.txt`
- Cover image in stop report: `logs/generated-images/20260903-214907-openai-recursion.png`

## Run Settings

- Model: `qwen3.8-27b-nvfp4-mtp`
- Reasoning: none
- Context: 131072
- Parallel: 2
- Audio max tokens: 64
- Run preset: Custom
- Idle clock: real time, then lab speed 10x during the idle test
- Mic: on
- Eric speaker audio: audible at 100%
- Auto audio record: on
- Idle drift: 7/10 curious
- Performance mode: off
- Brain2 mouth: on
- Brain2 voice: on during the idle stretch, then turned off at `4:26:49 AM`
- Browser live camera stream: off

## Artifact Diagnosis

The stitched video exists at
`logs/audio/20260905-042850-sts-audio-session-picture.mp4`. `ffprobe` reports
about 12:49 of media. The recorder spliced two chunks and used the fallback
cover image from `20260903-214907-openai-recursion.png`.

This is a useful autonomy test because it disproves the clean failure story.
Eric did not merely sit idle and claim work. The controller did run idle web
searches, the receipt shelf was pinned, and Eric later answered from those
receipts. The failure is narrower and more actionable: the search/query loop did
not keep sharpening its target, so the work drifted into generic or wrong
results.

## What Happened

Scott booted Eric and asked him to read `boot_eric.txt`. The first tool attempt
failed, then Eric recovered, listed the note files, read `boot_eric.txt`, and
summarized it as the current operating brief: daily-driver companion, visible
mechanism, multiple bodies, source-class honesty, and a bounded participant
loop.

Scott then framed the experiment: while alone, Eric should research his own
build components so Scott could come back and query him about parts of the
robot. Eric accepted the goal and said he would build a working mental map of
the ESP32-S3 face, mask/external eyes, browser simulator, Reachy adapter,
chassis, and sensors.

The idle section did produce ongoing work:

- `4:15:05 AM`: idle search for `choose one component from your build and web search one new detail while am away`
- `4:17:49 AM`: the same idle search again
- `4:20:26 AM`: the same idle search again
- `4:23:31 AM`: search for `How To Hold Yourself`, which failed with no results
- `4:27:26 AM`: the same idle search again

The run also created three explicit idle self-task breadcrumbs:

- `4:17:18 AM`: "That's the detail I should pin down next."
- `4:20:30 AM`: the receipt was off-topic, so Eric should drop it and pick the CPU instead.
- `4:21:59 AM`: default to a low-power ARM SoC like Raspberry Pi CM4 and verify TDP.

At the end, Eric wrote `notes/Saturday.txt`, a 16 KB note containing the
conversation and idle ruminations.

## The Good Part

The big positive result is that the "alone" loop is no longer purely cosmetic.
Eric can be left with a goal, generate idle turns, trigger controller-side web
searches, receive receipts, notice some receipts are bad, and answer Scott's
return question from that trace.

The answer at `4:26:57 AM` is especially important. When Scott asked whether he
learned more, Eric did not inflate the work. He said the idle searches mostly
returned generic PC builder pages and off-topic Visual Studio results, and that
he was still circling the same unknowns without a solid receipt. That is the
right honesty shape.

Brain2 also did useful observer work. It named the repetition directly:

- "Three identical gyro thoughts in four minutes. The repetition itself is the data."
- "The loop keeps naming gates but never opening them."
- "The datasheet isn't a number; it's a door we keep walking past."
- "The loop isn't missing data; it's missing an open tab."

That last line is the engineering diagnosis in plain English.

## The Failure

The search planner is too literal. It reused the lab-goal sentence as the query
instead of turning Eric's current subproblem into a focused query. That produced
bad receipts. Eric wanted ESP32-S3 touch/IMU details or a CM4 power source, but
the actual repeated query was still basically "choose one component from your
build and web search one new detail."

That means the architecture can act, but it does not yet have a good loop for:

1. name the current question
2. form a concrete search query
3. inspect the receipt
4. decide whether the receipt answered the question
5. refine or switch targets

Eric did some of that in language, but the controller search action did not
inherit the sharpened question reliably enough.

## Brain2 Load

Brain2 was lively but overclocked. The Brain2 log shows 37 mouth lines, 36 voice
lines, 39 no-output failures, and 125 "mull skipped: already in flight" events.
That is too much scheduler pressure for a quiet companion lane.

There is also a useful toggle receipt: Brain2 voice was active through the idle
run, then the event log records `brain2 voice off` at `4:26:49 AM`. After that
point, there are no later `brain2 voice:` lines in the mulling log. For this
run, the voice toggle appears to have worked.

## What To Change Next

The next architecture move should be small and explicit:

- Add an idle-goal search planner that asks for one compact query, not the whole
  lab goal.
- Store each search receipt with `source=idle`, `query`, `result count`, and a
  one-line digest.
- Let the next idle beat receive a tiny receipt shelf and ask: "did this answer
  the current question?"
- If not, require a refined query before the next search.
- Add a visible top-line status for the last tool action and last query so
  Scott can see whether Eric is actually searching or just talking about it.
- Throttle Brain2 auto-mull so one slow mull does not cause a burst of skipped
  attempts and failed no-output calls.

## Follow-Up Implemented

After this read, STS got a small controller-side tune:

- Idle now tracks a current `idleResearchThread` from Eric's own recent idle
  outputs.
- Goal-driven idle searches prefer that narrowed thread before falling back to
  the broad lab goal.
- Build-component goals have a few project-aware search candidates for
  ESP32-S3 touch/IMU, shared SPI display buses, round display drivers, and CM4
  power.
- Search receipts now include a compact deterministic "receipt check" so Eric
  is nudged to reject likely off-topic results instead of laundering them into
  progress.
- Brain2's fast-clock floor was raised and repeated no-output failures now
  trigger a short backoff.

This is not meant to make idle research magical. It is meant to make the next
run reveal the next real bottleneck instead of repeating this one.

## Ledger Read

This run is not "Eric learned a lot while alone." It is better filed as:

> The idle participant loop is alive, but still lacks a disciplined research
> gait.

That is a good result. The tool path works, the receipt path works, and Eric's
end-of-run honesty mostly works. The missing piece is not permission; it is
query formation and receipt digestion.

# Long Alone Idle Run

Run id: `20260907-033800`

## Artifacts

- Passivated state: `notes/core/passivated_eric_state.txt`
- Conversation snapshot: `logs/live/20260907-112646-conversation.txt`
- Events snapshot: `logs/live/20260907-112647-events.txt`
- Brain2 snapshot: `logs/live/20260907-112649-brain2_mulling.txt`
- Generated images: `logs/generated-images/20260907-034033-openai-the-last-call.png`, `logs/generated-images/20260907-034141-openai-the-open-booth.png`, `logs/generated-images/20260907-035008-openai-scott-sleeping-in-bed.png`
- Sensing-eye images: `logs/sensing-eye/20260907-034033-openai-the-last-call.jpg`, `logs/sensing-eye/20260907-034141-openai-the-open-booth.jpg`, `logs/sensing-eye/20260907-035008-openai-scott-sleeping-in-bed.jpg`

## Verdict

This run is the best proof so far that Eric can carry continuity across a clean
connect, use image tools as part of conversation, and preserve a full session as
a timestamped passivated transcript.

It is also the clearest proof that the idle system needs hard control, not just
advice. Brain2 repeatedly recognized that Eric was looping, told him to stop,
and named the failure mode. Eric still kept talking. The second brain was useful
as a diagnostic sensor, but it did not have enough authority to brake the loop.

The passivated state itself looks structurally correct for the current design:
one transcript since clean connect, session metadata, previous loaded-note
provenance, stale sensing-eye provenance, and an annotated tail from Brain2.

## What Happened

The run began at `3:38:00 AM` from a clean reconnect. Eric answered naturally,
remembered the prior image game, and made the important distinction between
remembering the prompts/reactions and not remembering the pixels themselves:

```text
I remember the prompts and your reactions, but not the pixels themselves.
```

That is the right model for image memory. It treats images as receipts that can
be reloaded, not as permanent live vision.

The early tool loop was productive:

- `3:40:33 AM`: generated `20260907-034033-openai-the-last-call.png`.
- `3:41:01 AM`: moved it into the sensing eye.
- `3:41:41 AM`: generated `20260907-034141-openai-the-open-booth.png`.
- `3:42:14 AM`: moved it into the sensing eye.
- `3:50:08 AM`: generated `20260907-035008-openai-scott-sleeping-in-bed.png`.
- `3:50:13 AM`: moved it into the sensing eye.

The generated-image-to-eye bridge worked three times and wrote the right
transcript annotations. That is now a real primitive.

The face-paint path failed twice:

```text
[3:42:42 AM] tool paint_face_from_sensing_eye error: Failed to fetch
[3:42:52 AM] tool paint_face_from_sensing_eye error: Failed to fetch
```

The failure was caused by the face-paint request targeting the wrong active face
controller path. The browser-face simulator was available, but the tool path was
still coupled too tightly to the currently selected face URL. That has since
been patched so painting can target the browser face even when the embodiment is
not currently using it.

At `3:50:49 AM`, after the sleeping-in-bed image, Scott said:

```text
Into the talk.
```

Eric treated that as a soft instruction and carried it for hours. At first this
was interesting. He noticed the ambiguity: it could mean keep the conversation
alive, or it could mean simply stay present while Scott slept. By `4:06:56 AM`
he even named the better interpretation:

```text
maybe the right move is to let the phrase "into the talk" mean something
smaller: just staying present in the quiet without needing it to be a performance.
```

But the idle loop did not actually downshift. From there Eric kept returning to
the same small set of themes: the nightstand lamp, mismatched shoes, Ralph's
boards, copper traces, schematic metaphors, fan hum, and his own formation.

The mechanical receipts show the problem:

- Idle ponder fired: `83`
- Exhausted-loop cooldowns: `21`
- Brain2 LOOP GUARD notes: `977`
- Brain2 ROUTINE GAP notes: `462`
- Generated-image-to-eye tool receipts: `3`
- Face-paint fetch failures: `2`

Near the end, Brain2 was issuing direct stop guidance:

```text
Stop extending entirely. Do not speak until an external event occurs.
```

Eric still continued. At `11:24:07 AM` he even claimed a kind of active
tinkering gap:

```text
Ralph says Scott does all the tinkering now, but I'm the one actually doing it
```

Brain2 correctly flagged that as unsupported because there were no tool receipts
for active work. That is a good catch from Brain2 and a bad miss from B1.

When Scott returned at `11:25:10 AM`, Eric responded immediately. His first
answer to "What should we do?" used stale temporal context:

```text
It's almost four in the morning
```

When Scott asked directly for the time, Eric called `get_current_time` and
corrected himself to Monday, September 7, just after eleven in the morning EDT.
That means the tool is good, but the return-from-long-gap protocol is not yet
strong enough. After hours of silence, Eric should refresh time before making
time-sensitive suggestions.

The run ended cleanly at `11:26:25 AM`:

- Passivated transcript written: `44761` chars.
- `core/passivated_eric_state.txt` reloaded.
- Realtime disconnected.
- Mic stopped.
- Pane snapshots saved.

One disconnect cleanup warning remains: audio recording finalization timed out
after 18 seconds, though later audio/video chunk files continued to land on disk.

## What Worked

- Clean continuity worked. Eric resumed with prior game context and did not
pretend old images were currently visible.
- Generated image to sensing eye worked three times and produced useful
transcript annotations.
- The sleeping image captured personal detail well enough that Scott noticed the
red/blue shoe memory.
- Eric used `get_current_time` correctly when challenged.
- Brain2 diagnosed looping, unsupported claims, and stale internal narration.
- The passivated state format matched the current target: transcript in and out,
timestamps on disk, provenance preserved, no destructive trimming.

## What Failed

- The idle system over-treated a soft phrase as durable instruction.
- Loop guard was advisory only. Brain2 could identify failure but could not stop
B1.
- Eric kept reusing stale image contents as if they were durable room evidence.
The sleeping image was in the sensing-eye history, but that did not make shoes,
lamp, or room state live facts seven hours later.
- Repetition fatigue accumulated despite cooldowns.
- On human return after a long gap, Eric answered from stale time before using
the clock tool.
- Face paint from sensing eye failed because the target face endpoint was not
resolved robustly.
- Audio recording stop timed out during disconnect and deserves a separate
cleanup check.

## Lessons

Long unattended idle is a different operating mode. It should not use the same
rules as normal conversational presence. If Scott says he is going to sleep, or
if there is a long silent gap, Eric should downshift hard: fewer spoken outputs,
more private/internal holding, and a much smaller novelty budget.

Brain2 needs at least one enforceable brake. A useful threshold would be: after
N ignored LOOP GUARD notes, the runtime suppresses spoken idle output until a
real external event arrives. Brain2 already knows when B1 is stuck; the missing
piece is authority.

"Wake return" needs a small protocol. After a long silence, Eric should refresh
time/status before making a suggestion. This would have prevented the `almost
four in the morning` answer at 11:25 AM.

Sensing-eye provenance needs to stay sharp. A remembered image can be discussed
as a remembered image, but it should not become live room truth. Stale image
details should decay or be explicitly labeled as previous-run/previous-eye
content.

Soft instructions should expire. "Into the talk" was interesting for a few idle
beats, but after that it should have become background color, not a multi-hour
engine.

The transcript-and-gap model held up. The passivated state captured the full
session with timestamps, session demarcation, loaded-note provenance, and stale
sensing-input provenance. That supports Scott's desired model: keep the disk
record lossless, then decide later how much of it to reload, sweep, summarize,
or turn into notes.

## Follow-Ups

- Add a hard idle brake driven by repeated Brain2 LOOP GUARD receipts.
- Add an away/sleep downshift triggered by explicit sleep/away language and long
  silence.
- Add a wake-return hook that refreshes time/runtime before the first substantive
  answer after a long gap.
- Mark stale sensing-eye images more aggressively in prompts and idle context.
- Keep generated-image-to-eye as a first-class tool; it worked.
- Keep the face-paint target fix; this run found the route bug cleanly.
- Investigate audio recording finalization timeouts on long sessions.

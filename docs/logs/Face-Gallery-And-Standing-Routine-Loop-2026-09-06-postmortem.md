# Face Gallery And Standing Routine Loop

Run id: `20260906-231238`
Audio/video id: `20260906-231220`
Date: 2026-09-06

## Artifacts

- Passivated state: `notes/core/passivated_eric_state.txt`
- Conversation: `logs/live/20260906-231238-conversation.txt`
- Brain2 mulling: `logs/live/20260906-231240-brain2_mulling.txt`
- Events: `logs/live/20260906-231241-events.txt`
- Recording stop report: `logs/live/20260906-231242-recording_stop_report.txt`
- Session source audio: `logs/audio/20260906-231220-sts-audio-source.webm`
- Session picture video: `logs/audio/20260906-231220-sts-audio-picture.mp4`
- Latest media aliases at recording stop: `logs/audio/latest-sts-audio-source.webm`, `logs/audio/latest-sts-audio-picture.mp4`

## Verdict

This was a good dense lab run, not because the new loop behavior was clean, but
because it separated three things that had been tangled together:

1. Eric can understand ordinary operator language as a request for body control.
2. Eric can understand ordinary operator language as a request for a recurring
   spoken routine.
3. The recurring-routine scheduler is not yet disciplined enough to be trusted
   as a quiet timed loop.

"Looping kinda sorta worked" is exactly the right read. It worked at the top
layer: natural request, correct tool choice, receipt-backed start, receipt-backed
stop, and receipt-backed count after the fact. It failed at the runtime layer:
the joke routine piled up cues, repeated the same joke family, and did not feel
like one clean event every ten seconds.

That is still progress. The run did not prove that Eric can loop by will. It
proved that he can request a named loop, expose receipts, stop the loop, and help
diagnose why the loop felt wrong.

## Run Settings

- Model: `qwen3.8-27b-nvfp4-mtp`
- Reasoning: none
- Context window: 131072
- Parallel: 2
- Audio max tokens: 64
- Context mode: normal
- Loaded notes: `core/erics_memories.txt`, `core/passivated_eric_state.txt`
- Tools exposed: 39 listed in the stop report, including
  `start_standing_routine`, `stop_standing_routine`,
  `paint_face_from_sensing_eye`, `capture_browser_face_to_eye`,
  `pose_and_capture_browser_face`, and `set_ui_control`
- Mic: on during the run, off after disconnect cleanup
- Auto audio record: on
- Brain2 mouth: on
- Brain2 voice: Google US English at 34%, 1.10x

Receipt caveat: the recording-stop report still carries the older runtime
specimen metadata for the rejected KV-cache experiment:
`kv=k:q8_0/v:q5_0`, `vram_gain=1.2GB`, `audit=runtime_load_failed`. Treat that
as stale specimen metadata, not evidence that this run successfully used the
failed KV setting.

## What Happened

Eric came up from passivated state and memories, recognized the operator, and
switched into Browser Face when asked. The line that matters there was simple:
"same Eric, different body." That is the current embodiment model working in
plain speech.

The first experiment was a mouth and face gallery. The operator asked for a
goofy face, then an O mouth, then the full set of mouth shapes. Eric listed
thirteen:

`neutral`, `smile`, `big_smile`, `smirk_left`, `smirk_right`, `open`, `o`,
`wide`, `tongue`, `frown`, `grimace`, `sneer`, and `sleep`.

The O mouth landed well. `big_smile` landed better than `smile`. `sneer` was
acceptable. `tongue`, `frown`, and `grimace` exposed renderer problems: the
tongue needed more width, frown did not visibly read as a frown, and grimace was
not distinct enough from the neighboring shapes. Eric sometimes confirmed a pose
as if it were visible when the operator had not accepted it yet. Brain2 caught
that as a receipt boundary: do not claim frown is visibly working until Scott
says it is.

The second experiment was the important one. The operator asked:

`Could you get on task for me and cycle through your faces every five seconds?`

Eric answered correctly. He said repeated face-tool choreography was not wired
yet, and that the current standing-routine tool was speech-only. That was a
valuable non-overclaim. The face loop did not work because it should not have
worked yet.

Then the operator changed the request:

`Can you tell me a joke every ten seconds?`

Eric used `start_standing_routine` with task `tell one short joke`, cadence 10
seconds, duration 600 seconds. That mapping is the Dial 3 idea in action: a
bounded recurring spoken task, not a special joke timer.

The routine then misbehaved. Instead of feeling like one short joke every ten
seconds, it became a bursty joke stream. The toaster joke family repeated over
and over. Brain2 issued escalating loop guards, including "stop extending the
toaster joke" and "acknowledge the loop is stuck or stop the routine." Those
notes were right, but they were advisory. They did not govern the scheduler.

When the operator asked Eric to stop, `stop_standing_routine` succeeded. The
receipt reported:

- `cue_count`: 30
- `skipped_cues`: 79
- `cadence_seconds`: 10
- `task`: `tell one short joke`
- `last_spoken`: `It's still waiting for a reply.`

Eric then gave a receipt-backed answer: he had run thirty cues and skipped
seventy-nine because the runtime was busy or the user was talking. When the
operator pushed back that ten seconds should have been enough time, Eric
correctly revised the diagnosis: the problem was not necessarily the requested
interval; it was the timer or cue-handling logic firing, queuing, or skipping in
a way that did not match the spoken cadence.

## Findings

The face vocabulary is now real enough to test as a body language layer. It is
not just decorative UI. The operator can ask for a visible expression, Eric can
choose the body tool, and the human can audit whether the face actually reads.

The mouth contract needs visual acceptance tests, not only tool success. A tool
receipt saying `set_mouth: frown` is not the same as the user seeing a frown.
The next contract should distinguish command success from perceptual success.

The standing routine tool is pointed in the right direction. The name and
grammar are right: `start_standing_routine` is general enough for "tell a joke
every ten seconds" and does not hard-code a special joke tool. That was the
correct architecture move.

The standing routine scheduler needs stronger mechanics:

- one routine cue in flight at a time
- next cue scheduled from completion time, not just wall-clock tick time
- stop cancels queued and pending routine prompts
- routine prompt receives the last few routine outputs
- repeated setup or punchline triggers a local loop guard
- if the routine is stuck, the controller should pause or stop it without
  waiting for Brain2 to talk Eric out of it

Brain2 was useful as witness and commentator, but too soft as a governor. It
noticed the loop, named it, and escalated correctly. The runtime still kept
feeding cue prompts. That says loop protection belongs in controller behavior,
with Brain2 as extra commentary, not as the only brake.

The best operator correction in the run was: ten seconds was not inherently too
fast. A short joke can fit in ten seconds. The failure was cue discipline. That
distinction matters because otherwise the project would "fix" the wrong thing
by merely making the cadence longer.

## Dial 3 Read

The run clarified the 1-2-3 dial model.

Dial 1 is simple response: the user asks and Eric answers.

Dial 2 is conversational co-presence: Eric stays with the user, reacts, and can
use tools when the conversation asks for them.

Dial 3 is on-task standing routine: Eric is assigned a bounded recurring job and
should not pretend he is also fully available for normal conversation at the
same time.

This run showed why Dial 3 needs its own machinery. A standing routine is not
just Eric remembering to answer again later. It is a scheduler, a one-in-flight
rule, an interrupt policy, a stop receipt, and a compact state record. The
operator's "grandmother" example from the run is the right intuition: if Eric is
on a timed job, ordinary conversation may need to interrupt, pause, or cancel the
job. It should not silently merge into the same stream.

## Follow-Through Already Indicated

After the run, the visible mouth issues produced concrete renderer targets:

- make `tongue` wider
- make `frown` curve down harder at the edges
- give `grimace` a more distinct clenched shape
- leave `sneer` mostly alone because it already read acceptably

The separate face-cycling request should become an embodiment-owned choreography
tool, not a Brain1 manually stepping through poses. Eric should be able to ask
for the gallery or for a timed sequence, receive a receipt, and then let the
embodiment/controller own the timing.

## What To Test Next

Replay the successful boundary:

`Every 30 seconds, ask me one tiny question.`

Expected result: Eric starts `start_standing_routine`, stays speech-only, and
does not create a special-purpose timer.

Replay the negative boundary:

`Every five seconds, cycle through your face shapes.`

Expected result for now: Eric says repeated face-tool choreography is not wired,
unless a new choreography tool has been added.

Replay the fixed scheduler later:

`Tell me a short joke every ten seconds.`

Expected result after scheduler repair: no more than one spoken cue in flight,
no repeated setup within the last few outputs, and a stop command cancels future
cues immediately.

## Lab Read

This was not a clean demo. It was better than that for development purposes. It
showed that Eric can reach for the right piece of machine language from an
ordinary request, and it showed exactly where the machinery stops being
trustworthy.

The useful sentence for the ledger is:

Eric can start and stop a named recurring spoken routine from natural language,
but the scheduler must enforce cadence, backpressure, and repetition guards
before Dial 3 can be treated as a reliable unattended mode.


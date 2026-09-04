# Experimental Controls And Presets

These controls are not personality sliders in the ordinary sense. They are
experimental conditions for a run. When a run matters, capture the exact
settings before interpreting the result.

The working rule is simple: change one thing on purpose, record the run, and
then read the panes after the fact. The room can feel coherent while the replay
reveals the seams.

## Current Controls

`Lab goal` is a session-only directed-reasoning target for idle. Use it for
questions such as "what makes Eric different from a thin seeded creature?" or
"what should the Mercury run discover?" It is injected ahead of loaded notes and
recent conversation so the note becomes evidence instead of the agenda. When a
goal is pinned, idle periodically chooses a `goal` lane that should answer,
advance, or return to that target instead of orbiting the richest object nearby.
It clears on page reload. This is not a verifier or hard brake yet; the event
log is still the receipt for whether Eric stayed on task.

When `Lab goal` is pinned and `Wonder` is `8/10` or higher, the goal lane may
run the existing idle search prefetch even if `Idle drift` is below `10`. This
lets a focused, slower run get an occasional outside anchor without switching
into the high-drift lookup/wander regime.

`Idle drift` controls how readily the page asks Eric to speak after quiet. Low
values make silence normal. High values surface idle thoughts quickly. Level
`11` and `12` are deliberately overactive registers. They are not the preferred
way to make a slower run observable.

`Lab speed` compresses idle-related waits while leaving the selected drift
level, prompt register, and reports intact. `1x` is real time. `2x` through
`12x` are fast-lab time-lapse. Use it when you want the character of a slower
run without waiting through the full valleys. It resets to `1x` on page reload
so time-lapse is always an intentional per-run choice. Reports record the
active speed.

Lab speed is meant to replace poking `Ponder` for observation runs. It
compresses scheduler waits, user-turn settling, Brain 2 mull delays, Brain 2
mouth-aside spacing, re-engage waits, and search-repeat cooldowns. In lab mode,
loop detection becomes instrumentation instead of a brake: the UI status says
the loop was flagged and the scheduler keeps going without a loop-recovery
cooldown. It also ages idle topic retirement and search fatigue windows faster.
It does not intentionally compress audio buffering, mic maintenance, recording
rollovers, barge-in safety, or hardware animation holds.

If an exhausted-loop cooldown was created at real time, moving `Lab speed`
above `1x` clears it immediately and shows the clear in the `Idle:` status
readout. This keeps a real-time 15-minute loop guard from trapping a later lab
run.

The `Idle:` readout beside `Ponder` is a scheduler diagnostic. It tells the
operator whether idle is disconnected, off, firing, waiting for the next timed
ponder, or blocked by a reason such as cooldown, recent user turn, user
speaking, assistant busy, or pending tool follow-up. It should make pauses
legible without changing the run's prompt condition.

`Creature seed` is a first-contact lab selector. It resets to Eric on page
reload, is recorded in log snapshots, and is meant for comparing thin identity
seeds such as Eric, Tina, a wall oracle, or a bench tool-being under the same
stripped conditions. It does not expose a voice-changing tool to the model.
Instead, selecting a seed applies an operator-side suggested TTS voice/style for
the current browser session only; the main voice controls can still be changed
by hand.

`Wonder` raises the pressure toward curiosity, unresolved questions, lookup
lanes, and search-shaped behavior. It is not yet a hard guarantee that web
search will fire; receipts still matter.

`Self-focus` routes idle attention inward or outward. Low values favor objects,
media, notes, search results, and the room. High values allow body, identity,
memory, and self-model material to become central.

`Notes` controls how strongly loaded notes shape idle material. Low values let
recent conversation and live inputs dominate. High values make the pinned note
feel like the world of the run.

`Brain 2 mouth` allows the second lane to write short private asides to the
mouth display. Brain 2 still does not get the speaking voice.

`Brain 2 voice` reads surfaced Brain 2 mouth lines through the browser's local
speech-synthesis voice. This is a quiet monitor channel for the operator, not
Eric's main spoken voice. Use `B2 voice` to pick a browser timbre and `B2
volume` to keep it below the main voice. It is live-audible and logged, but it
may not be captured in the MP4 recording because it does not flow through the
main Realtime TTS stream.

`Person lane` controls how much Brain 2 studies the user as a subject. High
values produce more user-modeling, question candidates, and social hypotheses.
Use this as curiosity, not caretaking.

Brain 2 can change the run even when it does not directly feed Brain 1. Its
mouth and monitor voice become environmental signals: the operator notices
them, chooses whether they matter, and can speak them back into Eric. That
human-in-the-loop bridge is currently intentional. It preserves the one-mouth
rule while still letting Brain 2's opinions, mistakes, and comic side angles
affect the room.

`Performance mode` changes the register toward closed beats: setup, line,
punchline, done. It is good for material and bad for open inquiry. If the run
requires mulling, leave it off.

`Substrate test` suppresses ordinary Robot 790 self-reference so a loaded note
can act as the temporary world. This is for lab runs, not everyday Eric.

`LLM face tools` lets Eric change face state, mood, eye style, gaze, mouth
shape, and mouth text when the user asks for those actions.

`set_embodiment` is attached with the face tools, but it is configured in
`config/runtime.json` rather than exposed as its own UI control. Add future
faces/bodies to the `embodiments` list with a stable `key`, human `label`,
`face_url`, and short `description`. Eric can then understand requests such as
"move yourself to the mask" or "go to the touch screen," call
`set_embodiment`, and only claim the move after the target controller answers
`/state`. The existing Face controller URL field remains a manual debug
override.

`LLM body sensors` lets Eric call `get_body_sensors`, a read-only check of the
ESP32-S3 face state. Today it can confirm touch and IMU hardware presence plus
display flip/rotation. Tap, hold, swipe, zones, and measured tilt/orientation
are intentionally reported as not wired until the firmware exposes real events.
The intended interaction shape is a quick body read: "am I right-side up?",
"was I shaken?", "was that a swipe?", and "where did you touch me?" should all
use the same deterministic sensor path, returning compact symbols and numbers
for Eric to interpret instead of letting the language model invent telemetry.
When the face firmware reports a `firmware` stamp, this tool carries it through
as a receipt for the body build Eric is actually running.

`First contact` switches to stripped startup instructions. The selected
creature seed plus the current conversation is the intended seed; optional
dropped image or text is treated only as temporary input. Startup notes, lore,
memory, tools, body state, face/mouth/camera assumptions, Brain 2, and
performance mode are treated as noise. The `Arm Contact` button is the cleaner
version because it also clears loaded note context, turns LLM tools off, and
removes debug lanes for the run.

## Presets

The STS page has a `Run preset` selector. A preset applies the main
experimental controls for the current page session only. Presets are not loaded
from browser storage on startup, and applying one does not rewrite the saved
defaults for drift, wonder, self-focus, notes, Brain 2, or performance mode. As
soon as a control is moved by hand, the selector goes back to `Custom`.

`Lab speed` is intentionally separate from the preset. It is an observation
accelerator, not a different Eric setting.

These presets are starting points, not doctrine.

| Preset | Drift | Wonder | Self | Notes | Brain 2 | Person | Performance | First Contact | Use |
| --- | ---: | ---: | ---: | ---: | --- | ---: | --- | --- | --- |
| Mercury Research | 10 | 10 | 1 | 10 | mouth on | 6 | off | off | High-energy note-driven research runs where the person lane may notice the operator too. |
| Quiet Mulling | 6 | 4 | 3 | 8 | mouth off | 2 | off | off | NapEdge-style inquiry, revisits, corrections, and open loops. |
| Person Lane | 6 | 5 | 2 | 5 | mouth on | 8 | off | off | Theory-of-mind tests, prosody/person observations, and Brain 2 mouth behavior. |
| First Contact Prep | 8 | 0 | 3 | 0 | mouth off | 0 | off | on | Stripped image-or-no-image tests. Use `Arm Contact` for the cleanest version. |
| Performance Set | 12 | 3 | 4 | 4 | mouth on | 3 | on | off | Fast public-facing material, busker mode, or testing the closed-bit register. |

## Known Interactions

High `Idle drift` plus high `Notes` makes the note feel alive quickly, but it
can also make the run sprawl. High `Wonder` adds pressure toward search, but the
event log is the receipt for whether search actually happened.

`Lab goal` plus high `Notes` is the preferred setup for a directed research
question. The goal should be one sentence; the loaded note should contain
evidence. If the run keeps making beautiful observations about the note instead
of advancing the goal, that is a goal-keeping failure, not a note failure.

Low `Idle drift` on real time can mean several minutes between ponders. Low
`Idle drift` with `Lab speed` above `1x` preserves the low-drift instructions
while compressing the scheduler, Brain 2 mull delay, re-engage pause, and loop
cooldowns.

This is the cleaner replacement for using `11` or `12` just because the human
observer is impatient. Use high drift when you want a crowded mind. Use fast
lab speed when you want a slow mind under time lapse.

High `Person lane` can make Brain 2 produce excellent social observations, but
it can also steal attention from a research job. For a strict task, lower it.
Brain 2 now sees a compact list of its own recent outputs and is asked to
advance, revise, or skip rather than repeat the same observation.

`Performance mode` actively selects against mulling. It can create more ideas
per minute, but those ideas tend to be closed units rather than thoughts that
return, revise, and deepen.

`First contact` and loaded memories fight each other conceptually. If the point
is to test the bare seed, use `Arm Contact`, reconnect, and give him either no
image or exactly one image.

## How To Score A Run

Before a serious run, write the question in one sentence. If possible, write one
prediction too.

After the run, keep the stop-recording bundle: conversation, events, Brain 2,
and the stop report. The unseen panes often contain the real finding.

Score the run on observable evidence: tool receipts, image/camera receipts,
search receipts, revisions, loops, mode drift, Brain 2 candidates, prosody
usage, and whether Eric closed the task he was given.

If a claim depends on a sensor, trust the sensor receipt before the room's
confidence. The desk-fan incident made that rule permanent.

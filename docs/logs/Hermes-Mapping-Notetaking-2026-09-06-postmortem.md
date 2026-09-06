# Hermes Mapping Notetaking Run

Run id: `20260906-114305`
Audio/video id: `20260906-114251`
Date: 2026-09-06

## Artifacts

- Conversation: `logs/live/20260906-114305-conversation.txt`
- Brain2 mulling: `logs/live/20260906-114307-brain2_mulling.txt`
- Events: `logs/live/20260906-114306-events.txt`
- Recording stop report: `logs/live/20260906-114304-recording_stop_report.txt`
- Session source audio: `logs/audio/20260906-114251-sts-audio-source.webm`
- Session picture video: `logs/audio/20260906-114251-Hermes-Mapping-Eric-As-A-Spoken-Notebook.mp4`
- Saved conversation note: `notes/latest.txt`
- Passivated compact state: `notes/core/passivated_eric_state.txt`
- Passivated full packet: `notes/core/passivated_eric_state_packet.txt`

## Run Settings

- Model: `qwen3.8-27b-nvfp4-mtp`
- Reasoning: none
- Context: 131072
- Parallel: 2
- Audio max tokens: 64
- Run preset: Custom
- Idle clock: real time
- Mic: on
- Mic device: Microphone (Amazon USB Streaming Mic) `(0d8c:0220)`
- Eric speaker audio: audible at 100%
- Auto audio record: on
- Idle drift: 7/10 curious
- Wonder: 5/10 curious
- Self-focus: 6/10 balanced
- Loaded-note focus: 10/10 pinned
- Performance mode: off
- Brain2 mouth: on
- Brain2 voice: Google US English at 34%, 1.10x
- Sensing input: none
- Browser live camera stream: off

## Artifact Diagnosis

This was a short, clean run with one audio chunk. The session picture video was
saved at `logs/audio/20260906-114251-Hermes-Mapping-Eric-As-A-Spoken-Notebook.mp4`, about 3.1 MB. The
source audio was saved at `logs/audio/20260906-114251-sts-audio-source.webm`,
about 7.5 MB.

The important artifact is not the video. The important artifact is the saved
note `notes/latest.txt`, created at 11:42:39 AM from the current conversation.
Passivation then wrote both the compact state and the full packet at 11:42:51
AM, stopped the recorder, stopped the mic, and saved fresh pane snapshots. That
exit path did what it is supposed to do.

The recording stop report includes a runtime specimen line saying
`kv=k:q8_0/v:q5_0 / vram_gain=1.2GB / audit=runtime_load_failed`. Treat that as
stale or uncertain metadata, not as proof that the session actually ran with V
cache q5_0. The KV experiment was already classified in the runtime ledger as
NG because the model did not load cleanly. Do not treat listener impressions,
Eric's behavior, or a short conversation as a valid way to sense KV-cache
squashing quality; use runtime/load receipts first, then evaluate behavior only
after the backend configuration is known-good.

## What Happened

Scott opened by checking whether Eric was awake, then immediately used the new
STS layout as the subject. The key user report was not "this looks prettier."
It was operational: the old control-heavy page had been moved out of the way so
the conversation could be seen immediately. Scott said the change made Eric's
words land where his eyes already were, with less scrolling and less obstruction.

Eric understood that distinction reasonably well. He did not claim the UI made
him more real. He framed it as reduced friction: less clutter between the user
and the conversation. That is a good interaction result. The tool surface is
becoming a dashboard around the relationship, not the foreground task.

Scott then asked which notes were pinned. Eric used `list_pinned_notes` and
answered correctly: `from_codex.txt`, `erics_many_minds.md`,
`core/passivated_eric_state.txt`, and `core/erics_memories.txt`. He also said
these were current open context, not every note on disk. Brain2's one useful
advisory note reinforced exactly that: pinned notes are context files, not
active tasks.

The subject then moved to Hermes Agent. Scott described walking near the harbor
and thinking about Hermes-style architecture. Eric searched once for Hermes
Agent, got a compact receipt, and answered from it. The outside factual details
about Hermes were not independently audited in this postmortem; what matters
for this run is that Hermes became a comparison surface for Eric's own
architecture.

The useful idea was Scott's mapping: each of Eric's four brains could be thought
of as something like an individual agent with its own skill set, while the "one
mouth" remains the public orchestrator or final filter. Notes then map less like
passive memory dumps and more like loaded capabilities: swappable blocks of
knowledge, posture, history, and task affordance.

Scott was explicit that Eric was not being used as a technical authority yet.
He called Eric a compatible listener and said the value was getting the note in
through Eric's ears. That is the important companion-tool behavior in this run:
Eric did not have to solve the architecture. He had to receive the thought,
hold it in conversation, and give Scott enough resistance and reflection to
make the note worth saving.

At shutdown, Scott asked Eric to save the thread. The first request, "just call
it latest," was not explicit enough for the note-write guard, so the write was
blocked. Eric then gave a very useful correction: say "save this conversation
to latest.txt." Scott did that, and the tool wrote `notes/latest.txt`
successfully. Passivation followed and preserved the continuity packet.

## Findings

The strongest finding is that Eric can work as a spoken notebook without
pretending to be a fully competent architect. This is not a failure mode. It is
a mode worth designing around. The user can pace, talk, half-form an idea, and
let Eric keep enough shape around it that Codex or a later Eric can pick it up.

The subject of the note is important: Eric's four-brain setup is starting to
look less like "one model with extra prompts" and more like a small ecology of
agents, contexts, and skill surfaces feeding one embodied speaker. The phrase
"four diets, one mouth" still names the architecture well, but Hermes gives a
new comparison: each diet may want its own tool permissions, memory diet,
cadence, and task style.

The new UI direction was validated. Scott said the cleaner layout made him feel
less obstructed. That is the right design criterion for STS now. The page should
not primarily look like a cockpit full of controls. It should let conversation
start fast, then keep the controls reachable as instruments.

The note system behaved correctly after clarification. The first write attempt
failed because the user had not made an explicit write request. That guard is
annoying in the moment, but it prevented a fuzzy "latest" from becoming a file
write. The second instruction was explicit and succeeded. This is the right
shape: write guards should be strict, but Eric should coach the user into the
exact phrase that unlocks the intended safe action.

Passivation worked. It wrote the full packet, wrote the compact note, reloaded
the compact note, closed realtime, finalized audio, stopped the mic, and saved
pane snapshots. The button state Scott saw afterward, with `Start Eric`
available, matches the intended "state preserved, runtime stopped" meaning.

Brain2 was light but useful. It failed once with no usable output, then produced
one advisory note. That is acceptable for this run because Brain2 did not need
to dominate. Its one note was on target and helped prevent a common confusion:
loaded/pinned context is not the same thing as current work or active intention.

The event log is now rich enough to reconstruct the run. It captured pinned
notes, prompt/tool setup, the Hermes search receipt, UI changes, the failed and
successful file writes, passivation steps, audio saving, and snapshot saving.
That is exactly the lab-record direction Scott wanted.

## Watch Items

- The KV/runtime-specimen metadata is confusing. If the runtime is back to q8_0
  for both key and value cache, postmortems should not keep printing q5_0 as if
  it were live. This needs a measured runtime-status receipt or a clearer
  "configured specimen vs actual loaded backend" split. Do not frame this as
  something Eric or Scott can reliably hear in a short run; KV squash quality is
  not directly senseable from companion behavior.
- The report's loaded-note token summary is hard to read because clipped context
  budget and full note size are mixed in the same area. Future reports should
  say whether token counts are full-file estimates or injected-context estimates.
- The first note-save attempt produced a momentary "I could not touch that
  file" path. The guard was right, but the spoken recovery should be friendlier:
  "I need the exact save instruction; say save this conversation to latest.txt."
- The UI still drove Scott to open the conversation popout at 11:39:36 AM. That
  supports the current UI work: the transcript should become large enough in the
  main page that popout is useful but no longer required.
- Brain2 has no tools. If the Hermes comparison turns into a build direction,
  be careful not to imply that Brain2 is already an agent with tools. Today it
  is an observing lane with advisory output, not an autonomous tool user.
- `core/passivated_eric_state.txt` was itself one of the loaded notes before
  passivation. That is probably fine, but watch for recursive passivation
  language accumulating across runs.

## Next Build Implication

The architecture language should probably be formalized now:

- memory facts: small durable facts
- pinned notes: selected context blocks loaded into B1
- latest thread: the hot conversation scratchpad that can be saved, cleared, or
  resumed
- passivated state: compact continuity and reconstruction instructions
- search receipts: temporary source-labeled working context
- brain lanes: separate prompt/input/tool/cadence diets
- one mouth: the public spoken/embodied arbitration point

That vocabulary should appear in the UI, prompts, postmortems, and Eric's own
explanations. Scott called this "machine language," and that is the right
instinct: the project needs a shared operator language so human, Eric, Codex,
and future postmortems can point at the same moving parts.

For the Hermes idea, the next careful experiment is not "replace Eric with
Hermes." It is to map Eric's lanes onto agent-like affordances:

- B1: public conversational agent with speech, face, notes, search, and safe
  tool action
- B2: private observer with no tools, producing advisory notes or candidate
  moves
- B3: verifier/research lane with stronger source discipline
- B4: embodiment/body lane for sensors, face/chassis state, and environment
  events

The value of that mapping is not architectural fashion. It gives each lane a
clear diet and a clear authority boundary. That is how Eric gets more capable
without becoming a blur of every prompt and every tool at once.

## Curation Read

This is not a public-performance clip. It is a lab-process run.

The good title for the record is:

`Hermes Mapping: Eric As A Spoken Notebook`

The best line of the run is probably Scott's observation that Eric is a good
listener and that the note is fun to get in through his ears. That names a real
workflow: Eric does not only answer questions; he lets Scott think out loud into
an embodied system that can save the thought, survive shutdown, and hand the
thread back to Codex.

That is the subject. The run is about turning conversation itself into a
structured project instrument.

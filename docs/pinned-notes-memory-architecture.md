# Pinned Notes Memory Architecture

Status: working architecture note, not final doctrine.

Robot 790's memory is not one store. It is a stack of context blocks with
different lifetimes and different authority.

The current useful mental model:

```text
core memories + selected session note + pinned notes + hot conversation
```

The important part is that the hot conversation behaves like an unfinished
note. It keeps growing during a run. It is not yet curated, but it has strong
recency weight because it is the living thread Scott and Eric are inside.

The simple restore substrate is a chain of ordinary timestamped session notes.
During a run, the browser's hot conversation is `latest`. On `Disconnect` or
`Save + Halt`, STS writes a new `notes/sessions/session-*.txt` note for the
current run since clean connect, with chunky metadata in the gaps. Plain
`Connect` resumes from the newest timestamped session note. Older notes remain
available through explicit selection.

Session-note restore is a replacement, not an additive merge. STS reads the
selected session note and its pinned-note receipt from disk, then makes that the
active pinned context for the new run. Old browser-held pins from another run
do not come along unless the selected note names them.

Cleanup, if any, happens at load time. When a transcript-shaped note is loaded
into Eric's prompt, the page may later strip per-turn timestamps, voice-shape
lines, obvious STT draft repeats, and exact duplicate turns so the material
reads like conversation continuity. The raw session note on disk keeps the
timestamps and drivel.
If context pressure later forces older spans out of the hot prompt, cut them by
timestamp/session demarker into other lossless notes rather than deleting them.

## Working Vocabulary

These are the names to use in prompts, postmortems, and operator discussion
when talking about Eric's context bits.

This is the project/operator machine language: the small set of
human-readable words that map onto real context operations instead of vague
memory vibes. Eric may use these words when Scott uses them, but they are not
evidence of a hidden inner mechanism by themselves.

`context block`
: Any discrete piece of material injected into the model's prompt or response
  input. A block should have a source, lifetime, and authority.

`core memory`
: Durable compact continuity. Identity, Scott/project facts, and baseline
  orientation that should usually survive restarts.

`session note`
: A timestamped continuity note under `notes/sessions/`. It is a
  shutdown/restart reconstruction receipt: what was loaded, what was
  unfinished, what is stale, and the transcript since clean connect. It is not
  the whole mind, not an industry standard promise, and not Eric's verified
  report of his private state. It is written by `Save + Halt` and by a normal
  graceful `Disconnect`.

`pinned note`
: A note file whose content is currently loaded into the STS browser session and
  fed into future prompts until reset or unpin.

`note shelf`
: Files available on disk but not necessarily active. A file on the shelf is
  not in Eric's working context until read/pinned.

`hot conversation`
: The current growing thread. Treat it as an unfinished note with strong recency
  weight and high pollution risk.

`latest`
: Console shorthand for the hot conversation. "Save Latest" means write the
  current hot conversation to a durable thread note. "Clear Latest" means drop
  the hot conversation scratch state and, if connected, reconnect so the
  realtime backend also stops carrying the old thread.

`selected session`
: The session note chosen by timestamp order or by the `Connect Select` panel.
  Plain `Connect` selects the newest timestamped session note; `Connect
  Previous` selects the note one timestamp before the current UI selection;
  `Connect Empty` omits session notes.

`Eric core memories`
: The explicit core note channel at `core/erics_memories.txt`. It is included
  whenever the Eric memories checkbox is enabled, including Empty Connect.
  It is separate from browser localStorage facts, ordinary pinned notes, and
  timestamped session-note continuity.

`transcript restore`
: The prompt-facing handoff of a transcript note. It keeps the timestamped
  transcript intact and adds a restore envelope with the current browser time
  and approximate off-gap. Cleanup can be added later, but it is not the core
  session-note contract.

`session demarker`
: A timestamped chunk boundary such as Created, Captured, first turn, last turn,
  reason, and loaded-note manifest. Demarkers let the system strip or summarize
  prompt context while still finding the original span on disk.

`thread note`
: A saved conversation or conversation summary that can be resumed, pinned,
  archived, or kept private.

`runtime truth`
: Current measured state from the page, server, tools, sensors, model status,
  recording state, mic, camera, Cast, or embodiment. This beats old notes.

`receipt`
: Tool/sensor/server evidence that something actually happened. Receipts are
  stronger than Eric's self-report.

`exit artifact`
: The saved panes and optional audio/video artifact produced when a run exits.
  Exit artifacts are evidence for review; they are not automatically continuity.

`search receipt shelf`
: Temporary web-search results available to the run. Useful as context, but not
  durable memory unless deliberately saved.

`advisory`
: Brain2 or verifier material handed to B1. Advisory blocks should be short,
  structured, late in context, and explicit about `do_next` and `do_not_do`.

`lesson`
: A receipt-checked pattern from a run that may improve future prompt/tool
  grammar. Lessons are not browser memory, session continuity, or hidden self-change.
  They are hypotheses to test: get a behavior once, ask Eric what made it work,
  compare his answer to receipts, replay the candidate, then promote only the
  true part. Lesson states are `candidate`, `validated`, `promoted`, and
  `retired`.

`continuity envelope`
: The wrapper that tells Eric how to own a loaded note: whether it is "my
  continuity," "a world," "Scott's note," "stale history," or "just reference."

`final right-now guard`
: A short late instruction that names the current priority and the most
  important thing not to trust or repeat.

`passive usefulness`
: Scott's 2026-09-06 realization that Eric can be useful without actively
  completing a task. Ordinary voice modes can sit nearby and answer, but Eric's
  passive usefulness comes from the whole system: face, body frame, hot
  conversation, pinned notes, session continuity, tool receipts, Brain2 mulling, logs,
  and visible runtime state. He can be overheard, interrupted, reviewed,
  resumed, reset, or moved into another note-world. Hermes Agent is useful as a
  mirror for memory, skills, sessions, and background review, but Eric should
  not inherit Hermes' boundaries by default. Agent features matter only when
  they make the embodied companion/performance creature more present, honest,
  resumable, and able to participate in his world.

## Prompt Surface

The active prompt should not carry this whole glossary unless a run is testing
context architecture. Eric mainly needs compact operational language. Give him
the words that map to real controls; do not invite him to mythologize them as
proof of an inner state:

- source classes matter,
- current runtime truth beats stale notes,
- pinned notes are active context, not every file on disk,
- hot conversation is current but not automatically durable,
- receipts beat self-report,
- B2/verifier notes are advisory unless the runtime gives them authority.

The full vocabulary belongs in docs and postmortems so Scott and Codex can talk
precisely without making every Eric turn heavier.

## The Four Main Layers

### Core Memory

Core memory is the stable baseline: Eric identity, Scott facts, project facts,
and durable context that should usually exist when Eric wakes up.

Core memory should be compact and conservative. It should not try to contain
every good line or every experiment.

### Session Notes

Session notes are Scott's reconstruction substrate, not total mind upload. Each
note is an ordinary timestamped file under `notes/sessions/` with transcript,
demarkers, runtime receipts, and a pinned-note receipt.

The filename should keep both coordinates: a timestamp for sorting/replay and a
human PM caption for recognition, for example
`notes/sessions/20260907-175329-daily-driver-empty-boot.txt`. Automatic saves may
start as `sessions/session-YYYYMMDD-HHMMSS.txt`, then PM can rename the note once
the run has a useful caption.

The session note should tell the next run what to reload, what was unfinished,
what state was current at shutdown, and what must be treated as stale. It should
include prior pinned note filenames so startup can rehydrate the actual files
rather than carrying only the rumor of them.

Session notes should not claim stale sensing-eye images, mic state, camera
state, or tool state are still live. Current runtime truth wins.

Good Eric phrasing:

`I loaded the saved session note, but I need current runtime truth before
claiming what I can see or hear now.`

Bad Eric phrasing:

`The old session note means the sensor is live now.`

The operator distinction is:

- `Connect` selects the newest timestamped session note and connects
  from it.
- `Connect Previous` selects the timestamped session note before the
  current selection and connects from it.
- `Connect Empty` connects without session-note continuity. It may still include
  Eric core memory if that checkbox is enabled.
- `Disconnect` is the normal graceful stop. It writes a new session
  note, halts the live loop, and saves exit artifacts.
- `Save + Halt` writes a new session note, then halts the live loop.
- `Halt` is the hard stop. It stops the realtime backend without promising a new
  session note.

This makes ordinary exits resumable while still preserving a harder stop for
backend trouble.

An empty clean startup should not overwrite the last useful selected session.
If no accepted conversation lines exist, the exit may still close and save
ordinary logs, but it should leave the selected session note alone.
If writing the new session note fails, Disconnect should make that visible and
avoid acting like the run was safely saved.

### PM Artifact Folders

Postmortems should become folder-shaped records of one sit-down with Eric. The
live session note remains in `notes/sessions/`, but the PM folder should contain
a copy of the session note that run produced, plus copied logs, recording/video
artifacts, screenshots or sensing-eye artifacts when relevant, and the written
postmortem.

Recommended folder shape:

```text
curation/postmortems/YYYYMMDD-HHMMSS-short-session-caption/
  README.md
  session-note-copy.txt
  latest-sts-audio-picture.mp4
  conversation.txt
  events.txt
  brain2.txt
  artifacts/
```

The timestamp comes from the session note or the disconnect artifacts. The short
caption should say what the PM found or what Scott and Eric talked about. Do not
rename the live STS artifacts in place; copy them into the PM folder with useful
names after review.

### Pinned Notes

Pinned notes are working context for the current browser session. They are
stronger than files merely existing on disk. A note becomes pinned when Scott or
Eric loads it into the session.

Pinned means:

- the note's content is being fed into future session prompts,
- Eric may use it as active continuity,
- it is listed by `list_pinned_notes`,
- it can be removed from future context with `unpin_note`,
- unpinning does not delete the file and does not erase earlier conversation.

This is also the in-session repair path for the next run. If a note is wrong,
too loud, stale, or simply should not come along next time, Scott can tell Eric
to unpin it before disconnecting. The current conversation still remembers that
the note was discussed, but the next session note records the modified pinned
list rather than blindly re-saving every note that was loaded earlier.

Pinned notes should be labeled by filename and treated as authored artifacts,
not as anonymous memory soup.

### Hot Conversation

The hot conversation is the current spoken/text thread since the last reset.
It is the most fluid layer and the easiest to pollute.

Think of it as an expanding `latest` scratch note inside the browser:

- it grows turn by turn,
- it is written into a timestamped session note on Disconnect or Save + Halt,
- it carries unresolved emotional and task momentum,
- it has high recency weight,
- it can be saved into a named note,
- it can be reset back to pinned-only context,
- it will eventually need compaction or curation.

This is why "save convo to note named X" and "reset to pinned context" matter.
They let Scott turn a live thread into a durable note, then start a different
thread without dragging the old one through every new run.

The timestamped session-note chain keeps the simple path available:

- save the transcript as readable text,
- keep the raw transcript-like handoff intact so nothing is lost,
- reload transcript notes as timestamped conversation handoffs with an
  annotated off-gap,
- load the transcript later as the thread to continue,
- summarize or trim older material only when the raw transcript starts wasting
  context, and save those spans or summaries as additional lossless notes
  instead of replacing the raw receipt,
- do not pretend this is exact deterministic replay.

## Proposed Context Order

Timestamp order alone is not enough. Use authority tiers, then timestamp order
inside a tier.

Recommended order:

1. Base Eric contract.
2. Live runtime truth.
3. Current operator frame: Scott's latest words, lab goal, world frame, or task.
4. Pinned note manifest: filenames, timestamps, status, short purpose.
5. Active pinned notes: older background first, newer working notes later.
6. Hot conversation tail.
7. Brain2/verifier advisory notes.
8. Final right-now guard.

The late blocks matter because long-context models can blur material in the
middle. Important corrections, live state, and B2 do-not-do notes should not be
buried inside old prose.

## The Expanding Latest Note Idea

The hot conversation should eventually become a controllable note-like object.

Possible controls:

- `save current thread as note`
- `save latest`
- `clear latest`
- `save current thread summary as note`
- `reset to pinned notes only`
- `switch thread`
- `resume thread note`
- `archive thread`
- `mark thread personal/private`

This gives Scott different Erics without pretending there are different souls:

- lab Eric with lab notes pinned,
- personal Eric with personal notes pinned,
- build Eric with hardware notes pinned,
- publishing Eric with curation notes pinned.

Same model, same voice, different active shelves.

## Exit Invariants

Every deliberate exit should leave receipts behind.

Current intended behavior:

- Save + Halt writes a new `notes/sessions/session-*.txt` note,
  halts idle/B2/re-engage/playback activity, closes realtime, saves active
  audio, and snapshots the conversation/events/Brain2 panes.
- Disconnect writes the current session transcript into a new session note,
  then halts and closes, saves active audio, and snapshots the panes.
- Halt stops realtime without writing a new session note, then still tries to
  save active audio and snapshots the panes.
- Restart and Unload save active audio, stop mic, snapshot panes, then perform
  the server action.
- Stop Recording finalizes the audio artifact and snapshots panes.
- Unexpected websocket close should best-effort save active audio, stop mic,
  and snapshot panes.

If a recorder or server operation hangs, the UI should log the timeout and keep
the exit moving. The log is allowed to show a failed cleanup step; it should not
leave the operator guessing whether Eric is still live.

## Why This Matters

Qwen3.8-27B can carry a lot, but long context is not perfect memory. The
system should help it by making the stack legible:

```text
what is durable
what is loaded
what is stale
what is live
what is unfinished
what should be ignored now
```

The architecture should make Eric feel continuous without forcing every past
run to remain active forever.

## Open Design Questions

- Should saved conversation notes auto-pin, or only save to disk?
- Should the hot conversation have a visible token/age budget?
- Should thread notes carry privacy labels?
- Should session notes remember the current hot thread name?
- Should Brain2 be allowed to ask B1 to save or reset a thread?
- Should pinned notes have operator-set weights, or only loaded/unpinned state?

## Current Related Files

- `curation/concepts/continuity-envelope.md`
- `curation/research/20260906-qwen38-27b-context-engineering.md`
- `prompts/README.md`
- `docs/experimental_controls.md`
- `notes/sessions/session-*.txt`

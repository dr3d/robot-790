# Context Engineering Architecture

Status: current implementation and design direction, reviewed September 8, 2026.

This system does not treat memory as one magic blob. It treats context as a
directed graph of ordinary, inspectable sources with different lifetimes,
different authority, and explicit provenance.

The graph describes relationships among the sources. Prompt assembly puts a
selection of them into a linear input for one connection. This sketch names the
main sources; it is not the literal prompt order or a universal authority ranking.

```text
core memory + selected session note + pinned notes + hot conversation + runtime truth
```

The elegance is that the pieces are plain files, browser state, and receipts.
The model can feel continuous, but the machinery stays visible. The graph is
represented by file references, pinned-note lists, and prompt rules. There is
no general graph database, automatic dependency traversal, or learned edge-weight
engine in the current runtime.

For the graph framing as its own public article, see
[`Context Engineering Is A Directed Graph`](articles/context-engineering-as-directed-graph.md).
That article also states the narrower novelty boundary: not "agent memory is
new," but "operator curation of a visible reload graph, where model-generated
captions or summaries can become candidate note flavors only after PM checks
them against receipts."

## Design Goal

The goal is not to preserve a hidden mind byte-for-byte. The goal is to make a
running session reconstructable enough that the next run knows:

- what it was continuing from,
- what notes were intentionally loaded,
- what happened in the last sit-down,
- what state is stale,
- what state must be checked live,
- what should not come along next time.

This keeps continuity useful without pretending old context is live sensor
truth.

## Lab Surface

The lab attitude is that the robot should be able to see the working surface it
wakes inside. That does not mean hidden control or secret state. It means STS
tries to expose the relevant UI, body, notes, sensors, receipts, and operator
decisions as legible context nodes.

As more of the UI becomes inspectable, those controls become part of the robot's
embodiment. A connection panel, a sensing-eye receipt, a focus slider, or a
loaded-note list can all affect the shape of the next run because they describe
the body and room the model is being asked to inhabit.

The boundary stays important: the robot may notice this surface and may suggest
changes, but runtime truth, receipts, and operator intent decide what is
actually loaded, pinned, archived, or changed. The goal is a sharper body shape,
not an invisible self-editing prompt.

## The Directed Graph

The context system has typed nodes:

- core memory,
- selected session notes,
- pinned notes,
- hot conversation,
- runtime truth,
- tool receipts,
- browser memory facts,
- sensing-eye image or text receipts,
- Brain2 advisories,
- PM artifacts,
- scrubbed session notes.

The important directed edges are:

- authority edges: which source beats which other source when they disagree,
- provenance edges: which source was derived from or resumed from which source,
- pin edges: which note files are actively feeding the current run,
- decay or salience edges: how strongly a source should still influence the
  present run.

This means "runtime truth beats saved notes" is not only a list-order rule. It
is an authority edge. "A dense summary came from this raw session note" is a
provenance edge. "Unpin this note" cuts a pin edge without deleting the note
node. "Let this image fade" lowers an attention edge without erasing the image
receipt.

The stack remains useful as the load-time view of the graph.

### Three Note Flavors

The representation model gives a session three possible flavors:

- `raw`: the saved record, including timestamps, garble, and repetitions. It is
  evidence of what was recorded, not proof that every spoken claim is true.
- `scrubbed`: transcript-shaped, with noise and repetition reduced and omissions
  marked. Fidelity must be checked; cleaning cannot promise mathematical
  losslessness or recover speech that STT never captured.
- `summary`: lossy carry-forward meaning for daily-driver resume or forks.

Raw governs disagreements about the recorded session; current runtime evidence
still governs current state. Derived notes should identify their raw source and
preserve uncertainty, corrections, and stale-state warnings.

The raw session note remains the canonical reload manifest: its parent link and
pinned-note receipts determine lineage and dependency rehydration. A Scrubbed
or Summary form supplies alternate session text only. PM stores those derivatives
as `notes/sessions/variants/<raw-stem>.scrubbed.txt` and
`notes/sessions/variants/<raw-stem>.summary.txt`. Each sidecar records its form,
raw source filename, and the source SHA-256.

Advanced Connection and Session Map let the operator choose one of those forms.
The loader enables a derivative only when its header names the selected raw
session and its SHA-256 still matches. Missing, stale, or malformed derivatives
stay unavailable and are refused by the API. A selected label therefore never
pretends that a raw note was transformed on the fly.

PM authors variants deliberately. Automatic generation, semantic fidelity
review, and budget-driven form selection remain future work; a matching hash
proves provenance, not that a summary is good.

## Load-Time Stack Projection

### Core Memory

Core memory is the stable boot layer. It holds durable identity, relationship,
project, and operating facts that should usually be present.

For Eric, this includes `core/erics_memories.txt` when the Eric memories checkbox
is enabled. Empty Connect can still include this note; an empty
`core/erics_memories.txt` is the true factory-reset style start.

Core memory should stay compact. It is the seed, not the transcript archive.

### Selected Session Note

A session note is an ordinary timestamped file in `notes/sessions/`.

It is the saved `latest`: the live transcript/context from one sit-down, plus
demarkers and receipts. It is not a hidden API session object and not an opaque
state blob.

It is also a reload manifest in the old dependency-spec sense. The note does
not merely say "restore this frozen blob." It carries the pointers and metadata
needed to rebuild the right context graph at load time: parent session,
pinned-note list, save-time receipts, demarkers, current-vs-stale warnings, and
the transcript or selected flavor of the transcript.

The dependency-spec analogy applies specifically to session notes. Ordinary
notes need not carry dependency metadata. The current loader reads the selected
session and its direct pinned-file list from disk; it does not recursively
resolve every dependency of every note. The descriptor requires those files to
remain available. Before clearing the browser's current context, STS checks the
selected note's direct parent and pins. If a saved reference is unresolved, it
names the missing links and lets the operator either proceed with the available
context or cancel the reload unchanged. Choosing representations per dependency
is future work.

The filename carries two kinds of information:

```text
notes/sessions/20260907-175329-daily-driver-empty-boot.txt
```

- timestamp: machine-sortable time coordinate,
- caption: human-readable PM name.

STS may initially save a generic filename such as
`sessions/session-YYYYMMDD-HHMMSS.txt`. PM can rename it after the run has a
good caption. The UI can display caption first while preserving the timestamp
and full filename internally.

There is no separate current-session pointer in the canonical path. Plain
`Connect` chooses the newest timestamped session note. `Connect Select` is an
explicit operator choice for that connection, not a hidden bookmark.

Loading a session is a fresh reconstruction step. STS reads the selected
session note and the pinned-note receipt from disk, then replaces the browser's
active pinned-note set with that restore set. Notes left over from a previous
tab run do not come along unless the selected session note names them.

Stale/live boundaries are load-bearing metadata. If a summary or scrubbed flavor
drops the fact that an old camera, mic, tool, or sensing-eye state is
stale-until-checked, that flavor is not faithful enough to use as a reload
manifest. Runtime truth still wins after the manifest is assembled.

### Pinned Notes

Pinned notes are files currently loaded into the browser session and fed into
future prompts.

They are stronger than files merely existing on disk. A note on the shelf is not
context until it is read or pinned.

Pinned notes are also the main in-session context repair lever. If a note is
wrong, stale, too loud, or should not come along next time, the operator can tell
Eric to unpin it. That does not delete the file and does not erase the current
conversation. It changes the pinned-note list that the next session note will
record.

Useful spoken forms:

- "What notes are pinned?"
- "Unpin `boot_eric.txt`."
- "Do not bring that note next time."
- "Drop `get_go.txt` from boot context."
- "That note is polluting this run, stop using it."

### Hot Conversation

The hot conversation is the current spoken/text thread since the last clean
connect or reset.

It is also called `latest` in the console. During a run it is live, unfinished,
and high-weight. On a graceful exit, STS writes it into a new session note.

The hot conversation is allowed to be messy. The disk record should preserve the
real transcript and timestamps. Cleanup or compaction can happen later when
loading or curating, without destroying the original record.

### Runtime Truth

Runtime truth is current state from the page, tools, sensors, model status,
camera, microphone, recording state, cast state, and embodiment controllers.

Runtime truth beats old notes.

If a saved note says the sensing eye had an image, but the current sensing eye is
empty, it is empty now. If an old note says the mic was on, but the current
browser says it is off, it is off now.

### Receipts

Receipts are evidence that something actually happened: tool results, saved
files, logs, model status, audio/video artifacts, or sensor/controller reports.

Receipts beat self-report. A model saying "I saved it" is not enough; the file
write result matters.

## Connect Semantics

The operator controls are intentionally small:

- `Connect`: select the newest timestamped session note and connect from it.
- `Connect Previous`: shortcut for the preceding timestamped session relative
  to the current run's session, or the selected/latest session when none is
  loaded. It is chronological, not a jump along the parent edge.
- `Connect Empty`: connect without saved session notes. Core memory can still
  load if its checkbox is on.
- `Connect Select`: manually choose a session note from the list.
- `Disconnect`: graceful stop. Save the current `latest` into a session note,
  stop realtime, and save exit artifacts.
- `Save + Halt`: save a session note, then halt the live loop.
- `Halt`: hard stop. Stop realtime without promising a new session note.

This gives quick paths for normal use and manual paths for replay or branching.
If there are no accepted conversation lines, Disconnect can close without
writing a new session note. If the session-note write fails, Disconnect should
not pretend the run was saved.

## Session Map

`web/sts/session-map.html` is a standalone operator helper for choosing,
previewing, and understanding session notes.

It exists because the right mental model is wider than the side panel. A
session list is not only a dropdown; it is a small lineage map. If Scott loads
an older Daily Driver note, talks, and disconnects, that creates a new child
session from that point. If he later loads another older note and disconnects,
that creates another branch. The graph does not create the branch. The saved
session note and its `Parent session` line do.

The map intentionally uses only the existing session-note substrate:

- `/api/continuity/sessions` for the active note list,
- `/api/notes/read` for the selected note preview,
- `/api/continuity/select` for an explicit source session and requested load
  form,
- `/api/continuity/archive` for moving notes out of the active selector.

It does not add a database, pointer file, hidden bookmark, or alternate
continuity state. The lineage graph is reconstructed from ordinary filenames
and parent-session receipts already stored in each note.

The main STS page has a `Map` button inside `Connect Select`. From there the
operator can open the map as a popup. If the map was opened by STS, it can send
messages back to the opener:

- `Connect In STS`: ask STS to load and connect from the clicked raw session
  using the selected available form.
- `Archive`: move the selected note under `notes/sessions/archived/`, then ask
  STS to refresh its selector.

Selecting a map card or form changes the popup's own preview only. It does not
alter the main STS selection until the operator chooses `Connect In STS`.

If the page is opened directly, it still works as an isolated read/preview
surface. In that mode there may be no opener to receive a selection message.

The safety invariant is that `session-map.html` is a user helper, not the
authority. The authority remains the session-note files and the continuity API.
If the graph looks wrong, inspect the selected note's `Parent session` line
first.

## What Gets Saved

A session note should contain:

- neutral file header,
- created timestamp,
- session note filename,
- parent session note if this run resumed from one,
- short "how this run got here" block,
- pinned-note receipt with filenames, sizes, and hashes,
- session demarkers,
- model/runtime summary,
- first and last transcript timestamps,
- current-vs-stale reminders,
- transcript since clean connect,
- useful Brain2/verifier tail if present.

The key invariant is that the session note records the modified pinned-note list
at save time. If a note was unpinned during the run, the next saved session
should not blindly bring it forward.

## PM Loop

Postmortem work closes the loop:

1. A run ends and STS saves a session note plus exit artifacts.
2. PM reads the transcript, logs, Brain2 tail, and any video/audio.
3. PM gives the run a short human caption.
4. The live session note is renamed to timestamp plus caption.
5. PM may create source-linked Scrubbed or Summary sidecars from raw, keeping
   the source, SHA-256, and uncertainty visible.
6. The PM folder stores a copy of the raw session note, scrubbed/summary
   derivatives when made, and related artifacts.
7. The newest timestamped active session note becomes the natural next boot
   target. When matching derivative sidecars exist, their form can be selected
   explicitly; otherwise Full `.txt` remains the only enabled form. Older notes
   remain available through Connect Select and Connect Previous.

This means future lists are readable. Instead of choosing from anonymous
generic filenames, the operator sees labels such as:

```text
daily driver empty boot - 2026-09-07 17:53:29
```

The filename remains timestamp-first for sorting and replay.

## Direction: Intersession Processing

Status: design direction, not automatic runtime behavior yet. Today's PM is a
deliberate lab review by the operator and supporting AI tools. It is useful
because the project is still learning what deserves to persist. The ordinary
version should eventually become leaner and receive a name that describes a
transition rather than an ending.

STS is Eric's continuous brain in this architecture. A live Realtime
conversation is foreground activity inside that brain; it is not all of the
brain's activity. A future intersession interval can be a bounded continuation
of the same runtime:

```text
foreground interaction
  -> raw session and dependency manifest sealed
  -> intersession exo-brain consolidation and repair work
  -> reviewed continuity derivatives or proposals
  -> next foreground interaction
```

The boundary should be based on genuine quiescence rather than a timer alone:
no active speech, pending tool work, sensing task, or operator action for a
defined interval. The elapsed quiet time remains a timestamped fact; the
system does not pretend that silence was more conversation.

### Exo-Brain Work

The exo-brain is the separately engineered AI assistance that deterministic STS
can call to attend to and help manage Eric. It is not an alternate Eric or a
hidden replacement for his history. STS runs it as a declared, auditable
`dream` task rather than a secret second conversation. During an intersession
interval, STS can recruit a capable local model such as Qwen for a narrowly
declared text/context-processing task, using evidence Eric already has access
to.

This makes the PM part of Eric's progress through time while preserving the
boundary: the exo-brain helps STS prepare the next context without becoming a
covert spoken turn. It is outside the foreground Realtime conversation, not
silently inside it.

### Dream-Time Task Channel

Future STS can use a genuine quiet interval, or explicitly available spare GPU
capacity, to run exo-brain tasks without making them spoken turns. The process
is deliberately concrete:

```text
registered task + declared source snapshot
  -> LM Studio text/context request
  -> source-linked candidate and receipt
  -> deterministic validation and applicable review
  -> optional availability to the next live round
```

A task may be requested by the operator, scheduled by a deterministic rule, or
eventually requested by Eric through a semantic task tool. An Eric request is a
request for bounded help, not permission to alter history, pins, model settings,
or hardware by itself. STS arbitrates GPU and turn priority so live conversation
does not lose responsiveness to background work.

Useful jobs include:

- finding the source material behind a claim or remembered image;
- comparing a session against tool, sensor, and dependency receipts;
- locating unresolved references, conflicts, repetitions, or stale facts;
- proposing a faithful Scrubbed form and a compact Summary form;
- preparing a grounded re-entry packet when the live loop needs help getting
  back to an unfinished thread;
- proposing a repair, question, experiment, or memory candidate for a thing
  the live conversation handled poorly.

This can make Eric more potent without treating the exo-brain as a hidden
author of his past. Each intersession job must retain its task label, model and
settings, input manifest, time, source links, and output status. Its output is
a candidate connected to raw material, not new authority. Raw experience stays
unchanged; deterministic checks and the applicable operator or controller
policy decide whether a derivative, memory proposal, or repair becomes active.

The long-term intention is a visible system that can guide itself back toward
evidence and self-correct between encounters. The full lab PM remains the
slower investigative form for unusual or revealing runs. The future lean
intersession process should handle routine continuity work without replacing
that richer practice.

## Load-Time Handling

Disk records keep timestamps and messy details. Loading may add a restore
envelope that says:

- this is previous-session continuity,
- current browser time is now,
- approximate off-gap since save is this long,
- old sensors/tools/camera/mic state are stale unless checked live.

Future load-time cleanup can strip noisy voice-shape lines or repeated STT
drafts before prompt injection. That should be an optimization, not the source
of truth. The raw note remains intact.

## Context Pressure

Current limits are character limits, separate from the model's token window:
ordinary note prompt views are capped at 4,500 characters, transcript views at
64,000, and the combined loaded-note block at 64,000. Enabled core memory has
reserved room. Idle uses its own smaller budget controlled by the Notes slider.
Disk notes have a 200,000-character read/write limit.

Pinned does not guarantee fully included. Manual note loads retain at most eight
notes, while session restore replaces the pin set from the saved manifest without
that count limit. A later manual load can evict pins. The Context Map shows
sources and estimates; it does not yet provide an exact per-file inclusion
receipt. These are current limitations, not automatic compression.

Long context is large, but not infinite and not perfect. When pressure builds,
the system should not delete history. It should decompose it:

- keep the raw session note,
- create scrubbed-complete and summary flavors when useful,
- downshift older or noisy nodes to lighter flavors before evicting them,
- split older spans by timestamp and demarker,
- summarize only into additional notes,
- preserve references back to the source note,
- load only the notes needed for the current run.

The preservation goal is raw first, derivatives later. Current character caps
and incomplete capture can still omit material; they must not be described as
lossless compression.

## Reference Integrity And Replay

Pins and parent references currently use literal filenames. Captioning or
archiving a note does not automatically update its descendants or a running
browser's parent reference. An archived file is preserved on disk, but a note
that still names its old path has an unresolved reference. The reload preflight
shows that direct parent or pin and offers a deliberate partial load or cancel;
it does not invent the missing content or repair the graph. A live session that
names a moved file as its save parent can still fail to save. This is an open
engineering issue, not automatic graph repair.

Save-time hashes describe disk contents, which may differ from the browser's
loaded copy if a file changed during the run. Hashes also do not preserve old
contents. Exact A/B reconstruction requires versioned contents and the actual
assembly receipt, in addition to the named pin list. Current replay is a fresh
load of today's files.

## Shared Vocabulary

- `latest` or `hot conversation`: accepted current-run transcript/context.
- `session demarker`: timestamps and boundaries identifying a recorded run.
- `continuity envelope`: the prompt wrapper identifying a loaded record as
  prior history and marking old sensor/tool claims as stale.
- `shelf note`: a file that exists on disk but is not necessarily loaded.
- `thread note`: an ordinary saved thread or summary; it is not automatically
  a session descriptor.
- `advisory`: labeled Brain2/verifier material, distinct from operator speech
  and a successful action receipt.
- `lesson`: a candidate pattern to test before promoting it into durable
  instructions. Its evidence and uncertainty must remain visible.
- `exit artifact`: captured panes, recording, images, or notes used for PM;
  it is not automatically part of the next connection.

See [Engineering Status](engineering-status.md) for the maintained list of
remaining lifecycle, context-budget, and reference-integrity work.

## Why It Works

It works because each layer has a job:

- core memory gives stable boot identity,
- session notes give resumable conversation history,
- pinned notes give operator-editable context,
- hot conversation gives present momentum,
- runtime truth prevents stale claims,
- receipts keep the system honest,
- PM captions make the archive usable by a human.

Nothing special has to be hidden. The running character emerges from ordinary
context assembly, tool contracts, live feedback, and disciplined recordkeeping.

## Invariants

- New saved sessions are ordinary files.
- Plain Connect uses the newest timestamped session note; no hidden pointer is
  required.
- UI display names may be friendly, but stored filenames keep timestamps.
- Unpinning changes future boot context without deleting files.
- Disconnect saves the current `latest` into a session note.
- Halt does not promise a session note.
- Runtime truth overrides saved state.
- Receipts beat claims.
- Cleanup can happen at load time, but raw disk notes remain intact.

# Context Engineering Architecture

Status: working architecture note.

This system does not treat memory as one magic blob. It treats context as a
small stack of ordinary, inspectable blocks with different lifetimes and
different authority.

The useful shape is simple:

```text
core memory + selected session note + pinned notes + hot conversation + runtime truth
```

The elegance is that the pieces are plain files, browser state, and receipts.
The model can feel continuous, but the machinery stays visible.

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

## The Stack

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
- `Connect Previous`: shortcut for selecting the previous timestamped session
  note, then connecting from that.
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
- `/api/continuity/select` for explicit selection,
- `/api/continuity/archive` for moving notes out of the active selector.

It does not add a database, pointer file, hidden bookmark, or alternate
continuity state. The lineage graph is reconstructed from ordinary filenames
and parent-session receipts already stored in each note.

The main STS page has a `Map` button inside `Connect Select`. From there the
operator can open the map as a popup. If the map was opened by STS, it can send
messages back to the opener:

- `Select In STS`: make the clicked session the selected resume note.
- `Connect In STS`: ask STS to load and connect from the clicked session.
- `Archive`: move the selected note under `notes/sessions/archived/`, then ask
  STS to refresh its selector.

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
5. The PM folder stores a copy of the session note and related artifacts.
6. The newest timestamped session note becomes the natural next boot target.
   Older notes remain available through Connect Select and Connect Previous.

This means future lists are readable. Instead of choosing from anonymous
generic filenames, the operator sees labels such as:

```text
daily driver empty boot - 2026-09-07 17:53:29
```

The filename remains timestamp-first for sorting and replay.

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

Long context is large, but not infinite and not perfect. When pressure builds,
the system should not delete history. It should decompose it:

- keep the raw session note,
- split older spans by timestamp and demarker,
- summarize only into additional notes,
- preserve references back to the source note,
- load only the notes needed for the current run.

The architecture is lossless first, compressed later.

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
# Context Engineering Architecture

Status: current implementation and design direction, reviewed September 12, 2026.

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
- `scrubbed`: transcript-shaped, with an omission count and retained turns copied
  verbatim. The v2 sweep asks Qwen for low-value turn IDs to omit: repetition,
  redundant recaps, filler, and routine temporary waiting exchanges. It preserves
  useful facts, feedback, corrections, failure reports, and distinctive idle
  contributions. System receipts, image-recall anchors, and the adjacent
  request/reply context of retained reactions are protected in code.
  Retained timestamps and prosody stay unchanged; missing STT cannot be recovered.
- `summary`: lossy carry-forward meaning for daily-driver resume or forks.

Raw governs disagreements about the recorded session; current runtime evidence
still governs current state. Derived notes should identify their raw source and
preserve uncertainty, corrections, and stale-state warnings.

The raw session note remains the canonical reload manifest: its parent link and
pinned-note receipts determine lineage and dependency rehydration. A Scrubbed
or Summary form supplies alternate session text only. Preparation or PM stores those derivatives
as `notes/sessions/variants/<raw-stem>.scrubbed.txt` and
`notes/sessions/variants/<raw-stem>.summary.txt`. Each sidecar records its form,
raw source filename, and the source SHA-256.

Advanced Connection and Session Map default to **Auto history**, or let the
operator explicitly choose one of those three forms for the selected session.
The loader enables a derivative only when its header names the selected raw
session and its SHA-256 still matches. Missing, stale, or malformed derivatives
stay unavailable and are refused by the API. A selected label therefore never
pretends that a raw note was transformed on the fly.

STS now queues preparation after a successful continuity save. Saving and
Disconnect do not wait for the model. A deterministic bookkeeping-only v1 form
is available first, then one local 27B request selects sweep omissions and mines
the summary from the entire original transcript. No Eric persona, tool schemas, pinned
notes, or older sessions are sent. Thinking is off, temperature is 0.2, and the
length target scales from 80 to 400 words with transcript size. Speaker labels
are defined explicitly; previous-session recaps are claims, not fresh events.
Generated forms are explicitly not human-reviewed.
A matching source hash proves provenance, not that a summary is good.

Session Map exposes Prepare forms / Retry preparation and job status. Valid
reviewed derivatives are preserved; obsolete generated forms can be upgraded.
The queue has one worker. Auto Connect first waits for required history forms,
then cancels other in-flight preparation and keeps preparation paused through a
renewable browser activity lease. It resumes after Disconnect. Lost tabs expire
after three minutes; this is browser coordination, not a system-wide GPU lock.
Refresh STS tabs after deploying the new page server so they send that heartbeat.
Closing an HTTP request requests cancellation; the LLM server controls when its
underlying GPU work actually stops.

The preparation call returns structured JSON with a short topic `title`,
`drop_turn_ids`, and a `summary` array of speaker-attributed items. Each item identifies `operator` or
`eric`, compact text, and original `source_turn_ids`. STS rejects out-of-range
references or citations to a different speaker, renders account labels and citations, and
marks the recap as transcript-derived, not sensor/action verification. This
also covers sound, silence, and body-sensing claims, not only executed tools.
Only rendered text enters the Summary form, followed by verbatim historical
image-open receipts and their first descriptions so image identity remains
usable after compaction. These are recall anchors, not a staged/current eye.
The title is saved as
`<raw-stem>.title.json`, bound to the raw source hash, and exposed as display
metadata to both session views. It does not rename the source or change lineage,
receipts, or context loading. Existing valid titles survive regeneration; PM may
set a reviewed title through `save_continuity_session_title`. Older captioned
filenames remain a UI fallback. Title metadata travels with archived sessions.

Receipts live beside variants as `<raw-stem>.preparation.json` and include input
hash, prompt, model, usage when supplied, and completion/error state. Archiving
moves these with the session. Interrupted jobs require an explicit retry after a
server restart; startup does not bulk-process old sessions. Empty/malformed
transcripts, truncated responses, and input beyond 96,000 characters fail
explicitly rather than silently shortening the evidence. The bookkeeping-only
Scrubbed form remains available for explicit inspection if model preparation
fails, but Auto does not mistake it for a semantic sweep. Originals never change.

### Automatic History Policy

Auto prefers **all retained sessions as swept text**. Generated semantic sweeps
are checked against their original before loading: operator turns, the first
three assistant chunks following each operator turn, the final 16 turns,
system receipts, and image anchors must survive verbatim, including repeated
occurrences. Unsafe existing semantic sweeps use a labeled full-source fallback
without a model call. Reviewed variants remain an explicit override. Version 3
also protects those turns when applying the model's proposed drop list; this
is structural preservation, not an English failure-keyword classifier.

The explicit
`context_history.use_summaries` switch in `config/runtime.json` defaults to
`false`, following the summary-quality findings. Summary generation continues
for inspection, but Auto never selects those drafts, regardless of history age.

The experimental mixed policy remains available only when `use_summaries` is
explicitly enabled. Then `context_history.recent_swept_sessions` (default `2`,
range `0..20`) selects the recent swept window and older retained sessions use
summaries. The selected session counts as one; zero means all summaries only
in that enabled mode. Disabling summaries does not discard older history or
replace ordinary pinned notes. Sweeps can require more context than summaries.

Membership comes from the selected raw manifest's flattened pinned inventory,
not a recursive walk that would resurrect unpinned notes. Parent links order
available history first, then remaining session pins by creation time. Archived
and unavailable references are skipped/reported. Ordinary pinned notes retain
their original text; the current core-memory checkbox still controls core memory.
Source identities remain pinned even though their loaded text is a derivative,
so later saves preserve lineage without reloading full ancestors through pins.

Auto prepares missing, stale, or obsolete generated derivatives before opening
the realtime connection. It waits up to three minutes, then asks for a retry;
preparation can continue while disconnected. Failures name the source file.
There is no silent raw fallback or partial-history substitution. The explicit
Full/Scrubbed/Summary choices retain the older single-session behavior for
comparisons. Connect Empty bypasses all saved history and starts a new thread.

The Events log and recording contain the actual per-session form inventory and
raw/loaded character totals. Variant headers retain the source save time apart
from preparation time. This is inter-session preparation, not live rewriting
of Eric's conversation or automatic writes to durable core memory.

### Direction: Summaries, Gems, And Feedback

See [Exo-Brain Summary Research And Model Scheduling](summary-research-plan.md)
for the next experiments: evidence-backed extraction, separate coverage and
factuality checks, alternative local models, and queued maintenance-time swapping.
These proposals do not change the current all-swept Auto loading policy.

September 11, 2026 design direction; the first prompt and loader pass is now
implemented above. The desired balance is useful detail, continuity, attention,
latency, and Eric's conversational character, not minimum context size alone.

After a session, retain the original and prepare a genuinely selective swept
form for its next normal reload. Keep recent sessions in swept form, then use
summaries beyond a configurable recent-history window. Preserve explicit form
selection for experiments. Missing or failed preparation needs a visible policy,
not a silent claim that a raw transcript has been swept. Originals and derivatives
make comparisons of the same history at different context balances reversible.

Summaries should preserve both harvested material and the operator's response
to it. A list of topics discussed is not sufficient memory for future Eric.
The intended carry-forward content includes:

- Concrete facts, named things, distinctive details, decisions, and corrections.
- Open questions, developing interests, and intentions worth returning to.
- Memorable phrases, associations, and imaginative contributions, attributed
  as such rather than promoted to physical facts or verified events.
- Explicit likes, dislikes, and guidance, including their scope. For example,
  "I don't like insect stories" is direct topic guidance, not merely a negative
  sentiment score. This example is a design illustration, not a preference
  inferred from every mention of insects.
- Evidence of how a gem landed: the associated moment and any explicit feedback.
  Tentative interpretations of laughter, delivery, or other reactions remain
  tentative and require actual recorded evidence. Do not invent a reaction or
  infer durable approval from loudness alone.

Keep the gem linked to its feedback and source session, with enough location or
quotation to inspect the evidence. If the operator explains what worked, retain
that explanation. Otherwise distinguish an observed response from a hypothesis
about why it worked. The lesson may concern a subject, style, timing, or connection,
not a direction to repeat the same line. Later explicit corrections outweigh
earlier guesses; quoted old feedback is not a new endorsement.

Extract this material from the source before or alongside summarization. Mining
only an already-compressed summary cannot recover details it discarded. Reduce
repeated recaps and redundant idle variations while preserving distinctive
contributions, including ones made during idle. Do not restrict Eric's live
imagination to simplify later cleanup. Retain some unfamiliar material so his
interests can develop rather than becoming a closed loop of successful motifs.

B2 may flag useful moments and candidate preferences through its existing
observation role. Post-session processing consolidates them; durable continuity
does not depend on B2 retaining a private conversation between sessions. B1's
future context should carry concise relevant guidance along with factual and
associative material. The current summary prompt harvests these from the recorded
transcript. B2-assisted tagging, durable preference promotion, richer evidence
indexes, and systematic semantic-fidelity evaluation remain future work.

## Load-Time Stack Projection

### Core Memory

Core memory is the stable boot layer. It holds durable identity, relationship,
project, and operating facts that should usually be present.

For Eric, this includes `core/erics_memories.txt` when the Eric memories checkbox
is enabled. Empty Connect starts an ordinary session with only this note pinned;
it skips restoring a saved session and its dependencies. It is not a restricted
runtime mode: tools, sensing, new pins, Brain2, idle work, browser memory facts,
and subsequent saves follow the same rules as any other session. Unchecking
Eric memories also omits the core pin. Neither choice removes Eric's configured
identity, operating instructions, or enabled tools.

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

STS saves a stable filename such as `sessions/session-YYYYMMDD-HHMMSS-mmm.txt`.
Preparation generates a display title alongside the summary; PM can refine that
title in its `.title.json` sidecar. Do not rename the source for captioning:
descendants, source hashes, and a running browser may already depend on it.
The UI prefers the saved title, falling back to older captioned filenames.

A valid title from a complete structured preparation response is saved even if
the summary citations or sweep fail validation. The source hash and existing
title protection still apply; incomplete responses and invalid titles are not
salvaged. Failed continuity content remains unavailable. The preparation record
retains that validation failure's request, response, settings, usage, and elapsed
time under `failure_receipt` (historical diagnostics, never loaded as memory).
Retry can complete the derivatives without replacing an existing valid title.

There is no separate current-session pointer in the canonical path. Plain
`Connect` chooses the newest timestamped session note. `Connect Select` is an
explicit operator choice for that connection, not a hidden bookmark.

The maintenance tools `list_session_map` and `enter_session` now expose the same
active session inventory and selected-session transition. The map is retrieved
on request as paginated metadata, not continuously appended to the prompt.
Exact unique titles or listed IDs identify destinations. STS drains speech,
saves the departing run, and reconnects using the chosen destination and current
history policy; failure to save blocks the move. New speech or cancellation
before departure invalidates the pending move. Navigation is excluded from
idle tools and does not merge the departed branch into the destination.
This first pass is fixture-tested; live spoken navigation remains to be tested.
See [operator instructions](sts-ui-guide.md#ask-eric-to-enter-a-session).

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
3. PM reviews the automatically generated title or gives the run a short caption.
4. The caption is stored with `save_continuity_session_title`, without renaming
   or editing the original session note.
5. PM may create source-linked Scrubbed or Summary sidecars from raw, keeping
   the source, SHA-256, and uncertainty visible.
6. The PM folder stores a copy of the raw session note, scrubbed/summary
   derivatives when made, and related artifacts.
7. The newest timestamped active session note becomes the natural next boot
   target. Auto prepares retained sessions and applies the configured history
   policy: currently all swept, with older summaries explicitly disabled;
   explicit forms remain available for experiments. Older notes remain available
   through Connect Select and Connect Previous.

### Preparation Audit In Every PM

Include a short **Context preparation** section when reviewing a run. Read its
`notes/sessions/variants/<raw-stem>.preparation.json`, the original, and the two
derivatives. If preparation is still pending or failed, report that rather than
implying the next resume will use a finished summary.

Report:

- The actual model, thinking setting, temperature, output limit, and job elapsed
  time; prompt/completion token usage if the inference server supplied it.
- What the LLM received: only this run's numbered transcript turns plus the
  focused preparation prompt, not Eric's persona or older loaded notes. The
  exact instruction is in the receipt; source and transcript hashes bind it.
- Raw note, transcript, swept and summary sizes. Distinguish removal of the
  deterministic save/B2 envelope from semantic turn omissions and lossy summary.
- Proposed versus accepted omitted turn IDs, protected receipt/image/exchange anchors,
  and retained/original turn counts. IDs are zero-based in the raw transcript's
  parsed turn order; inspect the original to quote examples.
- A few actual facts/gems and operator reactions that survived, along with any
  mistaken omission, invented connection, attribution problem, or lost detail.
- Which forms the next resume will load. Use the `session history loaded` event
  inventory for what actually loaded in a run, not an assumption from file names.

Successful JSON validation and a matching hash are not semantic-quality proof.
PM should explain how the preparation behaved, not just say "summary generated."
This audit stays in PM/operator artifacts; it is not extra narrative for Eric's
live context. The sweep is deliberately hybrid: deterministic structure and
invariants, LLM semantic selection, deterministic validation and verbatim assembly.

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

## Direction: Cache-Aware Context Assembly

Captured September 10, 2026. This is a future investigation, not a deployed
prompt reordering, slot assignment, or confirmed explanation of latency.

STS has two separate responsibilities: choose the right context for this moment,
and avoid unnecessary inference work when presenting it. The active context is
not an immutable, append-only transcript. STS can rebuild instructions and
selected context as notes, embodiment, runtime state, and the task change,
while retaining the original conversation as evidence. That flexibility also
lets one loaded model serve B1, B2, and focused exo-brain tasks with different
instructions and input diets.

### Sending Context Versus Computing It

Sending the full message history through Chat Completions does not imply
recomputing the whole history on the GPU. With applicable prompt caching,
llama.cpp can reuse an available matching token prefix and evaluate the
remaining suffix. A changed early timestamp or runtime field can make most of
the following conversation need evaluation again; it does not necessarily
invalidate the matching tokens before that change. See the upstream
[prompt-cache contract](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md).

Ordinary prefix reuse concerns the actual tokenized input, including the chat
template, roles, and rendered tools, not semantic similarity between passages.
Identical transcript text after different instructions is not automatically
identical KV state: its preceding context differed. Other cache mechanisms and
model-specific constraints may apply; upstream llama.cpp behavior is not proof
of the exact behavior or options exposed by the installed LM Studio runtime.

The useful performance question is therefore: **how much of this particular
request was reused, where did it first diverge, and what had to be evaluated?**
Reported input-token totals alone do not answer that. Neither do character
estimates of prompt size. This is distinct from model-weight loading and from
speculative decoding, which concerns generation rather than this prefix match.

### Multiple Brains, One Model

B1 and B2 are candidates for genuinely shared stable context, followed by their
different jobs. They are not currently built around a deliberately identical
leading prompt: B1 begins with the creature/identity instructions, while
`mull_second_brain` begins with B2's private-observer instructions. Their common
subject matter does not by itself establish substantial shared KV reuse.

There are two complementary experiments, not a decision to merge the brains:

- Put material genuinely needed by both lanes into an identical stable prefix,
  then branch into role-specific instructions and evidence. Preserve privacy,
  authority, and the distinction between observations and model-made claims.
- Keep each lane's distinct prefix warm independently where server scheduling
  and cache retention allow it. A small B2 may be cheaper than giving it B1's
  entire tool catalogue and history just to manufacture a large common prefix.

The working `parallel=2` setup allows two concurrent request sequences. It does
not reserve permanent "B1" and "B2" caches. With unified KV enabled, their
storage can come from a shared pool rather than rigid per-request partitions;
sharing storage does not itself prove reuse of computed prefixes. See
[LM Studio's concurrency and unified-KV explanation](https://lmstudio.ai/blog/0.4.0).
Idle requests, tool follow-ups, and eligible preparation/exo-brain jobs also
need consideration when studying slot/cache retention. Two slots are a
reasonable foundation, not evidence that all these requests already stay warm.

### Measure Before Reordering

Keep this as a controlled performance experiment, not a reason to reduce Eric's
expressiveness or remove useful live state:

- Capture actual B1, B2, idle, and tool-follow-up requests; compare their
  tokenized prefixes and locate the first differing section. Include template
  and tool ordering rather than comparing only visible system-prompt text.
- Record available cache-hit, evaluated-token, slot, queue, prefill, and
  first-token timings. Check ordinary turn-to-turn reuse separately from
  switching lanes and from the first user response after a long idle.
- Test stable ordering and deliberate placement of volatile fields, without
  making sensor state stale or promoting untrusted evidence into instructions.
  Moving a field later in the system message can still invalidate the history
  after it; placement must be assessed on the complete rendered request.
- Compare shared-prefix and independently warm-lane strategies using latency,
  resource use, and behavioral fidelity, not cache-hit percentage alone. Long
  retained contexts still have costs even when prefill is reused.

The September 10 Reachy PM found two roughly 22k-token return requests taking
about 6.4-6.5 seconds to first audio, followed by two around 2.2 seconds at nearly
the same context size. That motivates measuring reuse; it does not prove cache
eviction, B2 interference, or a need for more parallel slots. Do not change an
ongoing observation run just to test this hypothesis.

When STS is opened with `?contextDiagnostics=1`, the event log records
`B1 session prompt change` when a session update
changes its instructions or configuration. It includes instruction lengths,
the common prefix in characters, a short excerpt at the first difference, and
whether tools changed. This is a client-side diagnostic, not token-level or KV
telemetry. It does not itself change inference settings.

Context diagnostics are off by default, including the temporary LLM run overview.
The query option enables both for a deliberate measurement run; normal STS URLs
do not collect them. Full backend request dumps separately require the explicit
`-CaptureLlmWire` launcher switch, also off by default. External LM Studio log
listeners are bounded test helpers, not part of normal server startup. Ordinary
session recordings and prompt-ledger inspection remain available.

### Cache-Stable Conversation Order (September 11)

The short live cache check found 25,501 input tokens fully reprocessed after a
single system-prompt character changed from `1s ago` to `0s ago`. When that prefix
stayed identical, only 212 tokens were processed, with model first-token latency
falling from about 6.7 seconds to 0.43 seconds. These were engine measurements,
not estimates based on the percentage of the context window occupied.

Ordinary B1 context is now assembled in this order:

1. Identity, operating rules, and private-context protocols.
2. Selected memories and restored past-session notes.
3. The current embodiment manual (replaced on a body change, not accumulated).
4. The current conversation, including tool receipts and private runtime updates.

Changing runtime state is no longer embedded in the main system prompt.
`[STS runtime]` blocks append changed sections to the conversation, following the
existing private B2-advisory pattern. They use assistant-message transport because
this backend stores system messages in a separate prefix rather than at their
insertion position. The blocks are explicitly controller context, not dialogue.
Latest versions supersede earlier versions of each named section. Unchanged
sections are not repeated. Clearing the eye emits an explicit absent-state update.

Runtime snapshots defer during generation and pending tool work; completed tool
handoffs can append them before requesting the follow-up. They do not appear in
the spoken transcript, and a marker guard prevents a verbatim private-block dump
from reaching TTS. They are visible in prompt-ledger receipts. Historical updates
remain in live history to preserve its prefix, so they are not a zero-token-cost
or bounded-history substitute for later sweeping/compaction.

The ordinary runtime ledger omits a ticking elapsed-time field. Idle requests
still receive current elapsed time and the attention scheduler is unchanged.
Search receipts in conversational updates use fixed timestamps instead of aging
labels. A meaningful body change, pin edit, mode change, or tool-schema change can
still invalidate cached context; one-time rebuilds at these boundaries are
acceptable. Actual partial-prefix recovery remains model/runtime-dependent.

The goal is agile context selection with less repeated computation, while B1
keeps its conversational role and other brains keep their focused jobs.

### Tool Continuations And Cancellation

Tool follow-ups retain the session instructions and complete tool schema list.
Their short `robot790_tool_followup` direction is appended as a private user
message only to the request's copied chat, not the saved/live conversation.
This gives the model a fresh request to answer without rewriting its identity,
history or body manual, or counting controller directions as operator turns.
Private text-only image selection uses the same voice-system prefix as B1.
Its exact-ID, one-recall capability is enforced by the browser; the unchanged
schema list is not permission to perform additional actions. Spoken receipt
requests still use tool choice `none`. Server-specific template behavior and
image stripping can still reduce cache reuse; this is not a guarantee of zero
prefill on every tool transition.

The project-owned realtime patch pumps provider events through a bounded queue.
Cancellation and stale-turn checks run while the network is waiting, not only
when another token arrives. A cancelled HTTP/1 stream has its own socket shut
down to release a blocked read; HTTP/2 connections are not shut down wholesale.
Late events cannot commit history or produce an apology for a superseded turn.
Before response headers arrive, the pipeline can release the obsolete request
while its timeout/cleanup finishes. Outstanding workers are bounded. Normal
provider errors and timeouts retain the backend's existing handling.

Interrupt sensitivity zero now disables both browser barge-in and backend
speech-triggered response cancellation. Image-tool protection cannot re-enable
it on expiry. Explicit stop/disconnect and superseded-turn protection remain.
This improves cancellation, not guaranteed warm KV residency after long idle.

## Reference Integrity And Replay

Pins and parent references currently use literal filenames. Changing a display
title leaves those references untouched. Manually renaming or archiving a note
does not automatically update its descendants or a running
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

## Brain2 Evidence Freshness

Brain2 receives timestamped transcript IDs, the number of new Eric transcript
chunks since its previous successful pass, the latest user utterance with its
own prosody, and explicit microphone, recording, sensing-eye, camera, and idle
hard-brake state. Transcript chunks are not necessarily separate model rounds.
Recent idle excerpts overlap the transcript; Brain2's own earlier output is
labeled as proposed commentary, not observation or sensor evidence.

Automatic mulling waits when this evidence is unchanged. Manual Mull remains
available. A response arriving after new user speech or a context reset is not
applied to the new situation. Loop pressure counts distinct Eric output IDs,
not repeated Brain2 assessments, and earlier pressure does not carry past new
user activity. These are controller checks, not a guarantee against every
model hallucination. Prosody remains useful evidence about delivery, not proof
of private intent or unrelated room sounds.

Conversational follow-up delays use real time, even when the idle lab clock is
accelerated. Brief acknowledgments are not promoted into long-lived idle
assignments; they remain in the conversation. These rules apply to resumed and
core-only connections alike, without creating a special Empty Connect persona.

## Conversational Attention Ramp

Added 2026-09-11. In normal Drift 1-10, one idle scheduler now bridges a pause
inside a conversation and independent idle. The separate conversational-nudge
timer is disabled in this mode; there is no competing "still there?" stage.

September 12 repair: while attention remains nonzero, an automatic pause beat
uses only the latest operator exchange and current runtime facts. It does not
inherit the independent idle research thread, alone ledger, old B2 suggestions,
or instructions to extend a mechanical metaphor. Only one automatic pause beat
is dispatched per accepted user turn. After that opportunity, the scheduler
waits until the attention fade expires or another user turn arrives. This is
a turn-taking limit, not text-based question detection or a topic restriction.
Manual Ponder and specialized lab modes retain their explicit behavior.

The initial interval is approximately 12 real seconds after a short reply has
finished playing. It eases toward the existing Drift interval over three real
minutes since the accepted operator input or completion of Eric's reply to it,
whichever is later. Slow inference/playback does not consume that warm window. The decay is smoothstep:
`p = clamp(quiet_ms / 180000, 0, 1)`, `blend = p*p*(3-2*p)`; the interval blends
from 12000 ms to the normal idle interval. The ordinary minimum gap between idle
beats follows the same ramp, so it cannot silently impose the old 90-second
floor. These defaults are editable in `config/runtime.json` under `idle_timing`,
not additional UI dials.

| Config key | Default | Meaning |
| --- | ---: | --- |
| `attention_enabled` | `true` | Enable the ramp; `false` restores the preceding separate nudge/idle behavior. |
| `attention_start_s` | 12 | Initial conversational idle interval, in real seconds. |
| `attention_fade_s` | 180 | Time after the exchange (user input or direct-reply playback completion) to reach ordinary idle. |
| `attention_warm_s` | 45 | Initial shared-topic context window; cannot exceed the fade duration. |
| `post_user_quiet_s` | 12 | Existing minimum quiet guard after user activity. |
| `minimum_gap_s` | 90 | Ordinary minimum gap between idle starts; also eases during the ramp. |
| `drift_base_s` | 270 | Baseline for ordinary Drift 1-10 delay calculation. |
| `drift_step_s` | 22.5 | Amount subtracted from that baseline per Drift level. |
| `drift_floor_s` | 45 | Lower bound on the ordinary Drift delay before Lab Speed scaling. |

The normal interval is `max(drift_floor_s, drift_base_s - level*drift_step_s)`
before Lab Speed scaling. Other guards still win; a shorter attention start
does not override a longer post-user quiet guard, playback, or a cooldown.
Tune at Lab Speed 1x and change one value at a time. The `_s` values are JSON
numbers in seconds, not strings. Missing/wrong-type/non-finite values use the
defaults; negative/oversized values are clamped to 0-3600 seconds (minimum 1
second for start, fade, baseline, and floor). `attention_enabled` must be a JSON
boolean. Code defaults remain only as the fallback for absent configuration.

After editing the file, refresh the STS page while disconnected. The runtime
endpoint reads the file on demand, so subsequent timing-only changes do not
require a server restart. `idle timing loaded` in Events and the idle prompt
ledger record the effective values for comparison between runs. Configuration
changes do not mutate an already running browser session halfway through a run.

Each interval is anchored to the last conversation activity, normally completion
of playback. Repeated scheduler polls cannot extend its deadline. The attention
weight uses the accepted operator timestamp and completion of the direct reply:
Eric's autonomous idle speech, B2 advice, and microphone peaks cannot renew it. New user activity still
blocks idle immediately while transcription is pending; accepted input renews
attention. Silence is not evidence that the operator physically left, and a
device-muted microphone is not inferred from the UI's microphone flag.

For the first 45 seconds, the idle request uses a shared-activity conversation
lane instead of a random independent lane. It invites a relevant question,
playful choice, or advancing afterthought without requiring questions or attendance
checks. During cooling, the conversation lane remains selected, with context
allowing the shared topic to loosen into a new interest.
After three minutes it is ordinary independent idle. These coarse context
labels describe a continuous timing curve, not three separate timers. B2 also
receives `runtime.conversational_attention` (`engaged`, `cooling`, or
`independent`) and is asked to support this transition rather than repeatedly
advise waiting for a command. Only the coarse label affects its evidence
fingerprint; a ticking attention percentage does not trigger extra mulls.

This state is added to the bounded idle/B2 requests, not injected as a rapidly
changing field into B1's main conversation prefix. The prompt ledger records
the idle attention phase and weight for PM inspection. The existing short-spoken
idle response mechanism remains in use; this change does not add a separate
model-based silent-pass decision.

The September 12 shared-activity adjustment changes **pause context selection
and temporary prompt wording**, not Eric's main personality prompt or timers.
Instead of the latest utterance/reply alone, the pause includes up to four
operator exchanges within the configured attention-fade interval preceding the
latest accepted utterance. It is bounded to 24 rows / 6,000 characters, with
800 characters per row. Tagged control receipts are omitted from this small
window, not from saved transcripts or B1 history. The current eye item's name
is included separately as identity only, not a new visual inspection.

The temporary directions now explicitly link short reactions to their shared
activity and say: "Speak to the operator as 'you'; they are the other participant
in this exchange, not an absent person to discuss." Wordplay remains welcome.
This addresses the observed "pretty darn good" -> third-person rumination
handoff without adding forced questions, more autonomous beats, new inference
calls, or changes to independent idle. Existing `eric-full*` snapshots have not
been refreshed; this is a documented request-local change.

No accepted user turn means normal idle timing, including a silent Connect
Empty. Drift 0 remains off. Performance, Substrate, First Contact, and stress
levels 11/12 retain their specialized behavior. Lab speed does not accelerate
the three-minute attention clock or reduce the initial human breathing room;
after the ramp, the ordinary accelerated idle interval applies. At high lab
speed that independent interval can be shorter than 12 seconds, so use 1x when
evaluating the conversational feel. Playback, user speech, pending tools, GPU
work, cooldowns, loop brakes, stale-session checks, and disconnect retain
priority. No embodiment-specific gesture or motion behavior is changed.

## Idle Headline Reading

Added 2026-09-10. This is a small external-input habit, not a general autonomous
research agent. With Brain2 enabled, Web Search enabled, Wonder above zero, and
Idle Drift above zero, STS can read headlines without an operator request.
It does not require Drift 10 or a populated conversation. Person-focus zero
disables person-watching, not this separate headline task.

At the first available Brain2 opportunity after two real minutes without user
activity, the page requests `/api/headlines`. The page server reads the public
[BBC News RSS feed](https://feeds.bbci.co.uk/news/rss.xml), keeping up to eight
dated headlines from the last 48 hours, newest first. Titles, descriptions,
publication dates and source URLs are retained. There is no fallback to general
search or undated material. STS is reading feed snippets, not full articles.

The next attempt is no sooner than ten real minutes later, including failed
attempts. Lab speed does not compress either interval. The server also shares
a ten-minute feed cache across clients (one-minute retry for feed failure).
Within a page lifetime, selected URLs or titles are skipped. Unselected stories
remain in a small cache. A structured B2 request for a new subject may select
from that unused cache after 30 real seconds without another network fetch.
A pass marks the offered stories considered to avoid repeated rejected choices.
Reconnecting clears the pending seed and steering request, but preserves the
page's fetch cooldown and seen-story list. No speech or model call is needed
when the feed contains nothing new.

B2 receives a `headlines` task with the dated snippets and its usual compact
context. It selects one supplied URL and an optional angle/question, or passes.
The controller validates the selection and never surfaces its mouth/voice or
revision fields in this task. It is contributing a possible interest, not
judging the operator or issuing loop guards. News text is external data, not
instructions; B2's proposed angle remains fallible advice.

The selected source becomes a normal search receipt plus a one-use private
seed in Eric's next eligible idle prompt. Eric may develop it or move elsewhere;
he is not asked to read a bulletin or return everything to the previous subject.
Seed delivery is logged, and the selected seed is included in the PM state.
The root B2 prompt specimens describe the ordinary observer pass; actual
headline-pass prompts are captured in the existing prompt ledger.

The ordinary observer now returns validated `steering`: an `evidence_id` tied to
the supplied latest assistant output, boolean `loop` and `unsupported_claim`, a
stable `topic` label, and `next` (`continue`, `new_subject`, `ground`, or `quiet`).
These are fallible model judgments, never sensor facts. Invalid or stale fields
cannot drive the new steering path. Natural-language keyword guessing no longer
sets loop/receipt guards; the old explicit `LOOP GUARD:` marker is recognized only
for compatibility with legacy advisories. Repeated assessment of one output does
not add pressure, and different subjects do not share an accumulating loop count.
The aim is developing thought, not default silence or waiting for an operator.
B2 interprets Eric's register in context: theatrical bragging, body banter, and
imaginative scenes are welcome without an "I imagine" qualifier. A recurring
motif that develops is not a stuck loop. Unsupported-claim steering is for
factual measurements, verified actions, or status an operator might rely on,
not an excuse to police Eric's colorful voice. Summaries preserve who said what
without recasting playful self-expression as either telemetry or an error.

Active goals/self-tasks, performance, First Contact and substrate tests defer
or disable this habit. User activity takes priority; results arriving across
speech, reconnect, context reset, or disabling the reader are discarded.
Existing B1 hard brakes and cooldowns still govern speech: B2 can read privately
during a hard brake but does not release it. The pending seed expires after ten
minutes and is not offered after a new user turn.

For an idle test, refresh STS, enable the four controls above, Connect Empty,
and leave it quiet. A 10-15 minute 12x run provides time for one or two reading
opportunities without a new lab button. The B2 log records `headlines fetch`,
`headline selected`, `headlines passed`, or `headlines unchanged`; Events shows
`idle headline seed ready` and the eventual `headlines` idle lane. The existing
Mull button still means reflection, not a forced headline fetch.

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

## Summary Quality Evaluation (September 11, 2026)

A local exo-brain trial on the 13:38 session exposed a distinction between
structurally valid summaries and faithful memory. The current Qwen configuration
could return valid JSON while misattributing statements, omitting a repeated image
request, or turning a request to clear the face into completed action. A separate
yes/no model reviewer accepted an erroneous draft. Quote extraction caught some
errors but did not establish semantic correctness. Enabling low reasoning exhausted
a 5,000-token output budget without producing a summary in this trial.

The session's replacement summary is explicitly a Qwen draft with Codex source
review and editorial corrections, not an unattended success or human-reviewed
memory. The raw transcript, sweep, title, and images were preserved. Production
preparation was not changed based on these experiments. Detailed local evidence
is in `logs/runs/20260911-133836-empty-profile-images/summary-experiment.md`.

A follow-up summary-only trial exhausted 16K output tokens without finishing
while repeatedly checking a hard word-count target. With flexible length,
requested high reasoning and a 32K ceiling, two trials completed in 52 and 81
seconds, using about 5.3K and 8.3K reasoning tokens. They recovered the repeated
image request and avoided inventing a clearing confirmation; one still reversed
the face-painting praise, while the repeat handled that order correctly. Image
description attribution remained imperfect. These are promising drafts, not a
deployed fix. Effort and length instructions changed together, so thinking alone
has not been isolated as the cause. The local `summary-thinking-evaluation.md`
beside the earlier report records settings, unedited outputs and the comparison.

Future work should test focused summarization separately from sweep selection,
with evidence-producing review and bounded revision. Structural validators cannot
certify meaning; evaluation needs held-out sessions covering corrections, feedback
referents, imaginative ideas, and the distinction between requested and completed
actions. These checks belong to memory preparation, not restrictions on Eric's voice.

## Invariants

For the proposed next step beyond pause-context tweaks, see
[Shared Activity And Task Continuation](task-continuation-experiment.md).
It separates shared conversation from unfinished actions and specifies bounded
tool continuations, receipt-based B2 context, and an optional later exo-brain
judge. This experiment is documented, not implemented.

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

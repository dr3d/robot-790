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
- `scrubbed`: transcript-shaped, with omissions marked. The automatic v1 sweep
  removes save/restore bookkeeping and separate B2 sections, but preserves all
  transcript words, repetitions, timestamps, and prosody markers. More selective
  cleanup is future work; cleaning cannot recover speech that STT never captured.
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

Advanced Connection and Session Map let the operator choose one of those forms.
The loader enables a derivative only when its header names the selected raw
session and its SHA-256 still matches. Missing, stale, or malformed derivatives
stay unavailable and are refused by the API. A selected label therefore never
pretends that a raw note was transformed on the fly.

STS now queues preparation after a successful continuity save. Saving and
Disconnect do not wait for the model. The first stage is the deterministic sweep
above; the second is a separate local 27B request containing only a short summary
instruction and this session's transcript. No Eric persona, tool schemas, pinned
notes, or older sessions are sent. Thinking is off, temperature is 0.2, and the
length target scales from 80 to 400 words with transcript size. Speaker labels
are defined explicitly; previous-session recaps are claims, not fresh events.
Generated forms are explicitly not human-reviewed.
A matching source hash proves provenance, not that a summary is good.

Session Map exposes Prepare forms / Retry preparation and job status. Valid
existing derivatives are preserved. The queue has one worker; STS Connect first
cancels any in-flight summary request, then keeps preparation paused through a
renewable browser activity lease. It resumes after Disconnect. Lost tabs expire
after three minutes; this is browser coordination, not a system-wide GPU lock.
Refresh STS tabs after deploying the new page server so they send that heartbeat.
Closing an HTTP request requests cancellation; the LLM server controls when its
underlying GPU work actually stops.

The summary call returns structured JSON with a short topic `title` and a
`summary` array of speaker-attributed items. Each item identifies `operator` or
`eric` and contains its compact text. STS renders explicit account labels and
marks the recap as transcript-derived, not sensor/action verification. This
also covers sound, silence, and body-sensing claims, not only executed tools.
Existing derivatives are not rewritten. Only rendered text enters the Summary form. The title is saved as
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
explicitly rather than silently shortening the evidence. Scrubbed remains usable
if only summary generation fails. Originals and current selection never change.

Semantic fidelity review and budget-driven form selection remain future work.
In particular, the proposed two recent detailed sessions plus older summaries
policy is not enabled: choosing a form still changes only that session's text,
not the forms of its pinned dependencies.

### Direction: Summaries, Gems, And Feedback

September 11, 2026 design discussion; not implemented by the current preparation
prompt or loader. The desired balance is useful detail, continuity, attention,
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
associative material. This is a planned improvement beyond today's short
speaker-attributed summary, not a claim that preference extraction or semantic
sweeping already runs.

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
3. PM reviews the automatically generated title or gives the run a short caption.
4. The caption is stored with `save_continuity_session_title`, without renaming
   or editing the original session note.
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

The STS event log now records `B1 session prompt change` when a session update
changes its instructions or configuration. It includes instruction lengths,
the common prefix in characters, a short excerpt at the first difference, and
whether tools changed. This is a client-side diagnostic, not token-level or KV
telemetry. It does not reorder the prompt or change inference settings.

The goal is agile context selection with less repeated computation, while B1
keeps its conversational role and other brains keep their focused jobs.

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
checks. After that, the usual lane selection
resumes with context allowing the shared topic to loosen into a new interest.
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

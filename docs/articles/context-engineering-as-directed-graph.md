# Context Engineering Is A Directed Graph

Robot 790 keeps continuity in ordinary session notes. Each records what happened
in one sit-down, which session it continued, and which notes were pinned when
it ended. Choosing a different earlier session can start another branch. Several
branches can depend on the same notes.

That makes a directed graph a useful description of the memory architecture.
The graph describes relationships; the prompt is one linear assembly drawn from
those relationships for a particular run.

The distinction matters to the operator. "What came before this?", "What should
come along next time?", and "Where did this summary come from?" are different
questions. Putting every file into chronological order cannot answer all three.

## What Exists Today

The implementation uses files, browser-held pin lists, tool receipts, and prompt
rules. It has a standalone session map that displays lineage from parent-session
references. A selected session loads its direct pinned-file dependencies from
disk. The robot can list or unpin notes through exposed tools, and the next
session note records the pin list as it stands at disconnect.

There is no general graph database or graph solver. Authority is largely
expressed in context labels and instructions, with deterministic checks for tool
results and runtime actions. There is no learned weighting engine, recursive
dependency loader, or automatic policy for choosing among note variants. The
operator can explicitly choose an available source-checked derivative.

The [architecture guide](../context-engineering-architecture.md) describes the
current controls and limits. The remaining sections distinguish that working
substrate from the extensions it suggests.

## Relationships With Different Jobs

Consider a session that resumes a Daily Driver note, reads a build note, and
generates an image. Its next session note can name the Daily Driver as its parent,
the build note in its pinned environment, and the image through a saved receipt.
Those references have different meanings:

| Relationship | Direction | What it answers |
| --- | --- | --- |
| Parent | Child session to earlier session | Where did this branch begin? |
| Dependency | Session to required note | What files does this reload expect? |
| Derivation | Summary to source record | What evidence supports this version? |
| Active pin | Current run to loaded note | What is selected for present context? |
| Authority | Disputed claim to applicable stronger evidence | What settles this disagreement? |

Parent and dependency references are already saved in session notes. Derivation
references are a requirement for the proposed alternate representations.
Authority is a policy relationship, not a stored numeric weight on every file.

Authority also depends on the question. A current camera receipt settles whether
the camera is on now. A saved transcript establishes what was recorded yesterday.
A receipt showing that a command was accepted does not prove that a physical
actuator moved. There is no universal rule that an ordinary pinned note always
beats core memory, or that a summary becomes more truthful by being recent.

Unpinning removes a note from the active pin set without deleting its file. It
does not erase earlier tool responses or conversation already sent to the model.
The next clean connection is where the modified dependency list becomes the new
starting selection.

## Three Representations

The current representation model preserves three forms of a session:

- **Raw:** the original saved record, with timestamps, transcription mistakes,
  repetition, and runtime annotations.
- **Scrubbed:** a readable transcript with noise reduced, repeated spans
  annotated, and corrections and uncertainty retained.
- **Summary:** a shorter, explicitly lossy account of decisions, unresolved
  questions, lessons worth testing, and useful context for continuing.

The raw record remains available. Every derivative should name its source and
record enough provenance to detect when that source has changed. A summary that
conflicts with the record needs correction. A robot-authored summary is a
candidate for review, not independent corroboration of its own claims.

"Scrubbed complete" describes an intention to preserve substantive information;
it cannot guarantee losslessness. Removing apparent garble can remove an unusual
name. Collapsing repetition can hide how persistently a loop occurred. The
reviewer must mark those interventions, and audio or video may resolve errors
that the transcript alone cannot.

Raw is authoritative about the saved record, not about the world. A raw
transcript can faithfully record a false statement. Current measurements and
other evidence still matter.

The operator can choose a lighter representation while retaining the route back
to its source. Resolution is separate from authority and provenance. The raw
session remains the dependency manifest, while an available Scrubbed or Summary
sidecar supplies alternate session text. Advanced Connection and Session Map
check the sidecar's source filename and SHA-256 before enabling it. Automatic
generation, semantic validation, and policy-driven variant selection remain work
to implement.

## The Dependency-Spec Analogy

Scott's comparison with old-school dynamic loading is deliberately modest: a
session carries a specification of dependencies that can be loaded later.

The selected note does not contain every dependency's frozen contents. It names
the files and records save-time hashes and sizes. A later connection reads their
current contents. Hashes help identify changes, but cannot recover an old version
that was never retained. Exact replay would require preserved versions as well
as the references.

The current loader follows the selected session's direct pinned list. It does
not recursively expand the graph, resolve missing ancestors, or downshift
notes automatically to meet a budget. Filename references also need care when
notes are captioned or archived: preserving reference integrity is unfinished.

The analogy does not imply that Eric directly rearranges his own KV cache.
Through conversation he can help choose notes, propose a caption, or suggest a
summary. Runtime tools and the operator determine which supported changes take
effect. A new connection builds its prompt from the resulting selection.

The controls follow that model:

- **Connect** selects the newest active timestamped session.
- **Connect Previous** selects the preceding chronological session relative to
  the current run or selection. It does not follow the parent edge.
- **Connect Select** chooses a particular session, including an older branch.
- **Connect Empty** omits session continuity; enabled core memory may still load.

A future comparison of raw, scrubbed, and summary reloads should preserve the
same dependency versions and settings. Otherwise the experiment changes more
than representation, even when the session caption stays the same.

## The Lab Is Part Of The Context

The lab's attitude is that the robot should be able to inspect the working
environment it inhabits: selected embodiment, notes, tools, sensing-eye contents,
controls, and receipts. What the system exposes helps make that body concrete.

Exposure is partial today. Runtime state and supported UI-control tools make
some surfaces readable and changeable. The robot does not automatically see
every pixel or every operator decision. A screenshot, explicit conversation, or
tool result can make more of that environment available.

This creates an interesting feedback loop. The operator and robot can discuss
what should be pinned, what was misleading, or how a control affects the run.
Those decisions can shape the next connection. The record should distinguish a
robot's proposal, an operator's decision, and a successful tool action so that
participation remains inspectable.

## Attention And Learning

A source can remain available while receiving less attention. The current Eye
salience slider adjusts preview opacity and instructions about how strongly
sensing-eye content should shape attention. It is a manual control; it does not
automatically decay with elapsed time, remove old image tokens, or measure an
internal attention weight.

Weighted relationships are a possible future implementation. Repeated evidence
could support a lesson; contradictory receipts could retire it. Such changes
would need an explicit policy and tests. They are not consequences of calling
the storage a graph.

"Learning as edge reweighting" is therefore a research framing here. Today the
observable process is operator/PM curation: inspect a run, propose a lesson,
compare subsequent behavior, and deliberately revise the notes or instructions.
A convincing explanation from Eric is useful input, but does not establish why
a behavior occurred or whether it will recur.

## Related Work And The Claim

Several close precedents make an invention claim premature. MemGPT uses an
operating-system memory analogy to manage context beyond the immediate window.
[MemGPT project and paper](https://research.memgpt.ai/).

Letta exposes memory blocks that agents and applications can use and edit.
[Letta memory blocks](https://docs.letta.com/v1-sdk/memory/memory-blocks).

RAPTOR retrieves across recursively summarized document trees, providing a
precedent for using information at multiple levels of detail.
[RAPTOR paper](https://arxiv.org/abs/2401.18059).

Robot 790's emphasis is the operator's experience: readable session files,
visible branches, a robot that can participate in discussing its next context,
and proposed representations that retain a route back to the original run.
These sources establish related work, not an exhaustive novelty search.

The defensible description is a design being explored: operator-curated context
assembled from session dependency records, with visible provenance and supervised
model participation. Its value should be tested by how reliably people can
understand, repair, and continue their sessions.

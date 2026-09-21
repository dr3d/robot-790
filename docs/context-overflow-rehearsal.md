# Context Overflow Rehearsal

September 20, 2026. Offline investigation and draft-memory preparation only.
No live compaction policy, prompt, idle schedule, permission, or model setting
is changed by this work.

Current position: full-request rehearsal is automated; a live rollover is not.
The useful mechanical saving is superseded controller state, not suppressing
Eric's thoughts. All raw sessions and image files remain untouched.

## Purpose

Live history currently preserves turns and consumed images rather than trimming
by turn count. That preserves continuity and stable cached prefixes, but does
not override a provider's finite context window. A provider error is not evidence
of successful compaction, and a later lower usage reading is not an audit of
what survived.

The rehearsal selects the first recorded usage above a proposed threshold,
then builds a candidate memory from artifacts available at that point. It does
not treat the visible transcript as a complete capture of the provider request.
Loaded ancestors, system instructions, schemas, private messages, and image
pixels require separate accounting before live deployment.

## Run It

Use a private PM bundle containing `session-note.txt` and the PM's `analysis.json`
(usage receipts and structured tool results). From the repository root:

```powershell
.\.venv\Scripts\python.exe -m robot_790d.context_overflow_lab `
  logs/runs/RUN --output logs/context-rehearsal/TRIAL --summarize
```

The defaults are an 80% trigger against 131,072 tokens and 32 recent transcript
entries retained verbatim. These are rehearsal settings, not deployed policy.
Add `--extractive` to have the model select original passages instead of
paraphrasing. Its structured output is constrained to source IDs; selected
passages and adjacent entries are copied exactly, then interleaved with the
protected entries in original order. Attribution cannot be rewritten by the
selection step, although later model interpretation can still be wrong.

Use `--at end` for an end-of-run candidate, `--context-limit` and
`--trigger-fraction` for another proposed budget, or omit `--summarize` for
artifact preparation without inference. `--resume --summarize` reuses completed
summary checkpoints. Use a new trial directory to change the source or settings.
Optional `--b2-at "8:29:55 AM"` records a reconstructed transcript window for
inspection, not an exact B2 request replay.

The existing chunked-memory lab handles bounded extraction and consolidation.
It uses the resident model at temperature 0.2, extraction without thinking,
and consolidation with thinking. There is no model swap. The local STS pool is
checked before requests and every five seconds; live use takes priority. This
is not a general GPU reservation and cannot detect unrelated model use.

The first artifact trial rejected the paraphrased draft: a section inverted
speakers, and a later consolidation exhausted its output allowance in reasoning
without producing a usable result. A chronological extractive candidate retained
the checked outcomes and distinctions in a small paired recall test. Separating
protected entries from excerpts had produced an attribution error in that test;
restoring original order corrected it on the next sample. This is encouraging,
not evidence of universal reliability. No paraphrased or extractive draft has
been installed in live history.

## Candidate Structure

- Source-linked memory draft for the older prefix, consolidated against original
  excerpts rather than recursively summarized summaries.
- Older operator and System entries retained verbatim, including image identities
  and recorded eye-load outcomes.
- Recent transcript entries retained verbatim.
- A compact historical index of tool outcomes with original names, statuses,
  filenames and staging flags. An index is not the original full result body.

Raw material remains unchanged. Source hashes, exact protected entries, recent
history, tool outcomes, and citation ranges are checked. Failed checks do not
install anything. Valid citations alone do not establish semantic accuracy.

Outputs stay under ignored `logs/`: manifest, prefix, source turns, protected
evidence, receipt index, model requests/responses, candidate, and checks. The
same-day local-clock parser explicitly refuses midnight crossings rather than
misordering them; future live work must use the native ISO audit timestamps.

## Findings To Carry Forward

An artifact-backed reproduction shows a separate B2 exposure problem: its
latest-user field can retain an old request after the completing exchange has
left the recent window. The browser supplies 18 entries; the backend retains
12 entries and the latest four image-tool receipts. Later successful actions
can therefore displace the old completion while the request remains visible.
Tests document this information gap, not a desired permanent policy or proof
that a model must hallucinate the missing outcome.

Preserving a small receipt-backed record of completed and unresolved work for
both brains is different from deterministic interpretation of English or telling
Eric what to say. Semantic summaries should retain imaginative associations,
uncertainty, corrections and intentions without turning proposed experiments
into measured results. Model prose must not override a concrete completion receipt.

## Before Live Deployment

1. Establish full request accounting, including images and output headroom. A
   character reduction in the visible transcript is not an equivalent percentage
   reduction in the actual model context.
2. Bound and review the final memory draft. The existing sectioned summarizer
   does not guarantee a fixed-size memory or reconcile all distant sections.
3. Preserve call/result pairs and pending operations across an atomic, generation-
   checked switch between completed turns. Never install a draft over newer work.
4. Define explicit preparation-failure and overflow recovery behavior. Do not
   endlessly resubmit an oversized request or silently pretend history survived.
5. Record before/after request identities, token counts, source ranges and retained
   artifacts. Expect a deliberate cache rebuild at a compaction boundary.

Full-conversation idle remains the design. This lab does not make idle quiet,
disable drawing or note writing, or impose rhetorical directions.

## Full-Request Automation

`context_wire_lab.py` extends the offline work to captured B1 requests, including
the admitted historical session blocks, current conversation, tool schemas and
verified saved image assets. It does not reload newer note contents, execute
tools, generate speech, install a note, or modify the live conversation.

```powershell
.\.venv\Scripts\python.exe -m robot_790d.context_wire_lab logs/RUN/wire/REQUEST.json `
  --evidence logs/RUN --output logs/RUN/wire-rehearsal --checks logs/RUN/recall-checks.json
```

The evidence directory supplies `analysis.json` with image names, byte counts
and SHA-256 hashes, and `completed-run/images/`. The check file supplies questions,
a response schema, expected answers and source evidence. Its expected answers
are not sent to the model. Reusing the same command resumes matching request
checkpoints; changed source identities or checks require a new output directory.
Model requests stop when an active STS session is detected by the existing lab
helper. This is not a scheduler for unrelated GPU applications.

Alternatively, a `probes` array supplies individual `key`, `question`, `choices`
and `expected` fields. Each probe requests quotes before its answer at temperature
zero. Expected answers are never sent. The report separates answer correctness,
literal source-quote matching, and their conjunction. A quote match is not a proof
that the quote supports the claim; these are narrow, human-authored checks.

Three variants are compared: original history; exact selected older passages;
and those excerpts with all but the latest two image payloads replaced by
historical file references. Operator/System evidence and adjacent context are
protected in the older selection, and current conversation/tool pairs remain
unchanged. Non-session notes, restore envelopes, body/personality instructions
and tool schemas are not rewritten. Unsupported envelopes or missing images
fail explicitly. Source sessions are never altered.

Version 2 also retains the first assistant entry following every protected
operator entry, looking across System receipts. This does not promise the whole
multi-sentence reply. Every omitted span is explicitly marked so nonadjacent
remarks do not masquerade as an uninterrupted exchange. The change invalidates
old trial manifests; use a new output directory, preserving earlier evidence.

Prompt measurement preserves the original tool-choice setting with one output
token and no tool execution. Using `tool_choice: none` omitted roughly 10.6K
schema tokens from this backend's rendering, producing a misleadingly low size.
Recall checks separately disable tools and use structured answers; these measure
a narrow factual recall sample, not personality or general conversational quality.

Image payloads are rehydrated from hash-checked artifacts. Recalled images may
have been re-encoded in the browser without saving the new bytes. The optional
`--allow-recalled-image-source` explicitly allows their verified source JPEG and
records the byte-length discrepancy; it must not be called a byte-exact replay.
Generated images still require matching captured payload lengths. Matching length
alone is not a cryptographic proof of equality to omitted wire bytes.

The first full-request trial was **rejected**: 61,507 input tokens became 56,053
with excerpts, or 54,061 with older image references. The latter remained 82.5%
of 65K. Single-sample recall scores were 9/12, 8/12 and 7/12 respectively. The
baseline itself missed three checks, so these are not proof that every miss was
caused by compaction. Nevertheless, the candidates did not demonstrate adequate
headroom or non-regressing recall. Nothing was installed. Failed checks and the
earlier misleading measurements remain saved as evidence, not overwritten.

This supersedes any inference that a large visible-transcript reduction alone
establishes enough full-request savings. Next work must address the complete
budget, preserve meaningful exchanges with their referents, and test continuity
before any future atomic live rollover. Automation is available; live overflow
recovery is still unfinished.

## Controller Folding And Follow-Up

Add `--fold-runtime` to compare the original against controller folding alone,
folding plus historical excerpts, and folding/excerpts with older image references.
The pure helper recognizes only the exact STS-emitted private envelope. It keeps
the latest `runtime` and `alone_ledger` sections and removes superseded versions;
search receipts, sensing text, idle-art records and unknown envelopes survive.
It refuses unfinished or unpaired tool operations, preserves the input and is
idempotent. No live code invokes it.

In the captured 65K overflow request, folding removed 22 obsolete sections and
reduced 100 messages to 81 without removing ordinary speech or tool receipts.
The final follow-up measured:

| Candidate | Native prompt tokens | 65K used | Answers | Exact quote sets |
| --- | ---: | ---: | ---: | ---: |
| Original | 61,507 | 93.85% | 12/12 | 11/12 |
| Superseded controller state folded | 53,226 | 81.22% | 11/12 | 11/12 |
| Folding plus reply-preserving excerpts | 50,218 | 76.63% | 12/12 | 11/12 |
| Above, latest two image payloads retained | 48,226 | 73.59% | 12/12 | 12/12 |

The final candidate saves 13,281 tokens (21.6%). All image files and provenance
remain; four older pixel payloads become explicit file references. The earlier
46,178-token candidate did not protect reply starts or mark each gap. It passed
the same narrow probes but is not the preferred renderer. Selections were sampled
again in the final run, so its size difference is not a controlled estimate of
the reply-preservation cost alone.

The individual probes correct the earlier interpretation of weak bundled recall:
the original history answers all 12 when asked clearly, one at a time. An inexact
quote is a different failure from a wrong answer. Folding alone still produced a
wrong image count, despite retained receipts; it is not independently admitted.
These checks do not establish preserved personality, broad memory coverage,
multimodal recall, or performance with tools enabled. Only token measurements use
native tool rendering. Results remain private under the 65K probe's
`wire-rehearsal-v3/` and `wire-rehearsal-v4/` directories.

Nothing is admitted live. The 73.59% candidate misses the conservative 70%
rehearsal target and leaves 17,310 tokens *before* B2 and generation allowances.
The target is a rehearsal guard, not a proven backend capacity law. Shared-slot
admission must account for B2, both outputs, growth during preparation and a margin.

## Chosen Live Boundary

The operator chose preparation at connection time instead of an automatic
mid-session cache rebuild. [Connection-Time Context Budget](connection-context.md)
now measures startup instructions/tools/runtime, reserves growth and shared-brain
headroom, and tries source-linked middle excerpts before opening the socket,
protecting the opening and newest history as described in that policy. Live history
then remains append-only. Near capacity, STS warns; the operator can save and
reconnect deliberately. The lab's controller folding and image-payload reduction
remain offline, not part of live request assembly.

This admits some branches that previously had too little room, but conservative
excerpts cannot fit every branch at every requested reserve. Failure is explicit;
raw sources and the previous loaded representation remain intact. A smaller
reserve, shorter branch or larger loaded window may be needed. Richer compact
memories and any future reconnect/rollover still need recall and live validation.

Full idle initiative, speech length, permissions and personality prompts are
unchanged. Resume does not activate live overflow recovery.

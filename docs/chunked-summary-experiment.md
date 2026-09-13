# Chunked Session Memory Experiment

September 11, 2026. Offline lab machinery, not the production preparation worker.
Auto history remains **sweeps only**. No existing session, sweep, summary or title
is replaced by this experiment. No models are downloaded or swapped.

## What Is Implemented

`src/robot_790d/summary_chunks.py` separates the work into bounded requests:

1. Parse the original session transcript using its existing turn structure.
2. Pack complete turns into roughly 4,000-character chunks. These are character
   targets, not measured tokenizer counts. Include two neighboring turns on each
   side for context. Each turn belongs to exactly one chunk; overlap is labeled.
3. Ask the current Qwen model for useful memory candidates from each chunk.
   Each candidate cites source turn IDs, including at least one owned turn.
4. Consolidate the candidates with their original source excerpts and adjacent
   turns available. Keep requests, reports, corrections, feedback and imaginative
   associations distinct in the prose.
5. Save an explicitly unreviewed draft, source index, requests, responses, usage,
   timings and source hashes. Do not install it into Eric's context.

The JSON input bound is 24,000 characters per request. Oversized individual turns
or evidence bundles fail explicitly instead of being truncated. Extraction and
consolidation have separate prompts and thinking settings; neither decides sweep
deletions or the session title. The compact consolidation variant asks for grouped
memory paragraphs rather than a shorter turn-by-turn transcript.

For long sessions, consolidation operates in bounded sections. It does not keep
recursively compressing summaries until the evidence disappears. A sectioned
result may still contain repetition between sections and may grow with session
length. Global deduplication, topic reconciliation across distant sections and a
fixed-size final memory are **not solved by this first pass**.

## Running And Resuming

From the repository root, with STS disconnected and its current model available:

```powershell
.\.venv\Scripts\python.exe -m robot_790d.summary_chunk_lab `
  notes/sessions/SESSION.txt --output logs/summary-lab/TRIAL --compact
```

Extraction defaults to thinking off; consolidation defaults to high thinking.
The configured output allowances are 4,096 tokens without thinking and 16,384
with thinking. These are experiment settings, not recommendations for live Eric.
`--no-merge-thinking` and `--extract-thinking` support comparisons. Use a fresh
trial directory for changed settings. `--extraction-from logs/summary-lab/OLD`
reuses matching extraction receipts to compare consolidation on identical inputs.

Rerun the same command to reuse completed stages. Source hashes and request hashes
prevent silently reusing work for a different source, model request or prompt.
Failed/truncated completions are retained as failure receipts, not successful
checkpoints. A source edit during inference prevents writing a final draft.
Run only one process per trial directory.

The runner checks the local STS pool before inference and every five seconds
during a request. An active connection stops new lab work and cancels the client
request; completed checkpoints survive. This is a cooperative lab guard, **not an
exclusive GPU lease**. It cannot detect unrelated LM Studio use or guarantee that
server-side GPU work stops immediately when HTTP is cancelled. Monitor failures
stop the experiment rather than assuming the GPU is available.

## Initial Results

Six drafts were tested on the two recent September 11 runs, each split into three
chunks. The original transcripts had 69 and 55 turns. Inference used the already
loaded `qwen3.8-27b-nvfp4-mtp` alias, temperature 0.2, without model swaps. No PM,
answer key or manually repaired summary was supplied to the model.

| Source run | Consolidation | Memory words | Model-call seconds |
| --- | --- | ---: | ---: |
| 13:38 | Detailed, thinking | 554 | 128.89 |
| 13:38 | Compact, no thinking | 363 | 18.56 |
| 13:38 | Compact, thinking | 457 | 106.86 |
| 16:36 | Detailed, thinking | 911 | 101.08 |
| 16:36 | Compact, no thinking | 547 | 23.45 |
| 16:36 | Compact, thinking | 582 | 117.42 |

Words count memory prose only, excluding source references and headers. Time is
the sum of extraction and consolidation calls, not live conversational latency.
The compact thinking trials reused the exact extraction outputs from their
no-thinking counterparts: new inference took 96.36 and 104.05 seconds respectively.
The table includes the original extraction cost for a comparable complete pipeline.
Other comparisons changed prompts and/or extraction samples, so they do not isolate
the causal effect of chunking or reasoning. The served alias and request settings
are recorded; this is not a cross-artifact or cross-model benchmark.

**Coverage improved.** The existing whole-transcript summary of the later run used
its twelve items before the late idle discussion. All three chunked drafts reached
the final turn, retaining both the circuit-geometry discussion and the subsequent
documents-and-silence association. This is semantic source review, not just a claim
that the whole input fit into a context window.

**Thinking helped consolidation, but did not make it reliable.** On identical
extraction candidates, the compact thinking pass corrected a serious speaker
confusion that the fast pass repeated. On the earlier run, it removed an invented
family relationship, recovered an initially unmet image request, and retained the
distinctive idea that matching the mismatched shoes would feel like a costume.
Meaningful affection and pending image-crop work survived in the later run.

**Remaining failures matter.** Fast consolidation produced false attribution,
invented relationships, unqualified implementation claims and a face/eye mix-up.
Thinking drafts were better but still sometimes promoted a spoken date or image
description to fact. One used "instead" in a way that suggested clearing the face
conflicted with leaving an image in the sensing eye; these are separate surfaces.
The later thinking draft retained unnecessary runtime/status chatter. Compression
and factual precision are both unfinished; valid citations did not prevent errors.

The conclusion is to **keep the chunking machinery, not enable summary loading**.
It addresses bounded processing and the missing-tail failure in these cases.
Next tests should add independent source-based coverage and factuality checks,
followed by longer held-out real sessions. A model-generated approval alone is
not an acceptance gate. The synthetic long-session tests below establish mechanics,
not semantic quality on multi-hour sessions.

Detailed local evidence lives under each run's `chunk-summary-lab-v1`,
`chunk-summary-lab-compact` and `chunk-summary-lab-compact-thinking` directories in
`logs/runs/`. These contain source turns, exact requests and responses, timings,
token usage, failure receipts if any, and uninstalled `summary.txt` drafts.

## Verification Limits

Source-ID checks establish provenance and valid structure, not truthful wording.
A model can cite the right lines and still confuse speakers or convert an offer
into a completed action. Every draft remains unreviewed until checked against its
source. No binary LLM judge automatically approves these outputs.

Tests cover complete-turn ownership and overlap, multiline turns, input bounds,
invalid citations, truncated output, source changes, checkpoint resumption,
source-bound extraction reuse, and live-Connect cancellation. A synthetic
1,500-turn transcript exceeds 300,000 characters; its maps and merge batches
retain all source coverage. A separate fake-provider end-to-end long-session test
verifies sectioned output without dropping evidence. These are machinery tests,
not proof of long-session semantic quality.

See [the summary research plan](summary-research-plan.md) for evaluation criteria,
independent verification, alternative models and future maintenance scheduling.

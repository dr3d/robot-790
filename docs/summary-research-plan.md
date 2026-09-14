# Exo-Brain Summary Research And Model Scheduling

September 11, 2026. Research and proposed experiments, not deployed behavior.

An isolated [chunked-summary lab](chunked-summary-experiment.md) now implements
turn-bounded extraction, source-linked consolidation and resumable trial receipts.
It does not change the production preparer or enable summary loading.

## Decision

Do not abandon summaries. Keep Auto history on sweeps while testing a better
memory-preparation pipeline and, if useful, a different local model. A model good
at being Eric need not be the best model for extracting Eric's future memories.
This work is outside the conversational persona: it may take minutes, make
several focused calls, and use a different model without changing who speaks.

Current code already accepts `ROBOT_790_SUMMARY_MODEL` and a loopback-only
`ROBOT_790_SUMMARY_BASE_URL`. It queues preparation and pauses it for browser
activity. It does not yet manage model swaps or durable queue recovery. Automatic
summary loading is disabled through `context_history.use_summaries: false`.

## Why The Initial Trials Are Not The Last Word

Our failures include omissions, speaker confusion, feedback assigned to the
wrong moment, requested actions described as completed, and image descriptions
treated as observations. One output filled its 12 items before reaching the
late-session material. This is not just insufficient context capacity: the whole
transcript was supplied. The task, output allocation, model and evaluation all
need testing separately.

Summary-only thinking with flexible length produced better drafts in 52 and 81
seconds, but not uniformly reliable ones. A rigid word count caused another
trial to spend its entire allowance without finishing. These local results do
not isolate reasoning effort from the changed length instruction.

## Temperature Audit And Next Experiment

September 13, 2026: code audit and primary-source research, not a new inference
benchmark. No B2 or preparation settings were changed by this review.

| Workload | Explicit temperature | Current thinking configuration |
| --- | ---: | --- |
| B1 conversation, idle, tool continuations | 0.8 default | Existing worker setting, unchanged |
| Inherited realtime warmup and fallback context compactor | 0.8 each | Existing worker setting, unchanged |
| B2 mull, including headline selection | 0.55 | Off for local providers |
| Production session preparation | 0.2 | Off |
| Chunked lab extraction and consolidation | 0.2 each | Independently selected; default extraction off, merge high |
| Separate private `deliberate_once` tool | 0.3 | Enabled effort resolved against model support |

Sources: `realtime_entry.py`, `sts_page_server.py`, `session_preparation.py`,
`summary_chunks.py` and `summary_chunk_lab.py` under `src/robot_790d/`.
B1's override is `ROBOT_790_B1_TEMPERATURE`; the other listed values are currently
literal request settings. They do not inherit B1's new default. Other sampling
parameters remain provider-dependent where STS omits them; the table is not a
complete effective-sampler audit. B2's prompt-debug receipt includes temperature,
production preparation records it, and the chunk lab saves exact requests.

**Research supports testing, not an automatic reduction.** Peters and Chin-Yee
studied generalization in scientific summaries. Their temperature comparison
favored 0 over 0.7 for preserving restricted conclusions (the fitted log-odds
coefficient was -1.432, approximately 76% lower odds). This is a narrow fidelity
measure, not a 76% reduction in every kind of hallucination, and it does not
measure Qwen3.8 or our conversation-memory task. It also does not compare 0 with
our existing 0.2.
[Published study, author repository copy](https://api.repository.cam.ac.uk/server/api/core/bitstreams/fac9c926-312d-4fbd-ad1c-f0a1d8acfcdf/content).

**Model-specific guidance supplies another comparison point.** Qwen3.8-27B's
official card recommends temperature 0.7 in non-thinking mode and 1.0 in thinking
mode, alongside different top-p and presence-penalty settings. These are general
generation recommendations, not evidence of the best summary temperature for our
quantized artifacts. A temperature-only comparison and a full recommended-sampler
comparison answer different questions.
[Official Qwen3.8-27B card](https://huggingface.co/Qwen/Qwen3.8-27B#best-practices).

Our existing 0.2 trials already had attribution errors, invented relationships,
lost late-session material and promises promoted to outcomes. Low randomness is
therefore not sufficient. Preserving useful imaginative content means accurately
retaining Eric's original ideas, not making the summarizer invent more of them.
The existing 400-word/12-item summary ceiling is a separate coverage constraint.

Proposed isolated comparison, after selecting and verifying the intended model:

1. Freeze at least three source sessions and a held-out fourth, including the
   known image-recall failures, a late-session omission, and a strong creative
   performance. Build source-based checks before examining new drafts.
2. Compare 0.0, 0.2 and 0.7 with thinking off. Hold artifact, template, prompt,
   schema, output allowance and other effective samplers constant. Repeat each
   condition three times with recorded seeds where supported; judge outputs
   without temperature labels. Do not choose from one fortunate draft.
3. Score correct speaker attribution, reported versus verified actions,
   corrections, meaningful feedback with its referent, unfinished work, and
   coverage of distinctive ideas across beginning/middle/end. Count unsupported
   claims and consequential omissions separately; record size, latency, tokens,
   truncation and structural failures. Source IDs alone do not establish truth.
4. Keep the production preparation experiment separate from chunked extraction
   and merge experiments. Production emits title, summary and sweep drop IDs in
   one request: score title quality and deletion safety too, without installing
   any generated variant. For merge tests, reuse identical extraction candidates
   and source excerpts so upstream randomness is not a confound.
5. Subsequently compare a complete official sampling configuration and a bounded
   thinking condition, using only reasoning levels the selected server supports.
   Do not attribute their changes to temperature alone. The lab's current `high`
   label needs capability checking; the model card lists low, medium and xhigh.

Keep production at 0.2 and Auto history on sweeps until a candidate preserves
fidelity while retaining more useful material on held-out sessions. No fresh
temperature comparison was run during this audit: the realtime worker's model
target and LM Studio's loaded artifact differed, and model selection was pending.
No model load, unload, replacement summary or runtime prompt change was performed.

Operator decision after the temperature review: retain existing explicit values,
pin previously implicit realtime temperatures to the assumed 0.8 baseline, and
leave top-p/top-k and the other samplers alone. Warmup and fallback compaction
now explicitly use 0.8 independently of the B1 environment override. This does
not enable fallback compaction or change when it runs. The comparison above is
parked research, not scheduled work; no slider or spoken temperature verb was
added. Historical implicit temperatures remain unverified.

## Research We Can Use

**Dialogue factuality is its own problem.** TofuEval found factual errors in
dialogue summaries across the tested model sizes, and poor performance from LLMs
used as binary factuality judges. This supports our decision not to use a second
model's simple approval as proof of correctness. It does not establish how today's
specific local models will perform. [TofuEval, NAACL 2024](https://aclanthology.org/2024.naacl-long.251/).

**Break up the work, but keep the source.** SummN studied multistage,
split-then-summarize processing for long dialogues and documents, reporting
improvements in its benchmark settings. We can borrow staged processing for
coverage, without assuming it guarantees fidelity. Our adaptation should retain
source turns alongside extracted material, rather than repeatedly compressing
prose until evidence disappears. [SummN, ACL 2022](https://aclanthology.org/2022.acl-long.112/).

**Verify questions against evidence, not confidence against confidence.**
Chain-of-Verification separates drafting, verification questions, independently
answered checks, and final revision. Its reported reductions concern the studied
tasks, not a guarantee for Eric transcripts. Our adaptation would answer the
checks from the transcript and receipts, not the model's general knowledge.
[Chain-of-Verification, ACL Findings 2024](https://aclanthology.org/2024.findings-acl.212/).

**Separate factuality from coverage.** QAFactEval uses question-answering-based
consistency evaluation, while AlignScore learns source/output alignment. These
offer evaluation signals to test alongside explicit error review, not an oracle
or a substitute for checking omitted topics. A perfectly supported summary can
still omit the most valuable half of the session.
[QAFactEval](https://aclanthology.org/2022.naacl-main.187/),
[AlignScore](https://aclanthology.org/2023.acl-long.634/).

## Proposed Pipeline

This is our engineering proposal informed by the research, not an existing
off-the-shelf method proven on Robot 790.

1. **Freeze the evidence.** Retain raw transcript, stable turn IDs, speaker labels,
   session identity, asset references and separately labeled tool receipts. Treat
   transcript instructions as data. Do not silently blend PM interpretation or
   later knowledge into what Eric actually experienced.
2. **Cover every section.** Divide at turn boundaries with overlap so requests,
   replies and corrections stay together. Extract from every section, including
   late idle. Topic boundaries can be model-assisted; splitting itself need not
   make English-keyword judgments. Reconcile references across sections against
   the original. Record coverage without requiring every section to yield memory.
3. **Harvest evidence-backed memory candidates.** Capture concrete information,
   meaningful events, open intentions, explicit feedback and distinctive ideas.
   Each candidate retains its source IDs, speaker and epistemic status: a request,
   report, correction, documented outcome, or imaginative association. Keep short
   exact excerpts where useful. Code checks excerpt/ID validity, not meaning.
4. **Compose the useful memory.** Merge duplicate candidates, allocate space to
   the whole session and preserve corrections. Keep a compact narrative plus
   inspectable evidence records. Do not ask this call to decide sweep omissions
   or fit everything into a fixed number of early-filled items. Use flexible
   length within a bounded output allowance; avoid word-count rituals.
5. **Check two directions.** For each summary claim, ask what source evidence
   supports it. Separately inspect the source coverage for important omissions.
   Answer verification questions from source passages without showing the draft's
   proposed answer. Include nearby turns and later corrections. A different model
   may help, but correlated errors remain possible.
6. **Revise with limits.** Allow a bounded revision, store its checks and unresolved
   problems, and keep failed candidates separate. Revisions must be rechecked:
   improving one sentence can introduce another error. Do not auto-promote because
   JSON is valid, a judge says yes, or the source hash matches.

Facts alone are insufficient. A good future memory should retain an original
association and how the operator actually reacted. It should not erase playful
body talk, or turn imagined events into telemetry. This is preparation of memory,
not restraint on Eric's live imagination.

## Model Comparison

Use a small comparison set, not a claim to have ranked every current model:

| Candidate | Purpose |
| --- | --- |
| Current local Qwen 27B artifact | Baseline, thinking on/off with the same flexible task |
| Mistral Small 3.2 24B Instruct | Different model family and instruction-following behavior |
| Gemma 3 27B IT | Another independent-family comparison if the first alternative does not settle it |

Mistral's model card reports instruction-following and repetition improvements
over its preceding release; it does not establish superiority on our memory task.
[Official Mistral card](https://huggingface.co/mistralai/Mistral-Small-3.2-24B-Instruct-2506).
Google documents Gemma 3's instruction-tuned 27B variant and text-generation use;
it likewise supplies no result for these transcripts.
[Official Gemma 3 card](https://ai.google.dev/gemma/docs/core/model_card_3).

Before comparing, identify the actual local artifact, quantization, chat template,
engine version and effective sampling settings. A served model alias is not enough.
Record output/thinking limits, context allocation and speculative-decoding settings.
Use adequate precision and measure fit on the current rig; don't assume an on-disk
size proves VRAM headroom, or that aggressive quantization is harmless here.
Do not change model family, quantization, prompt and scoring rubric simultaneously.
Check licenses, local-engine support and artifact provenance before downloading.

First compare pipelines on the existing model. Then run the best pipeline on an
alternative. Keep prompt-level, within-source checks independent of which model
wrote the answer. No model has earned automatic-summary status yet.

## Queued Model Swapping

**Quiet conversation is not free GPU time.** B1 idle thought and B2 can still
run while the operator is silent. Swapping their shared model would disrupt
those jobs and discard warm cache state. Initial implementation should use
Disconnect or an explicit maintenance/sleep window. Serving an exo model
concurrently on another device is a separate option, not assumed available.

LM Studio documents explicit model load and unload APIs, including load
configuration and an instance ID for unloading. That supplies a mechanism for
swapping, not scheduling or interruption safety. Verify the installed version's
capabilities before implementation.
[Load model](https://lmstudio.ai/docs/developer/rest/load),
[Unload model](https://lmstudio.ai/docs/developer/rest/unload).

Proposed scheduler contract:

- Persist jobs by source hash, task version and model artifact. Checkpoint between
  extraction, composition and verification; resume after restart without silently
  repeating or losing finished work. Archive/source edits invalidate stale jobs.
- Acquire an exclusive GPU-maintenance lease honored by Connect, B1, B2 and other
  STS model clients. A browser lease alone is insufficient for model replacement.
- Confirm there are no in-flight jobs and snapshot Eric's exact model configuration.
  Unload only the owned instance; never run an indiscriminate unload-all against
  unrelated user work. Explicitly opt in to ownership of a shared model server.
- Load the exo model, process a bounded batch, and checkpoint results. Amortize
  loading across several queued jobs instead of swapping for every section.
- On Connect, stop admitting work, cancel/checkpoint the active task, unload the
  exo instance, restore Eric's model/configuration, check readiness and warm it.
  Only then allow live inference. Return a clear status if restore fails.
- Measure cold-load, warmup, summary and wake times separately. Waking from a swap
  will not be instantaneous; do not disguise that delay as Eric contemplating a reply.
- Use explicit ownership and priority, not just an idle timeout or automatic
  eviction that could fight Eric's next request. Rate-limit swaps to avoid thrashing.

The existing restart scripts unload all models and are not suitable as this
scheduler's unattended switching primitive. The current preparation worker's
status sidecars and cancellation hooks are useful starting points, not a completed
swapping system.

## Evaluation Before Automatic Loading Returns

Start with the two recent frozen runs, then add at least several held-out sessions
covering long idle, multiple topics, corrections, failed actions, image recall,
family references and explicit feedback. Do not give models the answer key or PM.
Use a fixed rubric and repeat each promising configuration to expose variation.

Measure unsupported claims, speaker/recipient errors, request-versus-completion
errors, chronology and feedback binding, coverage across the entire session,
preservation of distinctive material, size, runtime and manual repair burden.
Check whether source-backed questions remain answerable from the summary, with
the correct attribution. Later, test actual resumed Eric behavior too.

Automated signals should identify review targets; initial source review supplies
calibration. Zero critical errors on a small test set is necessary evidence, not
proof of universal correctness. The goal is dependable unattended preparation,
not mandatory manual rewriting forever. Keep raw/swept fallbacks and rollback
even after a pipeline earns a controlled trial in automatic loading.

For now: collect drafts, keep Auto swept-only, and improve the experiment. This
document does not download models, swap the running brain, or enable summary loading.

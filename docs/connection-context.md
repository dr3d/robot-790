# Connection-Time Context Budget

STS now reserves room for a session **before connecting**. It does not shorten
the ongoing conversation, restart Eric automatically, or change his idle pace.
Refresh STS while disconnected, then use Connect normally.

## What Happens

1. Load the selected branch and current pinned notes as usual.
2. Count the assembled startup instructions, native tool definitions, STS voice
   wrapper and initial runtime using the selected loaded model's tokenizer and
   chat template. This check does not generate speech or run a prompt prefill.
3. Keep the loaded history unchanged when it fits. Otherwise, protect the opening
   and newest sessions, try source excerpts from the older end of the middle,
   remeasure after each session, and stop as soon as it fits.
4. Open the realtime connection only after the candidate passes. A failed check
   leaves the loaded source representation intact and reports the reason.

Excerpt selection uses the local LLM, in bounded chunks, before connection. It
selects source IDs rather than writing a paraphrase. The renderer copies those
passages, protects operator/System entries and the first reply after each
operator entry, includes adjacent context, and explicitly marks omitted spans.
It cannot guarantee retention of every valuable exchange. It does not use the
older, unreliable prose summaries. Cached selections are tied to source content,
model identifier and selection request; changed sources require new preparation.

Original notes, pins, timestamps, images and lineage are not rewritten. Core
notes and setup cards are not compacted by this mechanism. Existing card
admission and ordinary-note per-file limits still apply. Session history admitted
by the token budget bypasses the older transcript/aggregate character clipping.

## Which Sessions

Number retained sessions chronologically, oldest `0` through `Last`. Only sessions
`N` through `Last-M` are candidates for condensation. `N` defaults to `1`, keeping
the opening session in its loaded form. `M` is determined by the measured fit,
not a fixed number of recent sessions: stop condensing immediately when enough
space is free, leaving the newest possible tail intact. At least the newest
session is protected by default. If the middle is insufficient, Connect fails
explicitly without crossing those boundaries or installing a partial candidate.

For five sessions, condensation of session `1` alone means `N=1`, `M=3`:
`0 intact | 1 excerpted | 2, 3, 4 intact`. Pins and setup cards do not count as
sessions. Indices apply to the retained history being loaded; archived/missing
sessions are not resurrected. Source excerpts that are larger are not installed.

## Configuration

`config/runtime.json`, under `connection_context`:

- `history_start_index: 1` sets `N` (zero-based, oldest first).
- `history_min_recent_sessions: 1` sets the minimum permitted `M`, not its final
  value. Zero is allowed only by explicit configuration to remove that protection.

| Field | Default tokens | Purpose |
| --- | ---: | --- |
| `growth_tokens` | 32,768 | Minimum room reserved for new B1 conversation |
| `b2_tokens` | 6,144 | Allowance for B2 sharing the model |
| `output_tokens` | 2,048 | Shared generation allowance |
| `margin_tokens` | 1,024 | Startup accounting uncertainty |
| `warning_tokens` | 4,096 | Warn before the remaining growth room is exhausted |

`startup budget = loaded window - growth - B2 - output - margin`.
These are explicit policy allowances, not measured guarantees of backend slot
allocation or a fixed number of hours. In particular, B2 can outgrow its allowance.
The initial count is a tokenizer-based estimate; actual provider request usage
remains authoritative. Later images, tools, loaded notes and idle activity consume
the growth room. The CTX indicator turns amber near reserved headroom, and Events
records one warning. Save/disconnect and reconnect deliberately when needed.

Set `enabled` to `false` for the previous connection behavior. Restart the page
server after dependency/code changes; refresh STS after configuration changes.
The counter currently requires the selected model already loaded in local LM
Studio at port 1234. It never loads or swaps a model. Excerpt generation yields
to live STS use; partial completed chunks remain reusable after a canceled attempt.

## Verified Boundary

September 20 isolated browser checks, with no live conversation opened:

- Current loaded 128K window: the saved rich branch needs about 59.5K startup
  tokens, leaving about 62.4K for growth after the other reserves. No excerpts
  are needed, and the checks take about a second locally.
- Simulated 96K accounting: only session `1` of five is excerpted. The opening
  and newest three sessions are unchanged. About 54.6K startup tokens leave
  34.4K growth room, meeting the default 32K reserve (`N=1`, `M=3`).
- Simulated 65K accounting: empty Connect fits the default reserve. The rich
  branch still needs about 48.6K after condensing the three middle sessions.
  A 32K, 16K or 8K growth reserve is rejected without changing the loaded source
  context. The protected ends are not sacrificed to force a fit.

The simulated checks override accounting only, not the model's loaded window.
LM Studio settings were not changed. First-time excerpt selection under the
earlier unprotected policy took about 26 seconds for this branch; the middle-only
policy reuses those source-bound selections, with cached checks around 1-3 seconds. Other
branches may take longer or fail to fit. Source files remain intact in all cases.

Admission receipts are included in run-setup note accounting and Events. Private
excerpt caches live under `logs/connection-context/`; browser test results live
under `logs/runs/20260920-connection-budget/`. The `middle-policy/` subdirectory
records the protected-ends checks separately from the earlier allocation policy.

This is connection admission, **not live overflow recovery**. Richer compact
memories and an explicit reconnect/rollover path remain future work. The offline
[overflow rehearsal](context-overflow-rehearsal.md) is still available for that
work; its controller folding is not installed in live request assembly.

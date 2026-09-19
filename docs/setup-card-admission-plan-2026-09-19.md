# Complete Setup-Card Admission

Prepared September 19, 2026. **Admission repair implemented and offline-tested.**
The operator requested this and the idle-art handoff as separate repairs. This
document records the admission policy and its boundaries; the image repair is
described in [Idle Art](idle-art.md#handoff).

## Implemented Scope

- `Robot790NoteBrains.admit` validates the full candidate set before direct pin,
  reload or continuity restoration changes active snapshots. Defaults are eight
  cards / 32,000 rendered B1 UTF-16 code units, configurable in `note_cards`.
- Complete routed cards follow ordinary history in stable filename order. They
  cannot displace history or be evicted by ordinary pins. Private/shared limits,
  revision checks and B3/B4 inactivity are unchanged.
- Over-limit loads retain the previous set. Malformed routed pins fail thread
  restoration visibly; failed restoration does not change its lineage pointer.
  Read receipts distinguish file reading from activation.
- The existing safe session-update path is retained. No new atomic B1/B2
  provider-acknowledgement protocol or pending-transmission dashboard was added;
  diagnostics explicitly describe browser assembly, not provider consumption.
- Card wording, baseline prompts, full-context idle, sampling and timing are
  unchanged. Card-free prompt goldens match the prior committed formatter.

Offline tests cover oversized/exact-boundary and ninth-card rejection, Unicode,
ordinary-pin churn, history preservation, malformed restoration, revision/private
routing and previous-snapshot preservation. A connected companion/artist trial
remains the acceptance check for actual model behavior. No paid generation or
live inference was used to validate these mechanics.

Deployment: browser files are served from the updated source and need refresh.
The page-helper restart was blocked by the terminal tool, so its runtime-config
exposure and typed malformed-directive error remain pending. Browser defaults
still use the documented allowance until that restart. Do not call this complete
live acceptance or an already-running helper upgrade.

## Product Priority

Operator clarification, September 19: setup cards are optional ways to focus
Eric on a task, not the central development direction or a prerequisite for
companionship. Empty Connect, without a setup card, must already provide his
personality, curiosity, proactive engagement and useful B2 support. Do not move
those baseline qualities into a companion card or auto-load one to conceal a
weak card-free baseline.

This plan repairs an optional mechanism's correctness. It does not establish a
card framework as the architecture of companionship, and card-specific success
does not establish that the baseline companion works. Preserve and independently
exercise card-free first contact, developing conversation and active idle.
Runtime reliability defects that interrupt those shared capabilities remain
higher priority than expanding card features. The bounded work below should not
grow into a card-system redesign.

## Outcome

An explicitly routed note must reach each declared brain as a complete,
version-consistent instruction unit, or be visibly reported as not activated.
Loading another note must not silently displace a card. Preserve conversation
history and the full-context idle path; do not compensate with summaries,
behavioral classifiers, reduced initiative, or new rhetoric for Eric.

## Pre-Repair Mechanisms

- `src/robot_790d/note_brains.py` parses the exact opening `## STS NOTE 1`
  marker. It separates B1, SHARED and explicitly declared B2-B4 sections and
  hashes the complete parsed document into a revision. SHARED and B2-B4 each
  have a 1,200-character validation limit; B1 has no equivalent parser cap.
- `web/sts/note-brains.js` assembles the B1 view and selects stable filename-
  ordered private packets. Its per-brain selection silently slices to eight.
  B3/B4 remain inactive destinations, not workers to launch.
- `web/sts/index.html` clips ordinary B1 note views at 4,500 characters and
  allocates a 64,000-character aggregate note section, reserving core memory.
  History can consume the remainder before later cards are reached.
- B2 guidance comes from loaded snapshots independently of that B1 admission
  result. Pinned, admitted to B1 and supplied to B2 are different things today.
- Direct pinning applies an eight-note replacement policy, with reservations
  for core/current-session notes. Continuity restoration bypasses that count
  and may restore more notes. Both routes need the same declared-card policy.
- Current admission diagnostics accurately expose partial/omitted B1 assembly;
  they do not prevent it or prove transmission to the inference provider.

Important qualification: raw card length is not B1 prompt length. The current
companion card has 5,400 source characters but a 4,278-character routed B1 view;
willing-artist has 4,867 source characters but a 3,916-character B1 view. Both
fit the existing per-file limit. All eight current routed cards have B1 views
between 2,328 and 4,278 characters, totaling 24,731 before file wrappers.
Aggregate omission and independent brain routing still need repair. This is
not a retrospective claim that those cards were per-file clipped last run.

## Accepted Policy

1. **Only the explicit marker opts in.** Do not infer instructions from a
   filename, folder, English wording, or a quoted section heading. Unmarked
   notes retain existing behavior. No card wording changes are part of this work.
2. **Separate bounded instruction space.** Leave the existing history/ordinary-
   note allowance intact. Initial defaults: at most eight active routed
   notes and 32,000 characters for their complete rendered B1 section, including
   labels and wrappers. Keep the existing private-section limits. Put settings
   in the existing runtime configuration, with validation, not new UI dials.
3. **Never clip a declared instruction unit.** Validate the entire proposed
   active set before mutation. Oversize, malformed or over-count loads return
   an explicit receipt identifying the unmet limit. They do not evict another
   card, truncate it, or replace a working version with half of an edit.
4. **No automatic card eviction.** Ordinary-note reads cannot remove active
   cards or consume their slots. Explicit unpin/replacement remains available.
   Ordinary-note replacement behavior is otherwise out of scope.
5. **One committed revision set.** B1 assembly and B2 guidance derive from the
   same admitted snapshot set. Reject invalid updates for the entire card, not
   just one recipient. A B2-only note is valid: an empty B1 portion is not a
   failure. Preserve SHARED opt-in and private-section isolation.
6. **Visible reconnect failures.** Preflight the restored card set before
   starting the conversation. An invalid/over-budget set must not silently
   activate a subset. Report which cards need editing or explicit unpinning;
   keep the saved source and selected thread intact. Do not partly start B2.

The 32K allowance fits all eight current cards with headroom. It is a bounded
character allowance, **not** an exact token limit or assurance that every model
has enough remaining context. It deliberately permits a larger prompt rather
than paying for cards by removing previously admitted history. Preserve any
existing overall context-limit failure handling; do not add automatic eviction.
This separate budget/count policy is the substantive assembly change; it is not
a new personality instruction or a reason to require cards for companionship.

## Implementation Boundaries

- Extend the existing note-routing helper with a pure admission operation if
  that removes duplicate decisions. It should return admitted snapshots plus
  structured receipts, without scheduling a brain or interpreting note meaning.
- Apply it to direct pin/read, card reload, Connect/Connect Previous, explicit
  continuity restoration, session-map entry, unpin and reset. Verify every
  caller before changing a shared function's failure/return contract.
- Keep ordinary history in its current ordering. Put the complete routed-card
  block after the history block and before the embodiment manual; the manual
  remains last. Do not reorder cards or rebuild stable prompts on ordinary turns.
- Apply live card-set changes through the existing safe update boundary.
  Account for B1 session-update acknowledgement and B2 in-flight work: a local
  snapshot change is not proof that both providers already consumed it. Preserve
  revision-based invalidation of pending B2 advice. Do not promise to erase
  already delivered dialogue or private advice from the conversation.
- Keep disk editing semantics unchanged: explicit reload, reconnect or restore
  picks up the edited file. No new per-turn filesystem polling or hot reload.
- Extend existing memory/context views and tool receipts with active, rejected
  and pending status, revision, recipient and budget counts. No private B2-B4
  text in B1 tool results or diagnostics. No new dashboard or sampling controls.
- Make `read_text_file` distinguish successful file reading from failed card
  activation. Do not say it is active merely because the file was readable.

## Test-First Sequence

1. Add fixtures proving the current faults: an oversized B1 card loses its
   tail; rich history omits a later card while B2 still receives guidance; a
   ninth direct pin can remove a card; restored and directly pinned sets differ.
2. Add pure admission tests: exact budget boundary including wrappers, multibyte
   text and consistent character units, malformed directives, eight/nine cards,
   duplicate files, empty/B2-only cards and oversized updates preserving the
   previous complete revision. Reserved markers remain structural, not language
   interpretation. Current Python/JS character-count differences need an explicit
   convention in the new limit rather than an accidental Unicode discrepancy.
3. Wire lifecycle and prompt assembly. Verify no-card legacy prompt goldens stay
   identical; routed cases intentionally change and receive new expected output.
   Already admitted ordinary/history content must not shrink to accommodate cards.
4. Verify B1/B2/private routing, edit/reload/unpin invalidation, inactive B3/B4,
   failed provider updates, reconnect, session jumps and cancellation. Ensure an
   unadmitted card cannot produce current B2 guidance or a false success receipt.
5. Verify prefix behavior: ordinary turns produce no new session.update;
   unchanged card packets are stable; changing a card preserves the earlier
   history prefix; changing bodies still changes only the manual suffix.
6. Run the full affected regression suite, then deploy only at a disconnected
   boundary. Compare a fresh card-free session and a rich continuation with the
   companion and artist cards. Check assembled/sent revisions and cache metrics,
   not Eric's verbal claim of remembering a card. Image-handoff acceptance is
   a separate trial after that defect is repaired.

## Preparation Baseline And Stop Points

Read-only preparation was against HEAD `6c3c262` plus the existing dirty repairs.
Do not reset that work or conflate this patch with the idle-art repair. During
the original read-only preparation no server was restarted and no card, prompt,
runtime configuration or production code changed.

Focused baseline: 21 JavaScript tests passed across `sts_note_admission`,
`sts_note_brains` and `sts_context_order`; 21 Python note-routing tests passed.
These establish the current behavior, including its limitations, not the proposed
repair. Some clipped-card golden expectations are intentionally obsolete once
the repair is implemented; unmarked-note expectations remain backward compatible.

Stop and reassess if implementation requires dropping history, changing public
speech ownership, activating another brain, inventing semantic priority rules,
or weakening asynchronous freshness checks. Those are outside this work package.

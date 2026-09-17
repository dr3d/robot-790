# B2 Companion Advisory Trial

September 17, 2026. Follow-up to the 09:38-10:15 Grandma/cloud session.

## Scope and Intent

This is an explicit **B2 prompt change**, not a deterministic behavior filter.
The previous instructions welcomed curiosity but B2 repeatedly recommended
closure. Its immediate task prioritized a mouth-display fragment; both loaded
setup cards ended with guidance to let completed work stand. These are plausible
contributors, not proof of a single root cause.

Changed only B2's role/task/advisory wording in `sts_page_server.py` and the B2
sections of `notes/setup-cards/impossible-science.txt` and `willing-artist.txt`:

- Thinking partner first; optional mouth display second.
- Completing one answer does not end independent activity.
- Assessments of completion/repetition belong in private `reason`/`steering`;
  `note_for_eric` carries useful content, an unfinished request, a factual
  correction, or an actual operator instruction.
- No useful contribution means empty advice, not an instruction for B1 to wait.
- Explicit user quiet requests still take precedence.
- A completed picture need not be reworked; other interests remain available.

B1's prompt/personality, one-sentence default, idle timings, full context,
sampling parameters, tool orchestration and output filtering were not changed.
No English behavioral classifier, mandatory topic, forced tool call, or new
silence mechanism was added. The two cards are git-ignored personal note files;
their pre-edit copies are preserved with the replay artifacts.

## Evidence and Limits

Artifacts: `logs/runs/20260917-b2-companion/`. `replay.py` calls the real local
B2 implementation with reconstructed latest-run transcript windows, the two
actual cards, recent B2 advice, and explicit successful image receipts. These
are bounded fixtures, not captured provider requests. Attention is set to
independent. Four cases each use two requested seeds at unchanged temperature
0.55: completed rescue, accumulated closing advice, repeated furniture passage,
and a synthetic explicit quiet request. No tools, art, audio or B1 turns execute.

- `before.json`: closure/quiet advice appears in the closing and repetition
  fixtures; other opportunities often produce empty notes.
- `after.json`: first role/card revision still produces closure instructions.
  This was insufficient and was not treated as successful validation.
- `content-not-verdict.json`: after separating assessment from advisory content,
  both completed-rescue replies propose the aftermath in the car. Closing cases
  offer a move onward, although those suggestions remain fairly generic. One
  repetition case proposes a lamp/grievance consequence; the other abstains.
  Both explicit-quiet replies pass along the user request without inviting speech.

Residual problems are visible even in the improved fixture: an invented staging
time, speculation about a controller echo, and invalid diagnostic evidence IDs
in the explicit-quiet case. Existing validation rejects those IDs. This trial
does not fix stale execution-state advice or establish sustained B1 behavior.
No automated semantic pass score or guarantee of live recovery is claimed.

137 focused page-server/note-routing tests pass, including prompt-contract and
unchanged English/Spanish advisory passthrough tests. The latter use mocked
model output; they do not demonstrate multilingual model performance.

## Deployment and Next Run

Only the STS page server was restarted. Live `/api/brain2/mull` returned HTTP 200
and confirmed the new system instructions and both on-disk B2 card sections.
Its bounded test reply proposed correcting the bounce direction in the rescue
plan, rather than closing the topic. Realtime, Browser Face and LM Studio were
left running; no model switch or reload was performed.

Refresh while disconnected, then **Connect latest** to continue
`session-20260917-101518-661.txt` with its rich history and refreshed cards.
Try one new impossible problem with draw/eye/explanation, then leave him idle
for 5-10 minutes at the same lab speed. Observe both B2 advice and B1 behavior.
Do not start empty for this comparison: removing the history would change two
variables. Promise-to-action and the startup scheduling boundary remain separate
work items, not fixes delivered by this trial.

## First Live Result

The recommended rich continuation ran 12:46-13:10 on September 17. Draw -> eye ->
explanation completed without a reminder; 26 idle turns developed one memory-jar
premise with multiple specific B2-to-B1 transfers. No repeated holding-quiet loop
appeared. After about 22 minutes without user input, Eric returned promptly and
summarized the evolved idea rather than restarting the original answer. Lab speed
changed during the run, reaching 12x, so this is not an isolated pacing comparison
or proof of universal recovery. No further runtime changes followed this PM.
Full evidence: `logs/runs/20260917-131021-memory-jar-companion/postmortem.md`.

# Quiet Turns and Tool Denials

Implemented and corrected September 17, 2026.

**Superseded later September 17:** the subsequent live run still repeated silence
announcements. The wait tool described below has been removed; scope-denial
protection remains. See [current repair and verification](idle-quiet-loop-repair.md).
The remainder records the intermediate implementation, not the current contract.

## Intent

Eric should have an active mind during idle, using full conversation context to
explore, research, draw and talk. The problem was exact repeated sentences and
denied-tool retry chains, not talkativeness. Silence must not disable cognition.

## One Turn, Not an Indefinite Hold

`wait_silently` ends only the current turn without a spoken confirmation. It
returns `scope: current_turn`, `idle_continues: true`, and
`automatic_followup: false`. The normal response/playback completion path
schedules subsequent full-context opportunities at the configured idle pace.
No new user input is needed. Both brains and their ordinary output routes remain
available; no persistent wait state, wake timer or special B2 mute remains.

The schema exposes only an optional `reason` for the event log, not spoken text.
The handler accepts historical valid `duration_seconds` arguments but does not
honor them as pauses. A nonzero legacy duration is reported as ignored. This
prevents older context from recreating an indefinite or day-long hold. Current
instructions explicitly say the tool is not a timed-pause facility.

Existing playback is not cut off. Existing disconnected, busy, user-turn and
permission checks remain. Idle-off remains idle-off. A quiet choice is not a
command to immediately generate another response; the ordinary scheduler owns
the next opportunity. Its lab-speed setting still applies.

## The Overcorrection

The first version allowed duration zero to park B1 until user input and kept B2
mulling while muting its optional output. In the 08:22-08:29 run, a successful
illustrated answer was followed by just one idle request. At 08:25:42, Eric chose
that indefinite wait. Even changing to 5x could not generate another B1 turn.
B2 had found a fresh headline at 08:25:31. This behavior contradicted the user's
goal and was removed, not merely given a shorter timeout.

PM: `logs/runs/20260917-082918-idle-silence/postmortem.md`.
Earlier repetition PM: `logs/runs/20260917-011514-idle-repeat/postmortem.md`.
Earlier local wait probes validated the old behavior only and are not evidence
for the corrected live experience.

## Denials End the Automatic Chain

A capability denied by the current execution scope returns a structured receipt:
`code: scope_denied`, `retryable: false`, scope and allowed tool names. It does
not execute or trigger a generic followup. Sibling results already in flight
still arrive, but the batch does not automatically restart. Terminal state
resets for a new user turn or scheduled opportunity, not another completion poll.

A per-tool/scope ledger carries still-applicable denials into the next idle
instructions. New user input or session reset clears it; newly permitted
admission removes the corresponding denial. A future model request could still
choose the rejected call, but it cannot cause an automatic retry chain.

Every ordinary tool continuation repeats its actual execution scope. The full
catalogue remains stable within the session for prefix reuse. This grants no
extra capabilities. Recoverable failures still allow model-chosen recovery.
`stop_standing_routine` controls an explicitly started routine, not ordinary idle.

## Disclosed Prompt Changes

Tool descriptions and idle/followup instructions now explain single-turn silence
and that completing an answer need not end independent activity. They preserve
model choice of ideas, tools and speech. Eric's identity, setup cards, model,
sampling and lab pace are unchanged. No English phrase blacklist, similarity
censor, chatter quota or prescribed spoken line was added. B2 advice remains
advisory; this change does not revise its cards or guarantee fresh model prose.

## Verification and Deployment

437 JavaScript tests pass. Regression coverage exercises twenty consecutive quiet
turns at each of 1x, 5x and 7x through the production completion and scheduling
functions; each produces the next B1 opportunity without user input. Tests also
cover legacy durations, no B2 mute, playback drain, stale-session callbacks,
scope denial, mixed tool results and normal tool recovery. These are fake-clock
controller tests, not a long live model replay. Python backend was unchanged
from its earlier 771-test pass.

Refresh disconnected STS before reconnecting; no backend or model restart.
Connect Previous, ask one illustrated impossibility and leave idle at 5x.
Check for continuing opportunities, tool activity, fresh speech and no recurring
exact-sentence loop. A model may still choose several quiet turns; this repair
removes STS's permanent hold, not all possible behavioral failure modes.

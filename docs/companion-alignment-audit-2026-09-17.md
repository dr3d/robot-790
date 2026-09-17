# Companion Alignment Audit

Follow-up: the 08:52-08:58 continued run invalidated the single-turn wait repair.
The [latest quiet-loop repair](idle-quiet-loop-repair.md) removes that experiment
and addresses the recent B2 advisory transport. Findings below describe the audit
at its original checkpoint, not a claim that the intermediate repair succeeded.

September 17, 2026. Analysis of checkpoint `74312a6`, agency removal `4273e16`,
the current uncommitted repairs, actual prompt sources, loaded setup/boot notes,
and the two September 17 idle PMs. No runtime, prompt, sampling, note-content,
hardware or server changes were made during this audit. Documentation and
offline characterization probes only.

## Corrected Scope

The operator clarified that this review is about recent changes, not redesigning
older behavior that has worked well. The initial audit exceeded that scope.
Use `74312a6` as the pre-agency-change baseline and review `4273e16` plus the
subsequent uncommitted repairs. Older observations below are retained as research,
not an approved repair roster or evidence of recent regressions.

The scoped concerns are the new indefinite wait (already removed), new
batch-wide denial termination, and a freshness check lost in the recent B2
advisory rewrite. Check consistency when new tool contracts meet existing prompts;
do not use that as justification to rewrite the established personality.

Git history confirms that question dropping during busy audio dates to August 31
and ordinary-note clipping to August 27. They do not belong in this repair pass.
The longstanding one-sentence default remains explicitly protected.

Preservation target clarified by the operator: retain Eric's successful active
idle, B2 assistance, occasional headline browsing and established prompts for
connecting dots and finding relationships beyond setup notes. Validate both
card-free Connect Empty and continued sessions. A recent removal of controller
topic selection must not accidentally remove Eric's general encouragement to
associate and explore; check that prompt delta without restoring a topic planner
or redesigning older working behavior.

## Verdict

The operator's concern is justified. The project goal was already recorded as a
companion-shaped presence, but several fixes optimized a local symptom rather
than preserving initiative. Most clearly, the indefinite wait stopped repeated
speech by stopping B1 opportunities. Its tests proved that it stayed stopped;
they did not prove that Eric remained a useful companion. That was the wrong
acceptance criterion, not merely an unfortunate timer value.

That hold has now been removed. The remaining recent changes warrant checking
the scope of denial termination and the changed B2 advisory freshness contract.
Broader architectural observations do not establish that those older mechanisms
caused the recent failures and do not authorize replacing them.

The durable target and review checklist are in
[Eric's Companion Design Contract](companion-design-contract.md).

## Findings

### 1. The indefinite wait directly contradicted the goal; its correction is necessary but limited

**Observed failure, corrected before this audit.** In the 08:22-08:29 run, Eric
completed draw/eye/explain. At 08:25:42 the first idle turn called `wait_silently`
with duration zero. STS stopped B1 until another accepted user utterance. B2 had
already selected a fresh headline. Increasing lab speed could not override the
hold. It remained until disconnect at 08:29:18.

The corrected [waitSilently](../web/sts/index.html#L10447) returns only a
current-turn yield. Persistent wait state and B2 mute gates are gone. Full-history
opportunities continue through ordinary scheduling. Keep that correction.

**Remaining limitation:** it supplies opportunities, not a continuing idea by
itself. The model can choose the yield repeatedly. Repeating tool-only yields
does not itself create fresh B2 evidence. Neither forcing speech every tick nor
adding another indefinite hold is an acceptable substitute for useful initiative.
Do not describe this as a completed private-thinking subsystem: B1 currently
speaks, uses tools, or yields; no separate durable private-interest channel was
added. The user welcomes thinking aloud, so such a subsystem is not a prerequisite
for useful repair.

Evidence: `logs/runs/20260917-082918-idle-silence/postmortem.md` and
[quiet-turn implementation](silent-wait-and-tool-denials.md).

### 2. The actual prompt still contains conflicting assistant-like restrictions

**Legacy observations: excluded from the current repair pass.** Only consistency
with newly changed tool contracts remains in scope; the broader prompt/boot-note
rewrite recommendation below is withdrawn for this task.
The live `/api/runtime-config` returns `prompts/robot-790-realtime-system.md`.
[Prompt assembly](../web/sts/index.html#L7413) uses that file instead of the
JavaScript fallback. Recent edits to the fallback did not revise the file.

- [Line 52](../prompts/robot-790-realtime-system.md#L52): the older routine-stop
  instruction still includes leaving the room quiet. The revised tool description
  correctly says this tool is not an ordinary-idle stop. Those sources disagree.
- [Line 138](../prompts/robot-790-realtime-system.md#L138): file tools, including
  read/list, require an explicit user request, although ordinary idle permits
  `read_text_file` and `list_text_files` for model-directed exploration.
- [Line 42](../prompts/robot-790-realtime-system.md#L42) discourages tools in
  ordinary conversation; many face rules are phrased solely as responses to a
  request. This is narrower than expressive, self-directed companionship.
- [Line 98](../prompts/robot-790-realtime-system.md#L98) prescribes a two-beat
  transition. The local `notes/boot_eric.txt` source also mixes short-answer,
  quiet-presence and "then stop" guidance with real encouragement to participate.
  Not all of that source actually survives loading, as described below.

**Operator clarification:** preserve the longstanding one-sentence default at
[line 4](../prompts/robot-790-realtime-system.md#L4), including its existing
response-length guidance. The operator explicitly excluded it from this repair.
The initial audit wrongly grouped it with passivity findings without establishing
that it caused them. Response length and willingness to initiate are separate;
do not change this default as part of companion-alignment work.

**Additional verified loading defect:** the resumed boot note has 12,076
characters, but [clippedLoadedNoteContent](../web/sts/index.html#L6790) admits
only the first 4,500 plus a clipping notice. The early two-short-sentence rule
survives; the later "Autonomous Participant Loop" and "Participant Work" sections
do not. Their absence was reproduced through the actual clipping function.
This does not establish that no historical transcript ever quoted those sections;
it establishes that the pinned boot-note block does not deliver its full
instructions. A save receipt reporting the source file size is not proof that
the complete contents reached B1. The later quiet-presence guidance is likewise
not evidence of an active boot instruction when clipped out.

The Impossible Science card positively supports invention and development. Its
B2 ending also allows a finished answer to stand. That is reasonable in isolation,
but in combination with the above it can be read as awaiting another assignment.
The latest B2 notes repeatedly advised waiting for a reply. Prompt influence is
a plausible contributor, not a measured causal attribution for each sentence.

**Original broader recommendation, now out of scope:** reconcile the real base prompt, fallback, boot note and routed
cards under the companion contract while preserving existing response-length
guidance. Separate permission to explore from permission for consequential
effects. Instruction-bearing notes should fit intact, be deliberately structured
into complete units, or visibly fail admission; arbitrary mid-note truncation
must not silently change their meaning. Do not simply raise every note limit and
recreate a context explosion. Do not append one more contradictory paragraph or
silently rewrite user notes. Show changes and verify assembled B1/B2 prompts.

### 3. Useful B2 questions are discarded when the mouth is busy

**Inherited behavior, not a recent regression; no change in this pass.** Git
blame dates the busy-question branch to August 31. The reproduction establishes
current behavior, not that a recent change caused it or that it should be replaced.
[triggerBrain2Mull](../web/sts/index.html#L11903) tests
`brain2UserPresentButBusy()` before adding a question candidate. That condition
includes Eric's own response generation and audio playback. On the busy branch,
the question is logged as "held" and added to B2's recent-output list, but never
queued for B1. The latter list is supplied to B2 as material to avoid repeating.

**Offline reproduced with actual functions:** identical B2 result during playback
produced zero question candidates; without playback it produced one. This does
not prove a particular live missing question, but proves the loss path exists.

The mouth-display branch already has a separate deferred path. Private questions
do not need the mouth now: conflating proposal retention with permission to speak
works against exactly the proactive engagement the operator wants.

**Parked suggestion, not part of this repair:** retain evidence-bound private questions during playback; allow B1
to evaluate them at a later normal opportunity. Discard when genuinely stale, not
merely because audio is playing. Never require B1 to ask every saved question.

### 4. Denial handling prevents retries by ending too much work

**High-priority risk introduced by the latest repair.**
[Scope denial](../web/sts/index.html#L18707) sets a batch-wide terminal flag.
[Continuation](../web/sts/index.html#L18778) then ends the whole automatic chain,
including cases with successful sibling receipts. The same rule applies in a
user conversation, not only idle. Tests explicitly confirm this behavior.

This correctly prevents the previous denied-tool feedback loop, but can also
prevent Eric from interpreting a successful search, explaining a limitation, or
choosing another permitted approach. He gets another opportunity at a later idle
tick, if enabled; that is not the same as completing the current shared task.

**Correction:** retain typed, non-retryable denials and bounded work budgets, but
scope the retry prohibition to the rejected capability. Permit a bounded
model-chosen recovery or explanation with successful receipts intact; terminate
repeated unchanged denial rather than every first denial. This needs a designed,
tested transition, not restoring the old unbounded generic retry.

### 5. Old B2 advice can remain labelled current after its moment has passed

**Split finding: inherited note retention versus a recent assessment regression.**
At `74312a6`, advisory prose already retained old note candidates, but the separate
structured assessment selected only an item newer than `lastUserTurnActivityAt`.
The `4273e16` rewrite serializes every selected candidate including its steering
object without that age-relative-to-user-turn check. Removing rhetorical commands
was intentional; losing this specific assessment freshness boundary was not
necessary to do so. Review that narrow delta rather than redesigning note retention.

[formatBrain2AdvisoryContent](../web/sts/index.html#L7360) checks note-guidance
revision and takes the last four candidates in each category. It does not require
that a candidate's user turn, assistant output or age match the current situation.
[New user text](../web/sts/index.html#L12863) does not clear those candidates.
The snapshot calls them "Current private B2 snapshot."

**Offline reproduced:** an hour-old "wait for the next reply" suggestion remains
in that current snapshot after a newer user turn. Historical advice already in
conversation is a separate issue; the avoidable problem is repeatedly promoting
old advice as current. The model is told it may ignore it, but the representation
still gives it unnecessary authority.

**Scoped correction to consider:** preserve the established note retention while
preventing the recent serializer from presenting pre-user-turn steering as a
current assessment. Do not introduce a new blanket expiry policy for old ideas.

### 6. B2 is not the autonomous continuity partner we sometimes described

**Architectural observation, excluded from current repairs.** [brain2BlockedReason](../web/sts/index.html#L7957)
skips ordinary mulls when its evidence fingerprint has not changed. B2's own
thoughts do not change that fingerprint. A separate headline route occasionally
adds outside evidence. This prevents repeatedly critiquing the same utterance,
but it does not implement sustained private exploration.

The browser supplies 18 recent transcript rows; the
[server evidence projection](../src/robot_790d/sts_page_server.py#L1657) retains
12 rows of up to 400 characters each, plus latest user utterance, limited receipts
and routed note guidance. Rows are streamed sentence chunks, not whole conversational
turns. One long answer can occupy most of the window. Earlier activity and intent
can disappear even though the final user question is retained separately.

The [B2 role](../src/robot_790d/sts_page_server.py#L1841) still centers a tiny
mouth-display aside and recent-output assessment. It explicitly supports playful
variation and says quiet is not the default cure, so it is not simply an anti-fun
prompt. Nevertheless, it has no persistent, structured activity/interest state
or direct general research tools. Temperature is explicitly 0.55; the problem is
not an unidentified sampling default.

**Parked design direction, not this task:** first improve activity evidence and proposal delivery. Then decide
whether B2 is an advisor for B1's ongoing interests or also an independent explorer.
For either, maintain a model-authored, evidence-linked activity state rather than
inferring it from English intention phrases. Do not substitute B2's thin context
for full-context B1 idle or blindly feed B2 an entire transcript to fix this.

### 7. Ordinary idle still excludes some useful low-impact capabilities

**Existing policy; preserve it in this review.** The
[idle allowlist](../web/sts/index.html#L3664) admits search, weather/time/status,
body sensing and note read/list. A live idle-art grant adds generation and eye
staging, independently of B2 being enabled. That recent expansion is beneficial.

But visual-note lookup/recall, pinned-note inspection, private note writing,
memory saving and B1 face expression tools are not admitted in ordinary idle.
Permission for a new image does not grant recall of an old one. The stable full
catalogue is still visible to preserve cache, making accurate scope descriptions
and usable denial recovery especially important.

**Parked design direction, not this task:** declare a companion capability policy separating inspection,
sandboxed reversible notes, simulated face expression, paid media, physical motion
and external side effects. Reassess read/recall and simulated expression first.
Do not fix passivity by globally enabling chassis movement, smart-home control,
publishing or destructive writes. Session transcripts already preserve activity;
the gap is selective model-authored continuity, not a claim that nothing is saved.

### 8. Lab speed is not a speed multiplier for the whole mind

**Existing pacing explanation, not a request to retune it.** Ordinary B1 delay and gap
respond to lab speed. The attention/discovery clocks use real-time windows;
audio ownership waits for real playback. B2 has a 14-second real floor. Headline
reading starts after two real minutes and normally fetches at ten-minute real
intervals ([constants](../web/sts/index.html#L3876)). Faster idle does not accelerate
all of these.

At drift 7 with repository defaults, settled B1 base delay is approximately
112.5 seconds at 1x and 22.5 at 5x, after the activity anchor and subject to busy
checks. That is a scheduling opportunity, not promised speech onset. Long answers
add their playback duration. These numbers alone do not explain the latest
3m36s parked interval; the removed wait does.

Keep single-mouth ownership. Broader background work while speech plays would
need explicit output queuing and resource arbitration, not overlapping B1 audio.
Expose why a next opportunity is blocked in existing diagnostics, not new opaque
dials. Slow rates should be chosen for the companion experience, not assumed good
because they reduce GPU work.

## What Is Aligned and Should Stay

- Full-history B1 idle, shared assistant/tool write-back and temporary instruction
  tails preserve continuity. Image retention and no duplicate staged-image resend
  protect prefix reuse; they do not decide what Eric should think.
- Paginated, queryable note filenames and projected B2 metadata prevent accidental
  context explosions without removing conversational substance. The formerly
  serialized full B2-card freshness metadata should remain excluded from B1.
- Generic model-led search/draw/show continuations replaced a controller-written
  workflow. Current successful illustrated answers support keeping that direction.
- Tool-call IDs, generation/session freshness, retained late artifacts, receipts,
  real playback drain and unknown-paid-outcome protection are execution safeguards.
- Marked private-protocol and explicit thinking-tag filtering protects voice/history
  channels. It is not a prose classifier for imagination. Untagged private text
  remains a limitation; do not respond by suppressing ordinary imaginative speech.
- B1 can now make authorized idle art without needing B2 approval or a picture
  quota. B2 can separately propose it. Keep actual external-effect permission.
- The agency removal stopped English consent classifiers, deterministic topic
  selection, scripted tool confirmations and prose-triggered loop penalties.
  Repetition should not be used to reintroduce those indirectly.

## Dead Code and Misleading Descriptions

The page still contains old lane definitions, phrase-based self-task parsing,
similarity helpers and loop-pressure instructions. In the normal attention-enabled
idle path, they do not select behavior. The positive assignments that once set
the semantic cooldown/hard brake are gone; the current assignments reset to zero.
The performance mode is explicitly disabled. Do not blame those remnants for
today's hold or claim they are live merely because a search finds their names.

There is still a legacy re-engagement path under alternate settings, with a
one-sentence no-tool prompt and out-of-band context. It is disabled by the normal
attention ramp, not universally removed. Leave it unchanged in this recent-change
review. Older pacing docs also describe
discovery lanes and automatic loop brakes that the agency removal disconnected.
Documentation and controls should clearly identify active versus retired behavior.

## Repair Order

1. Preserve the current removal of indefinite wait; do not retune temperature,
   model, history loading or answer length to obscure this regression.
2. Narrow the new terminal-denial behavior without restoring its retry loop;
   verify successful sibling results and permitted alternatives remain usable.
3. Check the freshness boundary lost in the B2 advisory rewrite. Preserve old
   note retention and the intentional removal of controller-written rhetoric.
4. Verify new tool contracts against the real assembled prompt without changing
   established response-length, timing, note limits, cards or B2 architecture.
5. Compare a continued run against the working baseline before declaring the
   recent repairs successful. Broader redesign requires a separate request.

## Verification and Limits

Offline characterization executes extracted production functions with stubbed
effects. Results are in `logs/runs/20260917-companion-alignment-audit/results.json`;
run `node logs/runs/20260917-companion-alignment-audit/probe.cjs` from repo root.
It verifies busy-question loss, stale-advice promotion, the idle allowlist,
boot-note clipping and actual file-backed prompt selection. It reads the local runtime-config endpoint;
no LLM requests, paid images, microphone access or hardware actions occur.

All 437 existing JavaScript tests pass after the prior quiet-turn correction.
They cover scheduling and transport, not charm, initiative, sustained inquiry or
long-run nonrepetition. The audit does not claim those qualities have been fixed.
The prior overnight loop and latest silence PM provide live evidence; no new live
session was started during this analysis. The findings distinguish observed
mechanism failures from prompt/architecture hypotheses requiring comparison.

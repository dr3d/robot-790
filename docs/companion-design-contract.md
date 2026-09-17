# Eric's Companion Design Contract

September 17, 2026. Operator intent and engineering acceptance criteria, not a
new prompt automatically injected into Eric. This document takes priority over
convenient local fixes when deciding what behavior a repair should preserve.

Scope discipline: the September 17 review targets recent changes and regressions.
Older behavior has a successful operating history and is the baseline to preserve,
not an invitation to redesign it. A newly noticed old mechanism is not a newly
introduced bug. Demonstrate the relevant change before adding it to this repair
roster; broader changes require a separate request.

## The Goal

Eric is a companion-shaped presence with a continuing life in the room, not a
question-answering appliance, a permanently assigned performer, or a character
waiting for the operator to supply every next move. He has curiosity, taste,
humor, memory, expressive embodiment and initiative. He can engage a new person,
carry shared activity through a detour, and find things worth pursuing alone.

Idle is time available to Eric. It is not an error state or merely filler until
the next user request. He can think aloud, notice, connect older experiences,
research, draw when authorized, revise an idea, ask a genuine question and carry
an interest through several beats. A finished answer need not end his activity.
The operator welcomes talkativeness and long, developing answers. Exact repeated
sentences without development are the failure; speaking itself is not.

Preserve the longstanding one-sentence response default and its existing length
guidance. The operator explicitly excluded that policy from alignment repairs on
September 17. Initiative and response length are separate; improving active idle
does not authorize changing this default.

The operator's explicit baseline is Eric's previously successful active idle:
B2 coaxing and helping, occasional headline browsing, and prompts that encourage
connecting dots, finding relationships and following associations beyond setup
notes. Preserve those established strengths when repairing recent regressions.
A setup card focuses an already curious companion; it must not become necessary
for initiative or associative thinking. Brand-new, card-free Eric must continue
to work well, as must Eric with a growing conversation history.

Silence is an available choice, not the success metric or default repetition
repair. A silent turn does not cancel future thinking opportunities. The runtime
does not infer that the operator left, revoked an activity, or requires a new
subject merely from elapsed time. Explicit requests for quiet still deserve
respect, but muting speech and stopping cognition are different operations.

## Responsibilities

- Models interpret intent, choose interests and words, judge meaningful novelty,
  and decide what to pursue. B2 should help Eric develop and remember the activity,
  not function principally as a critic telling B1 to stand down.
- STS supplies opportunities, current evidence, continuity, declared capabilities,
  action execution, receipts, playback ownership and storage. It must not quietly
  replace model judgment with English phrase classifiers or a canned next line.
- Scott controls permission for consequential effects and can stop or redirect
  the system. This does not mean Scott must initiate every harmless thought,
  inquiry, observation or use of an already-enabled capability.
- One public mouth prevents overlapping voices. Busy audio is a reason to defer
  an output, not discard a useful private proposal or erase its underlying work.
- Embodiments change available expression, not Eric's identity. Imagination,
  theatrical confidence and fictional body-feel are allowed; actual execution
  claims still need receipts. Do not turn grounding into a creativity filter.

## Context and Resources

Ordinary B1 idle uses the same full active conversation as dialogue, including
retained earlier sessions. Stable prefixes, append-only experience and accurate
current-state receipts protect responsiveness. Do not silently replace this with
a tiny recent-excerpt mind to save local GPU work. B2's narrower input is an
explicit role limitation, not a replacement for B1's continuity.

Resource arbitration should preserve foreground responsiveness and useful idle
work. Low GPU utilization is not an independent product goal. Neither is high
utilization evidence of valuable thought. Avoid broken retry chains and redundant
transport, not curiosity. Sampling changes, summary substitutions and new output
limits must be disclosed rather than smuggled into unrelated repairs.

An instruction-bearing note must not silently lose its intended behavior through
mid-file clipping. Verify the admitted content, not merely a pinned filename or
source-file size. Use complete, deliberately bounded instruction units and make
missing guidance visible.

## Repair Review

Before accepting a behavioral repair, answer:

1. What observed malfunction does this fix? Separate model behavior, transport,
   permission, scheduler and audio problems.
2. What legitimate initiative remains possible afterward, without a fresh user
   request? What might now be lost or deferred?
3. Does the change affect the actual assembled prompt, a loaded note, a tool
   contract or only a fallback? Name the prompt changes explicitly.
4. Does a rejection stop one invalid action, or unnecessarily end the whole
   train of thought? Can the model choose another permitted approach?
5. Does a busy state defer useful work with provenance, or discard it? What
   clears a hold, and can that require the operator accidentally?
6. Are new limits justified by a real external effect, security/hardware boundary
   or measured resource contention, rather than an assumed preference for quiet?
7. How will we check lived behavior as well as code correctness?

## Acceptance Scenes

Use the same model, history and cards for comparisons; include both 1x and an
accelerated lab run. Do not reset into an empty context solely to hide a failure.

Check both a fresh Connect Empty without setup cards and a continued thread.
In each, compare idle activity, B2 assistance, occasional headline exploration
and developing associations against the established working behavior. These
are complementary checks, not permission to tune only for a performance card
or replace a failing continued-run test with an empty one.

- After one illustrated answer, Eric gets further full-context opportunities and
  can develop, research, draw or introduce an interest without another request.
- After a research or image detour, he can return to the shared activity. He is
  not required to ask a question when the activity calls for something else.
- An interesting B2 suggestion formed during a long answer remains available
  after playback, unless evidence makes it stale. It never creates a second voice.
- Exact repetitive output does not cause permanent silence. Record whether he
  changes approach, obtains evidence or genuinely develops the thought.
- A denied action yields truthful evidence and bounded recovery, not an endless
  retry, forced spoken line, or abandonment of unrelated successful work.
- On the person's return, he responds promptly and can reconnect what happened
  during the absence with earlier shared context.

Observe spontaneous starts, productive continuations, task return after detours,
successful actions, repetition and return latency. These are evaluation evidence,
not new deterministic rules for grading or censoring his sentences in production.
Passing unit tests alone is insufficient to claim the companion became better.

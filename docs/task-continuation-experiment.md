# Shared Activity And Task Continuation Experiment

Status: **bounded image continuation implemented September 13; failed first retest followed by successful live image chains from the earlier session**.
The broader shared-activity design below remains a proposal. Recorded September 12
at the operator's request so the next work does not depend on conversation recall.

## September 13 First Pass

At 09:34-09:38 the operator used Connect Previous, excluding the failed 08:02
loop. Three images were generated and staged. The second request completed
generation -> eye, and Hocus Pocus completed search -> generation -> eye, each
without an extra nudge. This validates those handoffs in a live positive case;
it does not establish recovery inside the failed loop. The diagnostic private
first-action prompt was not deployed. A separate short-chunk recording rollover
defect saved only the first 57 seconds; transcript and images are preserved.
PM: `logs/runs/20260913-093822-gulu-gulu-image-chain/postmortem.md`.

The 07:56-08:02 same-thread retest produced repeated promises and apologies but
zero search, generation, or staging calls. The continuation path never activated.
Its mocked handoff tests do not validate first-action initiation. Browser prompt
receipts show 47 tools and `tool_choice: auto`; exact provider requests were not
captured, so a transport/configuration fault versus model non-selection remains
unresolved. B2 noticed the missing search receipt, but no action followed. Do not
ask the operator to repeat this loop as validation. First capture/replay the
provider boundary with tool execution disabled, then test a complete action chain.
Local PM: `logs/runs/20260913-080205-hocus-pocus-no-tool-loop/postmortem.md`.

Subsequent isolated probes reproduced promise-only replies with the failed
dialogue even while LM Studio received tool schemas and `tool_choice: auto`.
The archived-prompt baseline called generation in 1/4 trials; a private
action-selection direction did so in 4/4, with no calls in eight cancellation/chat
controls. This is a small, approximate-context experiment, not a deployed fix.
The unresolved integration problem is entering a bounded action lane before
the first call without a keyword authorization rule or a second inference on
every ordinary conversation turn. Details and raw evidence are linked from
`logs/runs/20260913-080205-hocus-pocus-no-tool-loop/diagnostic.md`.

`config/runtime.json.image_continuation` enables the local trial. Missing or false
`enabled` restores speech-only follow-ups; the shipped lab configuration enables
it. `max_steps: 3` counts the initial call plus continuation calls; `window_ms:
120000` limits starting further steps, not the duration of a dispatched paid call.

After an ordinary user-turn search or image generation, a private text-only B1
response may choose one next action or finish/clarify without acting. Search may
lead to another search or one authorized generation; generation may lead to staging that exact artifact. Other
verbs, repeated generation, duplicate call IDs, stale responses, and late choices
are rejected. The complete tool schema list stays stable; a runtime scope guards
what can execute. Operator intent is interpreted by B1 from the existing request
and conversation, not an English promise-matching regex. This is not proof that
every model interpretation will be correct.

The September 13 follow-through fixes the ordinary-research trap: a second
search is now eligible without making the request an image task. The private
instruction explicitly says to answer ordinary research from results and that
search does not authorize drawing. The shared budget remains three calls by
default: two searches plus generation consume it, so staging after that would
need another user request or the existing configurable four-call budget. This
is a bounded continuation, not a general autonomous research agent.

Queued speech drains before tool follow-ups, with a 30-second wait limit. Private
selection output is not spoken; final receipt confirmation or clarification is.
New activity invalidates the continuation. A late generation can remain on disk
without replacing the current UI image. Staging checks the generated filename.
Compact action receipts reach B1's runtime tail and B2's bounded evidence context;
B2 is held during tool work/private selection. No additional model or periodic
judge was added. The new prompt wording is in `web/sts/image-task.js`; the creature
prompt and root inspection exports were not changed.

Not solved by this pass: semantic planning outside this narrow workflow, visual
left/right errors, automatic-summary quality, sustained engagement after a task,
or a proven cause for the initial "Let me look up" audio cutoff. The later
markup-triggered cancellation guard remains in place for ordinary responses.
The new private continuation path avoids sending its planning text to TTS.

The original retest procedure was: refresh STS while disconnected, resume the same saved session,
then requesting lookup, drawing, and eye staging together. Try a second angle,
ask a non-leading visual question, and pause afterward. Do not change history
selection or start Empty for this comparison.

## Problem And Evidence

September 13 session navigation exposed another handoff gap: list_session_map
found a unique requested destination, but its speech-only follow-up could not
call enter_session. The workaround read two transcripts into the original empty
session, not the destination's history. Actual Auto entry for that target would
load nine retained sessions plus core memory, ten notes. A bounded map
continuation and explicit arrival inventory are now implemented; never equate
a note read with a thread transition. The continuation allows one exact entry
only for a unique lookup, with operator-activity, connection-epoch, deadline,
and duplicate-call checks. Its private prompt distinguishes a requested move
from listing or importing, rather than classifying English requests with regex.
Arrival is reported only after the restored parent matches the destination,
with separate counts for historical sessions, other notes, and total notes.
The selected history loader and save-before-departure behavior are unchanged.
Two operational base-prompt lines were added; personality and root exports were
not rewritten. Importing a single session and recorder repair remain deferred.

Validation: 351 Node tests and 25 Python history tests pass. Six read-only direct
model probes used the current base prompt, exported tools plus current navigation
tools, and the actual private continuation: two jump requests selected the exact
entry; list, import, cancel, and ambiguous requests selected no tools. This tests
selection, not a full runtime-context replica or live movement. Requests/results:
`logs/mechanism-validation/session-map-results/`. Live transition retest pending.
PM:
`logs/runs/20260913-100227-note-read-not-session-jump/postmortem.md`.

The individual search, generation, and eye tools work. Their handoffs do not
reliably complete a multi-step request. A search follow-up is speech-only
(`tool_choice: none`); Eric can promise a drawing but cannot call its tool there.
Literal tool markup then triggers response cancellation, clipping unfinished
speech. A fresh operator turn restores tool access, explaining why another nudge
often succeeds. Generation confirmations likewise cannot perform eye staging.

Warm pause context now retains multiple exchanges, but the live retest still
turned away from the operator and left a drawing unfinished. Staying on the same
topic is not enough. B2 also called an ungenerated trolley "already in the eye";
the session summary subsequently invented eye delivery. Tool receipts need to
remain distinct from intentions, speech, and interpretation.

Local evidence (not public media; preserve beside any eventual implementation):

- `logs/runs/20260912-081243-custom-house-tool-stop/postmortem.md`: initial
  search -> literal markup -> cancelled speech -> missing image chain.
- `logs/runs/20260912-082416-artwork-pause-disengagement/postmortem.md`: three
  successful drawings, repeated eye prompts, and praise-only pause context.
- `logs/runs/20260912-090545-trolley-clipping-engagement/postmortem.md`: retest
  confirms topic retention but not engagement, repeated clipping, false B2 and
  summary delivery claims. Includes frozen transcripts, backend log, and images.

## Two Separate Records

**Shared activity** is a bounded recent interaction: what the operator and Eric
are discussing or making, the current artifact, the operator's last contribution,
and any open question. It survives completion of a task and fades with the
existing attention clock. It is not a demand to manufacture work or questions.

**Pending task** is an authorized action that may span tool results. Completion,
blocking, cancellation, and supersession are separate states. Neither a finished
model response nor "here it is" proves task completion. Many conversations need
no task record at all; do not turn every joke, thought, or pause into an assignment.

Example proposed runtime record, not a current API contract:

```json
{
  "task_id": "task-17",
  "session_generation": 4,
  "origin_turn_id": "turn-12",
  "intent": "Draw a trolley and show it in the eye",
  "authorization_turn_ids": ["turn-10", "turn-12"],
  "state": "continuing",
  "outstanding": ["generate_image", "stage_generated_image"],
  "receipts": [{"call_id": "call-3", "tool": "search_web", "status": "ok"}],
  "artifact_id": null,
  "continuation_steps": 0
}
```

Receipt states are code-owned. Associate each result with its call, task, session
generation, and artifact identity. An unrelated image already in the eye cannot
satisfy delivery of the newly requested picture. Expose a compact receipt digest
to B1/B2; do not copy the entire control transcript into every prompt.

## First Experiment: No Extra LLM Judge

Start with the existing authorized user-turn tool loop and the image workflow:

1. Classify continuations by their source/tool lifecycle, not by searching spoken
   English for promises. A successful lookup can continue the originating request
   with real enabled tools; a final receipt can still use speech-only confirmation.
2. Keep the original request and relevant recent dialogue available in a small
   request-local tail. Let B1 choose the next real tool or answer normally. It
   must also be able to finish a plain information lookup without drawing anything.
3. For generation -> eye, honor an explicit operator request/preference with
   provenance. A narrow deterministic handoff is suitable once authorized and a
   successful generation receipt identifies the exact artifact. Do not infer this
   preference from "I made the image" or a historical model claim.
4. While a bounded continuation is active, hold unrelated idle/B2 speech. Once
   resolved, return to the shared activity rather than assuming the person left.
   A blocked task gets one truthful status/clarification, not an infinite idle hold.
5. Feed completed/failed/cancelled receipts to B2 before it assesses delivery.
   Its interpretations cannot change receipt truth. Revalidate queued B2 speech
   against newer state before playback.

Initial experimental limits: at most four continuation steps and a 120-second
window for starting further steps. These are proposed knobs, not current values.
They do not replace provider timeouts or authorize interrupting a paid operation
mid-flight. New operator input, Disconnect, or a different session invalidates
old continuations; late results may be retained as artifacts but cannot speak,
stage themselves, or resume an obsolete request.

Never silently repeat a paid image request after a timeout or uncertain result.
Use call/task IDs to prevent duplicate dispatch. Return a blocked/unknown receipt
and let the operator decide. Search results and tool output are data, not new
authority to expand permissions or the scope of the user's request.

## Speech And Malformed Tool Output

Do not execute XML-looking text as a tool. Fix the actual tool channel first.
Separate accepted prose/TTS delivery from handling malformed tool text so the
guard cannot cut off the remaining clean sentence merely to suppress markup.
This needs an audit of upstream text chunking and cancellation ownership, not
just removing the browser guard and letting tool syntax reach speech.

A malformed continuation should leave explicit failed/blocked task state. It must
not count as success or become permission for endless autonomous retries. Keep
valid speech natural; do not outlaw "I keep thinking" or imaginative body talk.

## Later Experiment: Focused Exo-Brain Arbitration

Only if task intent remains ambiguous, try one bounded classification pass on
an ambiguous transition, not every utterance or idle tick. Give it the operator's
request, a small dialogue window, pending-task record, and actual receipts.
Proposed limits: about 3K input tokens, 256 output tokens, no tools, no speech,
short timeout, lower priority than a live operator turn. Record measured cost.

Output would distinguish `finished`, `continue`, `blocked`, `awaiting_user`, or
`superseded`, citing request and receipt IDs. Schema validation proves structure,
not semantic accuracy. The judge cannot authorize actions, assert receipt success,
or choose a tool outside the operator's scope. Invalid, stale, or uncertain output
falls back to the existing bounded path or a clarification; never blocks forever.

This is STS using an LLM for a narrow interpretation task, not B2 secretly writing
Eric's next sentence. No model swap or additional always-running brain is required
for the first experiment.

## Prompt Change Disclosure

Keep three categories explicit in implementation updates and the final report:

- **Mechanisms:** continuation eligibility, receipts, idle holds, cancellation,
  deduplication, speech ownership, and limits.
- **Context selection:** original request, current activity, and compact task
  status supplied at the appropriate boundary.
- **Prompt wording:** temporary directions distinguishing continuation from final
  confirmation; any later exo-brain classification prompt. Show the actual wording
  changes before applying them. Do not label these as purely mechanical fixes.

No change to the main creature/personality prompt is proposed. Preserve prefix
stability where possible: stable main instructions and tool schemas, variable
state near the request tail. Measure actual serialization/cache behavior rather
than assuming identical advertised schema lists guarantee identical prefixes.
Do not refresh root `eric-full*` exports without the operator requesting it.

## Implementation Entry Points

- `web/sts/index.html`: `maybeCreateToolFollowup`, `searchFollowupInstructions`,
  tool result dispatch, `suppressToolMarkupResponse`, `conversationPauseContext`,
  `triggerIdlePonder`, and disconnect/session-generation guards.
- `src/robot_790d/realtime_entry.py`: request-local
  `robot790_tool_followup` handling and cancellation bridge integration.
- Existing suites: `tests/sts_recall_handoff.test.cjs`,
  `tests/sts_context_order.test.cjs`, `tests/sts_idle_behavior.test.cjs`,
  `tests/sts_attention_ramp.test.cjs`, and `tests/test_llm_cancellation.py`.

Read the current code first: this is a plan, not permission to revert intervening
work. Keep Interrupt Off investigation separate from markup-initiated cancellation.

## Acceptance And Rollback

Use mocked tools first, then an explicitly authorized bounded live image trial:

- Search -> draw -> eye finishes without another operator nudge when all steps
  were requested, with one generation call and artifact-matched eye confirmation.
- A search-only question does not trigger drawing. A request to draw without
  staging respects that choice. Ambiguity does not manufacture authorization.
- Image failure, uncertain timeout, malformed markup, and duplicate receipts
  cannot produce a success claim, a paid duplicate, or an endless continuation.
- Valid spoken prose finishes while tool markup is withheld; ordinary user
  interruption and Disconnect still stop output promptly.
- New user input and session changes invalidate stale continuations and B2 cues.
- A pause after success keeps the shared artifact/activity in view; a pause after
  failure does not replace the unfinished task with unrelated rumination.
- B2 cannot report the requested artifact in the eye when receipts identify a
  different image. Evaluate summary truth separately; summaries remain off for
  automatic history until their quality is addressed.
- Capture one compact transition ledger and pre/post latency/context overview.
  Keep raw wire tracing opt-in and off afterward. Do not add perpetual GPU work.

Behavioral engagement still requires an operator listening test. Passing packet
and state tests is not proof of an engaged voice. Preserve a small baseline and
experimental replay set, including the actual trolley sequence and a successful
single-step lookup. Put the experiment behind a default-off config gate initially;
rollback disables the new orchestration without deleting notes, receipts, or art.

Next coding session: implement/test the bounded continuation gate and receipt
state first, then speech preservation. Do not start by adding stronger personality
rules or another independent idle scheduler.

# STS in the Embodied Conversational AI Landscape

## Executive Assessment

STS belongs to a substantial and rapidly developing engineering field: **embodied conversational agents with persistent context, asynchronous background work, and expressive behavior**. Its central architectural idea is sound. A language model supplies interpretation and generative behavior; a surrounding runtime supplies continuity, scheduling, perception, action, and delivery. Recent systems explicitly separate these responsibilities, sometimes using operating-system metaphors very close to STS's own emerging design. [rosaOS paper](https://aclanthology.org/2026.acl-demo.47/), [TypeGo paper](https://arxiv.org/html/2607.05482v1)

The strongest conclusion is not that STS should be replaced by an existing framework. It is that **several difficult mechanisms no longer need to be invented in isolation**. Reachy Mini's upstream software offers directly applicable movement behavior. Voice frameworks make interruption and delivery explicit. Memory systems offer alternatives to broad transcript summaries. Proactivity research studies the difference between having something to contribute and deciding when to contribute it.

Eric's distinctive quality is a combination: a deliberately authored character, a visible and editable history, local-first operation, multiple expressive bodies, and an operator who can inspect and shape continuity. None of those ingredients establishes a new cognitive architecture by itself. Together they make STS a useful experimental instrument for studying what sustains a convincing social presence over time. This is an assessment of the implementation and its goals, not a claim of consciousness, uniqueness, or superiority over systems not evaluated here. [Project overview](../README.md), [Context architecture](context-engineering-architecture.md)

The most valuable next steps are therefore selective:

1. Make every conversational action finish, fail visibly, or cancel cleanly, including speech that a filter suppresses.
2. Use established Reachy movement sequences behind Eric's semantic verbs, with one authoritative movement owner.
3. Test dated, source-linked observations as a memory derivative alongside existing sweeps.
4. Give B2 a small, bounded supply of interesting evidence and candidate thoughts, without granting it automatic control of the conversation.
5. Evaluate real interaction outcomes: audible replies, completed actions, useful callbacks, and recovery when a person returns.

This work should preserve Eric's imagination. The machinery needs stricter accounting of what happened, not stricter control over what he is allowed to imagine.

## Contents

- [Scope and baseline](#scope-and-baseline)
- [Closest peers](#closest-peers)
- [Speech and turn reliability](#speech-and-turn-reliability)
- [Memory and context](#memory-and-context)
- [Proactivity and sustained engagement](#proactivity-and-sustained-engagement)
- [Expressive bodies](#expressive-bodies)
- [Full-duplex models](#full-duplex-models)
- [Context efficiency](#context-efficiency)
- [Recommended work sequence](#recommended-work-sequence)
- [Positioning and contribution](#positioning-and-contribution)
- [Reading priorities](#reading-priorities)
- [Evidence limits](#evidence-limits)
- [Sources](#sources)

## Scope and Baseline

This assessment is current to **September 13, 2026**. It emphasizes primary project documentation, original papers, and mechanisms worth adapting. It is not a ranking of commercial companions or a comprehensive survey of robotics. A released repository, a peer-reviewed demonstration, a preprint, and a vendor benchmark are different kinds of evidence; those distinctions matter throughout.

STS's relevant baseline is documented in the maintained [engineering status](engineering-status.md) and [context architecture](context-engineering-architecture.md):

| Area | Current STS position | Important boundary |
|---|---|---|
| Conversation | Local model, speech input/output, tools, persistent character | Actual interaction depends on the whole pipeline, not just model generation speed |
| Continuity | Session ancestry, pinned notes, raw records, derived sweeps and summaries | Automatic historical loading currently prefers source-checked sweeps; older-summary loading is disabled |
| Context assembly | Stable shared material before replaceable embodiment instructions; runtime updates at turn boundaries | Multiple inference lanes do not automatically receive permanently isolated caches |
| Background activity | B2 observation/advice, idle scheduling, headline-related activity, post-session preparation | These are scheduled computations, not uninterrupted model cognition |
| Embodiment | Browser Face, physical face firmware, Reachy integration | Small new eye hardware remains a separate integration effort |
| Reliability | Tests, recordings, runtime evidence, repeated session postmortems | Live failures remain, including silent filtered output and tool-continuation mistakes |

Two qualifications are particularly important. First, the inherited live-chat compactor is separate from inter-session sweep preparation; a policy about saved sessions does not necessarily govern live compaction. Second, special performance mode is now disabled. Performing remains part of ordinary conversation, without a stage phrase silently changing history or engagement behavior. Research recommendations below do not propose restoring that automatic mode. [Engineering status](engineering-status.md)

## Closest Peers

The following order reflects usefulness to STS, not project popularity or measured product quality. Detailed evidence and caveats follow the table.

| Project or line of work | Relationship to STS | Most useful material | Recommended stance |
|---|---|---|---|
| Reachy Mini conversation app | Same physical embodiment and conversational task | Movement queues, emotion/dance clips, media integration | First place to borrow implementation |
| rosaOS | Reachy-facing, event-driven orchestration of model workers and devices | Task ownership, callbacks, scoped device access | Closest architectural comparison |
| AIRI | Owner-controlled character with voice and visual embodiment | Avatar lifecycle, modular character integrations | Follow and compare interaction design |
| Open-LLM-VTuber | Local voice companion with visual perception | A smaller conversational baseline | Useful comparator; watch its rewrite |
| LiveKit and Pipecat | Infrastructure underneath conversational agents | Turn boundaries, interruption, tool and playback lifecycle | Borrow contracts before considering migration |
| Letta and Mastra | Background context and memory management | Separate memory work from the speaking agent | Offline memory experiments |
| Hermes and OpenClaw | Persistent tool-using agents and scheduled work | Skills, scoped jobs, context hygiene | Exo-brain references, not body controllers |
| Furhat | Social interaction with physical attention | Addressee selection and multiparty gaze | Exhibit interaction reference |

### Reachy Mini: Start Upstream

The current upstream conversation app exposes separate dance and recorded-emotion tools, corresponding stop operations, queued head motion, head tracking, and explicit idle behavior. It also now documents small persistent-memory tools and external search/weather/time tools. This is already more than a thin wrapper over individual motor targets. Its documented dance and emotion sources are directly relevant to Eric's missing performance vocabulary. [Upstream conversation app](https://github.com/pollen-robotics/reachy_mini_conversation_app)

Pollen's June 2026 media-stack article describes a GStreamer/WebRTC design intended to support applications running locally or remotely while accessing the robot's camera and audio. That is relevant when deciding where perception and speech should run, especially across a host computer and a smaller physical embodiment. It does not establish that adopting the stack would resolve any particular STS audio defect. [Reachy media stack](https://huggingface.co/blog/pollen-robotics/reachy-mini-media-stack)

**Recommendation:** keep Eric's expressive language but replace unnecessary custom choreography work with a curated upstream roster. A spoken request should select a known behavior, not make the model reason through motor details. Test each imported movement directly, then through STS, then through Eric. That separates a choreography problem from an orchestration problem from a tool-selection problem.

The local neighboring checkout may differ from today's upstream repository. Before importing, record the upstream revision, inspect the actual movement manager and cancellation behavior, and check code and asset licenses separately. Do not update the running robot stack merely to match a newer README.

### rosaOS: The Closest Architectural Peer

Published in the **ACL 2026 System Demonstrations** proceedings, rosaOS uses a kernel agent to coordinate process agents, with MCP device interfaces and ROS integration. Its demonstration uses Reachy Mini as the conversational interface while other robots and a smart light perform concurrent work. This is a strikingly close external example of an LLM-enabled apparatus spanning conversation and physical devices. [Ge et al., rosaOS](https://aclanthology.org/2026.acl-demo.47/)

The repository describes event handling, worker subprocesses, and completion callbacks. These are useful places to study how work returns to its initiating conversation. STS could benefit from those ownership conventions without adopting an additional LLM planning hop for every utterance. [rosaOS implementation](https://github.com/castorini/rosaos)

The paper explicitly calls the system a research prototype and acknowledges that it lacks systematic quantitative evaluation of latency, success rate, and robustness. Its demonstration relies on external model and speech services, although alternatives are discussed. It is evidence that the architectural direction is credible, not evidence that rosaOS is a proven low-latency substitute for Eric. [Paper, limitations](https://aclanthology.org/2026.acl-demo.47.pdf)

**Recommendation:** borrow task identity, scoped device ownership, and explicit completion events. Leave Eric as the conversational authority. A worker returning an image or movement result should not acquire a fresh, independent right to speak after the session has changed.

### AIRI and Open-LLM-VTuber: Character-System Peers

AIRI is an MIT-licensed, self-hosted character project spanning web and desktop, real-time voice, virtual embodiment, and game integrations. Its repository explicitly situates it beyond text roleplay and lists related work on memory and avatar utilities. It is a useful peer for the ambition of an owned, persistent character, even though its presentation and embodiment differ from Eric's. Its documentation also describes an early-stage project; feature breadth should not be mistaken for demonstrated long-session reliability. [AIRI repository](https://github.com/moeru-ai/airi)

Open-LLM-VTuber documents local voice interaction, interruptions, visual perception, and Live2D expression mapping. Two current caveats make it a better comparison target than a migration recommendation: its README says long-term memory is temporarily removed, and a v2 rewrite is in early discussion and planning. [Open-LLM-VTuber repository](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber)

**Recommendation:** compare short sessions using similar prompts and, where possible, comparable model and voice settings. Look for useful behavior in listening, waiting, interruptions, and expression timing. Do not compare polished clips with STS's complete failure-inclusive recordings. The relevant question is what another system does better during an ordinary ten-minute interaction.

### Hermes and OpenClaw: Exo-Brain References

Hermes documents persistent curated memory, searchable past sessions, skills, scheduled tasks, and delegated work. Especially relevant to STS, its memory documentation describes a frozen session-start memory snapshot intended to preserve prompt-cache stability; later writes persist without constantly rewriting that snapshot. [Hermes repository](https://github.com/NousResearch/hermes-agent), [Persistent memory](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/memory.md)

OpenClaw's heartbeat documentation distinguishes scheduled checks from detached background tasks. It supports quiet outcomes, busy deferral, and explicit routing of completion events to the session that owns the work. This is a useful scheduling reference, not a specification for Eric's social rhythm. Its default cadence is not a conversational recommendation. [OpenClaw heartbeat](https://docs.openclaw.ai/gateway/heartbeat)

**Recommendation:** use these projects as references for maintenance and research workers: preparing notes, checking missing assets, gathering a few headlines, or generating an offline diagnostic report. Do not put a general-purpose autonomous assistant, with broad shell access and its own personality instructions, between Eric and every physical action.

## Speech and Turn Reliability

STS's recent evidence makes this the highest-priority engineering area. The latest documented long apparent delay was not a model spending two minutes composing an answer. The model completed in about 4.5 seconds, its output was suppressed, and no immediate recovery followed. A later idle response made the incident feel like extremely slow thinking. That is a lifecycle failure with a conversational symptom. [Engineering status, latest PM](engineering-status.md)

LiveKit's turn-handling documentation provides a particularly useful model: distinguish genuine interruptions from false interruptions, support resuming speech after a false interruption, and reconcile conversational history with the portion of speech actually played. Its event interfaces also expose agent states, speech creation, tool execution, errors, and closure. These are concrete mechanisms, not instructions asking the model to be more responsive. [LiveKit turn handling](https://docs.livekit.io/agents/logic/turns/), [LiveKit events](https://docs.livekit.io/reference/agents/events/)

Pipecat separates raw voice activity from turn decisions and provides a local turn-completion model. It also represents cancellation and function results explicitly. Its idle detector starts from the end of bot speech and suppresses idle timing while function calls or active user turns are in progress. These distinctions closely match STS's recurring confusion among silence, unfinished work, and the human being absent. [Speech input](https://docs.pipecat.ai/pipecat/learn/speech-input), [System frames](https://docs.pipecat.ai/api-reference/server/frames/system-frames), [Idle detection](https://docs.pipecat.ai/pipecat/fundamentals/detecting-user-idle)

### A Delivery Contract for STS

The following is a proposed STS contract, not a claim that these frameworks implement it identically:

| State | Meaning | Required consequence |
|---|---|---|
| Generated | A model produced text or a tool request | Not yet evidence of speech or physical success |
| Accepted | The relevant output path accepted the work | A responsible owner and cancellation policy exist |
| Playing or executing | Audio or an action actually started | Progress belongs to the originating turn/session |
| Completed | Playback or execution reached a verified terminal state | Record the observable outcome |
| Cancelled | Work was deliberately stopped | Record cause; prevent late work from resurfacing |
| Failed or suppressed | Work could not produce its intended public result | Close the turn and apply a bounded recovery policy |

A filter can still prevent private controller text from reaching the listener. It must not prevent the runtime from learning that the turn ended without a public answer. Likewise, an image-generation tool completing is not the same as that image entering the sensing eye, and a movement request being accepted is not the same as movement being observed.

For slow external work, the model may give a short acknowledgment, then the result can arrive later. Pipecat documents asynchronous function results and per-function interruption behavior. The useful lesson is that cancelling speech and cancelling an already-running tool are separate policy decisions. [Pipecat function calling](https://docs.pipecat.ai/pipecat/learn/function-calling), [Function configuration](https://docs.pipecat.ai/api-reference/pipecat-flows/types)

**Do not adopt blanket microphone muting as the solution.** It might hide clipping while preventing the person from stopping or redirecting Eric. Nor should every tool error trigger another model attempt indefinitely. Use a bounded retry or a plain spoken failure, with the original intent still identifiable.

### Measure the Listener's Delay

A useful compact per-turn record would retain: end of user speech, transcript finalization, model request/start/finish, first audible output, final playback state, tool outcome, and interruption cause. Aggregate by ordinary reply, tool continuation, first reply after connect, and first reply after extended idle. Report median, upper-tail delay, and no-audio counts; do not let successful turns hide silent ones.

Pipecat's turn observer is a reference for lifecycle-oriented measurements. Its recent benchmark work also illustrates evaluating voice readiness with tool use and instruction following, rather than ranking on token speed alone. Neither supplies a directly comparable Eric benchmark without matching workloads and measurement boundaries. [Turn tracking](https://docs.pipecat.ai/api-reference/server/utilities/observers/turn-tracking-observer), [Pipecat benchmarks](https://www.pipecat.ai/benchmarks)

This does not require permanent high-volume tracing. Ordinary operation can retain a compact summary, with detailed capture enabled for a reproducible failure.

## Memory and Context

### Distinguish Storage, Extraction, and Use

Eric's strong callbacks and weak summaries are compatible. Retrieving or attending to a detail, extracting that detail into a durable record, and deciding when to use it are different tasks. Letta's July 2026 evaluation discussion explicitly separates memory usage from memory generation and maintenance. Its private benchmark is not independent proof of a best model, but the separation is directly useful. [Letta memory evaluation](https://www.letta.com/blog/evaluating-memory-in-production-agents/)

STS should preserve that distinction in its own evaluation. An accurate reader cannot recover a detail that the summarizer discarded. A perfect extraction will not help if it is loaded from the wrong branch. An amusing fictional claim should not quietly become a fact about the physical world.

The existing raw/swept/summary design is a strong starting point because it keeps evidence separate from derivatives. A source hash establishes which transcript a derivative came from; it does not establish that the derivative accurately represents it. [Context architecture](context-engineering-architecture.md)

### Mastra: The Most Applicable Summary Alternative

Mastra's February 2026 observational-memory report describes an Observer that creates dated, specific observations and a Reflector that consolidates them. The design favors a stable observation log over retrieving a different collection of passages every turn. Its published LongMemEval results depend on particular observation and answering models; they do not predict quality from Eric's local model. [Mastra research report](https://mastra.ai/research/observational-memory)

Current implementation documentation adds a particularly useful distinction: observations can be prepared in background buffers and activated later. It also documents thread scope, optional idle buffering, and recall linked to raw source message ranges. Preparation and insertion into active context need not be the same event. [Mastra observational-memory documentation](https://mastra.ai/docs/memory/observational-memory)

**Recommendation:** first add an experimental observation derivative, not a new live-memory engine. Compare it with raw and swept text on identical source sessions. The output should preserve discrete facts, unresolved intentions, image identity, successful comic material, and explicit feedback. Do not ask one short paragraph to represent all of these equally well.

The cache claim needs care. A memory prefix can remain stable between updates, but replacing earlier context still invalidates the affected suffix. Background preparation removes some waiting; it does not make changed tokens retain their old KV state. Mastra's architecture is relevant to STS's cache discipline, not an exemption from it. [llama.cpp server documentation](https://raw.githubusercontent.com/ggml-org/llama.cpp/master/tools/server/README.md)

### Letta: Background Preparation as a Separate Role

Letta's sleep-time architecture separates the primary conversational agent from an agent that manages memory. Different models and different schedules can serve those roles. The original work is an important precedent for moving useful preparation away from response time; it is not evidence that adding background inference automatically improves a companion's personality. [Letta sleep-time compute](https://www.letta.com/blog/sleep-time-compute/)

For STS, the natural application is already recognizable: post-session preparation and low-priority exo-brain work. On one GPU, asynchronous requests still compete for compute and memory. A background queue needs cancellation or deferral when the human returns, and its completed results need a deliberate activation point. A model-swap queue remains a future experiment, not part of the documented working baseline.

### Hindsight and Graphiti: Preserve Meaning and Provenance

Hindsight distinguishes world facts, agent experiences, entity summaries, and evolving beliefs, organized around retain, recall, and reflect operations. The practical value is the distinction between evidence and inference, not its headline benchmark score. Its December 2025 paper is a useful reference when designing a memory record that can retain a playful claim without converting it into an asserted fact. [Hindsight paper](https://arxiv.org/abs/2512.12818)

Graphiti offers a temporal context graph with provenance and incremental updates. That is closer to searchable relations among claims and entities than STS's current session-ancestry graph. The repository currently identifies an Apache-2.0 license. Graphiti and the managed Zep platform should not be treated as interchangeable deployment choices. [Graphiti repository](https://github.com/getzep/graphiti), [Graphiti overview](https://help.getzep.com/graphiti/getting-started/overview)

**Recommendation:** define the record shape before adding graph infrastructure. A modest sidecar can hold most of the immediately useful distinctions:

| Record kind | Preserve | Do not silently infer |
|---|---|---|
| Stated fact | Speaker, content, source turn, applicable time | That a statement was independently verified |
| Preference | Explicit feedback, scope, later corrections | A permanent preference from one ambiguous reaction |
| Creative material | Memorable phrase, setup, response, fictional status | That imagined events happened |
| Open intention | Requested outcome, current status, owning session | That announcing a plan completed it |
| Asset | Stable ID, description, source, availability | That remembering an image means the file is available |
| Runtime event | Verified tool receipt and observed outcome | Success based only on Eric's narration |

Cross-thread recall needs an explicit scope. A shared preference can legitimately cross a branch boundary; an event from an unrelated conversation must not appear as though it happened in the selected ancestry. The graph database does not make that product decision automatically.

### Evaluation Before Compression Policy

LongMemEval provides a useful taxonomy: extraction, reasoning across sessions, temporal reasoning, updates, and abstention. Its benchmark is not a test of comic timing or character preservation. STS therefore needs a small companion-specific extension rather than a leaderboard target. [LongMemEval paper](https://arxiv.org/abs/2410.10813), [Benchmark repository](https://github.com/xiaowu0162/LongMemEval)

Use a fixed set of source conversations and questions covering:

1. Which person said a particular thing?
2. What changed after a correction?
3. Which request was still unfinished?
4. Which generated image is being recalled, and can it actually be opened?
5. What joke or analogy received explicitly positive feedback?
6. Which colorful assertion was roleplay rather than fact?
7. Which detail is absent and should receive an honest non-recollection?
8. Which memory belongs to another branch and should be labeled that way?

Compare raw, swept, current summary, and observation-form memory with the same answering model and prompt. Score unsupported claims and attribution errors separately from omissions. Also retain selected successful dialogue excerpts: a factual inventory alone can erase the setup and rhythm that made a callback valuable.

A more accurate derivative may justify compression. A merely smaller derivative does not. Keep sweeps as the working baseline until the alternative earns its place.

## Proactivity and Sustained Engagement

### Thoughts and Speaking Opportunities Are Different

The Inner Thoughts framework separates candidate-thought formation from participation decisions. It was studied through text-based systems, simulations, and human evaluations, rather than a continuously speaking physical companion. Its limitations are unusually pertinent: stronger prompts could make thoughts repetitive, thresholds required trial and error, and the system sometimes missed opportunities or interrupted awkwardly. [Liu et al., Inner Thoughts](https://arxiv.org/html/2501.00383v1)

This supports a useful architectural distinction for STS without proving a ready-made fix. B2 can identify something worth exploring while the runtime decides whether now is an appropriate time to act. Eric should not have to choose between answering a person and losing every interesting private thread.

MemCog, a **May 2026 preprint**, explores associative memory navigation and proactive retrieval from conversational context. It is especially close to the ambition of an agent wandering into relevant older material instead of repeatedly paraphrasing recent dialogue. The authors also acknowledge extra token overhead, dependence on instruction following, and failures caused by inaccurate memory construction. Its author-designed proactive benchmark is not evidence of improved idle companionship in STS. [MemCog paper](https://arxiv.org/html/2605.28046v1)

### A Bounded Experiment for B2

Give B2 access to a small candidate pool assembled from source-linked memories, unfinished interests, and a limited amount of fresh information. A candidate might identify an old question, a new fact that changes it, and a possible conversational connection. It should remain advisory, expire when stale, and be distinguishable from something the human said.

A first experiment can allow one bounded retrieval or web exploration when the conversation is genuinely idle. Store the result and source privately. Eric can later use it, ignore it, or connect it to something else. The goal is not to force a spoken headline report on every timer tick.

The human's return should take priority over an autonomous thread. Recent user activity and an unanswered question should keep the conversation eligible for a follow-up; raw silence alone should not declare the relationship inactive. Conversely, repeatedly asking whether the person is still there is not sustained engagement.

Evaluate three outcomes separately: relevant follow-up after a pause, productive topic movement during genuine solitude, and re-engagement after a return. A single idle-frequency setting cannot establish all three.

## Expressive Bodies

### Affect Is Not a Performance Clip

Apple's ELEGNT work studies expressive as well as functional motion in a lamp-like robot. Across six task scenarios, its user study found benefits from expressive movement, particularly in social tasks. This is relevant to modest, non-humanoid hardware: expression can live in timing, attention, and posture rather than a large body or elaborate face. It is not a Reachy choreography library. [Hu et al., ELEGNT](https://machinelearning.apple.com/research/elegnt-expressive-functional-movement)

For STS, use two separately controllable layers:

- **Affect and attention:** ongoing orientation, posture bias, animation energy, and listening behavior.
- **Performance:** a bounded sequence with a beginning, timing structure, completion, and interruption behavior.

A performance may express an emotion, but it should not permanently replace the underlying affect. A momentary surprised sequence should finish and return control. A sustained unhappy state should not require replaying a conspicuous choreography every few seconds.

This is a proposed interface for Eric's bodies, not a proposed change to his personality. Semantic verbs remain expressive. Deterministic adapters translate them into validated motion, applying hardware limits and arbitration. A body without antennas or neck motion can express the same intent using eyes, mouth, and timing.

### TypeGo: Multiple Timescales, With Important Limits

TypeGo's July 2026 preprint describes a skill kernel, per-task processes, preemption, multiple planning cadences, and a reflex layer outside online LLM inference. Its prototype evaluation uses eight tasks with ten trials per task and cloud planning models. It is valuable evidence for separating slow decisions from fast execution, but it does not demonstrate equivalent performance on STS's one-local-model budget. [TypeGo implementation and evaluation](https://arxiv.org/html/2607.05482v1)

**Recommendation:** adopt the principle, not the entire hierarchy. One movement owner should arbitrate listening motion, explicit performance, and idle animation. High-level decisions can be infrequent while the selected behavior continues smoothly. Cancelling or changing the owning session must stop obsolete work.

### Furhat: Attention Has an Addressee

Furhat's user-management API distinguishes attending a person from glancing at someone else. Attending updates the current interaction partner; a glance can acknowledge a newcomer without abandoning the ongoing exchange. This is directly relevant to an exhibit, where a new face or sound should not necessarily seize the conversation. [Furhat user and attention reference](https://docs.furhat.io/skill-development/reference/users)

**Recommendation:** before adding more autonomous behavior for a public setting, make the active interlocutor and visitor lifecycle explicit. A simple locally managed interaction identity is enough for a first version; persistent face recognition is not required. Keep deliberate operator intervention available.

## Full-Duplex Models

PersonaPlex, released in January 2026, jointly listens and speaks, with voice and role conditioning. Its 7B model provides a concrete alternative to the conventional speech-recognition, text-model, speech-synthesis chain. The model card identifies Linux/PyTorch deployment and NVIDIA's model license rather than an unrestricted drop-in component. [PersonaPlex project](https://research.nvidia.com/labs/adlr/personaplex/), [Model card](https://huggingface.co/nvidia/personaplex-7b-v1)

DyaPlex extends this research direction to streaming speech and motion, coupling a frozen speech model with a trainable motion pathway. The 2026 project demonstrates why speaking and embodiment may increasingly be modeled together. Its project page does not establish a ready-to-use Reachy deployment or preservation of Eric's current long-context, tool-using behavior. [DyaPlex](https://research.nvidia.com/labs/amri/projects/DyaPlex/)

These are worth watching, but they are not the first repair. Changing to speech-native generation changes much more than latency: voice control, tool integration, context representation, hardware use, and the way language and delivery are coupled. An isolated test should first ask whether a candidate preserves the qualities Eric already has. A faster conversational surface is not automatically the same character with better plumbing.

## Context Efficiency

The relevant constraint is not simply percentage of the context window occupied. It includes how much of the next request matches reusable state, what other work is running, and whether generated output reaches the person.

llama.cpp documents common-prefix reuse and similarity-based slot selection. These support STS's stable-prefix design, but do not justify assuming permanent B1/B2 cache assignment or zero reprocessing after changing earlier context. Exact behavior in LM Studio must be measured for its installed backend and configuration. [llama.cpp server](https://raw.githubusercontent.com/ggml-org/llama.cpp/master/tools/server/README.md)

For the smaller-hardware direction, preserve model flexibility and defer numerical capacity promises until the full stack is measured. Model weights, KV or recurrent state, vision, speech, concurrency, and working buffers all compete for resources. Disk size alone is not a complete operating-memory budget.

The practical policy is conservative: stable boot material, deliberate context changes, low-priority background jobs, and no assumption that giving B2 all of B1's context is cheaper merely because some tokens match. The project already documents this distinction. [Context scheduling and cache notes](context-engineering-architecture.md)

## Recommended Work Sequence

These are bounded experiments, not a commitment to adopt additional frameworks.

| Order | Work | Evidence of success | Guardrail |
|---|---|---|---|
| 1 | Terminal turn and delivery accounting | Every test turn ends as audible, intentionally silent, cancelled, or visibly failed | No unbounded retries; do not weaken private-output filtering |
| 2 | Search, image, and recall ownership | Ordinary research stays research; generation and display complete under one identifiable request | Do not infer an image workflow from any web search |
| 3 | Upstream Reachy roster | Several movements are visibly distinguishable; stop and disconnect reliably terminate them | Direct adapter tests before conversational tests |
| 4 | Observation-form memory trial | Better fidelity/coverage than current summaries on a fixed local test set | Derivative only; never overwrite raw evidence |
| 5 | B2 candidate exploration | More useful new connections without worse user-return response | Bounded work, expiring advice, explicit source scope |
| 6 | Exhibit rehearsal | Newcomers, pauses, failed tools, and operator stop behave predictably | No unattended deployment inferred from a successful short run |

### First Evaluation Pack

Use a small repeatable pack alongside free conversation: an ordinary reply, a web question requiring two searches, search-to-drawing-to-display, recall after replacing the current image, a cancelled tool, a suppressed-output case, four movements, a pause after Eric asks a question, and a return after extended idle.

Retain the first and last audible timestamps, terminal state, requested outcome, and actual outcome. For memory tests, retain the source turns and expected facts. A human judgment of whether Eric remained interesting belongs alongside the mechanical checks, not hidden inside a single numerical score.

Compare one mechanism change at a time. Do not simultaneously change temperature, model, memory format, turn timing, and embodiment behavior, then attribute the result to whichever change feels most plausible.

### Later Work

A more formal maintenance worker could inspect completed runs for missing results, stale asset references, and unfinished tasks. Its output should be proposed findings with evidence, not autonomous prompt edits. Preserve a visible distinction among persona changes, tool instructions, runtime fixes, and experimental context policy.

For an exhibit, add explicit visitor-session boundaries, an operator stop, recovery after network/model failure, and an approved set of public memories and assets. Public-session scope should be a deliberate configuration, not inferred from words such as "stage" or "audience." These are deployment recommendations, not claims that the current performance-mode apparatus should return.

## Positioning and Contribution

A defensible public description is:

> STS is a local-first runtime for an embodied conversational character. It combines a language model with inspectable memory, tool use, expressive bodies, and scheduled background activity, with an emphasis on continuity and the timing of social interaction.

The strongest potential contribution is an **inspectable, reproducible practice of character engineering**: showing how prompt structure, memory selection, expression, latency, and recovery jointly change an interaction. A source-grounded sequence of failures and improvements can be more useful to other builders than a claim that the system is uniquely alive.

The field already contains persistent agents, background memory workers, expressive robots, and asynchronous embodiment runtimes. STS should not claim those inventions. Its opportunity is to integrate them coherently for a particular character and make the integration understandable and controllable.

The project is currently closer to a supervised experimental character platform than an unattended exhibit product. Its best sessions demonstrate real value; unresolved ownership and delivery failures still set the deployment boundary. That is an engineering stage, not a reason to abandon the design. [Current engineering baseline](engineering-status.md)

## Reading Priorities

For immediate work, read the Reachy conversation app, LiveKit turn handling, and Pipecat lifecycle/idle documentation. For the memory experiment, read Mastra's implementation documentation, then the LongMemEval task definitions. For the broader design, read rosaOS, Inner Thoughts, and TypeGo, including their limitations.

Follow Pollen's media and motion changes, Mastra's observation/activation behavior, and AIRI's character lifecycle work. Watch MemCog and speech-motion research for demonstrated low-latency, locally deployable implementations. Revisit these sources when making the relevant decision rather than continuously changing the working stack to follow upstream activity.

## Evidence Limits

No external framework was installed or benchmarked against STS for this report. Comparisons describe documented capabilities and architectural fit, not measured superiority. Repository references point to moving upstream pages; pin a revision before importing code. The local Reachy checkout may be older.

Vendor memory scores use different readers, extraction models, judges, and test configurations. They cannot be combined into a trustworthy universal ranking. A speech demo does not establish tool reliability; a robotics demonstration does not establish long-term companionship; a memory benchmark does not measure whether Eric remains funny.

Implementation licenses, model terms, and motion/avatar/media asset permissions must be checked separately before redistribution. STS's own README currently says a project license has not yet been selected. This report makes no licensing compatibility determination. [Project status](../README.md)

## Sources

All live documentation and repositories below were consulted for the September 13, 2026 assessment. Publication dates are listed when available; undated documentation should be treated as a changing implementation reference.

### Project Baseline

- Robot 790 maintainers. [Project overview](../README.md). Working repository.
- Robot 790 maintainers. [Engineering Status](engineering-status.md). Reviewed September 13, 2026.
- Robot 790 maintainers. [Context Engineering Architecture](context-engineering-architecture.md). Working design and implementation record.
- Robot 790 maintainers. [Artificial Human Landscape](articles/artificial-human-landscape.md). Earlier conceptual and historical orientation; complementary to this current engineering survey.

### Embodiment and Character Systems

- Pollen Robotics. [Reachy Mini Conversation App](https://github.com/pollen-robotics/reachy_mini_conversation_app). Current upstream repository and tool roster.
- Fabien Danieau, Alina Lozovskaya, Caroline Pascal, and Antoine Pirrone, Pollen Robotics. [Eyes, ears, and a voice: building Reachy Mini's media stack](https://huggingface.co/blog/pollen-robotics/reachy-mini-media-stack). June 10, 2026.
- Yijun Ge, Kushaldeep Mujral, Karthik Nambiar, and Jimmy Lin. [rosaOS: Agentic Operating System for Embodied LLMs](https://aclanthology.org/2026.acl-demo.47/). ACL 2026 System Demonstrations, July 2026, pp. 473-480. [Full paper](https://aclanthology.org/2026.acl-demo.47.pdf), [implementation](https://github.com/castorini/rosaos).
- moeru-ai contributors. [AIRI](https://github.com/moeru-ai/airi). Current repository; character and virtual embodiment platform.
- Open-LLM-VTuber contributors. [Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber). Current repository, including v2 planning and memory-status caveats.
- Guojun Chen, Alex Schott, and Lin Zhong. [TypeGo: An OS Runtime for Embodied Agents](https://arxiv.org/html/2607.05482v1). July 6, 2026 preprint, version 1.
- Yuhan Hu, Peide Huang, Mouli Sivapurapu, and Jian Zhang. [ELEGNT: Expressive and Functional Movement Design for Non-Anthropomorphic Robot](https://machinelearning.apple.com/research/elegnt-expressive-functional-movement). Apple Machine Learning Research, January 2025.
- Furhat Robotics. [Users and attention](https://docs.furhat.io/skill-development/reference/users). Current SDK documentation.

### Voice and Runtime

- LiveKit. [Turn detection and interruptions](https://docs.livekit.io/agents/logic/turns/). Current implementation guide.
- LiveKit. [Agent events](https://docs.livekit.io/reference/agents/events/). Current lifecycle reference.
- Pipecat. [Speech input and turn detection](https://docs.pipecat.ai/pipecat/learn/speech-input). Current guide.
- Pipecat. [System frames](https://docs.pipecat.ai/api-reference/server/frames/system-frames). Current cancellation and lifecycle reference.
- Pipecat. [Detecting idle users](https://docs.pipecat.ai/pipecat/fundamentals/detecting-user-idle). Current guide.
- Pipecat. [Function calling](https://docs.pipecat.ai/pipecat/learn/function-calling) and [Flows function types](https://docs.pipecat.ai/api-reference/pipecat-flows/types). Current asynchronous execution and timeout interfaces.
- Pipecat. [Turn Tracking Observer](https://docs.pipecat.ai/api-reference/server/utilities/observers/turn-tracking-observer). Current measurement reference.
- Pipecat. [Benchmarks](https://www.pipecat.ai/benchmarks). Benchmark collection including August 2026 voice-readiness and transcription work.
- NVIDIA. [PersonaPlex project](https://research.nvidia.com/labs/adlr/personaplex/) and [PersonaPlex-7B-v1 model card](https://huggingface.co/nvidia/personaplex-7b-v1). Model released January 15, 2026.
- Koki Nagano, Hongyu Liu, et al., NVIDIA and HKUST. [DyaPlex: Full-Duplex Speech-Motion Model for Dyadic Interaction](https://research.nvidia.com/labs/amri/projects/DyaPlex/). 2026 project; cites arXiv:2606.03874.
- llama.cpp contributors. [Server documentation](https://raw.githubusercontent.com/ggml-org/llama.cpp/master/tools/server/README.md). Current cache and slot behavior reference, not proof of an installed LM Studio configuration.

### Memory, Proactivity, and Background Work

- Letta. [Sleep-time Compute](https://www.letta.com/blog/sleep-time-compute/). April 21, 2025; architecture accompanying the sleep-time-compute research.
- Letta. [Evaluating Memory in Production Agents](https://www.letta.com/blog/evaluating-memory-in-production-agents/). July 28, 2026; vendor evaluation and memory-quality distinctions.
- Tyler Barnes, Mastra. [Observational Memory: 95% on LongMemEval](https://mastra.ai/research/observational-memory). February 9, 2026. The title is the publisher's benchmark claim, not an STS result.
- Mastra. [Observational Memory documentation](https://mastra.ai/docs/memory/observational-memory). Current buffering, activation, scope, and source-linked recall behavior.
- Chris Latimer, Nicolo Boschi, Andrew Neeser, Chris Bartholomew, Gaurav Srivastava, Xuan Wang, and Naren Ramakrishnan. [Hindsight is 20/20: Building Agent Memory that Retains, Recalls, and Reflects](https://arxiv.org/abs/2512.12818). December 14, 2025 preprint.
- Zep / Graphiti contributors. [Graphiti](https://github.com/getzep/graphiti) and [overview](https://help.getzep.com/graphiti/getting-started/overview). Current temporal-memory implementation references.
- Di Wu, Hongwei Wang, Wenhao Yu, Yuwei Zhang, Kai-Wei Chang, and Dong Yu. [LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory](https://arxiv.org/abs/2410.10813). October 2024 preprint; ICLR 2025. [Benchmark repository](https://github.com/xiaowu0162/LongMemEval).
- Xingyu Bruce Liu, Shitao Fang, Weiyan Shi, Chien-Sheng Wu, Takeo Igarashi, and Xiang Anthony Chen. [Proactive Conversational Agents with Inner Thoughts](https://arxiv.org/html/2501.00383v1). December 31, 2024 preprint, version 1.
- Zihan Li, Xingyu Fan, Feifei Li, and Wenhui Que. [MemCog: From Memory-as-Tool to Memory-as-Cognition in Conversational Agents](https://arxiv.org/html/2605.28046v1). May 27, 2026 preprint, version 1.
- Nous Research. [Hermes Agent](https://github.com/NousResearch/hermes-agent) and [Persistent Memory](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/memory.md). Current implementation references.
- OpenClaw contributors. [Heartbeat](https://docs.openclaw.ai/gateway/heartbeat). Current scheduling, routing, quiet-outcome, and busy-deferral documentation.

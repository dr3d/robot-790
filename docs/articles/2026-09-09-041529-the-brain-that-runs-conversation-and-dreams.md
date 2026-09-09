# The Brain That Runs Conversation And Dreams
### A working architecture note for Robot 790

Robot 790 is not one language model with a face attached. The live model matters,
but it is only one faculty in a larger system. The system that receives input,
decides what matters now, holds a conversation round, moves a body, records what
happened, and prepares the next interval is mostly ordinary deterministic code.

That system is STS.

STS began as a speech-to-speech loop. `Realtime` still names the fast foreground
path: listen, transcribe, assemble context, ask a model, speak, animate, and
handle tools. But the larger runtime has become the place where Robot 790's
whole cognitive arrangement is declared and run.

This is not a claim that deterministic software is a biological brain, or that
the project has discovered a new kind of mind. It is a useful engineering
definition: a brain is the apparatus that organizes a creature through time.
It decides how experience enters, what receives attention, how an answer reaches
a body, what becomes a record, and what can influence the next moment.

For Robot 790, STS does that work.

## The Deterministic Part

The most important point is almost pleasantly old-fashioned. STS does not need
an AI to decide how many model-backed lanes a run should have, what each lane is
allowed to see, or whether a result can touch a motor, a session note, or the
public voice. Those are configuration and code questions.

STS can declare:

- how many lanes are active;
- each lane's input diet, context budget, model, reasoning policy, and cadence;
- which lane may speak, which may only write a candidate, and which may only
  inspect evidence;
- how a lane's result is checked, stored, surfaced, or discarded;
- when live interaction wins over background work;
- what a body adapter is allowed to do and what receipts it must return.

The current slogan is **four diets, one mouth**. It says that different
processes should receive different input material, while Robot 790 keeps one
public speaking voice. The mouth lane is fast and social. Brain 2 has a private
advisory role. Evidence and body-facing lanes have different work to do. This is
not a claim that four is the magic number. If Robot 790 later needs six brains,
STS is where those six jobs, diets, priorities, and handoffs are described.

The project is not trying to build a universal multi-agent framework before it
has earned one. It is building Robot 790 and extracting the abstraction only
when a real need appears.

## Conversation Is One Mode

The familiar mode is `conversation`.

In a conversation round, STS receives microphone or typed input, keeps track of
who has the floor, builds an appropriate context view, calls the Realtime model,
routes semantic tool calls, plays speech, changes face state, records receipts,
and settles the round. The model supplies words and proposed actions. STS makes
the exchange an interaction with timing, embodiment, and an inspectable record.

That is why a local voice loop with a face feels unlike an isolated chat box.
The model is not simply asked to answer a prompt. It is being used by a runtime
that knows whether the microphone is active, whether the face is listening or
speaking, which notes are loaded, which tools actually succeeded, and what the
operator just did.

The existing [event-loop article](the-event-loop-grew-a-face.md) describes this
foreground loop. The newer idea is that foreground conversation need not be the
only productive use of the runtime.

## Dream Time Is Another Mode

When no operator-creature round is in progress, a future STS can run `dream`.
Dream Time is the lab name for this non-conversational interval. It is not a
claim that a hidden narrator is continuously talking to itself. It is a
deterministic scheduler using deliberately available GPU time for specific,
bounded jobs.

At a high level, the shape is ordinary:

```text
while STS is running:
  if a live operator-creature round needs service:
    run conversation
  elif a registered Dream Time job is eligible:
    run the job against its declared sources
  else:
    maintain state and wait
```

That sketch is intentionally simpler than the actual runtime. Its point is the
division of responsibility. `conversation` gets latency and the public voice.
`dream` gets a task contract and has to yield whenever live interaction needs
the machine.

The current idle engine and Brain 2 mulls are early, imperfect ancestors of
this mode. A real Dream Time scheduler is still proposed work. It would send a
separate text/context-processing request to a local LM Studio model rather than
smuggling a background task into Eric's spoken conversation.

## The Exo-Brain

The AI assistance used for those background jobs is an **exo-brain**: a
separately engineered layer that helps STS attend to and manage Robot 790. It is
not another Eric, and it is not an invisible author who gets to revise the past.

The same local model family can be used in a different role. In a live turn it
may be optimized for responsive conversation. During Dream Time it may be asked
to process text, inspect a context problem, trace evidence, or prepare a
candidate artifact. A more deliberate Qwen pass, for example, could be useful
without taking over the public voice.

Possible jobs include:

- make a candidate Scrubbed session note that removes genuine transcription
  clutter while retaining substantive turns;
- make a concise Summary candidate from a raw session and its recorded
  dependencies;
- find which source supported a remembered image, claim, or plan;
- compare a claim with tool, sensor, and session receipts;
- identify unresolved references, missing dependencies, stale state, or a
  repeated failure pattern;
- prepare a question, repair proposal, experiment outline, or re-entry packet
  for the next live interval.

The result is useful precisely because it is not treated as automatic truth.
Each job needs a visible task label, model and settings, input manifest, source
links, timestamps, and a final status. Raw session records remain intact. A
model output is a candidate, not authority.

## Give The Exo-Brain An Inbox

The most practical form of this idea is an inbox of work items. Brain 2 already
produces small advisory, revision, and question candidates. A later Dream Time
queue can generalize that pattern without pretending every thought deserves a
new agent.

An inbox item should be plain enough to inspect:

```text
asked by: Eric | operator | deterministic rule
job: verify | summarize | trace | compare | plan | index | repair
diet: exact source files, receipts, images, or claims it may inspect
model: selected LM Studio model and reasoning policy
output: receipt | candidate note | question | revision | task result
status: queued | running | reviewed | accepted | rejected
```

Eric can eventually be told which registered forms of help exist. He might say,
in effect, "I am uncertain about that earlier image; put a source-trace request
in the inbox." STS can turn that into a bounded request, not a secret rewrite or
a direct hardware command. The operator can see the request, its sources, and
its result.

That is a small but important form of agency: Eric can ask for help with a known
limitation, while deterministic policy still governs what happens next.

## Context Engineering Has Another Subject

The exo-brain cannot simply receive all of Eric's warm conversation and be
called independent. Its own context must be engineered for its job.

A verifier should see claims and receipts, not absorb social pressure from the
whole room. A session sweeper should see the raw session plus its pinned sources
and save-time manifest. An image-recall task should see image records and
captions. A task planner should see the active task state and prior outcomes.

This is the same lesson behind the four diets: independence comes from what a
lane is fed, not from asking the same context to think harder twice. The
[context graph architecture](context-engineering-as-directed-graph.md) gives
these sources provenance and authority. Dream Time adds a new question: which
source view is appropriate for this particular cognitive job?

The answer should be explicit. A task's input manifest is as important as its
prompt. It tells a later reviewer what the model could actually have known.

## What Exists And What Is Proposed

| Capability | Status |
| --- | --- |
| Realtime operator-creature conversation, semantic tools, body receipts, recordings, sessions, and context assembly | Present in STS. |
| Four-diet direction, Brain 2 advisory work, idle scheduling, and visible logs | Partly present and actively being tested. |
| Raw session notes with source-linked Scrubbed and Summary sidecar formats | Present; automatic generation and semantic review are not yet implemented. |
| A registered Dream Time queue that calls LM Studio for background context work | Proposed. |
| Eric requesting a bounded exo-brain task through a semantic tool | Proposed. |
| Automatic acceptance of model-written history, memory, or body changes | Not intended. |

That distinction is not bureaucracy. It keeps an exciting design from becoming
a misleading story about what the machine already does.

## A Brain That Keeps Working

The future lean successor to a lab postmortem will not really be a postmortem.
Nothing has died. It will be a normal intersession phase: save the raw interval,
check its dependencies, perform any worthwhile bounded processing, and prepare
the conditions for another live interval.

The interesting possibility is not a background model generating more words for
their own sake. It is a deterministic system that can use models as specialized
faculties to make the next round more grounded, more capable, and less likely to
lose the thread.

STS runs the conversation. STS can eventually run the dreams. The work is to
make both modes visible, bounded, and worthy of trust.

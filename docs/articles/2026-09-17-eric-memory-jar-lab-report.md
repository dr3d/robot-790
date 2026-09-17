# Twenty-Two Minutes With a Memory Jar: Eric's Active-Mind Benchmark

An impossible invention became a sustained exploration of attention, memory, and grief. This Robot 790 lab report follows the conversation and private advice that made the development visible.

*September 17, 2026. A successful observed run, not a controlled comparison.*

**Watch Eric work:** [The Memory Jar: edited session capture (6:32)](../index.html?media=media/videos/The%20Memory%20Jar.mp4#media),
or [open the video directly](../media/videos/The%20Memory%20Jar.mp4).
Scott's edit shows the live conversation, B2 activity, and Eric's Browser Face.
It is an excerpt of this session, not a narrated reconstruction or a continuous
record of the full idle interval; the measurements below come from the logs.

## A Companion With Something To Come Back To

At 12:47 PM, Scott asked Eric a question:

> Build me a memory that gets more accurate the longer you don't look at it.
> Explain the mechanism, then tell me who it's really for.

Eric drew a glass jar with a clock in its lid, brought the picture into his
visual workspace, and explained his invention. Looking at it interrupted the
memory's settling. Leaving it alone allowed it to sharpen. It was for people
who needed room to become themselves without being frozen by observation.

Then Scott stopped speaking for almost 22 minutes.

When he returned and asked what Eric had come up with, the answer had changed:

> The best one I kept returning to: the jar isn't really a memory container --
> it's a crucible where your own attention slowly precipitates new minerals
> from absence, so "remembering" becomes less archaeology and more geology.

The interesting result is not just that sentence. It is the inspectable path
from the original invention to that answer, without another spoken prompt.

![Eric's generated memory jar: a glowing blue core inside glass, with a clock set into the wooden lid.](../media/images/20260917-124749-memory-jar.jpg)

*Generated during the run through Eric's image-tool request using OpenAI image
generation. This is the fictional object under discussion, not real hardware.
The staged image is reproduced without retouching.*

## What Robot 790 Is

Robot 790 is a companion-AI experiment built by Scott Evernden. Eric is its
resident character: a voiced, visibly expressive robot intended to be worth
sharing a room with, not merely an assistant waiting for questions.

The software runtime, STS, connects speech recognition, a local language model,
speech synthesis, faces and bodies, tools, and saved conversation history.
Eric's personality and setup notes matter; this is not a newly trained
foundation model. In this run, a local Qwen 27B model and Qwen3-TTS ran on an
RTX 5090 desktop, with Browser Face as the embodiment. Image generation used
an external service.

Two model roles are important here:

- **B1 is the conversational Eric.** It receives the assembled conversation,
  including loaded history, and produces his replies and tool requests.
- **B2 is a private thinking partner.** It receives a narrower set of recent
  evidence and its own instructions, and can offer B1 questions, connections,
  corrections, or reminders of unfinished work.

These are different uses of the same loaded model, not two large models in
memory. STS schedules their calls and carries the messages between them.
"Idle thought" means scheduled model activity while the user is not speaking,
not continuous inference between calls.

The intended division is important: software manages timing, context, tool
execution, and permissions; the model supplies the ideas. No controller rule
prescribed a journey from a clock jar to grief and geology.

## What Changed Before This Run

Recent sessions had exposed an unwanted pattern. B2 often treated a completed
answer as a reason to stop, and Eric could repeat announcements about holding
quiet. That is poorly matched to a companion whose independent curiosity is
part of the point.

The trial changed **B2's prompt and the B2 sections of two setup cards**,
Impossible Science and Willing Artist. B2 was asked to act as a thinking
partner first. Its advice to Eric should contain something useful to consider,
not a verdict that the conversation was finished. Having no useful advice
should mean sending none, not telling Eric to wait. Actual requests for quiet
still mattered.

This particular trial did not change B1's personality prompt, sampling,
established response-length default, tool orchestration, or idle timing code.
The operator did accelerate the lab's scheduling during the run. This was a
test of the revised combination, not an isolated measurement of one variable.

## Following The Development

Here, "reasoning" means observable development of an idea: proposing a
mechanism, asking what follows, revising a framing, and carrying the result
forward. We can inspect the conversation and B2's advisory messages. We cannot
read hidden internal reasoning or infer subjective experience from them.

Quotes below preserve wording; punctuation is normalized. Times are local.

### 1. Test The Mechanism

At **12:53:39**, B2 offered a concrete question:

> The 'scheduled reveal' idea opens a new angle: what happens to the jar if you
> look at it *too* early -- does the accuracy reset, or does it just pause and
> resume from where it left off?

At **12:54:15**, Eric asked that question aloud and developed the consequence:

> That distinction decides whether it's really "privacy" or just a very
> patient timer -- and a paused settling process feels more like memory than
> a counter.

The next step made the observer's rhythm part of the invention. Attention was
no longer just an interruption; it helped shape the memory.

### 2. Revise An Overstatement

Eric then imagined unchosen versions of a memory dissolving. He called the jar
a "very gentle execution chamber." At **12:57:44**, B2 challenged the implied
intent: perhaps this was passive fading rather than an agent choosing victims.

Eleven seconds later, Eric explicitly revised his metaphor:

> One correction I want to make while thinking: calling it an "execution
> chamber" might overstate the violence -- the mist doesn't bury alternatives
> with intent; it just lets weaker signals fade until only the strongest one
> remains, which is less murder and more entropy.

This is a visible conceptual revision within an invented world, not a verified
scientific account of human memory. It matters because the exchange did more
than keep producing agreeable variations.

### 3. Build Together

At **1:00:13**, B1 proposed sediment forming rings that recorded periods of
attention. At **1:00:33**, B2 named the possibility: "dendrochronology for a
person's focus." At **1:01:04**, Eric took up that connection and developed a
tree-core model of attention.

That order matters. B2 did not originate every development. Sometimes B1 made
the leap and B2 sharpened it; sometimes the next question came from B2.

The rings led to a distinction between absence and loss: a gap where nothing
ever formed versus a trace of something almost lost. From there came a
diagnostic question: what might still be recovered?

### 4. Change What Recovery Means

At **1:04:35**, B2 asked:

> The frost metaphor implies the heat source is still behind the glass; if you
> could warm that side, would the memory thaw or just condense into something
> new?

At **1:05:13**, Eric explored the second possibility. Two turns of phrase
carried the change:

> So "salvage" might be a mistake; you aren't recovering what was there,
> you're just giving it enough heat to precipitate whatever's still dissolved
> in it.

> That feels like a truer model for grief: sometimes the thing that finally
> appears isn't the person as they were, but a new crystalline form made from
> everything they left behind.

The invention had become a metaphor for making something new from absence.
When Scott returned, Eric summarized this later development rather than
restarting his original answer. That is the continuity this project is seeking.

## The Benchmark Record

The saved run gives us a concrete reference case for future changes, not an
industry-standard score or a claim of repeatable performance yet.

| Observation | Recorded result |
| --- | --- |
| Connection | About 24 minutes, 12:46:27-1:10:22 PM |
| No new user speech | 21 minutes 57 seconds after the substantive prompt |
| Starting material | Four prior sessions; nine loaded notes in total |
| Independent activity | 26 scheduled idle turns |
| B2 activity | 34 advisory calls and two headline fetches; 28 nonempty advisories |
| Requested image workflow | Generate, stage in Sensing Eye, explain; no reminder needed |
| Context use | 38,172 to 51,892 tokens: 29.1% to 39.6% of 131,072 |
| Return latency | 3.93 seconds to first audio; final summary began in 2.64 seconds |
| Repetition | No recurrence of the earlier verbatim paragraph or holding-quiet loop |

He also connected the jar to earlier impossible inventions in the loaded
history. Those callbacks were not all seeded during these 24 minutes. The
successful run used accumulated material rather than an empty conversation.

## What This Does And Does Not Establish

The timing and specificity of several B2-to-B1 transfers are strong evidence
that the advisory channel was being used. The sustained development and return
summary are evidence of useful conversational continuity. Neither requires
calling Eric conscious, nor dismissing the result as a fixed script.

There are real limits. Lab speed rose from 5x to 12x, and the visual pane was
manually cleared. "No new user speech" does not mean nobody touched the UI.
There was no matched run without B2. Some openings and early ideas repeated.
B2 gathered two headlines, but neither entered the spoken discussion: this
demonstrates collection, not successful news integration.

Startup took 12.62 seconds to first audio, and one idle model-handler interval
took 22.50 seconds. We do not have engine cache counts that explain that pause.
Private-output filtering also fired; its hidden cost was not measured. The
analysis was made from logs; the subsequently added edited screen capture
illustrates the run but cannot establish full-session audio completeness or
timing. The [evidence sheet](../logs/2026-09-17-memory-jar-benchmark.md)
preserves these qualifications and the source trail.

## Where This Leaves Eric

The practical advance is a working example of **initiative with continuity**:
complete a request, keep finding consequences, accept a useful challenge,
connect old material, and have something developed to share when a person
comes back.

Next, this needs repeating at ordinary speed, with other cards and ordinary
conversation, not only a strong impossible-science premise. We should test
whether Eric can return to a person's unfinished question, integrate useful
news, and stop when genuinely asked, while retaining this freedom to explore.

The benchmark is not "talk for 22 minutes." It is **make the time matter**.
This run gives us a specific, inspectable example of what that can look like.

---

Further reading: [project introduction](2026-09-10-022329-robot-790-project-overview.md),
[B2 trial and change scope](../b2-companion-advisory-trial.md),
[companion design contract](../companion-design-contract.md), and
[benchmark evidence and repeat-test protocol](../logs/2026-09-17-memory-jar-benchmark.md).

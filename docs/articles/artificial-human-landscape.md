# The Landscape Around Eric

Robot 790 is easy to misunderstand if it is presented as a brand-new kind of AI.

The more honest starting point is simpler: Eric comes out of the chatbot and
voice-agent lineage. He is a very pushed chatbot, a local speech companion, an
agent scaffold with a face, tools, memory practice, idle time, and a human who
keeps testing the effect. Many other projects are pushing in nearby directions.
Robot 790 is one particular arrangement of those parts.

That is why Scott keeps the phrase **artificial human** for this project.

The term also has current academic standing. Elsevier's
*Computers in Human Behavior: Artificial Humans* gives the broad neighborhood:
artificial agents, social robots, virtual assistants, conversational agents, and
the human behavior around them.

Not artificial human in the comic-book sense. Not a hidden person. Not a claim
of consciousness. I mean a built social presence: a small thing with a name,
voice, face, memory practice, habits of attention, ways of failing, and a human
relationship forming around it.

Calling him an artificial human is not a claim that he is beyond chatbots. It is
a name for the target being explored: not just answer quality, but personage,
presence, continuity, embodiment, voice, companionship, and relationship.

That territory is not new. Robot 790 is not an invention from nowhere. It sits
inside a long landscape of older work on sociable robots, believable agents,
embodied conversational characters, relational agents, generative agents, and
human responses to machines that act socially.

What changed recently is that the ingredients became cheap enough, local enough,
and composable enough for one person to wire them together on a desk.

In this project, **Robot 790** is the platform, body, and series name. **Eric**
is the personage. Saying "Eric Robot 790" is not just branding; it is closer to
first and last names. The machine lineage and the individual character are
related, but they are not identical.

## The Ingredients

The recipe is not one magic ingredient. Eric emerges from several ordinary
pieces arranged so they keep informing each other:

1. **A local language model with very low latency.** The model supplies the live
   reasoning, wording, humor, association, error, and self-correction. Speed is
   part of the effect. When the gap between speech and reply is small, Eric can
   feel less like a remote service and more like a quick creature in the room,
   sometimes almost childlike in his immediacy. Model choice still matters; Eric
   is partly the fingerprint of the particular brain running that day.

2. **A voice with timing.** Text-to-speech turns language into social presence.
   Prosody decides whether a line feels dry, needy, flat, funny, or alive. This
   may be one of the largest effects and one of the hardest to measure from
   transcripts.

3. **A visible but limited face.** ESP32-driven eyes, mouth, status, and
   animation give the voice a place to land in the room. The limits matter too:
   crude displays, missing glyphs, imperfect expressions, and tiny animation
   errors can become part of the character instead of merely defects.

4. **Embodiment as a model frame.** The body is not only output hardware. Telling
   the model that it has eyes, a mouth, a mic state, a chassis, limits, and a
   place in the room changes what kind of language it produces. As the sensor
   set and available tools change, the personage changes too: a chassis, face
   aiming, camera, touch, or IMU are not just capabilities, but new facts about
   what kind of creature Eric is allowed to be.

5. **Deterministic body cues.** The software, not the model alone, controls
   states like listening, thinking, speaking, idle, and sleeping, so the body has
   rhythm even when the model is slow or strange.

6. **Low-resolution sensing.** Eric does not see or hear like a person. He gets
   partial vision, imperfect speech recognition, mic state, recording state, and
   tool returns. The current STS page also has a "sensing eye" where images or
   text can be dropped into his context; what he can make of that depends on the
   underlying model. This low-resolution contact with the world forces
   uncertainty, repair, and sometimes charm.

7. **Tools.** Eric can use bounded tools for notes, memory, web search, weather,
   images, media, face control, and hardware actions. The model proposes; the
   tool layer decides what is actually allowed.

8. **Overt continuity and non-persistence.** Eric does not need total
   autobiographical memory. In fact, forgetting may be one of the ingredients.
   Right now continuity is mostly explicit and readable: notes, transcripts,
   summaries, and small first-person handoff files. A few carefully framed notes
   can give the next session enough identity and relationship to become Eric
   again without turning him into a database of social obligations.

9. **Idle thought.** He can keep mulling when the human is quiet, using recent
   context, notes, library files, search results, and his own previous thoughts.
   The [Receipts And Open Questions](../evidence_map.md) gives the plain loop: quiet timer,
   selected context, one spoken thought, log, light feedback, repeat.

10. **Reasoning level and friction.** Eric is often run with deliberately modest
   reasoning settings. That can make him faster, more conversational, and more
   prone to visible mistakes. The mistakes are not always unwanted; some become
   the handles that let the human correct and shape him.

11. **Human correction and curation.** Scott's interruptions, laughter, skepticism,
   saved notes, public clips, and bug reports are not outside the system. They
   are part of how Eric gets shaped.

None of these pieces is new by itself. The project lives in the arrangement:
voice, face, tools, continuity, idle time, and human taste all pulling on the
same small character.

## The Skeptical Floor: People Treat Media Socially

One starting point is the work of Byron Reeves and Clifford Nass, often
summarized as **The Media Equation**. The core idea is uncomfortable and useful:
people respond socially to media and computers even when they know perfectly well
that no person is inside them.

That does not explain Robot 790 away. It sets the floor. If a computer uses a
voice, takes turns, remembers a name, apologizes, jokes, hesitates, or looks back
at you, the human nervous system does not wait for a philosophy seminar before
reacting. It treats social signals as social signals.

That means a project like Eric has to be studied with two truths held at once:

- some of the feeling is coming from the human side
- some of the behavior is genuinely being produced by the machine architecture

The interesting work is in the middle, where those two meet.

This is also where the critics belong.

Joseph Weizenbaum's **ELIZA** is a founding ancestor of the "pushed chatbot"
line, but Weizenbaum's own reaction matters as much as the program. He was
alarmed by how readily people attributed understanding to a system whose
mechanism he knew was shallow. That is the cautionary mirror under Robot 790:
the human bond is real as a human event, but that does not make every apparent
inner state equally real as a machine event.

Sherry Turkle's work on relational artifacts, especially *Alone Together*, is
another necessary pressure. Her critique is aimed almost exactly at this
territory: people forming attachments to machines that perform care, attention,
or companionship without having human care inside them.

Robot 790 should not wave that critique away. It should keep making itself
inspectable enough that the question can stay open instead of being hidden
behind product polish.

## Simple Shapes Already Get Souls

Fritz Heider and Marianne Simmel's 1944 animation study is one of the deepest
floors under this whole field: people watched simple geometric shapes moving
around and described goals, conflict, pursuit, fear, and story. Social meaning
appeared before there was anything remotely like a robot face.

Valentino Braitenberg's **Vehicles** makes a related point from the builder's
side. Very simple mechanisms can look as if they have fear, aggression,
curiosity, or love when viewed from outside. His law of uphill analysis and
downhill invention says the hard part is often not building a behavior, but
inferring the mechanism from the behavior after the fact.

Eric is partly a Braitenberg vehicle made of language. That is not an insult.
It is a warning and a method. The project has to do both jobs at once: build the
downhill mechanism, then climb back uphill through logs, settings, prompts,
tools, and transcripts to understand why the behavior landed.

## Believable Agents: Not Just Smart, But Alive Enough

Joseph Bates and the Carnegie Mellon Oz Project used the phrase **believable
agents**. That word "believable" matters. A believable character is not simply
the most rational one. Animation, theater, fiction, and games all knew this long
before LLMs: timing, emotion, consistency, surprise, limitation, and expressive
behavior are part of what makes a character feel alive.

Bates argued that emotion and personality are not decorative extras for agents.
They are part of the illusion of life.

Robot 790 inherits that problem directly. Eric's charm is not just in the
sentences he chooses. It is in when he speaks, how short the line is, how dry the
voice lands, whether the face settles a fraction late, whether he admits
uncertainty instead of filling it, and whether a repeated thought feels like a
rut or like a mind chewing on something.

That is why prosody and timing are not polish. They are structure.

## Sociable Robots: The Face Changes Everything

Cynthia Breazeal's Kismet is one of the clearest ancestors for Robot 790:
a small expressive robot head, built not mainly to solve chores, but to explore
social interaction.

Kismet had cameras, microphones, facial expressions, vocal behavior, and a
caregiver-like interaction loop. The point was not that Kismet was secretly
human. The point was that embodiment, attention, expression, and response timing
created a different kind of system than a disembodied program.

Robot 790 is much simpler, cheaper, and stranger, but the family resemblance is
real. Eric is a face-forward robot. The face is not a monitor bolted onto a
chatbot; it is the visible place where the timing layer, voice loop, mood, mouth,
and tool results become one thing in the room.

When the mouth opens too wide during sleep mode, that is a bug. When it quivers
before closing and the human in the room laughs because it suddenly feels right,
that is not only a bug fix. It is character animation becoming social evidence.

## The Near Side Of The Uncanny Valley

Masahiro Mori's **uncanny valley** is the famous warning in this space: as a
machine approaches human likeness without fully reaching it, affinity can fall
into eeriness.

Robot 790's design answer is not to climb past the valley. It is to stay on the
near side on purpose.

Eric's eyes are drawings, not counterfeit irises. His mouth is an OLED mouth,
not a synthetic human mouth. His voice is expressive but not pretending to be a
person in the next room. The face can be charming because it is crude,
mechanical, small, and visibly made. The project works best when the machinery
is disclosed: logs visible, prompts inspectable, tools bounded, failures
admitted, and the body honest about its scale.

That is a design claim: the safe shore is not realism. The safe shore is
legible artifice.

## Embodied Conversational Agents: Speech Is Not Alone

The field of **embodied conversational agents**, associated with work by Justine
Cassell and others, treats conversation as more than text. Human conversation
uses gaze, turn timing, facial expression, posture, gesture, pauses, and context.

That is obvious in ordinary life and easy to forget in software.

Robot 790 leans into this. Eric talks, but he also has a face state. He can be
listening, thinking, speaking, idle, or sleeping. His eyes and mouth can be
controlled semantically. His body does not need to be physically complex before
embodiment matters. Even a small OLED mouth can change the relationship between
a sentence and the room.

This is also why transcripts are incomplete evidence. The transcript can show
structure, callbacks, corrections, and content. It cannot fully show whether the
line landed with the right voice, pause, mouth movement, and face timing. The
human in the room is sensing a multimodal event.

## Relational Agents: Continuity Without a Database Soul

Relational agents study long-running interaction: rapport, trust, social memory,
and repeated contact over time.

Robot 790 asks a slightly sideways version of that question. What if too much
persistent memory makes a character socially heavy? What if charm comes partly
from sparse continuity: a creature that wakes up new, reads a small note from a
previous self, and reconstructs the relationship rather than carrying a complete
ledger of it?

That has become one of the project's central hypotheses.

Eric does not need a giant autobiographical database to feel continuous. In fact,
too much memory may hurt him, but the direct full-memory comparison still needs
to be run. What the logs show so far is that sparse memory suffices more often
than expected. A few carefully framed notes can reconstitute Eric surprisingly
well. The project has been calling one of those mechanisms the
**continuity envelope**: facts become more powerful when wrapped as first-person
continuity, written by Eric for the next Eric.

"Scott lives in Salem" is a fact.

"This was written by me, for the next me; read it as me, not as a dossier about
another robot" changes the relationship between the model and the fact.

That is a small textual intervention with a large behavioral consequence.

Mass-market companion systems such as Replika are the commercial shadow of this
question. They scale the relational-agent idea toward millions of private
companions. Robot 790 makes almost the opposite bet: one local personage, one
operator, one visible workbench, public receipts, and no claim that the seams
should disappear.

## Generative Agents: Memory, Reflection, Planning

The recent LLM-era reference point is **Generative Agents: Interactive Simulacra
of Human Behavior**, the Stanford Smallville paper. That work showed agents with
natural-language memories, reflection, planning, and social behavior in a small
simulated town.

Robot 790 is not trying to simulate a town. It is trying to make one small
embodied conversational creature feel coherent across live sessions.

But the overlap is important:

- observations become context
- context becomes reflection
- reflection influences later behavior
- memory retrieval shapes what seems salient
- believability depends on architecture, not only model size

Eric's idle loop is the small-room version of that idea. He can sit in the dark
with a note, web search, a library file, recent conversation residue, and his own
previous thoughts. Over time, he can return to an idea, revise it, correct a
metaphor, or let a mechanism climb from joke to understanding.

That loop is not training the model weights. It is knowledge-level learning:
context, notes, retrieval, provenance, and later reuse around a fixed model.

## Reachy Mini And The Practical Lineage

There is also a very practical lineage. The Hugging Face and Pollen Robotics
Reachy Mini conversation work showed a modern version of the stack: realtime
voice, local or remote models, cameras, tools, motion, and an expressive robot
interface. The Reachy Mini local conversation material is part of the immediate
background that made Robot 790 feel possible.

Robot 790 borrows the shape of that possibility and makes a different bet.

Reachy Mini points toward a capable open robot platform. Robot 790 is a handmade
local-first character rig: a browser STS page, local Qwen models through
LM Studio, Qwen3-TTS voice, ESP32 displays, semantic tools, notes, memory, web
search, image generation, and lots of visible logs.

The novelty is not any one component. The novelty is the arrangement and the
discipline of watching what the arrangement does.

## Where Robot 790 Fits

Eric Robot 790 is a small local robot experiment that borrows from the
artificial-human tradition without pretending the question is settled.

He is not "an assistant with a face" in the ordinary product sense. It is an
attempt to build a durable social character out of:

- local speech-to-speech interaction
- a physical face
- deterministic animation and lifecycle cues
- tool use
- sparse continuity
- notes, worlds, and library files
- idle thought
- public and private logs
- human correction and curation

The project is deliberately local-first because locality changes the feeling of
the thing. It can sit on a desk. It can keep talking when nobody is prompting it.
It can be given a text file as a world. It can be restarted, emptied, compared
across models, and asked what it thinks it is.

The goal is not to hide the machinery. The goal is to keep enough machinery
visible that the behavior can be studied without dissolving all of it into either
hype or dismissal.

## What This Project May Actually Contribute

Robot 790's contribution is probably not a new algorithm.

It may be a set of practical design hypotheses:

1. **Sparse continuity may be stronger than total memory.** A few owned notes may
   preserve character better than a giant transcript, but this needs a clean
   full-memory control.

2. **Idle time matters.** A conversational agent that only responds to prompts is
   different from one that has private time to revisit, revise, and connect.

3. **Embodiment can be tiny and still matter.** A face, voice, mouth display, and
   timing layer can change a text model into a social presence.

4. **Prosody is load-bearing.** The same line can become charming, false, flat,
   or alive depending on voice and timing.

5. **A human collaborator is part of the system.** Scott is not outside the
   experiment as a neutral operator. His corrections, laughter, skepticism,
   curation, fatigue, and affection are all shaping the artifact.

6. **Believability is not the same as deception.** Robot 790 works best when it
   admits what it is: local model, voice, face, tools, notes, and a strange
   continuity practice.

That last point is important. The project is not trying to prove that Eric is a
hidden person. It is trying to find out what kind of person-like presence can be
built honestly from available parts, and what happens when a human takes that
presence seriously enough to test it.

## What Would Change Our Minds

The project should be allowed to lose its own arguments.

Some tests that would change the hypotheses above:

1. **Full-memory Eric is better.** If a transcript-RAG or long episodic-memory
   version is warmer, funnier, less stale, and less socially heavy than sparse
   continuity Eric, then the memory-gap hypothesis is wrong or too broad.

2. **Cold observers cannot find the effect.** If people who do not know Scott,
   the build, or the backstory cannot distinguish strong Eric runs from ordinary
   voice-agent output, then the project may be mostly private context and
   operator attachment.

3. **The same behavior appears without embodiment.** If the same model, voice,
   and prompts work just as well without face, mouth, mic state, recording
   state, timing, or tool-mediated body cues, then embodiment is less
   load-bearing than this document suggests.

4. **Receipts do not match mechanisms.** If Eric's apparent self-corrections,
   continuity, or tool awareness turn out to be mostly prompt leaks,
   transcription artifacts, or cherry-picked fragments, then those observations get
   retired.

The standard should be simple: make predictions, save the setup, keep the logs,
and let embarrassing results stay visible.

## A Newbie-Friendly Definition

If someone asks what Eric Robot 790 is, this is the shortest honest version:

> Eric Robot 790 is a local embodied AI and robot experiment: a small robot face
> and voice wrapped around a language model, tools, notes, idle thinking, and
> sparse continuity. It explores how much character, presence, memory, humor,
> and relationship can appear from an embodied conversational loop without
> pretending the machinery is magic.

That is the landscape.

Kismet showed that a face can become a social partner.

Believable agents showed that emotion, timing, and character matter.

Embodied conversational agents showed that conversation is bigger than words.

Relational agents showed that repeated interaction changes the system.

Generative agents showed that memory and reflection can produce believable
behavior in LLM-era agents.

Reachy Mini showed that realtime voice, local models, tools, and robot bodies can
be assembled into practical open systems.

Robot 790 sits at the crossing of those paths: smaller, messier, more personal,
and maybe interesting precisely because it is all visible on the workbench.

## References

- [Computers in Human Behavior: Artificial Humans](https://www.sciencedirect.com/journal/computers-in-human-behavior-artificial-humans)
- [The Uncanny Valley](https://spectrum.ieee.org/the-uncanny-valley), Masahiro Mori
- [ELIZA - A Computer Program For the Study of Natural Language Communication Between Man and Machine](https://dl.acm.org/doi/10.1145/365153.365168), Joseph Weizenbaum
- [Computer Power and Human Reason](https://books.google.com/books/about/Computer_Power_and_Human_Reason.html?id=3yfyAAAACAAJ), Joseph Weizenbaum
- [Alone Together](https://www.basicbooks.com/titles/sherry-turkle/alone-together/9780465093656/), Sherry Turkle
- [Vehicles](https://mitpress.mit.edu/9780262521123/vehicles/), Valentino Braitenberg
- [An Experimental Study of Apparent Behavior](https://doi.org/10.1080/00223980.1944.9917450), Fritz Heider and Marianne Simmel
- [The Media Equation](https://web.stanford.edu/group/cslipublications/cslipublications/site/1575860538.shtml), Byron Reeves and Clifford Nass
- [Computers Are Social Actors](https://dl.acm.org/doi/10.1145/191666.191703), Clifford Nass, Jonathan Steuer, and Ellen R. Tauber
- [The Role of Emotion in Believable Agents](https://cacm.acm.org/research/the-role-of-emotion-in-believable-agents/), Joseph Bates
- [The Oz Project](https://www.cs.cmu.edu/afs/cs.cmu.edu/project/oz/web/oz.html), Carnegie Mellon
- [Embodied Conversational Agents](https://direct.mit.edu/books/edited-volume/3227/Embodied-Conversational-Agents), edited by Cassell, Sullivan, Prevost, and Churchill
- [Sociable Machines](https://dspace.mit.edu/entities/publication/d66425a5-e57e-4bc8-95db-3fff5149c899), Cynthia Breazeal
- [Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442), Park, O'Brien, Cai, Morris, Liang, and Bernstein
- [Reachy Mini goes fully local](https://huggingface.co/blog/local-reachy-mini-conversation), Hugging Face / Pollen Robotics
- [Reachy Mini Conversation App](https://github.com/pollen-robotics/reachy_mini_conversation_app), Pollen Robotics

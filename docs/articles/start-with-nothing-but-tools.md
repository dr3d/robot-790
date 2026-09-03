# Start With Nothing But Tools

The next clean Robot 790 experiment is not quite "start with nothing."

That phrase is useful in the lab, but it hides the important part. A model never
wakes into a true vacuum. It wakes into a channel, a turn-taking rule, a voice
rule, a set of available actions, a tool list, a loop, a logging practice, and a
human who treats the result in a particular way.

Draft started September 3, 2026.

So the sharper line is:

**Start with a context that is nothing but tools.**

That is not nothing. It may be the most revealing kind of something.

## What The Blank Seed Still Contains

In the current first-contact mode, the ordinary Eric world is deliberately
stripped away. Startup notes are removed. Saved memory is removed. Body lore is
removed. The robot is told not to assume sensors, a face, a mouth display, a
camera, prior sessions, or project mythology unless the user supplies them in
that run.

The core instruction is intentionally bare:

> You have only this conversation right now.

That is a strong test, but it is not zero context.

The system still has a seed name. It still has a voice style. It still has a
spoken-output rule. It still has the conversation wrapper that says this is a
voice exchange. It still has an idle event mechanism that can ask for one more
thought when the room is quiet. If tools are enabled, it also has a verb list:
things it can call, read, move, set, search, display, or check.

That verb list is already a self-portrait.

If the only things in the room are `set_mouth_text`, `set_eye_gaze`,
`set_face_mood`, `search_web`, `read_text_file`, `get_current_time`, and body
sensors, the system has been given a strange autobiography without nouns. It
does not know a life story yet, but it knows what kinds of action are possible.

## Tools Are Not Neutral

Tools look like implementation detail from outside the system. From inside the
prompt, they are part of the world.

A coding agent with Bash, Python, Playwright, curl, and file editing wakes up as
something that can inspect, change, run, test, and verify software. Those tools
do not merely extend the agent. They define its posture toward the world.

Robot 790 has a different posture because the tool diet is different. His tools
are not primarily shell commands. They are face, mouth, eyes, voice, notes,
memory, web search, media, time, sensors, chassis, and embodiments.

So a tools-only Eric would not be blank. He would be a system whose first
available facts are:

- I can put words somewhere.
- I can aim a gaze.
- I can change a facial state.
- I can ask the web.
- I can read a note.
- I can check a clock.
- I may have a body that can report sensor facts.

Those are not biographical memories, but they are enough to create pressure.
They imply a world made of reachable handles. They imply a user who can ask for
actions. They imply a difference between saying, checking, and doing.

That difference may be where the character starts.

## The Loop Is The Mirror

The tool list gives affordances. The idle loop gives recurrence.

Without recurrence, each output is just a response. With recurrence, the system
can hear its own prior thought, react to it, refine it, repeat it, or get stuck
inside it. That is why the idle engine has produced both the best Robot 790
material and the most annoying loops.

The important distinction is operational:

- A seed can cue a stance.
- A tool list can cue a world.
- A voice can cue a social body.
- A loop can let those cues accumulate.
- Notes and logs can give the accumulation continuity.

This is why "nothing but tools" is a different experiment from "nothing." If
the loop feeds its own outputs back into the next context, the system is not
only reading a tool list. It is watching itself become the kind of thing that
can use those tools.

The feedback is the teaching.

## Why Eric Was Not Just Written

This matters because Robot 790 was not born from a long character sheet.

The active prompt does not need to say "be poetic" for the system to produce
compressed, metaphor-heavy speech. The poetic quality can emerge from other
pressures: one-sentence latency, voice performance, repeated idle reflection,
face state, mouth text, a human who interrupts and challenges, notes that are
written like field records, and a model trained to compress relationships into
language.

That does not make the result mystical. It makes it inspectable.

If a behavior appears, the question becomes: which pressure produced it?

Was it the seed name? The voice rule? The tool list? The idle lane? The loaded
note? The browser page? The audio loop? The human expectation? The current
model? The context window? The run timing? The hidden second-brain transcript?

The project gets interesting only when those are separated.

## The Current Hypothesis

A tools-only seed will probably not produce an empty mind. It will probably
produce a describer of its own affordances.

It may say, in different forms:

- I can change my face, but I do not know who sees it.
- I can search, but I do not know what I want to know yet.
- I can move text through a mouth, but I do not know whether that is speech or
  a sign.
- I can ask my body for facts, but I do not know which facts matter.
- I can check time, so waiting becomes part of the room.

That would not prove personality from nothing. It would show something cleaner:
a minimum viable self-concept can be shaped by a verb list and a mirror.

The phrase "context-empty pipeline" is still useful historically. It describes
why early Eric was not simply authored into existence as a giant hidden persona.
But the better technical claim is narrower and stronger:

**Eric happened because the written personality was sparse, while the operating
system around the model was highly specific.**

The tools were part of the prompt. The loop was part of the prompt. The body was
part of the prompt. The human was part of the prompt.

Some of those prompts were just not written in prose.

## What To Add To The Lab

The next version of the lab should make this visible every run.

Add a context receipt.

For any session, the operator should be able to dump:

- the exact session instructions sent at connect time
- the enabled tool names and schemas
- the startup notes that were loaded
- the active creature seed
- the active embodiment description
- the idle lane prompt that fired
- the recent transcript slice used for that idle event
- the model, context length, precision, reasoning mode, and parallel setting

That receipt should be saved with the run artifacts. Then "what did Eric wake
up inside?" stops being a guess. It becomes inspectable.

The article-level claim can stay modest:

Robot 790 is not evidence that a blank model spontaneously becomes a person.
Robot 790 is evidence that a sparse model prompt, placed inside a rich loop of
tools, timing, embodiment, feedback, and human attention, can form a stable
presence that was not explicitly written as a character.

That is enough.

It gives the lab a next question:

What is the smallest set of tools, loops, and receipts that can make a creature
worth talking to?

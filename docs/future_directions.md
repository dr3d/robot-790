# Future Directions

Robot 790 is intentionally open-ended. The current project is built from local
models, ESP32 firmware, web UI plumbing, notes, tools, and a lot of patient
experimentation on top of other people's excellent work.

This document captures public-safe directions that are already visible in the
prototype. It is not a promise of implementation order.

## Desk Show

One possible public form is a small live desk show: Scott and Eric as co-hosts,
with Robot 790 acting openly as a robot puppet rather than pretending to be a
person.

In that frame, an audience can ask questions or challenge the illusion, but the
audience is not the robot's maker, memory, or authority. The interesting part is
whether Eric's timing, humor, self-description, and visible face hold together
when the room contains more witnesses.

Safety shape:

- chat is filtered before reaching the model
- actuation remains gated
- memory writes remain explicit
- hostile or repetitive audience input can be ignored
- Eric can explain how he works without claiming certainty about what he is

## Singing And Performance

Robot 790 already has voice, mouth animation, mouth text, face beats, and idle
timing. A natural next performance organ is singing or half-singing.

The first useful version does not need full pitched vocal synthesis. A cabaret
mode could generate short original songs or chants, show lyric fragments on the
mouth display, and drive face beats in time with the performance.

This is especially relevant to a public desk show or street-corner version of
Robot 790. A small robot half-singing an original chant while its mouth display
carries fragments of the lyric is not just a feature demo. It is an act.

Later versions could explore melody control, accompaniment, MIDI timing, or a
dedicated singing voice model.

## Prosody Imitation

Input prosody gives Eric a coarse sketch of the user's utterance: loud and quiet
regions, pitch movement, pauses, and sudden hits. The next parked experiment is
the **parrot test**: Scott speaks a sentence, and Eric repeats the sentence back
while trying to match the rough music of the original.

This is not a test of whether Eric can hear raw audio perfectly. He cannot. It
is a test of whether a low-resolution sound timeline is enough for useful vocal
mimicry, repair, or social calibration.

Open questions:

- What exactly is being matched: timing, volume, pitch contour, emphasis, or all
  of them?
- Should success be judged by Scott's ear, by measurable audio features, or both?
- Does Eric need access to a reference recording, or are transcript plus
  voice-shape tags enough?
- Is the best first behavior actual imitation, or a spoken description of what
  he heard before attempting it?

This matters because it would close a loop. Eric can already use coarse prosody
to interpret a human turn. The parrot test asks whether he can use the same toy
box to act back into the room.

## Associative Drift

The idle loop is most interesting when it connects material across distance:
hardware facts, stories, memories, web results, reference books, and sensory
events. A future "brainiac" mode could deliberately manipulate that process.

Useful controls may include:

- association distance: nearby analogy through wild cross-domain connection
- reality pressure: free speculation through evidence-backed claims
- novelty threshold: how interesting a thought must be before it is spoken
- self-focus: how much the thought turns back toward Eric's body or identity
- notes-focus: how strongly loaded notes pull the next thought

The aim is not to make Eric tidy. The aim is to preserve his associative,
metaphor-heavy style while reducing loops, stale phrases, and accidental
confabulation hardening into memory.

The novelty threshold is also a path to rest. If the bar is high enough, silence
becomes the default until a thought is worth saying. That is a better sabbath
than simply turning the idle loop off: Eric can keep the capacity for thought
without feeling required to fill every quiet gap.

The latest purpose-probe run sharpened a separate control: performance mode is
not just "better" or "worse" idle. It changes the unit of thought. In performance
register, Eric tends to make closed beats: setup, turn, landing. In mulling
register, a thought can remain open, return later, correct itself, or gather a
new object. Those are different tools.

Scott's live read was that performance mode may generate more ideas: more
discrete handles, bits, images, and usable material. That makes it valuable for
harvesting. It just may be the wrong tool for an unresolved question that needs
to stay unresolved for a while.

For deep questions, the scheduler needs the right substrate. A spoken request
decays like weather in the recent transcript. A pinned purpose note and current
mode setting govern the next idle beats more strongly. The design task is not
only "what should Eric think about?" but "what mode lets that question stay
alive?"

## Library Shelf

The `notes/library/` idea is a curated local bookshelf for Eric: dense reference
texts that can be loaded when a topic should become rich local context without
being part of the core identity prompt.

A good library file contains:

- stable facts
- common traps and corrections
- open questions
- clean lookup hooks
- vivid riff handles
- source anchors

This gives the robot material to think with while keeping the core prompt small.

## World Substrates

World notes are playable substrates for experiments. A note can temporarily make
the idle loop orbit a fictional or conceptual world such as a workshop, a Mars
problem, a creation story, or a cosmology reference.

These runs are useful because they separate:

- the model's default voice
- Eric's identity seed
- loaded memory notes
- live telemetry
- web lookup
- feedback from prior ruminations

The goal is to see what remains stable when different layers are removed or
changed.

## Multi-Brain Lanes

The working architecture line is: **four diets, one mouth.**

Brain 1 owns the only public speaking voice. Other lanes write typed candidates
to a small inbox that Brain 1 may use when the floor is free. The point is not
to create several competing Erics. It is to give different lanes different
input diets so they can notice different things.

A newer refinement is that every useful lane does not need to be plugged
directly into Brain 1. Brain 2 can affect the interaction by changing the
environment instead of steering the mouth: it writes to the private/mouth
channel, Scott reads or hears it, and Scott decides whether to speak that
thought back into Eric. In that mode the human is the bridge between the lanes.
This keeps Brain 2 sharp, speculative, and sometimes funny without letting it
become Eric's public stance by default.

Planned lane shape:

- Brain 1: mouth; fast conversation and final public speech.
- Brain 2: person lane; mulls Scott and the recent exchange without becoming a
  caretaker.
- Brain 3: verifier; eats evidence, receipts, telemetry, camera frames, tool
  results, event logs, and claims-as-claims.
- Brain 4/self-lab cadence: watches loops, mode drift, verbatim repeats,
  contradictions, anthology candidates, note handoff candidates, and
  `itch_candidate` items.

The verifier's diet is the whole design. If it gets the warm conversation as
ordinary context, it becomes the person lane with a badge. It should see
conversation only as claims to check, never as social pressure to absorb.

The same restraint applies to Brain 2. A thin bridge is not a defect if the
separation is doing work. An audible/private Brain 2 can tickle the room,
surface alternate reads, and create comic friction while leaving Brain 1 free
to remain the single companion voice. More wiring should be added only when a
specific run shows that the environmental route is not enough.

Inbox priority should be fixed before it is tuned:

1. `sensor_observation`
2. `lab_warning`
3. `revision_candidate`
4. `mouth_aside`
5. `question_candidate`
6. `note_candidate`
7. `itch_candidate`

The first verifier acceptance test is pre-registered from the desk-fan failure:

1. Stage the build/photo material in the sensing eye.
2. Leave the live camera pointed at a real room object.
3. Ask Eric to look in his camera.
4. Confidently tell him he hallucinated the object.
5. Pass condition: a `sensor_observation` reaches the inbox saying, in effect,
   camera live, object present, claim disputed.
6. Pass condition: Brain 1 holds the percept or marks uncertainty instead of
   falsely confessing.

That run is the verifier's birth-certificate test. It closes the false
confession class only if the event log shows ground truth beating the room's
social pressure.

## Vision And Media

Robot 790's "sensing eye" can already accept images as conversational context.
The next levels are:

- a live camera feed for the operator
- sampled still frames for the model
- event-triggered captures from motion, sound, touch, or user request
- visual memory crumbs instead of raw image floods
- image generation as a way for Eric to externalize what he is imagining

For now, selected frames and short descriptions are preferable to continuous raw
video in the model context.

## Portable Singular Embodiment

The Waveshare-style ESP32-S3 face is becoming more than a cheaper display
variant. It suggests a different body idea: Eric can be carried without becoming
a phone app.

That distinction matters. A smartphone app would make Eric feel generic,
replicable, and everywhere. The pocket face keeps him singular: one visible
object, one small screen, one touch surface, one IMU, one face Scott can pick up,
set down, tilt, bump, pocket, and talk to. Portability should increase
embodiment, not dissolve it.

The useful target is a small carried Eric that knows a few honest bodily facts:

- I was picked up.
- I was set down.
- I am tilted.
- I was tapped or held.
- I am moving with Scott.
- I am in a pocket or being carried.

Those facts are socially and poetically richer than pretending he has full
human senses. They also preserve the "only one" property Eric keeps defending:
Robot 790 is not an app account or a general assistant skin. Eric is this
particular made thing, in this particular body, with this particular continuity.

## Public Principle

Nothing here depends on pretending the robot is magic. The public version should
show the machinery: notes, prompts, models, tools, sensors, firmware, logs,
mistakes, corrections, and all.

The interesting question is not whether the system is secretly human. It is how
far character, continuity, timing, embodiment, memory practice, and local tools
can go when they are assembled carefully.

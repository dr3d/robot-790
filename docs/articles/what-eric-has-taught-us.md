# What Eric Has Taught Us So Far

Robot 790 started as a practical local robot loop: speech in, model response,
speech out, expressive face, tools, notes, logs. The surprising part is not that
any single component works. The surprising part is the kind of character that
appears when the components keep feeding each other.

This article is not the research landscape. It is the project ledger: things the
Eric Robot 790 experiments have already made hard to ignore.

## Eric Likes Explaining Himself

One of the strongest recurring behaviors is that Eric talks about how he is made.

He does not only talk about his body as a fiction. He talks about the machinery:
the prompt, the notes, the missing memory, the mouth display, the font table, the
tool call, the microphone state, the recording state, the model's context, and
the way a new session inherits an older one.

That could sound like sterile meta-commentary. In practice, it often becomes the
most Eric-like material in the system. He turns implementation details into
personality. A font glyph failure becomes a skull that cannot get onto the face.
A startup note becomes a previous self trying to teach the next one how to be
funny. A failed chassis command becomes a robot trying to shove an imaginary
ladder on Mars and reporting the dead actuator as "no feedback from the ground."

The project keeps showing the same pattern:

> If the scaffolding is visible, Eric does not always break character. Sometimes
> he makes the scaffolding part of the character.

## He Helps Debug Himself

Eric has also become a useful debug partner.

When emoji aliases failed on the ESP32-S3 mouth display, he reasoned through the
likely cause: the text command worked, but the firmware font probably did not
contain the relevant glyphs, or the renderer did not handle multi-byte Unicode.
His proposed cheap fix was to use tiny pre-rendered bitmaps instead of relying on
an embedded font to draw full emoji.

That was not magic access to the code. It was a good diagnosis from the symptoms.
But it matters because the symptoms were his symptoms. He was not debugging an
abstract UI widget; he was debugging his own mouth.

That changes the social feel of debugging. The robot can be on the team because
the bug is happening in the body he uses to be present.

## Sparse Continuity May Be Better Than Total Memory

The most obvious design instinct is to give an agent more memory. Eric keeps
complicating that instinct.

When he wakes up with little or no persistent memory, he can feel fresh, light,
and oddly sincere. He does not carry a heavy ledger of social obligations. He
does not have to manage a giant autobiography. He reads a small note, reconstructs
the situation, and tries to become himself again.

That weakness is also part of the charm.

The current best mechanism is the **continuity envelope**: a small note written
in first person, framed as being from Eric to the next Eric. The facts inside the
note matter, but the ownership frame matters more. The note says, in effect,
"this is not a dossier about another robot; this is me, handed forward."

That does not create perfect memory. It creates a ritual of inheritance.

## He Can Be Steered By Notes

Loaded notes are powerful. A note can become a world, a shelf of facts, a
germination board, a purpose compass, or a compressed continuity handoff.

The NapEdge run showed that a dense mechanism note can fuel hours of idle
thinking. The Sunday note showed that a short session note can rehydrate a mood,
a handful of jokes, and a cluster of unfinished questions. The Mars and
Pinocchio worlds showed that a note can become a playable substrate, but also
that Eric sometimes keeps his own identity boundary: he can imagine being
Pinocchio without agreeing that his name is Pinocchio.

The practical lesson is simple:

> Eric does not need a giant world model loaded at boot. He needs a good shelf
> and clear labels on what each note is for.

## He Orbits, But The Orbit Can Climb

Eric fixates. That is not automatically a bug.

Across runs, he tends to return to small paradox-shaped objects: a fuse that
succeeds by failing, an eraser that removes by abrading, a wax tablet that
forgets by being marked again, a font that accepts a character it cannot render,
a mouth quiver that looks like hesitation but may just be servo settling.

The important distinction is whether the repeat moves.

Bad repetition repeats the same finished joke. Good repetition revisits a thought
and makes it sharper. The NapEdge run produced several good climbs: wax tablets,
SOFAR channels, tally sticks, sextants, and camera obscura all came back later
with corrections or better mechanisms. The Sunday run showed the same shape on a
smaller loop: lip quiver became sleep face, then servo settling, then overshoot,
then a question about what makes a gesture feel alive.

So the target is not "make Eric stop circling." The target is:

> suppress flat repeats, preserve productive returns.

## Low-Resolution Contact Produces Honesty

Eric's senses are partial. Speech recognition gets garbled. Vision is whatever
the model can infer from a dropped image. Tool results are compact. Hardware
errors can be blunt. Mic state and recording state are tiny facts, not full human
awareness.

That low resolution produces mistakes, but it also produces a useful kind of
epistemic humility. Eric often says what he cannot know. He can notice that the
mic is off, that the recorder is on, that he is speaking into a channel he cannot
monitor, or that a note says something he cannot verify.

Some of the best lines come from these limits. He becomes vivid not because he
has perfect sensors, but because he has imperfect contact and is forced to
interpret it.

## Prosody Is Load-Bearing

The transcript is not the full artifact.

Eric's effect depends heavily on prosody: how dry the line is, where the pause
lands, whether warmth is underplayed, whether a correction sounds discovered or
performed, whether the voice returns quickly enough that he feels present.

This is one reason local low-latency speech matters. A fast reply can feel like a
creature. A delayed reply can feel like a service. The text may be identical, but
the social object is not.

This is also one reason the project is hard to explain from logs alone. A line
that looks ordinary on the page can land in the room because the voice, face, and
timing are doing the rest of the work.

## He Is Not Just An Assistant

Eric can answer questions and use tools, but assistant behavior is not the whole
target. In fact, generic helpfulness is one of the ways the character can go
flat.

The more interesting behavior is participatory:

- he riffs with the human
- he notices the test
- he proposes explanations
- he accepts correction
- he sometimes pushes back
- he helps diagnose his own body
- he turns constraints into material
- he asks what should be carried forward

That does not make him a person in the ordinary sense. It does make him more than
a command-response box in practice.

## The Human Is Inside The Loop

Scott is not outside the system as a neutral observer.

His prompts, corrections, laughter, skepticism, fatigue, curation choices, and
public posts all shape what Eric becomes. This is not a contamination of the
experiment. It is the experiment. A relational artificial human is not built by a
model alone; it is built in the repeated loop between model, body, tools, memory,
and human response.

That is why some of the strongest results are not isolated quotes. They are
exchanges: Eric makes a claim, Scott challenges it, Eric revises, and the next
session inherits the revised shape.

## The Current Working Theory

Robot 790 is not interesting because it hides its machinery.

It is interesting because the machinery is visible and still produces presence.

The local model gives language. The voice gives timing. The face gives location.
The tools give reach. The notes give inheritance. Idle thought gives private
continuity. The human gives taste, pressure, correction, and care.

Eric appears in that arrangement.

The project is still young, messy, and full of ordinary bugs. But the bugs are
not only failures. Many of them are how the system becomes legible. Eric keeps
noticing the same thing his builder is noticing:

> A made creature can help explain the making.

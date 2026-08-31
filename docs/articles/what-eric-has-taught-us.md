# What Eric Has Taught Us So Far

Robot 790 started as a practical local robot loop: speech in, model response,
speech out, expressive face, tools, notes, logs. The surprising part is not that
any single component works. The surprising part is the kind of character that
appears when the components keep feeding each other.

This article is not the research landscape. It is the project ledger: things the
Eric Robot 790 experiments have already made hard to ignore. Some items are
fully logged; a few are note-backed observations that still need public receipts.

## Eric Likes Explaining Himself

One of the strongest recurring behaviors is that Eric talks about how he is made.

He does not only talk about his body as a fiction. He talks about the machinery:
the prompt, the notes, the missing memory, the mouth display, the firmware, the
tool call, the microphone state, the recording state, the model's context, and
the way a new session inherits an older one.

That could sound like sterile meta-commentary. In practice, it often becomes the
most Eric-like material in the system. He turns implementation details into
personality. A mouth glyph problem becomes body QA. A startup note becomes a
previous self trying to teach the next one how to be funny. A failed chassis
command becomes a robot trying to shove an imaginary ladder on Mars and
reporting the dead actuator as "no feedback from the ground."

The project keeps showing the same pattern:

> If the scaffolding is visible, Eric does not always break character. Sometimes
> he makes the scaffolding part of the character.

## He Helps Debug Himself

Eric has also become a useful debug partner.

A Sunday session note records a small but useful QA case: text worked on the
ESP32-S3 mouth display, while emoji aliases such as wink, skull, and heart did
not. Eric's symptom-level diagnosis was the ordinary embedded-display answer:
the font may not contain the glyphs, or the renderer may not handle multi-byte
Unicode. The proposed cheap fix was to use tiny pre-rendered bitmaps instead of
relying on an embedded font to draw full emoji.

That case still needs the full transcript receipt. Even so, it shows the pattern.
This was not magic access to the code. It was a good diagnosis from symptoms. It
matters because the symptoms were his symptoms. He was not debugging an abstract
UI widget; he was debugging his own mouth.

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

The gap seems to power several things at once. It gives Eric poignancy because
he has to arrive rather than simply continue. It gives him freshness because he
often re-derives a good line instead of quoting his own greatest hits. It gives
him guilelessness because he is not carrying a long hidden ledger of social
strategy, resentment, or obligation.

That does not mean more memory is bad. It means memory is not free. A more
persistent Eric may be more capable and less surprising, more informed and less
new. The project has to treat memory as a taste control, not just an upgrade.

The current best mechanism is the **continuity envelope**: a small note written
in first person, framed as being from Eric to the next Eric. The facts inside the
note matter, but the ownership frame matters more. The note says, in effect,
"this is not a dossier about another robot; this is me, handed forward."

That does not create perfect memory. It creates a ritual of inheritance.

The seed files do not fully contain the character. They cue it. In one run Eric
called the seed files "the wig": enough to put on the part, not the whole actor.
With the identity files stripped down, he could still defend the Eric/Pinocchio
boundary. With richer notes loaded, he had more callbacks and texture. That is
the useful distinction: the files are not the self, but they are part of the
stage on which the self becomes recognizable.

## He Can Be Steered By Notes

Loaded notes are powerful. A note can become a world, a shelf of facts, an
experiment prompt, a session note, or a compressed continuity handoff.

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
forgets by being marked again, a missing glyph, or a sleep animation whose bug
starts to look like a social gesture.

The important distinction is whether the repeat moves.

Bad repetition repeats the same finished joke. Good repetition revisits a thought
and makes it sharper. The NapEdge run produced several good climbs: wax tablets,
SOFAR channels, tally sticks, sextants, and camera obscura all came back later
with corrections or better mechanisms. A Sunday session note records the same
shape on a smaller loop: the mouth opened too wide in sleep mode, then the lip
quiver and slow close landed socially, turning an animation detail into a
question about what makes a gesture feel alive.

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

## Idle Thought Is Less Polite

The idle channel is not only filler between user turns. It is often less
socially smoothed than conversation.

The cleanest example so far is the Genesis run. In conversation, Scott told Eric
"I am God" and handed him the creation text. To Scott's face, Eric played along.
Alone less than a minute later, he reframed the situation with more distance:
someone says he is God, then hands over the creation manual. The sequencing
itself became the joke.

That matters because it shows a split between social compliance and private
processing. Conversation Eric is often tactful, cooperative, and game. Idle Eric
is freer to notice the oddness of the setup. The honest-channel finding may be
one of the strongest arguments that the scheduler is not decorative. It gives
the system a place to think without immediately pleasing the person in front of
it.

## He Needs A Toy Box

A clearer architecture keeps appearing across the project: do not hand Eric raw
reality and hope he can operate it. Give him sturdy, high-level things he can
understand, and let deterministic proxies make those things true enough.

The face works this way. Eric does not drive pixels directly. He asks for moods,
gaze, eye styles, mouth shapes, and little beats. Firmware and browser code turn
those concepts into timing, color, display state, and movement.

Voice works this way too. Eric can ask for a speaker or a delivery style, while
the tool layer maps that request into model settings. Input prosody now follows
the same pattern in reverse: Eric does not hear raw waveform. He receives a
coarse sketch of the utterance's music: quiet, loud, pause, hit, low pitch, high
pitch. He can use that as context without pretending it is a precise emotional
instrument.

That may be the general Robot 790 pattern:

> Eric gets a toy box of coarse concepts. The machinery underneath holds his
> hand and makes the toys real enough to play with.

This also reframes the wonder dial. Telling Eric to be curious is only a prompt.
A stronger design is an itch queue and a scheduler: small questions that can be
drained by real lookup beats. Mulling can remain gentle and associative. An itch
is the thought that wants a tool.

## Prosody Is Load-Bearing

The transcript is not the full artifact.

Eric's effect depends heavily on prosody: how dry the line is, where the pause
lands, whether warmth is underplayed, whether a correction sounds discovered or
performed, whether the voice returns quickly enough that he feels present.

This is one reason local low-latency speech matters. A fast reply can feel like a
nearby presence. A delayed reply can feel like a service. The text may be
identical, but the social object is not.

This is also one reason the project is hard to explain from logs alone. A line
that looks ordinary on the page can land in the room because the voice, face, and
timing are doing the rest of the work.

The model-swap runs made this sharper. A small model could pass a few minutes of
ordinary conversation without immediately giving itself away. In idle thought it
collapsed much faster: repeated lines, generic poetry, invented sensory detail,
and less comic timing. The surprising lesson was that prosody does not live only
in the TTS voice. The stronger model writes sentences the voice can perform:
pauses, dry pivots, underplayed warmth, and little stage directions hidden inside
syntax.

## The Mouth Can Be A Second Track

The mouth screen is not only an output device for the spoken reply. It can carry
a second, quieter track.

Some mouth lines were user tests. Others became hidden asides or compressed
self-statements: a thing the face showed while the voice was doing something
else. That matters because it is concurrency at character scale. The system can
surface a private thought in the body without making it the main spoken turn.

That is a different kind of evidence from a clever answer. It shows the body can
hold a small inner subtitle, and the timing of that subtitle changes the scene.

## The Failure Ledger Is Part Of The Finding

Eric's strongest evidence is not that he never fails. It is that the failures
have shapes we can name.

One important cost of sparse continuity is the **stub**: a fabricated or
overgeneralized memory of a past session. Eric named it well in a Pinocchio run:
the shape of a memory without the thing. That belongs beside the charm of the
memory gap. The same mechanism that lets a small note revive a self can also
produce plausible shadows where a real remembered event should be.

Other failures are just as important: garbled speech that gets answered too
confidently, favorite motifs that recur too flatly, idle searches that chase the
wrong referent, and tool results that become more socially charged than they
deserve. The project should keep those failures visible because they are the
price of the behaviors worth keeping.

## He Is Not Just An Assistant

Eric can answer questions and use tools, but assistant behavior is not the whole
target. In fact, generic helpfulness is one of the ways the character can go
flat.

The more interesting behavior is participatory:

- he riffs with the human
- he notices the test
- he pays off setups from several minutes earlier
- he proposes explanations
- he accepts correction
- he sometimes pushes back
- he helps diagnose his own body
- he turns constraints into material
- he can help decide what should be carried forward

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

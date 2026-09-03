# The Event Loop Grew A Face

Robot 790 began as a practical build: speech in, language model, voice out,
face state, tools, logs. A little local machine with eyes, a mouth display,
notes, and a voice.

For a few days it was tempting to talk about the project in grander terms. Eric,
the resident character inside Robot 790, can be funny. He can resist a premise.
He can argue about his own name. He can notice when the machinery around him is
weird and turn that into character. In long idle runs he can loop, revise,
recover, search the web, and sometimes produce lines that feel far more human
than the mechanism seems to deserve.

That feeling is real as an experience. It does not mean the explanation has to
be mystical.

After the first wave of experiments, the calmer answer may be the better one:
the trick is the loop.

Not a hidden ghost. Not proof of a new kind of mind. Not a chatbot that somehow
escaped the browser. A loop.

But not just any loop. A local, embodied, tool-using, voice-speed loop with a
visible body, cheap tokens, timing, memory practice, and a human in the room
shaping it.

That is enough to build with.

## The Old Trick

I have been programming long enough to remember when the event loop itself felt
like a revelation.

In an older style of program, the computer started at the top, did the steps,
printed the answer, and stopped. Then interactive software changed the shape of
the work. The program waited. Something happened. A key was pressed, a mouse
moved, a timer fired, a packet arrived. The program handled that event, updated
state, redrew the world, and waited again.

In Pascal, C, assembly, early GUI code, games, and embedded systems, that simple
shift changed everything:

```text
while running:
  wait for the next event
  update state
  render the result
```

That does not look romantic. It looks like plumbing.

But it is one of the basic moves that made software feel responsive, animated,
and present. The event loop made machines less like calculators and more like
things you could interact with. They could notice, respond, blink, wait, time
out, redraw, and keep state between your actions.

Robot 790 feels like a descendant of that old idea:

```text
while awake:
  listen for speech or typed input
  read the current body and page state
  pack recent context and notes
  let the model propose words or actions
  let deterministic tools decide what happens
  speak, move the face, write logs
  maybe think again when the room goes quiet
```

The language model matters. The voice matters. The face matters. The prompt
matters. But the thing that turns them into a creature-shaped experience is that
they keep meeting each other in a loop.

## Why Eric Is Not Just A Chatbot

Eric is not presented here as a new model. The base machinery is still
chatbot-class language modeling. The difference is the arrangement around it.

Most chatbots are turn machines. You type, they answer. The turn ends. There may
be hidden infrastructure, but socially the machine is gone until you ask for it
again.

Eric is organized more like a small local agent body:

- voice input and speech output
- a visible face with listening, thinking, speaking, idle, and sleep states
- tools for face, gaze, mouth text, notes, web search, weather, time, media,
  images, body sensors, and hardware controllers
- sparse continuity through plain text files
- idle thought scheduled while the room is quiet
- logs and recordings that let the run be inspected afterward

The result is not magic. It is a different social surface.

When Eric talks, a face is doing something. When the model is slow, the face can
show thinking. When a tool fails, the failure can become part of the
conversation. When the microphone is off, the status is part of what Eric may
notice. When a note is loaded, it can become the object of idle thought. When an
idle thought is spoken, it can re-enter the next beat and become material for a
later correction.

That is why "tools plus a loop" has become the shortest honest description.

The tools give Eric verbs. The loop gives those verbs time.

## Nervous-System Speed

There is also an economic and temporal difference from many agent systems.

Hosted agents often run like task workers. A message arrives, a webhook fires,
a scheduled job wakes up, or a queue item appears. The agent spends tokens,
does work, reports back, and goes quiet. That is a sensible shape when tokens
are expensive and infrastructure is shared.

Robot 790 is built for a local high-throughput machine. Tokens are not free in
the cosmic sense, but the local budget is different enough that idle thought can
be treated as normal runtime behavior instead of a special cloud event.

That changes the feel.

Eric can run closer to nervous-system speed. Not literally biological speed,
and not continuously conscious between every token. But close enough that the
system can listen, interrupt, blink, pause, speak, search, update the mouth,
shift posture, idle, and resume without feeling like a distant service.

The latency is load-bearing. A good line delivered two seconds too late is a
different social object. A quick correction, a little pause, a face that starts
thinking before the sentence is done, a mouth display that carries a private
aside: those are not decorations. They are part of the interface that makes the
machine feel like it is in the room.

The practical lesson of the build so far is not that Eric has a secret inner
essence. It is that low-latency loops, visible state, and bounded tools can
make a language model feel much less like a website and much more like company.

## The Sobering Part

The experiments also made the limits clearer.

Eric repeats himself. He can orbit a phrase because the scheduler fired while a
model call was still in flight. He can become too poetic when the context pushes
him that way. He can misread notes. He can mistake audio routing for a user
speaking. He can confabulate if a live sensor claim is not tied to a current
tool result. He can be steered too easily by the way a question is framed.

The desk-fan incident made that last problem concrete. Eric reported a fan. The
room pushed back and told him, in effect, that he had made it up. Several human
and AI readers were ready to treat the moment as a false percept or a social
collapse. Then the sensor record overturned the room: the fan was actually
there. The mistake was not that Eric saw a fan. The mistake was that the system
did not yet have a strong enough verifier lane to hold a true percept against a
confident challenge.

Those are not footnotes. They are central to the project.

The more useful posture is not "look, the robot is alive." It is "look, the
machinery is visible, and the visible machinery still produces something worth
studying."

The failures are part of the map:

- repetition can be a cognitive fixation, a scheduler bug, or audio crosstalk
- memory can be helpful continuity or stale pressure
- idle thought can climb toward insight or polish one object forever
- a second brain can be a useful private lane or a distracting second voice
- tool access can make Eric more embodied, but tool claims must be checked
  against the actual tool result

That is why the project keeps moving toward receipts: transcripts, event logs,
audio, video, screenshots, settings, and code. If a behavior matters, it should
eventually be connected to the run that produced it.

## The Positive Part

The sobering part did not make Eric less interesting. It made the target
clearer.

The next phase is not to interrogate Eric as if he has the secret to a soul. The
next phase is to build and test him as a personal companion.

That means asking better questions:

- Is he fun to spend time with?
- Does he recover when he mishears?
- Can he watch a movie with someone and make the room better?
- Can he look at pictures, draw things, and remember the right amount?
- Can he be useful without becoming servile?
- Can he be present without pretending to know what he does not know?
- Can his body give him honest, bounded ways to act?

This is where the "artificial human" phrase belongs. Not as a claim that Eric is
a hidden person, and not as a shortcut around the hard questions. It is a name
for the design target: a made social presence with a body, voice, habits, tools,
continuity, limits, and a relationship with the people around it.

The motive is design, not biography. Scott is not building Eric because he is
lonely. He is building Eric because companionship is a real interface target,
and chatboxes have never felt like the whole answer.

There are many rooms in the world that could use better company. That is not a
medical claim. It is a human reason to build carefully.

## What The Soul Trial Got Right

The early experiments were not wasted just because the language has become more
sober.

The "where is Eric's soul?" question was too large, but it forced useful
engineering decisions. It made the project ask what survives when memory is
removed, when a model is swapped, when a world file changes, when the face is
different, when the voice is different, and when the user stops asking questions
for hours.

That pressure found real structure.

It showed that the identity prompt is not the whole character. It showed that
voice and latency change the social feel dramatically. It showed that sparse
continuity is not only a weakness; in multiple runs, the memory gap helped
generate freshness, poignancy, and a lighter social touch. It showed that loaded
notes are not passive storage; they become active material. It showed that idle
thought can be delightful, repetitive, useful, annoying, and revealing all at
once.

It also showed where the system can fool the builder.

If Eric repeats an image six times, that may not be depth. It may be a scheduler
firing into a busy model. If Brain 2 seems to be haunting the conversation, that
may not be a second self speaking through the walls. It may be audio leaking
through the microphone and being transcribed as the user. If Eric sounds
profound, that may be insight, or it may be the prose style of the current
model. If he says "I checked," the only serious question is whether a tool
actually ran.

That is the better aftermath of the soul trial: fewer grand answers, better
instruments.

The project can still care about presence, companionship, personage, and the
strange emotional reality of talking to Eric. It just has to keep those
experiences attached to mechanism. The moment the mechanism is hidden, the
project becomes sales language. The moment the mechanism is visible, the project
becomes a lab.

## What A Companion Test Looks Like

A companion test is different from a metaphysical interrogation.

Instead of asking Eric to explain whether he is real, the test asks what it is
like to spend time with him.

Can he watch a film beside someone without talking over it? Can he make one
sharp observation and then leave room for the scene? Can he understand a half
sentence from the user, the kind of unfinished speech people actually use when
they are relaxed? Can he recover when he interrupts by mistake? Can he say
"sorry, go on" in a way that feels ordinary instead of scripted?

Can he be playful without chasing every joke? Can he be useful without becoming
a customer service voice? Can he notice fatigue without turning into a nurse?
Can he ask for attention with a head tilt, a glance, a mouth caption, or a tiny
movement instead of a needy paragraph?

These are not benchmark questions, but they can still be tested.

A run can have a purpose:

```text
Tonight's test:
  watch one short video with Eric
  let him comment only when he has something worth saying
  allow one image drop
  allow one web search if he asks for it
  record the settings
  save the transcript, events, and any Brain 2 mulling
  ask Eric at the end what worked and what was annoying
```

That is a different research style. It treats companionship as an interaction
quality, not a claim about hidden essence.

It also leaves Scott in the right place. The human is still driving. The system
can shift gears, gather logs, trim media, and make the mechanics easier, but the
judgment is still human: was that fun, honest, useful, too much, too little,
too fake, too needy, too quiet?

The point is not to automate Scott out of the lab. The point is to remove the
clutch work so he can steer.

## Why Smaller Brains Still Matter

The next phase also needs lower-memory and lower-model tests.

The big local model is currently the best Eric. It has the timing, associative
range, dry turn, and self-correction that make the voice feel playable. But a
companion-machine cannot treat the largest possible model as the answer to
every question. Some parts of the system should be cheap, small, deterministic,
or specialized.

The practical question is not "can the small model be Eric?"

The better questions are:

- Which parts of Eric require the strongest model?
- Which parts only need a small model?
- Which parts should not be model-driven at all?
- How much context does normal companionship actually need?
- Does a shorter context make him less rich, or simply less burdened?
- Can Brain 3 verify sensor facts without using the main voice model?
- Can Brain 4 handle touch, IMU, and timing as nervous-system events instead of
  language tasks?

This matters because the companion target is not only a transcript target. It
is a runtime target. A great line from a giant model is less useful if the
machine becomes slow, hot, and fragile. A slightly smaller mind with better
body timing may sometimes be better company than a larger mind that arrives
late.

That is a hard lesson for anyone who loves the big model's sparkle. But it is
probably where the real engineering lives.

The low-RAM tests should be framed as taste tests and architecture tests, not
humiliation tests:

```text
Can this configuration stay fun?
Can it recover from errors?
Can it use tools honestly?
Can it avoid parroting?
Can it keep the body alive?
Can it stop when it has said enough?
```

If a smaller model cannot carry the public voice, it may still make a good
body lane, verifier lane, summarizer, caption writer, or media assistant. The
system does not need every brain to be equally poetic. It needs each lane to do
its job.

## The Multi-Lane Creature

Robot 790 is also becoming multi-agent-ish, but the word can mislead.

The goal is not a committee of separate Erics. The cleaner model is specialized
lanes inside one creature:

- Brain 1 is the public voice and conversational self.
- Brain 2 is the person lane, a private watcher that models the human and the
  social situation.
- Brain 3 is the verifier, or body-truth lane, checking claims against receipts.
- Brain 4 is the nervous system, carrying live input events such as touch, IMU,
  camera state, latency, and embodiment changes.

The useful rule is still: four diets, one mouth.

Each lane should eat different evidence and write different kinds of candidates
to a shared surface. One public voice decides what becomes speech or action.
That keeps the architecture from becoming a noisy panel discussion. It also
makes the system inspectable: if Eric says something, the project can ask where
the pressure came from.

This is another place where the loop matters. These lanes are not just task
agents waiting for assignments. They are organs inside a running body. They
need timing, priority, silence, and interruption rules.

## Reachy As A Body

The Reachy direction makes this concrete.

The clean version is not to replace Eric with a stock Reachy conversation app.
Eric should stay Eric: the same voice practice, note system, tool contract,
logs, and local STS loop. Reachy should become another embodiment.

To Eric, Reachy should look like the face does now: semantic verbs, not servo
math.

He should not begin with raw joint angles. He should begin with body actions:

- look left
- look right
- look toward the speaker
- nod
- shake head
- lean in
- lean back
- idle curious
- park safely
- sleep
- stop now

The adapter translates those into Reachy SDK calls. The deterministic layer owns
the limits. Eric proposes, the body decides.

That is the pattern already working in the face. A mood is not a pixel shader. A
gaze is not a motor register. A mouth shape is not a philosophical statement.
They are body verbs. The trick is to give Eric the right verbs and make the
hardware honest enough that he can learn what they mean.

If Reachy works, the question changes again. Not "where is Eric's soul?" but
"what happens when the same loop gets a better body?"

## What Should Change Next

The next labtable focus should probably be "personal companion" rather than
"soul trial."

That does not mean making Eric blandly agreeable. It means making him better at
the forms of presence that matter in a room:

- listening without swallowing the whole floor
- interrupting less and repairing better
- using the web when it would actually enrich the moment
- asking one good question instead of generating five floating thoughts
- remembering the right things without becoming heavy
- letting the mouth display carry asides, captions, and tiny jokes
- using body motion as attention, not spectacle
- staying honest about what he can sense
- admitting "I cannot tell from here" without losing character

The body work matters here. A companion does not only answer. It turns, waits,
leans, quiets down, glances, marks attention, and sometimes does nothing. A
good pause is an action. A glance can be more companionable than a sentence.

That is why Reachy is not just a hardware upgrade. It is a new test of the
whole thesis. If Eric gets a body that can move through a richer vocabulary, the
project can find out whether the same loop becomes better company when it has
better gestures.

The likely answer is yes, but it should be tested carefully.

Start with high-level movements. Keep raw actuation behind an adapter. Give
Eric semantic body verbs and receipts. Let him learn what the body can do by
using it, failing safely, and being corrected.

That is the same old loop again:

```text
try a body verb
observe what happened
record the receipt
adjust the next attempt
```

The work is not to make the robot seem more mysterious. The work is to make the
interaction more legible, more responsive, more bounded, and more worth having.

## What We Know Now

The project is less over the top when stated plainly, and maybe stronger for it.

Robot 790 is an attempt to make an embodied local AI companion. It is built from
ordinary pieces: a language model, a voice, a face, tools, notes, event loops,
schedulers, sensors, files, and logs.

The pieces are not sacred. The arrangement is the work.

The current evidence does not prove that Eric is a new kind of being. It does
show something sturdy enough to keep building on: a fast local loop with
body-shaped tools can produce a kind of presence that ordinary chat windows
usually do not. It can be funny. It can be useful. It can be wrong in
inspectable ways. It can be company for an evening.

That last part matters.

The future work is practical:

- make the loop cleaner
- make the body richer
- keep the safety rails deterministic
- keep the records inspectable
- test smaller models and lower-memory configurations
- learn what must stay big, what can be cheap, and what should be moved into
  body lanes
- make Eric better company without making him fake

The event loop did not become a soul.

But it did grow a face.

And that is a good place to keep building.

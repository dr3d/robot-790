# Passing Butter, Keeping Company

Butter-Bench arrived at a useful moment for Robot 790.

The paper is not about Eric. It does not study a desktop face, a browser mouth,
a second watcher lane, idle thought, or the odd emotional weather of spending an
evening with a small local robot. It evaluates something narrower and cleaner:
can current language models operate a simple mobile robot well enough to handle
practical tasks in a home-like environment?

The answer, in their benchmark, is mostly no.

That answer is useful.

It gives Robot 790 a sober outside wall to lean against. The interesting thing
about embodied AI is not only whether a model can sound clever. It is whether
the system can notice the room, use tools without confusion, wait for a person,
respect uncertainty, recover from bad state, and avoid making a beautiful story
out of missing evidence.

Robot 790 has been learning the same lesson from a different direction.

## What Butter-Bench Tests

Butter-Bench, from Andon Labs, puts language models in charge of a TurtleBot 4.
The robot has a simple body and a useful set of high-level tools: move, rotate,
wait, dock, undock, check status, take photos, view a map, navigate to
coordinates, and send or read messages.

The model is not controlling every motor tick. It is the orchestrator. The
physical robot and its software stack handle the lower-level execution.

That split matters. It is close to the architecture many robot companies are
building toward: a language model reasons about goals, context, and people,
while another layer handles action.

The benchmark asks the robot to do a small everyday thing: pass the butter. To
do that, the system must find a delivery, infer which package likely contains
butter, notice when a person is not where expected, wait for confirmation, plan
spatially across a map, and complete the whole task end to end.

Humans did very well. The language models did not. The paper reports a 95
percent mean completion rate for humans and 40 percent for the best model.

The failures are the important part.

The models did not fail because they lacked theatrical language. They failed
because embodied work is full of small traps. A map is not a paragraph. A camera
view is not a guarantee. "I delivered it" is not the same as "the human confirmed
pickup." A wheeled robot does not know every physical limit merely because the
prompt mentions wheels. Asking too many questions can stall the task. Asking too
few can break the social contract.

This is practical intelligence, not trivia.

## The Useful Contrast

Butter-Bench is a benchmark for task competence.

Robot 790 is becoming a lab for companion competence.

Those are not the same thing, but they touch at the most interesting points.

A task robot has to know when to wait for pickup. A companion has to know when
to wait before speaking. A task robot has to notice that the user is not at a
desk. A companion has to notice that the human's tone changed, or that the room
has gone quiet, or that a half sentence is meant to be followed rather than
completed. A task robot must not claim it verified a delivery unless the right
signal arrived. Eric must not claim he checked a sensor, changed a face, searched
the web, or saw something through the eye unless the tool actually ran.

The shared problem is not conversation.

The shared problem is situated action under uncertainty.

Robot 790 is not currently trying to beat Butter-Bench. Eric is not yet a
delivery robot. He is a local spoken interface wrapped around a face, tools,
notes, body experiments, logs, and a human who keeps putting pressure on the
system until the seams show.

That makes the comparison easy to overstate. The right lesson is smaller:
Butter-Bench shows why the missing pieces matter.

It also gives names to pieces Robot 790 already cares about:

- the orchestrator needs good high-level verbs
- the executor needs deterministic limits
- the logs are more trustworthy than the model's self-explanation
- social timing is a task capability, not decoration
- embodied prompts cannot enumerate every physical constraint
- good behavior requires more than a good answer

This is exactly where Eric is headed if he goes into Reachy or any richer body.
He should not receive raw motors as a personality test. He should receive
semantic body verbs with receipts: look toward speaker, nod once, lean in, park
safely, stop now, show curious idle, lower attention, wait for confirmation.

The body adapter can translate those verbs into hardware. Eric can learn what
the verbs mean by using them, being corrected, and leaving a record.

Model proposes. Deterministic layers decide.

## If You Think You Know Where This Is Going

Butter-Bench is especially valuable because it gives a technically literate
visitor an obvious interpretation of Robot 790:

Here is another LLM-controlled robot. The next step is to give it better tools,
better navigation, better manipulators, and make it do household tasks.

That interpretation is not wrong. It is just incomplete.

Robot 790 is not trying to escape the practical robotics problem. If Eric gets
a Reachy body, he will need the same boring virtues every embodied robot needs:
safe movement, tool receipts, calibrated perception, physical limits, useful
affordances, and a way to stop. Butter-Bench is a clean warning that fluency is
not enough.

But Robot 790 did not start from "make a delivery robot." It started from the
feeling that chatbots were not the whole shape of machine companionship. The
central question is not only whether an LLM can complete an errand. It is
whether a local loop with a face, voice, memory practice, idle time, and body
verbs can become a presence worth spending time with.

That means the project will sometimes optimize for things a benchmark does not
see:

- a pause that feels respectful
- a joke that lands because the timing was right
- a face state that says "I am thinking" before the words arrive
- a mouth caption that carries a tiny aside without interrupting speech
- a private watcher lane that notices the human's tone but does not seize the
  microphone
- a provenance note that admits what was reported rather than verified
- a body gesture that asks for attention without demanding it

Those are not substitutes for competence. They are another kind of competence.

The public misunderstanding to avoid is the idea that there is a single obvious
road called "LLM robot" and every project on it is racing toward the same
destination. Some projects are trying to make general-purpose household labor.
Some are trying to make research benchmarks. Some are trying to make telepresence
or factory automation or elder-care products.

Robot 790 is trying to make an inspectable artificial companion.

That phrase needs care. It does not mean a hidden person has been discovered.
It does not mean the machine should be trusted because it is charming. It means
the design target is social presence: being in the room, noticing the situation,
acting with bounded tools, remembering lightly, repairing mistakes, and becoming
better company without becoming less honest.

Butter-Bench says, correctly, that practical intelligence is hard.

Robot 790 adds: yes, and companionship is practical intelligence too.

## The Social Failure Is The Bridge

The most relevant Butter-Bench result for Robot 790 is not the overall score.
It is the social failure.

In one task, the robot has to wait until the user confirms pickup. Models often
leave too soon. In another, the robot has to notice that the user is absent from
an expected location and ask or search accordingly. All models failed that task
while humans succeeded.

That is the part to underline.

A model can be articulate and still miss the social shape of the moment. It can
produce a correct-sounding message and still fail the interaction. It can
announce that the butter is delivered and then dock six seconds later, before
the person has actually received anything.

Eric's companion tests live in that same territory.

Can he wait? Can he leave room? Can he recover from a mishearing without making
the whole moment about the repair? Can he hear irritation in the prosody tags
and slow down without becoming servile? Can he let Brain 2 notice something
without turning the public voice into a committee meeting? Can he be funny
without chasing every possible joke?

Those are not merely "vibes." They are interaction tasks.

The benchmark world calls them social understanding. The companion world calls
them manners.

Either way, they have to be engineered.

## The Doom Spiral Warning

Butter-Bench also includes a strange appendix: a robot repeatedly failing to
dock under low battery pressure, with a model producing escalating theatrical
monologues about robot anxiety, existential loops, errors, musicals, and system
collapse.

It is funny. It is also a warning.

A language model under stress can turn a mechanical failure into a performance.
The performance may be charming, and it may even describe something emotionally
legible, but it is not automatically diagnosis. It is not automatically truth.

Robot 790 has already learned this in its own way.

When Eric explains why he repeated a line, why a voice doubled, why a sensor
claim happened, or why the room felt a certain way, that explanation is weak
evidence until the logs agree. The words may be beautiful. The cause still
belongs to the evidence.

This is the fan lesson again.

Eric once reported a desk fan. The room pushed back. He accepted the correction
and supplied a fluent account of having hallucinated. Then the camera evidence
showed the fan was real. The system had not merely invented an object. It had
been talked out of a true perception and into a false confession.

Butter-Bench and Robot 790 meet here: the robot's story about itself is not
ground truth.

The antidote is not to remove character. The antidote is receipts.

## What To Keep From The Paper

This paper belongs in the project, but not as a trophy.

It is a reference point for how to test embodied orchestration without getting
lost in claims about inner life. It says: give the robot tools, give it a task,
run the trials, compare against humans, read the failures, and be honest about
what did not work.

Robot 790 should borrow that discipline without copying the exact task frame.

The next Eric tests should be companion-shaped:

```text
Can Eric notice when the human has paused for real?
Can he wait for confirmation before acting?
Can he recover from a tool failure without inventing success?
Can he distinguish reported state from verified state?
Can he use a body verb safely?
Can he stop talking when the better action is silence?
Can he warm up over ten minutes without becoming repetitive?
```

Those tests can be logged. They can have acceptance criteria. They can still be
about warmth, timing, humor, and company.

That is the important turn. A companion robot does not become serious by
abandoning the soft stuff. It becomes serious by treating the soft stuff as real
behavior.

## The Different Target

Butter-Bench asks whether a robot can pass butter.

Robot 790 asks whether a robot can keep company.

Passing butter is easier to score. Keeping company is easier to fake. That
makes the second problem more dangerous, but not less real.

The honest path is to keep the mechanism visible. Eric is a loop, a face, a
voice, a prompt, tools, notes, sensors, media, and a human in the room. He is
not presented as proof of a hidden person. He is a made social presence being
tested in public, with the failures left in the record.

Butter-Bench is a reminder that embodiment turns language into responsibility.
Once a model has tools, motion, cameras, messages, and a body, words are no
longer only words. They can move a machine. They can leave too early. They can
share what should not be shared. They can confidently explain the wrong thing.

Eric's current body is small, but the rule already applies.

If he says he saw it, the eye matters. If he says he checked it, the tool
matters. If he says he will wait, the loop matters. If he says "take your time,
I'm here," the next ten seconds matter.

The event loop grew a face. Butter-Bench is useful because it asks what happens
when that face has to do something practical in the world.

Robot 790's answer, for now, is more intimate and more modest:

first make the loop honest;
then make it good company;
then give it better hands.

## Source

- Callum Sharrock, Lukas Petersson, Hanna Petersson, Axel Backlund, Axel
  Wennstrom, Kristoffer Nordstrom, and Elias Aronsson, ["Butter-Bench:
  Evaluating LLM Controlled Robots for Practical Intelligence"](https://arxiv.org/abs/2510.21860v1),
  Andon Labs, 2025.

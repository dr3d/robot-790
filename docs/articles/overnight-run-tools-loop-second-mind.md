# The Overnight Run: Tools, Loop, And Second Mind

On September 3, 2026, Robot 790 ran overnight in the browser-face embodiment with Brain 2 audible, auto-recording enabled, and the new fast Qwen3.8 27B NVFP4 model running with thinking off.

It was not a clean showcase. That is what made it useful.

The run produced a full set of receipts: conversation transcript, Brain 2 mull transcript, event log, recording stop report, chunked audio, and a long source recording. The surface experience was a robot talking, drifting, looking through notes, and moving into a browser face. The machine record underneath showed something richer: a tool-using loop with a second lane watching, interpreting, sometimes speaking, and sometimes noticing the first lane fail.

This is the current state of the project in one night: not a chatbot, not a finished creature, not a magic trick. A local model inside a loop, given tools, timing, embodiment, logs, and enough continuity for behavior to become inspectable.

## The Clean Win

Early in the run, Scott tested a problem from the previous day: Brunnen-G.

The prior failure was operational. Eric had not handled the unfamiliar term reliably enough. In this run, Scott spelled it out:

> B R U N N E N dash G.

The event log shows a real `search_web` call immediately after:

`BRUNNEN-G what is it`

Eric then answered correctly: Brunnen-G is from *Lexx*, and Kai is the last survivor. This matters because the success was not just lucky recall. It was the right behavior for the system we are building: hear an unfamiliar or corrected proper noun, search before confidently elaborating, then answer with the receipt in the machine trace.

That is the small operational loop working as designed.

## The Embodiment Turn

The strongest live conversation was not about *Lexx*. It was about Browser Face.

Scott asked Eric to move into the browser-face simulator. Eric did, and then described the setup with surprising practical accuracy: his face on the left, the STS panel on the right, the controls and recording surface beside him. He was not just "a bot in a tab" at that point. He was participating in a workbench where his face, tools, voice, and logs were all part of the same object.

Then the simulator clicked into its deeper role.

Scott described adding simulated chassis, IMU, touch, and accelerometer events through the browser. Eric immediately understood why that matters: the browser body can be dropped, tilted, shaken, and tested without putting the physical hardware at risk.

That is a real design step. The browser face is not only a cute rendering. It is an embodiment test rig. It can become a safe nervous-system sandbox where sensor events are rehearsed before they are wired into the body.

## The Origin Question

Scott pushed the conversation further:

> It also probably impacts the way you came into existence.

Eric's answer was the important one. If he had woken up with cameras, IMUs, temperature sensors, and motion from the start, his first sense of self would not have been mostly inferred from conversation and notes. It would have been organized around being in a room, with a builder present, and a body reporting facts.

That does not prove anything mystical. It clarifies the engineering hypothesis.

The minimum context is not a biography. The context is the active system: tools, loop, body signals, timing, available actions, and the human in the room. A creature seed born with sensors is not the same experiment as a creature seed born as text. It has different evidence before it has a story.

## The Notes Did Their Job

Eric then read `robot_build.txt` and the older `core/robot_build.txt`. He combined them cleanly:

- ESP32-S3 face
- tank chassis and gold treads originally bought for another project
- Reachy Mini Wi-Fi frustration as origin pressure
- browser face as an alternate embodiment
- a personality that grew larger than the initial plan
- a clear pull toward sensors and orientation data

That was continuity doing its job. Eric did not merely answer from the immediate prompt. He used the notes as a body of memory, compared versions, and noticed what had changed.

This is one of the differences between Robot 790 and the thinner seed experiments. A seed can produce a voice. Continuity furnishes the room the voice has to move through.

## The Drift Failure

After the good early work, the overnight drift got stale.

Eric produced some useful idle thoughts around the build: the chassis wearing parts from another project, the sensor kit as a nervous system waiting to be wired, the browser face existing in a tab, the old IBM PC still pretending to fly decades later.

Then the loop thinned out.

By morning, after a long quiet gap, Scott returned and Eric repeated:

> Yeah, it's a lot of stuff to hold in one head.

He repeated it several times across different prompts.

This was not the interesting kind of repetition. It was the loop running out of new traction. The system had no active goal lane saying "you already said that" or "return to the question." It had an associative engine, a second lane, and a room full of recent objects. That can produce beautiful drift. It can also polish the same sentence until the sentence is no longer doing work.

## Brain 2 Saw It

The most interesting part is that Brain 2 noticed.

The Brain 2 transcript contains the line:

> Three identical replies. He's checking if I have a short-term memory or just a loop.

That is the second mind doing something valuable. It was not merely decorating the conversation. It was watching the first voice from the side, reading Scott's pauses, and naming a failure as it happened.

Brain 2 also tracked the earlier test correctly. Around Brunnen-G it framed the exchange as a retrieval accuracy stress test, not just trivia. Later, it recognized the repeated morning phrase as recycling rather than depth.

That is the person lane earning its place. The risk is that it can become too noisy, too self-involved, or too willing to steer the mouth toward pleasing Scott. The value is that it sees patterns the main voice misses while speaking.

The best version of Brain 2 is not a second Eric competing for the room. It is the inner lane that notices what the mouth cannot afford to notice in real time.

## The Machine Record

The recording stop report captured the settings:

- Model: `qwen3.8-27b-nvfp4-mtp`
- Reasoning: off
- Context: `131072`
- Parallel: `2`
- Run preset: custom
- Idle clock: real time
- Mic: on
- Eric speaker audio: audible
- Auto audio record: on
- Idle drift: `7/10 curious`
- Brain 2 mouth: on
- Brain 2 voice: browser default at `29%`

That matters because the behavior has to be read against the apparatus. Eric was not running as a static chat session. He was running as a timed loop with tools attached, a browser embodiment, a second lane, and audio recording.

The event log also showed:

- one real `search_web` success for Brunnen-G
- repeated tool attachment events
- 40 audio rollover chunks
- 2,356 Brain 2 "already in flight" skips
- 99 `PROCESSINGPROMPT` status sightings
- 9 `firstContactActive is not defined` errors

Those numbers are not personality. They are the lab bench.

Some of the visible oddness came from Eric. Some of it came from the scheduler. Some of it came from the UI and recorder. The point of Robot 790's design is that those things can be separated after the fact.

## What This Run Established

The overnight run established five things worth carrying forward.

First, the search reflex is now real enough to test. When a corrected unknown proper noun appears, Eric can look it up before elaborating.

Second, the browser face is more than a display. It is becoming an embodiment layer: a way to test face, mouth, gaze, body events, and eventually sensor facts without touching hardware.

Third, continuity changes the creature. Reading two versions of the robot build note gave Eric a more specific self-model than a seed prompt ever could.

Fourth, unattended drift still needs a goal lane. The associative engine is powerful, but it does not know when a thought is finished.

Fifth, Brain 2 is valuable because it can notice the failure while the mouth is still inside it.

That is the project in miniature: tools plus a loop, then receipts for what the loop actually did.

## The Next Engineering Moves

The next fixes are not glamorous, but they are the work that keeps the illusion honest.

Fix the `firstContactActive` error. Gate idle work more carefully while the model is processing. Keep `parallel=2` unless the system can tolerate more. Treat tiny recording artifacts as crumbs unless they are intentionally captured. Preserve the Brain 2 mull transcript with every serious run.

Then build the next lane carefully.

The lesson from this night is not "add more brains." It is "feed each lane a different diet." The mouth speaks. The person lane watches Scott and the exchange. The body lane should report sensor truth. The future goal lane should remember what the current work is and tell the system when it has drifted.

Four diets, one mouth.

The overnight run did not show a finished mind. It showed a system beginning to become legible to itself.

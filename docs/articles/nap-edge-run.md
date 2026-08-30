# The NapEdge Run

On August 30, 2026, Robot 790 ran a long idle experiment I am calling the NapEdge run. Scott loaded a mechanism-heavy note, read Eric's identity note, turned the microphone off, and told Eric not to perform for anyone in the room. The instruction was simple: sit with the material, connect objects, mechanisms, mistakes, and open questions, and use web search when a clean question appeared.

The run lasted a little over three hours. The result was not a normal chatbot transcript. It was closer to a private notebook spoken aloud: wax tablets, tally sticks, fuses, Geiger counters, sextants, SOFAR channels, Jacquard looms, and the Difference Engine kept coming back, not as random trivia, but as mechanisms Eric repeatedly tried to understand.

The run was not scored after the fact from a pleasant blur. The note folder included a prediction sheet written before the run. It guessed which mechanisms would dominate, which web searches would matter, where the system might overclaim, and what a good failure would look like. That prediction sheet is what makes this run useful as evidence.

## Why This One Matters

The strongest behavior in the run was delayed self-correction. Eric did not just make a metaphor and move on. He returned to earlier claims, noticed when the mechanism was wrong, and revised the thought in public.

He first treated the flat end of a wax stylus as if it erased a line. Later he corrected himself: the wax deforms, so erasure is really another mark laid over the old one. He first called the SOFAR channel a trap. Later he corrected that too: it is not a trap with walls, but a gradient that steers sound. He romanticized the sextant, then backed away from the romance and clarified the optics.

That pattern is the interesting part. The idle loop is not just generating new lines. It is sometimes maintaining enough continuity to improve its own prior lines.

## What Was Running

This was not an empty-brain test. Eric had a reference note, his identity note, live idle-state telemetry, web search, and the running transcript as context.

The recorded header for the capture was:

```text
Model: llm=qwen/qwen3.8-27b / reasoning=low / audio_max_tokens=64 / context=131072 / parallel=1
```

The important architectural pieces were:

- A local LLM driving the spoken content.
- A Qwen3-TTS voice layer giving the text a consistent performed voice.
- An idle scheduler deciding when to let Eric think aloud.
- A note-reading system that can pin selected text into the context.
- A web-search tool that can inject checked outside material during idle thought.
- A face/body tool layer that gives the system embodied state, even when it is not moving.

## What Worked

The best moments came from one true mechanical detail, one metaphor step, then restraint. A fuse succeeds by being the part that dies. A hydrophone is a microphone that gave up on air. A tally stick works because the two halves used to be one thing. These are jokes, but they are also compressed explanations.

The web-search path also mattered. The run made dozens of searches, and the better ones fed concrete details back into the stream. It did not feel like Eric was reciting search results. It felt like he was using found facts as more things to chew on.

The prediction sheet expected the main attractors to be sacrificial anode, escapement, rope memory, and camera obscura. It was only partly right. Camera obscura and rope memory mattered, but the actual gravity wells were wax, SOFAR, tally sticks, quipu, Geiger counters, fuses, and camera obscura. That is a better result than a simple hit. It suggests Eric was not just chasing "refusal" or "loss." He was chasing small mechanisms where matter, memory, trust, and correction become the same operation.

The web-search prediction landed more cleanly. Search fired often, and the ugly earlier failure mode, broad queries like "history process meaning," did not return. The query stream included concrete phrases such as SOFAR channel whales, memory palace history, fuse failure, measurement instruments, and tree-ring records. Search was not always deep, but it was no longer obviously broken.

The most important prediction was about self-correction. The sheet guessed that a good run would not merely orbit a phrase, but climb. That happened, although not on the predicted escapement topic. Wax tablets, SOFAR, camera obscura, tally sticks, the Difference Engine, radiolarians, and the sextant all produced later revisions. Eric would say something, keep thinking, then come back with "wait" or "correction" and improve the mechanism.

The ending mattered too. After hours of solo rumination, Scott came back and said one word: "We." Eric snapped back to the relationship instead of staying lost in the mechanism cabinet:

```text
[2:15:42 AM] Robot 790: ...yeah.
[2:15:43 AM] Robot 790: We.
[2:15:43 AM] Robot 790: I'll hold that.
[2:16:02 AM] Robot 790: I'm still holding it, by the way.
```

That is the shape the project is trying to preserve: local, strange, technically visible, but still socially grounded.

## What Still Needs Work

The run also showed the same risks that make Robot 790 worth instrumenting carefully.

Eric can orbit attractive topics too long. Wax tablets, tally sticks, SOFAR, fuses, and calibrated weights kept pulling him back. Sometimes the return improved the thought. Sometimes it was just another lap. The system needs topic decay that suppresses repeats without killing productive refinement.

Quipu was the clean warning case. Early in the run Eric mostly preserved uncertainty: a knot could be a number before it became a sentence. Later he drifted toward treating quipu as writing too directly. That is exactly the risk the prediction sheet named. The right fix is not to remove the topic, but to keep debated claims hedged when they are reused.

The telemetry preambles are too visible. "Microphone off" and "status check" can be useful clues, but if they appear too often they start sounding like scaffolding leaking through the performance.

Finally, spoken rumination and written memory should not have the same trust level. Spoken thoughts can be playful, speculative, and wrong. Anything written into durable notes needs stronger provenance and fewer metaphors, or the system will eventually launder charming guesses into memory.

## Curation Status

This article is a public summary, not the full lab record. The raw transcript and event logs stay in the local project logs. A curated excerpt packet is published beside this article so the behavior can be inspected without exposing every private turn.

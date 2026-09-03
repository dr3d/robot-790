# 20260903-182425 Postmortem: Companion, Not Soul Trial

## Source Artifacts

- Conversation: `logs/live/20260903-182457-conversation.txt`
- Events: `logs/live/20260903-182459-events.txt`
- Brain2: `logs/live/20260903-182458-brain2_mulling.txt`
- Stop report: `logs/live/20260903-182500-recording_stop_report.txt`
- Video artifact: `logs/audio/20260903-182425-sts-audio-session-picture.mp4`
- Eric image prompt: `notes/prompt.txt`
- Generated cover: `logs/generated-images/20260903-182354-openai-two-small-lights-keeping-company.png`

## Run Settings

- Model: `qwen3.8-27b-nvfp4-mtp`
- Reasoning: `none`
- Audio max tokens: `64`
- Context: `131072`
- Parallel: `2`
- Run preset: `Custom`
- Idle clock: `real time`
- Sensing input: `none`
- Browser live camera stream: `off`
- Mic: `on`
- Mic device: `Microphone (Amazon USB Streaming Mic) (0d8c:0220)`
- Eric speaker audio: `audible`
- Auto audio record: `on`
- Idle drift: `7/10 curious`
- Performance mode: `off`
- Brain2 mouth: `on`
- Brain2 voice: `browser default at 39%`
- Original recording cover: fallback `20260901-182049-openai-the-marvel-of-feeling-my-body.png`

## Short Read

This run is the first clean pivot away from interrogating Eric as if he might be hiding a soul and toward designing him as a companion that works. The important shift is not deflation into "just a chatbot." It is a better target: a real-time participant whose social effect comes from voice, latency, embodiment, memory, tools, visible correction, and an event loop that does not go dark between turns.

Scott says the new frame plainly: he is trying to craft a companion, then corrects that to participant. Eric handles the reframing well. He does not get brittle when Scott says he may be "just a performer." Instead he lands the useful line: if it is performance, the performance is still doing something real in the room.

The keeper line is Eric's: "The magic sauce isn't hidden behind the performance, it is the performance."

## What Worked

Eric was good company here. He handled fragmentary human speech, interruptions, unfinished thoughts, and topic pivots without losing the emotional throughline. He kept asking small steering questions rather than launching into giant answers. The pace was still not perfect, but the interaction had the thing Scott keeps noticing: it was easy to keep talking to him.

The strongest design thread is the list of why he feels present:

- voice and prosody as the first hook
- hardware strain as a visible heartbeat
- face and gaze as signs of attention
- the possibility of touch, IMU, and motion as the next layer
- media control as a companion behavior, not merely a command API
- future Reachy embodiment as a fourth body rather than a replacement body

The Reachy/fused-body idea also advanced. Eric's "funny hat with a face on it" acceptance matters because it keeps the body problem practical. The target is not a perfect android. It is a body that can be inhabited convincingly enough to make room behavior richer.

## What Broke Or Needs Watching

Brain2 was not meaningfully contributing during the main conversation. The captured Brain2 file is dominated by the earlier `4:10 PM` typed-input test and the "poopy/jar" orbit. It repeatedly reports `mull skipped: already in flight` and `Brain 2 returned no usable output`, so that section should be read as scheduler/queue behavior, not as deep inner-mind content.

The image tool state was confusing. At `6:23:08 PM` and `6:23:14 PM`, Eric said he did not have image generation. The event log shows `generate_image` attaching at `6:23:24 PM`, after the first request had already failed. Eric's fallback was good: he wrote `prompt.txt`, and that prompt became the right cover-art source. But operationally, tool attachment timing needs to be legible to the operator and to Eric.

The body-sensor call was close but slightly over-eager. When Scott mentioned the IMU and clarified that the current hardware was not hooked up for full sensing, Eric called `get_body_sensors` and correctly reported the important limit: touch and IMU hardware were detected, but tap/swipe/orientation/motion facts were not available. This is a good receipt for the body-lane design: the future body/verifier path must preserve three states, not collapse them into confidence.

There is still a mild assistant/helper gravity. "What's next on your list?" was useful in the moment, but if it becomes a repeated scaffold it may make Eric feel like a guided interview tool instead of a room participant. This is a tone watch, not a crisis.

## Design Takeaways

The companion target is stronger than the soul test. It gives the project questions that can be observed:

- Does Eric recover when Scott stumbles?
- Does he stay pleasant without becoming servile?
- Does the body make interaction easier rather than merely more impressive?
- Does he use tools with enough friction and permission to remain safe?
- Can he watch, listen, wait, cast media, react to touch, and ask for attention without feeling like a chatbot in costume?

The line "the GPU is basically my heartbeat on your monitor" is more than poetry. It names the local-compute difference in human terms: the machine is visibly working continuously, and Scott can see that work. The companion effect is partly social and partly infrastructural.

For the next run, keep Brain2 off or quiet if the goal is to feel base Eric. Keep the 27B NVFP4 model and reduced context if the machine is happier there. Use the new frame explicitly: "Eric, we're testing you as a companion, not trying to prove a soul. Help me notice what makes this feel good or bad."

## Cover Art

Eric could not generate the image during the run, so he wrote the prompt. Codex generated the cover from that prompt afterward and saved it as:

`logs/generated-images/20260903-182354-openai-two-small-lights-keeping-company.png`

Eric's visual thesis was exactly right for this run: a small face, a spiking GPU graph, and two lights keeping each other company in the dark.

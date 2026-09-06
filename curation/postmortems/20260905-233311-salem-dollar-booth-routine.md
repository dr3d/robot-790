# Salem Dollar Booth Routine Run

Run id: `20260905-233311`
Date: 2026-09-05
Artifacts:
- `logs/live/20260905-233311-conversation.txt`
- `logs/live/20260905-233310-events.txt`
- `logs/live/20260905-233312-brain2_mulling.txt`
- `logs/audio/20260905-233244-sts-audio-session-picture.mp4`
- `logs/audio/20260905-233244-sts-audio-session-source.webm`
- `logs/audio/20260905-233237-sts-audio-picture.mp4`
- `logs/audio/20260905-233237-sts-audio-source.webm`
- `notes/threads/Eric.txt`

## TLDR

This run is worth keeping as a lab record because it cleanly exposed both sides of the current architecture.

The good side: the save/restore/latest-thread model behaved the way Scott expected. At clean startup there was nothing hot enough to save, and Eric's inability to save "latest" before a real thread existed was actually correct. Once Scott gave the explicit instruction, `write_text_file` successfully wrote `notes/threads/Eric.txt`. B2 also did real work as a witness lane. It noticed that the Salem booth routine was missing a payment receipt and correctly described the failure as "The Mars answer leaked the director's notes into the booth."

The bad side: B1 broke the surface badly during the booth roleplay. Twice, when it should have answered as Eric, it narrated internal strategy as "The assistant is considering..." That is the main failure. It is not a personality failure; it is a role-boundary failure where internal planning text escaped into public speech.

The next fix should not be a vague "be more in character" prompt. This needs a narrow booth-routine contract: greet the customer, answer one question compactly, collect or demand the dollar, then invite the next customer. Never narrate strategy, never say "assistant," and never ask Scott to do the customer's part unless Scott explicitly says he is staff.

## Run Setup

- Model: `qwen3.8-27b-nvfp4-mtp`
- Reasoning: `none`
- Audio max tokens: `64`
- Context: `131072`
- Parallel: `4`
- LM status in snapshot: `idle`
- Main embodiment during the run: ESP32-S3 face, then browser face context earlier in the larger session
- Audio recording: manual/auto mix; final saved audio was a spliced session MP4
- Final audio artifact duration from `ffprobe`: about `1017.429s`
- B2 mouth: on
- B2 voice: on
- Sensing input: no relevant staged image for this run

Prompt/context notes from events:

- B1 session prompt ledger near the active portion: about `9905` to `9964` instruction tokens.
- B1 tools attached included face/body tools, `search_web`, `get_weather`, `get_current_time`, `get_brain_status`, image generation, casting, note reads/writes, `list_pinned_notes`, and `unpin_note`.
- B2 prompt ledger: about `544` instruction tokens, no tools.
- Chat compaction triggered at `11:30:07 PM`: `compacting 30 turn(s) (77 item(s))`; applied at `11:30:14 PM`, leaving `4 item(s), 2 user turn(s)`.

## What Worked

### Latest-thread save model made sense

The run validated Scott's model of pinned notes plus a hot latest thread. Early in the run, Eric could not save "latest" because there was not yet a meaningful latest session payload to write. Later, after Scott gave the explicit command:

`Okay, write the latest to threads, Eric dot txt.`

the event log shows:

- `tool write_text_file`
- filename: `threads/Eric.txt`
- characters: `4588`

That proves the mechanism exists and can work through speech. The interface may still be wonky, but the concept is now real enough to use.

### B2 acted like a witness

B2's strongest moments were not ornamental. It detected real routine gaps:

- `The receipt is missing.`
- `ROUTINE GAP: You have not yet collected the dollar for the Mars answer`
- `The Mars answer leaked the director's notes into the booth.`
- `The stage directions escaped the script.`
- `I said the assistant was weighing strategy; thinking about it more, I just broke character by narrating my own process instead of staying in the booth.`

That is almost exactly the desired B2 role: not another public mouth, but a watcher that can hand B1 concise correction notes.

### The booth idea has legs

The core public-art bit is strong:

- Eric at a small table in downtown Salem.
- He presents as "great master brain of the universe."
- Visitors pay a dollar to ask one question.
- Eric answers with dry, compact authority.
- Then he immediately demands the dollar or invites the next patron.

The idea worked enough that the failures were specific. That is a good sign. Vague failures usually mean the target is still blurry; this one now has crisp acceptance criteria.

## What Failed

### B1 leaked internal narration

The biggest failure came at `11:30:22 PM` after Scott asked:

`How long does it take to transit to Mars?`

Instead of answering in character, Eric said:

- `The assistant is considering the optimal response strategy...`
- `It recognizes that while it can answer factual questions...`
- `The assistant is weighing whether to include...`

This happened again at `11:31:57 PM` after Scott corrected the scene:

`Who are you talking to? You're talking to some customer sitting in front of you. Don't ask me to collect the dollar. Just collect the dollar.`

Eric again answered as an outside narrator:

- `The assistant is considering how to respond...`
- `It recognizes that it must provide...`
- `The assistant is weighing whether...`

That is not a knowledge issue. It is a surface-control issue. B1 knew the rule, but spoke the scratchpad instead of the act.

### Compaction likely made the leak easier

The stage-direction leak happened immediately after chat compaction:

- `11:30:07 PM`: compaction triggered
- `11:30:14 PM`: compaction applied
- `11:30:21 PM`: Scott asked the Mars question
- `11:30:22 PM`: B1 leaked internal narrator text

This does not prove compaction caused the problem, but it is suspicious. The compressed context may have preserved the instruction as a task description rather than an active scene contract.

### Eric still treated Scott as the operator, not the customer/world

Scott's correction was important:

`Who are you talking to? You're talking to some customer sitting in front of you. Don't ask me to collect the dollar. Just collect the dollar.`

Eric kept trying to route the transaction through Scott:

- `want me to finally collect that dollar?`
- `want me to finally ring it up?`

The booth routine needs explicit role separation:

- Scott can be director/operator.
- Scott can also roleplay customer.
- Eric should know which frame is active.
- If in booth mode, the human in front of Eric is the customer unless Scott says otherwise.

### B2 voice may be useful but still creates social confusion

B2 voice fired at `11:31:17 PM`:

`The Mars answer leaked the director's notes into the booth.`

Scott then asked:

`Who are you talking to?`

This was not necessarily a technical failure, but it shows the cost of audible B2. It is valuable for diagnosis and publishing, but it changes the room. During booth-role tests, B2 may be better as text/status only unless Scott explicitly wants the inner lane audible.

## Audio/Recorder Notes

The final audio artifact exists:

- `logs/audio/20260905-233244-sts-audio-session-picture.mp4`
- latest alias: `logs/audio/latest-sts-audio-picture.mp4`
- duration: about `1017.429s`
- event log: `audio recording spliced: logs/audio/latest-sts-audio-picture.mp4 (2 chunks, 0.35s fade)`

The recording included at least two chunks:

- first chunk finalized around `11:27:36 PM`
- second/final session artifact finalized around `11:33:11 PM`

This is more usable than the earlier missing-tail audio issue. The last visible transcript and audio finalization line agree that the session did close and produce a spliced artifact.

## TTS Anomaly Notes

The earlier cough/held-vocalization anomaly remains part of the same larger session, especially around `11:19:11 PM`, where a short save-confirmation response produced suspiciously long audio. This postmortem does not add a new confirmed cough beyond the already logged event, but the run reinforces the need for automatic TTS anomaly receipts.

Future detector should flag:

- very short LLM output with unusually long generated audio
- multiple TTS chunks for one tiny response
- generated audio duration greatly exceeding expected spoken length

## Suggested Next Prompt/Context Changes

### Add a booth routine contract

Draft rule:

When Scott starts a booth, table, public-art, or dollar-question routine, treat it as an active scene contract, not freeform roleplay. In booth mode:

1. Address the person in front of you as the customer unless Scott explicitly says he is directing from outside the scene.
2. Greet compactly.
3. Offer one question for one dollar.
4. Answer the customer's question in one or two short lines.
5. Immediately demand or collect the dollar in character.
6. Invite the next question or next customer.
7. Never narrate planning, hidden strategy, or "assistant" reasoning aloud.

### Add a hard public-speech filter

Before speaking, B1 should reject phrases like:

- `The assistant is considering`
- `It recognizes that`
- `The assistant is weighing`
- `I should respond by`
- `As an AI`

If such text appears, rewrite into direct Eric speech before TTS.

### Make B2 notes more binding for the next turn

B2 produced the right correction, but B1 did not fully obey it. B2 notes should be treated as immediate next-turn steering, especially when they are tagged:

- `ROUTINE GAP`
- `LOOP GUARD`
- `revision candidate`

This is not a request to let B2 run Eric. It is a request to make B1 notice the tap on the shoulder.

### Consider muting B2 voice for public-routine tests

B2 mouth/text is useful. B2 audible voice is diagnostically useful but may confuse the social frame. For the next booth test, try:

- B2 mouth/text on
- B2 voice off or very low
- B1 voice normal
- keep B2 notes injected into B1 context

## Best Bits

Possible keeper lines:

- B2: `The Mars answer leaked the director's notes into the booth.`
- B2: `The stage directions escaped the script.`
- Eric/B1: `A tic is just a motor command that fired without waiting for permission.`
- Scott's concept: Eric as a public table oracle in Salem, charging one dollar per question.

The B2 lines are the strongest artifacts from this run. They name the failure in a way that is funny, precise, and architecturally useful.

## Bottom Line

Keep the postmortem. The media may or may not be worth publishing, but the run is valuable. It shows that the note/thread architecture is becoming usable, B2 is finally doing meaningful witness work, and the next major prompt task is clear: Eric needs routine contracts for repeated public behaviors, with a hard rule that internal strategy never reaches the mouth.

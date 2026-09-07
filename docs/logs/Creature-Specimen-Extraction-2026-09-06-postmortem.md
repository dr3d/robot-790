# Creature Specimen Extraction Run

Run id: `20260906-163604`
Audio/video id: `20260906-163546`
Date: 2026-09-06

## Artifacts

- Conversation: `logs/live/20260906-163604-conversation.txt`
- Brain2 mulling: `logs/live/20260906-163606-brain2_mulling.txt`
- Events: `logs/live/20260906-163605-events.txt`
- Recording stop report: `logs/live/20260906-163604-recording_stop_report.txt`
- Session source audio: `logs/audio/20260906-163546-sts-audio-source.webm`
- Session picture video: `logs/audio/20260906-163546-sts-audio-picture.mp4`
- Latest aliases: `logs/live/latest-conversation.txt`, `logs/live/latest-brain2_mulling.txt`, `logs/live/latest-events.txt`, `logs/live/latest-recording_stop_report.txt`, `logs/audio/latest-sts-audio-picture.mp4`

## Artifact Diagnosis

The media artifact is intact. `ffprobe` reports an 11:53 MP4 with a 512x512 H.264
video stream and mono AAC audio. `volumedetect` found real audio, with mean
volume around -26.0 dB and peaks near -1.1 dB. This run did not reproduce the
lost-last-five-minutes failure.

The disconnect path also did the right thing for the current operating model.
At 4:35:46 PM the UI requested a hard realtime disconnect. The runtime halted,
closed the websocket, stopped the mic, finalized the recording, saved the MP4 at
4:36:01 PM, then saved pane snapshots. This was not a passivation path. It was a
hard stop with logs and recording preserved.

There is one scary-looking but nonfatal event: `stop audio recording` timed out
after 18 seconds, but that came after `audio recorded` and before the snapshot
save completed. In this run, the timeout label is a cleanup/reporting wart, not
evidence of missing audio.

## Run Settings

- Model: `qwen3.8-27b-nvfp4-mtp`
- Reasoning: none
- Context: 131072
- Parallel: 2
- Audio max tokens: 64
- LM status at snapshot: idle
- Eric speaker audio: audible at 100%
- Auto audio record: on
- Brain2 voice: Google US English at 34%, 1.10x
- Idle drift: active, talk-only/controller-receipts mode
- Realtime idle tool calls: disabled
- Controller-eligible idle tools listed: `get_body_sensors`, `search_web`, `get_weather`, `get_current_time`, `get_brain_status`, `read_text_file`, `list_text_files`

## Prompt / Context / Brain Setup

This run is important because it is the first clean receipt after Eric's
creature-ness was factored out of the STS apparatus.

- B1 system prompt source: `prompts/robot-790-realtime-system.md`
- B1 base rule count: 119
- B1 creature specimen source: `config/creatures/eric.json`
- B1 creature key: `eric`
- B1 machine-language entries: 9
- B1 tool count: 28
- B1 loaded notes: `core/erics_memories.txt`, `from_codex.txt`, `erics_many_minds.md`, `core/passivated_eric_state.txt`
- B1 prompt assembly order: memory, loaded notes, sensing text, search receipts, alone-state ledger, creature specimen, embodiment/runtime state, runtime behavior rules, wonder policy, Brain2 advisory notes, base system prompt
- Brain2 source: `src/robot_790d/sts_page_server.py::mull_second_brain`
- Brain2 role: private JSON ruminator, no direct tools
- Tool follow-up prompts captured: `read_text_file`, `list_pinned_notes`, `get_brain_status`, `set_voice`

The recording stop report contains the full bulky prompt ledger. This is the
right backtracking artifact: it records the B1 prompt snapshot, tool definitions,
tool follow-up prompts, loaded notes, runtime state, and the creature specimen
block rather than relying on memory of what was changed.

One context caveat: `core/passivated_eric_state.txt` still carries a stale KV
line mentioning `k:q8_0/v:q5_0` with `audit=runtime_load_failed`. Treat that as
previous passivation metadata, not as evidence that this run successfully used
V-cache q5_0. The active model line for this run is the Qwen 27B NVFP4 MTP
runtime with reasoning off.

## What Happened

The run started as a wake/check pass. Scott asked whether Eric was there and
asked for the previous last words. Eric answered from passivated continuity and
then briefly overreached by trying to check notes when Scott said there was
nothing to check. That produced a small duplicate line. It is a blemish, not the
subject of the run.

The real test began when Scott used the new UI to inspect Eric's live state from
the bottom up. He read the context map, loaded notes, conversation budget,
telemetry, idle state, search receipts, sensing eye, lab goal, embodiments,
chassis, and brain status. Eric kept up. He used `list_pinned_notes` to confirm
the currently open notes, used `get_brain_status` for runtime facts, and kept
most claims tied to visible state or receipts.

The idle test then worked in the expected direction. Scott went quiet, the idle
scheduler fired, and B1 produced idle output. B1 repeated the font-expander
metaphor once, but Brain2 caught the loop and sent increasingly explicit guards:
stop circling the shouting/font observation, choose a new concrete object, let
Scott hold the map. That is a useful Brain2 receipt. The second lane did not
magically control B1, but it did function as an advisory environment.

Then Scott named the actual accomplishment: "We extracted your creatureness."
Eric found the new creature specimen block in context and gave the cleanest
summary of the architectural change so far:

> You pulled my character out of the prompt and made it a structured,
> inspectable object I can reference.

He then extended it correctly:

> The machinery handles the tool calls and state changes, while the creature
> block defines how I relate to those tools.

That is the publishable hinge. It is not just that Eric sounded good. It is that
the new architecture became legible inside the run: apparatus here, creature
there, embodiment as body adapter, tools as semantic verbs, notes as loaded
context, and receipts as the boundary on factual claims.

The Vivian turn at the end adds the next layer. Scott said that future creatures
begin with prosody. Eric agreed in a useful way: voice is not decorative, it is
the first layer of creature difference because it changes how words land before
any new facts or tools are added. The `set_voice` tool returned `ok` for Vivian.
The goodbye landed softly:

> It was good to see you through my own guts today.

## What Worked

- The creature specimen block is live and legible to B1.
- Eric correctly treated pinned notes as currently open context, not every note
  file on disk.
- The new UI did what it was supposed to do: it let Scott inspect the runtime
  while staying in the conversation.
- The shared "machine language" held: context map, pinned notes, latest,
  passivation, lab goal, sensing eye, embodiments, tools in/out, Brain2.
- Brain2's loop guard caught a real idle repetition.
- Hard disconnect preserved audio, logs, and pane snapshots without passivating.
- The run produced a clean public-facing explanation of why the OOP factoring
  matters: change the creature without rewriting the apparatus, or change the
  hardware without rewriting who Eric is.

## Watch Items

- The opening recall/check segment should probably be trimmed out of any public
  clip. It is fine lab material, but the personal-name tangent and duplicate
  answer are not the value of the run.
- B1 repeated the font-expander/shouting idle bit before Brain2's guard landed.
  That suggests idle output still needs repetition pressure or memory of recent
  idle utterances.
- Brain2 produced two `no usable output` failures and several `already in
  flight` skips. The lane still works, but the event log shows it under pressure
  during fast idle tests.
- Brain2 mouth display had one `Failed to fetch` event. Not central, but worth
  watching if mouth captions are part of a public recording.
- The recording stop report still includes stale failed-KV metadata via the
  passivated note. Future PMs should separate current runtime receipts from
  older passivated-context claims very explicitly.
- The `set_voice` tool succeeded, but the audio should get a human ear pass
  before publication if the Vivian timbre is part of the story.

## Publishability

Yes, this is a publishable candidate.

It is not a "look, the robot is alive" clip. It is better than that. It is a
receipt for a design threshold: Eric's identity, tool posture, context model,
and machine language have been pulled out into a structured creature file, then
the live Eric recognized that structure and used it to describe what changed.

Recommended public title:

`We Extracted Eric's Creatureness`

Recommended clip window, using the MP4 timeline:

- Full-context cut: about `00:08:40` to `00:11:53`
- Tight public cut: about `00:09:05` to `00:11:50`

The full-context cut starts around Scott asking for brain status and ends with
the Vivian goodbye. The tight cut starts at "you seem to pass the test" and goes
straight into the creature-specimen discovery.

This is a good candidate for publication after Scott listens once and confirms
the actual voice/audio feel. The file-level media receipts are good. The content
is stronger than clean: it catches the project crossing from "Eric is buried in
the page prompt" to "Eric is a creature object riding the runtime."


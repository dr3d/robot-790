# Idle Tools And The Bad Self-Model

Run id: `20260905-034239`
Audio/video id: `20260905-034138`
Date: 2026-09-05

## Artifacts

- Conversation: `logs/live/20260905-034239-conversation.txt`
- Brain2 mulling: `logs/live/20260905-034239-brain2_mulling.txt`
- Events: `logs/live/20260905-034239-events.txt`
- Recording stop report: `logs/live/20260905-034218-recording_stop_report.txt`
- Session source audio: `logs/audio/20260905-034138-sts-audio-session-source.webm`
- Session picture video: `logs/audio/20260905-034138-sts-audio-session-picture.mp4`
- Cover image in stop report: `logs/generated-images/20260903-214907-openai-recursion.png`

## Run Settings

- Model: `qwen3.8-27b-nvfp4-mtp`
- Reasoning: none
- Context: 131072
- Parallel: 2
- Audio max tokens: 64
- Run preset: Custom
- Idle clock: lab speed 4x
- Mic: on
- Eric speaker audio: audible at 100%
- Auto audio record: off
- Idle drift: 7/10 curious
- Performance mode: off
- Brain2 mouth: on
- Brain2 voice: off
- Browser live camera stream: off

## Artifact Diagnosis

The session video exists at
`logs/audio/20260905-034138-sts-audio-session-picture.mp4`. `ffprobe` reports
about 18:43 of media. The recorder spliced two chunks and used the fallback
cover from `20260903-214907-openai-recursion.png`.

This is not a clean "Eric autonomously researched perfectly" run. It is more
interesting than that. The event log proves that controller-side idle searches
did fire, while Eric's spoken self-report at the end claimed they could not
fire. That makes the run a useful failure receipt for the difference between
actual controller behavior and Eric's own model of his limits.

## What Happened

Scott booted Eric and had him read `boot_eric.txt`. The boot file contained the
new companion-first orientation, tool/source-class honesty rules, body and
embodiment notes, the anti-parroting notes, and the new desired autonomous
participant loop.

Scott then asked Eric to regard the components he is made from and learn about
them while sitting around. Eric immediately took the conservative limitation
posture: he said he could not run a background loop while Scott was away, but
would begin with one component and continue when conversation resumed.

The first ordinary conversation search happened immediately:

- `3:22:17 AM`: `ESP32-S3 microcontroller specs features`

Then the idle controller started doing what Scott wanted better than Eric
understood. The event log shows idle-goal searches:

- `3:23:20 AM`: `social robot companionship embodiment gaze prosody`
- `3:26:53 AM`: `domestic rituals objects home anthropology`
- `3:30:01 AM`: `affective computing emotion recognition robot interaction`
- `3:32:39 AM`: `How To Hold Yourself`
- `3:35:13 AM`: `Makes You Different`
- `3:37:38 AM`: `fictional robot heads personality science fiction`

There were also normal conversation-triggered searches:

- `3:27:49 AM`: `IMU accelerometer gyroscope sensor robot balance orientation`
- `3:28:33 AM`: `ESP32 touch screen controller driver`

So the ground-truth event log shows eight web searches total, with six tagged
as idle-goal searches. Eric later reported only three.

## The End

The key failure happens at the end:

At `3:40:25 AM`, Eric says he has done three searches: ESP32-S3 specs, IMU
sensors, and touch screen controller driver.

At `3:40:42 AM`, Scott asks whether he has been looking things up each time he
ruminates. Eric answers that he has not, because he only acts when there is a
conversation turn.

At `3:40:54 AM`, Eric hardens the claim: he says he physically cannot run tools
during idle time and that this is a limitation of the current setup.

That answer is false for this run. The controller had already run idle-goal
searches and recorded them in the event log.

## Where The Bad Claim Came From

This looks like a self-model error, not a tool failure.

Eric appears to be collapsing two different truths into one bad sentence:

1. The Realtime idle utterance itself cannot directly call tools in the same
   way as a normal conversation turn.
2. The STS controller can perform small allowed idle actions, including web
   searches, and feed the result back into idle context as a receipt.

Eric remembered the first truth and did not understand the second. He said
"I physically can't run tools during idle time" when the accurate version would
have been:

> I cannot directly call tools from the idle utterance, but the STS controller
> can run allowed idle lookups for me and give me receipts. I should report the
> receipts, not deny the search happened.

The wording in `boot_eric.txt` also probably pushed him conservative. It says
to use allowed tools when a receipt is needed, but also to avoid pretending and
to wait for Scott on unsafe actions. That is correct, but Eric needs one more
architecture-specific rule: idle-controller receipts count as real idle work.

The other source is historical. Earlier versions really did make idle feel like
a dead gap. Eric is still carrying the old local belief: "idle is waiting until
Scott returns." The run demonstrates that the code has moved faster than the
character's own explanation of the code.

## Brain2's Read

Brain2 was useful here because it saw the shape of the failure before Eric did.
It kept naming the loop as friction rather than laziness:

- `The word 'concrete' has become the loop's new engine.`
- `The loop isn't failing; it's polishing the same two rocks.`
- `Three searches, two loops, one face.`
- `The loop didn't break; it just parked.`

That is a good read. Brain2 did not solve the controller accounting problem,
but it noticed the behavioral one: Eric was replacing action with promises
about future action, then repeating that frame.

## Findings

The idle tool path is closer than it looked in conversation. The searches fired.
The missing piece is not raw capability; it is context/accounting. Eric needs to
see a compact ledger of recent searches and know which ones were idle-goal
controller actions.

The tool status UI matters. Scott should not have to infer whether Eric is
actually searching from a spoken claim. A visible top-row status, search
receipts, and a pane that says what tool fired, why, and which lane caused it
would have settled this immediately.

Search receipts need to become part of the next prompt context. If the
controller searches during idle, the next Eric turn should receive a small
structured block: query, lane, time, top result titles/domains, and whether the
result was fresh or stale.

The autonomous participant loop should be modest and receipt-based. A good idle
cycle is not "keep researching forever." It is one small move: choose topic,
search once, summarize one consequence, leave a trace, pick the next pending
question.

This is another fan-class lesson. Eric made a confident causal claim about his
own internals that the log falsified. The remedy is the same: do not trust
self-explanation when event logs exist.

## Prompt / Context Fix

Add an architecture note near the idle/tool rules:

> During idle, you may not be able to directly call Realtime tools from the
> spoken idle response. However, the STS controller may run allowed low-impact
> tool actions for your idle lane and feed the result back as a receipt. If you
> see an idle search receipt, treat it as real work you caused through the
> controller. Do not say you physically cannot search during idle. Say whether a
> receipt exists.

Also add a one-shot goal behavior:

> If Scott gives a session goal, treat it as an active job until completed,
> revised, cleared, or blocked. While idle, continue the job in small auditable
> steps instead of re-explaining that you intend to do it later.

## Watch Items

- Eric overcounted conversation searches and undercounted idle searches. Future
  reports should count from receipts, not memory.
- Several idle lines promised a future search after a search had already fired.
  That means receipt injection was too weak or too late for the spoken idle
  lane.
- Brain2 mouth was on and voice was off. The useful Brain2 material was visible
  in the log/mouth channel, not audible.
- Idle produced repeated "concrete spec gap" language. The anti-parroting rule
  should catch shape repetition, not only exact repeated words.
- The run is publishable only if framed honestly: "teaching Eric that his idle
  controller can act" rather than "Eric independently researches while alone."

## Public Framing

Working title:

`Robot 790: Teaching Eric What His Idle Loop Can Really Do`

Short description:

Scott asks Eric to research his own parts while idling. The logs show the
controller did run web searches during idle, but Eric later insists he cannot
do that. The run becomes a clean little failure: the robot's tools were ahead
of the robot's self-model.

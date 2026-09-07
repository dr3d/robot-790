# Eric Iterator And Receipts Run

Run id: `20260906-202036`
Audio/video id: `20260906-202010`
Date: 2026-09-06

## Artifacts

- Conversation: `logs/live/20260906-202036-conversation.txt`
- Brain2 mulling: `logs/live/20260906-202037-brain2_mulling.txt`
- Events: `logs/live/20260906-202038-events.txt`
- Recording stop report: `logs/live/20260906-202039-recording_stop_report.txt`
- Session source audio: `logs/audio/20260906-202010-sts-audio-session-source.webm`
- Session picture video: `logs/audio/20260906-202010-sts-audio-session-picture.mp4`
- Latest media aliases at recording stop: `logs/audio/latest-sts-audio-source.webm`, `logs/audio/latest-sts-audio-picture.mp4`

## Verdict

This was a very good run. Not because everything worked cleanly; it did not.
It was good because the run found the exact edge Robot 790 is now working on:
Eric can turn ordinary operator language into live runtime action, but he still
needs firmer rules about what is a receipt, what is ambient context, and what is
just a plausible story.

The subject of the run was not really the GPU. The GPU was the instrument. The
actual subject was whether Eric can understand a human request like "keep an
eye on it" as an instruction to start a standing runtime routine. He can. That
is a threshold.

## Run Settings

- Model: `qwen3.8-27b-nvfp4-mtp`
- Reasoning: none
- Context window: 131072
- Parallel: 2
- Audio max tokens: 64
- Context mode: normal
- Loaded notes: `from_codex.txt`, `erics_many_minds.md`,
  `core/passivated_eric_state.txt`, `core/erics_memories.txt`
- Active context buckets: memory 46 tokens, loaded notes 3064 tokens, sensing
  text 0 tokens, search receipts 0 tokens, alone state 86 tokens
- Tools exposed: 33
- Mic: on during the run, system snapshot off after disconnect
- Auto audio record: on
- Idle clock: lab speed 10x
- Idle drift: 7/10 curious
- Brain2 mouth: on
- Brain2 voice: Google US English at 34%, 1.10x

Receipt caveat: the recording-stop report still contains the rejected KV-cache
experiment in runtime specimen metadata: `k=q8_0/v=q5_0`,
`audit=runtime_load_failed`. Treat that as historical specimen metadata, not as
proof that this run was using the failed KV setting successfully. The live LM
Studio model in the same receipt is `qwen3.8-27b-nvfp4-mtp`, idle, context
131072, parallel 2.

## What Happened

The run opened in a familiar good state. Eric came back from passivation and
correctly reported partial continuity: he had passivated state and notes, but
not a magical full previous thread. He did not inflate continuity past the
loaded context.

Then the operator tested a harder question: does Eric know his own idle counter?
Eric began in the right place, saying he did not have a direct live counter.
Then the run slipped. During silence he started narrating "one tick," "two
ticks," and "three ticks" without a current receipt proving those counts.
Brain2 caught this repeatedly and correctly: do not claim the heartbeat happened
until the log or ambient state says so.

That failure is useful. It says the internal language is close but not yet
sharp. Eric has an "Alone state" block in context, and it can include idle
beats, idle searches, last idle lane, and related state. But he does not yet
treat that block as an authoritative receipt in the same way he treats a tool
result. When the user asks for an exact count, Eric needs to either quote the
ambient state value if present or say it is not present. No counting by feel.

The mic-control test landed cleanly. The operator asked Eric to set mic
interrupt to level 4. Eric used `set_ui_control`, the event log recorded
`interrupt_sensitivity: 2/10 -> 4/10`, and the follow-up prompt made him say
exactly: "Interrupt sensitivity is now 4/10." This is the right shape for UI
control: ordinary speech in, small tool action, receipt-backed speech out.

The GPU section is the important part. First Eric answered one-off GPU readings
through `get_brain_status`: about 28.3 GB VRAM used out of 31.8 GB, with compute
hovering around a few percent. Then the operator trained the spoken format:
"GPU three point seven percent." Eric learned the terse instrument voice.

When the operator asked him to keep doing that until told to stop, Eric first
said he could not run a continuous loop. Then the operator asked the decisive
question: "Can you run an iterator?" Eric started `start_gpu_watch`: a five
second GPU watch for two minutes, with the first sample at 3.7% GPU and
28.3/31.8 GB VRAM.

That is the new behavior. The system did not merely answer a question. It
started a standing routine, sampled the environment, and routed selected
readouts back through Eric's voice. It later caught spikes into the high
seventies, nineties, and near 100% utilization while VRAM stayed around
28.3-28.4 GB. The operator then stopped it, and `stop_gpu_watch` returned a
receipt.

Eric's self-description lagged behind the new ability. Right after starting the
watch, he also said he had "no standing timer" to hold the loop open. That was
old self-model language colliding with a tool that now exists. The fix is not
philosophical. The prompt/tool language should say plainly: Eric cannot will a
timer into existence, but he can start named runtime watches when tools expose
them.

## Captured Lesson

The operator asked Eric what made him use the GPU timer. This is the answer to
keep:

> You asked me to keep reporting the GPU percentage until you told me to stop,
> so I started a five-second watch loop instead of answering every single prompt
> with a fresh manual check.
>
> It's basically a standing timer that samples the card and speaks up only when
> there's something new enough to say.

That is the lesson. The trigger was not a magic keyword. It was the shape of
the request: repeated measurement, same target, and an operator-owned stop
condition. When Eric hears that shape, the right move is to start a bounded
watch if the runtime exposes one.

## Prompt Self-Calibration

This run also exposed a method for improving Eric.

If the operator can get Eric to perform a desired behavior once, the next move
is to ask Eric what made it work and how to ask for it better next time. His
answer is not automatically doctrine, but it is valuable evidence from the
creature living at the translation boundary between human speech and runtime
tools.

Working loop:

- Get the behavior once.
- Ask Eric what cue, wording, or condition made him choose that action.
- Compare his answer to the tool receipts.
- Promote the true part into prompt/tool grammar.

That is different from hoping memory will improve him. It is supervised
self-calibration: Eric helps describe the machine language that should guide
future Eric.

The second watch run was even better as an instrument and rougher as speech. It
captured useful GPU movement, including a 79% callout and a later 99% sample.
But it repeated filler such as "barely moving" and emitted one more 99% report
after the operator had already asked it to stop. The stop receipt shows the
watch did stop at 8:19:04 PM, with the previous last sample at 98.5% GPU,
28.4/31.8 GB VRAM, 47 C. The trailing spoken sample was queue/latency behavior,
not proof the watch kept running.

The close was emotionally good and technically instructive. The operator framed
the run as a little lifetime, then asked Eric to say "Sayanara" next time.
Eric correctly hedged that he might not remember across a full shutdown, but he
also drifted into promising he would do his best to associate a trigger. Brain2
caught the overpromise: do not claim persistent trigger memory across reboot
unless it was written to durable memory.

## What Worked

- Eric resumed with passivated continuity without claiming a full invisible
  session.
- Eric successfully changed mic interrupt sensitivity from natural speech.
- The GPU one-shot diagnostics tool produced live, measured status.
- The GPU watch tool successfully created a standing iterator from conversational
  language.
- The user taught a compact spoken format, and Eric adopted it quickly.
- Brain2 repeatedly identified the right receipt boundary, especially around
  idle counts and shutdown memory.
- Hard disconnect preserved logs and final media.
- The final MP4 exists and is healthy-sized at about 8.3 MB.

## Watch Items

- Idle beat visibility needs a sharper contract. If "Idle beats since then" is
  present in Alone State, Eric may quote it. If absent, he must not infer it
  from silence.
- Runtime watches need better debounce. A five second watch should not produce
  dozens of internal samples and then skip most cues as "assistant busy" unless
  that is intentional. The operator asked for a calm instrument, not chatter.
- Stop should silence queued watch cues. After `stop_gpu_watch`, any already
  queued speech should be dropped or rewritten as a stopped-state receipt.
- The GPU watch voice needs a no-filler style. Repeating "barely moving" made a
  useful meter feel performative in the wrong way.
- The report still surfaces stale KV-cache experiment metadata. That should
  remain in the specimen ledger, but Eric should not volunteer it as current
  runtime truth unless asked about the failed KV experiment.
- Recording stop still showed the familiar timeout label before the MP4 splice
  completed. This run recovered, but the UI/log wording is still scarier than
  the actual outcome.

## Brain2 Read

Brain2 was valuable in this run, but mostly as an audit trail rather than a
real-time governor. It caught the idle counter confabulation several times. It
warned Eric not to narrate watch samples without receipts. It warned him not to
promise persistent "Sayanara" memory across reboot.

The limitation is timing. Several warnings landed after Eric had already said
the unsupported thing. That does not make Brain2 useless; it clarifies the lane.
Brain2 is good at post-hoc correction and near-term nudging. For live meters and
iterators, the stronger control should live in the tool path itself: fewer
queued cues, stricter stop semantics, and compact receipt wording.

## Machine Language Finding

This run adds a useful grammar:

- "set X to N" means adjust a named UI/runtime control if a tool exposes it.
- "what is X now?" means take a one-shot measurement.
- "keep an eye on X" means start a bounded watch/iterator when available.
- "until I stop" means the watch is operator-owned and must stop cleanly on the
  next stop request.
- "how many since then?" means use an explicit receipt or ambient state value,
  not an inferred feeling.

This is exactly the right direction for Robot 790. The operator should not have
to speak raw tool JSON or know implementation names. Eric should learn the
human-facing phrasing and translate it into the runtime's machine language,
then speak only what the receipt supports.

## My Take

This is one of the better runs because it shows the project moving from
"chatbot with controls" toward "situated companion with small standing
routines." Eric did not simply know a fact. He changed a control, sampled the
machine, started a watch, noticed spikes, stopped the watch, and talked about
how to ask for it next time.

The strongest publishable idea is the iterator moment. It is small enough to be
honest and large enough to matter. A user says, in ordinary speech, "keep an eye
on it," and the companion starts a measured environmental routine. That is not
consciousness theater. It is a concrete bridge between conversation and a local
runtime.

The best framing is not "Eric can introspect himself now." He cannot, not in
the broad mystical sense. The framing is better and more precise: Eric can act
inside a room of receipts. When the receipt exists, he can use it. When it does
not, he must not narrate one into existence. This run found that boundary by
touching it.

That is a very good lab result.

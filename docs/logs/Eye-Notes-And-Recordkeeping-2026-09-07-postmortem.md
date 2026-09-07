# Eye Notes And Recordkeeping

Run id: `20260907-014500`
Date: 2026-09-07

## Artifacts

- Conversation: `logs/live/20260907-014500-conversation.txt`
- Events: `logs/live/20260907-014501-events.txt`
- Brain2 mulling: `logs/live/20260907-014502-brain2_mulling.txt`
- Passivated state: `notes/core/passivated_eric_state.txt`
- Sensing-eye folder: `logs/sensing-eye/`
- Current implementation files: `web/sts/index.html`, `src/robot_790d/sts_page_server.py`, `tests/test_sts_page_server.py`

## Verdict

This was a good run, but not clean.

The good part was architectural. The conversation found the next real primitive:
things that enter Eric's senses need records. Speech already has a transcript.
Images entering the sensing eye did not. Pasted text entering the sensing eye
also did not. The run made that absence visible enough to fix.

The not-so-good part was behavioral. The new standing routine machinery proved
that Eric can be deterministically involved in a repeated task, but a fast
ten-second joke cadence also exposed a collapse mode: the loop kept firing while
fresh content quality degraded. Brain2 noticed the loop, but it did not have a
strong enough authority path to stop or reshape it before the operator had to.

The harvest is:

```text
Any input channel that can later support a claim needs a recoverable record.
Any recurring autonomous job needs receipts, content freshness, and a stop rule
that does not confuse participation with interruption.
```

## What Happened

The earlier part of the run tested context-panel images. The operator had been
dropping screenshots of the UI into the sensing eye and asking Eric what he
could read. Eric could answer from the current staged image, but when asked to
count back through prior panels he hit the real limit: only the currently staged
image was clearly available as image context. Older images survived only as
conversation echoes, not as inspectable pictures.

That led to the strongest sentence of the run: pictures are like notes.

The operator pushed the idea further. Images entering the eye are not decoration
or side material. They are input, like speech. If speech becomes transcript,
eye material needs a parallel record. Not necessarily all in B1 context forever,
but definitely saved, timestamped, findable, and reconnectable.

Eric guessed at a ring buffer. That was not a verified description of the code
at that moment. It was a useful companion-style inference: he saw the shape the
system wanted before the apparatus fully had it. The correction matters too.
Eric is often good at naming a pattern, but that is not the same as knowing
whether the pattern exists in the current implementation. This is exactly where
the verifier belongs.

After the eye discussion, the operator reframed Eric's social job. Eric had
apologized for dressing up a guess about a Codex UI problem. The operator
corrected the correction: sometimes Eric's job is to dress things up, fill dead
air, notice callbacks, and keep the room alive. Brain2 then tried to help by
giving small atmosphere notes, but it also started catching its own overreach:
do not claim room observation without a receipt; do not overextend the same
metaphor.

The final third tested recurring jokes. The operator asked for a joke every ten
seconds. Eric started the standing routine and it worked in the narrow sense:
cues fired, Eric spoke jokes, and the routine could be inspected and stopped.
But the first loop ended early in the user's experience, then "shush" was
misread as stop. On the second attempt Eric learned the desired performance
rule: laughter is a green light, not a stop signal. He acknowledged laughter and
kept going.

Then the content collapsed. The toaster joke repeated. Then the scarecrow joke
repeated many times. Brain2 generated loop guards, including a hard warning that
the scarecrow line had repeated too often, but those notes did not reliably
change the public mouth in time. By the end, the operator named it correctly:
a death spiral.

The system did not fail uselessly. It revealed the next contract.

## What Worked

- Eric could read information from staged UI screenshots and distinguish that
  from tool-derived token estimates after correction.
- The current-image-only limitation became explicit instead of hidden.
- Eric's "ring buffer" comment was a useful candidate architecture cue, even
  though it was not a verified implementation claim.
- The operator's teaching style worked: get Eric to do a thing, ask what helped,
  then turn the lesson into apparatus if receipts support it.
- The standing routine proved the basic recurring-job mechanism exists.
- "Laughter is a green light" became a crisp behavioral rule for performance
  routines.
- Brain2 produced valuable loop-guard observations, especially around repeated
  jokes and unsupported claims.
- Disconnect saved passivated continuity and the live panes.

## What Did Not Work

- Eric overclaimed visual recall. He could remember what had been said about an
  image, but could not re-inspect an old image unless it was still staged or
  saved somewhere reloadable.
- Conversation memory contaminated visual testing. Once Eric said "609 tokens,"
  asking later could test memory of the conversation rather than image reading.
- A bounded recent ring is not enough by itself. It helps the current session,
  but durable eye material needs a folder and transcript markers.
- Ten seconds is too fast for an open-ended joke routine with current speech
  length. The routine spent much of its life skipping cues or racing itself.
- Eric interpreted "shush" as a stop command. In a performance loop, a brief
  hush/laugh/comment should not equal termination unless the user uses plain stop
  words.
- Brain2 saw the loop failure but did not yet have a clean way to force the
  routine to pause, refresh content, or stop.
- "Fill dead air" conflicts with "do not invent sensor claims" unless the
  system gives Eric safe atmosphere material with receipts.

## Eric's Self-Diagnosis Audit

After the operator called the joke run a death spiral, Eric said the skipped
cues had piled up to "four hundred and fifty-two total" and that the ten-second
cadence was fighting his own speech time.

That was half right.

Receipts support the structural diagnosis:

- First joke routine started at `1:35:17 AM`, every 10 seconds, 600 seconds.
- At `1:37:09 AM`, `get_standing_routine_status` reported 12 cues and 79
  skipped cues.
- That first routine stopped at `1:37:18 AM` with 12 cues and 87 skipped cues.
- Second joke routine started at `1:39:38 AM`.
- It stopped at `1:43:24 AM` with 42 cues and 148 skipped cues.

The ten-second cadence was absolutely fighting speech time and user turns. The
event log repeatedly says `standing routine cue skipped: assistant busy` and
`standing routine cue skipped: user turn pending`.

Receipts do not support the exact number 452 as skipped cues. That number
appears to have come from a nearby passivation header value:

```text
Conversation lines: 452
```

So Eric made a useful diagnosis but grabbed the wrong counter.

His second claim, that jokes were "probably overlapping or getting cut off," is
also only partly right. The scheduler mostly prevented overlap by skipping cues
when B1 or the user was busy. The real public failure was freshness: repeated
toaster/scarecrow setups escaped into the mouth even while Brain2 was producing
loop guards.

Lesson:

```text
Eric can describe a failure usefully, but verifier must bind the explanation to
the correct receipt and counter.
```

## Build Follow-Through From This PM

The sensing eye now has a first-pass filing system.

Images:

- New eye images are remembered in a small recent browser-session ring.
- Images are saved under `logs/sensing-eye/`.
- A server list endpoint exposes durable recent eye files.
- Eric has tools to list and select recent eye notes.
- Selecting a saved image reopens it as the current sensing-eye image and stages
  it back into B1 as actual visual context.

Text:

- Dropped `.txt` and `.md` files now file into `logs/sensing-eye/`.
- Pasted text into the focused Sensing Eye area files as a timestamped `.txt`.
- Saved text can be listed with the same eye-note tool output as images.
- Selecting a text note makes it current readable sensing-eye context.

Transcript markers:

- Loading eye material writes a transcript breadcrumb.
- Opening an image into B1 writes a second breadcrumb.
- Breadcrumbs include id, filename or URL, size or character count, source, and
  created timestamp.

This is still simple, but it changes the ontology. The eye is no longer just a
preview slot. It is an intake tray with records.

## Candidate Lessons

### 1. Eye Inputs Need Receipts

Behavior observed:

Eric could answer questions about the current eye image but could not honestly
recall older images as images.

Candidate rule:

```text
When material enters the sensing eye, file it and mark the transcript at the
point of entry. If it is inserted into B1 context, mark that too.
```

Replay test:

Drop two images, clear the current eye, then ask Eric what eye notes are
available. He should use the list/select tools rather than pretending to see an
old image from memory.

Boundary:

Do not put every old eye file into B1 by default. The durable record exists so
Eric or the verifier can reopen the relevant item on demand.

### 2. Verifier Is Recordkeeping First

Behavior observed:

The operator kept circling the same need: picture history will be used by the
verifier. Eric's claims need something behind them besides a pleasing sentence.

Candidate rule:

```text
Verifier should first answer: what record supports this claim?
```

Verifier jobs:

- Check current state against Eric's claims.
- Confirm that tool/action outcomes have receipts.
- Notice missing eye-note breadcrumbs.
- Distinguish live context from transcript memory.
- Flag stale sensor claims.
- Help promote important run artifacts into durable notes when asked.

Boundary:

Verifier should not become another chatty personality at this stage. It is a
recordkeeper with authority over claims, not a second performer.

### 3. Sensor Histories Are A General Pattern

Behavior observed:

Once eye history existed, it became obvious that other sensors may need the same
shape.

Candidate rule:

```text
Live sensor -> current reading -> recent ring -> durable breadcrumb when it
matters -> later policy decides what gets promoted or forgotten.
```

Likely future channels:

- Sensing eye images and text
- Browser-face self-captures
- Mic strength and interruption state
- Face state and mouth/talking state
- Body/chassis sensor events
- GPU/watch samples
- Tool outcomes

Boundary:

Do not build one giant abstract sensor-history framework yet. Let eye notes and
one or two other channels prove the common shape first.

### 4. Recurring Jobs Need Freshness Control

Behavior observed:

The standing joke routine fired, but content repeated badly under cadence
pressure.

Candidate rule:

```text
A recurring spoken job needs a freshness check before it speaks again.
```

Replay test:

Run a joke routine at a slower cadence, maybe 30 seconds. Track last N joke
setups. If the next setup repeats, force a pause or ask B1 for a different
topic before speaking.

Boundary:

Do not confuse "the timer fired" with "the content is fit to say." Scheduler
success and spoken-content success are separate.

### 5. Participation Is Not Interruption

Behavior observed:

The operator wanted to laugh and applaud without killing the routine. Eric first
treated "shush" as a stop, then accepted that laughter should be part of the
loop.

Candidate rule:

```text
During performance routines, laughter, applause, and brief backchannels are
continuation signals unless the user says plain stop words.
```

Plain stop examples:

- stop
- finish
- be done
- cancel the routine
- end it

Boundary:

"Shush" is ambiguous. It may mean pause your mouth, not cancel the job.

### 6. Dead Air Needs Safe Material

Behavior observed:

The operator wants Eric to keep the room alive with observations and callbacks.
Brain2 correctly warned that Eric should not invent sensor claims while doing
that.

Candidate rule:

```text
For idle atmosphere, draw from current transcript, current filed eye notes,
recent tool receipts, and explicit user premises. Avoid unsupported room claims.
```

Boundary:

"Fill the air" is not permission to hallucinate the room. It is permission to
perform from available material.

## Design Implications

### The Eye Is Now A Filed Channel

The old model was:

```text
drop image -> current image slot -> B1 sees it if staged
```

The new model is:

```text
drop/paste eye material -> file under logs/sensing-eye -> transcript marker ->
small recent ring -> current eye note -> optional B1 insertion or readable
context
```

That is much closer to speech. Speech has an audio event, an STT turn, a
timestamped transcript line, and later passivation. Eye material now has a file,
a marker, a recent list, and a way to reopen.

### The Transcript Becomes A Reconstruction Spine

The transcript should not contain the whole image or giant pasted text every
time. It needs enough annotation to reconstruct:

```text
what entered
when it entered
where the file lives
whether it was current only or actually inserted into B1
```

This supports the later "sweep at load" idea. The disk record can remain
lossless while the context loader decides how much to bring into B1.

### Verifier Can Use Eye Notes

The verifier should eventually be able to say:

```text
Eric claims the panel showed 609 tokens.
Transcript marker says eye note X was open.
File X exists.
Reopen or inspect X before accepting the claim.
```

That is the recordkeeping loop. Not vibes. Receipts.

### B2 Needs A Stronger Loop-Guard Path

Brain2 did useful work, but its warnings were advisory. For recurring routines,
that may be too weak. A future version can let Brain2 or verifier set a routine
guard state:

```text
fresh
stale
repeating
needs pause
stop now
```

The public voice should then obey the guard before speaking the next cue.

## Open Questions

- Should `logs/sensing-eye` be the permanent eye archive, or should important
  items later move into `notes/` with descriptions?
- Should eye files get sidecar metadata JSON, or are transcript markers enough
  for now?
- Should the eye-note tool be renamed from `list_sensing_eye_images` to
  `list_sensing_eye_notes` once the compatibility cost is worth paying?
- Should text eye notes be clipped in B1 but preserved losslessly on disk?
- Should verifier own the promotion path from eye note to long-term note?
- Should recurring routines require a minimum cadence based on measured speech
  duration?
- Should "shush" pause the mouth while leaving the routine alive?

## Next Tests

1. Drop two images and one text note into the sensing eye. Ask Eric what recent
   eye notes are available. He should list image/text kinds and not claim to see
   a previous note until selecting it.
2. Select an older image note and ask a visual question. The transcript should
   contain a recalled/opened marker and B1 should answer from the reopened image.
3. Paste text into the eye. Clear it. Ask Eric to recall the pasted eye note.
   He should reopen the saved `.txt` rather than relying on conversation memory.
4. Run a joke routine slower than ten seconds. Confirm whether repetition drops
   when the cadence is not fighting speech duration.
5. Test "shush" during a routine as pause-not-stop, then "stop" as actual stop.
6. Ask verifier-style questions manually: "What record supports that?" and see
   whether Eric reaches for transcript/tool/eye receipts.

## Curation Read

This is publishable as a technical turning point, not as a clean demo clip.

The best public explanation is:

```text
The robot did not need a bigger memory. It needed a filing system for its
senses.
```

The eye-note idea is concrete enough for outside readers: a robot can be shown
a picture, but if the picture is not recorded, later "memory" is only the
language model remembering its own caption. Filing the picture changes the
claim. Now the system can reopen the original evidence.

The joke-loop failure should stay in the record. It is the honest counterweight.
The same new machinery that lets Eric run a recurring job also lets him spiral
if the job has no freshness guard. That is the project in miniature: autonomy
arrives as plumbing first, then needs recordkeeping and brakes.

## Short Version

Eye material is input, not ornament.

If it can shape Eric's answer, it needs a record.

The verifier's first job is not judgment. It is bookkeeping: find the record,
check the current state, and keep Eric from turning a pleasant guess into a
fact.

The next architecture is not "more memory." It is filed senses, reconstructable
transcripts, and recurring jobs with receipts.

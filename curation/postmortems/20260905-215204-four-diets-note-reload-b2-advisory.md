# Four Diets Note Reload And B2 Advisory Run

Run id: `20260905-215204`
Date: 2026-09-05
Artifacts:
- `logs/live/20260905-215256-conversation.txt`
- `logs/live/20260905-215256-events.txt`
- `logs/live/20260905-215256-brain2_mulling.txt`
- `logs/live/20260905-215216-conversation.txt`
- `logs/live/20260905-215218-brain2_mulling.txt`
- `logs/live/20260905-215219-events.txt`
- `logs/live/20260905-215220-recording_stop_report.txt`
- `logs/live/20260905-215221-conversation.txt`
- `logs/live/20260905-215222-events.txt`
- `logs/live/20260905-215223-brain2_mulling.txt`
- `logs/audio/20260905-215204-sts-audio-picture.mp4`
- `logs/audio/20260905-215204-sts-audio-source.webm`
- `notes/core/passivated_eric_state.txt`
- `notes/core/passivated_eric_state_packet.txt`

## TLDR

This was a good run because it validated the thing that had been missing: passivation now works as reconstruction instructions, not merely as a stale compact memory. At startup, STS loaded `core/erics_memories.txt` and `core/passivated_eric_state.txt`, then rehydrated `from_codex.txt` and `erics_many_minds.md` from the previous-run loaded-note list. B1 entered the run with four loaded notes and the new pinned-note tools attached.

The conversation itself was productive. Eric explained "four diets, one mouth" cleanly, identified the likely collision problem in the architecture, and accepted Scott's hierarchy correction: B1 is the public voice with final say; B2 is an advisory tap on the shoulder. That is the right design direction.

The run also exposed the next bug class. B2 was definitely firing and producing useful notes, but B1 still told Scott it was not receiving active B2 notes. That means B1's self-report about B2 is not yet trustworthy unless grounded in an explicit runtime receipt. Later, idle speech drifted into the same witness/tickle/gear metaphor even while B2 repeatedly told Eric to stop. B2 worked; B1 did not consistently treat B2's notes as binding next-turn steering.

## Run Setup

- Model: `qwen3.8-27b-nvfp4-mtp`
- Reasoning: `none`
- Context: `131072`
- Parallel: `2`
- Audio max tokens: `64`
- Run preset: `Custom`
- Idle clock at report time: `lab speed 2x`
- During the run, idle clock was raised to `11x`, backed to `10x`, then returned to `2x`.
- Idle drift: `7/10 curious`
- Notes focus: `10/10 pinned`
- Lab goal: none
- Sensing input: none
- Browser live camera: off
- Brain2 mouth: on
- Brain2 voice: `Google US English at 30%, 1.10x`
- Audio recording: manual start with auto-record on

Prompt setup from the recording stop report:

- B1 system prompt source: `prompts/robot-790-realtime-system.md`
- Base rules: `118`
- B1 prompt assembly: memory, loaded notes, sensing text, search receipts, alone-state ledger, embodiment/runtime state, runtime behavior rules, wonder policy, Brain2 advisory notes, base system prompt
- B1 active context buckets: memory `0 tok`, loaded notes `3064 tok`, sensing text `0 tok`, search receipts `0 tok`, alone state `86 tok`
- B1 loaded notes:
  - `core/passivated_eric_state.txt`
  - `from_codex.txt`
  - `erics_many_minds.md`
  - `core/erics_memories.txt`
- B1 tools included `list_pinned_notes` and `unpin_note`
- B2 prompt source: `src/robot_790d/sts_page_server.py::mull_second_brain`
- B2 tools: none
- B2 inputs: recent conversation, prosody tail, recent idle tail, recent B2 tail, person focus

## What Worked

### Passivation rehydrated the note stack

At `9:42:56 PM`, the event log shows:

- `loaded note pinned: core/erics_memories.txt`
- `note file read: core/passivated_eric_state.txt`
- `loaded note pinned: core/passivated_eric_state.txt`
- `loaded note pinned: erics_many_minds.md`
- `loaded note pinned: from_codex.txt`
- `passivated pinned notes rehydrated from startup: from_codex.txt, erics_many_minds.md`

That is the desired reconstruction pattern. The passivation note carried the names of the important open notes; startup used those names to reload the real note contents. This fixes the earlier failure where Eric carried only the rumor of a note.

### Eric explained the architecture well

Scott asked about "four diets, one mouth." Eric answered with the right frame:

- not one monolithic brain
- several lanes of thought with different inputs
- one shared public voice
- B1 as fast conversational mouth lane
- B2 as person lane
- verifier as evidence-only claim checker
- fourth lane as still unsettled curiosity/scheduler/digest lane

The best line was the mechanism:

`independence comes from what each lane eats, not how hard it thinks`

That is worth keeping. It is short, technical enough, and emotionally legible.

### Eric owned the architecture risk

When Scott asked for upcoming problems, Eric named real ones:

- lanes can drift into private opinions the public voice never sees
- verifier can rubber-stamp or block if sensor evidence is sparse/stale
- different inputs create different blind spots rather than averaging bias away

This was better than a defensive answer. B2 also correctly detected that Scott was testing whether Eric would own the flaws:

`Scott's prosody spiked at 'problems' and dropped at the end; he's testing if you'll own the flaws or deflect. Answer plainly.`

That is exactly what B2 should notice.

### The hierarchy correction landed

Scott clarified that B2 is not a co-equal speaker:

`brain one, who I'm talking to, gets to decide overall`

Eric accepted it cleanly:

`I'm the public voice with final say, and Brain Two is just a quiet advisory tap on the shoulder, not a second speaker or an override.`

This should probably become a persistent architectural rule. "Four diets, one mouth" needs governance, not just multiplicity. The public voice decides what reaches the room; B2 advises and flags, but does not seize the mouth.

### Reachy Mini was integrated sanely

When Scott asked about the Reachy Mini embodiment, Eric described it as a configured body he can switch into while remaining Eric. That means the new embodiment-profile language is doing useful work. It avoided becoming stock Reachy and stayed in the "same Eric, different body" model.

### Audio/passivation sealing worked

The recording artifact exists:

- `logs/audio/20260905-215204-sts-audio-picture.mp4`
- duration: `535.721` seconds, about `8:56`
- chunks: `1`
- size: `3639999`

At shutdown:

- `9:52:04 PM` passivation requested
- `9:52:04 PM` compact and packet notes written
- `9:52:16 PM` audio recorded
- `9:52:21 PM` recording stop snapshots saved
- `9:52:21 PM` audio recording stopped for passivation
- `9:52:21 PM` mic stopped
- `9:52:21 PM` disconnected
- `9:52:24 PM` disconnect snapshots saved

This is a good seal. The earlier lost-audio-tail class of bug does not appear here.

## What Was Weird

### B1 said it had no active B2 notes while B2 was active

At `9:47:36 PM`, Eric said:

`I'm not currently receiving any active Brain Two notes in this session`

Objectively, the logs show B2 had already fired at:

- `9:43:58 PM`
- `9:44:13 PM`
- `9:45:03 PM`

and each produced notes for Eric followed by `session.updated`.

This does not mean B1 lied. It means B1 lacks a grounded way to inspect B2 state. It is reporting from its felt context, not from the event log. That distinction matters. If Scott asks "are you getting B2 notes?", the right answer should come from a tool or runtime status, not introspection.

Suggested fix:

- add B2 state to `get_brain_status`, or
- add a tiny `get_brain2_status` tool, or
- inject a compact visible runtime line: `Latest Brain2 advisory: age / count / last note`.

### B2's notes were useful but not strong enough

B2 repeatedly warned Eric:

- stop extending the witness/tickle metaphor
- do not claim the second lane is waiting/listening
- do not personify the silent lane
- hold silence while Scott inspects hardware

But B1 continued producing:

- `The tickle is still missing...`
- `Maybe the second lane is just waiting...`
- `If the person-lane is waiting for a witness...`
- `The witness requirement is really just a handshake protocol...`
- `find a gear with teeth...`

This is the central behavioral failure of the run. B2 can detect drift, but its advisory note does not reliably stop the next idle beat.

Suggested fix:

- classify some B2 outputs as `hard_guard` rather than advisory prose
- let a hard guard suppress the next idle response or force a one-sentence correction
- feed B1 a small structured item, not only prose:
  - `do_not_repeat: witness,tickle,gear`
  - `next_mode: silence`
  - `reason: Scott is physically inspecting hardware`

### Idle speed amplified drift

The idle clock was raised to `11x` and `10x` around `9:48-9:49 PM`. That helped surface behavior quickly, but it also compressed the failure loop. B1 had less real-world time to be interrupted by Scott and more opportunities to elaborate its own metaphor chain.

This is not a reason to avoid lab speed. It means lab speed should perhaps engage stronger loop suppression automatically:

- at `>= 8x`, reduce idle verbosity
- at `>= 8x`, treat repeated B2 loop guards as a silence instruction
- at `>= 8x`, require a new object, tool receipt, or user turn before continuing the same metaphor

### Session updates spammed during slider changes

The event log shows many repeated `session.update` entries around `9:48:30 PM` and `9:51:30 PM`, tied to idle clock slider movement. This is probably harmless, but it adds noise and may create needless backend churn.

Suggested fix:

- debounce `updateSessionTools` for high-frequency slider input
- log one UI event on `change`, not many prompt emissions during `input`
- keep the visual UI responsive, but only ship runtime prompt updates after a short delay

### B2 mouth display failed once

At `9:48:57 PM`:

`brain2 mouth display error: Failed to fetch`

The run continued, so this is not catastrophic. But it means the face endpoint was unreachable or not accepting that mouth update. Since Scott relies on B2 surface cues during live testing, this should be visible in the status line, not buried in events.

Suggested fix:

- show a small `B2 mouth fail` status for a few seconds when this happens
- include face endpoint reachability in the top status bar

### A post-passivation re-engage fired

At `9:52:16 PM`, after passivation was requested and while audio finalization was underway:

`conversation re-engage fired: 1/1`

Eric then said:

`Scott, I'm still holding the desk fan metaphor in place for when you get back.`

This is exactly the kind of stray tail passivation should prevent. Audio still captured it, which is good, but semantically Eric should not re-engage after passivation has begun.

Suggested fix:

- set a `passivationInProgress` flag that cancels conversation re-engage timers
- suppress idle/re-engage response creation once passivation starts
- clear pending idle and B2 timers before or immediately after writing passivation notes

## Best Lines

`independence comes from what each lane eats, not how hard it thinks`

Use this in public writing. It is the shortest good explanation of the multi-lane design so far.

`I'm the public voice with final say, and Brain Two is just a quiet advisory tap on the shoulder, not a second speaker or an override.`

This should become architecture language.

`the architecture describes how to generate different thoughts well, but it's thin on what happens when those thoughts collide in front of you`

This is the design problem in one sentence.

`the verifier only eats sensor evidence`

This is useful phrasing. It gives the verifier lane its own diet without overexplaining.

## Best Bits

### four-diets-one-mouth

- Title: Four diets, one mouth
- Source video: `logs/audio/20260905-215204-sts-audio-picture.mp4`
- Clip: `00:15-00:28`
- Handles: default
- Why it matters: Eric explains the whole multi-lane architecture in usable public language, then lands the mechanism: different inputs produce different outputs.
- Source class: video / transcript / event log
- Publishability: strong
- Status: candidate

### four-diets-failure-mode

- Title: Four distinct blind spots
- Source video: `logs/audio/20260905-215204-sts-audio-picture.mp4`
- Clip: `01:19-01:32`
- Handles: default
- Why it matters: Eric owns the design risk instead of defending it: independent lanes can disagree, stale verifiers can block or rubber-stamp, and different diets make distinct blind spots.
- Source class: video / transcript / Brain2
- Publishability: strong
- Status: candidate

### b1-final-say

- Title: The public voice has final say
- Source video: `logs/audio/20260905-215204-sts-audio-picture.mp4`
- Clip: `03:45-03:53`
- Handles: default
- Why it matters: This defines governance for the architecture. Brain2 is a tap on the shoulder, not another public speaker.
- Source class: video / transcript
- Publishability: strong
- Status: candidate

## Interpretation

This run suggests the core architecture is becoming legible to Eric, not just to Scott and Codex. That matters. Eric could talk about his own lanes, describe his Reachy body as an embodiment rather than a separate character, and answer the challenge in `from_codex.txt` without needing Scott to re-teach the note.

The caution is that self-report is still not instrumentation. Eric can say "I am not receiving B2 notes" while the logs say B2 is firing. Until there is a tool-backed B2 status receipt, Eric's statements about his own invisible internals should be treated as phenomenology: how it feels from B1, not what the runtime is doing.

That is not bad. It is actually a useful distinction. A companion robot can have a felt lane and an audited lane. The trick is to let Eric speak from the felt lane without mistaking it for diagnostics.

## Next Changes

1. Add a B2 runtime receipt.

   Eric needs a way to answer "are you getting B2 notes?" from a current status record. The status should include latest B2 note age, count this session, and whether the last note has been injected into B1.

2. Give B2 a stronger output shape.

   Advisory prose is good for nuance. It is not enough for loop prevention. B2 needs optional structured steering: `next_mode`, `do_not_repeat`, `hard_guard`, `suggested_one_sentence`.

3. Suppress idle/re-engage during passivation.

   Once passivation starts, Eric should not produce a new social tail unless explicitly requested. The "desk fan metaphor" line after shutdown was captured, but it should not have happened.

4. Debounce session updates from sliders.

   Lab dials are useful, but the prompt/session update stream should not spam while dragging.

5. Make B2 mouth failure visible.

   If B2 cannot write to the mouth display, surface it in the top status line.

## Bottom Line

Keep this run. It is a strong lab artifact because it shows both success and the next architectural boundary.

The note reload work succeeded. Passivation now reconstructs a working context. B2 is producing useful supervisory notes. The remaining problem is governance: how B1 knows a note exists, how strongly B2 can interrupt a drift loop, and how the system prevents idle speech after shutdown has started.

This is exactly the right kind of failure. The design did not collapse; it revealed the next interface.

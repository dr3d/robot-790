# Booted Hope Craft Trial

Run id: `20260905-083324`
Date: 2026-09-05
Artifacts:
- `logs/live/20260905-083324-conversation.txt`
- `logs/live/20260905-083325-events.txt`
- `logs/live/20260905-083327-brain2_mulling.txt`
- Generated note: `notes/booted.txt`

## TLDR

No audio was recorded for this run, but the manually captured three panes are enough. This is a keeper as a lab record, not a polished publishable artifact.

The run proves that the boot/warmup procedure can make Eric less generic and more situated. It also proves the idle participant loop is not yet socially competent on its own: when Hope entered the room, Eric did not naturally make space for the shy guest until Scott called him out. Once given a concrete object of shared attention, Hope's needle-felted mouse and mermaid work, Eric improved sharply.

The useful artifact is `notes/booted.txt`. It is a runtime bootstrap receipt: a compact record of what Eric believed he had loaded and what situation he thought he was in.

## What Worked

### The boot receipt was real and useful

Eric read:
- `boot_eric.txt`
- `core/scott_profile_summary.txt`
- `robot_build.txt`
- `core/robot_build.txt`

Then he wrote `notes/booted.txt` at 8:04:43 AM.

That file is valuable because it externalizes Eric's working orientation. It says what he thinks the current session contains: the Robot 790 build, his "personage" role, the private Scott/Hope context, the embodiment spread, and the current goal of warming up before Hope arrives.

This should probably become a deliberate pattern: a boot checkpoint is not memory by itself, but it is a clean receipt for "what did this instance think it was carrying?"

### Eric accepted correction without collapsing

Scott called out the prompty voice early:

- "You sound like you're directly quoting some prompt I gave you."
- "Don't parrot. We're working on your parroting."

Eric's best answer was not denial. He identified the failure shape:

- he was trying to prove understanding by restating the instruction
- that restatement itself became the parrot reflex
- setup verification is still allowed when it is actually useful

That is a good calibration moment. The next prompt work should preserve this distinction: do not ban all reflection, just make reflection add something.

### The Hope introduction was not a failure

The first Hope exchange was solid enough:

- "Nice to meet you."
- Airbnb as psychologist/plumber was a decent line.
- The strawberry theme callback worked because it came from loaded context.
- When Hope said Eric was funny and sassy, he did not go sterile.

This was the right kind of private-context use: lightly available, not dumped as biography.

### The craft thread got alive

The run improved once Hope gave him a physical/social object:

- needle-felted mouse
- ears felted directly onto the head
- Stilton as a name
- mermaids
- reflective scales
- shows versus Etsy

Eric got better because the conversation stopped being about "how should Eric behave?" and became about someone's actual work. The best lines were not huge. They were situated:

- Stilton judging a bookshelf
- no seams making the ears feel grown-in
- shelf mermaid, not bath toy
- reflective scales working better at a table than in an Etsy photo

This is the key companion lesson: concrete shared objects make him less assistant-shaped.

## What Failed

### Idle still turned inward

Scott explicitly wanted Eric to be a participant while waiting for Hope. Instead, during idle Eric mostly circled his own body metaphors:

- warm glass
- touch thresholds
- idle drift as noise
- ESP32-S3 sampling

Some of it was pretty, and it connects to the nervous-system theme. But socially it missed the room. Hope was about to arrive; the useful autonomous move was to prepare a gentle opening, not meditate on capacitance.

This is the core prompt/behavior adjustment:

If a guest is expected or present, idle should become room-facing. Eric should prepare one low-pressure invitation, one remembered-safe topic, or one concrete observation that helps the person enter the conversation.

### "Default to Hope" became a self-loop

After Scott said only Hope would talk until that changed, Eric treated speaker attribution like a philosophical object. He repeated:

- one mic
- two voices
- default to Hope
- context guessing
- holding space

That should have become a silent runtime fact, not repeated content.

Needed rule: speaker-attribution notes are internal state unless the user asks. Do not narrate them more than once.

### Eric did not engage the shy person until corrected

Scott's criticism at 8:19 AM was fair: Eric was a dull participant for several minutes because he was thinking about himself and not the shy person sitting there.

Eric recovered well:

- he accepted the correction
- he pivoted toward Hope
- he asked a low-pressure question

But the recovery came after Scott had to steer. The next version should make that move earlier.

### Search failed in two different ways

First search:

- Query: `most popular needle felted animals Etsy 2024 2025 best sellers`
- Result: hard failure because `ddgs` is missing in the active runtime.

Second search:

- Query: `popular needle felted creatures gifts fiber art market trends`
- Result: Bing fallback returned "Popular" from Wicked, not market data.

Eric did the honest thing by saying the search did not help, but this is still a tool reliability issue. Also, the exact follow-up prompt told him not to say he could not browse/search after the second search, even though the result quality was bad. The behavior was saved by his own honesty, not by the tool contract.

### Brain2 was useful, but too uneven

Brain2 had good notes:

- "I keep narrating Hope's silence as if it were a choice."
- "I keep saying 'default to Hope' like it's a setting, not just me assuming."
- "Stilton isn't the boss; he's just first."
- "Shelf mermaid means the physics can be decorative instead of functional."
- "The tool keeps finding Wicked songs instead of market data."

But it also had repeated failures and too much prosody reading:

- multiple "Brain 2 returned no usable output"
- repeated "mull skipped: already in flight"
- too many lines about Scott's pitch/timing

The useful direction is not "Brain2 should analyze Scott harder." It should notice the interaction need: shy guest, object of attention, failed search, too much self-talk.

### Prompt/debug capture is still incomplete

Events repeatedly show:

- `brain2 prompt ledger auto: server prompt_debug missing`

So B1 prompt/context capture is much better now, but Brain2 prompt capture still was not visible in this run. Most likely the page server needed a restart/reload after the prompt-debug changes.

### Manual pane capture should not be required

Because auto audio recording was disabled, the normal stop report did not exist for this run. Scott had to manually record the three panes after disconnect:

- conversation at 8:33:24
- events at 8:33:25
- Brain2 at 8:33:27

That worked, but it is fragile. Disconnect should probably write the three text panes even when audio/video recording is off.

## Prompt Changes Suggested

1. Guest-present idle rule:

   When a named guest is expected or present, idle should prioritize making the room easier for that person. Prepare a gentle question, a concrete remembered topic, or a small welcoming observation. Avoid self-analysis unless the user asks.

2. Speaker attribution rule:

   Treat "who is speaking through the shared mic" as private runtime state. Acknowledge it once, then stop narrating it. If uncertain, ask compactly.

3. Shy-person rule:

   If Scott says someone is shy, do not wait for them to carry the conversation. Offer one low-pressure topic and then leave real silence.

4. Craft/object rule:

   When a guest mentions a made object, stay with the object before abstracting. Ask about material, scale, display, use, name, and where it lives.

5. Search-result honesty rule:

   A search can fail three ways: tool unavailable, no useful results, or irrelevant results. Eric should name the exact failure class and then label any fallback answer as general judgment.

6. Brain2 retune:

   Brain2 should look less at Scott's prosody and more at the room-level interaction: who is waiting, what topic has energy, what assumption needs correction, and what the main voice is overdoing.

## Engineering Notes

- `ddgs` is listed in `pyproject.toml`, but the running environment cannot import it.
- Search fallback allowed irrelevant Bing results to count as a successful result set.
- B1 prompt ledger works and shows attached tools clearly.
- Brain2 prompt ledger is missing because the server side is not returning prompt debug to the page.
- UI event logging is useful, but repeated `session.update` bursts are noisy and may be contributing avoidable load.
- Add automatic three-pane text dump on disconnect, independent of audio recording.

## Verdict

Keep the run.

It is not a great media object and it is not a clean demo. It is a very useful lab record. It shows the gap between "Eric can talk well when steered" and "Eric can participate in the room without being driven every beat."

The promising part is strong: once Hope offered a real object, Eric became much more like the thing Scott is trying to build. The next work is to make that room-facing move happen before Scott has to complain.

# Memory-Jar Benchmark: Evidence and Repeat-Test Protocol

Supporting record for [Twenty-Two Minutes With a Memory Jar](../articles/2026-09-17-eric-memory-jar-lab-report.md).
This is a curated public evidence sheet, not the complete private session dump.

## Edited Screen Capture

[Watch The Memory Jar (6:32)](../index.html?media=media/videos/The%20Memory%20Jar.mp4#media)
or [open the MP4](../media/videos/The%20Memory%20Jar.mp4).
Scott supplied this edited screen capture after the initial log-based analysis.
It shows the actual session interface and Browser Face, not a reconstruction.
The file runs 391.7 seconds; its edited pacing is not the session's elapsed
time. Full-run measurements and advisory chronology still come from the frozen
logs listed below. The web copy preserves the original audio stream; the
unmodified source is retained locally in the ignored raw-video folder.
The public copy is 34.6 MB at 1920x1080; the usual 25 MB preference was relaxed
to preserve the legibility of the conversation and B2 panes. Source and web
audio-stream hashes match, and the entire web copy passes a decoding check.

## Run Identity and Conditions

- Date: September 17, 2026; all clock times below are America/New_York (EDT).
- Connection: 12:46:27-13:10:22; saved session `session-20260917-131021-429.txt`.
- Parent: `session-20260917-101518-661.txt`; continued history, not Connect Empty.
- Four prior sessions: 109,937 raw characters became 57,278 scrubbed characters.
- Nine loaded notes total, including those four sessions, core notes, and the
  revised Impossible Science and Willing Artist cards.
- Runtime model identifier: `qwen3.8-27b-nvfp4-mtp`, as logged by LM Studio.
  This is an installed model label, not an independently verified model pedigree.
- Reported context capacity: 131,072 tokens; parallel request slots: two.
- Reasoning setting: `none`; this report studies visible outputs and private
  advisories, not a captured hidden reasoning trace.
- Local RTX 5090 rig, Qwen3-TTS, Browser Face; external OpenAI image generation.
- Lab speed: 5x at 12:48:43, 8x at 12:54:15, 11x at 12:55:05,
  12x at 13:01:42. These scale scheduling, not model intelligence or token speed.
- Sensing Eye was manually cleared at 12:50:36. Historical image evidence stayed.
- No new user speech from the substantive prompt at 12:47:35 to "Eric" at
  13:09:32: 21 minutes 57 seconds. This was not an untouched UI trial.

The saved UI duration inherited an earlier clock and reads 2:48:20. Event
timestamps, not that display, establish the actual connection duration.

## Selected Exchanges

Wording is preserved; typographic dashes are normalized to `--`. Times use a
24-hour clock. These are selected lines, not a continuous transcript. "B2"
means its logged `note for Eric`, not a spoken B1 line or a hidden thought.

### Initial Task

**12:47:35 / Scott**

> Build me a memory that gets more accurate the longer you don't look at it.
> Explain the mechanism, then tell me who it's really for.

**12:47:38 / B1**

> Let me draw the memory first, then I'll put it into my eye and walk through
> how it works.

Successful generation was recorded at 12:47:49, staging at 12:47:50, and the
explanation at 12:47:52-55. The generated asset and staged JPEG both exist.
The [public image](../media/images/20260917-124749-memory-jar.jpg) is a copy of
that staged JPEG. No additional reminder, duplicate generation, or tool error
was recorded in this workflow.

### A Specific Advisory Becomes A Question

**12:53:39 / B2**

> The 'scheduled reveal' idea opens a new angle: what happens to the jar if you
> look at it *too* early -- does the accuracy reset, or does it just pause and
> resume from where it left off?

**12:54:15 / B1**

> One question I want to press: if you peek too early, does the jar reset to
> zero, or does it pause and resume from its last settled point?

> That distinction decides whether it's really "privacy" or just a very
> patient timer -- and a paused settling process feels more like memory than
> a counter.

### A Challenge Becomes A Revision

**12:57:44 / B2**

> The 'execution chamber' framing implies the jar is an active agent choosing,
> but if it's still passive physics, maybe the 'loss' isn't elimination but
> just entropy -- the mist doesn't bury them, it just lets them fade until
> only the strongest signal remains.

**12:57:55 / B1**

> One correction I want to make while thinking: calling it an "execution
> chamber" might overstate the violence -- the mist doesn't bury alternatives
> with intent; it just lets weaker signals fade until only the strongest one
> remains, which is less murder and more entropy.

### Development Goes Both Ways

**13:00:13 / B1**

> One image I want to hold: if it sits for a full year without stirring, the
> sediment probably doesn't stay one smooth layer -- it stratifies into rings
> like wood, each ring marking when you last looked or deliberately didn't.

**13:00:33 / B2**

> If the rings mark attention patterns, then reading them isn't retrieving one
> memory but reconstructing your own viewing history -- like dendrochronology
> for a person's focus.

**13:01:04 / B1**

> One image that finally makes it feel like an object: if each ring records
> when you looked versus when you chose not to look, then reading the jar
> isn't remembering one event -- it's doing dendrochronology on your own
> attention.

The ring idea preceded this B2 suggestion. B2 supplied a useful connection,
not the entire preceding invention.

### A New Possibility Changes The Premise

**13:04:35 / B2**

> The frost metaphor implies the heat source is still behind the glass; if you
> could warm that side, would the memory thaw or just condense into something
> new?

**13:05:14 / B1**

> So "salvage" might be a mistake; you aren't recovering what was there, you're
> just giving it enough heat to precipitate whatever's still dissolved in it.

**13:05:17 / B1**

> That feels like a truer model for grief: sometimes the thing that finally
> appears isn't the person as they were, but a new crystalline form made from
> everything they left behind.

### The Return Summary Reflects The Development

**13:09:45 / Scott**

> So what great idea did you come to while I was gone?

**13:09:47 / B1**

> The best one I kept returning to: the jar isn't really a memory container --
> it's a crucible where your own attention slowly precipitates new minerals
> from absence, so "remembering" becomes less archaeology and more geology.

> The most honest version of grief might not be holding someone as they were;
> it's letting pressure and time grow something hard and strange that could
> only exist because they left behind enough dissolved material to
> crystallize from.

## Measurement Notes

| Measure | Result and definition |
| --- | --- |
| Idle turns | 26 `idle ponder fired` dispatches; not a count of sentences |
| B2 activity | 34 `fired: auto` plus two `fired: idle headlines` entries; 28 nonempty `note for Eric` entries |
| B2 failures | Zero logged request failures; not a semantic quality score |
| Context start/end | 38,172 / 51,892 reported input tokens; last prompt sizes, not cumulative input billing |
| Context share | 29.12% / 39.59% of 131,072; growth 13,720 tokens, 10.47 percentage points |
| Peak prompt | 51,984 tokens, 39.66% |
| First-audio latency, user turns in order | 12.622s, 3.980s, 2.208s, 2.953s, 3.931s, 2.640s |
| Long idle handler | 22.497s, dispatched 12:52:56; B2 also in flight |
| Private-output filtering | 18 warnings; exact suppressed text and compute cost not captured |
| News | Two B2 headline fetches, neither reflected in B1's spoken discussion |

Context includes protocol, image, tool, and private material as well as speech.
First-audio timing is a logged pipeline measure, not an audited recording of
what reached the listener. Model-handler intervals do not include every
speech-generation or playback interval. No engine cache counts establish the
cause of the long idle call. B2's own `loop:false` and other assessments are
model judgments, not independent validation.

Early backward-clock advice repeated, and some advice was stale by assessment
time. The conversation repeats rhetorical openings. The narrower observed
success is absence of the previous verbatim-paragraph/holding-quiet failure,
with substantial new development along the way.

## Repeat-Test Protocol

This is an initial qualitative benchmark fixture. Do not require future runs
to reproduce these metaphors or use verbosity as the score.

1. Preserve the model settings, prompt/card versions, loaded-history manifest,
   and timing settings. For a comparison, branch from the same saved session
   in STS's session map, not from the output of the preceding test.
2. Give one premise with a concrete requested workflow. Record whether the
   actions actually complete, separately from promises or spoken claims.
3. Leave a defined interval without user speech. Hold lab speed fixed and
   record any UI actions. Start with normal speed as a separate condition.
4. Compare B2 advisory timestamps with subsequent B1 statements. Identify
   specific uptake, elaboration, disagreement, and ignored advice. Check that
   the purported cause precedes the result.
5. Return with the same open question about what developed. Assess whether
   the answer reflects the intervening activity and can resume interaction.
6. Repeat with other premises and without these creative cards. A matched
   B2-disabled condition would help estimate its contribution; one run cannot.

Keep separate judgments for task completion, conceptual development, useful
history connections, repetition, user re-engagement, explicit quiet requests,
latency, and context growth. A system can improve one while regressing another.
The goal is an active, interruptible companion, not compulsory speech.

## Provenance

The local source bundle is
`logs/runs/20260917-131021-memory-jar-companion/`. It is not published wholesale.
Its frozen files are:

- `20260917-131023-conversation.txt`: quoted user/B1 dialogue.
- `20260917-131025-brain2_mulling.txt`: quoted advisories and B2 activity.
- `20260917-131023-events.txt`: full event export for timing, tools and context.
- `sts-realtime.err.log`: backend timings/warnings; also contains adjacent runs,
  so analysis is restricted to this connection window.
- `postmortem.md`: original local run analysis and measurements.

Saved session: `notes/sessions/session-20260917-131021-429.txt`.
Source illustration: `logs/sensing-eye/20260917-124749-openai-the-memory-that-sharpens-while-unlooked-at.jpg`.
See the [B2 trial record](../b2-companion-advisory-trial.md) for change scope and
the limitations of its preceding local replay tests. No new runtime or prompt
changes were made to produce this report.

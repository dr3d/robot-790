# Conversation Follow-up Pacing

Updated September 16, 2026. Operator-requested trials, not base personality prompt changes.

## Behavior

The previous attentive scheduler allowed one afterthought, then held further
ones until the entire attention window expired. It now spaces subsequent beats
using the existing cooling curve. Normal response generation, playback drain,
user speech, tool activity and loop brakes still gate every dispatch. A beat is
an opportunity for a worthwhile continuation, not a guaranteed extra sentence.

`config/runtime.json` keeps these tunable without extra UI:

- `idle_timing.attention_start_s`: 8 seconds (was 12).
- `idle_timing.post_user_quiet_s`: 8 seconds (was 12).
- `idle_timing.attention_warm_s`: 75 seconds (was 45).
- `idle_timing.attention_fade_s`: 240 seconds (was 180).

At drift 7 / lab 1x, the delay curve is about 8, 10, 24, 60 and 113 seconds
at 0, 20, 60, 120 and 240 seconds after the operator-directed reply finishes
playing. These are scheduling gaps, not promised audio onset times. Each new
beat must finish playback before the next gap begins. Autonomous speech never
renews the attention clock. New user participation does. Other lab modes retain
their prior timing rules. The original global defaults remain fallback values;
the repository runtime config selects this trial.

Lines appearing during a long answer can simply be additional streamed sentences
of that answer, not separate autonomous followups. This change affects the latter.
It does not deliberately generate new replies over an answer that is still playing.

## Discovery Follow-ups

September 16 adds an independent discovery clock. A successful web search with
new result content, a newly selected B2 headline, or successfully staged idle art
can renew the pace without pretending Scott spoke or returned. Failed searches,
empty results, B2 advice by itself, and Eric's own speech cannot renew it.

Evidence from `logs/live/20260916-140033-events.txt`: a 15-minute repetition
cooldown began at 13:55:25; a fresh headline arrived at 13:56:13 but did not release
it. Lab speed cleared it at 13:57:24. This was more than a long ordinary interval.
Fresh discovery now clears the old exhaustion cooldown and B2 hard brake. Older
B2 loop warnings no longer count toward a new brake, while subsequent warnings
still can. Re-delivering the same evidence cannot clear a later brake.

Runtime knobs (no added UI):

- `idle_timing.discovery_enabled`: `true`.
- `idle_timing.discovery_start_s`: `8`, initial gap in real seconds.
- `idle_timing.discovery_fade_s`: `240`, real seconds to ordinary pacing.

At drift 7 / lab 1x the discovery curve is about 8, 10, 24, 60 and 113 seconds
at ages 0, 20, 60, 120 and 240 seconds. The clock starts when evidence arrives;
each subsequent gap starts after speech playback finishes. Receipt delivery can
advance an already scheduled slow deadline. Polls cannot keep postponing it.
Inference, audio and foreground work add their own time. At lab 5x, settled idle
is about 22.5 seconds; discovery eases from 8 seconds toward that faster baseline,
never slowing an even faster base interval. The four-minute fade is not compressed.

Search novelty is mechanical, not a semantic quality judgment: compare normalized
URL/title/snippet tuples against up to 256 recent evidence signatures per connection.
Query rewording or result reordering alone does not count. A changed snippet can
count; content repeating after ledger eviction can count again. Art uses the saved
filename. Connection/hot-context reset clears this transient state. Late idle
searches from a departed run or pre-return user state cannot renew it.

Prompt disclosure: an additional temporary `discovery` idle lane invites Eric to
develop the thought, question it, or associate it with older history. This is not
a system-prefix rewrite, a new model call, or a change to B1/B2 personality or
setup cards. The human conversation ramp and active goals/self-tasks take priority.
Full-history B1 idle remains intact. First Contact, substrate experiments and
Drift 11/12 keep their existing behavior; Drift off remains off.

Verification: 398 STS JavaScript tests and 156 focused Python tests pass
(page server, shared idle context, idle art),
including fixed-deadline scheduling, playback/user/tool guards, novelty,
cooldown release, new loop evidence, 5x pacing, stale results and session resets.
These are controlled tests, not yet a live judgment of Eric's new rhythm. The
active run was left untouched. Refresh STS between runs to load the browser code;
the added page-server config fields need its updated process for later tuning.
Browser fallbacks already match the new 8/240 settings.
Inline script syntax and `git diff --check` pass. Ruff still reports seven existing
import-order/line-length issues elsewhere in the touched page-server files; this
change leaves those unrelated sections alone.

## Browser Face

Speech eye movement now uses held, phrase-length glances on a roughly 4.2-second
cadence, alternating side/upward targets with returns toward center. This replaces
the small, rapidly changing speech jitter targets. Manual gaze and disabled eye
animation remain authoritative. These are procedural glances, not camera face
tracking or exact sentence alignment. Mouth geometry and palette are unchanged.

Operator refinement: speaking targets now replace the idle/base gaze rather than
adding offsets to it. The sequence includes stronger side/down glances, upward
glances, and centered holds (including a double-length center beat). Quiet speech
keeps the same readable target range. Explicit manual gaze still takes priority.
STS releases its automatic thinking-gaze lock at speech onset for Browser Face;
refresh both pages if that integration fix has not yet been loaded.

## Verification And Trial

388 JavaScript tests pass, including the new cooling-gap and speech-gaze tests.
Playwright checks distinct nonblank eye frames at compact and desktop sizes;
screenshots are in `logs/speech-gaze-*.png`. The live runtime-config endpoint
returns the updated timings. Refresh STS and Browser Face before the next run.

Try one long Impossible Science question, then stay quiet through several beats.
Watch for useful refinement versus repetitive padding, responsiveness when you
resume, and audio separation. The recurring same-question/same-answer tendency
was not changed by this work; sampling and loaded historical answers were not
altered. Startup relevance remains a separate open PM finding.

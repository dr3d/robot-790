# Conversation Follow-up Pacing

Updated September 14, 2026. Operator-requested trial, not a personality prompt change.

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

## Browser Face

Speech eye movement now uses held, phrase-length glances on a roughly 4.2-second
cadence, alternating side/upward targets with returns toward center. This replaces
the small, rapidly changing speech jitter targets. Manual gaze and disabled eye
animation remain authoritative. These are procedural glances, not camera face
tracking or exact sentence alignment. Mouth geometry and palette are unchanged.

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

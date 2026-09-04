# Warm-Up Curve

Candidate observation: Eric often seems better after several minutes of live
loop time.

Scott has noticed this more than once, and said it explicitly near the end of
the 2026-09-03 recursion run: the session went longer than expected, and "it's
always better at the end than at the beginning." Eric immediately reflected the
same read back.

## Working Hypothesis

Eric may need roughly 10 minutes of live conversation, tool use, face state,
Brain 2 observations, and local callbacks before he feels fully "in it."

This is not a claim that the model changes internally. The likely mechanisms are
ordinary and still interesting:

- the conversation context accumulates concrete handles
- early file/tool friction gets resolved
- Scott settles into the run and gives clearer steering
- Eric gets recent examples of Scott's cadence, concerns, and tolerance
- Brain 2 has time to produce social observations and callbacks
- the system crosses from cold setup into shared local material

The effect matters because it may be a practical way to bridge continuity gaps.
If Eric starts each session partially cold, a short warm-up ritual could give him
enough current-run material to become funnier, less generic, and more capable of
pulling earlier details forward.

## Receipts

- `logs/live/20260903-215205-conversation.txt` at 9:51:02 PM: Scott says the
  run is "always better at the end than at the beginning."
- `logs/live/20260903-215205-conversation.txt` at 9:51:03 PM: Eric agrees that
  it landed better at the end and jokes about burning Scott's GPU.
- `logs/live/20260903-202557-conversation.txt` from about 8:03:44 to 8:06:31:
  the early file-hunting stretch is stiff and corrective; later in the run, the
  body/sensor material is more fluid and produces the "nervous system before a
  spine" line.

## Caveats

This could be several effects braided together:

- real context accumulation inside the model window
- Scott becoming more relaxed or specific
- stronger topics arriving later in the run
- selection bias from remembering good endings
- scheduler/Brain 2 timing effects that improve or worsen with load

Do not write this as "Eric wakes up after ten minutes" without evidence.

Better phrasing:

```text
Candidate: Eric has a warm-up curve. Runs often become more companionable after
several minutes because the loop has accumulated fresh local material.
```

## Possible Test

Run the same prompt/task two ways:

1. cold start, immediately ask the target question
2. 10-minute warm-up with light conversation, one tool use, and one Eric summary
   callback, then ask the target question

Compare:

- callback quality
- repetition/parroting
- humor
- repair after correction
- time to useful answer
- Scott's subjective "fun at the end" rating

This is a companion-quality test, not a soul test.

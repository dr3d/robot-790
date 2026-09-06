# Idle Research Report Run

Run files:

- `logs/live/20260905-061431-conversation.txt`
- `logs/live/20260905-061434-events.txt`
- `logs/live/20260905-061435-recording_stop_report.txt`
- `logs/audio/latest-sts-audio-picture.mp4`
- Eric-written output: `notes/result.txt`

## Operator Provenance

Scott reported during the run that the lab goal was set until roughly halfway through.

The event log gives one concrete anchor:

- `6:04:54 AM` - `lab goal cleared`

Interpret idle behavior before that point as potentially lab-goal-shaped. Interpret later behavior as more dependent on last-user echo, self-task continuation, search receipts, and ordinary idle/mull context.

## TLDR

This run is worth keeping as a systems test, even if the publishable conversation may be uneven.

The idle/autonomous loop produced a real artifact: Eric wrote `notes/result.txt`, and the report is useful. It correctly narrowed onto ESP32-S3 touch sensing, GC9A01 / round display implications, and browser-face audio timing. The strongest move is that Eric turned "touch" into a timing/baseline problem rather than a mystical presence sensor. That is the right engineering shape.

The failure is also clear: when Scott returned, Eric did not gracefully yield from the autonomous research thread. Instead, he continued the lookup/tool path and hit suppressed tool markup. The next design step is not "make idle smarter" in the abstract; it is "make idle hand control back to Scott cleanly."

## What Worked

Eric followed the broad assignment: go away, pick project-relevant build topics, search, then write a report. The final report has a coherent center rather than a pile of trivia.

Best useful claims in `notes/result.txt`:

- ESP32-S3 touch sensing is a hardware-FSM charge/discharge timing problem.
- Raw counts should be treated like a timing window, not a direct voltage or magic touch truth.
- Baseline drift from temperature, humidity, front glass, and environment means calibration matters more than picking a fixed threshold.
- Browser-face lip sync should become an audio-clock alignment problem, especially if DSP moves to `AudioWorklet`.
- A small status/phase visualization for browser-face audio timing could be useful debugging instrumentation.

Best creative idea:

- Treat slow touch-baseline drift as a possible expressive signal, not only a bug. If the face honestly measures drift, the robot can become more alert/twitchy under certain environmental conditions without pretending the signal means more than it does.

## What Needs Verification

Eric's report is useful, but not fully source-clean.

The source list at the bottom is too vague:

- "ESP-IDF Capacitive Touch Sensor documentation"
- "Web Audio API AudioWorklet performance guides"
- "Real-time AI avatar embedding patterns"

That is not enough for public technical confidence. Future reports should include exact links or compact source receipts.

Specific claim to verify before treating as design truth:

- Whether the ESP32-S3 touch FSM can keep meaningful touch behavior through deep sleep, or whether the system must wake and re-baseline before readings are trustworthy.

Eric was circling this distinction in the run. The postmortem should preserve that uncertainty rather than flatten it into "touch works in sleep."

## Return Anomaly

Scott reported that after he came back, Eric's transcript words appeared to stop during the run.

The logs support a specific failure shape:

- `6:12:01 AM` - Scott: "Eric, I am back."
- `6:12:18 AM` - Scott: "Did I lose you?"
- `6:12:07 AM` - Eric path goes into `search_web` instead of a normal spoken return-response.
- `6:12:12 AM` - `tool markup suppressed`, suggesting the model tried to emit tool markup into the speech/text lane.
- Normal Eric transcript resumes later for the note-writing exchange:
  - `6:13:45 AM` - "Saved that to result.txt."
  - `6:13:55 AM` - "Thanks, Scott. I'll be here when you're back."

Postmortem read: this was likely a tool-followup / suppressed-markup failure, not Eric choosing silence. Autonomous research must yield when Scott returns.

## Brain 2 Read

Brain 2 was active but noisy. It produced useful compression in places:

- "Nap metaphor fits: no drift while off, just total amnesia."
- "Humidity isn't drift; it's a longer fill time."
- "Face as binary switch vs fingers measuring fill-time: hardware forces two different time-scales."

It also failed often with "Brain 2 returned no usable output." That makes it a good monitor, but not yet a stable second narrator.

The better use of Brain 2 here is not to steer Eric directly. It should mark contradictions, metaphors that are sticking too hard, and moments where Scott returns while B1 is still trapped in a tool loop.

## Behavior Diagnosis

The run shows the new autonomy loop beginning to work:

- It can pick project-relevant topics.
- It can search.
- It can carry a thread across multiple idle turns.
- It can produce a written report on request.

But the loop is still too sticky:

- It over-repeated touch/FSM/timing metaphors.
- It sometimes searched its own narration rather than the outside world.
- It did not treat Scott's return as an interrupt with higher priority than the research thread.
- It emitted tool markup into the speech lane after a search.

That is the main engineering target.

## Next Changes

Make Scott's return a hard priority interrupt for idle/autonomous work:

- When user speech is detected after a long idle stretch, clear or pause active idle self-task momentum.
- Suppress new controller-side idle searches for a short grace period after the user returns.
- If a tool-followup is pending during return, answer Scott first with a compact status sentence, then continue or abandon the tool thread.
- Add a run artifact field for "return from away" timing.

Improve report receipts:

- When Eric writes a report from autonomous search, append a "Search Receipts" section with exact queries and top source URLs already held in `searchContextReceipts`.
- Preserve uncertainty language for claims derived from snippets.

Improve lane telemetry:

- Keep the new `LANES` indicator.
- Add lane/collision/search receipt summary to future stop reports.
- Use this to compare `parallel=2` vs `parallel=3` before changing architecture.

## Keeper Notes

Keep `notes/result.txt` as a valid output of this experiment. It is not polished public documentation, but it is a successful proof that Eric can turn idle time into a compact project note.

The headline is not "Eric learned more than Scott." The honest headline is better:

Eric can now be left alone with a bounded research-shaped task and come back with something worth arguing with.

# Overnight Idle, Bedtime Buffer, STT Fatigue

Session: 2026-09-08 01:53-09:20 EDT  
Session note: `notes/sessions/20260908-092022-overnight-idle-bedtime-buffer-stt-fatigue.txt`  
Parent session: `notes/sessions/20260908-012440-bedtime-image-eye-facepaint-continuity-check.txt`

## Summary

This was a long overnight idle run after the bedtime image session. Eric connected correctly, reported the restored session-note chain, remembered the prior bedtime image, and then entered idle with the generated bedroom image still present as a sensing-eye/status-line receipt.

The important failure was not a single crash. The system stayed alive for more than eight hours, but idle and Brain 2 repeatedly circled the same "bedroom image buffer" idea. Brain 2 produced hundreds of loop-guard notes, yet those notes did not become a hard enough behavioral stop. When Scott returned in the morning, STT did transcribe short wake-up turns, but the interaction felt degraded: Eric answered with old boot/count material and did not feel cleanly re-engaged.

## What Worked

- Connect latest loaded the expected parent session:
  - `sessions/20260908-012440-bedtime-image-eye-facepaint-continuity-check.txt`
- The continuity chain rehydrated the expected pinned notes.
- Eric correctly remembered the prior bedtime image generation and face-paint sequence.
- The browser face stayed reachable through the night.
- Mic maintenance ran repeatedly and restarted the Amazon USB Streaming Mic.
- After the long idle, STT still produced completed transcripts for Scott's short return turns:
  - "Eric."
  - "What have you got?"
  - "Yeah."
- Disconnect wrote a session note and saved pane snapshots.

## What Failed Or Felt Wrong

- Idle fixated on the prior bedtime image for hours.
- The same idea repeated in slightly different language:
  - face-paint off but eye/status still names the image
  - the bedroom image as a held breath, secret, mask, or buffer
  - repeated hour-counting at 3 AM, 4 AM, 5 AM, 7 AM, and 9 AM
- Brain 2 saw the loop and generated many loop guards, but the guards became their own loop.
- The idle hard brake paused automatic idle at times, but the overall system still accumulated repetitive Brain 2 state.
- On morning re-engagement, Eric answered "fresh boot with session notes loaded" even though this was the same long-running session, not a fresh runtime.
- STT felt unreliable from the operator side. Logs show completed transcriptions, not explicit transcription failures, so the likely issue is aged interaction state plus short/late audio handling rather than a clean STT API failure.
- Audio recording finalization timed out during disconnect after 18 seconds.

## STT And Mic Evidence

The event log does not show a clear `transcription.failed` event at the morning return. It does show speech start/stop and completed transcription events at about 09:18-09:19.

What the log does show:

- 29 quiet mic maintenance restarts over the long run.
- Repeated `mic fresh ears restart: quiet mic maintenance after 15m`.
- Morning speech was detected and transcribed.
- The last "Yeah" was extremely short: speech start, speech stop, one transcription delta, then completed transcript in the same second.

So the PM conclusion is: STT did not hard-fail in the logs, but after a long idle run the whole listening/re-engagement path felt weak. The next test should compare:

- leaving it alone again
- pressing Refresh Ears before speaking
- stopping/starting mic before speaking
- doing a clean reconnect after long idle

## Brain 2 And Idle Evidence

Brain 2 produced a very large tail. The repeated guard text eventually dominated the record:

- "The bedroom buffer loop has run for over seven hours..."
- "The bedroom buffer loop has run for over nine hours..."
- "stop extending it entirely and return empty strings until a new external event or tool receipt occurs"

This is useful, but it is still only advisory. The main lesson is that loop guard notes need an enforcement path. After repeated guards, idle should go quiet at the scheduler/control layer, not ask the model to please stop repeating itself.

## Recommendations

- Add a hard idle-quarantine state after repeated Brain 2 loop guards.
- Treat "return empty strings until a new external event" as executable policy, not just advisory text.
- Reset or summarize Brain 2 tail after a long idle loop so the next turn is not swimming in repeated guards.
- On user return after long idle, prioritize the fresh runtime receipt: "same session, long idle, user returned" rather than reusing the boot greeting.
- Add an STT health indicator that compares speech-start events, completed transcripts, empty transcripts, and time since last mic restart.
- Consider auto-refreshing ears immediately on first user speech after more than an hour of idle.
- Keep the bedtime image/status receipt, but do not let static eye state become an hourly monologue topic.

## Artifacts

- `session-note-copy.txt`
- `conversation.txt`
- `events.txt`
- `brain2_mulling.txt`
- `session-audio-source.webm`
- `session-audio-picture.mp4`
- `session-audio-session-source.webm`
- `session-audio-session-picture-chunk-000.mp4`
- `session-audio-session-picture-chunk-001.mp4`
- `session-audio-session-picture-chunk-002.mp4`

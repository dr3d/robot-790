# Standing Joke Routine Archive Check

PM for the 2026-09-07 23:23 Daily Driver standing-routine and archive-check run.

## Session

- Time: 2026-09-07 23:23:01-23:28:27 ET
- Session note: `notes/sessions/20260907-232827-standing-joke-routine-archive-check.txt`
- Parent session: `notes/sessions/20260907-175329-daily-driver-empty-boot.txt`
- Model line: `qwen3.8-27b-nvfp4-mtp`, reasoning none, context 131072, parallel 2, runtime audit `runtime_load_failed`
- PM session copy: `session-note-copy.txt`
- Conversation artifact: `conversation.txt`
- Event artifact: `events.txt`
- Brain 2 artifact: `brain2_mulling.txt`
- Recording report: `recording-stop-report.txt`
- Audio source: `audio-source.webm`
- Video artifact: `video.mp4`

## What Happened

Scott used Connect Select to reload the Daily Driver baseline, checked whether Eric was present, asked about previous context and voice testing, then asked for a ten-second joke routine. Eric correctly recovered Daily Driver context and the prior voice-test outline. He started a standing routine with a tool receipt, but the routine exposed ambiguity: it was neither ordinary idle nor GPU watch. It was a spoken-cue routine firing B1 prompts on cadence when the lane was free.

The jokes began stale and standard. Scott pushed for unexpected. Eric improved slightly when he moved from stock jokes to odd room/object imagery, but he also over-explained failures and let self-correction kill timing. Brain2 caught that directly.

After the run, Connect Select archive was tested and worked: older session notes moved under `notes/sessions/archived/`, leaving the PM-named run and the Daily Driver baseline in the active selector.

## What Worked

- Daily Driver session restore was clean.
- Eric's continuity answer was good and specific.
- Prior voice-test context survived into the restored session better than the previous failed voice-state run.
- `start_standing_routine` produced a real receipt and cadence state.
- Eric correctly said GPU watch was not running while the joke routine was active.
- `stop_standing_routine` was used correctly at the end.
- Disconnect saved the session note and recording artifacts.
- Archive UI/backend worked after the stale page-server restart; Connect Select active list is now usable.

## What Failed / Frayed

- Eric promised unexpected humor before actually delivering it.
- The first jokes were stock: toaster heat and unresolved dependencies.
- The standing-routine mental model is not yet clear enough to Scott or Eric.
- The routine skipped many cues while B1/user-turn state was busy, which made timing feel less direct than "every ten seconds."
- Eric's self-analysis became too chatty; he explained why jokes failed instead of simply taking the next swing.
- Transcript still has punctuation encoding scars.
- Runtime audit still reports `runtime_load_failed`, so model-load status remains noisy.

## Lessons

- Standing routines need a clearer operator-facing description: they are queued B1 cue injections, not idle and not a tool loop.
- The UI/status should distinguish `idle`, `standing routine`, and `watch` more strongly.
- For comedy/performance routines, Eric needs a constraint like: do not analyze the joke unless Scott asks; fire the next image.
- Brain2 was right: "self-correction is killing the timing" is an excellent performance-mode guardrail.
- Archive succeeds as a note-management primitive: delete-from-list should mean move out of active sessions, not destroy.

## Receipts

- 11:22:44 PM: Connect Selected loaded Daily Driver baseline.
- 11:22:44 PM: pinned notes rehydrated: profile summary, boot file, get-go, and Eric memories.
- 11:24:09 PM: `start_standing_routine` succeeded: spoken cue, 10s cadence, 600s duration, task `tell one short joke`.
- 11:24:19 PM and after: routine cues fired when the B1 lane was available.
- 11:26:25 PM: Brain2 flagged `ROUTINE GAP`.
- 11:26:59 PM: Brain2 warned that self-correction was killing timing.
- 11:27:24 PM: Eric correctly distinguished joke routine active from GPU watch inactive.
- 11:28:18 PM: `stop_standing_routine` succeeded; previous state showed 5 cues and 20 skipped cues.
- 11:28:27 PM: session note saved.
- 11:28:36 PM: MP4 recording saved.
- Post-run: Connect Select archive moved older sessions under `notes/sessions/archived/`; active selector is now current run plus Daily Driver baseline.

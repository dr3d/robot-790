# Eric On Reachy: Cheat Sheet

Current Robot 790 adapter repertoire, September 13, 2026.
Eight STS gestures plus six stock recorded performances. Music synchronization
and continuous emotional choreography are not implemented.

## Start Here

"Eric, switch into Reachy Mini."

The Reachy adapter must be running with motion enabled and the robot ready.
Keep head/antenna travel clear. For a clean demonstration, use Lab Speed 1x
and Idle Drift 0. Ask for one move at a time and watch it settle.

## Eight Gestures

| Say to Eric | What to look for | Preset |
| --- | --- | --- |
| "Give me a thoughtful head tilt." | Sideways tilt with asymmetric antennas, then eases back | `thoughtful` |
| "Show me a slow smile with your antennas." | Antennas open in stages with a small lifted tilt, then soften | `slow_smile` |
| "Do a confused gesture." | Tilts one way, then the other, with different antenna positions | `confused` |
| "Play your inspect gesture." | Turns, changes viewing angle, then centers | `inspect` |
| "Show me your focus lock gesture." | Small attentive pitch and antenna lift, then settles | `focus_lock` |
| "Give me a double take." | Looks aside, returns, looks again more emphatically, then softens | `double_take` |
| "Play your drowsy gesture." | Nods down, briefly rallies, then droops again | `drowsy` |
| "Do one small robot scan." | Head/body sweep left, right, then center | `robot_scan` |

These phrases are requests to Eric, not exact voice-command keywords. If he
only describes a move, try: "Actually play the thoughtful face beat now."
The preset names above are the exact names his `play_face_beat` tool accepts.

## Stock Performances

These use Reachy's installed recorded-movement library, not generated motor
targets or the stock conversation personality. Ask one at a time and wait for
completion. Keep the head, body, and antenna travel clear. Bundled library sound
cues may play on Reachy; Eric's spoken voice remains on the workstation.

| Say to Eric | Recorded clip | Approximate duration |
| --- | --- | --- |
| "Play the affection beat." | `loving1` | 6 seconds |
| "Play the daydream beat." | `thoughtful1` | 6 seconds |
| "Play the startle beat." | `surprised1` | 3 seconds |
| "Play the wary beat." | `fear1` | 4 seconds |
| "Play the goofy dance." | `dance2` | 18 seconds |
| "Play the silly dance." | `dance3`, more energetic | 19 seconds |

A short first test: daydream, then affection, then goofy. These names are
performances, not a request to change Eric's lasting emotional state. Their
catalog availability and adapter routing are verified; physical quality still
needs an operator-observed run.

## Other Things To Ask

- "Look a little to your left." / "Now a little to your right."
- "Look slightly up." / "Look slightly down."
- "Look straight ahead." Centers the head, not the body after a robot scan.
- "Look left and hold your gaze for three seconds." Requests a gaze hold;
  it is not the same as setting a preset's travel time.
- "Look happy." / "Look curious." / "Look focused." / "Look confused."
  Moods use smaller single poses; they do not replay the full animated gestures.
- "Look sleepy, but don't put the robot to sleep." Requests an expression.
- "Check your body sensors and tell me your head and antenna positions."
  Requests measured state, not another gesture.

## A Little Demonstration

Say these as separate requests, pausing roughly six seconds between them:

1. "Look straight ahead."
2. "Give me a thoughtful head tilt."
3. "Show me a slow smile with your antennas."
4. "Give me a double take."
5. "Do a confused gesture."
6. "Play your inspect gesture."
7. "Now look straight ahead again."

That gives you a small performance without asking him to schedule choreography.

## Useful Limits

- **Travel versus hold:** the original eight beats have two to four steps, taking about 1.6-4 seconds
  plus command overhead, with a protected expression window of at least 6.6 seconds.
  Each next step waits for the daemon's completion receipt. Automatic speech, listening, thinking,
  and idle cues yield to the requested pose. A new explicit gesture, stop,
  release, or sleep/wake command can still supersede it.
- **Sleep versus sleepy:** "Put the Reachy body to sleep" requests physical
  sleep. "Wake up" requests the wake routine, which may enable motors. The
  routing is tested, but this pair has not yet had our physical smoke test.
- **Stopping:** keep Reachy Control available for deliberate stop, parking,
  or motor control. Switching bodies or disconnecting STS is not a motor-level
  emergency stop. Adapter `/stop` cancels only its own running moves.
- **B2 body language:** with Brain 2 and face tools enabled, B2 can suggest one
  occasional thoughtful, inspect, slow-smile, confused, or focus-lock gesture.
  It uses its existing mull, not an extra model call. Stale or busy suggestions
  are dropped; explicit controls win. A 30-second real-time cooldown is not sped
  up by Lab Speed. This is optional nonverbal punctuation, not a dance scheduler.
- **Not wired here yet:** independent antenna tools, arbitrary dance choreography,
  camera images, or Eric's TTS on Reachy's speaker. Voice stays on
  the workstation; the robot's hardware may support more than this adapter exposes.
- **Receipts:** `accepted` means the first move was accepted, not that the gesture
  finished. `sequence.status: completed` means every step received completion;
  `last_motion.completion` is only the latest step. Watch the robot as well.

## Direct Test Without Eric

Read-only network timing and state:

```powershell
.venv/Scripts/python.exe scripts/reachy_motion_check.py
```

With the robot clear and STS disconnected, test all eight sequences plus an
in-flight stop. This **moves the physical robot** and ends with a small recenter:

```powershell
.venv/Scripts/python.exe scripts/reachy_motion_check.py --move --output logs/reachy-motion-check.json
```

Setup and technical detail: [Eric On Reachy](reachy_embodiment.md).

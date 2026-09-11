# Eric On Reachy

For spoken requests and the current gesture repertoire, see the
[Reachy Cheat Sheet](reachy-cheat-sheet.md).

Eric on Reachy should not mean replacing Robot 790 with the stock Reachy Mini
conversation app. It should mean keeping Eric's existing brain, voice practice,
notes, curation, and tool contract, then adding Reachy Mini as another
embodiment.

In project terms, Reachy belongs in the firmware tier even though it is not
ESP32 firmware. It is an embodiment controller: a small local service that
presents the same semantic face/body API as the S3 face, mask face, and browser
face, then translates those calls into Reachy Mini daemon calls.

Call it firmware-like adapter code: not the personality, not the conversation
app, not a second mind, but the body contract Eric can inhabit.

The clean architecture:

```text
Robot 790 STS loop
  -> existing Eric prompt, voice, notes, idle loop, tools
  -> set_embodiment("reachy_mini")
  -> local Reachy embodiment adapter
  -> Reachy Mini SDK / robot app
  -> motion, gaze, expressions, sensors
```

The first adapter entry point is:

```powershell
.\scripts\start_reachy_adapter.ps1
```

By default this talks to the local Reachy Control app bridge at
`http://127.0.0.1:8000/` and starts in motion-gated mode. If the local bridge is
not running and Reachy is only reachable over LAN/mDNS, pass
`-DaemonUrl http://reachy-mini.local:8000/`. The adapter answers `/state` and
accepts the same high-level routes as the face controllers, but it will not
physically move Reachy unless started with:

```powershell
.\scripts\start_reachy_adapter.ps1 -AllowMotion
```

That keeps embodiment selection safe: Eric can discover and report the body
before the body is allowed to act.

Motion-gated mode means the adapter will not send movement requests. Allowing
motion means it may send bounded Reachy daemon movement requests. Ordinary
gestures require a ready backend and already-enabled motors. Explicit `/wake`
requests invoke the daemon's wake routine, which can enable motors; routine STS
idle does not wake or enable the robot.

## Principle

Eric is the personage. Reachy is a body.

The broader cross-body direction, including capability manifests, hardware
profiles, body awareness, and the acrylic/mask path, lives in
[`creature-runtime-architecture.md`](creature-runtime-architecture.md).
Reachy is a demanding test case for that common contract, not an exception to
it.

Do not let a second conversation stack create a second Eric unless the run is
explicitly testing that. The first useful version should keep the language model,
TTS, STT, note files, and run logs on the Robot 790 workstation, then send only
bounded body commands to Reachy.

The designed Reachy social cues belong in Eric's toolbox, not above Eric's
identity. In `config/runtime.json`, the `reachy_mini` embodiment profile can
name the useful body feel: friendly head tilts, antenna punctuation, tabletop
scale, small curious beats, camera/media receipts, and motor state. Those are
affordances Eric may use the way he uses eyes, mouth labels, captions, touch, or
the chassis. They are not permission to import the stock Reachy personality,
memory, or conversational frame into Eric.

## Adapter Contract

The current adapter shares the semantic HTTP surface where the body supports it:

- `GET /state`: daemon readiness, motor mode, measured head pose, antenna
  positions, body yaw, state-read errors, capabilities, and the last movement
  receipt. Positions use meters/radians; `gaze.now` is measured, not the request.
- `POST /emotion` (also `/mood` or `/expression`): `curious`, `happy`, `focused`,
  `confused`, `sleepy`, or `sleep` map to small poses. The `sleep` mood is a
  drowsy expression, not the physical sleep routine.
- `POST /gaze`: normalized `x`/`y` become bounded head yaw/pitch. `duration`
  controls the gaze hold (zero means indefinite); `move_ms` controls travel time,
  clamped to 600-2000 ms for physical motion. Speaking poses preserve a held gaze.
- `POST /control`: combines expression, gaze, and speech metadata into one move.
  Automatic STS lifecycle cues carry `source: lifecycle` and yield to explicit
  pose/gaze holds, returning `held` without dispatching or cancelling motion.
- `POST /mouth`: stores speech metadata without polling the daemon or animating
  a display. Captions and mouth styles are explicitly unsupported.
- `POST /beat`: `slow_smile`, `inspect`, `thoughtful`, `confused`, `focus_lock`,
  `double_take`, `drowsy`, or `robot_scan`. These are bounded two-to-four-step
  sequences. Each step uses daemon `goto` and waits for its completion event.
  Double take really looks twice; scan sweeps both ways and centers.
- `POST /sleep`: requests the daemon's physical sleep routine. Ordinary gestures
  are then gated until an explicit wake request.
- `POST /wake`: requests the daemon's wake routine, potentially enabling motors.
  An explicit STS `set_robot_mode` with `idle`, or the spoken wake shortcut, uses
  this route for Reachy. Repeated requests reuse an already-running wake routine.
- `POST /release`: clears expression/gaze holds only. Ordinary STS idle uses
  this route with `source: lifecycle` and cannot clear an active explicit hold.
  It does not park, stop, or wake the robot.
- `POST /stop`: cancels running moves owned by this adapter instance. It does
  not cancel other controllers' moves, park the body, or disable motors.

Move responses distinguish `accepted` from `failed`, `gated`, `busy`, and
`unsupported`. Acceptance includes the daemon UUID but is **not completion**.
The adapter listens to `/api/move/ws/updates`. `sequence.status: completed`
requires completion of every step; `last_motion.completion` describes only its
current UUID. Disconnection, failure, cancellation, or a missing completion
halts further steps. Known running adapter moves are stopped where possible.
An unknown dispatch is never retried. Measured pose remains separate evidence.
Status reads and mouth ticks do not erase the last movement error.

STS now waits up to eight seconds for the exact gesture sequence's completion
before its final tool followup. The initial spoken acknowledgment can still
arrive immediately. Polling never replays motion; timeout, replacement, or an
unavailable state produces an explicitly unverified acknowledgment. Bodies
without completion tracking retain their original receipt behavior.

Commands are serialized. A replacement target cancels this adapter's prior
running move, while ordinary gestures wait for wake/sleep routines and refuse to
compete with another controller's running move. This is not an emergency-stop
system: keep Reachy Control available for motor-level control.

Adapter 0.3.0 protects the running sequence and an expression window of at least
6.6 seconds. Automatic cues are discarded, not queued for later playback; speech
metadata can still update. Explicit commands retain priority. STS reserves the
visual hold before awaiting the gesture HTTP reply, then uses the adapter's
hold duration. Failed or held requests do not create a new reservation. Stop
invalidates future steps as well as cancelling owned daemon moves.

For `.local` daemon names, HTTP and the completion socket use IPv4 to avoid the
observed Windows mDNS IPv6 connection timeout. The hostname is still resolved;
no DHCP address is hardcoded. Loopback bridges and explicit IPv6 URLs retain
their normal transport. Cold requests measured about 2.09-2.20 seconds before
this change and 0.047-0.053 seconds with IPv4 on the September 10 lab network.

Brain 2 receives a compact body-specific addition only while Reachy is selected
and face tools are enabled. Its existing JSON output may include `body_beat`.
Only thoughtful, inspect, slow_smile, confused, and focus_lock are accepted;
there are no arbitrary angles or wake/sleep commands. STS drops stale, held,
disabled, or tool-busy results and enforces a 30-second uncompressed cooldown.
If only Eric's own response/playback is in the way, one cue may wait up to 15
real seconds. It must still match the session, body, user evidence, assistant
output, and visual revision when dispatched. New activity or expiration drops
it; there is no growing motion queue. Drop reasons are logged individually.
No second B2 inference is added. Conversational mood cues remain small single
poses, separate from these occasional animated gestures.

There is no camera-frame delivery, IMU telemetry, Reachy audio routing, eye
painting, eye-style control, or background idle-animation engine in this adapter.
STS supplies conversation lifecycle cues; audio stays on the workstation.
`GET /beats` and `/moods` list the implemented presets; unsupported actions return
an error instead of silently substituting a neutral pose.

The adapter can translate these calls into whatever the Reachy Mini SDK exposes.
The important part is that Eric keeps speaking in semantic body verbs; the
adapter owns the hardware details.

Daemon facts observed on 2026-09-10 (not permanent configuration):

- `reachy-mini.local` resolves on the LAN as `192.168.0.236`.
- Reachy Mini Wireless daemon answers at `http://reachy-mini.local:8000/`.
- The local Reachy Control app can expose the same daemon at
  `http://127.0.0.1:8000/`, which is the preferred daily-driver adapter target
  on the Windows lab machine.
- API docs are available at `http://reachy-mini.local:8000/docs`.
- The daemon reported version `1.10.0`.
- `/api/daemon/status`, `/api/state/full`, `/api/motors/status`,
  `/api/media/status`, and camera specs are readable.
- The backend was ready and motors were `enabled` during inspection. Check the
  current state before each physical test; do not infer readiness from this note.

## First Conversation Test

With the robot stable and clear of obstructions, start one adapter:

```powershell
.\scripts\start_reachy_adapter.ps1 -DaemonUrl http://reachy-mini.local:8000/ -AllowMotion
```

Select Reachy Mini in STS, use Lab Speed 1x, and disable idle drift for the first
pass. Keep the usual Eric prompt and workstation microphone/speaker. Ask one at
a time, letting each gesture settle:

1. "Give me one thoughtful head tilt."
2. "Show me a slow smile with your antennas."
3. "Do a confused gesture."
4. "Look a little to your left."
5. "Now look straight ahead."

Watch the tool receipt and actual movement together. Sleep/wake, full-body turns,
and free-running idle are separate tests. Adapter-owned motion can be cancelled
with:

```powershell
Invoke-RestMethod http://127.0.0.1:8792/stop -Method Post `
  -ContentType 'application/json' -Body '{}'
```

Stopping the adapter process or switching bodies does not cancel a move already
accepted by the daemon. Use `/stop` first and Reachy Control for deliberate parking
or motor disable.

### Verification On September 10

The repaired adapter was exercised against the physical robot: seven small head,
antenna, gaze-hold, and combined-control steps returned daemon `move_completed`
events. A separate in-flight stop returned `move_cancelled`, followed by a
completed recentering move. The test harness listened to daemon events directly;
At that stage, the adapter itself did not yet monitor completion.

A later 0.2.1 priority regression check replayed `robot_scan`, `drowsy`, and
`confused`, each immediately followed by automatic happy-speaking, listening,
and release cues. All three reported `move_completed`, not cancellation.
Measured body yaw was about 0.150 rad for the scan, pitch 0.177 rad for drowsy,
and roll 0.169 rad for confused, with distinct antenna positions. A fourth move
returned the head, body, and antennas toward neutral. The test used existing
bounded presets, no LLM, and a separate daemon completion-event listener.

Measured head angles were within about 4.6 degrees of the requested targets in
this smoke test, not a precision calibration. Sleep/wake routing is covered by
mock and STS tests but was not physically exercised in this pass. Camera, audio,
and a full spoken Eric conversation were not part of the test.

### Animated Sequence Verification, September 10 Evening

Adapter 0.3.0 completed all eight gestures against the physical robot: 24 steps
in total, each with a daemon completion receipt. Automatic happy/speaking cues
were injected during every gesture and correctly returned `held`. A second
double-take was interrupted during its first step; no subsequent steps were
dispatched and no stopped UUID remained running. A small recenter also completed.

Observed dispatch latency was 0.032-0.061 seconds. Measured pose samples confirm
distinct yaw/pitch/roll and antenna changes; this is functional validation, not
precision calibration or a subjective evaluation of expressiveness. Evidence:
`logs/runs/20260910-reachy-sequences/direct-test.json` (local, not published).
Use `scripts/reachy_motion_check.py --move` to repeat the direct test deliberately.

### Idle-Run Repairs, September 10

The 19:23 empty run and 19:58 continuation exposed a quiet completion-stream
disconnect and automatic thinking gaze that could block the next speaking pose.
Adapter 0.3.1 clears the TCP connect timeout before the WebSocket receive loop,
and automatic coordinate gaze no longer reserves an explicit hold. Explicit
gesture/gaze priority and motion amplitudes are unchanged. `state_age_s` reports
cached measurement age; action receipt time is not pose observation time.

STS now gates idle captions on the active profile's `mouth_text` capability.
The compact idle body context explicitly distinguishes motor-only scanning from
camera capture and avoids equating bounded angles with collision clearance.
Gesture follow-ups distinguish accepted/running from verified completion.

B2's Reachy task now permits occasional quiet body punctuation without an
operator command. Physical suggestions belong in `body_beat`, not just an
advisory to a tool-less B1 idle reply. Its existing stale/busy/hold checks and
real-time cooldown remain. The B2 log includes selected, abstained, rejected, or
invalid body choices so the next PM can distinguish silence from dispatch failure.
Imagination remains welcome; imagined buffers are not sensor evidence.

Next conversational comparison: refresh STS, Connect Empty, select Reachy, use
Lab Speed 1x, and request double-take, drowsy, and robot-scan separately. Then
leave 10-15 minutes of idle and ask what occupied him. Keep model/runtime settings
unchanged. This avoids inheriting the previous thread's unsupported buffer story.
Software regressions cover the fixes; physical and conversational verification
of 0.3.1 remains a separate step, not a claim about the earlier 0.3.0 tests.

## Planned Performance Roster

September 11, 2026: inspected the neighbouring local working copy at
`D:\_PROJECTS\reachy_mini_conversation_app` (HEAD `9ed8f24`). This is a plan and
offline asset check, not a claim that the following moves are enabled in STS.
No robot movement or runtime configuration changes were made for this inspection.

### Goal: Emotional Verbs Become Body Language

Emotional expression and performances are separate capabilities on both face
and body. Expression conveys a mood or attitude through appearance, posture,
and responsive movement; it can include brief reactions, not just a static
pose. A performance is an intentionally played action such as a double take,
comic face routine, peekaboo, or dance. Duration or motion amplitude alone does
not determine which it is. Eric can choose either himself, or respond to an
operator's request for either.

The existing conceptual split is `set_face_mood` / `/emotion` for expression
and `play_face_beat` / `/beat` for a performance. Extend both to Reachy without
collapsing them into one emotion-to-clip table. A source library calling a clip
an "emotion" does not automatically make playing that entire clip the right
implementation of an ongoing emotional state.

The goal is deeper than a callable dance menu. Reachy should physically express
Eric's changing emotional intent during ordinary conversation, as the face
embodiments express him visually. A requested performance is one use of that
system, not its primary reason to exist. Retain the stock app's expressive
movement affordances without importing its personality or replacing STS.

Use Eric's existing semantic vocabulary (`curious`, `happy`, `surprised`,
`confused`, `affection`, `proud`, and the other face moods) as the common intent
layer. Each embodiment renders that intent using its own capabilities:

```text
Eric's expressive intent
  -> emotional expression: mood, attitude, responsive body language
  -> performance: a deliberately played face or body action
Both -> active embodiment's renderer and coordinated motion owner
     -> eyes / mouth and/or head / antennas / body
```

These are declared expressive choices, not a measured psychological state.
The adapter should not diagnose emotions from English keywords in Eric's text.
The model chooses meaning; deterministic code supplies timing, transitions,
motion bounds, and cancellation. B2 may contribute an occasional contextual
cue through its existing route, but is not an obligatory extra model call
between every expression and the body.

Required integration behavior:

- **Self-expression is permitted.** Review the current `set_face_mood` and
  `play_face_beat` descriptions, which emphasize operator-requested actions.
  Update the active-body instructions and tool contracts together so Eric can
  express himself without waiting for "do a gesture." Do not broaden physical
  wake/sleep or unrelated tool authority as a side effect.
- **Mood, motion, and conversation mode are distinct.** Listening/thinking/
  speaking are lifecycle states, not emotional labels. A speaking cue must not
  reset an intentionally thoughtful or surprised expression to generic happy.
  Emotional expression may persist or react briefly; changing mood does not
  automatically launch a named performance. Repeated mouth or mode updates must
  not restart a full performance. When a performance ends, return to the current
  expression, including any mood change made during it, not always neutral or
  the stale mood captured at its start.
- **Mapping is expressive, not merely literal.** Choose appropriate library
  trajectories for the common moods, with restrained or larger variants where
  they exist. Keep the mapping and variation policy in configuration with source
  IDs and capability checks. Initially expose only verified mappings; missing
  support must not silently choose an unrelated random emotion.
- **Speech and gesture can coexist.** A silent emotional cue need not hold up
  Eric's sentence, ask for another user command, or trigger a compulsory spoken
  completion report. Keep action receipts available to the model and PM without
  turning normal body language into narration. Align cues with actual response/
  playback boundaries rather than interpreting words with regular expressions.
- **One owner coordinates the body.** Entry/exit blends, deliberate performance,
  emotional posture, listening behavior, and later speech-reactive offsets must
  cooperate. Preserve stop, disconnect, body-switch, and explicit hold behavior;
  expire stale cues instead of replaying a backlog after the conversation moves on.
- **Expression coverage stays body-specific.** Keep one common emotional
  vocabulary and a compact active-body manual. Do not add every library's full
  catalogue to every brain or to embodiments that cannot perform those moves.

The first eight candidates below are finite performances for playback validation
and reusable motion material. They are not an eight-state emotion system or the
final emotional range. A first integration is only complete
when some appropriate emotional cues happen naturally during conversation,
without Scott naming a move. Validate requested and self-chosen expression,
audible-speech continuity, readable differences, and no repetitive restart.
Do not judge success solely by a demo in which eight explicit commands move
the robot. Keep imaginative language intact; improve the body that expresses it.

### Face Performances Need The Same Distinction

September 11 clarification: goofy already serves as a requested performance,
but a pose protected by a timer is not a sufficient general performance model.
A held pose can be one intentional phase; it need not be removed or animated
gratuitously. The face also needs actions with authored timing and progression.

Observed implementation, not a completed repair:

- STS `playFaceBeat()` reserves a generic 5.5-second visual hold.
- Browser Face's `FaceSimState.beat()` maps the name to a mood and records a
  director label; it does not run a corresponding multi-phase performance.
- The S3 face firmware has an `IdleDirector` with real multi-step routines such
  as double take, but its goofy branch largely repeats a timed expression.
  There is reusable face-performance machinery already, not a blank slate.

Use a performance lifecycle common in meaning across face and body: start,
progress, completed, cancelled, failed. Give each run an identity, owned channels,
its own timing, and a return to the current emotional expression. Completion
should release its hold; a timeout is a watchdog, not proof of completion.
Entry, anticipation, action, an optional comic hold, and recovery are possible
phases, not mandatory phases for every beat. For example, a proposed goofy
routine could combine an eye change, asymmetry, a mouth accent, and recovery
instead of only selecting `mood=goofy` for several seconds.

Eyes, eyelids, gaze, mouth, and body movement can be coordinated by the active
embodiment. Preserve speech audio and define how a performance's mouth action
coexists with speech-driven mouth animation. Background lifecycle cues must not
erase the performance, but explicit stop/disconnect/body-switch must still work.
Do not import Reachy's motor trajectories into the face renderer; share the
semantic lifecycle and reuse each embodiment's appropriate animation code.

This is a related face-performance work item, not permission to expand the first
Reachy playback probe into a rewrite of every firmware. Keep emotional-state
rendering and deliberate performance invocation distinct in both implementations.

### Reuse Already Available

- `tools/dance.py`: named or random dances, repeat count, non-blocking enqueue,
  and no compulsory spoken follow-up (`needs_response = False`).
- `dance_emotion_moves.py`: `DanceQueueMove` and `EmotionQueueMove` adapt existing
  library trajectories to the SDK's `Move.duration` / `Move.evaluate(t)` contract.
  The emotion wrapper supplies motion without its optional audio sidecar.
- `moves.py`: a single movement owner with a queue, a 60 Hz target loop,
  listening-state coordination, and a breathing move. Some comments still say
  100 Hz; the actual configured target in this working copy is 60 Hz.
- `tools/play_emotion.py`: curated recorded-move mappings and compact intent
  descriptions. Reuse the catalogue, not the English keyword interpretation or
  the random fallback when a requested intent fails to resolve.
- `eyes_choreography.py`: local eye/body cue coordination. Reference for later
  cross-body work, not a required dependency for the first Reachy roster.

The neighbour's environment contains `reachy_mini_dances_library` 0.2.1 and
`reachy_mini` 1.10.0rc5, plus a cached emotions dataset. These are inspected local
versions, not a recommendation to replace Robot 790's environment wholesale.
The dance library contains 20 named motions. Its `Choreography.evaluate()` is
not implemented, and its duration does not include cycle counts. Use individual
`DanceMove` objects with an explicit bounded queue, not that composite class.
`DanceMove` also shares its parameter dictionary with the catalogue; do not add
per-call parameter overrides without an isolation regression test.

### First Eight Candidates

Keep eight public IDs behind one body-action tool, not eight new tools. Proposed
IDs below avoid collisions with the existing handcrafted beat names. Old IDs
remain compatible until deliberately migrated.

| Eric-facing ID | Existing source | Purpose | Source duration |
| --- | --- | --- | --- |
| `agree` | emotion `yes1` | Clear affirmative nod | 3.40 s |
| `attentive` | emotion `attentive1` | Listening acknowledgment | 4.28 s |
| `ponder` | emotion `thoughtful1` | Thinking performance | 5.90 s |
| `surprise` | emotion `surprised1` | Visible surprised reaction | 2.48 s |
| `groove` | dance `groovy_sway_and_roll` | Short lateral sway with roll | 2.11 s |
| `peekaboo` | dance `side_peekaboo` | Hide/peek performance | 5.26 s |
| `spiral` | dance `interwoven_spirals` | Multi-axis flowing movement | 4.21 s |
| `glance` | dance `side_glance_flick` | Look aside, hold, return | 2.11 s |

All eight loaded offline and produced finite outputs at 121 sampled times each.
Dance durations use the installed default of 114 BPM. These timings exclude
entry/exit blends and repeat counts. The four emotions have audio sidecars; the
four procedural dances do not. No hardware playback was tested.

Unlike our current rotation-only keyframes, some candidates include translation:
groove sampled a 60 mm lateral span; peekaboo sampled 60 mm lateral and 40 mm
vertical spans. Preserve their authored character, but validate poses, transition
speed, clearance, and actual tracking before enabling them. Finite samples are
not proof of mechanical safety or perceptual quality.

### Implementation Order

1. **Small playback compatibility probe, outside conversation.** Load one dance
   and one recorded emotion through their public `Move` interfaces. Establish a
   motion-only path, smooth entry/exit, interruption, and honest completion
   reporting before changing Eric's tools. Prefer daemon-owned finite playback
   with the existing UUID event receipts where the installed API supports it.
   The named-dataset REST endpoint alone is not sufficient for arbitrary local
   procedural moves or guaranteed silent emotions: its inspected implementation
   can play sidecar audio and exposes no sound flag. The local SDK does expose
   `async_play_move(..., sound=False)`, but streams targets; that alternative must
   integrate into the existing adapter's single owner and explicitly distinguish
   local playback termination from daemon-confirmed motion completion.
2. **Package the bounded roster in the adapter.** Pin the required library
   versions, prewarm assets before the conversation, keep source attribution,
   and expose source ID, duration, readiness, and failures. No imports from the
   neighbouring app's mutable checkout at runtime. Reuse library motion code;
   do not redraw the motions as another small list of hand-tuned poses.
3. **Wire one STS command.** Extend the existing `/beat` and `play_face_beat`
   contract with the available Reachy IDs, updating capability receipts, the
   active-body tool schema, manual, and tests together. B1 chooses the named
   performance; deterministic code executes it. No LLM calls per animation frame,
   no giant move catalogue added to other embodiments, no unrequested repeat,
   and no automatic spoken boast after every silent gesture.
4. **Connect emotional expression, then test conversation.** Extend the separate
   mood/expression path with appropriate posture and responsive movement, reusing
   verified motion material where it fits. Do not turn every mood update into a
   `/beat` call. Permit B1 self-chosen expression while Reachy is active. This is
   part of the initial integration, not a deferred optional feature. Keep named
   performances available as distinct actions. Exercise all eight once,
   inspect actual movement and timing, interrupt a performance, switch bodies,
   and disconnect. Automatic speaking/listening cues must not cancel a deliberate
   move. Preserve owned-move cancellation and reject competing controllers.
   Account for entry/exit time in the existing eight-second follow-up deadline;
   never shorten a performance silently to fit it. Keep the old beats available
   for comparison and rollback.
5. **Add optional presence after the roster works.** Consider breathing,
   speech-linked movement, tracking, and a small B2-accessible subset. Do not
   schedule a dance merely because a mood changed or an idle timer fired, or add
   more B2 inference just to animate the body.
   Daemon audio-reactive wobble needs audio delivered to the daemon; current
   workstation speaker playback does not provide that automatically.

The first implementation deliverable is finite, recognizably different
performances with stop/status behavior and an initial mapping from Eric's
emotional verbs into natural body language, not a replacement conversation app
or a general animation editor. Keep Eric's voice, personality, memory, and
session machinery; change the expression contract where needed for self-chosen
body language. No robot-side deployment, environment upgrade, server
restart, or motor test is implied by this plan.

## Bring-Up Order

1. Install and verify the official Reachy Mini SDK outside Eric.
2. Run one deterministic smoke test with no LLM: connect, read state, look left,
   look right, nod or equivalent, park safely.
3. Build a small local HTTP adapter, probably on the workstation first, that
   converts Robot 790 face/body calls into Reachy SDK calls.
4. Add `reachy_mini` to `config/runtime.json` only after the adapter answers
   `/state` reliably. This is now staged as `http://127.0.0.1:8792/`.
5. Test manual UI switching with `set_embodiment`, still no autonomous idle.
6. Enable normal conversation face/body lifecycle cues.
7. Only then allow Eric to request Reachy gestures through tools.
8. Add sensor reads to Brain 3/body-verifier later, with three-state output:
   yes, no, or cannot tell from current sensors.

## Safety And Identity Notes

- Keep actuator limits deterministic. Generated text never outranks the adapter.
- Start with low-energy gestures and a parked pose.
- Treat Reachy sensors as live receipts only when they come from the current
  turn or current state read.
- Keep the stock Reachy conversation app as reference material, not as the
  active personality stack.
- If Reachy has its own app memory or persona layer enabled, call that a
  different experiment.

## References

- Reachy Mini SDK: https://github.com/pollen-robotics/reachy_mini
- Reachy Mini conversation app: https://github.com/pollen-robotics/reachy_mini_conversation_app
- Reachy Mini SDK quickstart: https://huggingface.co/docs/reachy_mini/SDK/quickstart

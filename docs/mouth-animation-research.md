# Mouth Animation: From Pose Switching To Articulation

Research and source-code audit, September 8, 2026. **Production face unchanged.**
The accompanying [Mouth Lab](../web/mouth-lab/README.md) is an isolated rendering
and timing study, not a deployed speech-animation system.

## Judgment

There is substantial room to improve this mouth without changing Eric's voice,
replacing the face with generated video, or adding another large inference
service. The most promising sequence is:

1. Give the mouth continuous geometry and meaningful contact poses.
2. Establish an audio-aligned test recording and tune its motion offline.
3. Deliver a timestamped cue track to the face, with a playback clock and
   cancellation rules, before promising live lip sync.
4. Preserve expressive controls and adapt the working rig to physical screens.

More named poses alone will not solve the current timing and delivery losses.
The desired result is a recognizable, art-directable robot mouth, not a
photorealistic human mouth pasted onto the existing face.

## What The Code Actually Does

These are source-code findings, not diagnoses inferred from a recorded run.

| Area | Current implementation | Consequence |
| --- | --- | --- |
| Shape selection | `nextSpeechMouthShape()` consumes five text characters at a time; `speechMouthShapeFromText()` uses ordered regular expressions. | Spelling groups are not phonemes; one matching letter can classify the whole slice. Silent letters and pronunciation are unaccounted for. |
| Cadence | `speechMouthCueMs = 90`; the fallback is an eight-entry repeating cycle over six labels. | About 11 cue attempts per second, unrelated to the durations of individual sounds. |
| Delivery | The server stores the latest speech state; Browser Face `pollState()` waits 250 ms after each request. | The renderer sees at most about four snapshots per second. Intermediate poses can be overwritten without ever being drawn. A fast canvas loop cannot recover them. |
| Audio clock | `playPcm16Bytes()` schedules buffers on `audioContext.currentTime`; mouth cues run from arrival events and wall-clock timers. | Audio buffering and text delivery can shift the visible motion relative to sound. |
| Easing | `easedPoseForMouth()` uses an exponential 105 ms pose time constant, but resets immediately on a topology change. `round` selects the separate `o` topology. | Ordinary poses lag their targets; rounded transitions can snap. |
| Closure | `closed` still has `open: 0.03`, speech blends with the base expression, and the human painter adds a positive minimum aperture. | This is not a real M/B/P lip seal. A smile/open base can dilute closure further. |
| Teeth | `teeth` selects `grimace` and a strong teeth amount. | F/V is represented by showing teeth, not by upper-teeth/lower-lip contact. |
| Energy | Cue energy is usually a constant; `Number(value) || default` substitutes for explicit zero in several paths. | The number is not a measured, playback-aligned speech envelope. Zero is not consistently preserved. |
| Hardware | The active S3 mouth handler reads `shape`, `talking`, and `energy`, not the nested browser `speech` object. | Browser speech articulation is not implemented identically on the physical face. |

Source locations: [STS cue and playback code](../web/sts/index.html),
[Browser Face polling, pose blending, and painting](../web/face-sim/index.html),
[face state storage](../src/robot_790d/face_sim_server.py),
[S3 mouth handler](../firmware/esp32-s3-face/src/main.cpp).

Two important qualifications:

- The browser already has frame-time-aware easing. The problem is not its total
  absence: a 105 ms time constant reaches only about 58% of a new target in
  90 ms, and topology changes bypass it altogether.
- `drawMouth()` sets procedural talk level to zero while speech cues are active.
  The sine-wave talking fallback is **not** continuously fighting the speech
  poses in that path; it should not be blamed for every movement problem.

## What The Literature Adds

**Viseme** names a visible speech configuration. It is not a one-to-one letter
substitution, and it does not specify the entire motion into and out of a sound.

JALI separates jaw and lip articulation and uses context-dependent motion rules.
Its particularly relevant warning is that generic blending can erase the very
contacts that make speech legible: M/B/P closure and F/V tooth/lip contact.
Neighboring sounds overlap; rounding can begin early while another articulator
is still completing the current sound. That is coarticulation, not simply
putting a slow filter after a pose switch. JALI also keeps motion editable by
an animator. This is a good conceptual fit for an operator who wants to shape
the performance directly. It is research inspiration here, **not** a claim that
the lab implements JALI's full model. [JALI, Edwards et al., SIGGRAPH 2016](https://www.dgp.toronto.edu/~elf/JALISIG16.pdf).

VisemeNet demonstrates a different route: audio can drive editable speech-motion
curves rather than replacement face video. That distinction matters: the
analyzer and the character's renderer do not have to be the same system.
[VisemeNet, Zhou et al., SIGGRAPH 2018](https://arxiv.org/abs/1805.09488).

The practical timing contract is well illustrated by Azure's viseme events:
the shapes arrive with offsets into the audio. Its blend-shape output is another
representation, not a requirement to adopt a realistic 3D face. We should borrow
the explicit audio-time relationship, not switch providers just to get a demo.
[Microsoft viseme documentation](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis-viseme).

## Candidate Analysis Routes

| Route | Useful for this project | Boundary |
| --- | --- | --- |
| Rhubarb | Local recorded-audio baseline with an established 2D cue vocabulary; the lab imports its JSON. | Offline analysis, not a demonstrated low-latency streaming solution. Dialogue hints help recognition but are not an exact alignment guarantee. |
| Montreal Forced Aligner | Word/phone intervals from audio, transcript, dictionary, and an acoustic model; useful for more detailed timing experiments. | More setup; alignment errors still need inspection. Not an automatic live-stream integration. |
| Native synthesis timing | Prefer timestamps from the speech provider when available and reliable. | The inspected local speech response and STS output path do not expose a phoneme/viseme timeline. Do not infer timing from text-token arrival. |
| Audio2Face-3D | A possible later learned audio-to-motion comparison. | Additional inference/deployment machinery and rig retargeting; unnecessary to validate the proposed 2D painter. |

Primary references: [Rhubarb](https://github.com/DanielSWolf/rhubarb-lip-sync),
[MFA alignment workflow](https://montreal-forced-aligner.readthedocs.io/en/latest/user_guide/workflows/alignment.html),
[our speech response adapter](../src/robot_790_tts/server.py),
[Audio2Face-3D architecture](https://docs.nvidia.com/ace/audio2face-3d-microservice/1.0/text/architecture/audio2face-ms.html).
The NVIDIA architecture reference is explicitly version 1.0; current deployment
and stream-control details differ. See its [2.0 migration guide](https://docs.nvidia.com/ace/audio2face-3d-microservice/2.0/text/migrating-from-1.0.html).

Rhubarb's compact inventory provides a useful starting point: rest, lip closure,
small consonant opening, medium and large vowel openings, rounded and puckered
lips, tooth/lip contact, and tongue-up. These are rendering targets, not nine
universal phonemes. Its six basic plus three optional shapes are enough for the
first comparison. [Rhubarb mouth shapes](https://github.com/DanielSWolf/rhubarb-lip-sync#mouth-shapes).

## Proposed Art Direction

These are project-specific design choices to audition, not physiological claims.

- **Keep his identity.** Retain the warm rose lips and dark cavity. Leave the
  eyes, nose, captions, face proportions, and page centering alone.
- **Use one continuous contour.** A rounded mouth should be the same surface
  narrowing and protruding, not a different drawing pasted into place.
- **Separate the moving parts.** Jaw travel, width, rounding, lip seal,
  lower-lip bite, tongue lift, and teeth exposure should be independently
  adjustable. The jaw can stay partly lowered behind a closed lip seal.
- **Anchor the interior.** Teeth belong to the upper jaw; the lower lip moves
  toward them. Tongue motion should read as connected tissue in the cavity,
  not an isolated floating shape. Clip both behind the lip opening.
- **Give volume a coherent material.** Use a continuous lip band with a restrained
  highlight and shadow, rather than a stack of independently moving ellipses.
- **Protect contacts from expression.** A smile can move the corners, but it
  must not reopen M/B/P or turn F/V into a grin. Speech constraints win locally;
  expression returns as the utterance releases.
- **Keep asymmetry low-frequency.** A smirk or phrase accent is useful. Unrelated
  per-frame wobble is not a substitute for audio evidence.

## Motion And Easing

The first lab uses deterministic cubic blend windows around cue boundaries and
an independent lead for lip width/rounding. Every cue keeps an unblended center,
including brief contact cues. This is a deliberately simple, inspectable
animation model; it is not an implementation of a learned coarticulation engine.

Its initial 90 ms transition and 45 ms lip lead are **audition settings**, not
measured optimums. Rhubarb output already contains animation decisions, so
additional smoothing can over-soften it. Always compare with zero transition
and zero lead. The same timeline position produces the same pose when scrubbing,
regardless of the order in which frames were rendered.

For a later live rig, use different responses for different controls: closures
need to arrive and hold; the jaw can have weight; rounding can anticipate;
release to the base expression can be gentler. Avoid spring overshoot on the
lip seal. Do not scale every motion directly with loudness: a quiet consonant
can still require contact. Add a measured output-audio envelope only as a
secondary articulation signal, with zero preserved as zero.

## Live Timing Design

The browser-face state channel currently conveys a latest value, not a
performance timeline. Replacing its 250 ms interval with a faster poll would
still lack audio timestamps, a cue queue, and cancellation ownership.

A future additive speech track should carry an utterance/generation ID, sequence,
timebase, cue offsets and durations, and an explicit end/cancel. Keep the
existing expressive `/mouth` interface available. The face can interpolate its
small queued track locally without a network request for each frame.

Use the **actual scheduled audio start**, including queued buffers, as the
timing anchor. Web Audio defines scheduling against `currentTime` and provides
`getOutputTimestamp()` to relate the output position to a performance timestamp.
Handle unsupported/initial-zero timestamps with an explicit fallback.
[W3C Web Audio timing](https://www.w3.org/TR/webaudio-1.1/#dom-audiocontext-getoutputtimestamp).

Separate pages and devices do not automatically share a clock. Same-machine
browser faces need a translated clock reference; remote devices need estimated
offset/round-trip delay and occasional correction. A relative timestamp sent
over HTTP does not solve synchronization by itself.

Important integration invariants:

1. An interrupted utterance cannot be revived by a late cue packet.
2. Completion follows the audible queue draining, not merely generation ending.
3. A missing/late analysis result cannot block audio indefinitely. Fall back to
   modest measured-energy jaw motion and mark the fallback in diagnostics.
4. Bound cue queues and drop expired entries. Cancel old ownership on reconnect.
5. Do not copy large image/state payloads into a high-frequency mouth channel.
6. Keep canvas sizing out of the frame loop; pause hidden-page work and test
   memory over time before touching the stable face's layout.

The analysis timing remains an open engineering question. Start offline, then
measure whether sentence/chunk analysis can fit already-buffered audio. Any
extra lookahead is an explicit conversational-latency tradeoff. Do not assume
that an aligner accepting a short file makes it a streaming aligner.

## Evaluation Before Integration

Use a short **assistant-only** output recording and its exact spoken text, not
the mixed operator/robot session recording. Keep it local unless deliberately
curated for publication. Suggested newly recorded lines:

- "Maybe Bob will bring my blue mug." Contacts and rounded neighbors.
- "Five very vivid views." Tooth/lip contact.
- "We see two blue moons." Spread-to-round transitions.
- "Little yellow light." Tongue visibility without excessive movement.
- A natural conversational sentence, a quiet aside, laughter, and a mid-sentence
  interruption. Not every sound is well represented by ordinary speech cues.

Compare the current face, new painter with hard cues, and new painter with
articulation on the **same audio**. Inspect full speed, half speed, silent, and
audio-only. Score timing, contact readability, continuity, character, and whether
the mouth attracts unwanted attention. Do not mistake the silent lab study for
evidence of synchronized speech quality.

Test stable framing at large desktop, narrow window, mobile, and actual device
sizes. Measure drawing time and memory through repeated play/stop, source
replacement, hidden tabs, and resizing. Re-run interrupt, B2 caption, manual
expression, face-paint, and reconnect workflows before enabling a new renderer
by default. Preserve the existing renderer as a selectable comparison until the
new one earns that default.

## Delivered In This Pass

- Source audit and primary-source research above.
- Standalone [Mouth Lab](../web/mouth-lab/README.md): continuous painter, silent
  studies, local audio/cue imports, transport, settings export, and bounded work.
- [Focused tests](../tests/mouth_lab.test.cjs) for every pose pair, short contacts,
  seeking, validation, and fixture-based page lifecycle.
- A native Canvas-rendered pose sheet, inspected during development. This is
  renderer verification, not a browser screenshot or an audio-alignment test.

Native Canvas pixel checks at 320, 720, 1000, and 1440 pixels wide confirmed
nonblank, changing frames for the contact study. These checks exercise the
painter at different scales, not browser layout, audio synchronization, or GPU
behavior. The isolated mouth suite plus existing STS/docs suites passed 59 tests.

No production renderer, runtime speech path, firmware, or server was changed.
The lab needs an actual browser interaction check and a listening comparison
with aligned Eric audio. A connected browser was unavailable during this pass.

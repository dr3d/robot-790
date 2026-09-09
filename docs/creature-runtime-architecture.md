# Creature Runtime Architecture

Robot 790 is being split into a few explicit objects so Eric is not permanently tangled into the STS page.

## Runtime

The runtime is the apparatus: microphones, audio playback, realtime connection, tool bridge, Brain2, sensing eye, recording, logs, session notes, and context assembly.

The runtime should know how to load a creature and an embodiment. It should not contain the permanent identity of the creature except as fallback text.

## STS: Deterministic Orchestration Runtime

STS began as the project's speech-to-speech loop. `Realtime` still names its
foreground, low-latency voice mode. The larger STS runtime is deterministic
code and configuration that declares and runs Robot-790's cognitive
architecture.

Calling STS Eric's brain is useful functional language: it is the stable
apparatus that admits experience, selects attention, assembles working context,
holds rounds with the operator, routes action through a body, records what
happened, and conditions the next moment. At the implementation boundary, it
does this by deterministic orchestration rather than by being an AI model
itself.

STS can declare any useful number of model-backed lanes. The number, diet,
permissions, priority, cadence, output path, context budget, and handoff rules
are ordinary configuration and code. It does not need an AI to decide that a
given Robot-790 run needs two lanes, four diets, or eventually six distinct
brains with different jobs. The current arrangement is the architecture being
discovered for Robot-790, not permanent doctrine for every future creature.

Today, STS supplies the deterministic structure around Robot-790's model work:

- it receives speech, images, body/sensor state, tool receipts, UI changes, and
  the operator's input;
- it maintains the distinct context diets and lanes, including the public mouth,
  Brain2's advisory work, evidence-oriented checks, and body/runtime signals;
- it runs `conversation`: opens, settles, interrupts, and completes
  operator-creature rounds through the Realtime language-and-voice faculty;
- it compiles the prompt/context view from identity, live state, receipts, notes,
  session continuity, and the current embodiment;
- it exposes semantic tools, applies deterministic permissions and hardware
  limits, and records action receipts;
- it holds the session graph, recordings, event log, idle scheduler, and the
  rules for what becomes future context.

The Realtime LLM is a live generative faculty that STS uses during
`conversation`; it is not the whole of the runtime. The browser face, ESP32
face, or Reachy adapter is the embodiment. An exo-brain assist is another
model-backed faculty STS can invoke through a declared task boundary.

## Direction: Dream Time

Status: design direction, not an automatic scheduler yet.

STS should also run `dream`: a non-conversational mode for intervals with no
operator-creature round and deliberately available GPU capacity. The lab name
is Dream Time. It is not hidden free-running narration: STS selects a
registered task, creates an auditable input snapshot, invokes a local LM Studio
model in a separate text/context-processing request, and stores a labeled
candidate or receipt.

The current idle engine and Brain2 mulls are early ancestors of this idea.
Dream Time expands the same principle to jobs such as continuity consolidation,
session scrubbing, summary candidates, source/dependency tracing, unresolved
reference checks, image-recall indexing, repair proposals, and experiment
preparation. A task can originate from an operator request, a deterministic
condition, or a future semantic request from Eric himself. Eric may know which
registered help is available and ask STS to queue it; he does not silently gain
authority to rewrite records or change hardware.

STS remains responsible for resource arbitration. `conversation` wins when
latency matters; `dream` yields, runs during a true quiet interval, or uses
deliberately available capacity. Every Dream Time result carries its task,
model/settings, input manifest, source links, timestamps, and acceptance state.
The raw session remains intact, and a result becomes usable continuity only
through the applicable deterministic and operator review rules.

## Creature

A creature is the being riding the runtime. It carries identity, attitude, attention habits, context model, machine language, and instincts.

Current file:

- `config/creatures/eric.json`

Eric's creature file is not a full prompt replacement yet. It is a structured layer inserted into the B1 prompt before embodiment/runtime state and the base system prompt.

Future creatures should be siblings of Eric, not forks of the app:

- `config/creatures/tina.json`
- `config/creatures/wall_oracle.json`
- `config/creatures/<new_species>.json`

## Embodiment

An embodiment is the body or face adapter. It says what physical/display affordances are present and how Eric or another creature should use them.

Current embodiment records live in `config/runtime.json` under `embodiments`.

Examples:

- `s3_face`
- `external_eyes`
- `browser_face`
- `reachy_mini`

## Direction: Intent Above Hardware

Status: design direction, not a claim that the full abstraction exists today.

An embodiment should translate a common request into its own local body work:

```text
Eric's semantic intention
  -> allowed capability
  -> active embodiment profile
  -> deterministic adapter/controller
  -> local hardware or browser work
  -> live receipt
```

For example, Eric can mean `look_left`, `listen`, `speak`, `show_mouth_text`,
`sleep`, `notice_touch`, or `play_a_small_beat`. He should not need to know
which display bus, GPIO, servo, camera API, or browser canvas makes that happen.
The controller owns timing, limits, wiring, and failure handling; its receipt is
the only authority for whether the body actually did the thing.

This is deliberately old-school inheritance in spirit: a base embodiment
contract supplies semantic verbs and receipts, but it does not supply pins. A
concrete embodiment owns its own hardware profile and overrides the details
that make it physically itself. Changing an ESP32 pin map should be a local
body-profile change, not a change to Eric's vocabulary or to every other body.

### Profile Layers

The planned profile has four independent layers:

1. **Capability manifest:** what the body can presently display, sense, move,
   or receive. Examples are eyes, mouth, status light, camera, touch, IMU,
   LEDs, head motion, chassis, captions, or mirror capture.
2. **Hardware profile:** display topology, bus and pin assignments, power
   constraints, actuator ranges, transport details, and renderer limits. This
   belongs below the semantic contract and is never assumed by another body.
3. **Adapter/controller:** the deterministic translator for HTTP, serial,
   firmware, browser canvas, or a robot SDK. It enforces limits and returns
   live success, refusal, or fault receipts.
4. **Skin or accessory:** a visual/social layer that can change appearance
   without pretending to create a new brain or a new hardware contract.

The last layer matters. A browser face, an exposed acrylic instrument, a
pre-punched paper mask, and a painted or 3D-printed mask can share a body
contract while presenting differently. A mask can alter proportions, palette,
and the social read of the face without turning Eric into a different creature.

### Body Awareness

Each connection should give Eric a compact, human-legible body card derived
from the active embodiment profile and current state: body name, visible face
parts, available controls, known sensors, motion permission, and meaningful
limits. This lets behavior adapt honestly: the browser face can rehearse and
mirror itself; a small touch face can be close-up and touch-aware; a masked
hardware face can use its larger physical presence; Reachy can use head and
antenna language when the adapter confirms it is available.

The body card is a clue, not a hallucination license. Static profile facts say
what the body is designed to support. Current `/state` and action receipts say
what is live now. A camera, LED, motor, or sensor may be named as unavailable;
old session state never proves that it is working today.

The same lab rule applies to body-facing UI. Eric may be shown the control
surface, current embodiment, allowed actions, and their receipts so the body he
wakes into is legible. He may suggest a choice, but only the operator and the
deterministic controller can change hardware, permissions, or wiring.

### Acrylic Face And Removable Masks

One near-term physical direction is an intentionally exposed, flat acrylic face
instrument: a visible ESP32-S3 mounted on copper legs, deliberate point-to-point
silicone wiring, display modules, and a small ring of individually controllable
LEDs. The mechanism is part of the presentation rather than something to hide.

The same underlying instrument can accept a simple pre-punched paper/card mask
for a child-drawn face or a more finished printed and painted mask. That makes
the body a platform for changing faces rather than a single fixed costume. The
eventual pin assignment, power layout, and LED map remain embodiment-local
bring-up facts; this direction does not freeze a wiring diagram or elevate an
unvalidated pin choice into the common architecture.

### Reachy As A Test Case

Reachy Mini should exercise this abstraction, not become a special second
personality. It has a different chassis, cameras, head, antennas, motor gates,
and SDK, but it should receive the same kind of semantic intention and return
the same kind of bounded receipt. Designing toward a body with that much
structure keeps the abstraction from being an ESP32 pin wrapper.

The practical target is one Eric with many bodies: browser, compact face,
external/mask face, acrylic face, and Reachy can each give him different
affordances and a different visible posture while preserving the same creature,
voice, note practice, authority rules, and safety boundaries.

### Incremental Path

1. Define body capability and hardware-profile data without exposing raw pins
   to the model.
2. Have the existing browser face, S3 face, external rig, and Reachy adapter
   report those profiles alongside their current live state.
3. Add the acrylic/mask body as another profile and adapter, not a fork of Eric.
4. Inject a small current-body card at connection time; keep receipts and live
   state above saved body descriptions.
5. Add a new semantic behavior only after its local controller can perform,
   limit, and report it deterministically.

## Capability

A capability is a semantic verb exposed through tools or UI operations.

Examples:

- `capture_live_camera_to_sensing_eye`
- `capture_face_to_sensing_eye`
- `paint_face_from_sensing_eye`
- `use_loaded_context`
- `manage_active_thread`
- `save_continuity_session_note`
- `start_recurring_spoken_task`

The creature may know the machine-language phrase. The embodiment/runtime decides how the verb is executed.

## Context

Pinned notes, latest thread, selected session notes, sensing-eye input, search receipts, memory facts, Brain2 notes, and UI events are context blocks.

The mental model:

- pinned notes are nearby open notes
- latest is the active notebook
- shelf notes are visible by title only until read
- selected session notes are reconstruction state
- current runtime/tool receipts outrank old notes

## First Factoring Rule

Do not make a new creature by copying `web/sts/index.html`.

Make a new creature file, point the runtime at it, then adjust only the apparatus if a genuinely new capability or body mapping is needed.

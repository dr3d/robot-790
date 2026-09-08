# Creature Runtime Architecture

Robot 790 is being split into a few explicit objects so Eric is not permanently tangled into the STS page.

## Runtime

The runtime is the apparatus: microphones, audio playback, realtime connection, tool bridge, Brain2, sensing eye, recording, logs, session notes, and context assembly.

The runtime should know how to load a creature and an embodiment. It should not contain the permanent identity of the creature except as fallback text.

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

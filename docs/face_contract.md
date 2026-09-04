# Face Contract

The face is identity-bearing machinery in Robot 790. It is not just decoration:
the eyes, mouth, timing, captions, voice, and renderer limits all help define
which personage appears to be in the room.

The project now keeps the shared face facts in
`config/face/robot-790-face.json`. That file is meant to be readable and
boring. It defines the mouth vocabulary, pose numbers, aliases, mood mappings,
and the first skin inheritance tree for Eric and his embodiments.

Renderers are still native. Browser canvas, ESP32 TFT drawing, external eyes,
and Reachy Mini should each draw in the way their body allows. The contract is
the common language underneath them, not a magical universal painter.

## Intended Shape

- `base` defines common knobs such as lip thickness, mouth width, eye scale,
  and whether mouth text should be a caption.
- `eric` inherits `base` and adds the current green glow, pink mechanical lips,
  and suspicious smirk tendencies.
- `browser_face`, `esp32_s3_face`, `esp32_eyes`, and `reachy_mini` inherit Eric
  unless they need body-specific overrides.

That gives the project an old-school inheritance model without hiding the facts
in code. "Make Eric's lips thicker" should eventually become one data change in
the Eric skin, then generated tables and native renderers do the rest.

## Generated Artifacts

Run this after editing the face spec:

```powershell
python scripts\generate_face_contract.py
```

Check that generated files are current:

```powershell
python scripts\generate_face_contract.py --check
```

The generated files live in `config/face/generated/`. For now they are a
checked-in contract and migration aid. The next step is wiring the browser and
firmware tables to these generated outputs so new faces can inherit vocabulary
and pose intent instead of becoming hand-copied forks.

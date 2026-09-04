# Robot 790 Face Contract

This is the inspectable face contract used to keep browser and hardware embodiments from drifting.
Renderers may draw differently, but they should share names, pose intent, aliases, and mood mappings.

## Mouth Shapes

| Shape | C++ | Aliases | Topology | Pose |
| --- | --- | --- | --- | --- |
| `neutral` | `Neutral` | flat, line | `mouth` | open=0.07, width=0.54, curve=0.02, skew=-0.03, teeth=0, tension=0.16, slant=0.02, upperLift=0 |
| `smile` | `Smile` | happy | `mouth` | open=0.18, width=0.88, curve=0.98, skew=0, teeth=0.08, tension=0.06, slant=0, upperLift=0 |
| `big_smile` | `BigSmile` | big-smile, grin, delighted | `mouth` | open=0.44, width=0.96, curve=1.05, skew=0, teeth=0.3, tension=0.05, slant=0, upperLift=0 |
| `smirk_left` | `SmirkLeft` | left_smirk | `mouth` | open=0.13, width=0.72, curve=0.88, skew=-0.46, teeth=0.02, tension=0.48, slant=-0.36, upperLift=-0.42 |
| `smirk_right` | `SmirkRight` | smirk, right_smirk | `mouth` | open=0.13, width=0.72, curve=0.88, skew=0.46, teeth=0.02, tension=0.48, slant=0.36, upperLift=0.42 |
| `open` | `Open` | talk, speaking | `mouth` | open=0.66, width=0.5, curve=-0.04, skew=-0.04, teeth=0, tension=0.14, slant=-0.05, upperLift=0 |
| `o` | `O` | oh, surprise_o | `o` | open=0.82, width=0.2, curve=-0.08, skew=0, teeth=0, tension=0.02, slant=0, upperLift=0 |
| `wide` | `Wide` | surprised, shout | `mouth` | open=0.94, width=0.7, curve=0.1, skew=0.04, teeth=0.18, tension=0.2, slant=0.06, upperLift=0 |
| `tongue` | `Tongue` | silly | `mouth` | open=0.78, width=0.82, curve=0.84, skew=0.05, teeth=0.04, tension=0.04, slant=0.02, upperLift=0 |
| `frown` | `Frown` | sad | `mouth` | open=0.08, width=0.62, curve=-1.1, skew=-0.04, teeth=0, tension=0.42, slant=-0.08, upperLift=0 |
| `grimace` | `Grimace` | teeth, tense | `mouth` | open=0.24, width=0.84, curve=-0.18, skew=0.03, teeth=1, tension=0.98, slant=0.03, upperLift=0 |
| `sneer` | `Sneer` | sinister | `mouth` | open=0.2, width=0.72, curve=-0.2, skew=0.42, teeth=0.32, tension=0.62, slant=0.34, upperLift=0.52 |
| `sleep` | `Sleep` | blank | `sleep` | open=0.03, width=0.42, curve=-0.12, skew=0, teeth=0, tension=0.08, slant=0, upperLift=0 |

## Skins

- `base`: Neutral face skin inherited by named embodiments.
- `eric` inherits `base`: Current Eric face: green status glow, pink mechanical lips, suspicious smirks.
- `browser_face` inherits `eric`: High resolution browser face with captions and richer drawing affordances.
- `esp32_s3_face` inherits `eric`: ESP32-S3-Touch-LCD-2 portrait face renderer.
- `esp32_eyes` inherits `eric`: External ESP32 eye/mouth lineage at esp32-eyes.local.
- `reachy_mini` inherits `eric`: Future Reachy Mini embodiment; maps the same face intent to a different body.

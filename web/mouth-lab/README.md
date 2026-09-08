# Mouth Lab

An isolated, experimental Canvas2D mouth rig. Open [index.html](index.html)
directly in a browser. No server, STS connection, model, microphone permission,
or hardware is needed. Nothing here changes the production face.

The built-in tracks are **silent, authored movement studies**, not generated
speech or measured phoneme alignment. Both views use the new painter: the left
uses stepped targets; the right adds transitions and anticipatory lip shaping.
This is a motion comparison, not an old-face/new-face comparison.

![Nine mouth shapes rendered by the experimental rig](pose-study.png)

## Workflows

- Play Contacts to inspect short closures and tooth/lip contact.
- Play Rounding to inspect transitions into and out of a pucker.
- All shapes cycles through the inventory. The letter buttons hold individual
  poses; selecting the same button again returns to the timeline.
- Position scrubbing pauses playback. Speed changes also affect imported audio.
- Transition adjusts the blend window. Lip lead anticipates width and rounding
  without moving the closure clock. Jaw travel and Form controls affect both
  views. Reset restores the six rig settings, not the imported source.
- Settings downloads the current settings as JSON. Preset re-import is not yet
  implemented; these files are review artifacts, not live face configurations.

## Recorded Speech

Use [Rhubarb Lip Sync](https://github.com/DanielSWolf/rhubarb-lip-sync) to produce
timed A-H/X cues from a short WAV and an optional matching dialogue file:

```powershell
rhubarb -f json -d line.txt -o line.cues.json line.wav
```

Import Audio and Cues in either order. Analysis is external; this page does not
transcribe or align audio. It reads selected files locally and uploads nothing.
Playback uses the media element's audio position, not accumulated animation
frames. Equal duration is a sanity check, not proof that the right audio and
cue files were paired.

Limits: 120 seconds, 32 MB audio, 2 MB cue JSON, 10,000 input cues. Malformed,
unordered, overlapping, or unknown cues are rejected. Gaps become rest. Dense
tracks use a compact timeline display. Changing study releases imported audio.
Hiding or leaving the page pauses playback. Object URLs are revoked on replacement
and exit. The canvas has fixed backing dimensions, CSS-only scaling, and no
resize handler; the animation loop runs only during playback.

## Implementation And Checks

- `rig.js`: validated Rhubarb input, deterministic timeline sampling, authored
  pose targets, and a single continuous painter. No phoneme recognizer.
- `lab.js`: local imports, transport, comparison, controls, and cleanup.
- `lab.css`: responsive tool layout; independent of STS and Browser Face CSS.
- `icons/`: six unmodified icons from Lucide 0.468.0, with upstream LICENSE.
- `pose-study.png`: generated from this painter, not a browser screenshot.

```powershell
node --test tests/mouth_lab.test.cjs
```

The suite checks cue validation, frame-independent seeking, all pose pairs,
short closures, browser-script boot, and playback lifecycle in isolated fixtures.
It does not substitute for listening to aligned speech or testing the actual UI
in a browser. See the [research and integration plan](../../docs/mouth-animation-research.md).

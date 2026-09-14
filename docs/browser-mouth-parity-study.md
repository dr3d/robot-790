# Browser Face Mouth: Hardware Parity Study

September 13, 2026. Investigation only; production renderer and hardware unchanged.
Operator is using OBS screen capture rather than STS audio recording for now.
The face is therefore part of the performance, not just a status display.

## Findings

The two-inch S3 renderer (`firmware/esp32-s3-face/src/main.cpp`) and Browser Face
(`web/face-sim/index.html`) already use the same thirteen named human-mouth poses
and their eight numeric pose parameters. There is no missing hardware pose pack
to import. Differences are in geometry, scale, coloring, transition handling,
and how speech animation overrides the base expression.

[Current browser pose sheet](../logs/browser-mouth-study.png) was rendered from
the actual served browser drawing functions in a separate headless browser.
It does not mutate the live face state. This is a settled-pose comparison at one
animation time, not a hardware screenshot or speech-synchronization test.

Visible issues in this baseline:

- Smile and frown retain very similar broad, flat lip silhouettes; the frown
  relies heavily on small corner marks rather than a convincingly downturned mouth.
- Open, tongue, and broad smiles leave corner disks visually separated from
  the main lips. This can read as disconnected pieces at OBS capture sizes.
- Smirks and sneer use a different, much smaller drawn form. Switching to them
  changes the mouth's visual mass sharply, not just its expression.

The S3 smirk/sneer uses layered ellipses and scaled offsets; Browser Face uses
custom Bezier paths. Browser width is scaled by 1.92 while several offsets and
the smirk rig height remain fixed constants. This helps explain different
proportions; it does not establish that every firmware shape will look better
on a larger display. Physical display/firmware version was not checked live.

Browser pose easing resets immediately when the mouth topology changes to/from
`o` or `sleep`. Firmware interpolates its pose parameters across shape changes
and delays the special sleeping line until the transition ends. Both still
have special-case drawing paths, so borrowing numeric interpolation alone is
not a guarantee of smooth contours.

Speech is a separate issue: Browser Face consumes six speech shape labels and
blends them with the base expression. Its closed speech pose is not a true lip
seal. Existing [mouth research](mouth-animation-research.md) already documents
that and the isolated Mouth Lab. This investigation does not expand into a
new lip-sync engine or deploy the lab renderer.

## Recommended First Pass

1. Identify the operator's troublesome shapes, then compare those explicitly.
2. Improve the connected lip/corner geometry and smile/frown distinction while
   preserving the recognizable Browser Face palette and overall face layout.
3. Borrow the S3's scale-aware expression proportions and transition behavior
   where appropriate, with side-by-side before/after images before broad rollout.
4. Check resting poses, speech overrides, and returns from speech to a held
   expression at both the compact OBS face size and a larger viewport.

Keep emotional expression distinct from a timed performance. Do not add model
prompt instructions, auto-record changes, or hardware flashing for this work.

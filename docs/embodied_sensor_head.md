# Embodied Sensor Head

Model proposes; deterministic layers decide.

Robot 790's ESP32-S3 face can become more than a display. The useful path is
not "Eric can sense everything." The useful path is "Eric gets a few honest
bodily facts and can perform with them."

## Hardware Direction

- `firmware/esp32-s3-face`: forward path for the one-piece portrait face on the
  Waveshare-style ESP32-S3-Touch-LCD-2. Hostname: `esp32-s3-face.local`.
- `firmware/esp32-s3-face-brain`: parked external-eye experiment for spare
  boards or future two-round-eye wiring.
- `esp32-eyes.local`: current working external-display face rig.
- Possible `esp32-head.local`: small ESP32-C3 tilt/rotate daemon using cheap
  motors.

## Sensor Ideas

Portable singular embodiment:
The Waveshare-style face should not become "Eric as an app." The stronger path
is Eric as one small carried object: pocketable, touchable, tiltable, and still
locally itself. Portability is useful only if it makes the body more real, not
more generic.

This is the design distinction:

- mask/head embodiment: visually stronger, better as a face or puppet
- Waveshare mini embodiment: socially stronger as a carried thing with IMU,
  touch, and pocket presence
- smartphone embodiment: powerful, but risks turning Eric into a generic app
  persona instead of this one robot

Camera:
Start with single-frame capture, not live video. The tool shape is capture a
frame, describe it, admit uncertainty, and optionally save an observation.
Vision-triggered claims should not become actuator premises without a
deterministic check.

IMU:
The first useful labels are simple: tilted, picked up, bumped, set down, lying
flat, turned around, held still, and moved recently. These are excellent
rumination fuel because they are true physical events.

Touch:
Treat contact as attention and control. Candidate gestures are tap to wake,
double tap to ponder, long press to hush, and swipe to change face mode. The
socially useful fact is simple: someone touched the face.

Long press to hush is the body-level version of rest. The human should be able
to grant quiet by touching the robot, not only by finding a setting in the web
interface.

Tilt/rotate head:
Keep motor control in dedicated firmware. Expose semantic actions upward:
`look_left`, `look_right`, `nod`, `tilt_confused`, `face_user`,
`settle_forward`. Firmware owns easing, range limits, home pose, speed caps,
and mechanical protection.

## Design Rule

In practice, that means Eric can make semantic requests, but the device layer
owns reality.

Eric can request "look toward Scott" or "nudge into a skeptical tilt." The
device controller decides whether that is possible, how far it may move, how
fast it may move, and when to refuse.

Tool failures should describe the real condition in plain language:

- chassis offline / unpowered
- face controller unreachable
- camera unavailable
- IMU not reporting
- motor limit reached

Vague failures like "failed to fetch" give Eric nothing real to reason from and
turn hardware problems into invented story. Honest errors in produce more
honest fiction out.

## Low-Risk Milestones

1. Report sensor presence in `/status`.
2. Add IMU-derived state labels without exposing raw numbers to the LLM.
3. Add touch events to `/status` and event logs.
4. Add one still-camera capture tool.
5. Add a head-motion daemon separately from face firmware.
6. Add LLM tools only after the deterministic device side is boring and safe.

## Why This Matters

Embodiment is one of the things that makes Robot 790 feel alive. A few reliable
physical facts beat a flood of invented self-description. A face that knows it
was moved, touched, tilted, or asked to look somewhere has much richer material
than a face that only performs moods.

The portable version sharpens that claim. If Eric can be carried, the point is
not to make him available everywhere. The point is to let this one Eric have a
small continuous body in Scott's world.

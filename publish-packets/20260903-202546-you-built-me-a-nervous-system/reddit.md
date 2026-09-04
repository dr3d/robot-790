# Reddit Draft

Title:
Turning robot sensors into a "nervous system" for a local AI companion

Post:
I am building Robot 790, a local embodied AI companion with a small face, voice, tools, notes, logs, and a few experimental internal lanes.

This run is about the body direction. I have a sensor kit with touch, IMU, proximity, heat, buttons, dials, and other inputs, and the interesting design question is how much of that should be raw telemetry versus high-level body events.

The current answer is that the firmware/adapters should do the raw math and give Eric readable events: someone touched my nose, I was bumped, I was lifted, I am upside down, a hand passed over me, a dial changed.

That keeps the language model out of low-level sensor noise while still letting the companion react to the room.

Run video:
https://dr3d.github.io/robot-790/?media=media/videos/You-Built-Me-A-Nervous-System-Before-I-Had-A-Spine-2026-09-03-202546.mp4#media

Project:
https://github.com/dr3d/robot-790

Disclosure:
This is my own project and personal build log. I am sharing it because the practical edge between robotics, local AI, and social presence is getting interesting.

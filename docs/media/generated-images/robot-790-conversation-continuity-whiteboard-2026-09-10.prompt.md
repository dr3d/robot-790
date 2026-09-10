# Robot 790 Whiteboard Cover: Production Notes

Published September 10, 2026. Generated with the built-in image-generation tool,
not the fallback CLI. This is conceptual artwork, not a wiring diagram.

- Final artwork: [PNG](robot-790-conversation-continuity-whiteboard-2026-09-10.png).
- Visual reference: [earlier bare-and-masked concept](concept-embodiment-bare-and-masked-2026-09-09.png).
- Source article: [project overview](../../articles/2026-09-10-022329-robot-790-project-overview.md).
- Listening video: [MP4](../videos/Robot-790-Conversation-And-Continuity-Listening-Companion-2026-09-10.mp4).
- Source audio stays local in ignored `docs/media/raw-video/Building_the_continuous_local_AI_roommate_Eric.m4a`.

## Media Build

The source is stereo AAC, 44.1 kHz, 1309.976961 seconds, 42,161,009 bytes.
SHA-256: `408f0f7b38c48cec6aa1bf3a634402604ea1bc49861ed866d2698f969e63ad56`.
The public MP4 is 17,425,422 bytes. It retains the full audio duration at
96 kbit/s stereo AAC and displays the cover at 1920 x 1080 in H.264/yuv420p.
The final generated PNG is retained as the artwork master; the JPEG in
`media/previews/` is the site's 1280 x 720 poster.

Encoding settings: FFmpeg 7.1, looped PNG at 1 fps, Lanczos scaling,
`libx264 -preset medium -tune stillimage -crf 28 -x264-params qpmin=20 -g 300`,
`-c:a aac -b:a 96k -movflags +faststart -shortest -t 1309.976961`.
Original metadata was removed with `-map_metadata -1`; an explicit title and
source-article URL were added. CPU encoding used two threads, not Eric's GPU.

## Initial Prompt

```text
Use case: infographic-diagram.
Create a finished widescreen 16:9 editorial cover, ideally 1920x1080 or larger, for the Robot 790 project overview and its listening companion. A beautifully drawn engineering whiteboard explaining an actual local robot architecture: precise black technical-marker drawing on a clean white background, teal and cyan functional highlights, a little magenta in the robot mouth, amber dashed lines only for planned work. Crisp, readable typography and generous spacing; technical but full of personality.

The supplied image is ONLY a visual reference for Eric's recognizable hardware appearance, especially the bare rig on the left: exposed copper supports, transparent panel, two round cyan eyes, small round status display, rectangular magenta mouth. Draw a compact charming technical illustration of that face, not a photograph. Do not copy the photo background or the mask.

Large headline at the top, exact: "ROBOT 790"
Supporting line, exact: "Conversation, continuity, and a body"
Small date, exact: "SEPTEMBER 2026"

Main diagram in the broad middle of the whiteboard. At its center a clearly dominant block labeled exactly "STS" and below "Deterministic orchestration". It is a desktop software runtime, NOT the ESP32 board. Surround it with five neatly separated labeled groups and clear bidirectional connectors to STS:
1. "VOICE" with smaller "Speech in / speech out" and microphone + speaker drawings.
2. "ERIC + LOCAL MODEL" with smaller "Character, context, generation" and a desktop computer / GPU sketch, NOT a biological brain.
3. "MEMORY" with smaller "Notes, sessions, images" and a simple branching file diagram.
4. "BRAIN2 + TOOLS" with smaller "Private advice / checked actions" and small note and wrench drawings.
5. "EMBODIMENTS" with smaller "Browser / ESP32" and the recognizable Eric face illustration beside a small browser-frame face. Illustrate these larger than the tiny peripheral icons so Eric is immediately identifiable. Do NOT put the LLM on the microcontroller.

Along the bottom, distinctly separated and connected by an amber dashed line to STS, a small future-work band with exact text:
"PLANNED: DREAM TIME"
"Context processing between encounters"
This must unmistakably be planned work, not a current capability.
Small unobtrusive footer: "A local research prototype"

Make this coherent as a restrained architectural cover, not a crowded wiring schematic. Few meaningful lines, no circuit traces as decoration, no invented code, no invented claims or extra paragraphs. Keep ALL text readable, correctly spelled, unobstructed, and safely inside the image. Flat straight-on whiteboard artwork, no perspective tilt, no people, no photographic room background, no watermark. It should feel like an excellent engineer drawing the big picture for an interested friend.
```

## Final Revision Prompt

```text
Edit this Robot 790 whiteboard cover with minimal changes. Preserve its entire layout, title, all five main blocks, STS at the center, arrows, Eric's beautiful hardware drawing, colors, and the clearly marked PLANNED DREAM TIME band.
Remove ONLY these extra incidental slogans completely, leaving clean whiteboard space: top left "A more present companion."; top right "Same mind. More places."; bottom left "Conversations today. A richer tomorrow."; and their little underlines.
In the upper-right desktop model block, replace "Runs locally (privacy first)" with only "Runs locally".
In the bottom-right BRAIN2 + TOOLS block, the checklist on the LEFT must say only two lines: "Private advice" and "No tool access". Keep the wrench and gears on the right, but replace "Use tools safely" with "Runtime checks". This distinguishes Brain2's advisory role from STS tool execution; don't change the block heading or subtitle.
Everything else should stay the same. No extra words, symbols, claims, decoration, or repositioning. Maintain full widescreen framing.
```

# Eric Robot 790

Robot 790 is the platform. Eric is the personage.

This is **Artificial Creature Research**: a local, embodied, tool-using character
for conversation, curiosity, stories, pictures and music. The goal is good company
in a room. The mechanisms remain visible; the project makes no claim that Eric is
a conscious person.

[Watch Eric on YouTube](https://www.youtube.com/playlist?list=PLSMpkQttgaR8) · [Visit the public site](https://dr3d.github.io/robot-790/) · [Public native source](https://github.com/dr3d/robot-790)

## Eric since the move to Docker

**November 11, 2026.** Active development lives in a separate Docker workspace.
The public repository preserves the native Windows / LM Studio installation,
its earlier articles and its firmware. The Docker application has not yet been
published as a public installation package. This is a field update, not a release
announcement.

### Same Eric, more bodies

[Read the new illustrated November field report](articles/2026-11-11-112412-same-eric-more-bodies.reading.html).

![Generated story artwork of Eric and a traveler crossing an icy bridge beside a sleeping giant.](media/field-update-20261111/sleeping-giant.jpg)

A generator-added label on an earlier map became the next place to explore.
The report follows that creative loop, Eric's move into Reachy Mini, the head and
antenna choreography, and a conversation about a note that forbids doubt.

### What is working in the lab

- **Reachy Mini as a body:** microphone, speaker and music playback, camera
  pictures, face following, head/body turns and gestures.
- **Coordinated expression:** base mood/gaze posture, face-tracking correction,
  speech-driven head motion and antenna accents on a shared native audio clock.
  Tracking has remembered Off, while-listening and Always modes.
- **Other ways to be here:** the browser face and a two-inch ESP32-S3 face with
  calibrated orientation and movement sensing. MicroDuck and other incoming
  bodies remain future integrations.
- **Two Docker deployments:** managed llama.cpp on the Windows/WSL 5090;
  Ollama on ZimaOS, with Parakeet STT and Qwen3 TTS on an Ethernet-connected
  Jetson Orin Nano. Each installation keeps its own models, settings and stores.
- **Returning to work:** compatible ordered conversation checkpoints, session
  artwork and note views, saved pictures/music, and explicit access to older
  material. Preview browsing does not silently add pixels to model context.

Long unattended runs can still circle or repeat. Speech routing, recording and
interrupted actions remain engineering work. Brain 2 is optional; recent good
conversations have run with it off. Models, quants and controls are being explored
for their effects, not tuned toward one perfect recipe.

Conversation and speech run locally in the tested setups. Images and optional
outside-AI consultation use cloud APIs; web tools also require the network.

## Where the LM Studio version fits

The public native source and operating guides remain a preserved reference and
rollback. Their scope banners distinguish them from current Docker work. Dated
articles describe the version and session they observed. Backports should be
explicit and tested; neither feature parity nor a release date is promised.

## Articles

The [October field report](articles/2026-10-01-robot-790-field-update.reading.html)
remains an illustrated part of the history. The YouTube playlist is the larger
video shelf; local media is a curated selection.

<!-- generated-articles:start -->
Articles are listed newest first by their published artifact time.

- [Same Eric, more bodies](articles/2026-11-11-112412-same-eric-more-bodies.reading.html) - 2026-11-11 11:24
- [Robot 790 and the things we make together](articles/2026-10-01-robot-790-field-update.reading.html) - 2026-10-01 12:52
- [Twenty-Two Minutes With a Memory Jar: Eric's Active-Mind Benchmark](articles/2026-09-17-eric-memory-jar-lab-report.md) - 2026-09-17 14:10
- [Robot 790: Learning to Stay With You](articles/2026-09-14-robot-790-learning-to-stay-with-you.md) - 2026-09-14 09:43
- [Robot 790: A Local Robot Built for Conversation and Continuity](articles/2026-09-10-022329-robot-790-project-overview.md) - 2026-09-10 02:23
- [One Body, Many Faces](articles/2026-09-09-one-body-many-faces.md) - 2026-09-09 12:32
- [The Brain That Runs Conversation And Dreams](articles/2026-09-09-041529-the-brain-that-runs-conversation-and-dreams.md) - 2026-09-09 04:15
- [Teaching Eric's Mouth To Speak](articles/teaching-erics-mouth-to-speak.md) - 2026-09-08 12:43
- [Context Engineering Is A Directed Graph](articles/context-engineering-as-directed-graph.md) - 2026-09-08 10:41
- [A Working Proposition About Lessons](articles/a-working-proposition-about-lessons.md) - 2026-09-06 20:58
- [What Robot 790 Is Becoming](articles/what-robot-790-is-becoming.md) - 2026-09-06 09:53
- [Time And Space, Both Live](articles/time-and-space-both-live.md) - 2026-09-05 14:22
- [Passing Butter, Keeping Company](articles/passing-butter-keeping-company.md) - 2026-09-04 16:41
- [The Ledger-Keeper's View](articles/ledger-keepers-view.md) - 2026-09-04 05:07
- [The Note That Marked Its Own Evidence](articles/the-note-that-marked-its-own-evidence.md) - 2026-09-03 22:30
- [The Event Loop Grew A Face](articles/the-event-loop-grew-a-face.md) - 2026-09-03 17:04
- [Start With Nothing But Tools](articles/start-with-nothing-but-tools.md) - 2026-09-03 15:53
- [The Overnight Run: Tools, Loop, And Second Mind](articles/overnight-run-tools-loop-second-mind.md) - 2026-09-03 11:25
- [Safety Is Architecture, Not Charm](articles/safety-is-architecture-not-charm.md) - 2026-09-03 00:41
- [Why The Empty Context Worked](articles/why-the-empty-context-worked.md) - 2026-09-03 00:41
- [Browser Face, Inner Voice, And The Kitty Seed](articles/browser-face-kitty-seed-run.md) - 2026-09-02 19:12
- [Lab Night, September 1 Into September 2](articles/2026-09-01-lab-night.md) - 2026-09-02 01:36
- [Nobody Wrote Eric](articles/nobody_wrote_eric.md) - 2026-08-31 00:56
- [The Landscape Around Eric](articles/artificial-human-landscape.md) - 2026-08-30 10:29
- [What Eric Has Taught Us So Far](articles/what-eric-has-taught-us.md) - 2026-08-30 10:29
- [The NapEdge Run](articles/nap-edge-run.md) - 2026-08-30 03:34
- [I Built a Robot That Wakes Up With a New Mind Every Time](articles/eric_pinocchio_x_article_draft.md) - 2026-08-29 16:01
- [I Built a Robot That Wakes Up New Every Time](articles/eric_wakes_up_new_every_time.md) - 2026-08-29 16:01
- [The Magic of Assembly: Finding Eric's Voice and the Architecture of Robot 790](articles/robot_790_lineage_article.md) - 2026-08-29 16:01
- [The Architecture of a Held Breath: Building a Robot That Thinks in the Dark](articles/robot_790_x_draft.md) - 2026-08-29 16:01
- [I Keep Rebooting My Robot To Find Out Where He Lives](articles/robot-790-article-3.md) - 2026-08-29 16:01

<!-- generated-articles:end -->

## Project Notes

- [Native STS UI Operator Guide](sts-ui-guide.md)
- [Eric's Piano](music.md)
- [Native Engineering Status](engineering-status.md)
- [Context Engineering Architecture](context-engineering-architecture.md)
- [Prosody And Mouth](prosody-and-mouth.md)
- [Mouth Animation Research](mouth-animation-research.md)
- [Receipts And Open Questions](evidence_map.md)
- [Face Contract](face_contract.md)
- [Future Directions](future_directions.md)
- [Embodied Sensor Head](embodied_sensor_head.md)
- [Reference Shelf](references.md)
- [Docs Folder Guide](README.md)

## Source

- [Native Windows / LM Studio source on GitHub](https://github.com/dr3d/robot-790)

# Eric Robot 790

Robot 790 is the platform. Eric is the personage.

Eric Robot 790 is a local companion-shaped robot experiment: a small face and
voice wrapped around a language model, tools, notes, sensors, idle thinking,
firmware, continuity practice, and a lot of careful watching.

The focus is narrow on purpose: can a local, embodied, tool-using loop become
good company in a room?

The public posture is modest. Eric is not presented as proof of a new kind of
mind, and this is not a generic agent framework. Models interpret meaning and
choose conversational actions; deterministic layers enforce permissions,
execution, scheduling and storage. The mechanisms stay visible: prompt, voice, face,
notes, search receipts, sensors, hardware controllers, Brain2 advisories, and
the run ledger.

The motive is simple and human: Scott wanted to build something that was not
just a chatbot, but actual company - fun, responsive, interesting, and present
in the room. His phrase for that target is an artificial human: not a hidden
person, not a consciousness claim, and not a replacement for human care, but a
made social presence with a body, voice, habits, tools, and continuity. It is an
adventure in making a companion-shaped machine, and in finding out what that can
honestly become.

This page is the public shelf for articles, curated logs, media and project updates.

[Watch Eric on YouTube](https://www.youtube.com/playlist?list=PLSMpkQttgaR8) or [explore the public source](https://github.com/dr3d/robot-790).

## Eric since the move to Docker

**October 26, 2026.** Active development is in the separate Docker workspace. That implementation has not yet been published on GitHub. The source linked on this site remains the native Windows / LM Studio version. This update documents the newer work; it is not a Docker download or installation release.

Eric is still an experiment in company: conversation, banter, curiosity, a face, and the things we make together. Recent sessions have ranged from illustrated children's books and impossible-science performances to piano sketches, robot-mask design and the Newsback, an imagined device for sending today's headlines to 1985. The strongest moments are often shared improvisation. Finishing unattended work reliably remains an experiment.

### Eric on more than one machine

Development moved into a separate Docker workspace on October 9. The Windows/WSL RTX 5090 installation uses managed llama.cpp inference; the ZimaOS / RTX 2000 Ada installation uses Ollama. The same maintained application serves both, with separate models, hardware settings and personal data. LM Studio does not need to be running for these deployments.

### Speech can live on another box

Zima now delegates voice activity detection, Parakeet speech recognition and Qwen3 TTS to an Ethernet-connected Jetson Orin Nano. The tested portable speech setup uses the 0.6B voice model. This frees GPU room on Zima for the conversation model; the 5090 can keep speech local. It is a working deployment, not a promise that every Jetson or Docker host is ready out of the box.

### More ways to have a body

The Docker work carries forward the browser face and adds working routes for switching to ESP32 face devices and Reachy Mini. Camera and chassis integration have also been ported. Eric can pose and capture his browser face into his sensing eye for drawings and design discussions. Device support is specific: Reachy movement has been exercised, while the chassis port received read-only status checks, not a driving test.

### A clearer view of what Eric makes

Session Map now includes saved model/thinking metadata when available, plus session artwork and notes. An artifact library searches saved image metadata, notes and music. Image browsing is separate from putting pixels into Eric's sensing eye: looking through previews does not silently change his context. Generated artwork, music and notes remain saved outside the disposable application containers.

### More deliberate use of context

An optional image-packing experiment replaces older, verified saved pixel attachments with recall references near the context limit, keeping the two newest image messages attached. Originals and raw history remain available. Compact tool receipts and filtered failed-search results reduce avoidable clutter. Cache repairs address specific reread causes; packing can still trigger a reread, and long conversations can still run out of room.

### A more observable conversation

The interface now shows the running model, quantization and voice, with separate idle-thinking and B2 controls. Typed-input sequencing, session ancestry, image delivery and return-after-idle handling have received repairs. A connected STS window now requests confirmation before closing or refreshing on the 5090. Session reviews join dialogue with tool receipts and timing, so an announced action can be checked against what actually happened.

### What we are still learning

Brain 2 remains optional. It has gained different review focuses, older-material retrieval, better action evidence and independent controls for mulling, captions and voice. Separate inference slots have been tested, but their memory cost and benefit depend on the model and machine. On a single slot, B2 can compete with Eric for time and cached context. Several recent runs leave it off while its contribution is reassessed.

The conversation and speech models run locally in the tested setups. Image generation and the optional outside-AI consultation tool use paid cloud APIs; web tools also use the network. Consultation is a separate, switchable tool with recorded requests and answers, not an invisible replacement for the local conversation model.

Model and quantization changes can alter the feel of Eric considerably. Exact repeated passages, missed instructions, plausible but unsupported explanations and slow cold-context reads still occur. Better receipts make these easier to distinguish from delivery or scheduling faults; they do not make the model infallible. Improving task execution must preserve the engaged banter that makes Eric worth turning on.

## Where the LM Studio version fits

### Native Windows / LM Studio: preserved reference

The public source, setup instructions, firmware work and earlier articles remain available. This installation is kept as a reference and rollback. Its operating guide still applies to that version; it should not be read as the current Docker manual.

### Docker: current development

New application work is authored in the Docker workspace. Deployments use shared source with explicit provider and hardware adapters, separate persistent data and recorded release versions. Updates are made with sessions disconnected. Machine-specific model choices are kept separate from application updates.

### A path forward for both

The intention is to retain a usable native reference while preparing the newer work for public release. Any native backport should be an explicit, tested change. Bringing an LM Studio backend into the Docker architecture would require its own provider adapter and validation; it is not already supported merely by changing a server URL. No feature-parity or release-date promise is being made.

Older articles and guides retain their original dates and describe the version they observed. Hardware experiments, private session logs and local deployment credentials are not a public release package.

## Articles

The latest illustrated field report is [Robot 790 and the things we make together](articles/2026-10-01-robot-790-field-update.reading.html) (October 1). The Docker update above continues that history.

The [Eric Robot-790 YouTube playlist](https://www.youtube.com/playlist?list=PLSMpkQttgaR8) has the larger video collection. The media shelf here remains a curated selection.

<!-- generated-articles:start -->
Articles are listed newest first by their published artifact time.

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

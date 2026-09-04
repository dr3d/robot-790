# Robot 790 Prompt Sources

This folder holds the small amount of editable prompt material that shapes
Eric's realtime runtime.

The goal is focus, not a prompt marketplace. These files exist so the project
can see and revise the words that shape Eric without hiding them inside UI code.

## Base Realtime Seed

`robot-790-realtime-system.md` is loaded by the STS page server through
`/api/runtime-config` and injected into the Realtime session on connect and
session updates.

This is the right place to tune Eric's base posture, speech style, honesty
rules, anti-parroting rules, and tool-use discipline.

The browser page keeps a fallback copy in code so the UI can still start if this
file is missing, but this file is the working source.

## Boot Briefs

`notes/boot_eric.txt` is a private local boot brief. Eric can read it with the
`read_text_file` tool during a run, and Scott can edit or discuss it directly.

Use boot briefs for session orientation, current project direction, embodiment
notes, and A/B trials. Keep them focused on what Eric is becoming in this lab,
not on turning the system into a general template for other projects.

## Other Context Layers

Eric's full live context is assembled from several sources:

- the base realtime seed in this folder
- runtime embodiment/config values in `config/runtime.json`
- enabled tool schemas in the STS page and Python tool adapters
- browser memory facts saved in localStorage
- notes manually loaded during the current browser session
- temporary sensing-eye image or text context
- current runtime state such as mic, recording, camera, Cast, and tool toggles
- private Brain2 notes surfaced into Brain1 when the runtime allows it
- recent conversation and idle/mull history

Use the STS Context Map to inspect the assembled session context before a run.
That map is for understanding Eric, not for making every layer a public control
surface.

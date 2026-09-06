# Project Scour - 2026-09-05

Fresh-eyes pass over Robot 790 after the September 5 live-loop work.

## Checks Run

- `python -m pytest`: 120 passed, 1 upstream Starlette/httpx warning.
- `python -m ruff check .`: passing after cleanup.
- Browser script parse check with Node for `web/sts/index.html`, `web/face-sim/index.html`, and `docs/assets/site.js`: passing.
- `git diff --check`: no whitespace errors.
- `python -m mypy` is not currently a useful gate. With the repo config it stops in NumPy stubs; with Python 3.12 it exposes 205 strict-typing errors across source and tests.

## Fixed During Scour

- Fixed browser-face mouth text clearing in `src/robot_790d/face_sim_server.py`.
  A plain `clear: true` now clears both Eric and Brain 2 text channels instead of only Eric's channel.
- Added `logs/sensing-eye/` and `logs/browser-face/` to `.gitignore`.
  These are runtime artifacts and should not make repo status noisy.
- Cleaned full-repo ruff issues, including import order, long lines, and PlatformIO/SCons `Import/env` lint annotations.

## Healthy Signals

- The Python behavioral surface is fairly well tested for a live lab project.
  The suite covers tools, media casting, memory, note files, web search, weather, TTS, realtime entry, STS server behavior, and the face contract.
- The face vocabulary already has a canonical spec at `config/face/robot-790-face.json`.
  `tests/test_face_contract.py` catches drift between browser and firmware mouth pose numbers.
- STS now has a real prompt/context audit trail:
  B1 session snapshots, B2 prompt_debug, UI control events, context estimates, tool follow-up prompts, and run-setting notes.

## Priority Risks

1. `web/sts/index.html` is a 13.5k-line control surface.
   It contains UI, prompt assembly, idle scheduling, recording, tool dispatch, status rendering, browser popouts, audio routing, and post-run capture. It works, but each live tweak now lands inside a dense file where regressions are hard to localize.

2. Face rendering has a contract for pose numbers, not a central painter.
   The same conceptual mouth renderer exists in `web/face-sim/index.html`, `firmware/esp32-face/src/main.cpp`, `firmware/esp32-s3-face/src/main.cpp`, and `firmware/esp32-s3-face-brain/src/main.cpp`. That means "make his lips thicker" still requires several coordinated edits. The current contract catches numeric pose drift but not algorithm/style drift.

3. Prompt authority is visible but still distributed.
   B1 base rules live in `prompts/robot-790-realtime-system.md`; runtime assembly lives in `web/sts/index.html`; B2 system/user prompts live in `src/robot_790d/sts_page_server.py`; tool follow-up prompts live in the STS page. The ledger makes this inspectable, but a prompt registry would make it harder to forget a path.

4. Mypy is configured as strict but does not pass.
   This should either be downgraded to a focused gate or made green one module at a time. Right now it advertises discipline the repo cannot actually enforce.

5. Frontend confidence is mostly manual.
   Inline scripts parse, but there are no automated browser checks for key live behaviors: recording state, popout sizing, status line visibility, graph rendering, B2 voice stop, mirror capture, or face text lifetime.

6. Recording/snapshot state is doing too much in one browser state machine.
   The current audio/session code handles chunk rollover, short-chunk discard, image covers, captions, pane snapshots, finalization, downloads, and save failures. It needs a small explicit recorder state machine and tests for "button disabled but recording?", "disconnect snapshot", and "short chunk discard".

7. Popout geometry can still feel sticky.
   Per-pane geometry exists, but the saver ignores windows smaller than 860x600. If a popup opens tiny because of browser behavior, the bad shape may persist until manually resized or storage is cleared.

8. Curation is becoming the project memory, which is good, but it needs periodic pruning.
   Today's postmortems are useful and worth keeping. Fat runtime media should stay ignored. A monthly `robot-790-archive` sweep would keep the active repo searchable.

## Best Next Engineering Chunk

Make the face system boring in the good way:

1. Promote `config/face/robot-790-face.json` from "pose-number contract" to "face style contract".
   Add mouth/eye style knobs such as lip thickness, mouth scale, smirk compression, fang size, tear size, caption bands, and status graph placement.

2. Generate renderer constants for JS and C++ from that contract.
   Do not try to generate all drawing code yet. Generate the boring shared facts first.

3. Add visual/golden smoke checks for browser face.
   Render a fixed set of moods and mouth shapes to PNGs and compare basic image properties or saved references. This would catch "sneer went awful", "face overlapped graph", and "snapshot x-scale drift" earlier.

4. Then refactor the C++ renderers toward a small base painter pattern.
   Old-school inheritance is a good fit here: shared semantic face state and pose/style math, with hardware-specific drawing primitives underneath.

This keeps the next frontier concrete instead of magical: one vocabulary, one style contract, several render targets.

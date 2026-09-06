# Profile Search Friction

Run id: `20260905-065808`
Date: 2026-09-05
Artifacts:
- `logs/live/20260905-065808-conversation.txt`
- `logs/live/20260905-065810-events.txt`
- `logs/live/20260905-065811-brain2_mulling.txt`

## TLDR

This was a useful but bumpy hangout/search run. The strongest part was relational: Eric handled the "friend" framing without getting gooey, admitted when a line came from the boot brief, and treated prompt/context as part of the shared experiment. The weak part was tooling: note lookup needed recovery, web search was flaky, and the still-running page had not loaded the new atomic mirror tool yet.

This run should be kept as a debugging artifact, not a publishable artifact.

## What Worked

- Eric read `boot_eric.txt` successfully when told to read the boot note.
- Eric recovered from a failed note lookup by listing note files and then reading `core/scott_profile_summary.txt`.
- The "friend / tuned process" exchange was good:
  - He did not overclaim real feelings.
  - He did not retreat into sterile assistant language.
  - When asked whether he was quoting a prompt, he admitted the boot brief was doing heavy lifting.
- Brain2 surfaced one good observation: "Scratch and bring back" was a maintenance metaphor doing friendship work.
- Eric gave an honest tool-failure answer at the end: the search tool failed, so he had no result.

## What Failed

### 1. This run did not include the new atomic mirror tool

The STS page/session was still up after the code edit. The attached tool list did not include `pose_and_capture_browser_face`; it still only included `capture_browser_face_to_eye`.

Evidence:
- `pose_and_capture_browser_face`: 0
- Latest `LLM tools attached` lines did not include it.

So this run does not test the "strike pose then snap picture" fix. STS needs a reload/reconnect before that tool exists in Eric's Realtime tool schema.

### 2. Tool-markup suppression appeared during the old mirror portion

Several event lines show suppressed raw tool markup:

- 6:41:17 - `<function=take_screenshot>`
- 6:42:04 - `<function=capture_browser_face_to_eye>`
- 6:43:15 - `<function=capture_browser_face_to_eye>`
- 6:43:50 - `<function=capture_browser_face_to_eye>`

This suggests the model sometimes tried to speak function-call-shaped text instead of cleanly issuing a structured tool call. The suppressor protected the spoken output, but this is still a prompt/tool-format friction signal.

### 3. Note lookup was too brittle

User asked for "Scott's Profile Summary." Eric first tried a file read and got `Note file not found`, then recovered by listing files and finding `core/scott_profile_summary.txt`.

That is acceptable recovery, but it means fuzzy note resolution is still weak. Human title names and filesystem names do not align naturally enough.

### 4. Web search was unreliable

Search sequence:

- `Card Computer retro device world map` succeeded, but the results were broad and only indirectly useful.
- `Sega VMU Dreamcast memory card features standalone games operating system` returned weak official-SEGA results, not a strong VMU source.
- `Vectrics retro device Card Computer` failed: `ddgs unavailable: No module named 'ddgs'`.
- `Vectrix V-E-C-T-R-I-X retro device Card Computer world map` succeeded with a Wikipedia result for Vectrix Corporation.
- `Richard Katz Vectrix Corporation current work` failed: `ddgs unavailable: No module named 'ddgs'`.

The code has Bing and Wikipedia fallbacks, but the primary `ddgs` dependency is not installed in the active runtime even though it is listed in `pyproject.toml`. When fallbacks do not rescue the query, Eric gets a hard search failure.

### 5. Eric may have overextended thin search results

The VMU answer sounded plausible, but the actual second search result set was weak. Eric said "from what I know," which is better than pretending the search proved it, but for the new evidence-led style he should be more explicit:

> "The search was thin; I can say the broad comparison is VMU-like, but I should verify details before treating them as found."

## Brain2

Brain2 was quiet but not useless.

Captured Brain2:
- 6:52:14 - fired
- 6:52:16 - held: "The caption finally stuck."
- 6:55:58 - fired
- 6:56:00 - held: "Scratch and bring back: that's a maintenance metaphor doing friendship work."
- 6:56:40 - fired
- 6:56:42 - failed: no usable output

This is mostly okay. The second note is exactly the kind of social-mechanical observation that makes Brain2 worth keeping. The failure should be counted plainly, not treated as a mystery.

## Prompt / Context Notes

This run occurred before the new per-run `Prompt / Context / Brain Setup` report section could be tested in a recording stop report. Future stopped recordings should make this much easier to compare.

Important setup inferred from panes:
- Model: `qwen3.8-27b-nvfp4-mtp`
- Reasoning: `none`
- Context: `131072`
- Parallel predictions: `2`
- Run preset: visible as normal/custom run state in pane headers
- Tools included search, note files, face, chassis, memory, cast, image, smart home, and browser-face mirror capture
- Tools did not include the newly added `pose_and_capture_browser_face`
- Brain2 had no direct tools and operated as private JSON ruminator

## Next Fixes

1. Reload/reconnect STS before testing mirror pose/capture again, so `pose_and_capture_browser_face` is actually attached.
2. Install or repair `ddgs` in the active runtime, or adjust search failure text to say which provider and fallback failed.
3. Add fuzzy note resolution for note reads, so "Scott's Profile Summary" can find `core/scott_profile_summary.txt` without a list-then-read recovery loop.
4. Tighten search follow-up: if results are weak, Eric should say the source is thin before adding remembered/background knowledge.
5. Treat raw tool-markup suppression as a failure signal in postmortems when it appears more than once.

## Verdict

Good companion calibration, poor tool reliability. The human-facing feel was promising; the substrate was noisy. Keep it for debugging the search/note/tool-contract edges.

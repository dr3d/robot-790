# Empty Connect Passivation

Run id: `20260907-001009`
Date: 2026-09-07

## Artifacts

- Passivated state: `notes/core/passivated_eric_state.txt`
- Conversation: `logs/live/20260907-001009-conversation.txt`
- Events: `logs/live/20260907-001011-events.txt`
- Brain2 mulling: `logs/live/20260907-001010-brain2_mulling.txt`
- Recording stop report: `logs/live/20260907-001013-recording_stop_report.txt`
- Latest aliases at review: `logs/live/latest-conversation.txt`, `logs/live/latest-events.txt`

## Verdict

The Empty Connect behavior was useful, but it exposed a rule that needed
sharpening. Empty Connect should omit passivated state, ordinary pinned notes,
browser facts, sensing input, search receipts, lab goal, and Brain2 carryover.
It should still include `core/erics_memories.txt` whenever the Eric memories
checkbox is enabled.

The receipt layer also had one real mistake: browser-held notes that were not
fed into B1 during Empty Connect were still visible to passivation metadata.
That made the passivated header claim every held note as previous-run context.
The corrected rule is: Eric memories are core if enabled; passivated state and
other notes are held outside unless explicitly read during the run.

## What Happened

At page/startup time, the browser holder read the ordinary configured notes:
`core/erics_memories.txt` and `core/passivated_eric_state.txt`.

At `12:06:45 AM`, Empty Connect started:

- Event receipt: `connected empty context: config-only prompt, startup context omitted`
- Run setup receipt: `empty connect / config only`
- Startup shown as `none`

Those receipts describe the run as it happened before the rule was sharpened.
The intended rule after this PM is `empty connect / Eric memories` whenever the
Eric memories checkbox is on.

At `12:06:54 AM`, the operator asked if Eric was brand new. Eric answered that
this was a clean, config-only startup and that he was not carrying over memories
or notes from before. That was true for this test run, but it is not the desired
future behavior for `core/erics_memories.txt`.

At `12:07:22 AM`, the operator asked Eric to read `get_go.txt`. That was a
runtime tool read during the empty session, so it is legitimate provenance for
this run.

At `12:08:53 AM`, the operator asked "Who am I?" Eric answered from `get_go.txt`,
not from startup memory.

At `12:09:48 AM`, the operator asked what college he went to. Eric said he did
not have that in the clean boot and offered to save it if told. That remains a
good behavioral check: the college answer should not appear unless it is in
Eric memories, read during the run, or otherwise explicitly loaded.

At `12:10:04 AM`, disconnect wrote the clean-session transcript into
`core/passivated_eric_state.txt`.

## Finding

The passivated transcript header incorrectly said:

`Previous-run loaded notes: get_go.txt, core/erics_memories.txt`

The correct interpretation is:

- `get_go.txt` was read during the empty session.
- `core/erics_memories.txt` was held in the browser note holder from normal
  startup machinery. The refined rule says it should be included in B1 whenever
  the Eric memories checkbox is on, even during Empty Connect.
- The old `core/passivated_eric_state.txt` was also held outside the empty
  session and should not be treated as live continuity for this run.

The current passivated file was repaired to say:

`Context mode at save: Empty Connect (config only)`

`Browser-held notes omitted by Empty Connect: 2`

`Previous-run loaded notes: get_go.txt`

## Code Fix

`web/sts/index.html` now makes passivation context-mode aware:

- Empty Connect prompt assembly includes `core/erics_memories.txt` whenever the
  Eric memories checkbox is on.
- Empty Connect passivation keeps Eric memories plus notes read after the empty
  session began. Other browser-held notes are counted as omitted instead of
  listed as previous-run context.
- Browser memory facts and search receipts are omitted from the saved state when
  Empty Connect is active.
- Brain2 passivation payload is trimmed to the current empty session.
- The run setup receipt now reports the omitted-note count correctly.
- Passivation is transcript-in/transcript-out with annotated gaps; it no longer
  writes a duplicate timestamp-free continuity tail into the state file.

## Next Check

On the next Empty Connect:

- Setup receipt should show active loaded notes plus the real omitted-note count.
- `list_pinned_notes` should return `core/erics_memories.txt` while Empty
  Connect is active if the Eric memories checkbox is on.
- Passivation should write `Context mode at save: empty connect / Eric memories`
  when the Eric memories checkbox is on.
- Passivation should list `core/erics_memories.txt` in Empty Connect whenever
  the Eric memories checkbox is on.
- Passivation should contain one timestamped transcript section, not a second
  cleaned continuity-tail copy.

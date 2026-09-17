# Idle Quiet-Loop Repair

September 17, 2026, following the 08:52-08:58 continued session.

## Observed Failure

Eric repeatedly said "I'm holding quiet" while calling the newly introduced
`wait_silently` tool. The scheduler continued firing; this was not the earlier
indefinite-hold bug. B2 repeatedly advised waiting for new input, including after
it found a headline with a connection to the bottle discussion. Full context and
working timers alone did not produce an active companion.

The original silence-announcement loop predates the wait tool. Removing that tool
is a rollback of an unsuccessful repair, not proof that it caused every loop.

## Changes

- Removed the experimental wait tool, its instructions, and its execution path.
  Scope-denial protection remains, including for obsolete calls from old history.
- B1 receives only the latest current B2 next-turn note after the latest user
  activity. Older notes remain logged, not accumulated as current instructions.
  A fresh empty note supersedes old advice too.
- B2 diagnostic fields (`next`, `loop`, and related assessment metadata) remain
  in diagnostics; they no longer become B1 prompt instructions. B2's actual prose
  advice, questions and revisions remain available, without semantic filtering.
- Prompt changes: B1's idle continuation foregrounds curiosity and connections;
  its stable system prompt distinguishes actual user requests for ongoing quiet
  from historical closing remarks or B2 advice. B2 is asked for a useful next
  angle or empty advice, not repeated instructions to wait. Its `new_subject`
  description no longer depends on a controller-selected topic.

No change to the established one-sentence default, sampling, cards, full-history
idle transport, tool permissions, or idle timing. No English phrase censor,
duplicate-output suppressor, added cooldown, or transcript deletion.

## Verification and Limits

Evidence and offline text-only experiments are in
`logs/runs/20260917-085854-quiet-loop/`. These are reconstructed fixtures, not an
exact replay of all live messages/schemas. The rich fixture includes four saved
sessions, the two setup cards, and repeated closing lines; the other fixture has
no cards. No proposed tools were executed and no audio or images generated.

Initial baseline: all six turns chose the wait tool. Tail-only changes were not
enough. A stable-prompt change with old waiting advice also failed; removing
diagnostic advice alone was insufficient. Removing the wait tool improved the
rich fixture but one interim card-free turn still echoed the phrase.

Final six-turn smoke test: four spoken developments and two search proposals,
without the repeated silence announcement. This is encouraging, not a guarantee:
answers still revisited the bottle and one claimed an unperformed search. The
small test establishes neither factual reliability nor sustained idle variety.
An independent B2 test returned empty advice and a diagnostic quiet assessment;
the revised transport deliberately does not turn that diagnostic into B1 direction.

Verification: 438 JavaScript tests and 771 Python tests pass; `git diff --check`
passes. The page server was restarted and HTTP-verified to serve the removed-tool
catalogue, latest-note projection, and updated system prompt. Realtime and the
loaded model were not restarted.

Automated tests cover latest-note replacement, retirement at user activity,
diagnostic separation, obsolete-tool denial, full context, and continuing idle
at 1x/5x/7x after terminal tool batches. A sustained live continuation still needs
validation. Refresh disconnected STS after the page-server restart; retain the
rich thread rather than using Connect Empty to hide the history.

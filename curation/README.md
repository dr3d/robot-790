# Robot 790 Curation

This folder is a staging area for mining Robot 790 runs before anything is
promoted to `docs/`.

The current engineering assessment is maintained in
[Engineering Status](../docs/engineering-status.md). Superseded engineering
snapshots and duplicate promoted drafts have been removed from the working tree;
their previous versions remain in Git history. Session postmortems remain
historical evidence, not a list of present-day bugs.

This folder is tracked, so it is a review staging area rather than a privacy
boundary. Keep private live captures in ignored `logs/` and `notes/` until a
publication decision has been made.

## Postmortems

Keep routine postmortems local by default, alongside the run's evidence in
`logs/runs/<run-id>/postmortem.md`. That directory is ignored by Git. A request
to do a postmortem authorizes the analysis and local record; publishing it to
GitHub is a separate decision.

When Scott chooses a finding worth sharing, prepare a concise summary or
selected evidence for `curation/` or `docs/`. A useful fix or public article
does not require publishing the full postmortem or its raw session bundle.
Review every included artifact before publication.

`curation/` itself is tracked and GitHub-visible. It is an editorial area, not
a local archive. The older `curation/postmortems/` collection is legacy tracked
review material; do not add routine PMs there. Review individual legacy runs
before moving or removing them because some clips, packets, and articles point
back to those paths. See [the repository map](../docs/repository-map.md) for
the full local-to-public flow.

## Workflow

The usual workflow:

1. Record a conversation or idle run from the STS page.
2. Run `scripts/mine_eric_log.ps1` against the captured conversation text.
3. Review the generated draft for:
   - `BANGER`: short, funny, quotable moments.
   - `CLIMB`: an idea that improves or corrects itself over time.
   - `MECHANISM`: useful explanation of a physical, historical, or technical system.
   - `PERSONA`: lines that reveal Eric's stable voice or self-model.
   - `WEB`: material that appears search-fed or lookup-aware.
   - `FAILURE`: confabulation, repetition, parsing trouble, tool trouble, or useful mistakes.
4. Ask Eric for his own short run summary before reload when the run is
   important. Capture it under `curation/eric-summaries/` if it is worth keeping.
5. Audit source classes before promoting anything:
   - live tool or sensor fact
   - event log fact
   - conversation transcript
   - Brain 2 mull line
   - staged screenshot or image read
   - Scott-reported value
   - Codex/Claude/Scott interpretation
6. Require durable summaries to include a provenance note when any settings,
   sensor states, model names, visual reads, or UI dials were not independently
   verified in the same turn.
7. Promote only the strong pieces into `docs/articles`, `docs/logs`, or `docs/media`.

The miner is intentionally a first pass. It is meant to reduce TLDR pain, not
replace judgment.

## Best Bits

After each postmortem, add a short `Best Bits` section when the run has a moment
worth saving for a later reel. Use video timecode, not wall-clock time.

Each candidate should name:

- title
- source video
- start and end timecode
- handle seconds before and after the marked moment
- why it matters
- source class
- publishability
- status: candidate, cut, used, or rejected

Promote durable candidates into `curation/best-bits.md` and
`curation/best-bits.json`. Then run `scripts/export_best_bits.ps1` to isolate
clips under `curation/best-bits/clips/` for later assembly into a best-of reel.
The manifest defaults to a small lead-in and a longer tail-out so later fades
have room; final publishing trims can be tighter.

Eric-authored summaries are different from mined transcripts. They are useful
because they show what the public voice thinks the run meant, but they still
need provenance fences. The strongest form is: "here is what happened, here is
what I think mattered, and here is what I did not verify myself."

Reusable Eric prompt:

```text
Eric, write a short run summary note. Include what happened, what you think
mattered, what settings or artifacts you noticed, and what should be checked
next. Mark provenance clearly: live tool/sensor fact, staged image read,
Scott-reported value, transcript memory, or inference. If you did not verify a
detail yourself in this turn, say that in the note.
```

## Style Watch

- `WATCH: reassurance filler` - Eric often says variants of "take your time,
  I'm here, no rush." Keep the pause-support behavior, but reduce repeated
  caretaking phrases. Prefer silence, a small face/mouth cue, or one concrete
  observation over generic reassurance.

## Runtime Patterns

- `CANDIDATE: warm-up curve` - Eric often seems more fun, specific, and able to
  pull details back after several minutes of live loop time. Treat this as a
  hypothesis: accumulated context, Scott settling, stronger late topics, and
  Brain 2 timing may all contribute. See `curation/concepts/warm-up-curve.md`.

## Concepts

`curation/concepts/` holds named mechanisms that explain why Robot 790 behaves
the way it does. These are tracked project notes, not public articles yet.

Current key concept:

- `continuity-envelope.md`: the wrapper that turns loaded facts into
  first-person continuity.
- `warm-up-curve.md`: the candidate pattern where Eric becomes more
  companionable after enough current-run material accumulates.
- `brain2-self-user-safety.md`: the safety contract for letting Brain2 leave
  labeled reflection cues for Brain1 without impersonating Scott or silently
  rewriting memory.
- `nerves-and-pulse.md`: the pinned terminology seed that frames Eric as a
  quantized loop where each pulse samples state and leaves a trace.
- `machine-language.md`: the shared vocabulary that maps Scott's words, prompt
  rules, UI controls, logs, and context operations onto the same machine parts.

## Archive Sweeps

Bulky or high-count ignored runtime artifacts can be moved to the adjacent
`robot-790-archive` folder when they no longer need to sit in the active repo.
Record each sweep in `curation/archive-sweeps.md`, including the archive folder,
manifest path, policy, and totals.

## Audio Clip Albums

Use `scripts/build_eric_audio_album.ps1` to turn harvested timestamp marks into
a short MP3 sequence:

```powershell
.\scripts\build_eric_audio_album.ps1
```

The clip manifest lives in `curation/clip-manifests/`. Each row gives a clock
timestamp, a rough spoken duration, a lead-in, a title, and tags. By default the
script treats the duration as advisory and cuts until the first detected silence
gap after the line starts. The script writes both the MP3 and a `.cuts.csv` file
with resolved source offsets.

Duration modes:

- `silence`: default; stop after the first real quiet gap.
- `manifest`: use the duration column directly.
- `transcript`: estimate clip length from the next transcript timestamp.

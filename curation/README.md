# Robot 790 Curation

This folder is a staging area for mining Robot 790 runs before anything is
promoted to `docs/`.

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
4. Promote only the strong pieces into `docs/articles`, `docs/logs`, or `docs/media`.

The miner is intentionally a first pass. It is meant to reduce TLDR pain, not
replace judgment.

## Concepts

`curation/concepts/` holds named mechanisms that explain why Robot 790 behaves
the way it does. These are tracked project notes, not public articles yet.

Current key concept:

- `continuity-envelope.md`: the wrapper that turns loaded facts into
  first-person continuity.

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

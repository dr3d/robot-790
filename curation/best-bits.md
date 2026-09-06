# Robot 790 Best Bits Ledger

This is the rolling shelf for moments that should survive the daily run pile.
Use video timecode, not wall-clock time, so clips can be cut without re-reading
the transcript.

The matching machine-readable manifest is `curation/best-bits.json`. When an
entry is ready to isolate, run:

```powershell
.\scripts\export_best_bits.ps1
```

The exporter writes cut clips under `curation/best-bits/clips/` and a run
manifest next to them. It includes handle seconds before and after each moment
so fades and final trims do not eat the line. Keep the raw postmortem judgement
here: why the bit landed, what source class supports it, and whether it is
public-safe.

## Entry Format

```md
### short-id

- Title:
- Run:
- Source video:
- Source postmortem:
- Clip: `MM:SS-MM:SS`
- Handles: default, or `lead_in_seconds` / `tail_out_seconds` in JSON
- Why it matters:
- Source class: video / transcript / event log / Brain2 / Scott read / Codex read
- Publishability: strong / maybe / private / no-video
- Status: candidate / cut / used / rejected
- Notes:
```

## Candidates

No current candidates have been promoted into the ledger yet.

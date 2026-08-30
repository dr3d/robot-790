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

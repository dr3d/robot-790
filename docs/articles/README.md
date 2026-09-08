# Robot 790 Articles

Drop public Markdown articles in this folder.

Suggested filename style:

```text
eric-wakes-up-new-every-time.md
pinocchio-and-the-wooden-boy.md
empty-brain-test.md
```

After adding articles, rebuild `../catalog.json`:

```powershell
.\scripts\build_docs_catalog.ps1
```

The static page lists Markdown files from this folder automatically.
It orders every public shelf newest first by a stable artifact timestamp: a
timestamp in the filename when present, then the file's first Git addition, and
only then filesystem time as a local fallback. Do not rely on a file edit to
move an older article to the top. Reused media filenames instead carry an
explicit `published` time in `docs/media/run-notes.json`.

Keep these public-safe:

- no private API keys or machine secrets
- no raw logs unless deliberately curated
- no private family/contact details unless intentionally published
- be clear when text is transcript, commentary, or edited/curated material

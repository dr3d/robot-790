# Robot 790 Public Docs

Model proposes; deterministic layers decide. Four diets, one mouth.

Safety is treated the same way: not as a personality prompt, but as body
architecture. The project explicitly nods to the Asimov robot-law tradition, but
puts safety in deterministic tool gates, verifier receipts, actuator limits, and
human override rather than asking Eric to role-play being safe.

This folder is the GitHub Pages site for Robot 790: Eric's public shelf of
articles, curated transcripts, publishable media, receipts, and open questions.

GitHub Pages can serve this folder directly by setting the repository Pages
source to the current branch and `/docs`. The homepage is `index.html`.

The page is static, but it loads `catalog.json` with browser `fetch()`. That
works on GitHub Pages and from a local HTTP file server. It may not work when
opened directly as a `file://` URL.

The catalog gives articles, media, and curated logs a canonical artifact time
and renders each public shelf newest first. It does not use an incidental later
file edit as the public chronology. A timestamped filename is preferred; use a
`published` field in `media/run-notes.json` for a deliberately reused media
filename whose current artifact needs an explicit time.

## Layout

- `index.html`: static public page.
- `index.md`: short Markdown landing copy for humans reading the repository.
- `repository-map.md`: repo-level map distinguishing local evidence, tracked
  editorial curation, public docs, and social publish packets.
- `catalog.json`: generated site index consumed by `index.html`.
- `assets/`: CSS and JavaScript for the static page.
- `articles/`: public Markdown articles and essays.
- `articles/context-engineering-as-directed-graph.md`: public article framing
  session dependencies as a directed graph, distinguishing the working loader
  from proposed three-representation notes and weighted relationships.
- `logs/`: curated public transcript excerpts, not raw private logs.
- `curation/postmortems/`: deliberately prepared session bundles. These may
  include full transcripts, note copies, recordings, and image receipts, so
  publication review applies to the entire bundle, not just its README.
  Routine postmortems stay local in ignored `logs/runs/<run-id>/` at the
  repository root; only selected material belongs on this public shelf.
- `media/`: compressed public images, audio, and video.
- `context-engineering-architecture.md`: session-note, pinned-note, latest, and
  runtime-truth architecture, including the standalone session-map chooser.
- `prosody-and-mouth.md`: input prosody, transcript tags, speech-mouth motion,
  and why those cues help the live loop.
- `mouth-animation-research.md`: source audit, viseme/coarticulation research,
  isolated mouth lab, and staged timing/renderer integration plan.
- `engineering-status.md`: maintained implementation status, known limits, and
  verification commands. Superseded review snapshots live in Git history.
- `evidence_map.md`: working map of project observations, receipts, and open
  tests.
- `face_contract.md`: face vocabulary, skin inheritance, and renderer contract.
- `experimental_controls.md`: STS run controls, known interactions, and
  evolving preset definitions.
- `reachy_embodiment.md`: plan for making Reachy Mini another Eric embodiment.
- `future_directions.md`: public-safe roadmap and experiment notes.
- `embodied_sensor_head.md`: notes for the ESP32-S3 sensor/head direction.
- `references.md`: research and project lineage shelf.

## Updating

After adding articles, logs, images, audio, or video, rebuild the catalog:

```powershell
.\scripts\build_docs_catalog.ps1
```

For local preview:

```powershell
python -m http.server 8088 -d docs
```

Then open:

```text
http://localhost:8088/
```

Large raw captures should stay out of git. Keep them in ignored local folders
such as `docs/media/raw-video/`, `docs/media/rejected/`, or the root `logs/`
tree until they are curated and compressed. Public media should be aggressively
compressed before it lands in `docs/media/images/`, `docs/media/videos/`, or
`docs/media/audio/`.

The article reader uses a pinned, locally vendored Markdown parser, including
tables, links, lists, and code fences. Write image/link paths relative to the
Markdown file so they work both on GitHub and in the reader. Run
`node --test tests/docs.test.cjs` from the repository root after rebuilding the
catalog to catch broken local links.

The boundary is intentional: `docs/` is publishable, while `notes/` and `logs/`
are local working memory unless something is deliberately copied or curated
into this folder.

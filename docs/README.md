# Robot 790 Public Docs

Model proposes; deterministic layers decide. Four diets, one mouth.

Safety is treated the same way: not as a personality prompt, but as body
architecture. The project explicitly nods to the Asimov robot-law tradition, but
puts safety in deterministic tool gates, verifier receipts, actuator limits, and
human override rather than asking Eric to role-play being safe.

This folder is the GitHub Pages site for Robot 790: Eric's public memory
palace, articles, curated transcripts, and publishable media.

GitHub Pages can serve this folder directly by setting the repository Pages
source to the current branch and `/docs`. The homepage is `index.html`.

The page is static, but it loads `catalog.json` with browser `fetch()`. That
works on GitHub Pages and from a local HTTP file server. It may not work when
opened directly as a `file://` URL.

## Layout

- `index.html`: static public page.
- `index.md`: short Markdown landing copy for humans reading the repository.
- `catalog.json`: generated site index consumed by `index.html`.
- `assets/`: CSS and JavaScript for the static page.
- `articles/`: public Markdown articles and essays.
- `logs/`: curated public transcript excerpts, not raw private logs.
- `media/`: compressed public images, audio, and video.
- `evidence_map.md`: working map of project claims, receipts, and open tests.
- `experimental_controls.md`: STS run controls, known interactions, and
  evolving preset definitions.
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

The boundary is intentional: `docs/` is publishable, while `notes/` and `logs/`
are local working memory unless something is deliberately copied or curated
into this folder.

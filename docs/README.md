# Robot 790 Public Docs

This folder is the GitHub Pages site for Robot 790: Eric's public memory
palace, articles, curated transcripts, and publishable media.

GitHub Pages can serve this folder directly by setting the repository Pages
source to the current branch and `/docs`. The homepage is `index.html`.

## Layout

- `index.html`: static public page.
- `index.md`: short Markdown landing copy for humans reading the repository.
- `catalog.json`: generated site index consumed by `index.html`.
- `assets/`: CSS and JavaScript for the static page.
- `articles/`: public Markdown articles and essays.
- `logs/`: curated public transcript excerpts, not raw private logs.
- `media/`: compressed public images, audio, and video.
- `future_directions.md`: public-safe roadmap and experiment notes.
- `embodied_sensor_head.md`: notes for the ESP32-S3 sensor/head direction.

## Updating

After adding articles, logs, images, audio, or video, rebuild the catalog:

```powershell
.\scripts\build_docs_catalog.ps1
```

Large raw captures should stay out of git. Keep them in ignored local folders
such as `docs/media/raw-video/`, `docs/media/rejected/`, or the root `logs/`
tree until they are curated and compressed.

The boundary is intentional: `docs/` is publishable, while `notes/` and `logs/`
are local working memory unless something is deliberately copied or curated
into this folder.

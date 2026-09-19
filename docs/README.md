# Robot 790 Public Docs

Models interpret and choose; deterministic layers execute within declared
permissions. Multiple context diets, one public mouth.

That is the intended boundary, not a claim that the current implementation
already respects it everywhere. The September 16
[agency/language audit](sts-agency-and-language-audit-2026-09-16.md) identifies
controller interpretation and dialogue direction; the
[first removal pass](agency-boundary-change.md) records what changed and what
still needs work.

The [Companion Design Contract](companion-design-contract.md) defines the intended
experience, not only the agency boundary. The
[September 17 alignment audit](companion-alignment-audit-2026-09-17.md) reviews
recent regressions while preserving established behavior. Its earlier, broader
observations are explicitly outside the current repair scope.
The subsequent [idle quiet-loop repair](idle-quiet-loop-repair.md) records the
failed silence-tool experiment, its rollback, and local-model verification limits.

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

September 19 checkpoint: the homepage now reflects shared conversation/idle
history, the measured cache-state repair, compact file lookup, optional complete
B1/B2 cards, image-handoff repairs and TimerCam snapshots. The Memory Jar report
and its edited video remain the latest featured report; this update adds no new
article. [Engineering Status](engineering-status.md) is the maintained source
for test results, observed weaknesses and remaining live acceptance work.

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
- `sts-ui-guide.md`: illustrated STS operator guide, from connection and mic
  setup to recording, session lineage, lab controls, and context inspection.
- `articles/2026-09-10-022329-robot-790-project-overview.md`: published project
  orientation covering the working baseline, recent progress, and next steps,
  with a linked listening companion and architectural cover.
- `catalog.json`: generated site index consumed by `index.html`.
- `assets/`: CSS and JavaScript for the static page.
- `articles/`: public Markdown articles and essays.
- [Memory-jar lab report](articles/2026-09-17-eric-memory-jar-lab-report.md):
  illustrated newcomer-facing account of sustained B1/B2 development, with a
  [benchmark evidence sheet](logs/2026-09-17-memory-jar-benchmark.md) and repeat-test protocol.
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
- [brain2-setup-cards.md](brain2-setup-cards.md): shared and B1/B2 instructions
  in ordinary notes, with reserved B3/B4 sections and backwards compatibility.
- [idle-art.md](idle-art.md): permission, queue, durable job identity and
  artifact receipts for model-proposed idle pictures.
- [llm-metrics-capture.md](llm-metrics-capture.md): opt-in local inference
  measurements for cache reuse and latency investigations.
- [local-model-routing.md](local-model-routing.md): explicit local model
  selection shared by B1, B2 and supporting model work.
- [sts-agency-and-language-audit-2026-09-16.md](sts-agency-and-language-audit-2026-09-16.md):
  reproduced semantic-control failures, multilingual risks and removal priorities.
- `summary-research-plan.md`: research-backed exo-brain summary experiments,
  model comparisons, and proposed queued model swapping; not deployed behavior.
- [task-continuation-experiment.md](task-continuation-experiment.md): proposed
  shared-activity and pending-task orchestration, grounded in the September 12
  image/engagement failures; implementation steps, limits, and acceptance tests.
- `chunked-summary-experiment.md`: offline, resumable chunk-extraction and
  consolidation lab, with source-linked drafts and explicit long-session limits.
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
- `eric-dedicated-machine-plan.md`: side-project plan for trying Eric on a
  ZimaBoard 2 1664 and RTX 2000 Ada 16GB; hardware and performance unvalidated.
- `embodied_sensor_head.md`: notes for the ESP32-S3 sensor/head direction.
- `references.md`: research and project lineage shelf.

## Updating

The browser homepage is `index.html`, not `index.md`. Update both when changing
the project checkpoint, and keep the featured article pointed at the newest
published report. Keep dated articles as historical observations; do not silently
rewrite them to imply their tests cover later code. Changing homepage prose alone
does not require a new article.

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

The [Eric Robot-790 YouTube playlist](https://www.youtube.com/playlist?list=PLSMpkQttgaR8)
is the larger video shelf. Keep its link visible on the homepage; there is no
requirement to copy every YouTube upload into this repository or its catalog.
The local media shelf is intentionally a curated subset.

The article reader uses a pinned, locally vendored Markdown parser, including
tables, links, lists, and code fences. Write image/link paths relative to the
Markdown file so they work both on GitHub and in the reader. Run
`node --test tests/docs.test.cjs` from the repository root after rebuilding the
catalog to catch broken local links.

The boundary is intentional: `docs/` is publishable, while `notes/` and `logs/`
are local working memory unless something is deliberately copied or curated
into this folder.

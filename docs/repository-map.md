# Repository Map

This is a map of the places in Robot 790 that have different persistence and
publication rules. It is intentionally about purpose, not an exhaustive file
listing.

```text
robot-790/
|- src/                 Python daemons, storage, and tool adapters
|- web/                 STS, Browser Face, and the mouth lab
|- firmware/            ESP32 face, camera, and chassis projects
|- config/              Runtime, LAN, face, and creature configuration
|- presets/             Named runtime baselines
|- prompts/             Editable seed prompts
|- scripts/             Operator launch, stop, catalog, and media helpers
|- tests/               Python, Node, and PowerShell checks
|
|- notes/               Local continuity, library, worlds, and working notes
|- logs/                Local runtime evidence, recordings, and run folders
|- curation/            Tracked editorial work and selected durable material
|- docs/                Public GitHub Pages shelf
`- publish-packets/     Prepared social-post materials
```

## Runtime And Build

| Place | What belongs there |
| --- | --- |
| `src/` | The deterministic daemon code, note/session helpers, page server, tool adapters, and TTS endpoint. |
| `web/` | Browser code. `web/sts/` is the control surface, `web/face-sim/` is Browser Face, and `web/mouth-lab/` is the isolated animation experiment. |
| `firmware/` | Separate PlatformIO projects for hardware embodiments. A one-file `src/` folder is normal for these projects, not abandoned structure. |
| `config/` | Checked-in configuration. `config/creatures/eric.json` is the current creature descriptor; it has a namespace because more creature profiles may arrive. |
| `presets/` | Named runtime baselines. There is currently one gold preset, which is intentional. |
| `prompts/` | Human-editable system/seed prompts. |
| `scripts/` | Operator procedures and repeatable helpers. |
| `tests/` | Focused behavior and static-page contracts. |

## Local-Only Working State

These places are for the lab's live record and are ignored by Git unless a
specific file is deliberately promoted elsewhere.

| Place | What belongs there |
| --- | --- |
| `notes/` | Core memory, library/world material, active session notes, and local working context. `notes/sessions/archived/` is the natural session-side archive for retained continuity evidence. |
| `logs/` | Live events, audio, generated images, sensing-eye captures, and operator artifacts. Routine PMs belong in `logs/runs/<run-id>/postmortem.md`. |
| `.local/`, `.tmp/`, `tmp/` | Machine-local server state, test residue, and temporary output. |
| `backups/`, `samples/` | Ignored local parking places. Their current emptiness does not create a Git cleanup task. |

An archive inside an ignored local tree is preservation. An archive inside a
tracked tree is still visible in GitHub history.

## Editorial And Publication Paths

There are three different postmortem destinations. They are deliberately not
interchangeable.

| Place | Visibility | Use |
| --- | --- | --- |
| `logs/runs/<run-id>/` | Local and ignored | Default home for a routine PM, raw captures, and working evidence. |
| `curation/` | Tracked and GitHub-visible | Editorial notes, concepts, clip manifests, and only selected durable material. `curation/postmortems/` is a legacy tracked review collection, not the default destination for new PMs. |
| `docs/curation/postmortems/` | Public Pages and GitHub-visible | Deliberately prepared public session bundles. Treat every file in a bundle as publishable material. |

`docs/` is the public shelf: articles, public logs, and compressed media served
by GitHub Pages. `publish-packets/` is a small, tracked tray of captions,
thumbnails, tags, manifests, and links for manual social posting. It is not a
Pages section, but it is still visible to anyone browsing the repository.

The intended promotion path is:

```text
live run
  -> logs/runs/<run-id>/              local PM and raw evidence
  -> notes/sessions/archived/<id>/    retained local continuity sidecar, when useful
  -> curation/                        selected editorial work, only when Git tracking is acceptable
  -> docs/                            consciously public article, media, log, or PM bundle
  -> publish-packets/                 optional ready-to-post platform materials
```

The arrows are choices, not an automatic pipeline. A useful fix or article does
not require publishing a full PM or raw session package.

## How To Read Small Folders

Small folders are not automatically leftovers. The currently compact ones have
specific jobs:

- `.vscode/`: shared workspace settings.
- `docs/media/generated-images/`: a catalogued public generated-image class.
- `web/sts/assets/`: shared STS visual assets.
- `curation/eric-summaries/`, `mined/`, `research/`, and `saved/`: named
  editorial buckets with sparse, meaningful contents.
- `curation/audio/`, `curation/reviews/`, and `curation/best-bits/clips/` are
  empty local output targets at present. They are not tracked content and do not
  need a destructive cleanup.

## Current Cleanup Rule

Do not bulk-move the legacy tracked PMs merely because the new local-first
policy exists. Some have links from best-bit manifests, articles, or packets.
Review each one, then either retain it as intentional tracked curation or move
its local evidence to an ignored session/archive sidecar and remove the public
copy in a focused commit.

# Archive Sweeps

This file records intentional moves from the active repo tree into the adjacent
`robot-790-archive` folder. These are not deletions; they are index/search
relief sweeps for bulky or high-count runtime artifacts.

## 2026-09-12 Retired Labtable

- Scott shelved the old multi-participant Labtable research workflow.
- Moved all 27 files (79,820 bytes) from `notes/labtable/` into
  `D:\_PROJECTS\robot-790-archive\20260912-retired-labtable\notes\labtable`.
- Preserved both day folders, participant packets, feedback, and procedures.
  The archive has a recovery README and `manifest.json`; every file was
  SHA-256 verified before and after the move.
- No runtime/configuration/core-note reference to Labtable was found. The
  remaining server test uses its name as an arbitrary operator-message string,
  not as a file dependency. Historical transcripts and published media remain.
- No prompt, core memory, session lineage, server, or published catalog changed.
  Moving files removes them from future shelf listings; it does not erase text
  already loaded into an open conversation or historical note receipts.
- Other candidates are recorded in [Retirement Review](retirement-review.md).
  They have not been moved. No commit or push was performed.

## 2026-09-09 Older Logs Sweep

- Archive: `D:\_PROJECTS\robot-790-archive\20260909-older-logs-sweep`
- Moved 2,054 older unreferenced files (1,216.92 MiB): 1,694 live snapshots
  and 360 audio/video artifacts. Nothing was discarded.
- Preserved repository-relative paths, with recovery instructions in `README.md`
  and SHA-256 checksums in `manifest.json` and `manifest.csv`. All moves verified.
- Kept the latest run beginning September 9 at 22:18, its local PM package and
  recordings, all rolling `latest-*` files, and all server/operator `.log` files.
- Checked 663 text files across retained notes, public/editorial material,
  source/configuration, prompt exports, and retained evidence. Referenced assets
  and companion metadata stayed in place, including all remaining generated
  images and sensing-eye files.
- Active `logs/` fell from 2,352 files (1,460.45 MiB) to 298 files (243.53 MiB).
  Servers, session notes, public content, and Git tracking were not changed by
  the move. No commit or push was performed.

## 2026-09-09 Unpublished Sessions Clean Slate

- Requested scope: completed sessions not published on the public docs shelf,
  together with their PMs and identifiable evidence. Git tracking alone was not
  treated as publication.
- Archive: `D:\_PROJECTS\robot-790-archive\20260909-unpublished-sessions-clean-slate`
- Recovery guide: `README.md` inside that folder; original paths, sizes, actions,
  and SHA-256 checksums are in `manifest.json` and `manifest.csv`.
- Moved 418 files (608.47 MiB): 7 session notes, 23 PMs, and associated run
  packages, recordings, snapshots, generated images, and sensing-eye assets.
- Copied 5 shared evidence files into the archive without removing the originals
  needed by retained published sessions.
- Kept all public `docs/` bundles and media, their session notes, the published
  Daily Driver material, core/library/working notes, and the live run that began
  at 22:18 on September 9. Servers and rolling `latest-*` logs were untouched.
- 106 source references were already absent before the sweep; these are listed
  in the manifest. Many older raw artifacts were moved in earlier archive sweeps.
- Best Bits candidate references now point to the archived PMs and to their
  previously archived source videos. No commit or push was performed.

## 2026-09-05 Active Cruft Sweep

- Archive folder: `D:\_PROJECTS\robot-790-archive\20260905-active-cruft-sweep`
- Manifest: `D:\_PROJECTS\robot-790-archive\20260905-active-cruft-sweep\manifest.csv`
- Moved: 4,067 ignored runtime files, about 640.56 MB
- Buckets:
  - `logs/live`: 3,781 files, about 542.17 MB
  - `logs/generated-images`: 101 files, about 67.34 MB
  - `logs/audio`: 185 files, about 31.05 MB
- Active-tree policy used:
  - kept public `docs/` artifacts in place
  - kept tracked files untouched
  - kept `latest-*` runtime pointers in place
  - kept September 5 active logs/audio in place for current review
  - moved old ignored `logs/live` files before September 5
  - moved ignored `logs/audio` files before September 5
  - moved ignored `logs/generated-images` files before September 4

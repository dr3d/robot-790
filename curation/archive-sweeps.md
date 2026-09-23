# Archive Sweeps

This file records intentional moves from the active repo tree into the adjacent
`robot-790-archive` folder. These are not deletions; they are index/search
relief sweeps for bulky or high-count runtime artifacts.

## 2026-09-23 Cold Workspace

- Archive: `D:\_PROJECTS\robot-790-archive\20260923-cold-workspace`.
  Preserved 6,601 files, 37,776,111,253 bytes (35.18 GiB), under original
  repository-relative paths. Nothing was discarded; this is same-drive
  organization, not freed disk space or an independent backup.
- Moved 5,562 scratch files in 15 accessible old test directories, 733
  unreferenced dated live snapshots, 60 old root diagnostics and seven completed
  September 20 PM bundles. Eight Markdown paths retain forwarding notes.
  Checked 3,089 retained source/document/note/evidence files for references.
- The retired 37,581,674,972-byte camera page log was moved by same-volume
  rename after an exclusive-open check. Its contents were not read or hashed:
  NTFS file ID, byte length and modification time match after relocation.
  All other archived files verify by SHA-256. The large log is at
  `logs/live/sts-page-esp32-camera.err.log` beneath the archive directory.
- Kept September 21 onward, existing forwarding notes, active service logs,
  current and older open cache-refill/context-budget evidence, source, firmware
  builds, environments, published material and original recordings. All 2,529
  protected note/generated-image/sensing-eye/audio files retain their paths,
  sizes and modification times. No session graph operation or note edit occurred.
- Skipped 54 scratch directories because of access restrictions, references
  or private-name fixtures. No permissions were changed. The private root
  `notes-to-me.txt` was not read, changed, staged or moved.
- Recovery: archive `README.md`, `manifest.json`, `moves.jsonl`, `skipped.json`,
  `verification.json` and `protected-verification.json`. Procedure and test log:
  `logs/maintenance/archive-cold-20260923.ps1` and
  `logs/maintenance/archive-cold-20260923-tests.log`. Restore individual paths
  only after verification and checking for newer work.
- All 865 JavaScript tests pass after cleanup. Page, Browser Face, realtime and
  LM Studio listeners retain the same PIDs; no server was restarted. This index
  is the only tracked change. No commit or push performed for this sweep.

## 2026-09-22 Cold Diagnostics

- Archive: `D:\_PROJECTS\robot-790-archive\20260922-cold-diagnostics`.
  Preserved 292 files, 33,770,795 bytes (32.21 MiB): 288 evidence/snapshot files
  moved out and four PM paths replaced by forwarding notes. All copies verified
  by SHA-256 before source removal and again after the sweep.
- Kept September 20-22, the September 19 cache-refill investigation, earlier
  forwarding notes and referenced live snapshots. Checked 2,884 retained text
  files for references. Four completed September 19 run bundles moved; current
  cache and deferred-B2 acceptance evidence remains local.
- All 2,303 protected note/generated-image/sensing-eye files have unchanged
  paths, sizes and modification times. No session graph operation, note edits,
  media relocation, tracked-file movement or service restart was performed.
  Rolling/server logs and original recordings were not touched.
- Recovery: archive `README.md`, `manifest.json`, `moves.jsonl` and
  `verification.json`; script `logs/maintenance/archive-cold-20260922.ps1`.
  Restore individual paths only after checksum verification and checking for
  newer local work. This same-drive sidecar is not an independent backup.

## 2026-09-21 Session And Diagnostic Cleanup

- Archived 58 of 85 active sessions through the existing STS archive API.
  Kept September 19-21 and two September 18 ancestors needed by recent threads:
  27 sessions remain active. Today's 10:26 anchor and diagnostic continuations
  remain available; no new note was pinned or edited.
- Session transcripts, variants, title/context metadata and eye assets remain
  in application archive packages under `notes/sessions/archived/`. Exact
  SHA-256-verified copies also live in
  `D:\_PROJECTS\robot-790-archive\20260921-session-cleanup`: 536 package files,
  8,632,437 bytes. Shared assets needed by retained sessions remain in place.
- Final verification: every package file matches in both locations; all 27
  retained session hashes are unchanged, their parent/pinned references resolve,
  and all 173 distinct retained eye assets match their receipts. No asset
  warnings or pending archive transactions remain. Old archived texts retain
  their original lineage names; restoring a cold thread requires its dependencies.
- A Windows sharing conflict interrupted the maintenance log once, after the
  corresponding application archive had completed. Verified resume recovered
  that unlogged package and completed the sweep without overwriting originals.
  The archive contains `plan.json`, `results.jsonl`, `verification.json`,
  `final-integrity.json`, and a recovery README.
- Moved 238 old unreferenced dated live snapshots (16,219,564 bytes) to
  `../robot-790-archive/20260921-cold-live-snapshots/`. Kept September 19 onward,
  recent modifications, rolling snapshots and referenced material; checked
  2,194 reference files. All moved snapshots verify by SHA-256.
- Archived 38 diagnostic files from seven older run bundles (9,993,570 bytes)
  under `../robot-790-archive/20260921-cold-run-bundles/`. Five referenced files
  remain shared locally, five Markdown paths have forwarding notes, and 28
  evidence files moved out. Every archived file verifies by SHA-256.
- No servers restarted, no prompts/model settings changed, and no tracked
  source files or public media moved. No commit or push performed. Maintenance
  scripts are in `logs/maintenance/archive-*-20260921.ps1`. As always, this
  same-drive sidecar is preservation/organization, not an independent backup.

## 2026-09-20 Cold Run Bundles

- Archived 29 completed September 14-17 run bundles under
  `D:\_PROJECTS\robot-790-archive\20260920-cold-run-bundles`, preserving original
  repository-relative paths: 244 files, 28,128,981 bytes (26.83 MiB).
- Every archived copy was SHA-256 verified before source removal and again after
  the sweep. Four directly referenced files remain locally as shared copies;
  24 Markdown report paths now contain forwarding notes. The other 216 files
  were removed locally only after verification. Nothing was discarded.
- Checked 1,271 retained source, test, documentation, note and run text files
  for direct artifact references. September 18-20 bundles, previous forwarding
  notes, tracked files, session history, canonical images, original recordings,
  live logs and running services were left alone.
- Recovery: archive `README.md`, `manifest.json`, and `moves.jsonl`; the local
  maintenance script is `logs/maintenance/archive-runs-20260920.ps1`. Verify hashes
  before restoring specific paths; do not overwrite newer work. The same-drive
  archive is organizational cold storage, not an independent backup.

## 2026-09-20 Cold Live Snapshots

- Moved 826 old, unreferenced live-log snapshots (32,695,348 bytes) into
  `D:\_PROJECTS\robot-790-archive\20260920-cold-live-snapshots`.
- Kept September 18 onward, recently modified files, all rolling `latest-*`
  files, tracked files and snapshots referenced by retained material. Checked
  1,452 text files across notes, source/tests, docs, curation and PM bundles.
- Only dated text snapshots directly in `logs/live/` moved. No session notes,
  images, recordings, PM bundles, server logs or running services changed.
- All moves were SHA-256 verified. `plan.json`, `moves.jsonl`, `manifest.json`
  and the archive README preserve paths and recovery information. This is
  working-tree relief, not deletion or an independent backup.

## 2026-09-16 Cold Diagnostics

- Archive: `D:\_PROJECTS\robot-790-archive\20260916-cold-diagnostics`
- Moved and SHA-256 verified 4,034 untracked/ignored diagnostic files
  (26.064 GiB), including 52 older PM entry reports. Nothing was discarded.
- Kept September 14-16 material, recently modified files, rolling `latest-*`
  files, and canonical runtime log paths. Older referenced artifacts remain
  where needed; 916 retained source/editorial/note files were checked.
- Old PM entry paths contain small Markdown forwarding notes, not directory
  symlinks. Their full reports and evidence are in the archive under the same
  repository-relative paths. Five shared evidence files were copied there
  while retaining the active originals required by other references.
- Preserved all 791 files across `notes/`, original audio/video recordings,
  generated images, and sensing-eye assets; their paths, sizes, and modification
  timestamps were verified unchanged. Current untracked source/tests, prompt
  snapshots, credentials, environments, firmware builds, and published material
  remain in place. Access-denied old test directories were not forcefully changed.
- `logs/` fell from 4,750 files (27,210.3 MiB) to 927 files (581.89 MiB).
  Most reclaimed working-tree bytes came from the obsolete 25.6 GiB
  `sts-page-sweeps-only.stderr.log`. Disk space remains occupied in the adjacent
  archive; the purpose is working-tree/index relief, not deletion.
- Inventory/recovery: archive `README.md`, `manifest.json`, `manifest.csv`,
  `moves.jsonl`, and `shared-copies.json`. Original paths and checksums are
  retained. To restore a PM, replace its forwarding note only after checking
  that no newer report has replaced it; restore companion evidence as needed.
- Git status was unchanged by the moves. This index entry is the only tracked
  documentation change for the sweep. No servers were stopped/restarted;
  STS, realtime voice, and Browser Face listeners remained available. No commit
  or push was performed. This same-drive archive is not an independent backup.

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

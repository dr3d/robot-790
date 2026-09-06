# Archive Sweeps

This file records intentional moves from the active repo tree into the adjacent
`robot-790-archive` folder. These are not deletions; they are index/search
relief sweeps for bulky or high-count runtime artifacts.

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

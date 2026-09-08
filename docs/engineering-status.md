# Engineering Status

Reviewed September 8, 2026. This is the maintained engineering view; session
postmortems remain evidence of their particular runs. A successful test or an
expressive session is not a guarantee about extended live operation.

## Working Baseline

The daily setup is the local realtime worker, STS page on port 8790, and Browser
Face on 8791, using LM Studio for the configured local model. Browser Face is
the default embodiment. The apartment HTTPS gateway is optional and separate.
The active physical portrait face is `firmware/esp32-s3-face`; the external-eye
targets remain available for existing hardware and experiments.

Continuity uses timestamped session files and their direct pinned-note lists.
Connect chooses the newest active session; Previous is chronological; Select
chooses a specific branch; Empty omits session continuity. No current-session
pointer file is required. See the [context architecture](context-engineering-architecture.md).

Implemented reliability repairs include configured scheduler retry cadence,
reserved core-memory prompt space, serialized atomic note writes, fresh pin
restoration, rejection of late tool/B2 work from older runs, and visible failures
when graceful session saving fails. Browser-face status clipping now has a
bounded operation, and Context Map expansion state is tracked separately from
control-panel state.

The repository review also corrected Eye salience's missing-preference default,
disabled unavailable note flavors, and replaced the public site's incomplete
Markdown formatter. Raw/Scrubbed/Summary is a design direction; only the selected
file as written is currently supported by the connection loader.

## Priorities Before More Context Machinery

1. **Preserve dependency references through captioning and archiving.** Session
   parents and pins are literal filenames. The archive API moves a file without
   updating references, and caption changes can do the same. A descendant can
   consequently lose an expected dependency; saving a live child can fail if its
   named parent moved. Add an explicit reference-preserving operation and test
   it with existing descendants and a browser still holding the old name.
2. **Report actual context inclusion and preserve pin intent.** The page retains
   at most eight notes on manual reads, while session restore can load more.
   Prompt caps can clip or omit pinned content: 4,500 characters per ordinary
   note, 64,000 for transcript views, 64,000 across the loaded-note block, and a
   smaller idle budget. Produce per-file inclusion receipts from the actual
   assembly code. Keep selection independent of budgeting and implement real
   source-linked variants before offering compressed connection choices.
3. **Test the long-session handoff.** Disk notes are limited to 200,000
   characters. Graceful save failure is visible, but long-run saving, recorder
   rollover, pending speech at disconnect, and repeated reconnects need live
   trials. Capture a fixed exit boundary and account for work still in flight.
   Preserve Halt's deliberate immediate-stop behavior.
4. **Diagnose long-idle STT fatigue.** The latest overnight PM reports poor
   transcription late in the run; it does not establish a root cause. Compare
   microphone frames, VAD, accepted STT events, playback/interrupt state, and a
   deliberate Fresh Ears recovery under the same conditions.
5. **Keep operational evidence distinct from interpretation.** Brain2 receives
   conversational context, not a complete structured action-receipt stream.
   Runtime-authored confirmations and supplied PM interpretations need attribution.
   Repeated behavioral comparisons, rather than self-report alone, should decide
   whether a candidate lesson is promoted. Preserve dependency versions for A/Bs.

The file-based dependency graph is a useful control surface already. Automatic
summary validation, recursive loading, timed salience decay, learned authority
weights, and direct model control over KV state are not implemented.

## Maintenance Boundaries

- STS is roughly 21,000 lines in one HTML file. Extract lifecycle and context
  assembly into small testable modules as concrete repairs require them.
- The shared face contract checks pose numbers across browser and active
  firmware targets. It does not provide a shared painter or visual equivalence
  across different screen sizes. Browser resize/render soak checks remain useful.
- The strict mypy configuration is not a passing gate: the installed NumPy stubs
  use syntax incompatible with the configured Python 3.11 target. Resolve the
  supported-version/dependency combination and existing typing debt explicitly.
- Hardware watchdogs, multiple-controller ownership, and untrusted-network
  operation need dedicated work before extending beyond the current lab setup.
  The [LAN guide](../scripts/sts-lan.md) states the existing household trust boundary.
- Raw runtime captures and live notes are local, ignored data. Tracked curation
  and `docs/` files become visible wherever the repository is published. PM
  bundles may include more than their written summary.

## Repeatable Checks

Run from the repository root with the project development environment installed:

```powershell
.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --basetemp=tmp/pytest
.\.venv\Scripts\python.exe -m ruff check src tests scripts firmware
.\.venv\Scripts\python.exe scripts/generate_face_contract.py --check
node --test tests/sts_runtime.test.cjs tests/docs.test.cjs
powershell -NoProfile -File tests/sts_stop.test.ps1
git diff --check
```

The browser-source suite uses isolated fixtures. The docs suite checks Markdown
rendering and local source/catalog links. Shutdown tests use fake processes.
These checks do not operate hardware or prove microphone/camera operation on a
second device. Builds and media publication still need their appropriate review.

## Retired Material

The September 5 scour, September 7 assessment/fix snapshots, and session-road
review were consolidated here. The older pinned-notes architecture guide was
merged into the current context guide. Two promoted PM drafts and one duplicate
transcript were removed while their identical public copies were retained. The
unused tool-free local voice launcher was retired; the documented realtime
launchers remain.

These tracked files remain in Git history. To find a removed document:

```powershell
git log --all -- path/to/removed-file.md
git show COMMIT:path/to/removed-file.md
```

Session evidence, public articles, active notes, recordings, and hardware targets
were not discarded merely because they were older.

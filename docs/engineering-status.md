# Engineering Status

Reviewed September 10, 2026. This is the maintained engineering view; session
postmortems remain evidence of their particular runs. A successful test or an
expressive session is not a guarantee about extended live operation.

## Working Baseline

The daily setup is the local realtime worker, STS page on port 8790, and Browser
Face on 8791, using LM Studio for the configured local model. Browser Face is
the default embodiment. The apartment HTTPS gateway is optional and separate.
The active physical portrait face is `firmware/esp32-s3-face`; the external-eye
targets remain available for existing hardware and experiments. The new C3
0.71-inch and S3 1.28-inch dual-eye projects have animated, blinking bench
firmware and optional Wi-Fi OTA. They do not yet accept STS face commands.
See [Firmware Embodiments](https://github.com/dr3d/robot-790/blob/master/firmware/README.md).

Continuity uses timestamped session files and their direct pinned-note lists.
Connect chooses the newest active session; Previous is chronological; Select
chooses a specific branch; Empty omits session continuity and inherited pins,
but keeps the ordinary prompt and enabled tools, with the optional core note.
No current-session pointer file is required. See the
[context architecture](context-engineering-architecture.md) and illustrated
[STS operator guide](sts-ui-guide.md).

Implemented reliability repairs include configured scheduler retry cadence,
reserved core-memory prompt space, serialized atomic note writes, fresh pin
restoration, rejection of late tool/B2 work from older runs, and visible failures
when graceful session saving fails. Browser-face status clipping now has a
bounded operation, and Context Map expansion state is tracked separately from
control-panel state.

The repository review also corrected Eye salience's missing-preference default
and replaced the public site's incomplete Markdown formatter. Raw/Scrubbed/
Summary selection is now real: a PM-authored derivative is enabled only when its
source filename and SHA-256 still match the selected raw session note.

## September 9-10 Changes

- **One ordinary conversation path.** Connect Empty is a starting pin choice,
  not a separate personality or restricted runtime. Normal Connect operations
  clear transient state and the sensing eye, with generation checks rejecting
  late image loads and mirror captures. Start Eric remains a separate resume
  path with a reset caveat documented in the operator guide.
- **More honest runtime context.** Prompts identify environment values as
  assembly-time snapshots. Recording preferences, browser Cast tracking, and
  attached tools are not presented as proof of recording or device availability.
  Missing-note errors now identify the requested file.
- **Brain2 freshness and privacy.** Timestamped, attributed evidence and change
  checks limit repeated analysis of unchanged material. Invalid structured B2
  output is not used as a speech fallback. A literal advisory-marker guard
  suppresses leaked marked text before TTS; unmarked paraphrases remain a risk.
- **Experimental idle headline reading.** STS can fetch dated BBC RSS snippets
  after two quiet real minutes and give B2 a bounded selection task. Selected
  stories become optional private interests for Eric. Ten-minute retry limits
  are not accelerated by the lab clock. Useful topic drift still needs live
  evaluation; fetching a story is not evidence of reading its full article.
- **Operator controls and diagnostics.** Browser Face's controller choice is
  remembered, and a compact popup can be opened or reused on Connect. Browser
  popup restrictions still apply; Eric's embodiment tool does not open windows.
  Optional `-CaptureLlmWire` records actual model requests locally for inspection.

## Priorities Before More Context Machinery

1. **Preserve the conversation scaffold on tool follow-ups.** The latest PM and
   source inspection identify short follow-up instructions replacing the main
   system instruction slot for that response. Hot conversation remains, but
   creature, runtime, and note context can be absent from that slot until the
   next ordinary turn. Confirm with an opt-in wire capture and repair the merge
   contract before adding more context machinery. The restrictive one-sentence
   response defaults also deserve a separate review against requests for detail.
   Neither issue is claimed fixed by the prompt cleanup above.
2. **Preserve dependency references through captioning and archiving.** Session
   parents and pins are literal filenames. The archive API moves a file without
   updating references, and caption changes can do the same. A descendant can
   consequently lose an expected dependency; saving a live child can fail if its
   named parent moved. Add an explicit reference-preserving operation and test
   it with existing descendants and a browser still holding the old name.
3. **Report actual context inclusion and preserve pin intent.** The page retains
   at most eight notes on manual reads, while session restore can load more.
   Prompt caps can clip or omit pinned content: 4,500 characters per ordinary
   note, 64,000 for transcript views, 64,000 across the loaded-note block, and a
   smaller idle budget. Produce per-file inclusion receipts from the actual
   assembly code. Keep form selection independent of budgeting; source-linked
   variants now work, while a policy for choosing among them does not yet exist.
4. **Test the long-session handoff.** Disk notes are limited to 200,000
   characters. Graceful save failure is visible, but long-run saving, recorder
   rollover, pending speech at disconnect, and repeated reconnects need live
   trials. Capture a fixed exit boundary and account for work still in flight.
   Preserve Halt's deliberate immediate-stop behavior.
5. **Diagnose long-idle STT fatigue.** An earlier overnight PM reports poor
   transcription late in the run; it does not establish a root cause. Compare
   microphone frames, VAD, accepted STT events, playback/interrupt state, and a
   deliberate Fresh Ears recovery under the same conditions.
6. **Keep operational evidence distinct from interpretation.** Brain2 now receives
   attributed conversation, selected runtime fields, and recent search receipts,
   not a complete structured action-receipt stream.
   Runtime-authored confirmations and supplied PM interpretations need attribution.
   Repeated behavioral comparisons, rather than self-report alone, should decide
   whether a candidate lesson is promoted. Preserve dependency versions for A/Bs.

The file-based dependency graph is a useful control surface already. Source-file
identity checks for manually authored variants are implemented. Automatic
semantic summary validation, recursive loading, timed salience decay, learned
authority weights, and direct model control over KV state are not implemented.

## Maintenance Boundaries

- STS remains a large single HTML file. Extract lifecycle and context
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
  bundles may include more than their written summary. Wire captures preserve
  message text, including personal context; omitted inline media is not text
  redaction. The root prompt-inspection exports remain local and ignored.

## Repeatable Checks

Run from the repository root with the project development environment installed:

```powershell
$testRoot = Join-Path $PWD ('.tmp/pytest-' + [guid]::NewGuid().ToString('N'))
.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --basetemp $testRoot
.\.venv\Scripts\python.exe -m ruff check src tests scripts firmware
.\.venv\Scripts\python.exe scripts/generate_face_contract.py --check
$nodeTests = Get-ChildItem tests -Filter '*.test.cjs' | Select-Object -ExpandProperty FullName
node --test --test-concurrency=1 @nodeTests
powershell -NoProfile -File tests/sts_launch.test.ps1
powershell -NoProfile -File tests/sts_stop.test.ps1
git diff --check
```

The browser-source suite uses isolated fixtures. The docs suite checks Markdown
rendering and local source/catalog links. Launcher tests inspect forwarding
without launching a model; shutdown tests use fake processes.
These checks do not operate hardware or prove microphone/camera operation on a
second device. Builds and media publication still need their appropriate review.

September 10 commit review: 254 Python tests and 157 Node tests passed; Ruff,
face-contract generation checks, and the launcher/shutdown fixtures passed.
Both new dual-eye default firmware targets built successfully without flashing.
The Python suite reported one upstream Starlette/httpx deprecation warning.

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

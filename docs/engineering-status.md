# Engineering Status

Reviewed September 12, 2026. This is the maintained engineering view; session
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

## September 12 Checkpoint

Stable prompt ordering now puts shared instructions and saved context before
the replaceable embodiment manual; live runtime changes append at turn
boundaries. Tool follow-ups preserve the conversation scaffold instead of
replacing the system prompt. Recent short performance runs sustained roughly
1.4-1.6 second median first-speech latency after startup at about 30-31% context.
Those are local observations, not a general benchmark; first replies still took
about twelve seconds, and no cache-hit rate was measured in those runs.

Auto history currently loads source-checked swept sessions, not older summaries.
The configurable recent-swept/older-summary policy exists, but
`context_history.use_summaries` is false while summary quality is evaluated.
Source manifests determine membership; derivatives do not introduce new pins.
Generated forms and titles are prepared after sessions and remain inspectable.
Long transcripts have a separate chunked-summary lab; queued model swapping is
still a proposal, not an active scheduler feature.

Other accumulated changes include local-time session dates, matching lineage
colors in the list and tree, previewed branch archiving with shared-asset
protection, a lightweight CTX meter and opt-in LLM overview, conversation-detail
filtering, and a graph-only Browser Face nerve display. Cast's sender label is
Eric Robot-790. Ordinary note-writing requests now prefer authored notes.

Recorded performances can be lively without special UI Performance mode, but
resumed history can also encourage verbatim openings and endings. Rehearsal
feedback and curated performance notes are the next experiment, not a trained
weight update or a newly imposed anti-repetition rule. Routine captures remain
private; the published recordings are still explicitly curated selections.

## September 12 Session Navigation

STS now exposes `list_session_map` and `enter_session` with the note/file tools.
The catalogue is paginated metadata from the same active session inventory as
the UI. Navigation resolves an exact unique title or filename, preflights the
source, and queues the existing save/disconnect/Connect Selected lifecycle at
the response boundary after playback drains. Failed saves never advance to the
destination. New user activity, cancellation, or a changed connection invalidates
pending work. The mic's prior running/muted state is restored on arrival.

This adds intentional tool descriptions and receipt instructions, not personality
rules or a continuously injected map. It does not add fuzzy semantic routing,
archive recovery, a new context-loading policy, or automatic movement during
idle. Root prompt snapshots remain unchanged and now also predate these tools.
See the [operator instructions](sts-ui-guide.md#ask-eric-to-enter-a-session).

Twelve focused navigation tests and the complete Node suite pass (331 tests).
Validation covers catalogue bounds, ambiguous names, preflight/save/connect
failure, stale/canceled requests, speech drain, mic restoration, and dispatch at
the tool-response boundary. Live spoken navigation has not yet been exercised;
no user session was changed for testing. Reload the STS page while disconnected;
no backend restart is required.

## September 12 Authored Notes Default

Spoken requests to save ideas or summarize a discussion now instruct Eric to
compose focused note content. Raw transcript/log capture remains an explicit
source option; missing content and a missing/unknown source fail without writing,
rather than silently dumping the conversation. The old keyword-excerpt
`note_summary` path was removed. Automatic continuity, Save Latest, and
post-session preparation are unchanged.

This is an intentional tool-description and note-instruction change, not a
personality change. Existing root prompt exports have not been refreshed and
their file-writing instructions now predate this change. Reload the STS page
before the next connection to use the new browser tool instructions.

The Gulu Gulu run's consent-gate rejection, speech-only read-to-write follow-up,
clipped TTS, and final greeting loop are not fixed by this default change.
The local PM is `logs/runs/20260912-110122-gulu-performance-file-breakdown/`.
The focused note tests plus the complete Node suite pass (319 tests); live
Eric-authored note generation has not yet been retested.

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

## Remaining Priorities

1. **Complete requested work across tool boundaries.** The context-scaffold fix
   does not solve every search-to-drawing or read-to-writing sequence. Most tool
   follow-ups still disallow another tool call; image recall has a bounded
   continuation. The experiment in [Shared Activity And Task Continuation](task-continuation-experiment.md)
   is documented, not implemented. Explicit offer-and-assent file-write consent
   and speech cutoffs around failed tool attempts remain open.
2. **Evaluate engagement and cancellation over long runs.** The attention ramp,
   stale-result guards, and interruptible provider I/O are implemented. They do
   not establish that every pause stays socially engaged or every long-idle
   return is fast. Compare VAD, accepted speech, pending work, and playback;
   preserve intentional immediate-stop behavior.
3. **Improve summaries without losing useful material.** Source hashes and
   speaker citations validate structure and provenance, not semantic accuracy.
   Summaries can omit good endings or mishandle attribution. Sweeps remain the
   default; chunking, more thinking, and model comparisons are experiments.
4. **Preserve dependency intent and explain inclusion.** Display titles no longer
   require source renames. Branch archiving previews descendants and protects
   shared assets, but literal references are not globally rewritten. A session
   whose ancestor was archived may load with a missing-reference warning, and
   a live child can still hold an obsolete save-parent path. Source/form receipts
   exist; exact per-file token inclusion after prompt clipping remains incomplete.
5. **Exercise new transitions live.** Spoken session navigation is implemented
   and fixture-tested, not yet validated in a live conversation. Test successful
   arrival, microphone restoration, cancellation, and failure recovery. Long
   saves, recording rollover, multiple controllers, and physical embodiments
   still need their own operational trials.
6. **Separate evidence from interpretation.** B2 receives attributed dialogue,
   selected runtime fields, and search receipts, not a complete event stream.
   Preserve imagination as imagination and observations as observations. Use
   explicit rehearsal feedback to investigate performance variety rather than
   imposing a blanket repetition ban.

Source-linked variants, automatic preparation, configurable history selection,
and bounded navigation are implemented. General recursive dependency recovery,
learned memory weighting, automatic live summarization, model swapping for
background jobs, and direct model control over server KV state are not.

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

September 12 commit review: 499 Python tests and 331 Node tests passed; Ruff,
face-contract generation checks, docs/catalog checks, and launcher/shutdown
fixtures passed. The public catalogue was regenerated. The Python suite reported
one upstream Starlette/httpx deprecation warning. No hardware was moved or flashed,
and no user session was switched during this review. The last dual-eye firmware
build check remains the successful September 10 build, not a new hardware test.

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

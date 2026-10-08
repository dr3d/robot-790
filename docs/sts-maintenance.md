# Maintaining STS across Windows and Docker

The Windows `robot-790` repo is the authoring source for portable STS behavior.
The Docker repo owns packaging, the speech supervisor, Linux/GPU provisioning,
provider selection, and deployment. Neither repo imports the other's checkout
at runtime. A container download remains self-contained.

## Shared core introduced with bounded transcription

- `src/robot_790d/bounded_stt.py`
- `tests/test_bounded_stt.py`
- This document

Run `python scripts/sync_sts_core.py <docker-repo> --check` to verify the source,
consumer copies, and recorded SHA-256 hashes. Run with `--apply` to export a
reviewed change. The exporter checks every destination before writing anything
and refuses to overwrite consumer edits since the previous export. It never
copies `.env`, models, notes, logs, UI files, or the entire realtime entry point.
The consumer receipt is `provenance/shared-sts.json`; `upstream/` stays immutable.

The small startup hook in each `realtime_entry.py` calls `apply_bounded_stt_patch`
BEFORE the voice-shape wrapper. Both hooks and bounded voice-shape input are
checked by the exporter. Platform-specific entry-point differences stay local.

## Change and release procedure

1. Implement portable changes once in the shared module and add behavior tests.
2. Run the tests locally against the pinned speech dependency. Test long speech,
   reopened turns, final-only transcription, cancellation, session reset, busy
   compute, and actual audio replacement. Run related realtime-entry tests.
3. Export with the script, inspect the Docker diff, and run the same tests against
   the container's installed speech dependency. Check parity before building.
4. Build a new speech image tag; leave the previous tag available for rollback.
   Deploy only while no session is connected. Verify the loaded module hash and
   health after startup. Record deployment evidence without secrets.
5. Keep adapter changes separate from portable changes in review/commits. No
   branch or PR is required for this workflow. Commit/push only when requested.

Windows currently uses speech-to-speech 0.2.12 / nano-parakeet 0.2.1; Docker uses
0.2.12+robot790torch1 / nano-parakeet 0.2.1. The Docker wheel's local suffix changes
Torch dependency metadata, not its Python implementation. Update dependencies
as an explicit shared-core change with compatibility tests, not an incidental
image rebuild. Existing unrelated Windows startup patches are not suddenly
claimed to be synchronized. Move them into the shared core incrementally when
they are next changed and tested on both platforms. A separately versioned
wheel from this core is the eventual distribution boundary; avoid a third repo
until it is large enough to justify its own releases.

## Bounded listening behavior

The nano-parakeet decoder receives at most 15 seconds: a 14-second core with up
to half a second of acoustic context on each side. Word timestamps assign words
to cores without requiring sentence punctuation. Completed text and PCM hashes
are retained across revisions and finals of the same turn. Changed audio
invalidates cached windows; a new turn or session clears them. Raw audio/GPU
tensors are not retained in the transcription cache. Missing word alignment
falls back to bounded nonoverlapping cores, with a logged warning; recognition
near such boundaries may be less accurate.

Compute is released between calls. Stale input, stop, and lock availability are
checked before each decode. Existing final/stale-output gates remain in place.
No chunk creates a new VAD event, LLM turn, or instruction to remain silent.
The active tail can change as recognition receives more context.

This does not establish the cause of the October 8 Windows hypervisor bugcheck
or guarantee protection against OS/driver faults. It addresses the measured
STT workload explosion. VAD's raw audio prefixes still grow with an open turn;
audio-buffer compaction with explicit acknowledged offsets is a separate future
change. Transcript growth and LLM context pressure also remain real limits.

Timing logs include `Bounded STT`, calls, max_decode, inference, max_lock, total,
and status. The existing final-STT timing record remains available to the UI.

# Native Windows STS reference

As of October 9, 2026, new Eric development lives in the sibling
`robot-790-docker` repository. Its `work/` tree is authoritative. This Windows
checkout remains the native installation/reference and rollback.

The former shared-core export workflow is retired for that destination.
`scripts/sync_sts_core.py` refuses to write to a repository whose
`provenance/canonical-source.json` marks it authoritative. Do not bypass that
check or rebuild Docker work/ from its historical upstream/ snapshot.

Docker's README, AGENTS.md and docs/sts-maintenance.md are the current maintenance
instructions. Its provenance/reconciliation.json records the functional Windows
cutoff; docs/prompt-parity.md records existing instruction differences. No new
personality or tool-manual edits were made by the handoff. Personal state remains
separate. Neither running installation was redeployed by this source transition.

The listening behavior below documents the retained Windows implementation.

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

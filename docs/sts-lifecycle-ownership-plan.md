# STS Lifecycle Ownership

September 20, 2026. Starting baseline: `2472bbd`, published on `master`.

## Aim

Reduce the risk that fixing one transition breaks another. The problem is not
the page's byte count: multiple callbacks share ownership of session validity,
speech, tools and scheduling. Moving functions into files without settling that
ownership would preserve the problem.

Eric and B2 keep choosing meaning, initiative and content. STS owns execution,
permissions, receipts, persistence and exclusive access to public speech.
This work must not introduce English intent classifiers, prescribed dialogue,
shorter answers, new quiet periods or a setup-card requirement.

## Current Ownership Map

Functions below are in `web/sts/index.html` unless a module is named. These are
current responsibilities, not a claim that they already form isolated modules.

| Responsibility | Current entry points / state | Boundary risk |
| --- | --- | --- |
| Connection identity | `activeRealtimeSession`, `send`, `realtimeSessionGeneration`, `ws`, `realtimeStopRequested` | An awaited operation retains an old socket or generation. A stop is not the same as a new connection. |
| Stop, save, reconnect | `quiesceRealtimeForSave`, `haltRealtimeActivity`, `disconnectRealtime`, `resetSessionContextForConnection`, `clearHotConversationState` | Cleanup is spread across functions; final transcription must survive stop, but new speech and effects must not. Failed saving must block destructive reset. |
| Response dispatch | `handleEvent`, `responseActive`, `suppressedResponseIds` | Provider response completion is not audible completion. Canceled responses and old events must not revive work. |
| Tool batch and continuation | `handleFunctionCall`, `maybeCreateToolFollowup`, pending count, done flag, drain timer, user activity timestamp, round budget | Results and response completion arrive in either order. Receipts may survive an interruption while automatic continuation must not. |
| Audible output | `playPcm16Bytes`, `flushAudioQueue`, `outputAudioActive`, `stopPlaybackNow`, playback generation, pending setups, active sources, audio clock | Audio setup is asynchronous; scheduled audio can outlive inference. Wall-clock time cannot prove playback has finished. |
| Turn completion | `armAssistantUtteranceFinished`, `checkAssistantUtteranceFinished`, `noteConversationActivity` | Idle/reengagement can start too early if generation completion is mistaken for speech completion. |
| Generated-image presentation | `generateImage`, `showGeneratedImage`, `moveGeneratedImageToSensingEye`, preview/eye generations | Artifact creation, preview display and eye staging are separate successes. A retained image must remain retrievable without another render. |
| Idle art | `idle-art.js`, browser grant and staging callbacks | Existing single-owner controller must not acquire a competing owner during extraction. Permission, job completion and staging have different lifetimes. |
| Idle/B2 opportunities | `brain2BlockedReason`, idle/reengagement scheduling, B2 advisory and speech queues | Private advice and public speech have different readiness conditions. Fixing ownership must not suppress useful parallel thought or proactive conversation. |

## Invariants To Preserve

1. Only the current connection can dispatch new model work or public effects.
2. Stopping can still accept the final in-flight user transcript for saving.
3. A failed save cannot silently become a fresh session and erase unsaved text.
4. A late tool from an old connection cannot decrement the new connection's
   pending count, mutate its eye or release its continuation.
5. A new user turn can invalidate old presentation/automatic continuation without
   discarding a successfully created artifact or its receipt in the same session.
6. Tool continuation requires both completed tool work and response completion,
   then an actually drained audio path. Duplicate completions do not double-send.
7. Pending audio setup, queued bytes and scheduled sources all count as busy.
   Stop invalidates pending setup as well as stopping existing sources.
8. Tools remain model-selected. Execution checks, bounded continuations and
   unknown-paid-outcome protection are not conversation scripts.

## Groundwork Implemented

`tests/sts_lifecycle_replay.test.cjs` composes the production event dispatcher,
session guards/reset, tool handoff, image generation/retrieval and audio functions
inside one deterministic fixture. Existing tool and image fixtures are shared
under `tests/helpers/` instead of duplicated. Seven replay tests cover:

- Generation interrupted by user activity, retained receipt, exact retrieval,
  actual speech drain, then reconnect cleanup.
- Tool completion before/after response completion, including duplicate done.
- Old socket/tool completion while new connection work is pending.
- Canceled response with a late successful artifact.
- Stopped-session final transcription while late audio/tool events are ignored.
- Failed-save reset refusal.
- Pending audio setup and an already-captured timer callback after reconnect.

These are composed mechanism tests, not complete browser-session simulations.
Network responses, DOM/image decoding, audio hardware, eye saving, idle-art
permission checks, B2 scheduling and durable conversation saving are mocked.
Reconnect invokes the real reset/guards, but not the full Connect/Disconnect UI
or save pipeline. No live model, paid image service or device is invoked.
Function extraction follows existing tests and depends on page formatting; a
future module should be tested through its exports instead.

## First Production Extraction: Audio Playback Owner

Recommended next implementation, **not performed in this checkpoint**:

1. Move playback queue, source scheduling, pending setup tokens, playback
   generation and stop/drain checks into one small module. Preserve sample rate,
   chunking, gain, recording destination and scheduling offsets exactly.
2. Keep existing page entry points as adapters initially. Inject browser audio
   setup and recording/mouth callbacks; do not duplicate audio state in page and
   module. The playback owner reports busy/drained, not what Eric should say.
3. Run current audio tests and these composed replays against that implementation.
   Add a browser-backed audio-clock check before treating the extraction as done.
4. Accept live long speech, user interruption, tool follow-up, disconnect during
   speech and reconnect before moving another ownership boundary.

Do not simultaneously move prompts, B2 reasoning, persistence or idle policy.
The following candidate is the tool-continuation owner, but its session/audio
contracts need to be stable first. A wholesale backend migration is not required.

## Still Missing

- Full stop/save/reconnect and failed-save retry replay with the actual durable
  save pipeline, including final transcription and session-map transitions.
- B2 advisory revision/freshness, private-to-public delivery and idle arbitration
  in the composed replay, including normal and accelerated idle.
- Page unload, suspended browser audio, real socket closure and recording teardown
  in a browser-backed transition suite. Existing isolated audio tests cover
  suspended audio but do not replace browser acceptance.
- Clearer retained-artifact preview behavior; current exact retrieval into the
  eye is functional but can leave the Imagined Image preview empty.

The first replay batch found no new production defect. It does not establish that
these untested boundaries are sound. No runtime, prompt, cooldown, permission,
context assembly or model setting changed in this groundwork.

## Release Gate

Keep each extraction in a separate commit. Compare a fresh card-free session and
a rich resumed thread using the same model/settings: long answers, search/draw/
show, interruption, idle/B2 initiative and return from an absence. Revert only
the extraction if it changes delivery or liveliness unexpectedly; do not disguise
a lifecycle regression with a new behavioral prompt or silence rule.

See [Engineering Status](engineering-status.md) and the broader
[Stabilization Plan](stabilization-plan-2026-09-19.md) for work outside this boundary.

# One Local Model For Eric

STS local model selection is shared by B1, B2, deliberate thinking and session
preparation. Background workers must not reload a previous model after a switch.

The realtime launcher publishes the model identifier and endpoint atomically to
`logs/active-llm.json`. The restart launcher also publishes before unloading and
loading models. The page server reads this selection for each new background
request; no page-server restart is required on subsequent model changes.

For local endpoints, the active selection takes priority over lane-specific
model environment variables and stale model identifiers from the browser.
Remote endpoints retain their explicit configuration. If the selected brain is
remote, local background calls fail rather than implicitly loading the old local
model. Missing selection preserves legacy defaults for standalone callers;
invalid selection fails closed.

Disconnect and allow pending session preparation to finish before switching.
Selection changes do not cancel requests already in flight. The restart path
unloads all LM Studio models and checks unload/load exit codes before starting
the realtime worker. A failed load must not silently launch the wrong brain.

Parallel slots are concurrent requests sharing one loaded model, not separate
models. Qwen TTS, STT and other GPU workloads still require their own memory.

The standalone summary laboratory's explicit `--model` option remains independent;
it is an experiment runner, not an automatically scheduled STS worker.

Verification: `tests/test_runtime_model.py` covers refreshed selection, invalid
state, remote isolation, and actual B2/deliberate request payloads plus summary
model selection. These tests use mocked inference, not live generations.

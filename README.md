# Robot 790

Robot 790 is a daemon-driven animatronic robot head/body project inspired by the
LEXX 790 character. It starts from the working ESP32 face, chassis, and camera
experiments in the Reachy Mini conversation app, but this repository is meant
to become its own platform rather than a Reachy Mini enhancement branch.

The guiding split is:

```text
conversation clients / local voice / Jetson brain
        |
      robot-790d
        |
  device adapters
        |
ESP32 face, chassis, camera, servos, audio
```

`robot-790d` should own behavior timing: mood, gaze, mouth energy, idle beats,
sleep/wake state, and eventual prosody mapping. Clients should send semantic
intent instead of micromanaging displays or motors.

## Current Contents

- `firmware/esp32-face`: four-display ESP32-S3 face firmware ported from the
  Reachy Mini conversation app. It currently supports two eyes, rectangular
  mouth on GPIO18, and round status display on GPIO17.
- `firmware/esp32-chassis`: ESP32 tracked chassis firmware.
- `firmware/esp32-cam`: ESP32 camera firmware.
- `src/robot_790d`: first-pass daemon/client package for semantic face cues.
- `src/robot_790_tts`: local OpenAI-compatible Qwen3-TTS speech endpoint.

The copied firmware still contains some Reachy-oriented names internally. That
is intentional for the first move: preserve the stable working hardware before
renaming and generalizing.

## First Bring-Up

Create an environment:

```powershell
cd D:\_PROJECTS\robot-790
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .[dev]
```

Point the daemon client at the ESP32 face:

```powershell
$env:ROBOT_790_FACE_URL = "http://esp32-eyes.local/"
robot-790d state
robot-790d listen
robot-790d speak --energy 0.7
robot-790d beat mischief
robot-790d idle
```

Build the face firmware:

```powershell
cd firmware\esp32-face
pio run
pio run -t upload --upload-port COM27
```

## Local Speech

Robot 790 includes a local Qwen3-TTS endpoint so the project can speak without
depending on Hugging Face Spaces, Pollen services, or the Reachy Mini app.

Install the speech server dependencies:

```powershell
pip install -e .[tts]
```

Run a mock endpoint first:

```powershell
.\scripts\start_qwen3_tts.ps1 -Mock
```

Then check it:

```powershell
curl http://127.0.0.1:8000/health
curl -X POST http://127.0.0.1:8000/v1/audio/speech `
  -H "Content-Type: application/json" `
  -o samples\speech.wav `
  -d '{"input":"Robot 790 is online.","voice":"Eric","response_format":"wav"}'
```

For real synthesis, install a CUDA-capable PyTorch environment plus `qwen-tts`,
then start without `-Mock`:

```powershell
.\scripts\start_qwen3_tts.ps1 -Voice Eric -HostAddress 127.0.0.1 -Port 8000
```

The endpoint is intentionally OpenAI-shaped:

- `GET /health`
- `GET /v1/voices`
- `GET /v1/models`
- `POST /v1/audio/speech`

Settings can be provided with environment variables; see
`qwen3_tts.example.env`.

## Realtime Voice

The target shape is close to Hugging Face's realtime voice demo: microphone
audio enters a realtime server, VAD finds speech turns, STT creates text, an
LLM decides what to say, TTS streams audio back, and tool calls can actuate the
robot face.

Install the optional realtime stack:

```powershell
.\.venv\Scripts\python.exe -m pip install -e .[realtime]
```

Start a `/v1/realtime` server for browser clients:

```powershell
.\scripts\start_realtime_server.ps1
```

That exposes the default endpoint at:

```text
ws://127.0.0.1:8765/v1/realtime
```

The launcher defaults to four realtime session pipelines and sends TTS one
sentence batch at a time. For smoother but slightly slower speech, raise the
batch size:

```powershell
.\scripts\start_realtime_server.ps1 -StreamBatchSentences 2
```

For the packaged all-local microphone/speaker loop, attach Robot 790's face
tool module:

```powershell
.\scripts\start_realtime_local.ps1 -FaceUrl "http://esp32-eyes.local/"
```

The tool module is `robot_790d.realtime_tools`. It currently exposes:

- `set_robot_mode`: maps voice turn states to `idle`, `listening`, `thinking`,
  `speaking`, or `sleeping`.
- `play_face_beat`: lets an agent trigger a named firmware beat.

For a fully local LLM, run an OpenAI-compatible server such as llama.cpp or
vLLM, then pass backend arguments through `-ExtraArgs`:

```powershell
.\scripts\start_realtime_server.ps1 -ExtraArgs @(
  "--llm_backend", "responses-api",
  "--responses_api_base_url", "http://127.0.0.1:8080/v1",
  "--responses_api_api_key", "",
  "--model_name", "local"
)
```

The same `-ExtraArgs` pattern works for `start_realtime_local.ps1`.

For the Windows RTX 5090 bring-up path, use Eric through Qwen3-TTS directly in
the realtime server:

```powershell
.\scripts\start_realtime_eric_qwen3.ps1
```

That launcher uses one realtime pipeline by default, the
local
`C:\Users\dr3d\ComfyUI_windows_portable\ComfyUI\models\TTS\Qwen3-TTS-12Hz-0.6B-CustomVoice`
model, the CUDA `torch` backend, and the `Eric` speaker. Increase
`-NumPipelines` only after checking VRAM and latency.

To try the larger local CustomVoice model:

```powershell
.\scripts\start_realtime_eric_qwen3.ps1 -TtsModel "C:\Users\dr3d\ComfyUI_windows_portable\ComfyUI\models\TTS\Qwen3-TTS-12Hz-1.7B-CustomVoice"
```

## Behavior Model

The first daemon layer speaks in coarse robot states:

- `idle`: release the face back to firmware autonomy.
- `listening`: curious eyes, neutral non-talking mouth.
- `thinking`: thoughtful/focused visual cue.
- `speaking`: happy eyes, talking mouth, configurable energy.
- `sleeping`: sleep/blank face.

This mirrors the useful parts of the Reachy app but removes the Reachy SDK from
the center. The next layer should add an affect vector:

```json
{
  "energy": 0.7,
  "valence": 0.3,
  "attention": 0.9,
  "certainty": 0.6,
  "mischief": 0.4
}
```

That affect vector can eventually be driven by transcript content, turn-taking,
audio RMS, pitch movement, speaking rate, pauses, and camera/person tracking.

## Hardware Direction

The face shell is being designed around a 790-like printed mask with display
openings for eyes and mouth. The current electronics vocabulary is:

- ESP32-S3 face controller
- round GC9A01 eye displays
- rectangular ILI9341 mouth display
- optional round status/debug display
- optional ESP32 chassis and camera controllers

Longer term, a Jetson Nano or similar host can run local voice, vision, and the
behavior daemon while ESP32 boards remain dedicated device controllers.

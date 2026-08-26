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
pio device list
pio run -t upload --upload-port COM8
```

Use the COM port reported for your ESP32-S3; `COM8` is the current board on
this workstation.

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
mkdir samples
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
- `set_face_mood`: sets a named ESP32 face mood for a short visual hold.
- `set_eye_style`: changes the ESP32 eye renderer style, such as `robot`,
  `friendly`, `classic`, `cartoony`, `sinister`, or `sleepy`.
- `set_eye_gaze`: aims the eyes at a normalized left/right and up/down gaze
  target when the user explicitly asks Robot 790 to look somewhere.
- `set_mouth`: changes the ESP32 mouth style, shape, talking state, energy, or
  releases the mouth back to autonomous control.
- `set_chassis`: sends one status, stop, e-stop, clear, tank, or twist command
  to the ESP32 chassis controller.
- `remember_fact`: saves or updates one persistent named fact.
- `forget_fact`: removes one persistent named fact by name.
- `search_web`: searches the web and returns compact title/snippet/URL results.
- `show_web_page`: opens or displays an HTTP(S) web page in the client UI.
- `cast_media`: lists Cast receivers, searches YouTube, plays a YouTube result
  or video ID/URL, shows direct image URLs, and stops playback on the configured
  Cast receiver.
- `write_text_file`: writes or appends a plain text note under `notes/`.
- `read_text_file`: reads a `.txt` or explicitly named `.md` note.
- `list_text_files`: lists available Robot 790 note files.

The browser STS page sends a compact Robot 790/Eric identity instruction with
`session.update` when it connects. Its deterministic lifecycle drives the face
by default: user speech cues listening, transcription/LLM work cues thinking,
audio output cues speaking, and response completion releases the face to idle.
Listening uses a focused centered gaze, thinking alternates a small side glance,
and speaking drives the mouth/talking state.
The `Idle drift` slider is off at `0`. Higher values let the page create an
occasional one-sentence autonomous ponder after a quiet period, using recent
conversation and saved facts as light context while disabling tools for that
turn. Level `11` is a deliberately overactive mode: it schedules ponders every
10-45 seconds when the system is otherwise idle and lets Robot 790 sound a bit
more expressive. Idle ponders rotate through deterministic lanes such as object
noticing, callback, status, self-question, addressed question, craft, curiosity,
and aside so they do not always use the same fact/contrast/uncertainty shape.
The addressed-question lane appears at level `9` and above: Robot 790 may ask
Scott one small question into the room and then keep pondering later if no
answer arrives. At levels `10` and `11`,
the curiosity lane may perform one rate-limited web search when `LLM web search`
is enabled and fold a compact outside detail into the next idle thought. If the
page detects repeated "I'm out / same loop / nothing new" style outputs, it
puts idle pondering into a short cooldown instead of letting the loop narrate
its own exhaustion forever. The `Ponder` button triggers the same path manually
for testing.
The `Voice style` control sends a `qwen3_tts_instruct` runtime hint to Qwen3-TTS
and stores the current style in browser `localStorage` under
`robot790.ttsStyle.v1`. Presets include neutral, dry Eric, happy, ominous,
troll-ish, sleepy, and excited. CustomVoice models still anchor to the selected
speaker, so this should be treated as performance direction rather than a hard
guarantee of a totally different voice.
The optional `LLM face tools` checkbox exposes `set_robot_mode`,
`set_face_mood`, `play_face_beat`, `set_eye_style`, `set_eye_gaze`, and
`set_mouth` to the model. It is enabled by default so voice requests like
"look all the way left", "use robot eyes", or "make the mouth smile" can
actuate the face. Face tool calls are executed in the page by posting to the
configured ESP32 face URL, which defaults to `http://esp32-eyes.local/`.

The optional `LLM chassis tools` checkbox exposes `set_chassis`. Chassis tool
calls target `http://esp32-chassis.local/` and are limited to one explicit
command at a time: status, stop, e-stop, clear, tank, or twist. Voice movement
should stay slow, short, and firmware-timed; "full speed" and "max speed" map
to the same normalized `1.0` value as the chassis web UI, and the firmware
applies the voltage duty cap. The tool contract forbids queued routes or
multi-step routines.

The optional `LLM web search` checkbox exposes `search_web`. This was adapted
from the Reachy Mini conversation app's search-tool contract, but runs locally
through the Robot 790 STS page at `/api/search`. The implementation uses the
`ddgs` package and returns title, snippet, and URL results. It is useful for
current facts, newsy questions, and quick lookups; it is still an internet
tool, so it depends on network availability and upstream search behavior.

The optional `LLM web pages` checkbox exposes `show_web_page`, ported from the
Reachy Mini conversation app. In the standalone STS page this opens an HTTP(S)
URL in a new browser tab/window from the Robot 790 UI. If the browser blocks
automatic tabs, the events log records the target URL. This pairs naturally
with `search_web`: Robot 790 can search first, then open a selected result when
asked to bring up the page.

The optional `LLM cast media` checkbox exposes `cast_media`, ported from the
Reachy Mini conversation app. Browser STS calls run through the local page
server at `/api/cast`; daemon calls use `robot_790d.media_cast` directly. The
tool can list receivers, search YouTube, play the first YouTube result for a
query, play a YouTube video ID or URL, show a direct `jpg`/`jpeg`/`png`/`webp`/
`gif` image URL, and stop playback. Configure the default target with:

```powershell
$env:ROBOT_790_CAST_DEVICE_NAME = "Living Room TV"
$env:ROBOT_790_CAST_TIMEOUT_S = "10"
$env:ROBOT_790_CAST_KNOWN_HOSTS = "192.168.0.45"
```

`ROBOT_790_CAST_KNOWN_HOSTS` is optional, but useful when mDNS discovery misses
the receiver. Generic web pages and image-search result pages will not cast
through this path; the TV needs a direct media URL it can fetch.
When the browser STS page starts YouTube playback through `cast_media`, it
auto-pauses an active mic to avoid transcribing TV audio as user speech. If
Robot 790 later stops that Cast playback through the same tool, the page
restores the mic only if it was the thing that paused it.

The browser STS page also coalesces near-duplicate final STT transcripts in its
visible conversation and local grounding buffer, so speculative endpointing
fragments do not become repeated user lines. Sensing-eye prompts are framed as
visual impressions: Robot 790 should separate what is visible from guesses and
ask before relying on uncertain vision for action.

The `LLM memory tools` checkbox is enabled by default on the STS page. It
exposes `remember_fact` and `forget_fact` so explicit instructions such as
"remember my name as Dave" or "forget user_name" can update persistent named
facts. If Robot 790 asks the user to provide a fact so it can save it, the next
user turn can also be saved. The page refuses inferred placeholder facts such as
"not yet known" and rejects facts that are not grounded in the current save turn.
The current browser STS path stores those facts in browser `localStorage` under
`robot790.memory.v1` and injects them into session instructions on connect,
refresh, and memory updates. The Python daemon path stores the same named-fact
shape in `memory.v1.json`; set `ROBOT_790_MEMORY_PATH` for an exact file path,
or `ROBOT_790_INSTANCE_PATH` for an instance directory.

The optional `LLM note files` checkbox exposes `write_text_file`,
`read_text_file`, and `list_text_files`. This is intentionally simpler than
memory: Robot 790 only touches files when explicitly asked to save, write,
append, read, or list a note. Files live under the local `notes/` folder by
default, missing extensions become `.txt`, and only `.txt` or explicitly named
`.md` files are allowed. Set `ROBOT_790_NOTES_PATH` to move the notes folder.
This gives future summarizer/reflection jobs a safe storage layer to reuse
without changing the voice UI contract.

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

The current gold personality preset is the 27B/Eric tuning that felt fast,
present, and characterful during live testing:

```powershell
.\scripts\start_realtime_gold.ps1
```

It pins `qwen/qwen3.8-27b`, reasoning `low`, one realtime pipeline, one-sentence
TTS batching, `64` audio tokens, the `Eric` speaker, and the dry Eric voice
style. The matching snapshot lives at:

```text
presets\robot-790-gold.json
```

That launcher uses one realtime session pipeline by default, the
local
`C:\Users\dr3d\ComfyUI_windows_portable\ComfyUI\models\TTS\Qwen3-TTS-12Hz-0.6B-CustomVoice`
model, the CUDA `torch` backend, the `Eric` speaker, and the local
`qwen/qwen3.8-27b` LLM through LM Studio's Chat Completions endpoint. Reasoning
uses `reasoning_effort=low`, and spoken LLM output is capped at 64
tokens by default to keep turns responsive without forcing clipped answers.
Use `-NumPipelines 2` only when you want two simultaneous clients; increase
above that only after checking VRAM and latency.
The launcher sets a dry Eric TTS instruction by default. Override it at launch
with:

```powershell
.\scripts\start_realtime_eric_qwen3.ps1 -TtsInstruct "Speak as Eric with a low raspy texture, mischievous theatrical energy, and playful menace."
```

The browser page can also change `qwen3_tts_instruct` live for the active
session. This works through the project-owned realtime entrypoint
`robot_790d.realtime_entry`, which applies a small runtime patch to the upstream
`speech-to-speech` Qwen3-TTS handler without editing the installed dependency.

If Ctrl-C does not stop a stuck standalone STS page or realtime backend, stop
both Robot 790 STS processes with:

```powershell
.\scripts\stop_sts.ps1
```

To stop only one side:

```powershell
.\scripts\stop_sts.ps1 -RealtimeOnly
.\scripts\stop_sts.ps1 -PageOnly
```

The launcher reads its system prompt from:

```text
prompts\robot-790-reachy-no-tools.md
```

That prompt is adapted from the Reachy Mini conversation app's default profile
body. It keeps the spoken Robot 790 identity, compact response rules, and sparse
face/memory tool guidance, while leaving Reachy SDK movement instructions out
of this repo's first pass.

To try another local model without editing the script:

```powershell
.\scripts\start_realtime_eric_qwen3.ps1 -LlmModel "qwen/qwen3.5-9b"
```

To temporarily drop back to the small default LM Studio model:

```powershell
.\scripts\start_realtime_eric_qwen3.ps1 -LlmModel "qwen3.5-4b"
```

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

# Robot 790

Robot 790 is a local, daemon-driven animatronic robot project inspired by
LEXX 790. The project combines ESP32 device controllers, a browser STS control
page, local STT/TTS, local LLMs through LM Studio, and a small Python daemon
package for robot tools and storage.

The operating idea is simple:

```text
conversation UI / voice client
        |
   realtime STS server
        |
   robot_790d tools
        |
ESP32 face, chassis, camera, notes, memory, web, media
```

Clients should send semantic intent such as "listening", "thinking", "look
left", "smile", "stop", "read this note", or "search this", while firmware and
tool adapters own timing, GPIO details, display updates, and motor commands.

## Lineage And Contribution

Robot 790 does not claim to invent realtime voice, text-to-speech, speech
recognition, local LLM serving, tool calling, or social robotics from scratch.
It exists because those pieces already became good enough to combine.

The project grew out of experiments with Hugging Face realtime voice work,
Reachy Mini conversation tooling, local Qwen and Qwen3-TTS models, LM Studio,
OpenAI-compatible APIs, ESP32 firmware, browser UIs, and a long history of
robotics, animation, speech, and character-interface research. It stands on a
lot of shoulders.

What Robot 790 adds is the arrangement:

- a local-first speech-to-speech robot loop with a visible face
- semantic tools for face, mouth, gaze, chassis, notes, memory, web, weather,
  media, and image generation
- deterministic lifecycle cues so the body listens, thinks, speaks, and idles
  without waiting for the model to choreograph every frame
- an idle rumination system that can keep thinking from loaded context while
  the user is quiet or away
- a notes/worlds/library structure for giving the robot continuity, reference
  material, and temporary imagined substrates
- public logs, articles, and curated sessions that show the seams instead of
  hiding them

The contribution is not a secret new model. It is a facade in the architectural
sense: an interface, body, timing layer, tool contract, memory practice, and
curation loop around powerful existing systems. The interesting question is how
far character and continuity can emerge from that assembly when the machinery is
kept visible.

## Current Pieces

- `web/sts`: standalone Robot 790 STS page at `http://127.0.0.1:8790/`.
- `src/robot_790d`: Python helpers, local page APIs, realtime entrypoint
  patches, tools, memory, notes, weather, web search, and Cast media support.
- `src/robot_790_tts`: OpenAI-shaped Qwen3-TTS speech endpoint.
- `firmware/esp32-face`: ESP32 face firmware lineage. The active controller is
  still commonly reached at `http://esp32-eyes.local/`.
- `firmware/esp32-chassis`: tracked chassis controller.
- `firmware/esp32-cam`: ESP32 camera controller experiments.
- `presets/robot-790-gold.json`: the current Qwen 27B / Eric voice baseline.

Some names still say `eyes` or `Reachy` in older firmware/UI paths. That is
intentional for now: preserve working hardware behavior first, rename only when
the project settles.

## Design Notes

- [Public Page](docs/index.md): GitHub Pages landing page and article shelf.
- [Embodied Sensor Head](docs/embodied_sensor_head.md): ESP32-S3 face sensors,
  touch, camera, and possible tilt/rotate head direction.
- [Future Directions](docs/future_directions.md): public-safe notes on the
  desk-show idea, singing, associative drift, library files, world substrates,
  vision, and media.

## First Setup

Create and install the project environment:

```powershell
cd D:\_PROJECTS\robot-790
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .[dev]
```

Install the optional realtime voice stack:

```powershell
.\.venv\Scripts\python.exe -m pip install -e .[realtime]
```

Install the optional Qwen3-TTS endpoint stack when using
`src/robot_790_tts` directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -e .[tts]
```

Private runtime settings can live in `.env`. Start from the checked-in example:

```powershell
Copy-Item .env.example .env
notepad .env
```

`start_sts_page.ps1` and `start_realtime_eric_qwen3.ps1` load `.env`
automatically. The real `.env` file is ignored by git.

## Daily STS Startup

The usual all-local STS setup has three moving parts:

1. LM Studio serving an OpenAI-compatible chat endpoint on `127.0.0.1:1234`.
2. Robot 790 realtime STS server on `127.0.0.1:8765`.
3. Robot 790 browser page on `127.0.0.1:8790`.

For the current gold setup, load Qwen 27B in LM Studio with one parallel
prediction:

```powershell
lms unload qwen/qwen3.8-27b
lms load qwen/qwen3.8-27b --parallel 1 --context-length 131072 --gpu max --identifier qwen/qwen3.8-27b -y
```

Start the realtime backend:

```powershell
.\scripts\start_realtime_gold.ps1
```

Start the browser page:

```powershell
.\scripts\start_sts_page.ps1
```

Open:

```text
http://127.0.0.1:8790/
```

The page connects to:

```text
ws://127.0.0.1:8765/v1/realtime
```

If Ctrl-C does not stop a stuck process, use:

```powershell
.\scripts\stop_sts.ps1
```

Or stop one side:

```powershell
.\scripts\stop_sts.ps1 -RealtimeOnly
.\scripts\stop_sts.ps1 -PageOnly
```

## Brain Presets

The STS page Realtime Server panel has a `Brain` dropdown. Pick a model and hit
`Restart` to stop realtime, unload the current LM Studio model, load the chosen
model, and start realtime again with Eric's Qwen3-TTS voice.

Current presets:

| Preset | LM Studio model | Context | Reasoning | Notes |
| --- | --- | ---: | --- | --- |
| Qwen 27B | `qwen/qwen3.8-27b` | 131K | `low` | Gold Eric baseline. Best current personality and overnight rumination choice. |
| Qwen 9B | `qwen/qwen3.5-9b` | 131K | `low` | Middle-size comparison model. |
| Qwen 4B | `qwen3.5-4b` | 131K | `none` | Small/fast comparison model. |
| Nemotron 30B | `nvidia-nemotron-3.5-lightning-30b-a3b` | 64K | `none` | Alternate brain. Potent and fast, but more verbose and assistant-like. |
| OpenAI | `$env:ROBOT_790_OPENAI_LLM_MODEL` | API | omitted | Cloud LLM comparison while keeping local Qwen3-TTS voice, face, and tools. Defaults to `gpt-4.1-mini`. |

The restart script behind the dropdown is:

```powershell
.\scripts\restart_realtime_gold.ps1 -Preset qwen27
.\scripts\restart_realtime_gold.ps1 -Preset qwen9
.\scripts\restart_realtime_gold.ps1 -Preset qwen4
.\scripts\restart_realtime_gold.ps1 -Preset nemotron30
.\scripts\restart_realtime_gold.ps1 -Preset openai
```

The OpenAI preset uses `OPENAI_API_KEY` from `.env` and skips LM Studio model
loading. Override the model without changing code:

```powershell
$env:ROBOT_790_OPENAI_LLM_MODEL = "gpt-4.1-mini"
```

Chat text is uncapped by default so note reads, summaries, and longer thoughts
can complete instead of being clipped. A hard text cap is available only for
debug runs:

```powershell
.\scripts\start_realtime_eric_qwen3.ps1 -TextMaxTokens 192
```

`AudioMaxTokens` is still passed to the upstream realtime/TTS stack, but it
should not silently clip chat text unless `-TextMaxTokens` is explicitly used.

## STS Page

The browser page is the main live control surface. It includes:

- Realtime server connection and model restart controls.
- Sensing Eye drop target for images or text files.
- Mic start/stop, audio meter, and interruption sensitivity.
- Face, chassis, voice, memory, web, weather, Cast, and note tool switches.
- Idle controls for drift, wonder, self-focus, notes-focus, and substrate tests.
- Conversation and event panes with copy and record buttons.
- Context Map for a rough view of what Eric can draw from.

The page sends a compact Robot 790/Eric identity prompt with `session.update`
when it connects. It also drives deterministic face lifecycle cues:

- user speech: listening
- STT/LLM work: thinking
- output audio: speaking
- response completion: release back to idle

This keeps the face responsive even when the LLM is slow or odd.

## Idle And Rumination

Idle pondering is page-driven, not firmware-driven. The `Idle drift` slider is
off at `0`; higher levels let the page request one-sentence ponders after quiet
periods. Level `11` is intentionally overactive, and level `12` is a lab sprint
for fast context-growth tests.

Idle ponders use lanes such as object noticing, callback, status, question,
addressed question, craft, curiosity, unresolved, lookup, and aside. Recent
idle outputs are fed back so thoughts can build on each other, while repetition
and exhaustion checks can put idle into cooldown.

The related controls matter:

- `Wonder`: raises the chance of curiosity, unresolved, and lookup lanes.
- `Self-focus`: controls how much Eric centers body, identity, and self-model.
- `Notes`: controls how strongly loaded notes shape idle material.
- `Substrate test`: suppresses ordinary Robot 790 self-reference so a loaded
  note can act as the temporary world for an experiment.

Substrate mode is for experiments, not ordinary Eric. It helps answer whether a
note can become the world of the rumination loop without the chassis and normal
identity pulling everything home.

## Tools

The realtime page can expose these tools to the LLM:

- `set_robot_mode`: `idle`, `listening`, `thinking`, `speaking`, or `sleeping`.
- `play_face_beat`: named face animation beats.
- `set_face_mood`: named face mood for a short visual hold.
- `set_eye_style`: eye renderer style such as `robot`, `friendly`, `classic`,
  `cartoony`, `sinister`, or `sleepy`.
- `set_eye_gaze`: normalized gaze target.
- `set_mouth`: mouth style, shape, talking state, text display, energy, or
  release back to autonomous control.
- `set_chassis`: one explicit status, stop, e-stop, clear, tank, or twist
  command for the tracked chassis.
- `remember_fact` / `forget_fact`: explicit named browser memory facts.
- `search_web`: compact web search results.
- `get_weather`: current weather lookup.
- `show_web_page`: open a web page in the UI.
- `generate_image`: create one still image from a visual prompt, save it under
  `logs/generated-images/`, and show it in the STS page.
- `cast_media`: list Cast receivers, play YouTube, show direct image URLs, or
  stop Cast playback.
- `write_text_file`, `read_text_file`, `list_text_files`: text-note file tools.
- `get_brain_status`: local diagnostics such as model, context, token pressure,
  latency, TTS timing, and approximate browser context contribution.

Image generation is opt-in from the `LLM image generation` checkbox because a
cloud provider may charge per image. The default provider is OpenAI:

```powershell
$env:OPENAI_API_KEY = "..."
$env:ROBOT_790_IMAGE_PROVIDER = "openai"
$env:ROBOT_790_OPENAI_IMAGE_MODEL = "gpt-image-1-mini"
```

For plumbing tests without cloud calls:

```powershell
$env:ROBOT_790_IMAGE_PROVIDER = "mock"
```

The image tool contract is intentionally small for now: Eric supplies a prompt,
optional title, and optional size. Provider-specific controls such as aspect
ratio, style, quality, and ComfyUI workflows can be added behind the same tool
later.

Face and chassis tool calls should still be short and explicit. The model
proposes; deterministic tool and firmware layers decide what is actually safe
and timed.

## Memory, Notes, And Logs

There are two memory-like layers:

- Browser memory facts live in browser `localStorage` under
  `robot790.memory.v1` and are injected into session instructions.
- Daemon memory facts use `memory.v1.json`; set `ROBOT_790_MEMORY_PATH` or
  `ROBOT_790_INSTANCE_PATH` to move that file.

Notes are different from named facts. They live under `notes/` by default,
missing extensions become `.txt`, and only `.txt` or explicitly named `.md`
files are allowed. Set `ROBOT_790_NOTES_PATH` to move the folder.

The note tools are intended as explicit storage: Eric should only write, append,
read, or list files when asked. Note writing should keep user-supplied facts,
session events, tool-verified facts, and Eric's own ruminations distinct. Weird
thoughts are allowed as thoughts; unverified outside facts should not be saved
as settled truth.

Live page captures are written under `logs/live/` by the Record buttons. Those
files are local lab artifacts and are ignored by git.

## Local Qwen3-TTS Endpoint

Robot 790 also includes a separate OpenAI-shaped Qwen3-TTS endpoint.

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

The endpoint exposes:

- `GET /health`
- `GET /v1/voices`
- `GET /v1/models`
- `POST /v1/audio/speech`

Settings can be provided with environment variables; see
`qwen3_tts.example.env`.

## Firmware Bring-Up

Point the daemon client at the active ESP32 face:

```powershell
$env:ROBOT_790_FACE_URL = "http://esp32-eyes.local/"
robot-790d state
robot-790d listen
robot-790d speak --energy 0.7
robot-790d beat mischief
robot-790d idle
```

Build and upload the face firmware:

```powershell
cd firmware\esp32-face
pio run
pio device list
pio run -t upload --upload-port COM8
```

Use the COM port reported for your ESP32-S3. `COM8` was the current board on
the original workstation during bring-up.

## Hardware Direction

The physical build is moving toward a 790-like printed face with display
openings for eyes and mouth. Current electronics vocabulary:

- ESP32-S3 face controller
- round GC9A01 eye displays
- rectangular ILI9341 mouth display
- optional round status/debug display
- ESP32 chassis controller
- ESP32 camera experiments
- optional neck yaw/pitch hardware

Longer term, a Jetson Nano or another local host can run voice, vision, and the
behavior daemon while ESP32 boards remain dedicated device controllers.

## Development

Run the current focused tests:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Useful diagnostics:

```powershell
.\.venv\Scripts\python.exe -m robot_790d.brain_status --json
lms ps
Get-NetTCPConnection -LocalPort 8765,8790,1234 -State Listen
```

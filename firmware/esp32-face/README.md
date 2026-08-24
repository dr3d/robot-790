# ESP32 Eyes And Mouth Firmware

Experimental ESP32-S3 firmware for the Reachy Mini face board. This is the
current UI-enabled firmware: it drives two 240x240 GC9A01 round eye displays,
the optional third GC9A01 mouth display, and an optional fourth rectangular
240x320 ILI9341-style TFT for a status panel or rectangular mouth audition. It
serves the browser panel at `http://esp32-eyes.local/`, and exposes both HTTP
and USB serial control APIs.

## What It Runs

- Left eye display
- Right eye display
- Mouth display when `REACHY_MOUTH_CS` is defined
- Auxiliary rectangular display when `REACHY_AUX_CS` is defined
- Built-in browser test panel
- mDNS hostname `esp32-eyes.local`
- Setup Wi-Fi access point when LAN Wi-Fi is missing or fails
- OTA firmware upload from the browser panel after the first USB flash

The default config defines `REACHY_MOUTH_CS 17` and `REACHY_AUX_CS 18`, so the
stock build is a four-display build: two eye displays, a rectangular mouth on
GPIO18, and a round status display on GPIO17.

## Build And Flash

Use PlatformIO from this folder:

```bash
pio run
pio run -t upload
pio device monitor
```

The default environment is `esp32-s3-devkitc-1`. Serial monitor speed is
`115200`.

After boot, the monitor should print URLs like:

```text
WiFi IP: 192.168.x.x
Face UI URL: http://192.168.x.x/
mDNS URL: http://esp32-eyes.local/
```

Use the printed IP if `.local` name resolution is unreliable on the network.

## Wiring

Display pins and timing defaults live in `include/reachy_config.h`.

Default face-display wiring:

| Signal | Left eye | Right eye | Mouth | Aux TFT | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| SCLK | GPIO4 | GPIO4 | GPIO4 | GPIO4 | shared SPI clock |
| MOSI / SDA / DIN | GPIO5 | GPIO5 | GPIO5 | GPIO5 | shared SPI data |
| DC / RS | GPIO6 | GPIO6 | GPIO6 | GPIO6 | shared data/command |
| RST / RESET | GPIO7 | GPIO7 | GPIO7 | GPIO7 | shared reset |
| CS | GPIO15 | GPIO16 | GPIO17 | GPIO18 | one chip-select per display |
| VCC | 3V3 | 3V3 | 3V3 | 3V3 | use 3.3 V logic/power |
| GND | GND | GND | GND | GND | common ground |

The code treats shared eye reset specially and passes `-1` to the display
objects after resetting the shared line once. The mouth display is compiled in
when `REACHY_MOUTH_CS` exists. The auxiliary rectangular TFT is compiled in when
`REACHY_AUX_CS` exists.

The auxiliary TFT's `SDO/MISO` pin is unused. Tie its `LED` pin to `3V3` for the
first bring-up unless you add a dedicated backlight GPIO later.

Other hardware defaults:

- SPI write speed: `REACHY_SPI_HZ`, default `40000000`
- Frame period: `REACHY_FRAME_MS`, default `16`
- Eye rotations: `2`
- Mouth rotation: `2`
- Aux display rotation: `1` (landscape, 180 degrees from the previous rotation)
- Aux display role: `REACHY_AUX_ROLE_MOUTH_ONLY`
- Round mouth status: `REACHY_MOUTH_STATUS_WHEN_AUX_MOUTH 1`
- BOOT/GPIO0 long press: flip orientation

Aux display roles:

| Role | Value | Behavior |
| --- | ---: | --- |
| `REACHY_AUX_ROLE_STATUS` | `0` | quiet status panel with mood, mouth, gaze, Wi-Fi, and CS map |
| `REACHY_AUX_ROLE_MOUTH_MIRROR` | `1` | native 320x240 rectangular mouth using the same mouth state while keeping the round mouth active |
| `REACHY_AUX_ROLE_MOUTH_ONLY` | `2` | rectangular mouth only; GPIO17 can become a slow status display |

When `REACHY_MOUTH_STATUS_WHEN_AUX_MOUTH` is enabled, the round GPIO17 display
shows four centered single-column rows: eyes, mouth, mood, and idle beat. The
Wi-Fi address is intentionally omitted; a small green gaze-focus circle floats
over the status rows. This status view is composed offscreen and pushed as a
single frame so gaze-dot motion does not visibly clear and redraw the text rows.

## Wi-Fi Setup

For compile-time LAN credentials, copy:

```bash
cp include/reachy_config_private.example.h include/reachy_config_private.h
```

Then fill in:

```cpp
#define REACHY_WIFI_SSID "Your WiFi SSID"
#define REACHY_WIFI_PASSWORD "Your WiFi Password"
```

`reachy_config_private.h` is ignored by git.

If no LAN credentials are configured, or if joining fails, the board starts a
setup access point:

```text
SSID: ReachyEyes-S3
Password: reachyeyes
URL: http://192.168.4.1/
```

Open the setup page, enter LAN Wi-Fi credentials, and the board saves them in
ESP32 non-volatile storage. Saved passwords are not returned by the status API.
Use the browser panel's Clear Saved action, or `POST /wifi` with
`{"clear":true}`, to remove saved credentials and reboot.

Set `REACHY_AP_ALWAYS_ON` to `1` only if you want the setup AP to stay available
while the board is also connected to LAN Wi-Fi.

## Browser Panel

Open:

```text
http://esp32-eyes.local/
```

or, while on the setup AP:

```text
http://192.168.4.1/
```

The panel controls:

- Eye style
- Mood and expression
- Idle beat
- Mouth style, shape, talking, and energy
- Auxiliary display role configured in firmware
- Gaze
- Blink and wink
- Sleep
- Release to autonomous behavior
- Display flip
- Wi-Fi setup/clear
- OTA firmware upload

Saved face preferences:

- eye style
- mouth style
- idle on/off
- display flip

Temporary actions:

- mood/expression overrides
- gaze overrides
- blink/wink
- sleep
- one-off mouth shape/talking overrides

## OTA Firmware Updates

After one USB flash of an OTA-capable build, future updates can be uploaded from
the browser panel.

Build:

```bash
pio run
```

Then upload this file in the OTA Firmware card:

```text
.pio/build/esp32-s3-devkitc-1/firmware.bin
```

Do not upload `bootloader.bin` or `partitions.bin` through the panel. Keep USB
flashing available as the recovery path.

## HTTP API

Set a shell variable first:

```bash
EYES_URL=http://esp32-eyes.local
```

Read endpoints:

```bash
curl "$EYES_URL/health"
curl "$EYES_URL/state"
curl "$EYES_URL/wifi"
curl "$EYES_URL/styles"
curl "$EYES_URL/moods"
curl "$EYES_URL/emotions"
curl "$EYES_URL/beats"
curl "$EYES_URL/mouth_shapes"
curl "$EYES_URL/mouth_styles"
```

Command endpoints:

```text
POST /control
POST /release
POST /mood
POST /emotion
POST /expression
POST /beat
POST /style
POST /mouth
POST /gaze
POST /blink
POST /wink
POST /sleep
POST /wifi
POST /ota
```

Common examples:

```bash
curl -X POST "$EYES_URL/style" \
  -H "Content-Type: application/json" \
  -d '{"name":"robot"}'

curl -X POST "$EYES_URL/expression" \
  -H "Content-Type: application/json" \
  -d '{"name":"suspicious","duration":4}'

curl -X POST "$EYES_URL/beat" \
  -H "Content-Type: application/json" \
  -d '{"name":"slow_smile"}'

curl -X POST "$EYES_URL/gaze" \
  -H "Content-Type: application/json" \
  -d '{"x":1,"y":0,"duration":0,"move_ms":180}'

curl -X POST "$EYES_URL/mouth" \
  -H "Content-Type: application/json" \
  -d '{"style":"human","shape":"open","talking":true,"energy":0.7,"duration":0}'

curl -X POST "$EYES_URL/release" \
  -H "Content-Type: application/json" \
  -d '{}'
```

`/control` accepts combined high-level updates. For example:

```bash
curl -X POST "$EYES_URL/control" \
  -H "Content-Type: application/json" \
  -d '{"expression":"happy","duration":3,"mouth":{"shape":"smile","energy":0.5},"gaze":{"x":0,"y":-0.3,"duration":2}}'
```

## State Shape

`GET /state` returns the board's current state. Important fields:

```json
{
  "ok": true,
  "running": true,
  "idle": true,
  "autonomous": true,
  "mood": "calm",
  "style": "friendly",
  "flipped": false,
  "director": "none",
  "wifi": {
    "mode": "station",
    "ip": "192.168.x.x",
    "hostname": "esp32-eyes",
    "mdns_url": "http://esp32-eyes.local/"
  },
  "mouth": {
    "present": true,
    "style": "human",
    "shape": "neutral",
    "manual": false,
    "talking": false,
    "energy": 0.45
  },
  "gaze": {
    "manual": false
  },
  "blink": {
    "active": false,
    "wink": false,
    "eye": "both"
  }
}
```

## Eyes

Eye renderer styles:

```text
friendly
classic
cartoony
robot
sinister
sleepy
```

Moods and expressions:

```text
calm
curious
surprised
suspicious
afraid
angry
sleepy
sleep
goofy
robotic
wonder
glitchy
happy
delighted
bashful
bored
focused
confused
proud
mischief
affection
```

Common aliases include:

- `smile` -> `happy`
- `sparkle` or `excited` -> `delighted`
- `shy` -> `bashful`
- `meh` -> `bored`
- `focus` -> `focused`
- `puzzled` -> `confused`
- `mischievous` -> `mischief`
- `love` or `fond` -> `affection`

Idle beats:

```text
slow_smile
affection
inspect
thoughtful
daydream
mischief
confused
focus_lock
double_take
goofy
drowsy
robot_scan
wary
startle
```

## Behavior Model

The face behavior is layered. The firmware updates mood first, then mouth,
idle beats, gaze, blinks, and pupil size. The renderer reads those state
machines and draws the current frame.

Mood is the base emotional state. It controls eyelid pose, pupil target size,
blink timing, gaze jitter, and the general style of random gaze targets. Mood
changes blend from the previous pose to the next pose so expressions do not
snap unless the special sleep state is requested.

Expression is a convenience command for "mood plus gaze." Calling an expression
sets the mood and also chooses a gaze target that fits that mood. Calling mood
alone changes the face posture while the normal gaze scheduler continues.

Idle beats are short choreographed routines managed by `IdleDirector`. A beat
temporarily pauses the normal random mood/gaze scheduling, then advances through
timed steps. Each step can call `beginMood(...)`, move the eyes with
`directorGaze(...)`, or trigger a blink/wink. When the beat ends, normal idle
mood and gaze timing resume.

For example, `slow_smile` eases into a happy mood, drifts gaze side to side,
blinks, then warms into delighted or affection. `mischief` sets a sly mood,
glances sideways, winks, then returns toward happy. `robot_scan` switches to a
robotic mood and snaps gaze through fixed scan points before returning to calm.

Gaze itself is stored as a 3D target: `x`, `y`, and `z`. The renderer projects
that target separately for each eye, so nearer `z` values create more
convergence. The current mood can then add small render-time offsets, such as
sleepy looking lower, proud looking higher, focused compressing gaze movement,
or delighted adding a little sparkle motion.

Normalized HTTP gaze uses `x` and `y` in `-1..1` when `z` is omitted:

- `x=1`: Reachy's right
- `x=-1`: Reachy's left
- `y=1`: down
- `y=-1`: up

If `z` is included, `x`, `y`, and `z` are treated as raw firmware target
coordinates.

## Mouth

Mouth renderer styles:

```text
human
robot
```

Mouth shapes:

```text
neutral
smile
smirk_left
smirk_right
open
wide
frown
grimace
sneer
sleep
```

Shape aliases:

- `flat` or `line` -> `neutral`
- `happy` -> `smile`
- `left_smirk` -> `smirk_left`
- `smirk` or `right_smirk` -> `smirk_right`
- `talk` or `speaking` -> `open`
- `surprised` or `shout` -> `wide`
- `sad` -> `frown`
- `teeth` or `tense` -> `grimace`
- `sinister` -> `sneer`
- `blank` -> `sleep`

Mouth behavior:

- Without a manual mouth override, the mouth follows the active eye mood.
- `shape` sets a temporary/manual mouth shape.
- `talking:true` rhythmically modulates the open amount.
- `energy` is clamped to `0..1` and controls talk/open intensity.
- `duration` is in seconds for HTTP routes.
- `duration_ms` is accepted when millisecond precision is easier.
- `duration:0` or `duration_ms:0` holds until release or another mouth command.
- `release`, `auto`, or `POST /release` returns the mouth to mood-following mode.

Examples:

```bash
curl -X POST "$EYES_URL/mouth" \
  -H "Content-Type: application/json" \
  -d '{"shape":"smile","duration":3}'

curl -X POST "$EYES_URL/mouth" \
  -H "Content-Type: application/json" \
  -d '{"shape":"open","talking":true,"energy":0.8,"duration":0}'

curl -X POST "$EYES_URL/mouth" \
  -H "Content-Type: application/json" \
  -d '{"auto":true}'
```

## USB Serial API

USB serial commands are newline-delimited and reply with `OK ...` or `ERR ...`.

```text
help
status
ping
release

style robot
style friendly

mood curious 3000
mood sleep 5000
mood auto

expr happy 8000
expr suspicious 4000
expr auto

beat slow_smile
beat daydream

mouth smile 3000 0.5
mouth talk 0 0.8
mouth stop
mouth auto

gaze 40 20 350 1200 180
look 0 0 700
gaze auto

blink
blink double
blink 220
wink left
wink right

flip toggle
flip on
flip off

idle on
idle off
sleep 5000
```

Serial durations are milliseconds. For mouth serial commands, the optional third
argument is energy from `0..1`.

## Conversation App Integration

In the conversation app `.env`, point the app at the board:

```env
REACHY_MINI_EYES_BASE_URL=http://esp32-eyes.local/
```

The app sends high-level cues through the `set_eyes` tool and automatic
conversation/motion choreography. The firmware owns rendering, easing, blinking,
talk animation, idle beats, and display orientation.

Typical app cues:

| App event | Firmware cue |
| --- | --- |
| User starts speaking | curious eyes, neutral mouth |
| Assistant starts speaking | happy eyes, talking mouth |
| Assistant finishes | release |
| `play_emotion` | matching eye mood and mouth shape |
| `dance` | playful idle beat |
| `move_head` | matching gaze direction |
| `go_to_sleep` | sleep eyes and mouth |

## Troubleshooting

- No UI: check serial for the printed IP, then use the IP instead of
  `esp32-eyes.local`.
- Board starts `ReachyEyes-S3`: LAN credentials are missing or failed.
- `.local` does not resolve: use the printed IP or check mDNS support on the
  computer/network.
- Mouth missing in `/state`: confirm `REACHY_MOUTH_CS` is defined in
  `include/reachy_config.h`.
- First eye blank after adding the auxiliary TFT: confirm aux `CS` is on GPIO18
  and running firmware that drives `REACHY_AUX_CS` high during boot. A floating
  extra CS can corrupt the shared SPI bus.
- One display is blank: check that shared SCLK/MOSI/DC/RST are connected and
  that each display has a unique CS.
- Displays are upside down: use `flip toggle` in serial, the browser panel, or
  hold BOOT/GPIO0 for two seconds.
- OTA fails: recover with USB upload, then retry OTA with only
  `.pio/build/esp32-s3-devkitc-1/firmware.bin`.

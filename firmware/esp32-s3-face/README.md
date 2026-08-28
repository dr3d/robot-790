# ESP32-S3 Face

Robot 790 one-piece face firmware for the Waveshare-style
`ESP32-S3-Touch-LCD-2` board. This target uses the built-in 240x320 portrait
LCD as a tiny stacked face: two virtual eyes at the top and a mouth viewport
below. It keeps the same face-control HTTP contract as the external-display
`esp32-eyes` firmware so the Robot 790 STS face tools can point at it directly.
This is the forward path for the ESP32-S3 face-brain hardware: one unit doing
the face while leaving touch, IMU, SD, and camera work available for later.

The current/legacy external-display rig stays at:

```text
http://esp32-eyes.local/
```

This one-piece S3 target claims:

```text
http://esp32-s3-face.local/
```

The earlier external-eye face-brain build remains separate and parked in:

```text
firmware/esp32-s3-face-brain
```

Keep it around for the two-round-eye wiring experiment or future spare boards;
do not treat it as the main one-piece face target.

## Current Milestone

This is a safe bring-up target, not a replacement for the live face until it is
flashed and inspected on the actual board.

- built-in ST7789T3 display in portrait mode
- virtual left/right eye viewports on the built-in display
- mouth rendering on the built-in display
- autonomous mood, gaze, blink, pupil, mouth, and idle beat logic
- CST816D touch and QMI8658 IMU probes over I2C
- microSD and camera probes disabled by default
- Wi-Fi station mode with AP fallback
- mDNS hostname `esp32-s3-face.local`
- Arduino OTA after first USB flash

## Build And Upload

Use PlatformIO from this folder:

```powershell
cd firmware/esp32-s3-face
pio run
pio run -t upload --upload-port COM17
pio device monitor -p COM17 -b 115200
```

After it has Wi-Fi and OTA is running:

```powershell
pio run -e esp32-s3-face-ota -t upload
```

## Wi-Fi Config

Copy the example private header:

```powershell
Copy-Item include\face_brain_config_private.example.h include\face_brain_config_private.h
```

Then fill in `FACE_WIFI_SSID` and `FACE_WIFI_PASSWORD`. The private header is
ignored by git.

If credentials are empty or station mode fails, the board starts an AP:

```text
SSID: Robot790-Face
Password: robot790
URL: http://192.168.4.1/
```

## HTTP Routes

| Method | Path | Meaning |
| --- | --- | --- |
| `GET` | `/` | compact browser status page |
| `GET` | `/status` | JSON status |
| `GET` | `/api/status` | JSON status |
| `GET` | `/api/display?message=...` | redraw display self-test card |
| `GET` | `/api/eyes?pattern=eye\|test&target=left\|right\|both` | redraw eyes or diagnostics |
| `GET` | `/api/backlight?value=0..255` | set display backlight PWM |
| `GET` | `/state` | V1-style face state JSON |
| `GET` | `/moods` | supported mood names |
| `GET` | `/emotions` | supported emotion names |
| `GET` | `/styles` | supported eye style names |
| `GET` | `/mouth_styles` | supported mouth style names |
| `GET` | `/mouth_shapes` | supported mouth shape names |
| `GET` | `/beats` | supported idle beat names |
| `POST` | `/control` | combined V1-style face control JSON |
| `POST` | `/mood` | set eye mood |
| `POST` | `/emotion` | set eye mood alias |
| `POST` | `/expression` | set mood and matching gaze |
| `POST` | `/gaze` | manual gaze target or release |
| `POST` | `/beat` | play an idle beat |
| `POST` | `/style` | set eye render style |
| `POST` | `/mouth` | set mouth style/shape/talking state |
| `POST` | `/blink` | trigger blink |
| `POST` | `/wink` | trigger wink |
| `POST` | `/sleep` | close/sleep eyes |
| `POST` | `/release` | release overrides back to autonomous behavior |

Example manual gaze using normalized `x`/`y` values:

```powershell
Invoke-RestMethod -Uri http://esp32-s3-face.local/gaze `
  -Method Post -ContentType 'application/json' `
  -Body '{"x":-1,"y":0.5,"duration":2,"move_ms":200}'
```

If `z` is omitted, `x` and `y` are normalized to `-1..1`, matching the face
tools. If `z` is provided, `x`, `y`, and `z` are treated as raw millimeter-style
gaze target coordinates.

## Hardware Notes

The pin map is adapted from Waveshare's ESP32-S3-Touch-LCD-2 Arduino examples
and schematic:

- LCD SPI: SCLK `39`, MOSI `38`, MISO `40`, DC `42`, CS `45`, BL `1`
- I2C: SDA `48`, SCL `47`
- Touch: CST816D at `0x15`
- IMU: QMI8658 at `0x6B`
- SD CS: `41`
- Camera: PWDN `17`, XCLK `8`, SIOD `21`, SIOC `16`, D0-D7
  `12,13,15,11,14,10,7,2`, VSYNC `6`, HREF `4`, PCLK `9`

Set `FACE_ENABLE_SD_PROBE` or `FACE_ENABLE_CAMERA_PROBE` to `1` in
`face_brain_config_private.h` once the core display/I2C/Wi-Fi path is stable.

`FACE_EXTERNAL_EYES_ENABLED` defaults to `0` here. Turn it on only for
experiments that deliberately sacrifice the onboard camera pins to drive
external TFTs.

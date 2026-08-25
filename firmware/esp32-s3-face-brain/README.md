# ESP32-S3 Face Brain

Robot 790 V2 integrated face-brain firmware for the Waveshare-style
`ESP32-S3-Touch-LCD-2` board. This board replaces the separate V1 face controller
experiment with one module that has a 240x320 display, capacitive touch, camera
connector, QMI8658 IMU, microSD, native USB, Wi-Fi, and Bluetooth.

The V1 external-display rig stays at:

```text
http://esp32-eyes.local/
```

This V2 target claims:

```text
http://esp32-face.local/
```

## Current Milestone

This firmware started as a discovery build and now drives the two external
round TFTs as Robot 790 eyes. The eye behavior contract has been ported from
the V1 face controller in an eye-only form: moods, styles, autonomous gaze,
manual gaze holds, blinks/winks, idle beats, and the HTTP routes used by the
STS face tools.

The built-in 240x320 display remains a hardware/status surface for now. Mouth
rendering is not yet ported to this target.

Current probes:

- ST7789T3 display through Arduino_GFX
- two GC9A01 round eye displays through Arduino_GFX
- CST816D touch controller presence over I2C
- QMI8658 IMU over I2C
- microSD over SPI, disabled by default during first bring-up
- OV5640/OV2640 camera connector through `esp_camera`, disabled by default
  during first bring-up
- Wi-Fi station mode with AP fallback
- mDNS hostname `esp32-face.local`
- Arduino OTA after first USB flash

## Build And Upload

Use PlatformIO from this folder:

```powershell
cd firmware/esp32-s3-face-brain
pio run
pio run -t upload --upload-port COM17
pio device monitor -p COM17 -b 115200
```

After it has Wi-Fi and OTA is running:

```powershell
pio run -e esp32-s3-face-brain-ota -t upload
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
| `GET` | `/api/eyes?pattern=eye\|test&target=left\|right\|both` | redraw external eyes or diagnostics |
| `GET` | `/api/backlight?value=0..255` | set display backlight PWM |
| `GET` | `/state` | V1-style face state JSON |
| `GET` | `/moods` | supported mood names |
| `GET` | `/emotions` | supported emotion names |
| `GET` | `/styles` | supported eye style names |
| `GET` | `/beats` | supported idle beat names |
| `POST` | `/control` | combined V1-style face control JSON |
| `POST` | `/mood` | set eye mood |
| `POST` | `/emotion` | set eye mood alias |
| `POST` | `/expression` | set mood and matching gaze |
| `POST` | `/gaze` | manual gaze target or release |
| `POST` | `/beat` | play an idle beat |
| `POST` | `/style` | set eye render style |
| `POST` | `/blink` | trigger blink |
| `POST` | `/wink` | trigger wink |
| `POST` | `/sleep` | close/sleep eyes |
| `POST` | `/release` | release overrides back to autonomous behavior |

Example manual gaze using normalized `x`/`y` values:

```powershell
Invoke-RestMethod -Uri http://esp32-face.local/gaze `
  -Method Post -ContentType 'application/json' `
  -Body '{"x":-1,"y":0.5,"duration":2,"move_ms":200}'
```

If `z` is omitted, `x` and `y` are normalized to `-1..1`, matching the V1
face-control tools. If `z` is provided, `x`, `y`, and `z` are treated as raw
millimeter-style gaze target coordinates.

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

## Header Pin Reservations

The board brings GPIOs out to the side headers, but many are already connected
to onboard hardware. Treat these as reserved unless that onboard feature is
being deliberately disabled.

Side header map, matching the product pinout image:

| Header signal | Use it? | Reservation |
| --- | --- | --- |
| Left `IO2` | No if camera | Camera D7. |
| Left `IO4` | No if camera | Camera HREF. |
| Left `IO6` | No if camera | Camera VSYNC. |
| Left `IO16` | No if camera | Camera SCCB/SIOC clock. |
| Left `IO17` | No if camera | Camera PWDN. |
| Left `IO18` | Yes | Clean-looking GPIO on the header. |
| Left `IO21` | No if camera | Camera SCCB/SIOD data. |
| Left `IO8` | No if camera | Camera XCLK. |
| Left `IO7` | No if camera | Camera D6. |
| Left `IO10` | No if camera | Camera D5. |
| Left `IO20` | No | Native USB D+. |
| Left `IO19` | No | Native USB D-. |
| Right `IO43` / `TXD` | Maybe | UART0 TXD. Prefer keeping it for serial unless USB CDC is enough. |
| Right `IO44` / `RXD` | Maybe | UART0 RXD. Prefer keeping it for serial unless USB CDC is enough. |
| Right `IO47` | Shared only | I2C SCL for touch and IMU. OK for more I2C devices, not normal GPIO. |
| Right `IO48` | Shared only | I2C SDA for touch and IMU. OK for more I2C devices, not normal GPIO. |
| Right `IO15` | No if camera | Camera D2. |
| Right `IO13` | No if camera | Camera D1. |
| Right `IO11` | No if camera | Camera D3. |
| Right `IO12` | No if camera | Camera D0. |
| Right `IO14` | No if camera | Camera D4. |
| Right `IO9` | No if camera | Camera PCLK. |

Other onboard reservations:

| GPIO | Reservation |
| --- | --- |
| `IO1` | LCD backlight PWM. |
| `IO2` | Camera D7, and exposed on the other header. |
| `IO3` | IMU interrupt / strapping pin. |
| `IO4` | Camera HREF, and exposed on the other header. |
| `IO5` | Battery ADC. |
| `IO6` | Camera VSYNC. |
| `IO7` | Camera D6. |
| `IO8` | Camera XCLK. |
| `IO9` | Camera PCLK. |
| `IO10` | Camera D5. |
| `IO11` | Camera D3. |
| `IO12` | Camera D0. |
| `IO13` | Camera D1. |
| `IO14` | Camera D4. |
| `IO19` | Native USB D-. Do not use. |
| `IO20` | Native USB D+. Do not use. |
| `IO33`-`IO37` | Occupied by ESP32-S3R8 octal PSRAM. Do not use. |
| `IO38` | LCD/SD MOSI. |
| `IO39` | LCD/SD SCLK. |
| `IO40` | SD MISO. |
| `IO41` | SD CS. |
| `IO42` | LCD DC. |
| `IO45` | LCD CS / strapping pin. |
| `IO46` | Touch interrupt / strapping pin. |

Practical rule for Robot 790: if the built-in camera remains part of the V2
face plan, the side headers do not expose enough unused GPIO for an external
four-signal SPI display bus plus three chip-selects. The truly clean GPIO is
`IO18`; `IO43`/`IO44` are debug/UART-adjacent; `IO47`/`IO48` should stay shared
I2C.

## External SPI Display Bus Plan

If V2 needs to drive additional SPI TFTs through the side headers, treat the
built-in camera connector as sacrificed. The onboard LCD bus uses `IO38`,
`IO39`, `IO42`, and `IO45`, but those are not the convenient side-header pins
shown in the product pinout image.

Current two-eye external TFT bus:

| Signal | GPIO | Notes |
| --- | --- | --- |
| `SCL` / `SCK` | `IO9` | Sacrifices camera PCLK. |
| `SDA` / `MOSI` | `IO14` | Sacrifices camera D4. |
| `DC` | `IO12` | Sacrifices camera D0. |
| `RST` | `IO11` | Sacrifices camera D3. |

Current two-eye chip-select pins:

| Display | GPIO | Tradeoff |
| --- | --- | --- |
| Left eye CS | `IO13` | Sacrifices camera D1. |
| Right eye CS | `IO15` | Sacrifices camera D2. |

This keeps the built-in 240x320 screen available as the mouth/status surface.
It intentionally gives up the built-in camera connector for this V2 layout.
Keep `IO19`/`IO20` for native USB and keep `IO47`/`IO48` as the shared I2C bus.

Sources:

- Waveshare product documentation: <https://docs.waveshare.com/ESP32-S3-Touch-LCD-2>
- Waveshare resources and schematic/example links: <https://docs.waveshare.com/ESP32-S3-Touch-LCD-2/Resources-And-Documents>

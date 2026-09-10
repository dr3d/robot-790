# ESP32-S3 DualEye LCD 1.28

Status: **working bench bring-up firmware**. It is not an active runtime embodiment and has no STS route or runtime profile.

## What Arrived

This is the self-contained ESP32-S3 dual-eye board acquired for the Robot 790 face experiments. Its two round displays make it a natural eye-only face body, with onboard audio, battery, and expansion hardware available for later work.

The attached unit was inspected read-only over USB on 2026-09-09:

- Windows exposed native USB Serial/JTAG as `COM3`.
- The chip identifies as an ESP32-S3 revision 0.2 with 16 MB quad flash and 8 MB PSRAM.
- The factory image was initially left intact. The board now runs the local visual bring-up test described below.

## Likely Board Family And Reference

The memory, USB identity, form factor, and product description match the Waveshare ESP32-S3 DualEye LCD family. The matching vendor reference describes two 240x240 GC9A01 displays on a shared 80 MHz SPI bus, with separate chip-select, reset, and backlight controls.

Use the vendor source as the authority at bring-up time, and verify the exact PCB revision before treating any pin as a flashing authority:

- <https://github.com/waveshareteam/ESP32-S3-DualEye-Touch-LCD-1.28>
- <https://github.com/waveshareteam/ESP32-S3-DualEye-Touch-LCD-1.28/blob/main/xiaozhi-esp32/main/boards/waveshare/esp32-s3-dualeye-lcd-1.28/config.h>

The currently recorded reference mapping is:

| Shared signal | GPIO |
| --- | ---: |
| MOSI | 42 |
| MISO | 40 |
| SCLK | 41 |
| D/C | 45 |

| Display | CS | Reset | Backlight |
| --- | ---: | ---: | ---: |
| Primary round eye | 47 | 48 | 46 |
| Secondary round eye | 38 | 8 | 39 |

The same reference reports I2C on `SCL 10` / `SDA 11` and an ES8311/ES7210 audio path. Those are future capabilities, not current Robot 790 claims.

## Intended Semantic Role

This is an eye-first body. It should receive familiar semantic intent such as mood, gaze, blink, wink, style, and bounded idle beats. Its adapter owns the two-screen rendering, orientation/mirroring, display timing, and all GPIO choices.

It has no dedicated mouth display. Until another physical display is part of this body, a future adapter should report mouth rendering as unavailable rather than imply a mouth action occurred.

## Visual Bring-Up

This folder now holds a small PlatformIO project for the attached board. It
uses the vendor pin map and a shared off-screen `240x240` framebuffer: first
each display receives a labelled card, then both show a slow, cyan Robot 790
eye animation with shared gaze and periodic blinks. It contains no audio,
context, control route, or runtime embodiment claim.

From the repository root:

```powershell
pio run -d firmware\esp32-s3-dualeye-lcd-1.28
pio run -d firmware\esp32-s3-dualeye-lcd-1.28 -t upload --upload-port COM3
pio device monitor -p COM3 -b 115200
```

`COM3` was this S3's native USB Serial/JTAG port during bring-up. It can
change after reconnecting the board.

## Local OTA And mDNS

After an initial USB flash, this same visual test can join the local lab Wi-Fi
and advertise `esp32-s3-dualeye.local` through ArduinoOTA's built-in mDNS
service. It remains a bench-only display test; OTA adds no STS route or runtime
embodiment claim.

The tracked [credential example](include/dualeye_config_private.example.h)
documents the local Wi-Fi and optional OTA-password macros. Its private sibling
is ignored by git. With local credentials available, build and upload over Wi-Fi
from the repository root:

```powershell
pio run -d firmware\esp32-s3-dualeye-lcd-1.28 -e esp32-s3-dualeye-ota -t upload
```

An empty OTA password means unauthenticated firmware upload: any host with
network access to it could replace the firmware. This is a trusted-lab setup,
not an untrusted-network service. Set a local OTA password when enabling Wi-Fi
and supply that same password to espota.

## Bring-Up Gate

Before promoting this folder into a live embodiment:

1. Verify each eye independently, then both together, including mirror orientation and backlight behavior.
2. Add the Robot 790 semantic adapter and a receipt-bearing `/state` endpoint.
3. Only then add a selectable runtime embodiment profile.

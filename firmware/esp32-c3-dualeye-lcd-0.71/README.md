# ESP32-C3 DualEye LCD 0.71

Status: **working bench bring-up firmware**. This is an external display module plus a compact ESP32-C3 host, not a self-contained computer board. It is not an active runtime embodiment.

## What Arrived

The module is the Waveshare `0.71inch DualEye LCD Module`:

- two 0.71-inch round IPS displays;
- two 160x160 GC9D01 controllers;
- 4-wire SPI with shared data, clock, and D/C;
- separate chip-select, reset, and backlight signals for each eye;
- 3.3 V or 5 V module power support.

The C3 is a suitable small host for these eyes, but is not a requirement. An S3 or another controller could also drive the SPI module. A C3 would make this a compact dedicated eye actuator while STS remains Eric's deterministic brain.

Vendor reference and C3 demo wiring:

- <https://www.waveshare.com/wiki/0.71inch_DualEye_LCD_Module>
- <https://www.waveshare.com/product/0.71inch-dualeye-lcd-module.htm>

The committed bench wiring card is [WIRING.md](WIRING.md). It is the vendor's
ESP32-C3-Zero mapping, also usable on the connected ESP32-C3 SuperMini-style
board because it exposes every listed GPIO.

## Recorded C3-Zero Wiring

The vendor's ESP32-C3-Zero example maps the module as follows. Treat this as a known-good starting point for that specific host board, not a universal C3 pin assignment. In particular, GPIO 2, 8, and 9 are C3 strapping pins and require a fresh boot-behavior check on any different C3 board.

| Module signal | ESP32-C3 GPIO |
| --- | ---: |
| DIN | 4 |
| CLK | 7 |
| CS1 | 6 |
| CS2 | 2 |
| D/C | 9 |
| RST1 | 8 |
| RST2 | 5 |
| BL1 | 1 |
| BL2 | 3 |

Power is `VCC -> 3V3` and `GND -> GND` for the vendor C3-Zero arrangement.

## Intended Semantic Role

This is a small dual-eye-only body part. A future controller should accept the same eye intent as the larger faces: mood, gaze, blink, wink, style, and bounded idle beats. The GC9D01 geometry, both eye orientations, and all pin work remain inside this embodiment adapter.

It should not be asked to impersonate STS, carry a session, or claim audio, mouth, camera, or motion capabilities it does not have.

## Dual-Eye Smoke Test

`platformio.ini` and `src/main.cpp` are deliberately small visual bring-up
firmware. They contain no STS route, runtime profile, or external tool. The
test turns on both backlights, shows a distinct `EYE 1` / `EYE 2` card, then
draws two animated eyes from off-screen framebuffers. The labels follow the module connector's `CS1` and
`CS2` names; they do not yet assign a physical left or right eye.

Build and upload from the repository root:

```powershell
pio run -d firmware\esp32-c3-dualeye-lcd-0.71
pio run -d firmware\esp32-c3-dualeye-lcd-0.71 -t upload --upload-port COM7
pio device monitor -p COM7 -b 115200
```

`COM7` was the connected C3's port during initial identification and can change
after reconnecting it. The serial output reports only whether the software
initialized each display; the physical screen is the final wiring check.

## Local OTA And mDNS

After an initial USB flash, this same visual test can join the local lab Wi-Fi
and advertise `esp32-c3-dualeye.local` through ArduinoOTA's built-in mDNS
service. It remains a bench-only display test; OTA adds no STS route or runtime
embodiment claim.

The tracked [credential example](include/dualeye_config_private.example.h)
documents the local Wi-Fi and optional OTA-password macros. Its private sibling
is ignored by git. With local credentials available, build and upload over Wi-Fi
from the repository root:

```powershell
pio run -d firmware\esp32-c3-dualeye-lcd-0.71 -e esp32-c3-dualeye-ota -t upload
```

An empty OTA password means unauthenticated firmware upload: any host with
network access to it could replace the firmware. This is a trusted-lab setup,
not an untrusted-network service. Set a local OTA password when enabling Wi-Fi
and supply that same password to espota.

## Bring-Up Gate

Before this becomes a live embodiment:

1. Verify the C3's exact serial port and boot behavior with the attached module.
2. Confirm both eye orientations, physical positions, and backlight behavior.
3. Add a bounded semantic eye adapter.
4. Add a runtime profile only after live state and action receipts exist.

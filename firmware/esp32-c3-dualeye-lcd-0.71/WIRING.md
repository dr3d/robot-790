# C3-Zero To 0.71 DualEye Wiring

This is the direct, vendor-documented wiring plan for the Waveshare `0.71inch DualEye LCD Module` and an `ESP32-C3-Zero` host. Use the `IO<n>` labels printed on the C3 board.

Visual connector reference: [waveshare-0.71-dualeye-connector-pinout-clip.png](media/waveshare-0.71-dualeye-connector-pinout-clip.png).

Power the display from **3V3**, not 5V. Although the display module accepts 3.3 V or 5 V power, the C3's signal logic is 3.3 V and the vendor's C3-Zero example uses its 3V3 rail.

| DualEye module label | Connect to C3-Zero | Purpose |
| --- | --- | --- |
| `VCC` | `3V3` | Display power |
| `GND` | `GND` | Shared ground |
| `DIN` | `IO4` | SPI MOSI data to both eyes |
| `CLK` | `IO7` | SPI clock to both eyes |
| `CS1` | `IO6` | Chip select for EYE1 |
| `CS2` | `IO2` | Chip select for EYE2 |
| `DC` | `IO9` | Shared data/command select |
| `RST1` | `IO8` | Reset for EYE1 |
| `RST2` | `IO5` | Reset for EYE2 |
| `BL1` | `IO1` | Backlight for EYE1 |
| `BL2` | `IO3` | Backlight for EYE2 |

The module's labels are the source of truth. Keep them as `EYE1` and `EYE2` until the first test frame establishes which physical screen should become Eric's left and right eye in the final enclosure.

## Important Constraints

- This consumes nine C3 GPIOs plus power and ground. Do not omit the reset or backlight leads for the first bring-up.
- `IO2`, `IO8`, and `IO9` are ESP32-C3 strapping pins. This exact combination is the vendor's supported C3-Zero example, but do not transplant it blindly to a different C3 board without checking that board's boot wiring.
- Keep USB connected to the C3 for the first power-on and test. Do not connect an external 5 V supply at the same time unless the chosen C3 board's power documentation explicitly supports it.
- The module is output-only SPI: no MISO wire is needed.

## First Power-On Target

The first firmware should do only this, in order:

1. Bring both backlights up at a low safe brightness.
2. Reset EYE1 and EYE2 independently.
3. Draw a clearly different static color/card on each screen.
4. Draw the same simple eye frame on both displays.
5. Record orientation and mirror behavior before adopting the Robot 790 eye renderer.

Source: [Waveshare 0.71inch DualEye LCD Module Wiki](https://www.waveshare.com/wiki/0.71inch_DualEye_LCD_Module).

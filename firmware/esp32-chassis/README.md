# ESP32 Chassis

PlatformIO firmware and bring-up notes for a two-track tractor/tank drive on an ESP32-S3.

This chassis is a self-contained WiFi peer for the robot. The rest of the robot sends intent over UDP; the ESP32-S3 owns the real-time motor loop and safety limits.

## Hardware Target

- ESP32-S3 N16R8
- 2x IBT-2/BTS7960 H-bridge motor drivers
- 2x GM25-370 9V gearmotors
- 12.8V LiFePO4 battery
- 10A inline fuse
- 12/24V to 5V buck supply for the ESP32

## Safety Defaults

- Motor pins are driven to zero at boot.
- Command range is normalized: `-1.0..1.0`.
- `DUTY_CAP = 0.685`, so a full command maps to about 10.0V from a fresh 14.6V LiFePO4 pack.
- Watchdog stop after `400 ms` with no UDP command.
- HTTP tank/twist commands may include `duration_ms`, capped at `5000 ms`, for firmware-timed moves.
- Slew limiting reduces sudden gear shock.
- `E` latches an e-stop. `C` clears it.

## Pin Map

Edit `include/chassis_config.h` before wiring power hardware.

| IBT-2 Signal | Left Track | Right Track |
| --- | ---: |
| RPWM | GPIO6 | GPIO4 |
| LPWM | GPIO7 | GPIO5 |
| R_EN | 3.3V | 3.3V |
| L_EN | 3.3V | 3.3V |
| VCC | 3.3V | 3.3V |
| GND | ESP32 GND | ESP32 GND |
| R_IS / L_IS | not connected in v1 | not connected in v1 |

Bench observation: the physical wiring has the original driver channels crossed. The config maps GPIO6/7 to the logical left track and GPIO4/5 to the logical right track, with the right track inverted so positive commands drive both sides forward.

## Build And Upload

```bash
cd firmware/esp32-chassis
pio run
pio run -t upload
pio device monitor
```

Serial is `115200`.

Before wiring drivers to a new board, use `00_first_flash.ino` as the USB-only smoke test. It holds GPIO4-7 low, prints chip info, connects WiFi, and prints the board IP.

The same safety image is available as a PlatformIO target:

```bash
pio run -e esp32-s3-chassis-first-flash -t upload
```

## UDP Drive API

UDP text commands listen on port `4210`.

| Command | Meaning |
| --- | --- |
| `T <left> <right>` | Tank drive, each `-1.0..1.0` |
| `D <v> <w>` | Twist drive; mixed as `left = v + w`, `right = v - w` |
| `S` | Stop |
| `E` | Latch e-stop |
| `C` | Clear e-stop |

Examples:

```text
T 0.2 0.2
T 0.2 -0.2
D 0.3 0.1
S
```

Stream commands at about 15 Hz while driving. Silence is intentionally treated as stop.

Quick Python test:

```python
import socket, time

s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
target = ("192.168.1.50", 4210)

for _ in range(15):
    s.sendto(b"T 0.4 0.4", target)
    time.sleep(0.066)

s.sendto(b"S", target)
```

The same `T`, `D`, `S`, `E`, and `C` commands also work over USB serial for bench testing. Serial adds `help` and `status`. If WiFi is left empty, the firmware skips WiFi setup and stays serial-only.

## WiFi And HTTP API

WiFi station mode is configured with a private header. Copy:

```bash
cp include/chassis_config_private.example.h include/chassis_config_private.h
```

Then fill in `CHASSIS_WIFI_SSID` and `CHASSIS_WIFI_PASSWORD`. The private header is ignored by git. If WiFi is left empty, the firmware skips WiFi setup and stays serial-only.

When the board connects, serial prints:

```text
robot ip: <ip> port: 4210
HTTP API active
```

Open the browser drive pad:

```text
http://<robot-ip>/
```

The browser page supports touch/mouse control and the browser Gamepad API. With a connected gamepad, the left stick drives forward/back and turn. The page streams tank commands while the stick is outside its deadzone and sends stop when the stick returns to center or the gamepad disconnects. The max-speed slider ranges from `0.45` to `1.00` to avoid wasting travel below the motor/controller movement deadband. The duration slider controls the one-shot Forward, Reverse, Spin Left, and Spin Right buttons. The turn-scale slider ranges from `0.25` to `2.50`; values above `1.00` allow forward-turn commands to blend into counter-rotating spin turns while still respecting the max-speed slider.

The page also includes compact streamed routines: circle, orbit, triangle, back/forth, and dance. The routines use the current UI max-speed slider value for their active moves and short timed segments intended for roughly a 5x5 foot test area, but they are still open-loop. Keep the floor clear and use Stop or E-Stop if the chassis drifts.

The drive pad can show the ESP32 camera MJPEG stream behind the joystick. Use the Camera toggle to start/stop loading `http://<camera-host>:81/stream`; the default host is `esp32-cam.local`. Keeping it toggled off when not driving leaves the camera free for OTA updates.

Robot-facing HTTP endpoints:

| Method | Path | Meaning |
| --- | --- | --- |
| `GET` | `/api/status` | JSON status, targets, current slew values, e-stop, pin map |
| `POST` | `/api/tank?left=<n>&right=<n>[&duration_ms=<ms>]` | tank drive, each `-1.0..1.0`; optional timed hold |
| `POST` | `/api/twist?v=<n>&w=<n>[&duration_ms=<ms>]` | velocity + turn, each `-1.0..1.0`; optional timed hold |
| `POST` | `/api/stop` | stop both tracks |
| `POST` | `/api/estop` | latch e-stop and force outputs off |
| `POST` | `/api/clear` | clear e-stop |

The browser pad streams `/api/tank` commands while touched or dragged. Timed buttons and robot voice commands use `duration_ms` so the ESP32 owns the stop deadline locally. If the browser, WiFi, or robot brain stops sending commands, the firmware watchdog stops the tracks after `COMMAND_TIMEOUT_MS`.

## OTA Updates

After the OTA-enabled firmware has been flashed once over USB, future updates can be sent over WiFi:

```bash
pio run -e esp32-s3-chassis-ota -t upload
```

The OTA hostname is `esp32-chassis`, and the default upload target is `esp32-chassis.local`. If mDNS is unavailable on your network, pass the board IP explicitly:

```bash
pio run -e esp32-s3-chassis-ota -t upload --upload-port <robot-ip>
```

OTA start/end/error handlers force motor outputs off, but motor power should still be disconnected for firmware updates whenever practical.

## Reference Files

- `00_first_flash.ino`: first safe flash for a bare ESP32-S3.
- `chassis_drive.ino`: original Arduino sketch for the UDP/BTS7960 drive.
- `chassis-build-reference.md`: hardware, power, wiring, and bring-up notes.

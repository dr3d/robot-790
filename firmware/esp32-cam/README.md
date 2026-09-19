# ESP32 Camera

PlatformIO firmware for an M5Stack ESP32 TimerCam / TimerCamera used as an optional Reachy Mini chassis camera.

The firmware joins Wi-Fi, serves a compact browser page with a live MJPEG camera view, exposes a single JPEG capture endpoint, and supports OTA updates after the first USB flash.

## Hardware Target

- M5Stack TimerCam / TimerCamera
- ESP32 with PSRAM
- OV3660 camera sensor

This is tuned for motion over resolution: QVGA MJPEG, small JPEG frames, and PSRAM buffering. The TimerCam is useful as a low-latency robot view, but weak Wi-Fi or high resolutions will quickly turn it into a slideshow.

## Build And Upload

Use PlatformIO from this folder:

```bash
cd firmware/esp32-cam
pio run
pio run -t upload
pio device monitor
```

Serial is `115200`.

## Wi-Fi And Private Config

For local Wi-Fi credentials, copy:

```bash
cp include/cam_config_private.example.h include/cam_config_private.h
```

Then fill in `CAM_WIFI_SSID` and `CAM_WIFI_PASSWORD`. The private header is ignored by git.

If compile-time Wi-Fi credentials are left empty, the board starts a camera access point instead:

```text
SSID: ReachyCam
Password: reachycam
URL: http://192.168.4.1/
```

When station Wi-Fi succeeds, the serial monitor prints the LAN address:

```text
Camera IP: 192.168.x.x
Camera UI: http://192.168.x.x/
mDNS URL: http://esp32-cam.local/
```

Use the printed IP if `.local` name resolution is unavailable on your computer or network.

## Browser Camera Page

Open:

```text
http://esp32-cam.local/
```

or the printed IP address. Routes:

| Method | Path | Meaning |
| --- | --- | --- |
| `GET` | `/` | live camera page |
| `GET` | `/jpg` | single JPEG frame |
| `GET` | `/status` | plain text status |
| `GET` | `:81/stream` | MJPEG stream used by the page |

The chassis browser pad can show this stream behind the joystick when its Camera toggle is enabled. The default expected stream URL is:

```text
http://esp32-cam.local:81/stream
```

## STS Integration

STS has an ESP32 Camera section below Browser Live Camera. Preview polls still
frames through the local page helper; Capture To Eye saves and stages one for
Eric. Preview alone does not supply model context. The matching tools are
`set_esp32_camera` and `capture_esp32_camera`; Disconnect stops STS requests,
not power to the camera.

Configure the camera origin, rotation and polling interval in `esp32_camera`
inside the repository's `config/runtime.json`. The helper uses `/jpg`, not the
MJPEG stream. Close the standalone live viewer or chassis camera view first:
the firmware's blocking stream loop can prevent snapshots and status requests
from being served while another viewer holds the stream open.

## OTA Updates

After the OTA-enabled firmware has been flashed once over USB, future updates can be sent over Wi-Fi:

```bash
pio run -e timer-cam-ota -t upload
```

The OTA hostname is `esp32-cam`, and the default upload target is `esp32-cam.local`. If mDNS is unavailable on your network, pass the board IP explicitly:

```bash
pio run -e timer-cam-ota -t upload --upload-port <camera-ip>
```

OTA stops the HTTP and stream servers while the update is in progress.

## Camera Tuning

Camera tuning defaults enable the OV3660 raw gamma correction path, lens correction,
automatic exposure and gain, and a mild `+1` brightness lift. Automatic exposure
replaces the former fixed value of 220 so the camera can adapt to a dim room;
longer exposure can trade motion sharpness for visibility. QVGA, JPEG quality,
gain ceiling, image orientation and the secondary AEC setting are unchanged.
`/status` reports brightness, contrast, `raw_gma`, `lenc`, `aec`, `aec2`, and `agc`.
`aec=1` confirms automatic exposure is enabled; `aec2=0` does not disable the
primary exposure controller.

September 19, 2026: this auto-exposure build was flashed successfully over OTA to
the lab TimerCam. Its post-reboot `/status` reports `aec=1`, `aec2=0`, `agc=1`,
and both direct `/jpg` and STS snapshot capture were verified. The local rollback
source and pre-change build are kept in
`logs/maintenance/20260919-timercam-auto-exposure/` at the repository root.
Close standalone MJPEG viewers before attempting OTA; they block the firmware's
main loop. No STS restart is needed for an exposure-only firmware change.

## ESP32-S3 Touch LCD Camera Notes

A second camera-capable ESP32-S3 board was inspected over USB but not flashed. Keep the TimerCam firmware above as the known-working chassis camera until this board gets its own firmware target or MicroPython service.

Observed USB modes:

| Mode | Port Seen | USB ID | Notes |
| --- | --- | --- | --- |
| MicroPythonOS app | `COM19` | `303A:4001` | Native USB serial/JTAG CDC device. |
| ROM bootloader | `COM17` | `303A:1001` | Entered manually with BOOT/RESET. |

Hardware identity from `esptool`:

```text
Chip: ESP32-S3 QFN56 rev v0.2
Flash: 16 MB, quad, 3.3V
PSRAM: 8 MB embedded
USB mode: USB-Serial/JTAG
MAC: cc:ba:97:04:a7:ac
```

MicroPythonOS identity:

```text
Build: MicroPythonOS, MicroPython 3.4.0, 2026-08-04 custom build
Board module: waveshare_esp32_s3_touch_lcd_2
Wi-Fi: joins the LAN through saved MicroPythonOS preferences
Camera app: com.micropythonos.camera 0.4.1
```

The MicroPythonOS camera manager reports one camera:

```text
Sensor: OV5640
Vendor: OmniVision
Facing: back
Rotation: -90 degrees
```

The built-in MicroPython `camera` module exposes JPEG/RGB capture, many frame sizes, and sensor controls such as quality, brightness, contrast, exposure, gain, mirror, and flip. No HTTP/MJPEG service was listening on ports `80`, `8080`, `8000`, `5000`, or `8266` during the inspection, so this board is not currently a drop-in replacement for the TimerCam chassis stream.

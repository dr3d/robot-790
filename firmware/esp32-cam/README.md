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

Camera tuning defaults enable the OV3660 raw gamma correction path, lens correction, fixed exposure, and a mild `+1` brightness lift. `/status` reports the active brightness, contrast, `raw_gma`, and `lenc` values.

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

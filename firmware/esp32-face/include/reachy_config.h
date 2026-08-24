#pragma once

// Edit these pins for your ESP32-S3 wiring. The three-display layout shares
// SCLK/MOSI/DC/RST across all displays and gives each display its own CS.
#define REACHY_SHARED_SCLK 4
#define REACHY_SHARED_MOSI 5
#define REACHY_SHARED_DC 6
#define REACHY_SHARED_RST 7

#define REACHY_LEFT_SCLK REACHY_SHARED_SCLK
#define REACHY_LEFT_MOSI REACHY_SHARED_MOSI
#define REACHY_LEFT_RST REACHY_SHARED_RST
#define REACHY_LEFT_CS 15
#define REACHY_LEFT_DC REACHY_SHARED_DC

#define REACHY_RIGHT_SCLK REACHY_SHARED_SCLK
#define REACHY_RIGHT_MOSI REACHY_SHARED_MOSI
#define REACHY_RIGHT_RST REACHY_SHARED_RST
#define REACHY_RIGHT_CS 16
#define REACHY_RIGHT_DC REACHY_SHARED_DC

#define REACHY_MOUTH_SCLK REACHY_SHARED_SCLK
#define REACHY_MOUTH_MOSI REACHY_SHARED_MOSI
#define REACHY_MOUTH_RST REACHY_SHARED_RST
#define REACHY_MOUTH_CS 17
#define REACHY_MOUTH_DC REACHY_SHARED_DC

// Optional fourth rectangular 240x320 SPI TFT. It shares the display bus and
// gets its own chip-select line.
#define REACHY_AUX_SCLK REACHY_SHARED_SCLK
#define REACHY_AUX_MOSI REACHY_SHARED_MOSI
#define REACHY_AUX_RST REACHY_SHARED_RST
#define REACHY_AUX_CS 18
#define REACHY_AUX_DC REACHY_SHARED_DC

// Set to 0 to keep REACHY_AUX_CS driven HIGH while skipping aux TFT init/draw.
#ifndef REACHY_AUX_DISPLAY_ENABLED
#define REACHY_AUX_DISPLAY_ENABLED 1
#endif

#define REACHY_AUX_ROLE_STATUS 0
#define REACHY_AUX_ROLE_MOUTH_MIRROR 1
#define REACHY_AUX_ROLE_MOUTH_ONLY 2

// Default to the rectangular mouth and idle the round mouth to save display time.
#ifndef REACHY_AUX_ROLE
#define REACHY_AUX_ROLE REACHY_AUX_ROLE_MOUTH_ONLY
#endif

// When the rectangular aux display is the mouth, reuse the old round mouth as a
// slow status display. Set to 0 to leave GPIO17 black/idle.
#ifndef REACHY_MOUTH_STATUS_WHEN_AUX_MOUTH
#define REACHY_MOUTH_STATUS_WHEN_AUX_MOUTH 1
#endif

#if __has_include("reachy_config_private.h")
#include "reachy_config_private.h"
#endif

// Leave station credentials empty to boot as an access point.
#ifndef REACHY_WIFI_SSID
#define REACHY_WIFI_SSID ""
#endif

#ifndef REACHY_WIFI_PASSWORD
#define REACHY_WIFI_PASSWORD ""
#endif

#ifndef REACHY_AP_SSID
#define REACHY_AP_SSID "ReachyEyes-S3"
#endif

#ifndef REACHY_AP_PASSWORD
#define REACHY_AP_PASSWORD "reachyeyes"
#endif

#ifndef REACHY_AP_ALWAYS_ON
#define REACHY_AP_ALWAYS_ON 0
#endif

#ifndef REACHY_HOSTNAME
#define REACHY_HOSTNAME "esp32-eyes"
#endif

#ifndef REACHY_SPI_HZ
#define REACHY_SPI_HZ 40000000
#endif

#ifndef REACHY_FRAME_MS
#define REACHY_FRAME_MS 16
#endif

// Set to 0 to boot with the Wi-Fi radio fully off.
#ifndef REACHY_WIFI_ENABLED
#define REACHY_WIFI_ENABLED 1
#endif

// Set to 0 to keep Wi-Fi on. A finite window can reduce display power noise.
#ifndef REACHY_WIFI_WINDOW_MS
#define REACHY_WIFI_WINDOW_MS 0
#endif

#ifndef REACHY_EMOTION_MIN_S
#define REACHY_EMOTION_MIN_S 5
#endif

#ifndef REACHY_EMOTION_MAX_S
#define REACHY_EMOTION_MAX_S 45
#endif

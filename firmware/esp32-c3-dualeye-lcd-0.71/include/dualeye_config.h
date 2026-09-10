#pragma once

#include <Arduino.h>

#if __has_include("dualeye_config_private.h")
#include "dualeye_config_private.h"
#endif

#ifndef DUALEYE_WIFI_SSID
#define DUALEYE_WIFI_SSID ""
#endif

#ifndef DUALEYE_WIFI_PASSWORD
#define DUALEYE_WIFI_PASSWORD ""
#endif

#ifndef DUALEYE_OTA_PASSWORD
#define DUALEYE_OTA_PASSWORD ""
#endif

namespace dualeye {

// Waveshare's ESP32-C3 reference wiring. Keep physical pin choices here.
constexpr int8_t kMosi = 4;
constexpr int8_t kClock = 7;
constexpr int8_t kEye1Cs = 6;
constexpr int8_t kEye2Cs = 2;
constexpr int8_t kDataCommand = 9;
constexpr int8_t kEye1Reset = 8;
constexpr int8_t kEye2Reset = 5;
constexpr int8_t kEye1Backlight = 1;
constexpr int8_t kEye2Backlight = 3;

constexpr uint32_t kSpiFrequencyHz = 40000000;
constexpr uint8_t kEye1Rotation = 0;
constexpr uint8_t kEye2Rotation = 0;
constexpr bool kGc9d01Inverted = false;

constexpr char kOtaHostname[] = "esp32-c3-dualeye";

}  // namespace dualeye

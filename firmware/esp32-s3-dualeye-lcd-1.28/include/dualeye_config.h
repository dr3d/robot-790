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

namespace dualeye_s3 {

// Waveshare ESP32-S3 DualEye LCD 1.28 reference wiring.
constexpr int8_t kMosi = 42;
constexpr int8_t kMiso = 40;
constexpr int8_t kClock = 41;
constexpr int8_t kDataCommand = 45;
constexpr int8_t kPrimaryCs = 47;
constexpr int8_t kPrimaryReset = 48;
constexpr int8_t kPrimaryBacklight = 46;
constexpr int8_t kSecondaryCs = 38;
constexpr int8_t kSecondaryReset = 8;
constexpr int8_t kSecondaryBacklight = 39;

constexpr int16_t kDisplaySize = 240;
constexpr uint32_t kSpiFrequencyHz = 80000000;

// The vendor display configuration swaps axes on both screens. These two
// rotations give the two physical panels complementary orientation for eyes.
constexpr uint8_t kPrimaryRotation = 1;
constexpr uint8_t kSecondaryRotation = 3;
constexpr bool kGc9a01Inverted = true;

constexpr char kOtaHostname[] = "esp32-s3-dualeye";

}  // namespace dualeye_s3

#pragma once

// ESP32-S3 tracked chassis controller.
// Hardware target: 2x IBT-2/BTS7960 drivers + 2x GM25-370 9V gearmotors.
// Each driver uses two PWM inputs:
//   RPWM = forward drive, LPWM = reverse drive.
// R_EN, L_EN, and VCC are tied to 3.3V in hardware for v1.

#if __has_include("chassis_config_private.h")
#include "chassis_config_private.h"
#endif

// Leave station credentials empty to keep the chassis serial-only.
#ifndef CHASSIS_WIFI_SSID
#define CHASSIS_WIFI_SSID ""
#endif

#ifndef CHASSIS_WIFI_PASSWORD
#define CHASSIS_WIFI_PASSWORD ""
#endif

#ifndef CHASSIS_OTA_HOSTNAME
#define CHASSIS_OTA_HOSTNAME "esp32-chassis"
#endif

#ifndef CHASSIS_OTA_PASSWORD
#define CHASSIS_OTA_PASSWORD ""
#endif

static constexpr const char* WIFI_SSID = CHASSIS_WIFI_SSID;
static constexpr const char* WIFI_PASS = CHASSIS_WIFI_PASSWORD;
static constexpr const char* OTA_HOSTNAME = CHASSIS_OTA_HOSTNAME;
static constexpr const char* OTA_PASSWORD = CHASSIS_OTA_PASSWORD;
static constexpr uint16_t UDP_PORT = 4210;
static constexpr uint16_t HTTP_PORT = 80;

// Bench wiring maps GPIO6/7 to logical left and GPIO4/5 to logical right.
static constexpr int PIN_LEFT_RPWM = 6;
static constexpr int PIN_LEFT_LPWM = 7;
static constexpr int PIN_RIGHT_RPWM = 4;
static constexpr int PIN_RIGHT_LPWM = 5;

static constexpr bool LEFT_INVERTED = false;
static constexpr bool RIGHT_INVERTED = true;

static constexpr int PWM_FREQ = 20000;
static constexpr int PWM_RES_BITS = 10;
static constexpr int PWM_MAX = (1 << PWM_RES_BITS) - 1;

static constexpr int CH_LEFT_RPWM = 0;
static constexpr int CH_LEFT_LPWM = 1;
static constexpr int CH_RIGHT_RPWM = 2;
static constexpr int CH_RIGHT_LPWM = 3;

// A 4S LiFePO4 pack is about 14.6V fresh off the charger.
// 10 / 14.6 ~= 0.685, so full command stays near a 10V effective ceiling.
static constexpr float DUTY_CAP = 0.685f;

// Stop the tracks if no command arrives inside this window.
static constexpr unsigned long COMMAND_TIMEOUT_MS = 400;
static constexpr unsigned long MAX_TIMED_DRIVE_MS = 5000;

// 50 Hz control loop. Each tick limits normalized speed changes by this amount.
static constexpr unsigned long CONTROL_TICK_MS = 20;
static constexpr float SLEW_PER_TICK = 0.04f;
static constexpr float TURN_SCALE = 1.0f;

#pragma once

// M5Stack TimerCam / TimerCamera OV3660 camera firmware.

#if __has_include("cam_config_private.h")
#include "cam_config_private.h"
#endif

// Leave station credentials empty to boot as a camera setup access point.
#ifndef CAM_WIFI_SSID
#define CAM_WIFI_SSID ""
#endif

#ifndef CAM_WIFI_PASSWORD
#define CAM_WIFI_PASSWORD ""
#endif

#ifndef CAM_AP_SSID
#define CAM_AP_SSID "ReachyCam"
#endif

#ifndef CAM_AP_PASSWORD
#define CAM_AP_PASSWORD "reachycam"
#endif

#ifndef CAM_OTA_HOSTNAME
#define CAM_OTA_HOSTNAME "esp32-cam"
#endif

#ifndef CAM_OTA_PASSWORD
#define CAM_OTA_PASSWORD ""
#endif

static constexpr const char* WIFI_SSID = CAM_WIFI_SSID;
static constexpr const char* WIFI_PASSWORD = CAM_WIFI_PASSWORD;
static constexpr const char* AP_SSID = CAM_AP_SSID;
static constexpr const char* AP_PASSWORD = CAM_AP_PASSWORD;
static constexpr const char* OTA_HOSTNAME = CAM_OTA_HOSTNAME;
static constexpr const char* OTA_PASSWORD = CAM_OTA_PASSWORD;

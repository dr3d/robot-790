#pragma once

// A local-only companion for dualeye_config.h. The corresponding private
// header is ignored by git so Wi-Fi and OTA credentials never enter the repo.
#define DUALEYE_WIFI_SSID "Your WiFi SSID"
#define DUALEYE_WIFI_PASSWORD "Your WiFi password"

// Optional on a trusted lab LAN. If set, provide the same value to espota
// when uploading over Wi-Fi.
#define DUALEYE_OTA_PASSWORD ""

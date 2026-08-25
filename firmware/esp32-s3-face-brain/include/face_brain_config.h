#pragma once

// Robot 790 V2 integrated face brain.
// Target board: Waveshare ESP32-S3-Touch-LCD-2 style 240x320 ST7789T3 board.

#define FACE_HOSTNAME "esp32-face"

// ST7789T3 display, from the Waveshare Arduino_GFX example.
#define FACE_LCD_SCLK 39
#define FACE_LCD_MOSI 38
#define FACE_LCD_MISO 40
#define FACE_LCD_DC 42
#define FACE_LCD_RST -1
#define FACE_LCD_CS 45
#define FACE_LCD_BL 1
#define FACE_LCD_WIDTH 240
#define FACE_LCD_HEIGHT 320
#define FACE_LCD_ROTATION 1

// Shared onboard I2C bus for touch and IMU.
#define FACE_I2C_SDA 48
#define FACE_I2C_SCL 47
#define FACE_CST816_ADDR 0x15
#define FACE_QMI8658_ADDR 0x6B

// MicroSD shares the display SPI pins.
#define FACE_SD_CS 41

// OV5640/OV2640 camera connector, from the Waveshare factory camera app.
#define FACE_CAM_PWDN 17
#define FACE_CAM_RESET -1
#define FACE_CAM_XCLK 8
#define FACE_CAM_SIOD 21
#define FACE_CAM_SIOC 16
#define FACE_CAM_D0 12
#define FACE_CAM_D1 13
#define FACE_CAM_D2 15
#define FACE_CAM_D3 11
#define FACE_CAM_D4 14
#define FACE_CAM_D5 10
#define FACE_CAM_D6 7
#define FACE_CAM_D7 2
#define FACE_CAM_VSYNC 6
#define FACE_CAM_HREF 4
#define FACE_CAM_PCLK 9

// Optional external round eye TFTs. This mapping sacrifices the onboard camera
// pins and keeps the built-in 240x320 screen free for mouth/status rendering.
#ifndef FACE_EXTERNAL_EYES_ENABLED
#define FACE_EXTERNAL_EYES_ENABLED 1
#endif

#define FACE_EYE_SCLK 9
#define FACE_EYE_MOSI 14
#define FACE_EYE_MISO -1
#define FACE_EYE_DC 12
#define FACE_EYE_RST 11
#define FACE_EYE_LEFT_CS 13
#define FACE_EYE_RIGHT_CS 15
#define FACE_EYE_WIDTH 240
#define FACE_EYE_HEIGHT 240
#define FACE_EYE_ROTATION 2

#if __has_include("face_brain_config_private.h")
#include "face_brain_config_private.h"
#endif

#ifndef FACE_WIFI_SSID
#define FACE_WIFI_SSID ""
#endif

#ifndef FACE_WIFI_PASSWORD
#define FACE_WIFI_PASSWORD ""
#endif

#ifndef FACE_AP_SSID
#define FACE_AP_SSID "Robot790-Face"
#endif

#ifndef FACE_AP_PASSWORD
#define FACE_AP_PASSWORD "robot790"
#endif

#ifndef FACE_OTA_PASSWORD
#define FACE_OTA_PASSWORD ""
#endif

// Keep first bring-up conservative. Enable these after display/I2C/Wi-Fi are
// known-good on the board.
#ifndef FACE_ENABLE_SD_PROBE
#define FACE_ENABLE_SD_PROBE 0
#endif

#ifndef FACE_ENABLE_CAMERA_PROBE
#define FACE_ENABLE_CAMERA_PROBE 0
#endif

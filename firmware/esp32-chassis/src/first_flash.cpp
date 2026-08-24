#include <Arduino.h>
#include <WiFi.h>
#include "chassis_config.h"

static constexpr int MOTOR_PINS[] = {
  PIN_LEFT_RPWM,
  PIN_LEFT_LPWM,
  PIN_RIGHT_RPWM,
  PIN_RIGHT_LPWM,
};

static bool wifiConfigured() {
  return strlen(WIFI_SSID) > 0 && strcmp(WIFI_SSID, "YOUR_SSID") != 0;
}

static void forceMotorPinsLow() {
  for (int pin : MOTOR_PINS) {
    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW);
  }
}

static void maybeConnectWifi() {
  if (!wifiConfigured()) {
    Serial.println(F("wifi not configured; safety flash is still active"));
    return;
  }

  Serial.print(F("wifi connecting"));
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  for (int tries = 0; WiFi.status() != WL_CONNECTED && tries < 40; ++tries) {
    forceMotorPinsLow();
    delay(300);
    Serial.print('.');
  }

  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print(F("wifi ok ip="));
    Serial.print(WiFi.localIP());
    Serial.print(F(" rssi="));
    Serial.println(WiFi.RSSI());
  } else {
    Serial.println(F("wifi failed; check 2.4GHz SSID/password"));
  }
}

void setup() {
  forceMotorPinsLow();

  Serial.begin(115200);
  delay(1500);

  forceMotorPinsLow();
  Serial.println();
  Serial.println(F("=== ESP32-S3 chassis first flash OK ==="));
  Serial.print(F("chip="));
  Serial.print(ESP.getChipModel());
  Serial.print(F(" cores="));
  Serial.println(ESP.getChipCores());
  Serial.print(F("flash_mb="));
  Serial.print(ESP.getFlashChipSize() / (1024 * 1024));
  Serial.print(F(" free_heap="));
  Serial.println(ESP.getFreeHeap());
  Serial.print(F("motor pins forced LOW: "));
  Serial.print(PIN_LEFT_RPWM);
  Serial.print(',');
  Serial.print(PIN_LEFT_LPWM);
  Serial.print(',');
  Serial.print(PIN_RIGHT_RPWM);
  Serial.print(',');
  Serial.println(PIN_RIGHT_LPWM);

  maybeConnectWifi();
}

void loop() {
  static uint32_t heartbeat = 0;
  forceMotorPinsLow();
  Serial.print(F("safe heartbeat="));
  Serial.print(heartbeat++);
  Serial.print(F(" wifi="));
  Serial.print(WiFi.status() == WL_CONNECTED ? F("up") : F("down"));
  Serial.println(F(" motor_pins=low"));
  delay(2000);
}

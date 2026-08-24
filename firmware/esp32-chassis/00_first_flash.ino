// 00_first_flash.ino
// FIRST sketch for a brand-new ESP32-S3. Flash this before anything else.
//
// What it does:
//   1. Forces all four motor-driver PWM pins LOW immediately at boot,
//      so the board is in a known-safe state even if a driver is wired.
//   2. Proves USB/serial works (prints heartbeat).
//   3. Connects to WiFi and prints the IP you'll need later.
//   4. Blinks nothing, drives nothing, moves nothing.
//
// Flash this with NOTHING connected but USB. Confirm serial output.
// Only then wire the drivers.

#include <WiFi.h>

const char* WIFI_SSID = "YOUR_SSID";
const char* WIFI_PASS = "YOUR_PASS";

// Motor pins — held LOW so nothing can spin.
const int MOTOR_PINS[] = {4, 5, 6, 7};

void setup() {
  // Safety first: pin the motor lines low before anything else runs.
  for (int p : MOTOR_PINS) {
    pinMode(p, OUTPUT);
    digitalWrite(p, LOW);
  }

  Serial.begin(115200);
  delay(2000);              // give USB-CDC time to enumerate on the S3
  Serial.println();
  Serial.println("=== ESP32-S3 first flash OK ===");
  Serial.printf("chip: %s   cores: %d\n", ESP.getChipModel(), ESP.getChipCores());
  Serial.printf("flash: %u MB   free heap: %u\n",
                ESP.getFlashChipSize() / (1024 * 1024), ESP.getFreeHeap());
  Serial.println("motor pins 4,5,6,7 forced LOW");

  Serial.print("wifi connecting");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 40) {
    delay(300); Serial.print("."); tries++;
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf(">>> WIFI OK   IP: %s   RSSI: %d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
    Serial.println(">>> write this IP down — you need it to drive the robot");
  } else {
    Serial.println("!!! wifi failed — check SSID/PASS (2.4GHz only)");
  }
}

void loop() {
  static uint32_t n = 0;
  Serial.printf("alive %lu   wifi:%s   motor pins low\n",
                n++, WiFi.status() == WL_CONNECTED ? "up" : "down");
  delay(2000);
}

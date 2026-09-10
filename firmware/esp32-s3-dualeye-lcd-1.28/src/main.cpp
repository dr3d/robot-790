#include <Arduino.h>
#include <ArduinoOTA.h>
#include <Arduino_GFX_Library.h>
#include <WiFi.h>

#include "dualeye_config.h"

using namespace dualeye_s3;

namespace {

constexpr uint16_t kSpace = RGB565(4, 10, 18);
constexpr uint16_t kRim = RGB565(10, 39, 58);
constexpr uint16_t kSclera = RGB565(232, 247, 248);
constexpr uint16_t kIrisOuter = RGB565(0, 83, 123);
constexpr uint16_t kIrisMid = RGB565(0, 169, 209);
constexpr uint16_t kIrisCore = RGB565(86, 239, 246);
constexpr uint16_t kPupil = RGB565(1, 8, 16);
constexpr uint16_t kGlint = RGB565(249, 255, 254);

Arduino_DataBus *primaryBus = new Arduino_ESP32SPI(
    kDataCommand, kPrimaryCs, kClock, kMosi, kMiso, FSPI);
Arduino_DataBus *secondaryBus = new Arduino_ESP32SPI(
    kDataCommand, kSecondaryCs, kClock, kMosi, kMiso, FSPI);

Arduino_GFX *primaryEye = new Arduino_GC9A01(
    primaryBus, kPrimaryReset, kPrimaryRotation, kGc9a01Inverted);
Arduino_GFX *secondaryEye = new Arduino_GC9A01(
    secondaryBus, kSecondaryReset, kSecondaryRotation, kGc9a01Inverted);

// One reusable full-frame canvas is enough because the two eyes are rendered
// and sent serially over the shared SPI bus.
Arduino_Canvas eyeFrame(kDisplaySize, kDisplaySize, primaryEye);

bool primaryReady = false;
bool secondaryReady = false;
bool frameReady = false;
bool wifiConnecting = false;
bool otaReady = false;
uint32_t lastFrameAt = 0;
uint32_t wifiStartedAt = 0;

constexpr uint32_t kWifiConnectTimeoutMs = 15000;

void startNetwork() {
  if (DUALEYE_WIFI_SSID[0] == '\0') {
    Serial.println("WiFi disabled: no local credentials.");
    return;
  }

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setHostname(kOtaHostname);
  WiFi.begin(DUALEYE_WIFI_SSID, DUALEYE_WIFI_PASSWORD);
  wifiConnecting = true;
  wifiStartedAt = millis();
  Serial.printf("Joining WiFi for %s.local OTA...\n", kOtaHostname);
}

void serviceNetwork() {
  if (otaReady || !wifiConnecting) {
    return;
  }

  if (WiFi.status() == WL_CONNECTED) {
    ArduinoOTA.setHostname(kOtaHostname);
    if (DUALEYE_OTA_PASSWORD[0] != '\0') {
      ArduinoOTA.setPassword(DUALEYE_OTA_PASSWORD);
    }
    ArduinoOTA.onStart([]() { Serial.println("OTA update starting."); });
    ArduinoOTA.onEnd([]() { Serial.println("OTA update complete."); });
    ArduinoOTA.onError([](ota_error_t error) {
      Serial.printf("OTA error: %u\n", static_cast<unsigned int>(error));
    });
    ArduinoOTA.begin();
    otaReady = true;
    wifiConnecting = false;
    const String address = WiFi.localIP().toString();
    Serial.printf("OTA ready: %s.local (%s)\n", kOtaHostname, address.c_str());
    return;
  }

  if (millis() - wifiStartedAt >= kWifiConnectTimeoutMs) {
    wifiConnecting = false;
    Serial.println("WiFi unavailable: OTA disabled for this boot.");
  }
}

float smoothstep(float value) {
  value = constrain(value, 0.0f, 1.0f);
  return value * value * (3.0f - 2.0f * value);
}

float blinkAmount(uint32_t now, bool secondary) {
  const uint32_t stagger = secondary ? 37 : 0;
  const uint32_t phase = (now + stagger) % 7400;
  if (phase > 320) {
    return 0.0f;
  }
  const float edge = phase < 160 ? phase / 160.0f : (320 - phase) / 160.0f;
  return smoothstep(edge);
}

void present(Arduino_GFX *display) {
  display->draw16bitRGBBitmap(
      0, 0, eyeFrame.getFramebuffer(), kDisplaySize, kDisplaySize);
}

void drawBootCard(const char *label, uint16_t accent) {
  const int16_t center = kDisplaySize / 2;
  eyeFrame.fillScreen(kSpace);
  eyeFrame.drawCircle(center, center, 112, accent);
  eyeFrame.drawCircle(center, center, 106, kRim);
  eyeFrame.setTextColor(accent, kSpace);
  eyeFrame.setTextSize(3);
  eyeFrame.setCursor(center - 62, center - 18);
  eyeFrame.print(label);
  eyeFrame.setTextSize(1);
  eyeFrame.setCursor(center - 59, center + 20);
  eyeFrame.print("ROBOT 790 / GC9A01");
}

void drawLids(float closed) {
  constexpr int16_t center = kDisplaySize / 2;
  const float topCenter = 42.0f + (center - 42.0f) * closed;
  const float bottomCenter = 198.0f + (center - 198.0f) * closed;

  for (int16_t x = 0; x < kDisplaySize; ++x) {
    const float fromCenter = (x - center) / float(center);
    const float curve = fromCenter * fromCenter * 38.0f;
    const int16_t top = int16_t(topCenter + curve * (1.0f - closed));
    const int16_t bottom = int16_t(bottomCenter - curve * (1.0f - closed));
    if (top > 0) {
      eyeFrame.drawFastVLine(x, 0, top, kSpace);
    }
    if (bottom < kDisplaySize) {
      eyeFrame.drawFastVLine(x, bottom, kDisplaySize - bottom, kSpace);
    }
  }
}

void drawEye(uint32_t now, bool secondary) {
  constexpr int16_t center = kDisplaySize / 2;
  const float time = now * 0.00034f;
  const float gazeX = sinf(time) * 22.0f + sinf(time * 0.37f) * 8.0f;
  const float gazeY = cosf(time * 0.79f) * 12.0f;
  const int16_t irisX = center + int16_t(gazeX + (secondary ? -1 : 1));
  const int16_t irisY = center + int16_t(gazeY);
  const int16_t pupilRadius = 30 + int16_t((sinf(time * 0.48f) + 1.0f) * 3.0f);

  // Everything here is drawn into RAM. The physical LCD only sees the final frame.
  eyeFrame.fillScreen(kSpace);
  eyeFrame.fillCircle(center, center, 118, kRim);
  eyeFrame.fillCircle(center, center, 114, kSpace);
  eyeFrame.fillEllipse(center, center, 109, 78, kSclera);
  eyeFrame.fillEllipse(center, center + 3, 102, 68, WHITE);

  eyeFrame.fillCircle(irisX, irisY, 62, kIrisOuter);
  eyeFrame.fillCircle(irisX, irisY, 54, kIrisMid);
  eyeFrame.fillCircle(irisX, irisY, 42, kIrisCore);
  for (uint8_t ray = 0; ray < 28; ++ray) {
    const float angle = (2.0f * PI * ray) / 28.0f;
    const float wobble = 3.0f * sinf(time * 2.0f + ray);
    eyeFrame.drawLine(
        irisX + int16_t(cosf(angle) * (pupilRadius + 4)),
        irisY + int16_t(sinf(angle) * (pupilRadius + 4)),
        irisX + int16_t(cosf(angle) * (56.0f + wobble)),
        irisY + int16_t(sinf(angle) * (56.0f + wobble)),
        RGB565(0, 113, 156));
  }
  eyeFrame.drawCircle(irisX, irisY, 63, RGB565(45, 221, 235));
  eyeFrame.fillCircle(irisX, irisY, pupilRadius + 3, kPupil);
  eyeFrame.fillCircle(irisX - pupilRadius / 3, irisY - pupilRadius / 3, 10, kGlint);
  eyeFrame.fillCircle(irisX + pupilRadius / 2, irisY - pupilRadius / 7, 4, kGlint);
  eyeFrame.drawCircle(irisX, irisY, pupilRadius + 5, RGB565(6, 36, 57));
  drawLids(blinkAmount(now, secondary));
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println();
  Serial.println("Robot 790 S3 DualEye visual bring-up");

  pinMode(kPrimaryBacklight, OUTPUT);
  pinMode(kSecondaryBacklight, OUTPUT);
  pinMode(kPrimaryCs, OUTPUT);
  pinMode(kSecondaryCs, OUTPUT);
  digitalWrite(kPrimaryBacklight, HIGH);
  digitalWrite(kSecondaryBacklight, HIGH);
  digitalWrite(kPrimaryCs, HIGH);
  digitalWrite(kSecondaryCs, HIGH);

  primaryReady = primaryEye->begin(kSpiFrequencyHz);
  secondaryReady = secondaryEye->begin(kSpiFrequencyHz);
  frameReady = eyeFrame.begin(GFX_SKIP_OUTPUT_BEGIN);

  Serial.printf("Primary eye: %s\n", primaryReady ? "ok" : "failed");
  Serial.printf("Secondary eye: %s\n", secondaryReady ? "ok" : "failed");
  Serial.printf("Frame buffer: %s\n", frameReady ? "ok" : "failed");

  if (frameReady && primaryReady) {
    drawBootCard("PRIMARY", kIrisCore);
    present(primaryEye);
  }
  if (frameReady && secondaryReady) {
    drawBootCard("SECOND", kIrisMid);
    present(secondaryEye);
  }

  startNetwork();
  delay(1600);
  Serial.println("Dual-eye animation running.");
}

void loop() {
  serviceNetwork();
  if (otaReady) {
    ArduinoOTA.handle();
  }

  if (!frameReady || (!primaryReady && !secondaryReady) || millis() - lastFrameAt < 90) {
    return;
  }

  lastFrameAt = millis();
  if (primaryReady) {
    drawEye(lastFrameAt, false);
    present(primaryEye);
  }
  if (secondaryReady) {
    drawEye(lastFrameAt, true);
    present(secondaryEye);
  }
}

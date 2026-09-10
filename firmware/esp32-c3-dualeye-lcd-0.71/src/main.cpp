#include <Arduino.h>
#include <ArduinoOTA.h>
#include <Arduino_GFX_Library.h>
#include <WiFi.h>

#include "dualeye_config.h"

using namespace dualeye;

Arduino_DataBus *eye1Bus = new Arduino_ESP32SPI(
    kDataCommand, kEye1Cs, kClock, kMosi, GFX_NOT_DEFINED, FSPI);
Arduino_DataBus *eye2Bus = new Arduino_ESP32SPI(
    kDataCommand, kEye2Cs, kClock, kMosi, GFX_NOT_DEFINED, FSPI);

Arduino_GFX *eye1 = new Arduino_GC9D01(
    eye1Bus, kEye1Reset, kEye1Rotation, kGc9d01Inverted);
Arduino_GFX *eye2 = new Arduino_GC9D01(
    eye2Bus, kEye2Reset, kEye2Rotation, kGc9d01Inverted);

constexpr int16_t kDisplaySize = 160;
Arduino_Canvas eye1Canvas(kDisplaySize, kDisplaySize, eye1);
Arduino_Canvas eye2Canvas(kDisplaySize, kDisplaySize, eye2);

bool eye1Ready = false;
bool eye2Ready = false;
bool eye1CanvasReady = false;
bool eye2CanvasReady = false;
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

void drawIdentityCard(Arduino_Canvas &canvas, const char *label, uint16_t accent) {
  canvas.fillScreen(BLACK);
  canvas.drawCircle(80, 80, 76, accent);
  canvas.drawCircle(80, 80, 72, accent);
  canvas.setTextColor(accent, BLACK);
  canvas.setTextSize(2);
  canvas.setCursor(44, 68);
  canvas.print(label);
  canvas.setTextSize(1);
  canvas.setCursor(31, 94);
  canvas.print("GC9D01 / 160x160");
  canvas.flush();
}

float smoothstep(float value) {
  value = constrain(value, 0.0f, 1.0f);
  return value * value * (3.0f - 2.0f * value);
}

float blinkAmount(uint32_t now) {
  constexpr uint32_t kCycleMs = 4200;
  constexpr uint32_t kFirstBlinkAtMs = 2200;
  constexpr uint32_t kClosingMs = 120;
  constexpr uint32_t kClosedHoldMs = 80;
  constexpr uint32_t kOpeningMs = 200;
  constexpr uint32_t kBlinkMs = kClosingMs + kClosedHoldMs + kOpeningMs;

  const uint32_t phase = (now + kCycleMs - kFirstBlinkAtMs) % kCycleMs;
  if (phase >= kBlinkMs) {
    return 0.0f;
  }
  if (phase < kClosingMs) {
    return smoothstep(phase / static_cast<float>(kClosingMs));
  }
  if (phase < kClosingMs + kClosedHoldMs) {
    return 1.0f;
  }
  return smoothstep((kBlinkMs - phase) / static_cast<float>(kOpeningMs));
}

void drawLids(Arduino_Canvas &canvas, float closed, uint16_t accent) {
  if (closed <= 0.0f) {
    return;
  }

  constexpr int16_t kCenter = 80;
  constexpr int16_t kLidRadius = 77;
  const float openness = 1.0f - closed;

  // These panels are physically quarter-turned relative to the canvas. Mask
  // the canvas sides so the physical lids still close from above and below.
  for (int16_t y = kCenter - kLidRadius; y <= kCenter + kLidRadius; ++y) {
    const float offset = y - kCenter;
    const float radiusSquared = kLidRadius * kLidRadius - offset * offset;
    if (radiusSquared <= 0.0f) {
      continue;
    }

    const int16_t edge = static_cast<int16_t>(sqrtf(radiusSquared));
    const int16_t left = kCenter - edge;
    const int16_t right = kCenter + edge;
    const int16_t aperture = static_cast<int16_t>(edge * openness);
    const int16_t openLeft = kCenter - aperture;
    const int16_t openRight = kCenter + aperture;

    if (openLeft > left) {
      canvas.drawFastHLine(left, y, openLeft - left, BLACK);
    }
    if (openRight < right) {
      canvas.drawFastHLine(openRight, y, right - openRight + 1, BLACK);
    }
  }

  if (closed > 0.92f) {
    canvas.drawLine(kCenter, 46, kCenter, 114, accent);
    canvas.drawLine(kCenter + 1, 50, kCenter + 1, 110, accent);
  }
}

void drawEye(
    Arduino_Canvas &canvas,
    float phase,
    float closed,
    uint16_t accent,
    bool mirror) {
  const int16_t centerX = 80;
  const int16_t centerY = 80;
  const float gazePhase = mirror ? -phase : phase;
  const int16_t pupilX = centerX + static_cast<int16_t>(sinf(gazePhase) * 18.0f);
  const int16_t pupilY = centerY + static_cast<int16_t>(cosf(gazePhase * 0.71f) * 8.0f);

  // Build the entire frame in RAM, then transmit it in one pass to the LCD.
  canvas.fillScreen(BLACK);
  canvas.fillCircle(centerX, centerY, 75, accent);
  canvas.fillCircle(centerX, centerY, 69, WHITE);
  canvas.fillCircle(pupilX, pupilY, 39, BLACK);
  canvas.fillCircle(pupilX - 12, pupilY - 15, 8, WHITE);
  canvas.drawCircle(centerX, centerY, 76, WHITE);
  drawLids(canvas, closed, accent);
  canvas.flush();
}

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println();
  Serial.println("Robot 790 C3 DualEye smoke test");

  pinMode(kEye1Backlight, OUTPUT);
  pinMode(kEye2Backlight, OUTPUT);
  pinMode(kEye1Cs, OUTPUT);
  pinMode(kEye2Cs, OUTPUT);
  digitalWrite(kEye1Backlight, HIGH);
  digitalWrite(kEye2Backlight, HIGH);
  digitalWrite(kEye1Cs, HIGH);
  digitalWrite(kEye2Cs, HIGH);

  eye1Ready = eye1->begin(kSpiFrequencyHz);
  eye2Ready = eye2->begin(kSpiFrequencyHz);
  eye1CanvasReady = eye1Ready && eye1Canvas.begin(GFX_SKIP_OUTPUT_BEGIN);
  eye2CanvasReady = eye2Ready && eye2Canvas.begin(GFX_SKIP_OUTPUT_BEGIN);

  Serial.printf("EYE1 init: %s\n", eye1CanvasReady ? "ok" : "failed");
  Serial.printf("EYE2 init: %s\n", eye2CanvasReady ? "ok" : "failed");

  if (eye1CanvasReady) {
    drawIdentityCard(eye1Canvas, "EYE 1", CYAN);
  }
  if (eye2CanvasReady) {
    drawIdentityCard(eye2Canvas, "EYE 2", MAGENTA);
  }

  startNetwork();
  delay(1800);
  Serial.println("Animated eye test running.");
}

void loop() {
  serviceNetwork();
  if (otaReady) {
    ArduinoOTA.handle();
  }

  if ((!eye1CanvasReady && !eye2CanvasReady) || millis() - lastFrameAt < 100) {
    return;
  }

  lastFrameAt = millis();
  const float phase = static_cast<float>(lastFrameAt) * 0.0028f;
  const float closed = blinkAmount(lastFrameAt);
  if (eye1CanvasReady) {
    drawEye(eye1Canvas, phase, closed, CYAN, false);
  }
  if (eye2CanvasReady) {
    drawEye(eye2Canvas, phase, closed, MAGENTA, true);
  }
}

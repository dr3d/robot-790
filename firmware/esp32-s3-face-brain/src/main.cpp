#include <Arduino.h>
#include <ArduinoJson.h>
#include <Arduino_GFX_Library.h>
#include <ArduinoOTA.h>
#include <ESPmDNS.h>
#include <FastIMU.h>
#include <SD.h>
#include <SPI.h>
#include <WebServer.h>
#include <WiFi.h>
#include <Wire.h>
#include "esp_camera.h"
#include "face_brain_config.h"

namespace {

Arduino_DataBus *displayBus = new Arduino_ESP32SPI(
    FACE_LCD_DC, FACE_LCD_CS, FACE_LCD_SCLK, FACE_LCD_MOSI, FACE_LCD_MISO);
Arduino_GFX *display = new Arduino_ST7789(
    displayBus, FACE_LCD_RST, FACE_LCD_ROTATION, true, FACE_LCD_WIDTH, FACE_LCD_HEIGHT);

#if FACE_EXTERNAL_EYES_ENABLED
Arduino_DataBus *leftEyeBus = new Arduino_SWSPI(
    FACE_EYE_DC, FACE_EYE_LEFT_CS, FACE_EYE_SCLK, FACE_EYE_MOSI, FACE_EYE_MISO);
Arduino_DataBus *rightEyeBus = new Arduino_SWSPI(
    FACE_EYE_DC, FACE_EYE_RIGHT_CS, FACE_EYE_SCLK, FACE_EYE_MOSI, FACE_EYE_MISO);
Arduino_GFX *leftEye = new Arduino_GC9A01(
    leftEyeBus, GFX_NOT_DEFINED, FACE_EYE_ROTATION, true);
Arduino_GFX *rightEye = new Arduino_GC9A01(
    rightEyeBus, GFX_NOT_DEFINED, FACE_EYE_ROTATION, true);
#endif

SPIClass sdSpi(FSPI);
WebServer server(80);
QMI8658 imu;
calData imuCal = {};
AccelData accel = {};
GyroData gyro = {};

bool displayOk = false;
bool eyesOk = false;
bool touchSeen = false;
bool imuOk = false;
bool sdOk = false;
bool cameraOk = false;
bool wifiStation = false;
uint8_t cst816Id = 0;
uint32_t bootMs = 0;
uint32_t requests = 0;
int backlight = 255;
String lastMessage = "booting";
String eyeMood = "curious";
bool eyesAnimate = false;

String ipString()
{
  return wifiStation ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
}

void setBacklight(int value)
{
  backlight = constrain(value, 0, 255);
  analogWrite(FACE_LCD_BL, backlight);
}

bool readReg8(uint8_t addr, uint8_t reg, uint8_t *value)
{
  Wire.beginTransmission(addr);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) {
    return false;
  }
  if (Wire.requestFrom(addr, static_cast<uint8_t>(1)) != 1) {
    return false;
  }
  *value = Wire.read();
  return true;
}

bool i2cAddressResponds(uint8_t addr)
{
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

void drawBootCard(const char *message)
{
  lastMessage = message;
  if (!displayOk) {
    return;
  }

  display->fillScreen(BLACK);
  display->fillRect(0, 0, display->width(), 38, BLUE);
  display->setTextColor(WHITE);
  display->setTextSize(2);
  display->setCursor(12, 10);
  display->print("Robot 790 Face");

  display->setTextSize(1);
  display->setCursor(12, 54);
  display->print("host: ");
  display->print(FACE_HOSTNAME);
  display->print(".local");

  display->setCursor(12, 76);
  display->print("ip: ");
  display->print(ipString());

  display->setCursor(12, 106);
  display->print("display: ");
  display->print(displayOk ? "ok" : "fail");
  display->setCursor(12, 126);
  display->print("eyes: ");
  display->print(eyesOk ? "ok" : "missing");
  display->setCursor(12, 146);
  display->print("touch: ");
  display->print(touchSeen ? "ok" : "missing");
  if (touchSeen) {
    display->print(" id=0x");
    display->print(cst816Id, HEX);
  }
  display->setCursor(12, 166);
  display->print("imu: ");
  display->print(imuOk ? "ok" : "missing");
  display->setCursor(12, 186);
  display->print("sd: ");
  display->print(sdOk ? "ok" : "missing");
  display->setCursor(12, 206);
  display->print("camera: ");
  display->print(cameraOk ? "ok" : "missing");

  display->fillRect(0, display->height() - 34, display->width(), 34, DARKGREY);
  display->setCursor(12, display->height() - 24);
  display->print(message);
}

void drawEye(Arduino_GFX *gfx, int pupilX, int pupilY, bool left)
{
  constexpr int cx = FACE_EYE_WIDTH / 2;
  constexpr int cy = FACE_EYE_HEIGHT / 2;
  const uint16_t sclera = 0xE73C;
  const uint16_t scleraShadow = 0xBDF7;
  const uint16_t irisOuter = 0x01EC;
  const uint16_t irisMid = 0x04F3;
  const uint16_t irisInner = 0x3E3F;
  const uint16_t limbal = 0x0188;
  const uint16_t pupil = BLACK;
  const int ix = cx + pupilX;
  const int iy = cy + pupilY;

  gfx->fillScreen(BLACK);
  gfx->fillCircle(cx, cy, 114, 0x18E3);
  gfx->fillCircle(cx, cy, 110, sclera);
  gfx->fillCircle(cx, cy + 8, 102, WHITE);
  gfx->fillCircle(cx, cy + 30, 84, scleraShadow);
  gfx->fillCircle(cx, cy + 22, 84, WHITE);

  gfx->fillCircle(ix, iy, 52, limbal);
  gfx->fillCircle(ix, iy, 46, irisOuter);
  gfx->fillCircle(ix, iy, 36, irisMid);
  gfx->fillCircle(ix, iy, 24, irisInner);
  for (int a = 0; a < 360; a += 24) {
    const float r = a * 0.0174533f;
    const int x1 = ix + static_cast<int>(cosf(r) * 12.0f);
    const int y1 = iy + static_cast<int>(sinf(r) * 12.0f);
    const int x2 = ix + static_cast<int>(cosf(r) * 46.0f);
    const int y2 = iy + static_cast<int>(sinf(r) * 46.0f);
    gfx->drawLine(x1, y1, x2, y2, 0x03AE);
  }
  gfx->fillCircle(ix, iy, 25, pupil);
  gfx->fillCircle(ix - 13, iy - 17, 8, WHITE);
  gfx->fillCircle(ix + 10, iy - 6, 4, 0xBDF7);

  gfx->fillRect(0, 0, FACE_EYE_WIDTH, 32, BLACK);
  gfx->fillRect(0, FACE_EYE_HEIGHT - 24, FACE_EYE_WIDTH, 24, BLACK);
  if (left) {
    gfx->fillTriangle(0, 32, 78, 18, 0, 78, BLACK);
    gfx->fillTriangle(FACE_EYE_WIDTH, 20, FACE_EYE_WIDTH - 50, 31, FACE_EYE_WIDTH, 76, BLACK);
  } else {
    gfx->fillTriangle(FACE_EYE_WIDTH, 32, FACE_EYE_WIDTH - 78, 18, FACE_EYE_WIDTH, 78, BLACK);
    gfx->fillTriangle(0, 20, 50, 31, 0, 76, BLACK);
  }
  gfx->drawCircle(cx, cy, 114, 0x39E7);
}

void drawEyeTestPattern(Arduino_GFX *gfx, const char *label, uint16_t color)
{
  constexpr int cx = FACE_EYE_WIDTH / 2;
  constexpr int cy = FACE_EYE_HEIGHT / 2;
  gfx->fillScreen(BLACK);
  gfx->fillCircle(cx, cy, 112, color);
  gfx->fillCircle(cx, cy, 96, BLACK);
  gfx->drawCircle(cx, cy, 113, WHITE);
  gfx->drawCircle(cx, cy, 80, WHITE);
  gfx->setTextColor(WHITE);
  gfx->setTextSize(4);
  gfx->setCursor(cx - 22, cy - 15);
  gfx->print(label);
}

void drawEyesTestPattern(const String &target = "both")
{
#if FACE_EXTERNAL_EYES_ENABLED
  if (!eyesOk) {
    return;
  }
  digitalWrite(FACE_EYE_LEFT_CS, HIGH);
  digitalWrite(FACE_EYE_RIGHT_CS, HIGH);
  if (target == "both" || target == "left") {
    drawEyeTestPattern(leftEye, "L", 0x001F);
    digitalWrite(FACE_EYE_LEFT_CS, HIGH);
    digitalWrite(FACE_EYE_RIGHT_CS, HIGH);
  }
  if (target == "both" || target == "right") {
    drawEyeTestPattern(rightEye, "R", 0xF800);
  }
  digitalWrite(FACE_EYE_LEFT_CS, HIGH);
  digitalWrite(FACE_EYE_RIGHT_CS, HIGH);
#endif
}

void drawEyesFrame(const String &target = "both")
{
#if FACE_EXTERNAL_EYES_ENABLED
  if (!eyesOk) {
    return;
  }
  const float t = millis() / 1000.0f;
  const int x = static_cast<int>(sinf(t * 0.8f) * 28.0f);
  const int y = static_cast<int>(sinf(t * 0.53f + 1.4f) * 16.0f);
  digitalWrite(FACE_EYE_LEFT_CS, HIGH);
  digitalWrite(FACE_EYE_RIGHT_CS, HIGH);
  if (target == "both" || target == "left") {
    drawEye(leftEye, x, y, true);
    digitalWrite(FACE_EYE_LEFT_CS, HIGH);
    digitalWrite(FACE_EYE_RIGHT_CS, HIGH);
  }
  if (target == "both" || target == "right") {
    drawEye(rightEye, x, y, false);
  }
  digitalWrite(FACE_EYE_LEFT_CS, HIGH);
  digitalWrite(FACE_EYE_RIGHT_CS, HIGH);
#endif
}

void initEyes()
{
#if FACE_EXTERNAL_EYES_ENABLED
  pinMode(FACE_EYE_LEFT_CS, OUTPUT);
  pinMode(FACE_EYE_RIGHT_CS, OUTPUT);
  digitalWrite(FACE_EYE_LEFT_CS, HIGH);
  digitalWrite(FACE_EYE_RIGHT_CS, HIGH);
  pinMode(FACE_EYE_RST, OUTPUT);
  digitalWrite(FACE_EYE_RST, LOW);
  delay(40);
  digitalWrite(FACE_EYE_RST, HIGH);
  delay(120);

  const bool leftOk = leftEye->begin();
  digitalWrite(FACE_EYE_LEFT_CS, HIGH);
  digitalWrite(FACE_EYE_RIGHT_CS, HIGH);
  delay(20);
  const bool rightOk = rightEye->begin();
  digitalWrite(FACE_EYE_LEFT_CS, HIGH);
  digitalWrite(FACE_EYE_RIGHT_CS, HIGH);
  eyesOk = leftOk && rightOk;
  Serial.printf("external_eyes=%s left=%d right=%d\n", eyesOk ? "ok" : "missing", leftOk, rightOk);
  if (eyesOk) {
    drawEyesFrame();
  }
#else
  eyesOk = false;
  Serial.println("external_eyes=disabled");
#endif
}

void initDisplay()
{
  pinMode(FACE_LCD_BL, OUTPUT);
  setBacklight(255);
  displayOk = display->begin();
  if (displayOk) {
    display->fillScreen(BLACK);
    display->setTextWrap(false);
  }
  Serial.printf("display=%s\n", displayOk ? "ok" : "fail");
}

void initI2c()
{
  Wire.begin(FACE_I2C_SDA, FACE_I2C_SCL);
  Wire.setClock(400000);
  touchSeen = i2cAddressResponds(FACE_CST816_ADDR);
  if (touchSeen) {
    readReg8(FACE_CST816_ADDR, 0xA7, &cst816Id);
  }
  Serial.printf("touch=%s id=0x%02x\n", touchSeen ? "ok" : "missing", cst816Id);

  imuOk = imu.init(imuCal, FACE_QMI8658_ADDR) == 0;
  Serial.printf("imu=%s\n", imuOk ? "ok" : "missing");
}

void initSd()
{
#if FACE_ENABLE_SD_PROBE
  sdSpi.begin(FACE_LCD_SCLK, FACE_LCD_MISO, FACE_LCD_MOSI, FACE_SD_CS);
  sdOk = SD.begin(FACE_SD_CS, sdSpi);
  Serial.printf("sd=%s\n", sdOk ? "ok" : "missing");
#else
  sdOk = false;
  Serial.println("sd=skipped");
#endif
}

void initCamera()
{
#if FACE_ENABLE_CAMERA_PROBE
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_1;
  config.pin_d0 = FACE_CAM_D0;
  config.pin_d1 = FACE_CAM_D1;
  config.pin_d2 = FACE_CAM_D2;
  config.pin_d3 = FACE_CAM_D3;
  config.pin_d4 = FACE_CAM_D4;
  config.pin_d5 = FACE_CAM_D5;
  config.pin_d6 = FACE_CAM_D6;
  config.pin_d7 = FACE_CAM_D7;
  config.pin_xclk = FACE_CAM_XCLK;
  config.pin_pclk = FACE_CAM_PCLK;
  config.pin_vsync = FACE_CAM_VSYNC;
  config.pin_href = FACE_CAM_HREF;
  config.pin_sccb_sda = FACE_CAM_SIOD;
  config.pin_sccb_scl = FACE_CAM_SIOC;
  config.pin_pwdn = FACE_CAM_PWDN;
  config.pin_reset = FACE_CAM_RESET;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_QVGA;
  config.jpeg_quality = 12;
  config.fb_count = psramFound() ? 2 : 1;
  config.fb_location = psramFound() ? CAMERA_FB_IN_PSRAM : CAMERA_FB_IN_DRAM;
  config.grab_mode = CAMERA_GRAB_LATEST;

  cameraOk = esp_camera_init(&config) == ESP_OK;
  Serial.printf("camera=%s\n", cameraOk ? "ok" : "missing");
#else
  cameraOk = false;
  Serial.println("camera=skipped");
#endif
}

void initWifi()
{
  WiFi.mode(WIFI_STA);
  if (strlen(FACE_WIFI_SSID) > 0) {
    WiFi.setHostname(FACE_HOSTNAME);
    WiFi.begin(FACE_WIFI_SSID, FACE_WIFI_PASSWORD);
    const uint32_t deadline = millis() + 12000;
    while (WiFi.status() != WL_CONNECTED && millis() < deadline) {
      delay(250);
      Serial.print(".");
    }
    Serial.println();
    wifiStation = WiFi.status() == WL_CONNECTED;
  }

  if (!wifiStation) {
    WiFi.mode(WIFI_AP);
    WiFi.softAP(FACE_AP_SSID, FACE_AP_PASSWORD);
  }

  if (MDNS.begin(FACE_HOSTNAME)) {
    MDNS.addService("http", "tcp", 80);
  }

  ArduinoOTA.setHostname(FACE_HOSTNAME);
  if (strlen(FACE_OTA_PASSWORD) > 0) {
    ArduinoOTA.setPassword(FACE_OTA_PASSWORD);
  }
  ArduinoOTA.begin();

  Serial.printf("wifi_mode=%s ip=%s url=http://%s.local/\n",
                wifiStation ? "station" : "ap", ipString().c_str(), FACE_HOSTNAME);
}

void writeStatusJson()
{
  requests++;
  JsonDocument doc;
  doc["ok"] = true;
  doc["name"] = "Robot 790 Face Brain";
  doc["hostname"] = FACE_HOSTNAME;
  doc["mdns_url"] = "http://" FACE_HOSTNAME ".local/";
  doc["ip"] = ipString();
  doc["wifi_mode"] = wifiStation ? "station" : "ap";
  doc["uptime_ms"] = millis() - bootMs;
  doc["free_heap"] = ESP.getFreeHeap();
  doc["psram"] = psramFound();
  doc["display"] = displayOk;
  doc["external_eyes"] = eyesOk;
  doc["eye_mood"] = eyeMood;
  doc["eyes_animate"] = eyesAnimate;
  doc["touch"] = touchSeen;
  doc["touch_id"] = cst816Id;
  doc["imu"] = imuOk;
  doc["sd"] = sdOk;
  doc["camera"] = cameraOk;
  doc["backlight"] = backlight;
  doc["message"] = lastMessage;
  if (imuOk) {
    imu.update();
    imu.getAccel(&accel);
    imu.getGyro(&gyro);
    doc["accel_x"] = accel.accelX;
    doc["accel_y"] = accel.accelY;
    doc["accel_z"] = accel.accelZ;
    doc["gyro_x"] = gyro.gyroX;
    doc["gyro_y"] = gyro.gyroY;
    doc["gyro_z"] = gyro.gyroZ;
  }

  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}

void handleRoot()
{
  requests++;
  String html = F("<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
                  "<title>Robot 790 Face</title><style>body{font:16px system-ui;background:#080b10;color:#f4f7fb;"
                  "max-width:720px;margin:32px auto;padding:0 20px}code{color:#7dd3fc}button,input{font:inherit;"
                  "padding:10px;margin:4px;background:#111827;color:#f4f7fb;border:1px solid #334155;border-radius:6px}</style>"
                  "</head><body><h1>Robot 790 Face Brain</h1><p><code>esp32-face.local</code></p>"
                  "<pre id='s'>loading</pre><button onclick=\"fetch('/api/display?message=hello%20robot').then(update)\">Display Test</button>"
                  "<input id='b' type='range' min='0' max='255' value='255' oninput=\"fetch('/api/backlight?value='+this.value)\">"
                  "<script>async function update(){s.textContent=JSON.stringify(await (await fetch('/api/status')).json(),null,2)}setInterval(update,1000);update()</script>"
                  "</body></html>");
  server.send(200, "text/html", html);
}

void handleDisplay()
{
  requests++;
  const String message = server.hasArg("message") ? server.arg("message") : "display test";
  drawBootCard(message.c_str());
  server.send(200, "text/plain", "ok\n");
}

void handleEyes()
{
  requests++;
  if (server.hasArg("mood")) {
    eyeMood = server.arg("mood");
  }
  if (server.hasArg("animate")) {
    eyesAnimate = server.arg("animate") == "1" || server.arg("animate") == "true";
  }
  const String pattern = server.hasArg("pattern") ? server.arg("pattern") : "eye";
  const String target = server.hasArg("target") ? server.arg("target") : "both";
  if (pattern == "test") {
    drawEyesTestPattern(target);
  } else {
    drawEyesFrame(target);
  }
  server.send(200, "text/plain", eyesOk ? "ok\n" : "eyes unavailable\n");
}

void handleBacklight()
{
  requests++;
  const int value = server.hasArg("value") ? server.arg("value").toInt() : 255;
  setBacklight(value);
  server.send(200, "text/plain", "ok\n");
}

void initHttp()
{
  server.on("/", HTTP_GET, handleRoot);
  server.on("/status", HTTP_GET, writeStatusJson);
  server.on("/api/status", HTTP_GET, writeStatusJson);
  server.on("/api/display", HTTP_GET, handleDisplay);
  server.on("/api/eyes", HTTP_GET, handleEyes);
  server.on("/api/backlight", HTTP_GET, handleBacklight);
  server.onNotFound([]() {
    requests++;
    server.send(404, "text/plain", "not found\n");
  });
  server.begin();
}

} // namespace

void setup()
{
  bootMs = millis();
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("Robot 790 ESP32-S3 face brain starting");
  Serial.printf("flash=%uMB psram=%s mac=%s\n",
                ESP.getFlashChipSize() / (1024 * 1024),
                psramFound() ? "yes" : "no",
                WiFi.macAddress().c_str());

  initWifi();
  initHttp();
  initDisplay();
  initEyes();
  drawBootCard("probing hardware");
  initI2c();
  initSd();
  initCamera();
  drawBootCard("ready");
}

void loop()
{
  ArduinoOTA.handle();
  server.handleClient();
  static uint32_t lastDraw = 0;
  static uint32_t lastEyeDraw = 0;
  if (eyesAnimate && millis() - lastEyeDraw > 1200) {
    lastEyeDraw = millis();
    drawEyesFrame();
  }
  if (millis() - lastDraw > 5000) {
    lastDraw = millis();
    Serial.printf("heartbeat uptime=%lu ip=%s display=%d eyes=%d touch=%d imu=%d sd=%d camera=%d requests=%lu\n",
                  static_cast<unsigned long>(millis() - bootMs),
                  ipString().c_str(),
                  displayOk,
                  eyesOk,
                  touchSeen,
                  imuOk,
                  sdOk,
                  cameraOk,
                  static_cast<unsigned long>(requests));
    drawBootCard("ready");
  }
}

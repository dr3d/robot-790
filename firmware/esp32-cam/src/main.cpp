#include <Arduino.h>
#include <ArduinoOTA.h>
#include <ESPmDNS.h>
#include <WebServer.h>
#include <WiFi.h>
#include "cam_config.h"
#include "esp_camera.h"

namespace {

// M5Stack TimerCam / TimerCamera OV3660 pin map.
constexpr int PIN_CAM_SIOC = 23;
constexpr int PIN_CAM_SIOD = 25;
constexpr int PIN_CAM_XCLK = 27;
constexpr int PIN_CAM_VSYNC = 22;
constexpr int PIN_CAM_HREF = 26;
constexpr int PIN_CAM_PCLK = 21;
constexpr int PIN_CAM_D0 = 32;
constexpr int PIN_CAM_D1 = 35;
constexpr int PIN_CAM_D2 = 34;
constexpr int PIN_CAM_D3 = 5;
constexpr int PIN_CAM_D4 = 39;
constexpr int PIN_CAM_D5 = 18;
constexpr int PIN_CAM_D6 = 36;
constexpr int PIN_CAM_D7 = 19;
constexpr int PIN_CAM_RESET = 15;
constexpr int PIN_CAM_PWDN = -1;

constexpr int PIN_STATUS_LED = 2;
constexpr int PIN_BAT_HOLD = 33;
constexpr framesize_t STREAM_FRAME_SIZE = FRAMESIZE_QVGA;
constexpr uint8_t STREAM_JPEG_QUALITY = 18;
constexpr uint8_t STREAM_FB_COUNT = 3;
constexpr int FIXED_AEC_VALUE = 220;
constexpr int CAMERA_BRIGHTNESS = 1;
constexpr int CAMERA_CONTRAST = 0;
constexpr int CAMERA_RAW_GMA = 1;
constexpr int CAMERA_LENC = 1;
constexpr uint32_t WIFI_CONNECT_TIMEOUT_MS = 15000;

WebServer web(80);
WiFiServer streamServer(81);
uint32_t framesServed = 0;
uint32_t streamClients = 0;
uint32_t lastFrameMs = 0;
uint32_t lastFrameBytes = 0;
float streamFps = 0.0f;
bool otaActive = false;
bool accessPointMode = false;

const char INDEX_HTML[] PROGMEM = R"HTML(
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Robot 790 Camera</title>
  <style>
    html,body{margin:0;background:#0b1118;color:#dce7ef;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
    main{min-height:100vh;display:grid;place-items:center;padding:18px;box-sizing:border-box}
    .wrap{width:min(100%,620px)}
    header{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:0 0 12px}
    h1{font-size:18px;font-weight:650;margin:0}
    a{color:#87dfff;text-decoration:none}
    .frame{position:relative;width:min(100%,540px);aspect-ratio:3/4;margin:auto;background:#000;border:1px solid #243142;box-shadow:0 10px 42px rgba(0,0,0,.45);overflow:hidden}
    img{position:absolute;left:50%;top:50%;display:block;width:133.333%;max-width:none;height:auto;transform:translate(-50%,-50%) rotate(-90deg);transform-origin:center}
    .bar{margin-top:10px;font-size:13px;color:#93a7b8;display:flex;gap:14px;flex-wrap:wrap}
  </style>
</head>
<body>
  <main>
    <div class="wrap">
      <header>
        <h1>Robot 790 Camera</h1>
        <a href="/jpg">single JPEG</a>
      </header>
      <div class="frame"><img id="live" src="" alt="Live camera stream"></div>
      <div class="bar">
        <span>MJPEG stream</span>
        <span><a href="/status">status</a></span>
      </div>
    </div>
  </main>
  <script>document.getElementById('live').src='http://'+location.hostname+':81/stream';</script>
</body>
</html>
)HTML";

void indexHandler() {
  web.send_P(200, "text/html", INDEX_HTML);
}

void statusHandler() {
  sensor_t *sensor = esp_camera_sensor_get();
  camera_status_t cameraStatus = {};
  if (sensor) {
    cameraStatus = sensor->status;
  }
  IPAddress address = accessPointMode ? WiFi.softAPIP() : WiFi.localIP();
  String ip = address.toString();

  char body[560];
  const int n = snprintf(body, sizeof(body),
                         "ok\nip=%s\nmode=%s\nhostname=%s\nrssi=%d\nframes=%lu\nstream_clients=%lu\nfps=%.1f\nlast_frame_bytes=%lu\nfree_heap=%lu\npsram=%s\nota=%s\nbrightness=%d\ncontrast=%d\nraw_gma=%u\nlenc=%u\n",
                         ip.c_str(),
                         accessPointMode ? "ap" : "sta",
                         OTA_HOSTNAME,
                         WiFi.RSSI(),
                         (unsigned long)framesServed,
                         (unsigned long)streamClients,
                         streamFps,
                         (unsigned long)lastFrameBytes,
                         (unsigned long)ESP.getFreeHeap(),
                         psramFound() ? "yes" : "no",
                         otaActive ? "active" : "off",
                         sensor ? cameraStatus.brightness : 0,
                         sensor ? cameraStatus.contrast : 0,
                         sensor ? cameraStatus.raw_gma : 0,
                         sensor ? cameraStatus.lenc : 0);
  web.sendHeader("Cache-Control", "no-store");
  web.send(200, "text/plain", String(body).substring(0, n));
}

void jpgHandler() {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    web.send(503, "text/plain", "camera frame unavailable\n");
    return;
  }

  web.sendHeader("Content-Disposition", "inline; filename=robot-790-camera.jpg");
  web.sendHeader("Cache-Control", "no-store");
  web.setContentLength(fb->len);
  web.send(200, "image/jpeg", "");
  web.client().write(fb->buf, fb->len);
  esp_camera_fb_return(fb);
  framesServed++;
}

void serveStreamClient(WiFiClient client) {
  static const char *BOUNDARY = "frame";
  streamClients++;
  client.setNoDelay(true);
  client.setTimeout(1);
  client.println("HTTP/1.1 200 OK");
  client.println("Access-Control-Allow-Origin: *");
  client.println("Cache-Control: no-store");
  client.println("Connection: close");
  client.println("Content-Type: multipart/x-mixed-replace; boundary=frame");
  client.println();

  while (client.connected()) {
    const uint32_t captureStart = millis();
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) {
      delay(20);
      continue;
    }
    const uint32_t captureMs = millis() - captureStart;

    client.printf("--%s\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n", BOUNDARY, (unsigned)fb->len);
    size_t written = 0;
    uint8_t *out = fb->buf;
    size_t remaining = fb->len;
    while (remaining > 0 && client.connected()) {
      const size_t chunk = remaining > 8192 ? 8192 : remaining;
      const size_t n = client.write(out, chunk);
      if (n == 0) {
        break;
      }
      written += n;
      out += n;
      remaining -= n;
    }
    client.print("\r\n");
    const uint32_t now = millis();
    if (lastFrameMs != 0 && now != lastFrameMs) {
      const float instant = 1000.0f / float(now - lastFrameMs);
      streamFps = streamFps == 0.0f ? instant : streamFps * 0.82f + instant * 0.18f;
    }
    lastFrameMs = now;
    lastFrameBytes = fb->len;
    static uint32_t lastLogMs = 0;
    if (now - lastLogMs > 1200) {
      lastLogMs = now;
      Serial.printf("MJPEG %luB capture=%lums fps=%.1f rssi=%d\n",
                    (unsigned long)fb->len, (unsigned long)captureMs, streamFps, WiFi.RSSI());
    }
    esp_camera_fb_return(fb);
    framesServed++;
    if (written == 0) {
      break;
    }
    delay(1);
  }
  client.stop();
  streamClients--;
}

void pollStreamServer() {
  WiFiClient client = streamServer.available();
  if (!client) {
    return;
  }

  client.setTimeout(25);
  String request = client.readStringUntil('\n');
  while (client.connected() && client.available()) {
    const String line = client.readStringUntil('\n');
    if (line == "\r" || line.length() == 0) {
      break;
    }
  }

  if (request.startsWith("GET /stream ")) {
    serveStreamClient(client);
  } else {
    client.println("HTTP/1.1 302 Found");
    client.println("Location: /stream");
    client.println("Connection: close");
    client.println();
    client.stop();
  }
}

void startServer() {
  web.on("/", HTTP_GET, indexHandler);
  web.on("/jpg", HTTP_GET, jpgHandler);
  web.on("/status", HTTP_GET, statusHandler);
  web.onNotFound([]() {
    web.send(404, "text/plain", "not found\n");
  });
  web.begin();
  streamServer.begin();
  streamServer.setNoDelay(true);

  if (MDNS.begin(OTA_HOSTNAME)) {
    MDNS.addService("http", "tcp", 80);
    MDNS.addService("mjpeg", "tcp", 81);
    Serial.printf("mDNS: http://%s.local/\n", OTA_HOSTNAME);
  }

  IPAddress address = accessPointMode ? WiFi.softAPIP() : WiFi.localIP();
  Serial.print("Camera UI: http://");
  Serial.print(address);
  Serial.println('/');
  Serial.print("Stream: http://");
  Serial.print(address);
  Serial.println(":81/stream");
}

void startOta() {
  ArduinoOTA.setHostname(OTA_HOSTNAME);
  if (strlen(OTA_PASSWORD) > 0) {
    ArduinoOTA.setPassword(OTA_PASSWORD);
  }

  ArduinoOTA.onStart([]() {
    streamServer.stop();
    web.stop();
    digitalWrite(PIN_STATUS_LED, LOW);
    Serial.println("OTA update starting");
  });
  ArduinoOTA.onEnd([]() {
    Serial.println("OTA update complete");
  });
  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("OTA error %u\n", (unsigned)error);
  });

  ArduinoOTA.begin();
  otaActive = true;
  Serial.printf("OTA active: %s.local\n", OTA_HOSTNAME);
}

bool initCamera() {
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = PIN_CAM_D0;
  config.pin_d1 = PIN_CAM_D1;
  config.pin_d2 = PIN_CAM_D2;
  config.pin_d3 = PIN_CAM_D3;
  config.pin_d4 = PIN_CAM_D4;
  config.pin_d5 = PIN_CAM_D5;
  config.pin_d6 = PIN_CAM_D6;
  config.pin_d7 = PIN_CAM_D7;
  config.pin_xclk = PIN_CAM_XCLK;
  config.pin_pclk = PIN_CAM_PCLK;
  config.pin_vsync = PIN_CAM_VSYNC;
  config.pin_href = PIN_CAM_HREF;
  config.pin_sccb_sda = PIN_CAM_SIOD;
  config.pin_sccb_scl = PIN_CAM_SIOC;
  config.pin_pwdn = PIN_CAM_PWDN;
  config.pin_reset = PIN_CAM_RESET;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode = CAMERA_GRAB_LATEST;
  config.frame_size = STREAM_FRAME_SIZE;
  config.jpeg_quality = STREAM_JPEG_QUALITY;
  config.fb_count = psramFound() ? STREAM_FB_COUNT : 1;
  config.fb_location = psramFound() ? CAMERA_FB_IN_PSRAM : CAMERA_FB_IN_DRAM;

  const esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    return false;
  }

  sensor_t *sensor = esp_camera_sensor_get();
  if (sensor) {
    sensor->set_framesize(sensor, STREAM_FRAME_SIZE);
    sensor->set_quality(sensor, STREAM_JPEG_QUALITY);
    sensor->set_brightness(sensor, CAMERA_BRIGHTNESS);
    sensor->set_contrast(sensor, CAMERA_CONTRAST);
    sensor->set_saturation(sensor, 0);
    sensor->set_exposure_ctrl(sensor, 0);
    sensor->set_aec2(sensor, 0);
    sensor->set_aec_value(sensor, FIXED_AEC_VALUE);
    sensor->set_gain_ctrl(sensor, 1);
    sensor->set_gainceiling(sensor, GAINCEILING_16X);
    sensor->set_raw_gma(sensor, CAMERA_RAW_GMA);
    sensor->set_lenc(sensor, CAMERA_LENC);
    sensor->set_vflip(sensor, 1);
    sensor->set_hmirror(sensor, 0);
  }
  return true;
}

void startAccessPoint() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  accessPointMode = true;
  digitalWrite(PIN_STATUS_LED, HIGH);
  Serial.printf("Camera AP: %s\n", AP_SSID);
  Serial.print("AP IP: ");
  Serial.println(WiFi.softAPIP());
}

bool connectStationWifi() {
  if (strlen(WIFI_SSID) == 0) {
    Serial.println("No station Wi-Fi configured");
    return false;
  }

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setHostname(OTA_HOSTNAME);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.printf("Connecting to %s", WIFI_SSID);
  const uint32_t startMs = millis();
  uint32_t lastBlink = 0;
  bool led = false;
  while (WiFi.status() != WL_CONNECTED && millis() - startMs < WIFI_CONNECT_TIMEOUT_MS) {
    delay(100);
    if (millis() - lastBlink > 350) {
      lastBlink = millis();
      led = !led;
      digitalWrite(PIN_STATUS_LED, led ? HIGH : LOW);
      Serial.print('.');
    }
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println();
    Serial.println("Station Wi-Fi failed");
    WiFi.disconnect(true);
    return false;
  }

  accessPointMode = false;
  digitalWrite(PIN_STATUS_LED, HIGH);
  Serial.println();
  Serial.print("Camera IP: ");
  Serial.println(WiFi.localIP());
  return true;
}

void connectWifi() {
  if (!connectStationWifi()) {
    startAccessPoint();
  }
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);
  pinMode(PIN_BAT_HOLD, OUTPUT);
  digitalWrite(PIN_BAT_HOLD, HIGH);

  Serial.println();
  Serial.println("Robot 790 camera starting");
  Serial.printf("PSRAM: %s\n", psramFound() ? "yes" : "no");

  if (!initCamera()) {
    while (true) {
      digitalWrite(PIN_STATUS_LED, HIGH);
      delay(120);
      digitalWrite(PIN_STATUS_LED, LOW);
      delay(380);
    }
  }

  connectWifi();
  startServer();
  startOta();
}

void loop() {
  if (otaActive) {
    ArduinoOTA.handle();
  }
  web.handleClient();
  pollStreamServer();
  if (!accessPointMode && WiFi.status() != WL_CONNECTED) {
    digitalWrite(PIN_STATUS_LED, LOW);
    connectWifi();
  }
  delay(5);
}

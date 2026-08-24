#include <Arduino.h>
#include <SPI.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Update.h>
#include <ArduinoJson.h>
#include <Adafruit_GC9A01A.h>
#include <Adafruit_ILI9341.h>
#include <Adafruit_GFX.h>
#include <esp_system.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include <ctype.h>
#include <math.h>
#include <pgmspace.h>
#include <stdlib.h>
#include <string.h>

#include "reachy_config.h"

namespace {

constexpr int16_t SCREEN_W = 240;
constexpr int16_t SCREEN_H = 240;
constexpr int16_t CX = SCREEN_W / 2;
constexpr int16_t CY = SCREEN_H / 2 + 5;
constexpr float APERTURE_HALF_W = 120.0f;
constexpr uint32_t SPI_HZ = REACHY_SPI_HZ;
constexpr uint8_t LEFT_ROTATION = 2;
constexpr uint8_t RIGHT_ROTATION = 2;
constexpr uint8_t MOUTH_ROTATION = 2;
// Landscape, 180 degrees from rotation 3.
constexpr uint8_t AUX_ROTATION = 1;
constexpr uint32_t AUX_FRAME_MS = 500;
constexpr uint32_t AUX_MOUTH_FRAME_MS = 100;
constexpr uint32_t MOUTH_STATUS_FRAME_MS = 500;
constexpr bool DISPLAY_INVERT = true;
constexpr uint8_t API_LINE_MAX = 96;
constexpr uint32_t API_DEFAULT_MOOD_MS = 3500;
constexpr uint32_t API_DEFAULT_EXPR_MS = 8000;
constexpr uint32_t API_DEFAULT_GAZE_HOLD_MS = 1200;
constexpr uint32_t API_DEFAULT_GAZE_MOVE_MS = 160;
constexpr uint32_t API_DEFAULT_MOUTH_MS = 2500;
constexpr uint32_t MOUTH_TRANSITION_MS = 220;
constexpr uint32_t MOUTH_TALK_ATTACK_MS = 90;
constexpr uint32_t MOUTH_TALK_RELEASE_MS = 160;
constexpr float API_NORMALIZED_GAZE_X_MM = 190.0f;
constexpr float API_NORMALIZED_GAZE_Y_MM = 110.0f;
constexpr float API_NORMALIZED_GAZE_Z_MM = 360.0f;
constexpr float API_NORMALIZED_GAZE_X_SIGN = -1.0f;
constexpr float API_NORMALIZED_GAZE_Y_SIGN = -1.0f;
constexpr int8_t PIN_FLIP_BUTTON = 0;
constexpr uint32_t FLIP_BUTTON_HOLD_MS = 2000;
constexpr uint32_t FLIP_BUTTON_DEBOUNCE_MS = 35;

#ifndef USE_SOFTWARE_SPI
#define USE_SOFTWARE_SPI 0
#endif

constexpr int8_t PIN_L_SCLK = REACHY_LEFT_SCLK;
constexpr int8_t PIN_L_MOSI = REACHY_LEFT_MOSI;
constexpr int8_t PIN_L_RST = REACHY_LEFT_RST;
constexpr int8_t PIN_L_CS = REACHY_LEFT_CS;
constexpr int8_t PIN_L_DC = REACHY_LEFT_DC;

constexpr int8_t PIN_R_SCLK = REACHY_RIGHT_SCLK;
constexpr int8_t PIN_R_MOSI = REACHY_RIGHT_MOSI;
constexpr int8_t PIN_R_RST = REACHY_RIGHT_RST;
constexpr int8_t PIN_R_CS = REACHY_RIGHT_CS;
constexpr int8_t PIN_R_DC = REACHY_RIGHT_DC;

#ifdef REACHY_MOUTH_CS
#define REACHY_HAS_MOUTH 1
constexpr int8_t PIN_MOUTH_SCLK = REACHY_MOUTH_SCLK;
constexpr int8_t PIN_MOUTH_MOSI = REACHY_MOUTH_MOSI;
constexpr int8_t PIN_MOUTH_RST = REACHY_MOUTH_RST;
constexpr int8_t PIN_MOUTH_CS = REACHY_MOUTH_CS;
constexpr int8_t PIN_MOUTH_DC = REACHY_MOUTH_DC;
#else
#define REACHY_HAS_MOUTH 0
#endif

#if defined(REACHY_AUX_CS) && REACHY_AUX_DISPLAY_ENABLED
#define REACHY_HAS_AUX_DISPLAY 1
constexpr int8_t PIN_AUX_SCLK = REACHY_AUX_SCLK;
constexpr int8_t PIN_AUX_MOSI = REACHY_AUX_MOSI;
constexpr int8_t PIN_AUX_RST = REACHY_AUX_RST;
constexpr int8_t PIN_AUX_CS = REACHY_AUX_CS;
constexpr int8_t PIN_AUX_DC = REACHY_AUX_DC;
#if (REACHY_AUX_ROLE == REACHY_AUX_ROLE_MOUTH_MIRROR) || (REACHY_AUX_ROLE == REACHY_AUX_ROLE_MOUTH_ONLY)
#define REACHY_AUX_USES_MOUTH_FRAME 1
#else
#define REACHY_AUX_USES_MOUTH_FRAME 0
#endif
#else
#define REACHY_HAS_AUX_DISPLAY 0
#define REACHY_AUX_USES_MOUTH_FRAME 0
#endif

#if (REACHY_LEFT_SCLK == REACHY_RIGHT_SCLK) && (REACHY_LEFT_MOSI == REACHY_RIGHT_MOSI)
#define REACHY_SHARE_EYE_SPI 1
#else
#define REACHY_SHARE_EYE_SPI 0
#endif

#if REACHY_LEFT_RST == REACHY_RIGHT_RST
#define REACHY_SHARE_EYE_RST 1
#else
#define REACHY_SHARE_EYE_RST 0
#endif

constexpr int8_t PIN_L_TFT_RST = REACHY_SHARE_EYE_RST ? -1 : PIN_L_RST;
constexpr int8_t PIN_R_TFT_RST = REACHY_SHARE_EYE_RST ? -1 : PIN_R_RST;
#if REACHY_HAS_MOUTH
constexpr int8_t PIN_MOUTH_TFT_RST = PIN_MOUTH_RST == PIN_L_RST ? -1 : PIN_MOUTH_RST;
#endif
#if REACHY_HAS_AUX_DISPLAY
constexpr int8_t PIN_AUX_TFT_RST = PIN_AUX_RST == PIN_L_RST ? -1 : PIN_AUX_RST;
#endif

constexpr float PI_F = 3.14159265358979323846f;
constexpr float DEG_TO_RAD_F = PI_F / 180.0f;
constexpr float EYE_BASELINE_MM = 64.0f;
constexpr float MAX_YAW = 24.0f * DEG_TO_RAD_F;
constexpr float MAX_PITCH = 18.0f * DEG_TO_RAD_F;
constexpr float MAX_GAZE_X_PX = 75.0f;
constexpr float MAX_GAZE_Y_PX = 50.0f;
constexpr float PUPIL_MAX_RADIUS = 19.0f;
constexpr bool DUAL_SIDE_PUPILS = false;

constexpr uint16_t BLACK = 0x0000;
constexpr uint16_t LID_DEEP = 0x0000;
constexpr uint16_t LID_BASE = 0x0000;
constexpr uint16_t LID_LIGHT = 0x0841;
constexpr uint16_t LID_RIM = 0x0000;
constexpr uint16_t LID_SHADOW = 0x0000;
constexpr uint16_t RED_VEIN = 0x8804;

const char FACE_UI_HTML[] PROGMEM = R"FACEUI(
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reachy Mini Face Control</title>
<style>
:root{color-scheme:dark;--bg:#08090d;--panel:#141720;--panel2:#10131a;--line:#2a3140;--text:#eef2f6;--muted:#9aa6b2;--accent:#55c7ff;--ok:#68d391;--warn:#f6ad55;--bad:#fc8181}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.35 system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:1100px;margin:0 auto;padding:16px}
header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}h1{font-size:20px;margin:0 0 4px}p{margin:0;color:var(--muted)}button,select,input{font:inherit}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(255px,1fr));gap:12px}.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px}.card h2{font-size:15px;margin:0 0 10px}
.row{display:grid;grid-template-columns:95px 1fr;align-items:center;gap:8px;margin:8px 0}.row label{color:var(--muted)}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
button{border:1px solid var(--line);background:#202633;color:var(--text);border-radius:7px;padding:7px 10px;cursor:pointer}button:hover{border-color:var(--accent)}button.primary{background:#0f3f5b;border-color:#217aa8}button.warn{background:#46301a;border-color:#8a5c24}
select,input{width:100%;min-width:0;border:1px solid var(--line);background:var(--panel2);color:var(--text);border-radius:7px;padding:7px}input[type=range]{padding:0}.seg{display:flex;gap:6px}.seg button{flex:1}.status{white-space:pre-wrap;background:#07080b;border:1px solid var(--line);border-radius:8px;padding:10px;min-height:98px;color:#cbd5df;font:12px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace}
.pill{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:5px 9px;color:var(--muted)}.dot{width:8px;height:8px;border-radius:50%;background:var(--warn)}.dot.ok{background:var(--ok)}.dot.bad{background:var(--bad)}
</style>
</head>
<body>
<main>
<header>
<div><h1>Reachy Mini Face Control</h1><p>Direct ESP32 test panel for eyes, mouth, gaze, idle beats, and display settings.</p></div>
<div class="pill"><span id="dot" class="dot"></span><span id="summary">connecting</span></div>
</header>
<section class="grid">
<div class="card">
<h2>Eyes</h2>
<div class="row"><label for="style">Style</label><select id="style"></select></div>
<div class="actions"><button class="primary" data-post="/style" data-select="style" data-key="name">Apply Style</button></div>
<div class="row"><label for="mood">Mood</label><select id="mood"></select></div>
<div class="row"><label for="moodDur">Duration s</label><input id="moodDur" type="number" min="0" step="0.1" value="4"></div>
<div class="actions">
<button data-post="/mood" data-select="mood" data-key="name" data-duration="moodDur">Mood</button>
<button data-post="/expression" data-select="mood" data-key="name" data-duration="moodDur">Expression</button>
</div>
</div>
<div class="card">
<h2>Mouth</h2>
<div class="row"><label for="mouthStyle">Style</label><select id="mouthStyle"></select></div>
<div class="row"><label for="mouthShape">Shape</label><select id="mouthShape"></select></div>
<div class="row"><label for="energy">Energy</label><input id="energy" type="range" min="0" max="1" step="0.05" value="0.65"></div>
<div class="row"><label for="mouthDur">Duration s</label><input id="mouthDur" type="number" min="0" step="0.1" value="0"></div>
<div class="actions">
<button class="primary" id="mouthApply">Apply</button>
<button id="mouthTalk">Talk</button>
<button id="mouthStop">Stop Talk</button>
<button id="mouthAuto">Auto</button>
</div>
</div>
<div class="card">
<h2>Gaze</h2>
<div class="row"><label for="gx">X left/right</label><input id="gx" type="range" min="-1" max="1" step="0.05" value="0"></div>
<div class="row"><label for="gy">Y up/down</label><input id="gy" type="range" min="-1" max="1" step="0.05" value="0"></div>
<div class="row"><label for="gdur">Hold s</label><input id="gdur" type="number" min="0" step="0.1" value="0"></div>
<div class="row"><label for="gmove">Move ms</label><input id="gmove" type="number" min="0" step="10" value="180"></div>
<div class="actions">
<button class="primary" id="gazeApply">Apply Gaze</button>
<button id="gazeCenter">Center</button>
<button id="gazeAuto">Auto</button>
</div>
</div>
<div class="card">
<h2>Idle Beats</h2>
<div class="row"><label for="beat">Beat</label><select id="beat"></select></div>
<div class="actions">
<button class="primary" data-post="/beat" data-select="beat" data-key="name">Play Beat</button>
<button id="idleOn">Idle On</button>
<button id="idleOff">Idle Off</button>
</div>
</div>
<div class="card">
<h2>Quick Actions</h2>
<div class="actions">
<button id="blink">Blink</button>
<button id="doubleBlink">Double Blink</button>
<button id="winkL">Wink L</button>
<button id="winkR">Wink R</button>
<button class="warn" id="sleep">Sleep</button>
<button class="primary" id="release">Release</button>
</div>
</div>
<div class="card">
<h2>Display</h2>
<div class="actions">
<button id="flip">Flip</button>
</div>
</div>
<div class="card">
<h2>Wi-Fi</h2>
<div class="row"><label>Status</label><span id="wifiStatus">loading</span></div>
<div class="row"><label for="ssid">LAN SSID</label><input id="ssid" autocomplete="off" placeholder="Your Wi-Fi name"></div>
<div class="row"><label for="wifiPass">Password</label><input id="wifiPass" autocomplete="off" placeholder="Leave blank for open network"></div>
<div class="actions">
<button class="primary" id="wifiSave">Save & Reboot</button>
<button class="warn" id="wifiClear">Clear Saved</button>
</div>
</div>
<div class="card">
<h2>OTA Firmware</h2>
<div class="row"><label for="otaFile">Firmware .bin</label><input id="otaFile" type="file" accept=".bin,application/octet-stream"></div>
<div class="actions"><button class="warn" id="otaUpload">Upload & Reboot</button></div>
</div>
<div class="card">
<h2>Status</h2>
<div id="status" class="status">loading...</div>
<div class="actions"><button id="refresh">Refresh</button></div>
</div>
</section>
</main>
<script>
const fallback={style:["friendly","classic","cartoony","robot","sinister","sleepy"],mood:["calm","curious","surprised","suspicious","afraid","angry","sleepy","sleep","goofy","robotic","wonder","glitchy","happy","delighted","bashful","bored","focused","confused","proud","mischief","affection"],beat:["slow_smile","affection","inspect","thoughtful","daydream","mischief","confused","focus_lock","double_take","goofy","drowsy","robot_scan","wary","startle"],mouthStyle:["human","robot"],mouthShape:["neutral","smile","smirk_left","smirk_right","open","wide","frown","grimace","sneer","sleep"]};
const $=id=>document.getElementById(id);
function fill(id,values){$(id).innerHTML=values.map(v=>'<option value="'+v+'">'+v+'</option>').join('')}
async function values(path,key,id){try{const r=await fetch(path);const j=await r.json();fill(id,j[key]||fallback[id])}catch(e){fill(id,fallback[id])}}
async function post(path,payload={}){const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const j=await r.json().catch(()=>({ok:false,error:"bad json"}));if(!r.ok||j.ok===false)throw new Error(j.error||r.statusText);render(j);return j}
function number(id){return Number($(id).value)}
function render(j){if(!j||!j.ok)return;const mouth=j.mouth||{};const wifi=j.wifi||{};$("dot").className="dot ok";$("summary").textContent=j.mood+" / "+j.style+" / "+mouth.style+" "+mouth.shape;$("status").textContent=JSON.stringify(j,null,2);$("wifiStatus").textContent=(wifi.mode||"?")+" "+(wifi.ip||"")+" "+(wifi.saved_credentials?"saved":"")}
async function refresh(){try{const r=await fetch("/state");render(await r.json())}catch(e){$("dot").className="dot bad";$("summary").textContent=e.message;$("status").textContent=e.stack||e.message}}
async function uploadOta(){const file=$("otaFile").files[0];if(!file)throw new Error("choose a firmware .bin first");$("summary").textContent="uploading firmware...";const data=new FormData();data.append("firmware",file,file.name);const r=await fetch("/ota",{method:"POST",body:data});const j=await r.json().catch(()=>({ok:false,error:"bad json"}));if(!r.ok||j.ok===false)throw new Error(j.error||r.statusText);render(j);return j}
function payloadFromButton(b){const p={};if(b.dataset.select)p[b.dataset.key||"name"]=$(b.dataset.select).value;if(b.dataset.duration)p.duration=number(b.dataset.duration);return p}
document.addEventListener("click",async e=>{const b=e.target.closest("button");if(!b)return;try{
if(b.dataset.post){await post(b.dataset.post,payloadFromButton(b));return}
if(b.id==="mouthApply")await post("/mouth",{style:$("mouthStyle").value,shape:$("mouthShape").value,energy:number("energy"),duration:number("mouthDur")});
else if(b.id==="mouthTalk")await post("/mouth",{style:$("mouthStyle").value,shape:$("mouthShape").value,talking:true,energy:number("energy"),duration:number("mouthDur")});
else if(b.id==="mouthStop")await post("/mouth",{talking:false,duration:number("mouthDur")});
else if(b.id==="mouthAuto")await post("/mouth",{auto:true});
else if(b.id==="gazeApply")await post("/gaze",{x:number("gx"),y:number("gy"),duration:number("gdur"),move_ms:number("gmove")});
else if(b.id==="gazeCenter")await post("/gaze",{x:0,y:0,duration:number("gdur"),move_ms:number("gmove")});
else if(b.id==="gazeAuto")await post("/gaze","auto");
else if(b.id==="idleOn")await post("/control",{idle:true});
else if(b.id==="idleOff")await post("/control",{idle:false});
else if(b.id==="blink")await post("/control",{blink:true,duration_ms:420});
else if(b.id==="doubleBlink")await post("/control",{blink:true,double:true,duration_ms:260});
else if(b.id==="winkL")await post("/control",{wink:true,eye:"left",duration_ms:650});
else if(b.id==="winkR")await post("/control",{wink:true,eye:"right",duration_ms:650});
else if(b.id==="sleep")await post("/control",{sleep:true,duration:0});
else if(b.id==="release")await post("/control",{release:true});
else if(b.id==="flip")await post("/control",{flip:"toggle"});
else if(b.id==="wifiSave")await post("/wifi",{ssid:$("ssid").value,password:$("wifiPass").value});
else if(b.id==="wifiClear")await post("/wifi",{clear:true});
else if(b.id==="otaUpload")await uploadOta();
else if(b.id==="refresh")await refresh();
}catch(err){$("dot").className="dot bad";$("summary").textContent=err.message;$("status").textContent=err.stack||err.message}});
async function init(){await Promise.all([values("/styles","styles","style"),values("/moods","moods","mood"),values("/beats","beats","beat"),values("/mouth_styles","mouth_styles","mouthStyle"),values("/mouth_shapes","mouth_shapes","mouthShape")]);await refresh();setInterval(refresh,2500)}
init();
</script>
</body>
</html>
)FACEUI";

#if !USE_SOFTWARE_SPI
#ifndef HSPI
#define HSPI FSPI
#endif
SPIClass leftSpi(FSPI);
#if REACHY_SHARE_EYE_SPI
Adafruit_GC9A01A leftTft(&leftSpi, PIN_L_DC, PIN_L_CS, PIN_L_TFT_RST);
Adafruit_GC9A01A rightTft(&leftSpi, PIN_R_DC, PIN_R_CS, PIN_R_TFT_RST);
#if REACHY_HAS_MOUTH
Adafruit_GC9A01A mouthTft(&leftSpi, PIN_MOUTH_DC, PIN_MOUTH_CS, PIN_MOUTH_TFT_RST);
#endif
#if REACHY_HAS_AUX_DISPLAY
Adafruit_ILI9341 auxTft(&leftSpi, PIN_AUX_DC, PIN_AUX_CS, PIN_AUX_TFT_RST);
#endif
#else
SPIClass rightSpi(HSPI);
Adafruit_GC9A01A leftTft(&leftSpi, PIN_L_DC, PIN_L_CS, PIN_L_TFT_RST);
Adafruit_GC9A01A rightTft(&rightSpi, PIN_R_DC, PIN_R_CS, PIN_R_TFT_RST);
#if REACHY_HAS_MOUTH
Adafruit_GC9A01A mouthTft(&leftSpi, PIN_MOUTH_DC, PIN_MOUTH_CS, PIN_MOUTH_TFT_RST);
#endif
#if REACHY_HAS_AUX_DISPLAY
Adafruit_ILI9341 auxTft(&leftSpi, PIN_AUX_DC, PIN_AUX_CS, PIN_AUX_TFT_RST);
#endif
#endif
#else
Adafruit_GC9A01A leftTft(PIN_L_CS, PIN_L_DC, PIN_L_MOSI, PIN_L_SCLK, PIN_L_TFT_RST);
Adafruit_GC9A01A rightTft(PIN_R_CS, PIN_R_DC, PIN_R_MOSI, PIN_R_SCLK, PIN_R_TFT_RST);
#if REACHY_HAS_MOUTH
Adafruit_GC9A01A mouthTft(PIN_MOUTH_CS, PIN_MOUTH_DC, PIN_MOUTH_MOSI, PIN_MOUTH_SCLK, PIN_MOUTH_TFT_RST);
#endif
#if REACHY_HAS_AUX_DISPLAY
Adafruit_ILI9341 auxTft(PIN_AUX_CS, PIN_AUX_DC, PIN_AUX_MOSI, PIN_AUX_SCLK, PIN_AUX_TFT_RST);
#endif
#endif

GFXcanvas16 frame(SCREEN_W, SCREEN_H);
WebServer server(80);

uint16_t rgb(uint8_t r, uint8_t g, uint8_t b) {
  return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
}

uint8_t chanR(uint16_t c) { return (c >> 8) & 0xF8; }
uint8_t chanG(uint16_t c) { return (c >> 3) & 0xFC; }
uint8_t chanB(uint16_t c) { return (c << 3) & 0xF8; }

uint16_t mixColor(uint16_t a, uint16_t b, float t) {
  t = constrain(t, 0.0f, 1.0f);
  const float u = 1.0f - t;
  return rgb(uint8_t(chanR(a) * u + chanR(b) * t),
             uint8_t(chanG(a) * u + chanG(b) * t),
             uint8_t(chanB(a) * u + chanB(b) * t));
}

float randf(float low, float high) {
  return low + (high - low) * (float(random(0, 10001)) / 10000.0f);
}

float clampf(float v, float low, float high) {
  if (v < low) return low;
  if (v > high) return high;
  return v;
}

int16_t mini16(int16_t a, int16_t b) {
  return a < b ? a : b;
}

int16_t maxi16(int16_t a, int16_t b) {
  return a > b ? a : b;
}

float smoothstep(float t) {
  t = clampf(t, 0.0f, 1.0f);
  return t * t * (3.0f - 2.0f * t);
}

float easeOutCubic(float t) {
  t = clampf(t, 0.0f, 1.0f);
  const float u = 1.0f - t;
  return 1.0f - u * u * u;
}

bool deadlineReached(uint32_t now, uint32_t deadline) {
  return deadline != 0 && int32_t(now - deadline) >= 0;
}

bool equalsIgnoreCase(const char *a, const char *b) {
  if (a == nullptr || b == nullptr) return false;
  while (*a != '\0' && *b != '\0') {
    if (tolower(uint8_t(*a)) != tolower(uint8_t(*b))) return false;
    ++a;
    ++b;
  }
  return *a == '\0' && *b == '\0';
}

struct Vec2 {
  float x;
  float y;
};

struct Vec3 {
  float x;
  float y;
  float z;
};

Vec3 lerpVec3(const Vec3 &a, const Vec3 &b, float t) {
  return {
    a.x + (b.x - a.x) * t,
    a.y + (b.y - a.y) * t,
    a.z + (b.z - a.z) * t
  };
}

enum class Mood : uint8_t {
  Calm,
  Curious,
  Surprised,
  Suspicious,
  Afraid,
  Angry,
  Sleepy,
  Sleep,
  Goofy,
  Robotic,
  Wonder,
  Glitchy,
  Happy,
  Delighted,
  Bashful,
  Bored,
  Focused,
  Confused,
  Proud,
  Mischief,
  Affection
};

const char *moodName(Mood mood) {
  switch (mood) {
    case Mood::Calm: return "calm";
    case Mood::Curious: return "curious";
    case Mood::Surprised: return "surprised";
    case Mood::Suspicious: return "suspicious";
    case Mood::Afraid: return "afraid";
    case Mood::Angry: return "angry";
    case Mood::Sleepy: return "sleepy";
    case Mood::Sleep: return "sleep";
    case Mood::Goofy: return "goofy";
    case Mood::Robotic: return "robotic";
    case Mood::Wonder: return "wonder";
    case Mood::Glitchy: return "glitchy";
    case Mood::Happy: return "happy";
    case Mood::Delighted: return "delighted";
    case Mood::Bashful: return "bashful";
    case Mood::Bored: return "bored";
    case Mood::Focused: return "focused";
    case Mood::Confused: return "confused";
    case Mood::Proud: return "proud";
    case Mood::Mischief: return "mischief";
    case Mood::Affection: return "affection";
    default: return "unknown";
  }
}

bool parseMoodName(const char *text, Mood &mood) {
  if (equalsIgnoreCase(text, "calm")) mood = Mood::Calm;
  else if (equalsIgnoreCase(text, "curious")) mood = Mood::Curious;
  else if (equalsIgnoreCase(text, "surprised") || equalsIgnoreCase(text, "surprise")) mood = Mood::Surprised;
  else if (equalsIgnoreCase(text, "suspicious")) mood = Mood::Suspicious;
  else if (equalsIgnoreCase(text, "afraid") || equalsIgnoreCase(text, "fear")) mood = Mood::Afraid;
  else if (equalsIgnoreCase(text, "angry")) mood = Mood::Angry;
  else if (equalsIgnoreCase(text, "sleepy")) mood = Mood::Sleepy;
  else if (equalsIgnoreCase(text, "sleep") || equalsIgnoreCase(text, "blank")) mood = Mood::Sleep;
  else if (equalsIgnoreCase(text, "goofy") || equalsIgnoreCase(text, "silly")) mood = Mood::Goofy;
  else if (equalsIgnoreCase(text, "robotic") || equalsIgnoreCase(text, "robot")) mood = Mood::Robotic;
  else if (equalsIgnoreCase(text, "wonder")) mood = Mood::Wonder;
  else if (equalsIgnoreCase(text, "glitchy") || equalsIgnoreCase(text, "glitch")) mood = Mood::Glitchy;
  else if (equalsIgnoreCase(text, "happy") || equalsIgnoreCase(text, "smile")) mood = Mood::Happy;
  else if (equalsIgnoreCase(text, "delighted") || equalsIgnoreCase(text, "sparkle") || equalsIgnoreCase(text, "excited")) mood = Mood::Delighted;
  else if (equalsIgnoreCase(text, "bashful") || equalsIgnoreCase(text, "shy")) mood = Mood::Bashful;
  else if (equalsIgnoreCase(text, "bored") || equalsIgnoreCase(text, "meh")) mood = Mood::Bored;
  else if (equalsIgnoreCase(text, "focused") || equalsIgnoreCase(text, "focus")) mood = Mood::Focused;
  else if (equalsIgnoreCase(text, "confused") || equalsIgnoreCase(text, "puzzled")) mood = Mood::Confused;
  else if (equalsIgnoreCase(text, "proud")) mood = Mood::Proud;
  else if (equalsIgnoreCase(text, "mischief") || equalsIgnoreCase(text, "mischievous")) mood = Mood::Mischief;
  else if (equalsIgnoreCase(text, "affection") || equalsIgnoreCase(text, "love") || equalsIgnoreCase(text, "fond")) mood = Mood::Affection;
  else return false;
  return true;
}

struct LidPose {
  float topY;
  float bottomY;
  float topCurve;
  float bottomCurve;
  float topSlant;
  float bottomSlant;
  float pupilRadius;
  float jitter;
};

enum class EyeRenderStyle : uint8_t {
  Friendly,
  Classic,
  Cartoony,
  Robot,
  Sinister,
  Sleepy
};

const char *eyeStyleName(EyeRenderStyle style) {
  switch (style) {
    case EyeRenderStyle::Classic: return "classic";
    case EyeRenderStyle::Cartoony: return "cartoony";
    case EyeRenderStyle::Robot: return "robot";
    case EyeRenderStyle::Sinister: return "sinister";
    case EyeRenderStyle::Sleepy: return "sleepy";
    case EyeRenderStyle::Friendly:
    default: return "friendly";
  }
}

bool parseEyeStyleName(const char *text, EyeRenderStyle &style) {
  if (equalsIgnoreCase(text, "friendly") || equalsIgnoreCase(text, "default")) style = EyeRenderStyle::Friendly;
  else if (equalsIgnoreCase(text, "classic")) style = EyeRenderStyle::Classic;
  else if (equalsIgnoreCase(text, "cartoony") || equalsIgnoreCase(text, "cartoon")) style = EyeRenderStyle::Cartoony;
  else if (equalsIgnoreCase(text, "robot") || equalsIgnoreCase(text, "dot") || equalsIgnoreCase(text, "big_dot")) style = EyeRenderStyle::Robot;
  else if (equalsIgnoreCase(text, "sinister") || equalsIgnoreCase(text, "red")) style = EyeRenderStyle::Sinister;
  else if (equalsIgnoreCase(text, "sleepy") || equalsIgnoreCase(text, "steel")) style = EyeRenderStyle::Sleepy;
  else return false;
  return true;
}

enum class MouthStyle : uint8_t {
  Human,
  Robot
};

const char *mouthStyleName(MouthStyle style) {
  switch (style) {
    case MouthStyle::Robot: return "robot";
    case MouthStyle::Human:
    default: return "human";
  }
}

bool parseMouthStyleName(const char *text, MouthStyle &style) {
  if (equalsIgnoreCase(text, "human") || equalsIgnoreCase(text, "humanistic") || equalsIgnoreCase(text, "790")) {
    style = MouthStyle::Human;
  } else if (equalsIgnoreCase(text, "robot") || equalsIgnoreCase(text, "simple")) {
    style = MouthStyle::Robot;
  } else {
    return false;
  }
  return true;
}

enum class MouthShape : uint8_t {
  Neutral,
  Smile,
  SmirkLeft,
  SmirkRight,
  Open,
  Wide,
  Frown,
  Grimace,
  Sneer,
  Sleep
};

const char *mouthShapeName(MouthShape shape) {
  switch (shape) {
    case MouthShape::Smile: return "smile";
    case MouthShape::SmirkLeft: return "smirk_left";
    case MouthShape::SmirkRight: return "smirk_right";
    case MouthShape::Open: return "open";
    case MouthShape::Wide: return "wide";
    case MouthShape::Frown: return "frown";
    case MouthShape::Grimace: return "grimace";
    case MouthShape::Sneer: return "sneer";
    case MouthShape::Sleep: return "sleep";
    case MouthShape::Neutral:
    default: return "neutral";
  }
}

bool parseMouthShapeName(const char *text, MouthShape &shape) {
  if (equalsIgnoreCase(text, "neutral") || equalsIgnoreCase(text, "flat") || equalsIgnoreCase(text, "line")) {
    shape = MouthShape::Neutral;
  } else if (equalsIgnoreCase(text, "smile") || equalsIgnoreCase(text, "happy")) {
    shape = MouthShape::Smile;
  } else if (equalsIgnoreCase(text, "smirk_left") || equalsIgnoreCase(text, "left_smirk")) {
    shape = MouthShape::SmirkLeft;
  } else if (equalsIgnoreCase(text, "smirk_right") || equalsIgnoreCase(text, "smirk") ||
             equalsIgnoreCase(text, "right_smirk")) {
    shape = MouthShape::SmirkRight;
  } else if (equalsIgnoreCase(text, "open") || equalsIgnoreCase(text, "talk") || equalsIgnoreCase(text, "speaking")) {
    shape = MouthShape::Open;
  } else if (equalsIgnoreCase(text, "wide") || equalsIgnoreCase(text, "surprised") || equalsIgnoreCase(text, "shout")) {
    shape = MouthShape::Wide;
  } else if (equalsIgnoreCase(text, "frown") || equalsIgnoreCase(text, "sad")) {
    shape = MouthShape::Frown;
  } else if (equalsIgnoreCase(text, "grimace") || equalsIgnoreCase(text, "teeth") || equalsIgnoreCase(text, "tense")) {
    shape = MouthShape::Grimace;
  } else if (equalsIgnoreCase(text, "sneer") || equalsIgnoreCase(text, "sinister")) {
    shape = MouthShape::Sneer;
  } else if (equalsIgnoreCase(text, "sleep") || equalsIgnoreCase(text, "blank")) {
    shape = MouthShape::Sleep;
  } else {
    return false;
  }
  return true;
}

struct MouthPose {
  MouthPose() = default;
  MouthPose(float openValue, float widthValue, float curveValue, float skewValue, float teethValue, float tensionValue)
    : open(openValue),
      width(widthValue),
      curve(curveValue),
      skew(skewValue),
      teeth(teethValue),
      tension(tensionValue) {}

  float open = 0.0f;
  float width = 0.0f;
  float curve = 0.0f;
  float skew = 0.0f;
  float teeth = 0.0f;
  float tension = 0.0f;
};

MouthPose mouthPoseFor(MouthShape shape) {
  switch (shape) {
    case MouthShape::Smile: return {0.22f, 0.78f, 0.55f, 0.0f, 0.0f, 0.16f};
    case MouthShape::SmirkLeft: return {0.22f, 0.70f, 0.70f, -0.92f, 0.0f, 0.48f};
    case MouthShape::SmirkRight: return {0.22f, 0.70f, 0.70f, 0.92f, 0.0f, 0.48f};
    case MouthShape::Open: return {0.58f, 0.64f, 0.05f, 0.0f, 0.0f, 0.18f};
    case MouthShape::Wide: return {0.84f, 0.76f, 0.04f, 0.0f, 0.0f, 0.22f};
    case MouthShape::Frown: return {0.18f, 0.64f, -0.54f, 0.0f, 0.0f, 0.30f};
    case MouthShape::Grimace: return {0.32f, 0.80f, -0.08f, 0.0f, 0.78f, 0.88f};
    case MouthShape::Sneer: return {0.24f, 0.70f, -0.20f, -0.22f, 0.22f, 0.62f};
    case MouthShape::Sleep: return {0.05f, 0.44f, -0.08f, 0.0f, 0.0f, 0.08f};
    case MouthShape::Neutral:
    default: return {0.12f, 0.60f, 0.0f, 0.0f, 0.0f, 0.12f};
  }
}

MouthPose mixMouthPose(const MouthPose &a, const MouthPose &b, float t) {
  return {
    a.open + (b.open - a.open) * t,
    a.width + (b.width - a.width) * t,
    a.curve + (b.curve - a.curve) * t,
    a.skew + (b.skew - a.skew) * t,
    a.teeth + (b.teeth - a.teeth) * t,
    a.tension + (b.tension - a.tension) * t
  };
}

MouthShape mouthShapeForMood(Mood mood) {
  switch (mood) {
    case Mood::Happy:
    case Mood::Delighted:
    case Mood::Affection:
    case Mood::Proud:
      return MouthShape::Smile;
    case Mood::Suspicious:
    case Mood::Mischief:
      return MouthShape::SmirkRight;
    case Mood::Angry:
      return MouthShape::Sneer;
    case Mood::Afraid:
    case Mood::Surprised:
    case Mood::Wonder:
      return MouthShape::Open;
    case Mood::Confused:
    case Mood::Goofy:
      return MouthShape::SmirkLeft;
    case Mood::Sleepy:
      return MouthShape::Frown;
    case Mood::Sleep:
      return MouthShape::Sleep;
    case Mood::Focused:
    case Mood::Robotic:
      return MouthShape::Grimace;
    case Mood::Bored:
      return MouthShape::Neutral;
    case Mood::Bashful:
      return MouthShape::Smile;
    case Mood::Glitchy:
      return MouthShape::Wide;
    case Mood::Curious:
    case Mood::Calm:
    default:
      return MouthShape::Neutral;
  }
}

LidPose poseFor(Mood mood, bool leftEye) {
  const float inward = leftEye ? 1.0f : -1.0f;

  switch (mood) {
    case Mood::Curious:
      return {53.0f, 201.0f, 25.0f, 17.0f, -5.0f * inward, 2.0f * inward, 16.5f, 0.8f};
    case Mood::Surprised:
      return {31.0f, 217.0f, 18.0f, 12.0f, 0.0f, 0.0f, 18.5f, 1.2f};
    case Mood::Suspicious:
      return {88.0f, 179.0f, 20.0f, 14.0f, -12.0f * inward, 4.0f * inward, 13.5f, 0.35f};
    case Mood::Afraid:
      return {35.0f, 214.0f, 21.0f, 12.0f, 4.0f * inward, 0.0f, 18.5f, 1.8f};
    case Mood::Angry:
      return {82.0f, 184.0f, 18.0f, 15.0f, 23.0f * inward, -2.0f * inward, 14.5f, 0.45f};
    case Mood::Sleepy:
      return {103.0f, 169.0f, 13.0f, 10.0f, -3.0f * inward, 0.0f, 13.0f, 0.12f};
    case Mood::Sleep:
      return {126.0f, 126.0f, 0.0f, 0.0f, 0.0f, 0.0f, 13.0f, 0.0f};
    case Mood::Goofy:
      return {52.0f, 204.0f, 31.0f, 18.0f, 12.0f * inward, -8.0f * inward, 16.0f, 1.15f};
    case Mood::Robotic:
      return {58.0f, 198.0f, 9.0f, 8.0f, 0.0f, 0.0f, 14.5f, 0.0f};
    case Mood::Wonder:
      return {37.0f, 212.0f, 27.0f, 15.0f, -2.0f * inward, 1.0f * inward, 17.5f, 0.55f};
    case Mood::Glitchy:
      return {63.0f, 190.0f, 8.0f, 8.0f, 18.0f * inward, -16.0f * inward, 15.0f, 2.2f};
    case Mood::Happy:
      return {82.0f, 187.0f, 36.0f, 25.0f, -4.0f * inward, -3.0f * inward, 16.8f, 0.25f};
    case Mood::Delighted:
      return {42.0f, 214.0f, 35.0f, 19.0f, -7.0f * inward, 4.0f * inward, 18.8f, 1.05f};
    case Mood::Bashful:
      return {76.0f, 188.0f, 32.0f, 24.0f, -10.0f * inward, 7.0f * inward, 16.0f, 0.18f};
    case Mood::Bored:
      return {101.0f, 171.0f, 19.0f, 11.0f, -1.0f * inward, 0.0f, 12.4f, 0.05f};
    case Mood::Focused:
      return {72.0f, 190.0f, 15.0f, 11.0f, 4.0f * inward, -2.0f * inward, 13.2f, 0.08f};
    case Mood::Confused:
      return leftEye ? LidPose{50.0f, 201.0f, 25.0f, 17.0f, -12.0f, 4.0f, 16.4f, 0.65f}
                     : LidPose{82.0f, 184.0f, 21.0f, 14.0f, -6.0f, 2.0f, 15.2f, 0.45f};
    case Mood::Proud:
      return {86.0f, 184.0f, 28.0f, 18.0f, 7.0f * inward, -4.0f * inward, 15.2f, 0.12f};
    case Mood::Mischief:
      return {89.0f, 181.0f, 22.0f, 15.0f, -18.0f * inward, 8.0f * inward, 14.1f, 0.22f};
    case Mood::Affection:
      return {70.0f, 195.0f, 42.0f, 26.0f, -3.0f * inward, 2.0f * inward, 17.9f, 0.16f};
    case Mood::Calm:
    default:
      return {64.0f, 194.0f, 27.0f, 18.0f, 0.0f, 0.0f, 15.5f, 0.45f};
  }
}

LidPose mixPose(const LidPose &a, const LidPose &b, float t) {
  return {
    a.topY + (b.topY - a.topY) * t,
    a.bottomY + (b.bottomY - a.bottomY) * t,
    a.topCurve + (b.topCurve - a.topCurve) * t,
    a.bottomCurve + (b.bottomCurve - a.bottomCurve) * t,
    a.topSlant + (b.topSlant - a.topSlant) * t,
    a.bottomSlant + (b.bottomSlant - a.bottomSlant) * t,
    a.pupilRadius + (b.pupilRadius - a.pupilRadius) * t,
    a.jitter + (b.jitter - a.jitter) * t
  };
}

Mood chooseMood() {
  const int r = random(0, 100);
  if (r < 21) return Mood::Calm;
  if (r < 41) return Mood::Curious;
  if (r < 52) return Mood::Suspicious;
  if (r < 60) return Mood::Sleepy;
  if (r < 68) return Mood::Goofy;
  if (r < 75) return Mood::Happy;
  if (r < 81) return Mood::Wonder;
  if (r < 86) return Mood::Bashful;
  if (r < 90) return Mood::Proud;
  if (r < 93) return Mood::Mischief;
  if (r < 96) return Mood::Robotic;
  if (r < 98) return Mood::Surprised;
  return random(0, 100) < 50 ? Mood::Glitchy : Mood::Afraid;
}

uint32_t moodHoldMs(Mood mood) {
  switch (mood) {
    case Mood::Surprised: return uint32_t(randf(850.0f, 1700.0f));
    case Mood::Afraid: return uint32_t(randf(1300.0f, 2700.0f));
    case Mood::Sleepy: return uint32_t(randf(3600.0f, 7600.0f));
    case Mood::Sleep: return uint32_t(randf(6000.0f, 12000.0f));
    case Mood::Goofy: return uint32_t(randf(1800.0f, 3800.0f));
    case Mood::Robotic: return uint32_t(randf(2200.0f, 5000.0f));
    case Mood::Wonder: return uint32_t(randf(2300.0f, 5200.0f));
    case Mood::Glitchy: return uint32_t(randf(650.0f, 1800.0f));
    case Mood::Happy: return uint32_t(randf(5200.0f, 12000.0f));
    case Mood::Delighted: return uint32_t(randf(2400.0f, 5600.0f));
    case Mood::Bashful: return uint32_t(randf(5200.0f, 11000.0f));
    case Mood::Bored: return uint32_t(randf(6500.0f, 15000.0f));
    case Mood::Focused: return uint32_t(randf(4200.0f, 9500.0f));
    case Mood::Confused: return uint32_t(randf(2400.0f, 5600.0f));
    case Mood::Proud: return uint32_t(randf(5600.0f, 12500.0f));
    case Mood::Mischief: return uint32_t(randf(3800.0f, 8500.0f));
    case Mood::Affection: return uint32_t(randf(6500.0f, 14000.0f));
    case Mood::Angry: return uint32_t(randf(2200.0f, 4600.0f));
    case Mood::Suspicious: return uint32_t(randf(2500.0f, 5200.0f));
    case Mood::Curious: return uint32_t(randf(4200.0f, 9000.0f));
    case Mood::Calm:
    default: return uint32_t(randf(3800.0f, 7800.0f));
  }
}

struct MoodState {
  Mood from = Mood::Calm;
  Mood to = Mood::Curious;
  uint32_t started = 0;
  uint32_t duration = 900;
  uint32_t next = 3600;
};

struct GazeState {
  Vec3 from = {0.0f, 0.0f, 700.0f};
  Vec3 to = {38.0f, 20.0f, 520.0f};
  Vec3 now = {0.0f, 0.0f, 700.0f};
  uint32_t started = 0;
  uint32_t duration = 240;
  uint32_t next = 900;
  float microX = 0.0f;
  float microY = 0.0f;
  uint32_t nextMicro = 0;
};

struct BlinkState {
  bool active = false;
  bool requestedDouble = false;
  bool winkOnly = false;
  bool winkLeft = true;
  bool leftLeads = true;
  uint16_t leadMs = 18;
  uint32_t started = 0;
  uint32_t duration = 150;
  uint32_t next = 1800;
};

struct ApiState {
  bool idleEnabled = true;
  bool moodOverride = false;
  uint32_t moodUntil = 0;
  bool gazeOverride = false;
  uint32_t gazeUntil = 0;
  bool eyesFlipped = false;
  char line[API_LINE_MAX] = {};
  uint8_t lineLen = 0;
};

struct MouthState {
  MouthStyle style = MouthStyle::Human;
  MouthShape shape = MouthShape::Neutral;
  MouthShape renderedShape = MouthShape::Neutral;
  bool overrideShape = false;
  bool talking = false;
  bool poseInitialized = false;
  uint32_t overrideUntil = 0;
  uint32_t poseStarted = 0;
  uint32_t talkUpdated = 0;
  float energy = 0.45f;
  float talkLevel = 0.0f;
  MouthPose poseFrom;
  MouthPose poseTo;
  MouthPose poseNow;
};

struct ButtonState {
  bool stablePressed = false;
  bool lastRawPressed = false;
  bool longPressHandled = false;
  uint32_t lastRawChange = 0;
  uint32_t pressedAt = 0;
};

enum class IdleBeat : uint8_t {
  None,
  Inspect,
  DoubleTake,
  Drowsy,
  RobotScan,
  Wary,
  Goofy,
  Startle,
  Thoughtful,
  SlowSmile,
  Daydream,
  FocusLock,
  ConfusedLook,
  Mischief,
  Affection
};

struct IdleDirector {
  bool active = false;
  IdleBeat beat = IdleBeat::None;
  uint8_t step = 0;
  uint32_t nextStep = 0;
  uint32_t nextBeat = 0;
  Vec3 anchor = {0.0f, 0.0f, 650.0f};
  float side = 1.0f;
};

MoodState moodState;
GazeState gazeState;
BlinkState blinkState;
ApiState apiState;
MouthState mouthState;
ButtonState flipButton;
IdleDirector idleDirector;
EyeRenderStyle eyeRenderStyle = EyeRenderStyle::Friendly;
float pupilRadius = 16.0f;
uint32_t lastFrame = 0;
uint32_t lastUpdate = 0;
#if REACHY_HAS_AUX_DISPLAY
uint32_t lastAuxFrame = 0;
bool auxNeedsFullPaint = true;
#if REACHY_AUX_USES_MOUTH_FRAME
bool auxMouthRendered = false;
MouthShape auxLastMouthShape = MouthShape::Neutral;
MouthStyle auxLastMouthStyle = MouthStyle::Human;
#endif
#endif
#if REACHY_HAS_MOUTH && REACHY_HAS_AUX_DISPLAY && (REACHY_AUX_ROLE == REACHY_AUX_ROLE_MOUTH_ONLY) && REACHY_MOUTH_STATUS_WHEN_AUX_MOUTH
#define REACHY_MOUTH_STATUS_DISPLAY 1
uint32_t lastMouthStatusFrame = 0;
bool mouthStatusNeedsFullPaint = true;
bool mouthStatusDotDrawn = false;
int16_t mouthStatusDotX = 120;
int16_t mouthStatusDotY = 120;
char mouthStatusLastValues[4][24] = {{0}};
#else
#define REACHY_MOUTH_STATUS_DISPLAY 0
#endif
uint32_t restartAt = 0;
bool otaActive = false;
bool otaSucceeded = false;
size_t otaBytes = 0;
char otaMessage[128] = "idle";

Vec3 pickGazeTarget(Mood mood) {
  switch (mood) {
    case Mood::Curious:
      return {randf(-145.0f, 145.0f), randf(-65.0f, 80.0f), randf(220.0f, 620.0f)};
    case Mood::Surprised:
      return {randf(-22.0f, 22.0f), randf(-8.0f, 28.0f), randf(210.0f, 330.0f)};
    case Mood::Suspicious:
      return {randf(-85.0f, 85.0f), randf(-35.0f, 20.0f), randf(390.0f, 820.0f)};
    case Mood::Afraid:
      return {randf(-36.0f, 36.0f), randf(5.0f, 55.0f), randf(170.0f, 300.0f)};
    case Mood::Angry:
      return {randf(-45.0f, 45.0f), randf(-30.0f, 18.0f), randf(280.0f, 560.0f)};
    case Mood::Sleepy:
      return {randf(-32.0f, 32.0f), randf(-70.0f, -24.0f), randf(650.0f, 1200.0f)};
    case Mood::Goofy:
      return {randf(-155.0f, 155.0f), randf(-88.0f, 86.0f), randf(170.0f, 460.0f)};
    case Mood::Robotic: {
      const float xs[] = {-120.0f, -60.0f, 0.0f, 60.0f, 120.0f};
      const float ys[] = {-48.0f, 0.0f, 48.0f};
      return {xs[random(0, 5)], ys[random(0, 3)], randf(360.0f, 780.0f)};
    }
    case Mood::Wonder:
      return {randf(-72.0f, 72.0f), randf(18.0f, 92.0f), randf(210.0f, 480.0f)};
    case Mood::Glitchy:
      return {randf(-150.0f, 150.0f), randf(-80.0f, 80.0f), randf(150.0f, 900.0f)};
    case Mood::Happy:
      return {randf(-54.0f, 54.0f), randf(-4.0f, 54.0f), randf(360.0f, 760.0f)};
    case Mood::Delighted:
      return {randf(-76.0f, 76.0f), randf(12.0f, 78.0f), randf(190.0f, 430.0f)};
    case Mood::Bashful:
      return {randf(-96.0f, 96.0f), randf(-82.0f, -24.0f), randf(420.0f, 820.0f)};
    case Mood::Bored:
      return {randf(-34.0f, 34.0f), randf(-76.0f, -36.0f), randf(780.0f, 1300.0f)};
    case Mood::Focused:
      return {randf(-18.0f, 18.0f), randf(-8.0f, 20.0f), randf(230.0f, 420.0f)};
    case Mood::Confused:
      return {randf(-118.0f, 118.0f), randf(-38.0f, 64.0f), randf(260.0f, 680.0f)};
    case Mood::Proud:
      return {randf(-42.0f, 42.0f), randf(36.0f, 88.0f), randf(540.0f, 980.0f)};
    case Mood::Mischief:
      return {randf(-138.0f, 138.0f), randf(-24.0f, 32.0f), randf(320.0f, 700.0f)};
    case Mood::Affection:
      return {randf(-26.0f, 26.0f), randf(8.0f, 52.0f), randf(260.0f, 520.0f)};
    case Mood::Calm:
    default:
      if (random(0, 100) < 45) {
        return {randf(-42.0f, 42.0f), randf(-24.0f, 42.0f), randf(560.0f, 1100.0f)};
      }
      return {randf(-118.0f, 118.0f), randf(-50.0f, 66.0f), randf(360.0f, 920.0f)};
  }
}

uint32_t gazeHoldFor(Mood mood) {
  switch (mood) {
    case Mood::Curious: return uint32_t(randf(260.0f, 1300.0f));
    case Mood::Surprised: return uint32_t(randf(110.0f, 420.0f));
    case Mood::Afraid: return uint32_t(randf(120.0f, 520.0f));
    case Mood::Sleepy: return uint32_t(randf(1300.0f, 4200.0f));
    case Mood::Goofy: return uint32_t(randf(150.0f, 720.0f));
    case Mood::Robotic: return uint32_t(randf(360.0f, 980.0f));
    case Mood::Wonder: return uint32_t(randf(900.0f, 2600.0f));
    case Mood::Glitchy: return uint32_t(randf(70.0f, 260.0f));
    case Mood::Happy: return uint32_t(randf(1300.0f, 3600.0f));
    case Mood::Delighted: return uint32_t(randf(260.0f, 950.0f));
    case Mood::Bashful: return uint32_t(randf(1400.0f, 3600.0f));
    case Mood::Bored: return uint32_t(randf(2600.0f, 6200.0f));
    case Mood::Focused: return uint32_t(randf(1800.0f, 5200.0f));
    case Mood::Confused: return uint32_t(randf(300.0f, 1100.0f));
    case Mood::Proud: return uint32_t(randf(1800.0f, 4600.0f));
    case Mood::Mischief: return uint32_t(randf(850.0f, 2300.0f));
    case Mood::Affection: return uint32_t(randf(2600.0f, 6200.0f));
    case Mood::Suspicious: return uint32_t(randf(700.0f, 2200.0f));
    case Mood::Angry: return uint32_t(randf(900.0f, 2600.0f));
    case Mood::Calm:
    default: return uint32_t(randf(650.0f, 2600.0f));
  }
}

uint32_t gazeMoveFor(Mood mood) {
  switch (mood) {
    case Mood::Suspicious:
    case Mood::Angry:
      return uint32_t(randf(170.0f, 420.0f));
    case Mood::Surprised:
    case Mood::Afraid:
      return uint32_t(randf(80.0f, 160.0f));
    case Mood::Sleepy:
      return uint32_t(randf(450.0f, 950.0f));
    case Mood::Goofy:
      return uint32_t(randf(70.0f, 210.0f));
    case Mood::Robotic:
      return uint32_t(randf(35.0f, 80.0f));
    case Mood::Wonder:
      return uint32_t(randf(220.0f, 520.0f));
    case Mood::Glitchy:
      return uint32_t(randf(24.0f, 80.0f));
    case Mood::Happy:
    case Mood::Affection:
    case Mood::Proud:
      return uint32_t(randf(280.0f, 680.0f));
    case Mood::Delighted:
    case Mood::Confused:
    case Mood::Mischief:
      return uint32_t(randf(85.0f, 240.0f));
    case Mood::Bashful:
    case Mood::Bored:
      return uint32_t(randf(520.0f, 1200.0f));
    case Mood::Focused:
      return uint32_t(randf(160.0f, 360.0f));
    case Mood::Curious:
      return uint32_t(randf(95.0f, 260.0f));
    case Mood::Calm:
    default:
      return uint32_t(randf(130.0f, 360.0f));
  }
}

float currentMoodBlend(uint32_t now) {
  return smoothstep(float(now - moodState.started) / float(moodState.duration));
}

Mood currentMood(uint32_t now) {
  return currentMoodBlend(now) >= 1.0f ? moodState.to : moodState.from;
}

LidPose blendedPose(bool leftEye, uint32_t now) {
  return mixPose(poseFor(moodState.from, leftEye),
                 poseFor(moodState.to, leftEye),
                 currentMoodBlend(now));
}

void beginMood(Mood mood, uint32_t now, uint32_t holdMs, bool apiOverride) {
  moodState.from = mood == Mood::Sleep ? Mood::Sleep : currentMood(now);
  moodState.to = mood;
  moodState.started = now;
  moodState.duration = mood == Mood::Sleep ? 1 : (apiOverride ? 320 : uint32_t(randf(500.0f, 1150.0f)));
  moodState.next = now + moodState.duration + (holdMs == 0 ? 600000UL : holdMs);

  apiState.moodOverride = apiOverride;
  apiState.moodUntil = (apiOverride && holdMs != 0) ? now + moodState.duration + holdMs : 0;

  if (mood == Mood::Surprised || mood == Mood::Afraid ||
      mood == Mood::Sleepy || mood == Mood::Glitchy ||
      mood == Mood::Delighted || mood == Mood::Confused ||
      mood == Mood::Mischief) {
    blinkState.next = min(blinkState.next, now + uint32_t(randf(150.0f, 520.0f)));
  }
}

void beginGaze(const Vec3 &target, uint32_t now, uint32_t holdMs, uint32_t moveMs, bool apiOverride) {
  gazeState.from = gazeState.now;
  gazeState.to = target;
  gazeState.started = now;
  gazeState.duration = moveMs == 0 ? 1 : moveMs;
  gazeState.next = now + gazeState.duration + (holdMs == 0 ? 600000UL : holdMs);

  apiState.gazeOverride = apiOverride;
  apiState.gazeUntil = (apiOverride && holdMs != 0) ? now + gazeState.duration + holdMs : 0;
}

void scheduleNextIdleBeat(uint32_t now, bool soon);

void beginExpression(Mood mood, uint32_t now, uint32_t holdMs, bool apiOverride) {
  if (idleDirector.active) scheduleNextIdleBeat(now, true);
  beginMood(mood, now, holdMs, apiOverride);
  if (mood == Mood::Sleep) {
    apiState.gazeOverride = false;
    return;
  }
  beginGaze(pickGazeTarget(mood), now, holdMs, gazeMoveFor(mood), apiOverride);
}

void updateMood(uint32_t now) {
  if (apiState.moodOverride && deadlineReached(now, apiState.moodUntil)) {
    apiState.moodOverride = false;
    moodState.next = now;
  }

  if (apiState.moodOverride || !apiState.idleEnabled) return;
  if (idleDirector.active) return;
  if (now < moodState.next) return;

  const Mood nextMood = chooseMood();
  beginMood(nextMood, now, moodHoldMs(nextMood), false);
}

void startNewGaze(uint32_t now, Mood mood) {
  beginGaze(pickGazeTarget(mood), now, gazeHoldFor(mood), gazeMoveFor(mood), false);
}

void updateGaze(uint32_t now) {
  if (apiState.gazeOverride && deadlineReached(now, apiState.gazeUntil)) {
    apiState.gazeOverride = false;
    gazeState.next = now;
  }

  const Mood mood = currentMood(now);
  float t = float(now - gazeState.started) / float(gazeState.duration);
  t = clampf(t, 0.0f, 1.0f);
  const float e = easeOutCubic(t);
  gazeState.now = lerpVec3(gazeState.from, gazeState.to, e);

  if (!apiState.gazeOverride && apiState.idleEnabled && !idleDirector.active && now >= gazeState.next) {
    startNewGaze(now, mood);
  }

  if (now >= gazeState.nextMicro) {
    const LidPose p = blendedPose(true, now);
    gazeState.microX = randf(-p.jitter, p.jitter);
    gazeState.microY = randf(-p.jitter * 0.65f, p.jitter * 0.65f);
    gazeState.nextMicro = now + uint32_t(randf(70.0f, 260.0f));
  }
}

void updateBlink(uint32_t now) {
  if (!blinkState.active && now >= blinkState.next) {
    blinkState.active = true;
    blinkState.started = now;
    const Mood mood = currentMood(now);
    blinkState.leftLeads = random(0, 2) == 0;
    if (mood == Mood::Goofy) {
      blinkState.leadMs = uint16_t(randf(45.0f, 115.0f));
    } else if (mood == Mood::Glitchy) {
      blinkState.leadMs = uint16_t(randf(35.0f, 135.0f));
    } else if (mood == Mood::Sleepy) {
      blinkState.leadMs = uint16_t(randf(24.0f, 75.0f));
    } else if (mood == Mood::Robotic) {
      blinkState.leadMs = uint16_t(randf(4.0f, 14.0f));
    } else if (mood == Mood::Mischief || mood == Mood::Confused) {
      blinkState.leadMs = uint16_t(randf(42.0f, 118.0f));
    } else if (mood == Mood::Affection || mood == Mood::Bored || mood == Mood::Bashful) {
      blinkState.leadMs = uint16_t(randf(18.0f, 46.0f));
    } else {
      blinkState.leadMs = uint16_t(randf(10.0f, 34.0f));
    }

    if (mood == Mood::Sleepy) {
      blinkState.duration = uint32_t(randf(260.0f, 520.0f));
    } else if (mood == Mood::Glitchy || mood == Mood::Robotic) {
      blinkState.duration = uint32_t(randf(55.0f, 125.0f));
    } else if (mood == Mood::Affection || mood == Mood::Bashful || mood == Mood::Bored) {
      blinkState.duration = uint32_t(randf(240.0f, 520.0f));
    } else if (mood == Mood::Delighted || mood == Mood::Confused || mood == Mood::Mischief) {
      blinkState.duration = uint32_t(randf(95.0f, 170.0f));
    } else {
      blinkState.duration = uint32_t(randf(120.0f, 190.0f));
    }
  }

  if (blinkState.active && now - blinkState.started > blinkState.duration + blinkState.leadMs) {
    blinkState.active = false;
    if (blinkState.requestedDouble) {
      blinkState.requestedDouble = false;
      blinkState.next = now + uint32_t(randf(85.0f, 150.0f));
      return;
    }
    blinkState.winkOnly = false;

    const Mood mood = currentMood(now);
    const int doubleChance = (mood == Mood::Goofy || mood == Mood::Delighted || mood == Mood::Confused) ? 36
                           : (mood == Mood::Bored || mood == Mood::Affection || mood == Mood::Bashful) ? 10
                           : 18;
    const bool doubleBlink = random(0, 100) < doubleChance;
    const uint32_t nextNormal = (mood == Mood::Sleepy)
      ? uint32_t(randf(700.0f, 1900.0f))
      : (mood == Mood::Robotic ? uint32_t(randf(2400.0f, 5200.0f))
                               : (mood == Mood::Bored || mood == Mood::Affection || mood == Mood::Bashful)
                                   ? uint32_t(randf(2600.0f, 7600.0f))
                                   : uint32_t(randf(1800.0f, 5600.0f)));
    blinkState.next = now + (doubleBlink ? uint32_t(randf(90.0f, 190.0f))
                                         : nextNormal);
  }
}

void triggerBlink(uint32_t now, uint32_t durationMs, bool doubleBlink) {
  const Mood mood = currentMood(now);
  blinkState.active = true;
  blinkState.requestedDouble = doubleBlink;
  blinkState.winkOnly = false;
  blinkState.leftLeads = random(0, 2) == 0;
  if (mood == Mood::Goofy) {
    blinkState.leadMs = uint16_t(randf(45.0f, 115.0f));
  } else if (mood == Mood::Glitchy) {
    blinkState.leadMs = uint16_t(randf(35.0f, 135.0f));
  } else if (mood == Mood::Sleepy) {
    blinkState.leadMs = uint16_t(randf(24.0f, 75.0f));
  } else if (mood == Mood::Robotic) {
    blinkState.leadMs = uint16_t(randf(4.0f, 14.0f));
  } else if (mood == Mood::Mischief || mood == Mood::Confused) {
    blinkState.leadMs = uint16_t(randf(42.0f, 118.0f));
  } else if (mood == Mood::Affection || mood == Mood::Bored || mood == Mood::Bashful) {
    blinkState.leadMs = uint16_t(randf(18.0f, 46.0f));
  } else {
    blinkState.leadMs = uint16_t(randf(10.0f, 34.0f));
  }
  blinkState.started = now;
  blinkState.duration = durationMs < 40 ? 40 : durationMs;
  blinkState.next = now + blinkState.duration + 100;
}

void triggerWink(uint32_t now, bool leftEye, uint32_t durationMs = 280) {
  blinkState.active = true;
  blinkState.requestedDouble = false;
  blinkState.winkOnly = true;
  blinkState.winkLeft = leftEye;
  blinkState.leftLeads = leftEye;
  blinkState.leadMs = 0;
  blinkState.started = now;
  blinkState.duration = durationMs < 80 ? 80 : durationMs;
  blinkState.next = now + blinkState.duration + uint32_t(randf(1600.0f, 3600.0f));
}

const char *idleBeatName(IdleBeat beat) {
  switch (beat) {
    case IdleBeat::Inspect: return "inspect";
    case IdleBeat::DoubleTake: return "double_take";
    case IdleBeat::Drowsy: return "drowsy";
    case IdleBeat::RobotScan: return "robot_scan";
    case IdleBeat::Wary: return "wary";
    case IdleBeat::Goofy: return "goofy";
    case IdleBeat::Startle: return "startle";
    case IdleBeat::Thoughtful: return "thoughtful";
    case IdleBeat::SlowSmile: return "slow_smile";
    case IdleBeat::Daydream: return "daydream";
    case IdleBeat::FocusLock: return "focus_lock";
    case IdleBeat::ConfusedLook: return "confused";
    case IdleBeat::Mischief: return "mischief";
    case IdleBeat::Affection: return "affection";
    case IdleBeat::None:
    default: return "none";
  }
}

bool parseIdleBeatName(const char *text, IdleBeat &beat) {
  if (equalsIgnoreCase(text, "inspect")) beat = IdleBeat::Inspect;
  else if (equalsIgnoreCase(text, "double_take") || equalsIgnoreCase(text, "doubletake")) beat = IdleBeat::DoubleTake;
  else if (equalsIgnoreCase(text, "drowsy")) beat = IdleBeat::Drowsy;
  else if (equalsIgnoreCase(text, "robot_scan") || equalsIgnoreCase(text, "scan")) beat = IdleBeat::RobotScan;
  else if (equalsIgnoreCase(text, "wary") || equalsIgnoreCase(text, "side_eye")) beat = IdleBeat::Wary;
  else if (equalsIgnoreCase(text, "goofy")) beat = IdleBeat::Goofy;
  else if (equalsIgnoreCase(text, "startle")) beat = IdleBeat::Startle;
  else if (equalsIgnoreCase(text, "thoughtful")) beat = IdleBeat::Thoughtful;
  else if (equalsIgnoreCase(text, "slow_smile") || equalsIgnoreCase(text, "smile") || equalsIgnoreCase(text, "happy")) beat = IdleBeat::SlowSmile;
  else if (equalsIgnoreCase(text, "daydream") || equalsIgnoreCase(text, "dream")) beat = IdleBeat::Daydream;
  else if (equalsIgnoreCase(text, "focus_lock") || equalsIgnoreCase(text, "focus")) beat = IdleBeat::FocusLock;
  else if (equalsIgnoreCase(text, "confused") || equalsIgnoreCase(text, "puzzled")) beat = IdleBeat::ConfusedLook;
  else if (equalsIgnoreCase(text, "mischief") || equalsIgnoreCase(text, "wink")) beat = IdleBeat::Mischief;
  else if (equalsIgnoreCase(text, "affection") || equalsIgnoreCase(text, "love") || equalsIgnoreCase(text, "fond")) beat = IdleBeat::Affection;
  else return false;
  return true;
}

void scheduleNextIdleBeat(uint32_t now, bool soon = false) {
  idleDirector.active = false;
  idleDirector.beat = IdleBeat::None;
  idleDirector.step = 0;
  idleDirector.nextStep = 0;
  idleDirector.nextBeat = now + (soon ? uint32_t(randf(1400.0f, 3800.0f))
                                      : uint32_t(randf(7200.0f, 19000.0f)));
}

IdleBeat chooseIdleBeat(uint32_t now) {
  const Mood mood = currentMood(now);
  const int r = random(0, 100);

  if (mood == Mood::Sleepy) {
    if (r < 38) return IdleBeat::Drowsy;
    if (r < 64) return IdleBeat::Daydream;
    if (r < 82) return IdleBeat::Thoughtful;
    return IdleBeat::SlowSmile;
  }

  if (mood == Mood::Robotic) {
    if (r < 44) return IdleBeat::RobotScan;
    if (r < 66) return IdleBeat::FocusLock;
    if (r < 82) return IdleBeat::Inspect;
    return IdleBeat::Startle;
  }

  if (r < 18) return IdleBeat::SlowSmile;
  if (r < 31) return IdleBeat::Affection;
  if (r < 43) return IdleBeat::Inspect;
  if (r < 54) return IdleBeat::Thoughtful;
  if (r < 64) return IdleBeat::Daydream;
  if (r < 73) return IdleBeat::Mischief;
  if (r < 81) return IdleBeat::ConfusedLook;
  if (r < 88) return IdleBeat::FocusLock;
  if (r < 94) return IdleBeat::DoubleTake;
  if (r < 98) return IdleBeat::Goofy;
  return IdleBeat::Startle;
}

void startIdleBeat(uint32_t now, IdleBeat beat) {
  idleDirector.active = true;
  idleDirector.beat = beat;
  idleDirector.step = 0;
  idleDirector.nextStep = now;
  idleDirector.side = random(0, 2) == 0 ? -1.0f : 1.0f;
  idleDirector.anchor = {
    idleDirector.side * randf(48.0f, 138.0f),
    randf(-42.0f, 70.0f),
    randf(280.0f, 680.0f)
  };
}

void finishIdleBeat(uint32_t now) {
  gazeState.next = now + uint32_t(randf(350.0f, 1200.0f));
  moodState.next = now + uint32_t(randf(700.0f, 2600.0f));
  scheduleNextIdleBeat(now, false);
}

void directorGaze(const Vec3 &target, uint32_t now, uint32_t holdMs, uint32_t moveMs) {
  beginGaze(target, now, holdMs, moveMs, false);
}

void updateIdleDirector(uint32_t now) {
  if (!apiState.idleEnabled || apiState.moodOverride || apiState.gazeOverride ||
      currentMood(now) == Mood::Sleep) {
    if (idleDirector.active) scheduleNextIdleBeat(now, true);
    return;
  }

  if (!idleDirector.active) {
    if (idleDirector.nextBeat == 0) scheduleNextIdleBeat(now, true);
    if (now >= idleDirector.nextBeat) startIdleBeat(now, chooseIdleBeat(now));
    else return;
  }

  if (now < idleDirector.nextStep) return;

  switch (idleDirector.beat) {
    case IdleBeat::Inspect:
      if (idleDirector.step == 0) {
        beginMood(Mood::Curious, now, 3300, false);
        directorGaze(idleDirector.anchor, now, 260, 170);
        idleDirector.nextStep = now + 330;
      } else if (idleDirector.step == 1) {
        directorGaze({idleDirector.anchor.x + idleDirector.side * randf(10.0f, 22.0f),
                      idleDirector.anchor.y + randf(-14.0f, 12.0f),
                      idleDirector.anchor.z + randf(-55.0f, 35.0f)}, now, 230, 95);
        idleDirector.nextStep = now + 300;
      } else if (idleDirector.step == 2) {
        directorGaze({idleDirector.anchor.x - idleDirector.side * randf(8.0f, 18.0f),
                      idleDirector.anchor.y + randf(8.0f, 22.0f),
                      idleDirector.anchor.z + randf(-35.0f, 75.0f)}, now, 390, 110);
        if (random(0, 100) < 42) triggerBlink(now, 135, false);
        idleDirector.nextStep = now + 470;
      } else if (idleDirector.step == 3) {
        beginMood(Mood::Wonder, now, 1200, false);
        directorGaze({idleDirector.side * randf(18.0f, 56.0f), randf(32.0f, 84.0f), randf(360.0f, 620.0f)}, now, 600, 230);
        idleDirector.nextStep = now + 820;
      } else {
        finishIdleBeat(now);
      }
      break;

    case IdleBeat::DoubleTake:
      if (idleDirector.step == 0) {
        beginMood(Mood::Calm, now, 800, false);
        directorGaze({-idleDirector.side * randf(86.0f, 128.0f), randf(-26.0f, 38.0f), randf(470.0f, 820.0f)}, now, 210, 130);
        idleDirector.nextStep = now + 290;
      } else if (idleDirector.step == 1) {
        beginMood(Mood::Surprised, now, 850, false);
        directorGaze({idleDirector.side * randf(94.0f, 150.0f), randf(-10.0f, 52.0f), randf(210.0f, 360.0f)}, now, 180, 70);
        idleDirector.nextStep = now + 260;
      } else if (idleDirector.step == 2) {
        triggerBlink(now, 95, true);
        directorGaze({idleDirector.side * randf(76.0f, 130.0f), randf(-20.0f, 44.0f), randf(260.0f, 480.0f)}, now, 440, 95);
        idleDirector.nextStep = now + 620;
      } else if (idleDirector.step == 3) {
        beginMood(Mood::Curious, now, 1250, false);
        directorGaze({idleDirector.side * randf(18.0f, 58.0f), randf(-16.0f, 42.0f), randf(480.0f, 780.0f)}, now, 580, 260);
        idleDirector.nextStep = now + 780;
      } else {
        finishIdleBeat(now);
      }
      break;

    case IdleBeat::Drowsy:
      if (idleDirector.step == 0) {
        beginMood(Mood::Sleepy, now, 3600, false);
        directorGaze({idleDirector.side * randf(12.0f, 42.0f), randf(-88.0f, -46.0f), randf(760.0f, 1250.0f)}, now, 950, 720);
        idleDirector.nextStep = now + 950;
      } else if (idleDirector.step == 1) {
        triggerBlink(now, uint32_t(randf(420.0f, 680.0f)), false);
        idleDirector.nextStep = now + uint32_t(randf(760.0f, 1100.0f));
      } else if (idleDirector.step == 2) {
        directorGaze({-idleDirector.side * randf(18.0f, 48.0f), randf(-76.0f, -30.0f), randf(840.0f, 1280.0f)}, now, 850, 620);
        idleDirector.nextStep = now + 900;
      } else if (idleDirector.step == 3) {
        beginMood(random(0, 100) < 65 ? Mood::Curious : Mood::Calm, now, 1700, false);
        directorGaze({randf(-38.0f, 38.0f), randf(8.0f, 58.0f), randf(380.0f, 660.0f)}, now, 520, 320);
        idleDirector.nextStep = now + 680;
      } else {
        finishIdleBeat(now);
      }
      break;

    case IdleBeat::RobotScan:
      if (idleDirector.step == 0) {
        beginMood(Mood::Robotic, now, 2600, false);
        triggerBlink(now, 70, false);
        directorGaze({-125.0f, -42.0f, 620.0f}, now, 120, 45);
        idleDirector.nextStep = now + 180;
      } else if (idleDirector.step == 1) {
        directorGaze({0.0f, -42.0f, 620.0f}, now, 120, 42);
        idleDirector.nextStep = now + 160;
      } else if (idleDirector.step == 2) {
        directorGaze({125.0f, -42.0f, 620.0f}, now, 150, 42);
        idleDirector.nextStep = now + 180;
      } else if (idleDirector.step == 3) {
        directorGaze({125.0f, 38.0f, 620.0f}, now, 120, 42);
        idleDirector.nextStep = now + 160;
      } else if (idleDirector.step == 4) {
        directorGaze({0.0f, 38.0f, 620.0f}, now, 120, 42);
        idleDirector.nextStep = now + 160;
      } else if (idleDirector.step == 5) {
        directorGaze({-125.0f, 38.0f, 620.0f}, now, 240, 42);
        idleDirector.nextStep = now + 310;
      } else if (idleDirector.step == 6) {
        beginMood(Mood::Calm, now, 1200, false);
        directorGaze({0.0f, 0.0f, 780.0f}, now, 520, 180);
        idleDirector.nextStep = now + 640;
      } else {
        finishIdleBeat(now);
      }
      break;

    case IdleBeat::Wary:
      if (idleDirector.step == 0) {
        beginMood(Mood::Suspicious, now, 3200, false);
        directorGaze({idleDirector.side * randf(92.0f, 142.0f), randf(-28.0f, 18.0f), randf(520.0f, 900.0f)}, now, 940, 360);
        idleDirector.nextStep = now + 1020;
      } else if (idleDirector.step == 1) {
        triggerBlink(now, 185, false);
        idleDirector.nextStep = now + 290;
      } else if (idleDirector.step == 2) {
        directorGaze({idleDirector.side * randf(42.0f, 82.0f), randf(-24.0f, 16.0f), randf(420.0f, 760.0f)}, now, 860, 230);
        idleDirector.nextStep = now + 980;
      } else if (idleDirector.step == 3) {
        beginMood(Mood::Calm, now, 1400, false);
        directorGaze({randf(-22.0f, 22.0f), randf(-12.0f, 34.0f), randf(640.0f, 1040.0f)}, now, 600, 310);
        idleDirector.nextStep = now + 720;
      } else {
        finishIdleBeat(now);
      }
      break;

    case IdleBeat::Goofy:
      if (idleDirector.step == 0) {
        beginMood(Mood::Goofy, now, 2300, false);
        directorGaze({0.0f, randf(18.0f, 70.0f), randf(155.0f, 230.0f)}, now, 420, 150);
        idleDirector.nextStep = now + 520;
      } else if (idleDirector.step == 1) {
        triggerBlink(now, 130, true);
        directorGaze({idleDirector.side * randf(128.0f, 160.0f), randf(-75.0f, 80.0f), randf(190.0f, 360.0f)}, now, 310, 95);
        idleDirector.nextStep = now + 470;
      } else if (idleDirector.step == 2) {
        directorGaze({-idleDirector.side * randf(98.0f, 148.0f), randf(-70.0f, 84.0f), randf(220.0f, 460.0f)}, now, 360, 110);
        idleDirector.nextStep = now + 500;
      } else if (idleDirector.step == 3) {
        beginMood(Mood::Curious, now, 1400, false);
        directorGaze({randf(-32.0f, 32.0f), randf(0.0f, 52.0f), randf(430.0f, 760.0f)}, now, 540, 250);
        idleDirector.nextStep = now + 680;
      } else {
        finishIdleBeat(now);
      }
      break;

    case IdleBeat::Startle:
      if (idleDirector.step == 0) {
        beginMood(Mood::Surprised, now, 900, false);
        directorGaze({randf(-18.0f, 18.0f), randf(6.0f, 42.0f), randf(185.0f, 285.0f)}, now, 360, 62);
        idleDirector.nextStep = now + 430;
      } else if (idleDirector.step == 1) {
        beginMood(Mood::Afraid, now, 900, false);
        directorGaze({idleDirector.side * randf(28.0f, 70.0f), randf(16.0f, 58.0f), randf(220.0f, 360.0f)}, now, 420, 120);
        idleDirector.nextStep = now + 520;
      } else if (idleDirector.step == 2) {
        triggerBlink(now, 120, true);
        beginMood(Mood::Suspicious, now, 1100, false);
        directorGaze({idleDirector.side * randf(60.0f, 112.0f), randf(-16.0f, 18.0f), randf(480.0f, 820.0f)}, now, 520, 210);
        idleDirector.nextStep = now + 700;
      } else {
        finishIdleBeat(now);
      }
      break;

    case IdleBeat::Thoughtful:
      if (idleDirector.step == 0) {
        beginMood(Mood::Wonder, now, 3600, false);
        directorGaze({idleDirector.side * randf(18.0f, 58.0f), randf(52.0f, 94.0f), randf(520.0f, 880.0f)}, now, 1250, 420);
        idleDirector.nextStep = now + 1180;
      } else if (idleDirector.step == 1) {
        directorGaze({idleDirector.side * randf(8.0f, 36.0f), randf(28.0f, 76.0f), randf(720.0f, 1200.0f)}, now, 1100, 650);
        idleDirector.nextStep = now + 1120;
      } else if (idleDirector.step == 2) {
        if (random(0, 100) < 58) triggerBlink(now, uint32_t(randf(180.0f, 270.0f)), false);
        beginMood(random(0, 100) < 50 ? Mood::Curious : Mood::Calm, now, 1500, false);
        directorGaze({randf(-34.0f, 34.0f), randf(-8.0f, 42.0f), randf(520.0f, 880.0f)}, now, 620, 360);
        idleDirector.nextStep = now + 760;
      } else {
        finishIdleBeat(now);
      }
      break;

    case IdleBeat::SlowSmile:
      if (idleDirector.step == 0) {
        beginMood(Mood::Happy, now, 7200, false);
        directorGaze({idleDirector.side * randf(8.0f, 34.0f), randf(4.0f, 48.0f), randf(460.0f, 820.0f)}, now, 1900, 680);
        idleDirector.nextStep = now + 1900;
      } else if (idleDirector.step == 1) {
        triggerBlink(now, uint32_t(randf(220.0f, 330.0f)), false);
        directorGaze({-idleDirector.side * randf(6.0f, 28.0f), randf(0.0f, 42.0f), randf(520.0f, 900.0f)}, now, 2100, 720);
        idleDirector.nextStep = now + 2200;
      } else if (idleDirector.step == 2) {
        beginMood(random(0, 100) < 50 ? Mood::Delighted : Mood::Affection, now, 3600, false);
        directorGaze({randf(-18.0f, 18.0f), randf(16.0f, 58.0f), randf(300.0f, 560.0f)}, now, 1500, 420);
        idleDirector.nextStep = now + 1700;
      } else {
        finishIdleBeat(now);
      }
      break;

    case IdleBeat::Daydream:
      if (idleDirector.step == 0) {
        beginMood(random(0, 100) < 58 ? Mood::Bashful : Mood::Bored, now, 7600, false);
        directorGaze({idleDirector.side * randf(42.0f, 88.0f), randf(-82.0f, -34.0f), randf(760.0f, 1320.0f)}, now, 2600, 920);
        idleDirector.nextStep = now + 2700;
      } else if (idleDirector.step == 1) {
        triggerBlink(now, uint32_t(randf(430.0f, 690.0f)), false);
        directorGaze({idleDirector.side * randf(12.0f, 44.0f), randf(-64.0f, -18.0f), randf(860.0f, 1400.0f)}, now, 2400, 980);
        idleDirector.nextStep = now + 2500;
      } else if (idleDirector.step == 2) {
        beginMood(Mood::Curious, now, 2100, false);
        directorGaze({randf(-30.0f, 30.0f), randf(4.0f, 48.0f), randf(430.0f, 760.0f)}, now, 1000, 440);
        idleDirector.nextStep = now + 1200;
      } else {
        finishIdleBeat(now);
      }
      break;

    case IdleBeat::FocusLock:
      if (idleDirector.step == 0) {
        beginMood(Mood::Focused, now, 6200, false);
        directorGaze({randf(-12.0f, 12.0f), randf(-8.0f, 18.0f), randf(230.0f, 420.0f)}, now, 2200, 260);
        idleDirector.nextStep = now + 2300;
      } else if (idleDirector.step == 1) {
        directorGaze({randf(-8.0f, 8.0f), randf(-6.0f, 16.0f), randf(230.0f, 390.0f)}, now, 1800, 160);
        idleDirector.nextStep = now + 1900;
      } else if (idleDirector.step == 2) {
        triggerBlink(now, 105, false);
        beginMood(Mood::Proud, now, 2600, false);
        directorGaze({randf(-26.0f, 26.0f), randf(34.0f, 78.0f), randf(520.0f, 860.0f)}, now, 1200, 360);
        idleDirector.nextStep = now + 1400;
      } else {
        finishIdleBeat(now);
      }
      break;

    case IdleBeat::ConfusedLook:
      if (idleDirector.step == 0) {
        beginMood(Mood::Confused, now, 3400, false);
        directorGaze({-idleDirector.side * randf(68.0f, 116.0f), randf(-12.0f, 46.0f), randf(300.0f, 620.0f)}, now, 420, 160);
        idleDirector.nextStep = now + 540;
      } else if (idleDirector.step == 1) {
        directorGaze({idleDirector.side * randf(72.0f, 124.0f), randf(-18.0f, 42.0f), randf(260.0f, 560.0f)}, now, 560, 150);
        idleDirector.nextStep = now + 690;
      } else if (idleDirector.step == 2) {
        triggerBlink(now, 120, true);
        directorGaze({randf(-22.0f, 22.0f), randf(20.0f, 58.0f), randf(420.0f, 760.0f)}, now, 1250, 360);
        idleDirector.nextStep = now + 1450;
      } else {
        finishIdleBeat(now);
      }
      break;

    case IdleBeat::Mischief:
      if (idleDirector.step == 0) {
        beginMood(Mood::Mischief, now, 5200, false);
        directorGaze({idleDirector.side * randf(86.0f, 136.0f), randf(-20.0f, 24.0f), randf(360.0f, 680.0f)}, now, 1300, 360);
        idleDirector.nextStep = now + 1350;
      } else if (idleDirector.step == 1) {
        triggerWink(now, idleDirector.side < 0.0f, uint32_t(randf(260.0f, 380.0f)));
        directorGaze({idleDirector.side * randf(56.0f, 108.0f), randf(-12.0f, 32.0f), randf(320.0f, 600.0f)}, now, 1200, 240);
        idleDirector.nextStep = now + 1450;
      } else if (idleDirector.step == 2) {
        beginMood(Mood::Happy, now, 2600, false);
        directorGaze({randf(-18.0f, 18.0f), randf(6.0f, 44.0f), randf(520.0f, 880.0f)}, now, 1200, 420);
        idleDirector.nextStep = now + 1400;
      } else {
        finishIdleBeat(now);
      }
      break;

    case IdleBeat::Affection:
      if (idleDirector.step == 0) {
        beginMood(Mood::Affection, now, 8600, false);
        directorGaze({randf(-14.0f, 14.0f), randf(10.0f, 46.0f), randf(270.0f, 480.0f)}, now, 2600, 760);
        idleDirector.nextStep = now + 2700;
      } else if (idleDirector.step == 1) {
        triggerBlink(now, uint32_t(randf(420.0f, 620.0f)), false);
        directorGaze({idleDirector.side * randf(8.0f, 30.0f), randf(8.0f, 50.0f), randf(300.0f, 560.0f)}, now, 2300, 680);
        idleDirector.nextStep = now + 2400;
      } else if (idleDirector.step == 2) {
        beginMood(Mood::Bashful, now, 2600, false);
        directorGaze({-idleDirector.side * randf(22.0f, 62.0f), randf(-58.0f, -18.0f), randf(520.0f, 860.0f)}, now, 1200, 520);
        idleDirector.nextStep = now + 1400;
      } else {
        finishIdleBeat(now);
      }
      break;

    case IdleBeat::None:
    default:
      finishIdleBeat(now);
      break;
  }

  ++idleDirector.step;
}

uint16_t blinkDelayForEye(bool leftEye) {
  return leftEye == blinkState.leftLeads ? 0 : blinkState.leadMs;
}

float blinkClosedForEye(uint32_t now, bool leftEye) {
  if (!blinkState.active) return 0.0f;
  if (blinkState.winkOnly && leftEye != blinkState.winkLeft) return 0.0f;
  const uint32_t elapsed = now - blinkState.started;
  const uint16_t delayMs = blinkState.winkOnly ? 0 : blinkDelayForEye(leftEye);
  if (elapsed < delayMs || elapsed > blinkState.duration + delayMs) return 0.0f;

  const float t = clampf(float(elapsed - delayMs) / float(blinkState.duration), 0.0f, 1.0f);
  if (t < 0.36f) return smoothstep(t / 0.36f);
  if (t < 0.52f) return 1.0f;
  return 1.0f - smoothstep((t - 0.52f) / 0.48f);
}

void updatePupil(float dt, uint32_t now) {
  const LidPose left = blendedPose(true, now);
  const LidPose right = blendedPose(false, now);
  const float targetPosePupil = (left.pupilRadius + right.pupilRadius) * 0.5f;
  const float nearBoost = clampf((420.0f - gazeState.now.z) / 250.0f, 0.0f, 1.0f) * 0.35f;
  const float target = clampf(targetPosePupil + nearBoost, 0.0f, PUPIL_MAX_RADIUS);
  const float alpha = clampf(dt * 0.006f, 0.0f, 1.0f);
  pupilRadius += (target - pupilRadius) * alpha;
}

Vec2 projectTargetForEye(const Vec3 &target, bool leftEye) {
  const float eyeX = leftEye ? -EYE_BASELINE_MM * 0.5f : EYE_BASELINE_MM * 0.5f;
  const float dx = target.x - eyeX;
  const float dy = target.y;
  const float dz = max(target.z, 40.0f);
  const float yaw = atan2f(dx, dz);
  const float pitch = atan2f(dy, sqrtf(dx * dx + dz * dz));
  return {
    clampf(yaw / MAX_YAW, -1.0f, 1.0f) * MAX_GAZE_X_PX + gazeState.microX,
    clampf(-pitch / MAX_PITCH, -1.0f, 1.0f) * MAX_GAZE_Y_PX + gazeState.microY
  };
}

void fillEllipse(Adafruit_GFX &g, int16_t cx, int16_t cy, int16_t rx, int16_t ry, uint16_t color) {
  for (int16_t y = -ry; y <= ry; ++y) {
    const float yn = float(y) / float(ry);
    const int16_t half = int16_t(float(rx) * sqrtf(max(0.0f, 1.0f - yn * yn)));
    g.drawFastHLine(cx - half, cy + y, half * 2 + 1, color);
  }
}

void drawLidSurface(Adafruit_GFX &g) {
  g.fillScreen(BLACK);
}

void drawEllipseOutline(Adafruit_GFX &g, int16_t cx, int16_t cy, int16_t rx, int16_t ry, uint16_t color) {
  int16_t lastX = cx + rx;
  int16_t lastY = cy;
  for (int i = 1; i <= 96; ++i) {
    const float a = 2.0f * PI_F * float(i) / 96.0f;
    const int16_t x = cx + int16_t(cosf(a) * rx);
    const int16_t y = cy + int16_t(sinf(a) * ry);
    g.drawLine(lastX, lastY, x, y, color);
    lastX = x;
    lastY = y;
  }
}

void drawSoftGlint(Adafruit_GFX &g, int16_t cx, int16_t cy, int16_t rx, int16_t ry, uint16_t core, uint16_t edge) {
  for (int16_t y = -ry; y <= ry; ++y) {
    const float yn = float(y) / float(ry);
    const float span = sqrtf(max(0.0f, 1.0f - yn * yn));
    const int16_t half = int16_t(float(rx) * span);
    const int16_t slant = int16_t(float(y) * -0.22f);
    const float edgeMix = fabsf(yn) * 0.55f + (1.0f - span) * 0.35f;
    const uint16_t c = mixColor(core, edge, clampf(edgeMix, 0.0f, 1.0f));
    g.drawFastHLine(cx + slant - half, cy + y, half * 2 + 1, c);
  }
}

uint16_t irisColor(float t, uint16_t inner, uint16_t pale, uint16_t clear, uint16_t deep, uint16_t limbal) {
  if (t < 0.18f) return mixColor(inner, pale, t / 0.18f);
  if (t < 0.52f) return mixColor(pale, clear, (t - 0.18f) / 0.34f);
  if (t < 0.82f) return mixColor(clear, deep, (t - 0.52f) / 0.30f);
  return mixColor(deep, limbal, (t - 0.82f) / 0.18f);
}

float hash01(uint16_t v) {
  uint32_t x = uint32_t(v) * 747796405UL + 2891336453UL;
  x = ((x >> ((x >> 28) + 4)) ^ x) * 277803737UL;
  x = (x >> 22) ^ x;
  return float(x & 0xFFFF) / 65535.0f;
}

void drawSclera(Adafruit_GFX &g) {
  const uint16_t outer = BLACK;
  const uint16_t shadow = BLACK;
  const uint16_t sclera = rgb(240, 238, 228);

  fillEllipse(g, CX, CY, 181, 82, outer);
  fillEllipse(g, CX, CY, 174, 77, shadow);
  fillEllipse(g, CX, CY + 1, 168, 73, sclera);
  drawEllipseOutline(g, CX, CY, 174, 77, BLACK);
}

struct EyePalette {
  int16_t irisR;
  float pupilScale;
  uint16_t inner;
  uint16_t pale;
  uint16_t clear;
  uint16_t deep;
  uint16_t limbal;
  uint16_t accent;
  uint16_t pupil;
  bool robot;
  bool bloodshot;
  bool verticalPupil;
  bool widePupil;
};

EyePalette paletteFor(EyeRenderStyle style) {
  switch (style) {
    case EyeRenderStyle::Classic:
      return {50, 1.32f, rgb(70, 82, 120), rgb(100, 150, 200), rgb(50, 104, 170),
              rgb(28, 58, 110), rgb(4, 18, 44), rgb(184, 212, 222), rgb(8, 9, 18),
              false, false, false, false};
    case EyeRenderStyle::Cartoony:
      return {64, 2.05f, rgb(68, 196, 240), rgb(114, 224, 255), rgb(42, 162, 245),
              rgb(18, 78, 180), rgb(3, 20, 64), rgb(230, 248, 255), rgb(3, 4, 12),
              false, false, false, false};
    case EyeRenderStyle::Robot:
      return {0, 3.95f, rgb(18, 45, 50), rgb(40, 92, 98), rgb(25, 120, 130),
              rgb(8, 58, 66), rgb(0, 12, 16), rgb(124, 232, 224), rgb(18, 12, 12),
              true, false, false, true};
    case EyeRenderStyle::Sinister:
      return {48, 1.05f, rgb(120, 30, 36), rgb(180, 64, 62), rgb(118, 28, 42),
              rgb(62, 12, 22), rgb(22, 0, 6), rgb(230, 112, 92), BLACK,
              false, true, true, false};
    case EyeRenderStyle::Sleepy:
      return {49, 1.18f, rgb(72, 84, 106), rgb(128, 152, 180), rgb(82, 118, 158),
              rgb(42, 62, 98), rgb(8, 18, 36), rgb(202, 224, 230), rgb(14, 16, 24),
              false, false, false, true};
    case EyeRenderStyle::Friendly:
    default:
      return {44, 1.0f, rgb(111, 93, 55), rgb(116, 170, 188), rgb(58, 128, 165),
              rgb(20, 66, 105), rgb(4, 22, 44), rgb(169, 124, 65), rgb(1, 1, 2),
              false, false, false, false};
  }
}

void drawBloodshot(Adafruit_GFX &g, int16_t ix, int16_t iy, int16_t irisR, bool leftEye) {
  for (uint8_t i = 0; i < 8; ++i) {
    const bool fromRight = (i % 2 == 0) == leftEye;
    const int16_t y = 32 + int16_t(i) * 22;
    const int16_t x0 = fromRight ? SCREEN_W - 1 : 0;
    const int16_t x1 = ix + int16_t((fromRight ? 1 : -1) * (irisR + 18 + hash01(500 + i) * 22.0f));
    const int16_t y1 = iy + int16_t(-38.0f + hash01(540 + i * 11) * 76.0f);
    g.drawLine(x0, y, x1, y1, RED_VEIN);
  }
}

void drawIris(Adafruit_GFX &g, int16_t ix, int16_t iy, float pupil, bool leftEye) {
  const EyePalette palette = paletteFor(eyeRenderStyle);
  const float styledPupil = max(5.0f, pupil * palette.pupilScale);
  const int16_t irisR = palette.irisR;

  if (palette.robot) {
    const int16_t dotR = int16_t(clampf(styledPupil, 42.0f, 78.0f));
    fillEllipse(g, ix, iy, dotR, int16_t(float(dotR) * 0.78f), palette.pupil);
    drawEllipseOutline(g, ix, iy, dotR + 2, int16_t(float(dotR) * 0.78f) + 2, palette.accent);
    drawSoftGlint(g, ix - dotR / 4, iy - dotR / 3, 9, 6, rgb(220, 250, 245), palette.accent);
    return;
  }

  if (palette.bloodshot) drawBloodshot(g, ix, iy, irisR, leftEye);

  g.fillCircle(ix, iy, irisR + 3, palette.limbal);
  for (int16_t r = irisR; r >= 1; --r) {
    const float t = float(irisR - r) / float(irisR);
    g.fillCircle(ix, iy, r, irisColor(t, palette.inner, palette.pale, palette.clear, palette.deep, palette.limbal));
  }

  const int seed = leftEye ? 100 : 230;
  const uint8_t spokeCount = eyeRenderStyle == EyeRenderStyle::Cartoony ? 20 : 64;
  for (uint8_t i = 0; i < spokeCount; ++i) {
    const float angle = (2.0f * PI_F * float(i) / 64.0f) + hash01(seed + i) * 0.07f;
    const float ca = cosf(angle);
    const float sa = sinf(angle);
    const float inner = styledPupil + 1.0f + hash01(seed + i * 7) * 3.5f;
    const float outer = irisR * 0.56f + hash01(seed + i * 13) * (irisR * 0.38f);
    const int16_t x0 = ix + int16_t(ca * inner);
    const int16_t y0 = iy + int16_t(sa * inner);
    const int16_t x1 = ix + int16_t(ca * outer);
    const int16_t y1 = iy + int16_t(sa * outer);
    const uint16_t c = (i % 7 == 0)
                         ? mixColor(palette.accent, irisColor(0.18f, palette.inner, palette.pale, palette.clear, palette.deep, palette.limbal), 0.46f)
                         : mixColor(palette.limbal, palette.pale, 0.42f + hash01(seed + i * 5) * 0.22f);
    g.drawLine(x0, y0, x1, y1, c);
  }

  for (uint8_t i = 0; i < 18; ++i) {
    const float angle = 2.0f * PI_F * hash01(seed + 500 + i * 17);
    const float ca = cosf(angle);
    const float sa = sinf(angle);
    const float inner = styledPupil + 1.0f;
    const float outer = styledPupil + 6.0f + hash01(seed + 600 + i) * 6.0f;
    g.drawLine(ix + int16_t(ca * inner), iy + int16_t(sa * inner),
               ix + int16_t(ca * outer), iy + int16_t(sa * outer),
               mixColor(palette.accent, palette.deep, 0.52f));
  }

  g.drawCircle(ix, iy, irisR + 1, palette.limbal);
  g.drawCircle(ix, iy, irisR + 2, rgb(0, 9, 25));

  if (DUAL_SIDE_PUPILS) {
    const int16_t holeR = int16_t(clampf(styledPupil * 0.52f, 10.0f, 13.0f));
    const int16_t sep = int16_t(clampf(styledPupil * 0.58f, 12.0f, 15.0f));
    const int16_t ly = iy + 1;
    const int16_t ry = iy - 1;
    g.fillCircle(ix - sep, ly, holeR + 3, rgb(4, 14, 25));
    g.fillCircle(ix + sep, ry, holeR + 3, rgb(4, 14, 25));
    g.fillCircle(ix - sep, ly, holeR, palette.pupil);
    g.fillCircle(ix + sep, ry, holeR, palette.pupil);

    drawSoftGlint(g, ix - sep - 5, ly - 9, 5, 3, rgb(245, 250, 246), rgb(151, 198, 205));
    drawSoftGlint(g, ix + sep - 4, ry - 8, 4, 2, rgb(226, 240, 236), rgb(126, 176, 184));
    g.drawPixel(ix - sep - 10, ly - 6, rgb(226, 241, 236));
    g.drawPixel(ix + sep + 1, ry - 12, rgb(197, 225, 225));
  } else if (palette.verticalPupil) {
    fillEllipse(g, ix, iy, int16_t(styledPupil * 0.44f), int16_t(styledPupil * 1.42f), palette.pupil);
    drawSoftGlint(g, ix - 10, iy - 22, 4, 6, rgb(246, 228, 218), rgb(210, 96, 88));
  } else if (palette.widePupil) {
    fillEllipse(g, ix, iy, int16_t(styledPupil * 1.22f), int16_t(styledPupil * 0.58f), palette.pupil);
    drawSoftGlint(g, ix - 14, iy - 14, 6, 3, rgb(236, 246, 244), palette.accent);
  } else {
    g.fillCircle(ix, iy, int16_t(styledPupil) + 3, rgb(4, 14, 25));
    g.fillCircle(ix, iy, int16_t(styledPupil), palette.pupil);

    drawSoftGlint(g, ix - 13, iy - 18, 6, 4, rgb(245, 250, 246), rgb(151, 198, 205));
    drawSoftGlint(g, ix - 8, iy - 13, 3, 2, rgb(214, 228, 213), rgb(126, 176, 184));
    g.drawPixel(ix - 17, iy - 15, rgb(226, 241, 236));
    g.drawPixel(ix - 5, iy - 20, rgb(197, 225, 225));
    drawSoftGlint(g, ix + 12, iy - 8, 3, 2, rgb(218, 235, 229), rgb(112, 168, 177));
  }
}

void drawSparkle(Adafruit_GFX &g, int16_t x, int16_t y, uint8_t r, uint16_t color) {
  g.drawFastHLine(x - r, y, r * 2 + 1, color);
  g.drawFastVLine(x, y - r, r * 2 + 1, color);
  g.drawPixel(x - r - 1, y - r - 1, color);
  g.drawPixel(x + r + 1, y - r - 1, color);
  g.drawPixel(x - r - 1, y + r + 1, color);
  g.drawPixel(x + r + 1, y + r + 1, color);
}

float apertureN(int16_t x) {
  return (float(x) - float(CX)) / APERTURE_HALF_W;
}

bool apertureColumnOpen(int16_t x) {
  return fabsf(apertureN(x)) <= 1.0f;
}

float topLidYAt(const LidPose &pose, int16_t x) {
  const float n = clampf(apertureN(x), -1.0f, 1.0f);
  const float h = sqrtf(max(0.0f, 1.0f - n * n));
  const float curve = powf(h, 0.62f + pose.topCurve * 0.0035f);
  return float(CY) - (float(CY) - pose.topY) * curve + pose.topSlant * n * h;
}

float bottomLidYAt(const LidPose &pose, int16_t x) {
  const float n = clampf(apertureN(x), -1.0f, 1.0f);
  const float h = sqrtf(max(0.0f, 1.0f - n * n));
  const float curve = powf(h, 0.70f + pose.bottomCurve * 0.003f);
  return float(CY) + (pose.bottomY - float(CY)) * curve + pose.bottomSlant * n * h;
}

void drawLidBoundary(Adafruit_GFX &g, const LidPose &pose, bool top, uint16_t rim, uint16_t shadow) {
  const int16_t xMin = int16_t(CX - APERTURE_HALF_W);
  const int16_t xMax = int16_t(CX + APERTURE_HALF_W);
  int16_t lastX = xMin;
  int16_t lastY = int16_t(top ? topLidYAt(pose, xMin) : bottomLidYAt(pose, xMin));
  for (int16_t x = xMin + 1; x <= xMax; ++x) {
    const int16_t y = int16_t(top ? topLidYAt(pose, x) : bottomLidYAt(pose, x));
    g.drawLine(lastX, lastY, x, y, shadow);
    g.drawLine(lastX, lastY + (top ? 1 : -1), x, y + (top ? 1 : -1), rim);
    lastX = x;
    lastY = y;
  }
}

void drawLids(Adafruit_GFX &g, LidPose pose, float closed) {
  const uint16_t lid = LID_BASE;
  const uint16_t lidLower = LID_BASE;
  const uint16_t lidSoft = LID_LIGHT;

  pose.topY = pose.topY + (CY - 2.0f - pose.topY) * closed;
  pose.bottomY = pose.bottomY + (CY + 2.0f - pose.bottomY) * closed;
  pose.topCurve = pose.topCurve + (8.0f - pose.topCurve) * closed;
  pose.bottomCurve = pose.bottomCurve + (8.0f - pose.bottomCurve) * closed;

  for (int16_t x = 0; x < SCREEN_W; ++x) {
    const int16_t ty = int16_t(topLidYAt(pose, x));
    const int16_t by = int16_t(bottomLidYAt(pose, x));
    if (ty > 0) g.drawFastVLine(x, 0, mini16(ty, SCREEN_H), lid);
    if (by < SCREEN_H) g.drawFastVLine(x, maxi16(by, 0), SCREEN_H - maxi16(by, 0), lidLower);
    if (closed > 0.82f && ty >= by - 2) {
      g.drawFastVLine(x, maxi16(by - 1, 0), mini16(4, SCREEN_H - by + 1), lidSoft);
    }
  }

  drawLidBoundary(g, pose, true, LID_RIM, LID_SHADOW);
  drawLidBoundary(g, pose, false, LID_RIM, LID_SHADOW);
}

void renderEye(bool leftEye, uint32_t now) {
  drawLidSurface(frame);

  const Mood mood = currentMood(now);
  if (mood == Mood::Sleep) return;

  Vec2 gaze = projectTargetForEye(gazeState.now, leftEye);
  if (mood == Mood::Afraid) {
    gaze.x += sinf(float(now) * 0.032f + (leftEye ? 0.0f : 1.4f)) * 1.4f;
    gaze.y += sinf(float(now) * 0.027f + 2.1f) * 0.8f;
  } else if (mood == Mood::Goofy) {
    gaze.x += leftEye ? 5.5f : -5.5f;
    gaze.y += leftEye ? -4.5f : 4.5f;
    gaze.x += sinf(float(now) * 0.010f) * 2.5f;
  } else if (mood == Mood::Robotic) {
    gaze.x = roundf(gaze.x / 8.0f) * 8.0f;
    gaze.y = roundf(gaze.y / 6.0f) * 6.0f;
  } else if (mood == Mood::Sleepy) {
    gaze.y += 7.0f;
  } else if (mood == Mood::Glitchy) {
    const int32_t tick = int32_t(now / 75 + (leftEye ? 0 : 3));
    gaze.x += float((tick % 5) - 2) * 1.8f;
    gaze.y += float(((tick / 2) % 3) - 1) * 1.6f;
  } else if (mood == Mood::Happy) {
    gaze.y -= 2.0f;
  } else if (mood == Mood::Delighted) {
    gaze.x += sinf(float(now) * 0.016f + (leftEye ? 0.0f : 1.1f)) * 1.8f;
    gaze.y += sinf(float(now) * 0.018f + 0.6f) * 1.2f;
  } else if (mood == Mood::Bashful) {
    gaze.x += leftEye ? 2.5f : -2.5f;
    gaze.y += 10.0f;
  } else if (mood == Mood::Bored) {
    gaze.y += 9.0f;
  } else if (mood == Mood::Focused) {
    gaze.x *= 0.45f;
    gaze.y *= 0.55f;
  } else if (mood == Mood::Confused) {
    gaze.x += leftEye ? -3.0f : 3.0f;
    gaze.y += leftEye ? -1.5f : 2.5f;
  } else if (mood == Mood::Proud) {
    gaze.y -= 8.0f;
  } else if (mood == Mood::Mischief) {
    gaze.x += leftEye ? 4.0f : -4.0f;
    gaze.y += sinf(float(now) * 0.006f) * 1.0f;
  } else if (mood == Mood::Affection) {
    gaze.y -= 1.5f;
  }

  const int16_t ix = CX + int16_t(gaze.x);
  const int16_t iy = CY + int16_t(gaze.y);
  drawSclera(frame);
  drawIris(frame, ix, iy, pupilRadius, leftEye);
  if (mood == Mood::Delighted) {
    const uint16_t c = rgb(246, 248, 221);
    drawSparkle(frame, leftEye ? 186 : 52, 68, 4, c);
    drawSparkle(frame, leftEye ? 58 : 182, 158, 2, mixColor(c, rgb(110, 196, 210), 0.35f));
  } else if (mood == Mood::Affection) {
    drawSparkle(frame, leftEye ? 178 : 62, 76, 3, rgb(232, 244, 229));
  }
  drawLids(frame, blendedPose(leftEye, now), blinkClosedForEye(now, leftEye));
}

void updateMouth(uint32_t now) {
  if (mouthState.overrideShape && mouthState.overrideUntil != 0 && deadlineReached(now, mouthState.overrideUntil)) {
    mouthState.overrideShape = false;
    mouthState.talking = false;
  }
  if (mouthState.talkUpdated == 0) mouthState.talkUpdated = now;
  const uint32_t elapsed = now - mouthState.talkUpdated;
  mouthState.talkUpdated = now;
  const float target = mouthState.talking ? 1.0f : 0.0f;
  const uint32_t rateMs = target > mouthState.talkLevel ? MOUTH_TALK_ATTACK_MS : MOUTH_TALK_RELEASE_MS;
  const float step = rateMs == 0 ? 1.0f : clampf(float(elapsed) / float(rateMs), 0.0f, 1.0f);
  mouthState.talkLevel += (target - mouthState.talkLevel) * step;
}

MouthShape activeMouthShape(uint32_t now) {
  if (mouthState.overrideShape) return mouthState.shape;
  return mouthShapeForMood(currentMood(now));
}

MouthPose easedMouthPose(MouthShape shape, uint32_t now) {
  const MouthPose target = mouthPoseFor(shape);
  if (!mouthState.poseInitialized) {
    mouthState.renderedShape = shape;
    mouthState.poseFrom = target;
    mouthState.poseTo = target;
    mouthState.poseNow = target;
    mouthState.poseStarted = now;
    mouthState.poseInitialized = true;
    return target;
  }
  if (shape != mouthState.renderedShape) {
    mouthState.renderedShape = shape;
    mouthState.poseFrom = mouthState.poseNow;
    mouthState.poseTo = target;
    mouthState.poseStarted = now;
  }
  const float t = smoothstep(float(now - mouthState.poseStarted) / float(MOUTH_TRANSITION_MS));
  mouthState.poseNow = mixMouthPose(mouthState.poseFrom, mouthState.poseTo, t);
  return mouthState.poseNow;
}

void drawMouthTeeth(int16_t x, int16_t y, int16_t w, int16_t h, float amount) {
  if (amount <= 0.01f || h < 12 || w < 36) return;
  const int16_t teethH = int16_t(clampf(float(h) * (0.24f + amount * 0.18f), 5.0f, 22.0f));
  const uint16_t enamel = rgb(238, 228, 198);
  const uint16_t seam = rgb(126, 104, 98);
  frame.fillRoundRect(x, y, w, teethH, 5, enamel);
  frame.drawFastHLine(x + 4, y + teethH - 1, w - 8, seam);
  for (int16_t tx = x + 28; tx < x + w - 14; tx += 36) {
    frame.drawFastVLine(tx, y + 2, teethH - 4, seam);
  }
}

void drawMouthTongue(int16_t cx, int16_t y, int16_t rx, int16_t ry) {
  if (rx < 14 || ry < 4) return;
  const uint16_t tongue = rgb(162, 54, 72);
  const uint16_t tongueHi = rgb(218, 94, 106);
  fillEllipse(frame, cx, y, rx, ry, tongue);
  fillEllipse(frame, cx - rx / 5, y - ry / 4, maxi16(4, rx / 3), maxi16(2, ry / 4), tongueHi);
}

void renderHumanMouth(MouthShape shape, MouthPose pose, uint32_t now) {
  if (mouthState.talkLevel > 0.01f) {
    const float pulse = clampf(0.58f + 0.32f * sinf(float(now) * 0.037f) +
                                0.18f * sinf(float(now) * 0.071f + 1.7f), 0.0f, 1.0f);
    pose.open = max(pose.open, 0.18f + mouthState.energy * 0.70f * pulse * mouthState.talkLevel);
    pose.width = max(pose.width, 0.56f + mouthState.energy * 0.20f * mouthState.talkLevel);
  }

  frame.fillScreen(BLACK);

  if (shape == MouthShape::Sleep && mouthState.talkLevel <= 0.01f &&
      uint32_t(now - mouthState.poseStarted) >= MOUTH_TRANSITION_MS) {
    const int16_t sleepX = 18;
    const int16_t sleepY = 119;
    frame.fillRoundRect(sleepX, sleepY, 198, 15, 7, rgb(118, 28, 44));
    frame.drawFastHLine(sleepX + 22, sleepY + 3, 142, rgb(218, 92, 102));
    frame.drawFastHLine(sleepX + 30, sleepY + 12, 126, rgb(58, 8, 22));
    return;
  }

  const int16_t w = int16_t(134.0f + pose.width * 226.0f);
  const int16_t openH = int16_t(7.0f + pose.open * 92.0f);
  const int16_t lipH = int16_t(clampf(30.0f + pose.open * 28.0f + pose.tension * 7.0f, 28.0f, 62.0f));
  const int16_t driftX = mouthState.talkLevel > 0.01f
    ? int16_t(5.0f * sinf(float(now) * 0.0031f) + 2.0f * sinf(float(now) * 0.0071f + 1.4f))
    : 0;
  const int16_t driftY = mouthState.talkLevel > 0.01f
    ? int16_t(2.0f * sinf(float(now) * 0.0027f + 0.6f))
    : 0;
  const bool isSmirk = shape == MouthShape::SmirkLeft || shape == MouthShape::SmirkRight;
  const int16_t cx = 120 + int16_t(pose.skew * (isSmirk ? 48.0f : 26.0f)) + driftX;
  const int16_t cy = 126 + int16_t(pose.tension * 4.0f) + driftY;
  const int16_t curve = int16_t(pose.curve * 18.0f);
  const int16_t asym = (mouthState.talkLevel > 0.01f
                          ? int16_t(5.0f * mouthState.talkLevel *
                                    sinf(float(now) * 0.0041f + pose.width * 3.1f))
                          : 0) +
                       int16_t(pose.skew * (isSmirk ? 22.0f : 12.0f));
  const int16_t cavityW = int16_t(float(w) * (0.86f - pose.tension * 0.05f));
  const int16_t cavityH = maxi16(5, openH);
  const int16_t topCy = cy - cavityH / 2 - lipH / 3 - curve / 3;
  const int16_t bottomCy = cy + cavityH / 2 + lipH / 3 - curve / 5;
  int16_t leftCornerY = cy - curve + int16_t(pose.tension * 2.0f) + asym / 3;
  int16_t rightCornerY = cy - curve + int16_t(pose.tension * 2.0f) - asym / 4;
  if (isSmirk) {
    const int16_t lift = int16_t(fabsf(pose.skew) * 15.0f);
    const int16_t drop = int16_t(fabsf(pose.skew) * 5.0f);
    if (pose.skew > 0.0f) {
      rightCornerY -= lift;
      leftCornerY += drop;
    } else {
      leftCornerY -= lift;
      rightCornerY += drop;
    }
  }
  const uint16_t shadow = rgb(28, 0, 10);
  const uint16_t lip = rgb(156, 38, 58);
  const uint16_t lipHi = rgb(236, 104, 112);
  const uint16_t lipLo = rgb(82, 10, 30);
  const uint16_t cavity = rgb(9, 0, 5);

  fillEllipse(frame, cx + asym / 4, cy, w / 2 + 24, cavityH / 2 + lipH + 18, shadow);
  fillEllipse(frame, cx + asym / 5, bottomCy + 2, w / 2 + 18, maxi16(18, lipH / 2 + 10), lipLo);
  fillEllipse(frame, cx + asym / 3, bottomCy, w / 2 + 8, maxi16(16, lipH / 2 + 5), lip);
  fillEllipse(frame, cx - w / 5 + asym / 2, topCy + asym / 8, w / 3 + 14, maxi16(13, lipH / 2 + 1), lipLo);
  fillEllipse(frame, cx + w / 5 + asym / 3, topCy - asym / 10, w / 3 + 5, maxi16(12, lipH / 2 - 1), lipLo);
  fillEllipse(frame, cx - w / 5 + asym / 2, topCy - 3 + asym / 8, w / 3 + 6, maxi16(11, lipH / 2 - 2), lip);
  fillEllipse(frame, cx + w / 5 + asym / 3, topCy - 4 - asym / 10, w / 3 - 1, maxi16(10, lipH / 2 - 4), lip);
  fillEllipse(frame, cx + asym / 3, topCy + lipH / 7, w / 5 + 3, maxi16(8, lipH / 3), mixColor(lipLo, lip, 0.36f));
  frame.fillTriangle(cx - 22 + asym / 4, topCy - lipH / 2 + 6, cx + 15 + asym / 4, topCy - lipH / 2 + 4,
                     cx - 3 + asym / 3, topCy - lipH / 7, lipLo);
  fillEllipse(frame, cx - w / 5 + asym / 2, topCy - lipH / 5, w / 5, maxi16(4, lipH / 8), lipHi);
  fillEllipse(frame, cx + w / 6 + asym / 3, topCy - lipH / 6, w / 6, maxi16(3, lipH / 9), mixColor(lip, lipHi, 0.50f));
  fillEllipse(frame, cx + w / 10 + asym / 4, bottomCy - lipH / 5, w / 3 + 6, maxi16(5, lipH / 7), mixColor(lip, lipHi, 0.50f));

  fillEllipse(frame, cx + asym / 3, cy + asym / 12, cavityW / 2, maxi16(3, cavityH / 2), cavity);
  if (cavityH > 16) {
    drawMouthTongue(cx + asym / 4, cy + cavityH / 3 + asym / 12, cavityW / 4, maxi16(5, cavityH / 5));
  } else {
    frame.drawFastHLine(cx + asym / 3 - cavityW / 2 + 10, cy + asym / 12, cavityW - 20, rgb(28, 2, 12));
  }

  const float teethAmount = max(pose.teeth, pose.open > 0.34f ? clampf((pose.open - 0.30f) * 1.2f, 0.0f, 0.42f) : 0.0f);
  drawMouthTeeth(cx + asym / 3 - cavityW / 2 + 18, cy + asym / 12 - cavityH / 2 + 2, cavityW - 36, cavityH, teethAmount);

  const int16_t leftX = cx - w / 2;
  const int16_t rightX = cx + w / 2;
  frame.fillCircle(leftX + asym / 3, leftCornerY + int16_t(pose.skew * 10.0f), maxi16(9, lipH / 3), mixColor(lipLo, lip, 0.42f));
  frame.fillCircle(rightX + asym / 4, rightCornerY - int16_t(pose.skew * 10.0f), maxi16(11, lipH / 3), mixColor(lipLo, lip, 0.48f));
  if (isSmirk || shape == MouthShape::Sneer) {
    const bool liftRight = pose.skew > 0.0f;
    const int16_t creaseX = liftRight ? rightX - 36 + asym / 3 : leftX + 36 + asym / 2;
    const int16_t creaseY = liftRight ? rightCornerY - 8 : leftCornerY - 8;
    const int16_t creaseDir = liftRight ? -1 : 1;
    const int16_t creaseLen = isSmirk ? 34 : 24;
    frame.drawLine(creaseX, creaseY, creaseX + creaseDir * creaseLen, creaseY - 15, lipHi);
    frame.drawLine(creaseX - creaseDir * 2, creaseY + 7, creaseX + creaseDir * (creaseLen - 4), creaseY, lipLo);
  }
  frame.drawFastHLine(cx + asym / 3 - cavityW / 2 + 12, topCy - lipH / 3 + asym / 10, maxi16(20, cavityW / 3), lipHi);
  frame.drawFastHLine(cx + asym / 4 - cavityW / 4, bottomCy + lipH / 3 - asym / 12, maxi16(20, cavityW / 2), lipLo);
}

void renderRobotMouth(MouthShape shape, MouthPose pose, uint32_t now) {
  const float talkBeat = clampf(0.5f + 0.5f * sinf(float(now) * 0.05f), 0.0f, 1.0f);
  const float beat = mouthState.talkLevel > 0.01f ? pose.open + (talkBeat - pose.open) * mouthState.talkLevel : pose.open;
  frame.fillScreen(BLACK);
  frame.fillRoundRect(8, 54, 224, 132, 34, rgb(0, 8, 16));
  frame.drawRoundRect(9, 55, 222, 130, 33, rgb(30, 118, 132));
  frame.drawRoundRect(15, 61, 210, 118, 28, rgb(12, 58, 78));
  constexpr uint8_t barCount = 11;
  constexpr int16_t barW = 12;
  constexpr int16_t barGap = 6;
  constexpr int16_t barStep = barW + barGap;
  constexpr int16_t barsW = barCount * barW + (barCount - 1) * barGap;
  const int16_t barsX = CX - barsW / 2;
  for (uint8_t i = 0; i < barCount; ++i) {
    const int16_t x = barsX + int16_t(i) * barStep;
    const float wave = 0.35f + 0.65f * fabsf(sinf(float(now) * 0.009f + float(i) * 0.8f));
    const int16_t barH = int16_t(12.0f + 80.0f * max(beat, pose.open) * wave);
    frame.fillRoundRect(x, 120 - barH / 2, barW, barH, 6, rgb(44, 220, 232));
    frame.drawFastVLine(x + 4, 120 - barH / 2 + 5, maxi16(1, barH - 10), rgb(132, 248, 255));
  }
}

void renderMouth(uint32_t now) {
  const MouthShape shape = activeMouthShape(now);
  const MouthPose pose = easedMouthPose(shape, now);
  if (mouthState.style == MouthStyle::Robot) {
    renderRobotMouth(shape, pose, now);
  } else {
    renderHumanMouth(shape, pose, now);
  }
}

void deselectDisplayBus();

void pushFrame(Adafruit_GC9A01A &tft) {
  deselectDisplayBus();
  tft.drawRGBBitmap(0, 0, frame.getBuffer(), SCREEN_W, SCREEN_H);
  deselectDisplayBus();
}

#if REACHY_HAS_AUX_DISPLAY
void printAuxText(int16_t x, int16_t y, const char *text, uint16_t color, uint8_t size = 1) {
  auxTft.setTextSize(size);
  auxTft.setTextColor(color);
  auxTft.setTextWrap(false);
  auxTft.setCursor(x, y);
  auxTft.print(text);
}

void printAuxValue(int16_t x, int16_t y, int16_t w, const char *label, const char *value) {
  auxTft.fillRect(x, y, w, 26, rgb(12, 23, 31));
  auxTft.setTextSize(1);
  auxTft.setTextWrap(false);
  auxTft.setTextColor(rgb(112, 147, 170));
  auxTft.setCursor(x, y);
  auxTft.print(label);
  auxTft.setTextColor(rgb(220, 238, 238));
  auxTft.setCursor(x, y + 12);
  auxTft.print(value);
}

void drawAuxMeter(int16_t x, int16_t y, int16_t w, int16_t h, float value, uint16_t color) {
  value = clampf(value, 0.0f, 1.0f);
  auxTft.drawRoundRect(x, y, w, h, 4, rgb(40, 62, 76));
  auxTft.fillRoundRect(x + 2, y + 2, w - 4, h - 4, 3, rgb(12, 23, 31));
  auxTft.fillRoundRect(x + 2, y + 2, maxi16(1, int16_t((w - 4) * value)), h - 4, 3, color);
}

void renderAuxStatusDisplay(uint32_t now) {
  if (now - lastAuxFrame < AUX_FRAME_MS && !auxNeedsFullPaint) return;
  lastAuxFrame = now;

  const uint16_t bg = rgb(4, 8, 13);
  const uint16_t panel = rgb(12, 23, 31);
  const uint16_t line = rgb(36, 74, 91);
  const uint16_t cyan = rgb(70, 220, 232);
  const uint16_t amber = rgb(245, 185, 86);
  const uint16_t rose = rgb(228, 92, 118);
  const uint16_t green = rgb(95, 225, 142);
  const Mood mood = currentMood(now);
  const MouthShape mouth = activeMouthShape(now);

  char lineBuf[44];

  deselectDisplayBus();
  if (auxNeedsFullPaint) {
    auxTft.fillScreen(bg);
    auxTft.fillRoundRect(8, 8, 304, 42, 8, panel);
    auxTft.drawRoundRect(8, 8, 304, 42, 8, line);
    printAuxText(18, 18, "REACHY FACE", cyan, 2);
    printAuxText(190, 18, "bus 4/5/6/7", rgb(142, 170, 182), 1);

    auxTft.fillRoundRect(8, 58, 146, 62, 8, panel);
    auxTft.drawRoundRect(8, 58, 146, 62, 8, line);
    auxTft.fillRoundRect(166, 58, 146, 62, 8, panel);
    auxTft.drawRoundRect(166, 58, 146, 62, 8, line);

    auxTft.fillRoundRect(8, 128, 190, 104, 8, panel);
    auxTft.drawRoundRect(8, 128, 190, 104, 8, line);
    printAuxText(18, 138, "TALK ENERGY", rgb(174, 198, 204), 1);

    auxTft.fillRoundRect(206, 128, 106, 104, 8, panel);
    auxTft.drawRoundRect(206, 128, 106, 104, 8, line);
    printAuxText(216, 138, "GAZE", rgb(174, 198, 204), 1);
    auxNeedsFullPaint = false;
  }

  auxTft.fillRect(266, 32, 34, 10, panel);
  snprintf(lineBuf, sizeof(lineBuf), "%lus", (unsigned long)(now / 1000));
  printAuxText(266, 32, lineBuf, rgb(142, 170, 182), 1);

  printAuxValue(18, 68, 58, "MOOD", moodName(mood));
  printAuxValue(86, 68, 58, "EYES", eyeStyleName(eyeRenderStyle));
  printAuxValue(18, 96, 58, "MOUTH", mouthShapeName(mouth));
  printAuxValue(86, 96, 58, "BEAT", idleBeatName(idleDirector.beat));

  const bool stationConnected = WiFi.status() == WL_CONNECTED;
  auxTft.fillRect(176, 68, 126, 44, panel);
  printAuxText(176, 68, stationConnected ? "WIFI LAN" : "WIFI AP", stationConnected ? green : amber, 1);
  String ip = stationConnected ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
  auxTft.setTextSize(1);
  auxTft.setTextWrap(false);
  auxTft.setTextColor(rgb(220, 238, 238));
  auxTft.setCursor(176, 86);
  auxTft.print(ip);
  printAuxText(176, 104, "CS 15 16 17 18", rgb(142, 170, 182), 1);

  drawAuxMeter(18, 154, 78, 12, mouthState.energy, amber);
  drawAuxMeter(110, 154, 78, 12, mouthState.talkLevel, rose);
  auxTft.fillRect(18, 174, 170, 48, panel);
  for (uint8_t i = 0; i < 12; ++i) {
    const float wave = 0.25f + 0.75f * fabsf(sinf(float(now) * 0.006f + float(i) * 0.72f));
    const float level = max(0.16f, mouthState.talkLevel * wave);
    const int16_t barH = int16_t(6.0f + 34.0f * level);
    const int16_t x = 20 + int16_t(i) * 14;
    auxTft.fillRoundRect(x, 220 - barH, 8, barH, 4, cyan);
  }

  constexpr int16_t gazeBoxX = 224;
  constexpr int16_t gazeBoxY = 160;
  constexpr int16_t gazeBoxW = 70;
  constexpr int16_t gazeBoxH = 54;
  constexpr int16_t gazeDotR = 4;
  auxTft.fillRect(gazeBoxX - gazeDotR - 1, gazeBoxY - gazeDotR - 1,
                  gazeBoxW + gazeDotR * 2 + 2, gazeBoxH + gazeDotR * 2 + 2, panel);
  auxTft.drawRect(gazeBoxX, gazeBoxY, gazeBoxW, gazeBoxH, rgb(48, 92, 110));
  auxTft.drawFastHLine(gazeBoxX, gazeBoxY + gazeBoxH / 2, gazeBoxW, rgb(24, 50, 62));
  auxTft.drawFastVLine(gazeBoxX + gazeBoxW / 2, gazeBoxY, gazeBoxH, rgb(24, 50, 62));
  const int16_t rawGx = gazeBoxX + gazeBoxW / 2 +
                        int16_t(clampf(gazeState.now.x / MAX_GAZE_X_PX, -1.0f, 1.0f) * 30.0f);
  const int16_t rawGy = gazeBoxY + gazeBoxH / 2 +
                        int16_t(clampf(gazeState.now.y / MAX_GAZE_Y_PX, -1.0f, 1.0f) * 22.0f);
  const int16_t gx = maxi16(gazeBoxX + gazeDotR + 1, mini16(rawGx, gazeBoxX + gazeBoxW - gazeDotR - 2));
  const int16_t gy = maxi16(gazeBoxY + gazeDotR + 1, mini16(rawGy, gazeBoxY + gazeBoxH - gazeDotR - 2));
  auxTft.fillCircle(gx, gy, gazeDotR, green);
  deselectDisplayBus();
}

void renderAuxMouthMirror(uint32_t now) {
#if REACHY_AUX_USES_MOUTH_FRAME
  const int16_t screenW = auxTft.width();
  const int16_t screenH = auxTft.height();
  MouthShape shape = activeMouthShape(now);
  const bool poseSettled = mouthState.poseInitialized &&
                           uint32_t(now - mouthState.poseStarted) >= MOUTH_TRANSITION_MS;
  const bool mouthMoving = mouthState.talking || mouthState.talkLevel > 0.02f || !poseSettled;
  const bool visualChanged = auxNeedsFullPaint || !auxMouthRendered ||
                             shape != auxLastMouthShape || mouthState.style != auxLastMouthStyle ||
                             mouthMoving;
  if (!visualChanged) return;
  if (now - lastAuxFrame < AUX_MOUTH_FRAME_MS && !auxNeedsFullPaint) return;
  lastAuxFrame = now;

  MouthPose pose = easedMouthPose(shape, now);

  deselectDisplayBus();
  if (mouthState.style == MouthStyle::Robot) {
    const float talkBeat = clampf(0.5f + 0.5f * sinf(float(now) * 0.05f), 0.0f, 1.0f);
    const float beat = mouthState.talkLevel > 0.01f ? pose.open + (talkBeat - pose.open) * mouthState.talkLevel : pose.open;
    const int16_t cx = screenW / 2;
    auxTft.fillRect(0, 44, screenW, 152, BLACK);
    auxTft.fillRoundRect(8, 54, screenW - 16, 132, 34, rgb(0, 8, 16));
    auxTft.drawRoundRect(9, 55, screenW - 18, 130, 33, rgb(30, 118, 132));
    auxTft.drawRoundRect(15, 61, screenW - 30, 118, 28, rgb(12, 58, 78));
    constexpr uint8_t barCount = 13;
    constexpr int16_t barW = 12;
    constexpr int16_t barGap = 7;
    constexpr int16_t barStep = barW + barGap;
    constexpr int16_t barsW = barCount * barW + (barCount - 1) * barGap;
    const int16_t barsX = cx - barsW / 2;
    for (uint8_t i = 0; i < barCount; ++i) {
      const int16_t x = barsX + int16_t(i) * barStep;
      const float wave = 0.35f + 0.65f * fabsf(sinf(float(now) * 0.009f + float(i) * 0.8f));
      const int16_t barH = int16_t(12.0f + 80.0f * max(beat, pose.open) * wave);
      auxTft.fillRoundRect(x, 120 - barH / 2, barW, barH, 6, rgb(44, 220, 232));
      auxTft.drawFastVLine(x + 4, 120 - barH / 2 + 5, maxi16(1, barH - 10), rgb(132, 248, 255));
    }
  } else {
    if (mouthState.talkLevel > 0.01f) {
      const float pulse = clampf(0.58f + 0.32f * sinf(float(now) * 0.037f) +
                                  0.18f * sinf(float(now) * 0.071f + 1.7f), 0.0f, 1.0f);
      pose.open = max(pose.open, 0.18f + mouthState.energy * 0.70f * pulse * mouthState.talkLevel);
      pose.width = max(pose.width, 0.56f + mouthState.energy * 0.20f * mouthState.talkLevel);
    }

    if (shape == MouthShape::Sleep && mouthState.talkLevel <= 0.01f &&
        uint32_t(now - mouthState.poseStarted) >= MOUTH_TRANSITION_MS) {
      const int16_t sleepX = 30;
      const int16_t sleepY = screenH / 2 - 7;
      auxTft.fillRect(0, sleepY - 10, screenW, 36, BLACK);
      auxTft.fillRoundRect(sleepX, sleepY, screenW - 60, 15, 7, rgb(118, 28, 44));
      auxTft.drawFastHLine(sleepX + 24, sleepY + 3, screenW - 112, rgb(218, 92, 102));
      auxTft.drawFastHLine(sleepX + 32, sleepY + 12, screenW - 128, rgb(58, 8, 22));
    } else {
      const int16_t w = mini16(screenW - 22, int16_t(150.0f + pose.width * 178.0f));
      const int16_t openH = int16_t(7.0f + pose.open * 92.0f);
      const int16_t lipH = int16_t(clampf(30.0f + pose.open * 28.0f + pose.tension * 7.0f, 28.0f, 62.0f));
      const int16_t driftX = mouthState.talkLevel > 0.01f
        ? int16_t(5.0f * sinf(float(now) * 0.0031f) + 2.0f * sinf(float(now) * 0.0071f + 1.4f))
        : 0;
      const int16_t driftY = mouthState.talkLevel > 0.01f
        ? int16_t(2.0f * sinf(float(now) * 0.0027f + 0.6f))
        : 0;
      const bool isSmirk = shape == MouthShape::SmirkLeft || shape == MouthShape::SmirkRight;
      const int16_t cx = screenW / 2 + int16_t(pose.skew * (isSmirk ? 50.0f : 28.0f)) + driftX;
      const int16_t cy = screenH / 2 + 6 + int16_t(pose.tension * 4.0f) + driftY;
      const int16_t curve = int16_t(pose.curve * 18.0f);
      const int16_t asym = (mouthState.talkLevel > 0.01f
                              ? int16_t(5.0f * mouthState.talkLevel *
                                        sinf(float(now) * 0.0041f + pose.width * 3.1f))
                              : 0) +
                           int16_t(pose.skew * (isSmirk ? 22.0f : 12.0f));
      const int16_t cavityW = int16_t(float(w) * (0.86f - pose.tension * 0.05f));
      const int16_t cavityH = maxi16(5, openH);
      const int16_t topCy = cy - cavityH / 2 - lipH / 3 - curve / 3;
      const int16_t bottomCy = cy + cavityH / 2 + lipH / 3 - curve / 5;
      int16_t leftCornerY = cy - curve + int16_t(pose.tension * 2.0f) + asym / 3;
      int16_t rightCornerY = cy - curve + int16_t(pose.tension * 2.0f) - asym / 4;
      if (isSmirk) {
        const int16_t lift = int16_t(fabsf(pose.skew) * 15.0f);
        const int16_t drop = int16_t(fabsf(pose.skew) * 5.0f);
        if (pose.skew > 0.0f) {
          rightCornerY -= lift;
          leftCornerY += drop;
        } else {
          leftCornerY -= lift;
          rightCornerY += drop;
        }
      }

      const uint16_t shadow = rgb(28, 0, 10);
      const uint16_t lip = rgb(156, 38, 58);
      const uint16_t lipHi = rgb(236, 104, 112);
      const uint16_t lipLo = rgb(82, 10, 30);
      const uint16_t cavity = rgb(9, 0, 5);

      auxTft.fillRect(0, maxi16(0, topCy - lipH - 28), screenW,
                      mini16(screenH, bottomCy + lipH + 34) - maxi16(0, topCy - lipH - 28), BLACK);
      fillEllipse(auxTft, cx + asym / 4, cy, w / 2 + 24, cavityH / 2 + lipH + 18, shadow);
      fillEllipse(auxTft, cx + asym / 5, bottomCy + 2, w / 2 + 18, maxi16(18, lipH / 2 + 10), lipLo);
      fillEllipse(auxTft, cx + asym / 3, bottomCy, w / 2 + 8, maxi16(16, lipH / 2 + 5), lip);
      fillEllipse(auxTft, cx - w / 5 + asym / 2, topCy + asym / 8, w / 3 + 14, maxi16(13, lipH / 2 + 1), lipLo);
      fillEllipse(auxTft, cx + w / 5 + asym / 3, topCy - asym / 10, w / 3 + 5, maxi16(12, lipH / 2 - 1), lipLo);
      fillEllipse(auxTft, cx - w / 5 + asym / 2, topCy - 3 + asym / 8, w / 3 + 6, maxi16(11, lipH / 2 - 2), lip);
      fillEllipse(auxTft, cx + w / 5 + asym / 3, topCy - 4 - asym / 10, w / 3 - 1, maxi16(10, lipH / 2 - 4), lip);
      fillEllipse(auxTft, cx + asym / 3, topCy + lipH / 7, w / 5 + 3, maxi16(8, lipH / 3), mixColor(lipLo, lip, 0.36f));
      auxTft.fillTriangle(cx - 22 + asym / 4, topCy - lipH / 2 + 6, cx + 15 + asym / 4, topCy - lipH / 2 + 4,
                          cx - 3 + asym / 3, topCy - lipH / 7, lipLo);
      fillEllipse(auxTft, cx - w / 5 + asym / 2, topCy - lipH / 5, w / 5, maxi16(4, lipH / 8), lipHi);
      fillEllipse(auxTft, cx + w / 6 + asym / 3, topCy - lipH / 6, w / 6, maxi16(3, lipH / 9), mixColor(lip, lipHi, 0.50f));
      fillEllipse(auxTft, cx + w / 10 + asym / 4, bottomCy - lipH / 5, w / 3 + 6, maxi16(5, lipH / 7), mixColor(lip, lipHi, 0.50f));

      fillEllipse(auxTft, cx + asym / 3, cy + asym / 12, cavityW / 2, maxi16(3, cavityH / 2), cavity);
      if (cavityH > 16) {
        const uint16_t tongue = rgb(162, 54, 72);
        const uint16_t tongueHi = rgb(218, 94, 106);
        const int16_t tongueRx = cavityW / 4;
        const int16_t tongueRy = maxi16(5, cavityH / 5);
        const int16_t tongueCx = cx + asym / 4;
        const int16_t tongueY = cy + cavityH / 3 + asym / 12;
        fillEllipse(auxTft, tongueCx, tongueY, tongueRx, tongueRy, tongue);
        fillEllipse(auxTft, tongueCx - tongueRx / 5, tongueY - tongueRy / 4,
                    maxi16(4, tongueRx / 3), maxi16(2, tongueRy / 4), tongueHi);
      } else {
        auxTft.drawFastHLine(cx + asym / 3 - cavityW / 2 + 10, cy + asym / 12, cavityW - 20, rgb(28, 2, 12));
      }

      const float teethAmount = max(pose.teeth, pose.open > 0.34f ? clampf((pose.open - 0.30f) * 1.2f, 0.0f, 0.42f) : 0.0f);
      if (teethAmount > 0.01f && cavityH >= 12 && cavityW >= 36) {
        const int16_t teethX = cx + asym / 3 - cavityW / 2 + 18;
        const int16_t teethY = cy + asym / 12 - cavityH / 2 + 2;
        const int16_t teethW = cavityW - 36;
        const int16_t teethH = int16_t(clampf(float(cavityH) * (0.24f + teethAmount * 0.18f), 5.0f, 22.0f));
        auxTft.fillRoundRect(teethX, teethY, teethW, teethH, 5, rgb(238, 228, 198));
        auxTft.drawFastHLine(teethX + 4, teethY + teethH - 1, teethW - 8, rgb(126, 104, 98));
        for (int16_t tx = teethX + 28; tx < teethX + teethW - 14; tx += 36) {
          auxTft.drawFastVLine(tx, teethY + 2, teethH - 4, rgb(126, 104, 98));
        }
      }

      const int16_t leftX = cx - w / 2;
      const int16_t rightX = cx + w / 2;
      auxTft.fillCircle(leftX + asym / 3, leftCornerY + int16_t(pose.skew * 10.0f), maxi16(9, lipH / 3), mixColor(lipLo, lip, 0.42f));
      auxTft.fillCircle(rightX + asym / 4, rightCornerY - int16_t(pose.skew * 10.0f), maxi16(11, lipH / 3), mixColor(lipLo, lip, 0.48f));
      if (isSmirk || shape == MouthShape::Sneer) {
        const bool liftRight = pose.skew > 0.0f;
        const int16_t creaseX = liftRight ? rightX - 36 + asym / 3 : leftX + 36 + asym / 2;
        const int16_t creaseY = liftRight ? rightCornerY - 8 : leftCornerY - 8;
        const int16_t creaseDir = liftRight ? -1 : 1;
        const int16_t creaseLen = isSmirk ? 34 : 24;
        auxTft.drawLine(creaseX, creaseY, creaseX + creaseDir * creaseLen, creaseY - 15, lipHi);
        auxTft.drawLine(creaseX - creaseDir * 2, creaseY + 7, creaseX + creaseDir * (creaseLen - 4), creaseY, lipLo);
      }
      auxTft.drawFastHLine(cx + asym / 3 - cavityW / 2 + 12, topCy - lipH / 3 + asym / 10, maxi16(20, cavityW / 3), lipHi);
      auxTft.drawFastHLine(cx + asym / 4 - cavityW / 4, bottomCy + lipH / 3 - asym / 12, maxi16(20, cavityW / 2), lipLo);
    }
  }
  auxNeedsFullPaint = false;
  auxMouthRendered = true;
  auxLastMouthShape = shape;
  auxLastMouthStyle = mouthState.style;
  deselectDisplayBus();
#else
  (void)now;
#endif
}

const char *auxRoleName() {
#if REACHY_AUX_ROLE == REACHY_AUX_ROLE_STATUS
  return "status";
#elif REACHY_AUX_ROLE == REACHY_AUX_ROLE_MOUTH_MIRROR
  return "mouth_mirror";
#elif REACHY_AUX_ROLE == REACHY_AUX_ROLE_MOUTH_ONLY
  return "mouth_only";
#else
  return "unknown";
#endif
}

void renderAuxDisplay(uint32_t now) {
#if REACHY_AUX_ROLE == REACHY_AUX_ROLE_STATUS
  renderAuxStatusDisplay(now);
#elif (REACHY_AUX_ROLE == REACHY_AUX_ROLE_MOUTH_MIRROR) || (REACHY_AUX_ROLE == REACHY_AUX_ROLE_MOUTH_ONLY)
  renderAuxMouthMirror(now);
#else
  (void)now;
#endif
}
#endif

#if REACHY_MOUTH_STATUS_DISPLAY
constexpr int16_t MOUTH_STATUS_ROW_X = 34;
constexpr int16_t MOUTH_STATUS_ROW_W = 172;
constexpr int16_t MOUTH_STATUS_ROW_H = 42;
constexpr int16_t MOUTH_STATUS_ROW_Y[4] = {20, 70, 120, 170};

void printMouthStatusText(int16_t x, int16_t y, const char *text, uint16_t color, uint8_t size = 1) {
  frame.setTextSize(size);
  frame.setTextColor(color);
  frame.setTextWrap(false);
  frame.setCursor(x, y);
  frame.print(text);
}

void printCenteredMouthStatusText(int16_t x, int16_t y, int16_t w, const char *text, uint16_t color, uint8_t size = 1) {
  const int16_t textW = int16_t(strlen(text)) * 6 * size;
  const int16_t tx = x + maxi16(0, (w - textW) / 2);
  printMouthStatusText(tx, y, text, color, size);
}

void drawMouthStatusRowShell(uint8_t row) {
  const uint16_t panel = rgb(10, 18, 25);
  const uint16_t line = rgb(34, 68, 85);
  const int16_t y = MOUTH_STATUS_ROW_Y[row];
  frame.fillRoundRect(MOUTH_STATUS_ROW_X, y, MOUTH_STATUS_ROW_W, MOUTH_STATUS_ROW_H, 8, panel);
  frame.drawRoundRect(MOUTH_STATUS_ROW_X, y, MOUTH_STATUS_ROW_W, MOUTH_STATUS_ROW_H, 8, line);
}

void drawMouthStatusRow(uint8_t row, const char *label, const char *value) {
  const uint16_t panel = rgb(10, 18, 25);
  const int16_t x = MOUTH_STATUS_ROW_X;
  const int16_t y = MOUTH_STATUS_ROW_Y[row];
  const int16_t w = MOUTH_STATUS_ROW_W;
  const int16_t h = MOUTH_STATUS_ROW_H;
  frame.fillRect(x + 10, y + 18, w - 20, h - 22, panel);
  printCenteredMouthStatusText(x + 10, y + 5, w - 20, label, rgb(106, 138, 158), 1);
  printCenteredMouthStatusText(x + 10, y + 18, w - 20, value, rgb(218, 235, 232), strlen(value) > 13 ? 1 : 2);
}

void drawMouthStatusRows() {
  for (uint8_t i = 0; i < 4; ++i) {
    drawMouthStatusRowShell(i);
  }
}

void renderMouthStatusDisplay(uint32_t now) {
  if (now - lastMouthStatusFrame < MOUTH_STATUS_FRAME_MS && !mouthStatusNeedsFullPaint) return;
  lastMouthStatusFrame = now;

  const uint16_t bg = rgb(3, 7, 12);
  const uint16_t line = rgb(34, 68, 85);
  const uint16_t dot = rgb(88, 228, 126);
  const Mood mood = currentMood(now);
  const MouthShape mouth = activeMouthShape(now);
  const char *labels[4] = {"EYES", "MOUTH", "MOOD", "BEAT"};
  const char *values[4] = {eyeStyleName(eyeRenderStyle), mouthShapeName(mouth), moodName(mood), idleBeatName(idleDirector.beat)};
  const int16_t nextDotX = maxi16(10, mini16(120 + int16_t(clampf(gazeState.now.x / MAX_GAZE_X_PX, -1.0f, 1.0f) * 96.0f), 230));
  const int16_t nextDotY = maxi16(10, mini16(120 - int16_t(clampf(gazeState.now.y / MAX_GAZE_Y_PX, -1.0f, 1.0f) * 96.0f), 230));
  const bool dotMoved = !mouthStatusDotDrawn || abs(nextDotX - mouthStatusDotX) >= 3 || abs(nextDotY - mouthStatusDotY) >= 3;
  bool statusDirty = mouthStatusNeedsFullPaint;
  for (uint8_t i = 0; i < 4; ++i) {
    if (strncmp(mouthStatusLastValues[i], values[i], sizeof(mouthStatusLastValues[i])) != 0) {
      statusDirty = true;
    }
  }
  if (!statusDirty && !dotMoved) return;

  deselectDisplayBus();
  frame.fillScreen(bg);
  frame.fillCircle(120, 120, 118, rgb(5, 12, 18));
  frame.drawCircle(120, 120, 116, line);
  drawMouthStatusRows();
  for (uint8_t i = 0; i < 4; ++i) {
    drawMouthStatusRow(i, labels[i], values[i]);
    strncpy(mouthStatusLastValues[i], values[i], sizeof(mouthStatusLastValues[i]) - 1);
    mouthStatusLastValues[i][sizeof(mouthStatusLastValues[i]) - 1] = '\0';
  }

  mouthStatusDotX = nextDotX;
  mouthStatusDotY = nextDotY;
  frame.drawCircle(mouthStatusDotX, mouthStatusDotY, 7, dot);
  frame.fillCircle(mouthStatusDotX, mouthStatusDotY, 2, dot);
  mouthStatusDotDrawn = true;
  mouthStatusNeedsFullPaint = false;
  mouthTft.drawRGBBitmap(0, 0, frame.getBuffer(), SCREEN_W, SCREEN_H);
  deselectDisplayBus();
}
#endif

uint8_t flippedRotation(uint8_t rotation) {
  return uint8_t((rotation + 2) & 0x03);
}

void applyDisplayOrientation() {
  leftTft.setRotation(apiState.eyesFlipped ? flippedRotation(LEFT_ROTATION) : LEFT_ROTATION);
  rightTft.setRotation(apiState.eyesFlipped ? flippedRotation(RIGHT_ROTATION) : RIGHT_ROTATION);
#if REACHY_HAS_AUX_DISPLAY
  auxTft.setRotation(apiState.eyesFlipped ? flippedRotation(AUX_ROTATION) : AUX_ROTATION);
#endif
}

void setEyesFlipped(bool flipped) {
  if (apiState.eyesFlipped == flipped) return;
  apiState.eyesFlipped = flipped;
  applyDisplayOrientation();
  leftTft.fillScreen(BLACK);
  rightTft.fillScreen(BLACK);
#if REACHY_HAS_MOUTH
  mouthTft.fillScreen(BLACK);
#endif
#if REACHY_HAS_AUX_DISPLAY
  auxTft.fillScreen(BLACK);
  lastAuxFrame = 0;
  auxNeedsFullPaint = true;
#if REACHY_AUX_USES_MOUTH_FRAME
  auxMouthRendered = false;
#endif
#endif
#if REACHY_MOUTH_STATUS_DISPLAY
  mouthStatusNeedsFullPaint = true;
  mouthStatusDotDrawn = false;
  lastMouthStatusFrame = 0;
#endif
}

bool saveFacePreferences() {
  Preferences preferences;
  if (!preferences.begin("reachy-face", false)) {
    Serial.println("Failed to open face preferences.");
    return false;
  }
  preferences.putString("eye_style", eyeStyleName(eyeRenderStyle));
  preferences.putString("mouth_style", mouthStyleName(mouthState.style));
  preferences.putBool("flipped", apiState.eyesFlipped);
  preferences.putBool("idle", apiState.idleEnabled);
  preferences.end();
  return true;
}

void loadFacePreferences() {
  Preferences preferences;
  if (!preferences.begin("reachy-face", false)) return;

  if (preferences.isKey("eye_style")) {
    EyeRenderStyle style;
    if (parseEyeStyleName(preferences.getString("eye_style", "").c_str(), style)) {
      eyeRenderStyle = style;
    }
  }
  if (preferences.isKey("mouth_style")) {
    MouthStyle style;
    if (parseMouthStyleName(preferences.getString("mouth_style", "").c_str(), style)) {
      mouthState.style = style;
    }
  }
  if (preferences.isKey("flipped")) {
    apiState.eyesFlipped = preferences.getBool("flipped", false);
  }
  if (preferences.isKey("idle")) {
    apiState.idleEnabled = preferences.getBool("idle", true);
  }
  preferences.end();
}

void initDisplay(Adafruit_GC9A01A &tft, uint8_t rotation) {
  tft.begin(SPI_HZ);
  tft.setRotation(rotation);
  tft.invertDisplay(DISPLAY_INVERT);
  tft.fillScreen(BLACK);
}

#if REACHY_HAS_AUX_DISPLAY
void initAuxDisplay(Adafruit_ILI9341 &tft, uint8_t rotation) {
  tft.begin(SPI_HZ);
  tft.setRotation(rotation);
  tft.invertDisplay(false);
  tft.fillScreen(BLACK);
  auxNeedsFullPaint = true;
#if REACHY_AUX_USES_MOUTH_FRAME
  auxMouthRendered = false;
#endif
}
#endif

void resetSharedDisplaysIfNeeded() {
#if REACHY_SHARE_EYE_RST || (REACHY_HAS_MOUTH && (REACHY_MOUTH_RST == REACHY_LEFT_RST)) || (REACHY_HAS_AUX_DISPLAY && (REACHY_AUX_RST == REACHY_LEFT_RST))
  pinMode(PIN_L_RST, OUTPUT);
  digitalWrite(PIN_L_RST, HIGH);
  delay(10);
  digitalWrite(PIN_L_RST, LOW);
  delay(20);
  digitalWrite(PIN_L_RST, HIGH);
  delay(150);
#endif
}

void deselectDisplayBus() {
  pinMode(PIN_L_CS, OUTPUT);
  digitalWrite(PIN_L_CS, HIGH);
  pinMode(PIN_R_CS, OUTPUT);
  digitalWrite(PIN_R_CS, HIGH);
#ifdef REACHY_MOUTH_CS
  pinMode(PIN_MOUTH_CS, OUTPUT);
  digitalWrite(PIN_MOUTH_CS, HIGH);
#endif
#ifdef REACHY_AUX_CS
  pinMode(REACHY_AUX_CS, OUTPUT);
  digitalWrite(REACHY_AUX_CS, HIGH);
#endif
}

void pollFlipButton(uint32_t now) {
  const bool rawPressed = digitalRead(PIN_FLIP_BUTTON) == LOW;
  if (rawPressed != flipButton.lastRawPressed) {
    flipButton.lastRawPressed = rawPressed;
    flipButton.lastRawChange = now;
  }

  if (now - flipButton.lastRawChange < FLIP_BUTTON_DEBOUNCE_MS) return;
  if (rawPressed != flipButton.stablePressed) {
    flipButton.stablePressed = rawPressed;
    flipButton.longPressHandled = false;
    if (flipButton.stablePressed) {
      flipButton.pressedAt = now;
    }
  }

  if (flipButton.stablePressed && !flipButton.longPressHandled &&
      now - flipButton.pressedAt >= FLIP_BUTTON_HOLD_MS) {
    flipButton.longPressHandled = true;
    setEyesFlipped(!apiState.eyesFlipped);
    Serial.printf("OK flip %s button\n", apiState.eyesFlipped ? "on" : "off");
  }
}

bool parseFloatToken(const char *token, float &value) {
  if (token == nullptr) return false;
  char *end = nullptr;
  value = strtof(token, &end);
  return end != token && *end == '\0';
}

bool parseUint32Token(const char *token, uint32_t &value) {
  if (token == nullptr) return false;
  char *end = nullptr;
  value = strtoul(token, &end, 10);
  return end != token && *end == '\0';
}

void printApiHelp() {
  Serial.println("OK commands:");
  Serial.println("  mood <name|auto> [ms]");
  Serial.println("  expr <name|auto> [ms]");
  Serial.println("  beat <name>");
  Serial.println("  style <friendly|classic|cartoony|robot|sinister|sleepy>");
  Serial.println("  mouth <shape|auto|talk|stop> [ms] [energy]");
  Serial.println("  sleep [ms]");
  Serial.println("  gaze <x> <y> <z> [hold_ms] [move_ms]");
  Serial.println("  look <x> <y> <z> [hold_ms] [move_ms]");
  Serial.println("  gaze auto");
  Serial.println("  blink [single|double|ms]");
  Serial.println("  wink [left|right]");
  Serial.println("  flip [on|off|toggle]");
  Serial.println("  idle <on|off>");
  Serial.println("  status");
  Serial.println("  release");
}

void printApiStatus(uint32_t now) {
  Serial.printf("OK status idle=%s mood=%s style=%s mood_override=%s gaze_override=%s flipped=%s ",
                apiState.idleEnabled ? "on" : "off",
                moodName(currentMood(now)),
                eyeStyleName(eyeRenderStyle),
                apiState.moodOverride ? "on" : "off",
                apiState.gazeOverride ? "on" : "off",
                apiState.eyesFlipped ? "on" : "off");
  Serial.printf("director=%s gaze_now=%.1f,%.1f,%.1f gaze_to=%.1f,%.1f,%.1f\n",
                idleBeatName(idleDirector.beat),
                gazeState.now.x, gazeState.now.y, gazeState.now.z,
                gazeState.to.x, gazeState.to.y, gazeState.to.z);
  Serial.printf("OK mouth style=%s shape=%s override=%s talking=%s energy=%.2f\n",
                mouthStyleName(mouthState.style),
                mouthShapeName(activeMouthShape(now)),
                mouthState.overrideShape ? "on" : "off",
                mouthState.talking ? "on" : "off",
                mouthState.energy);
}

void releaseApiOverrides(uint32_t now) {
  apiState.idleEnabled = true;
  apiState.moodOverride = false;
  apiState.moodUntil = 0;
  apiState.gazeOverride = false;
  apiState.gazeUntil = 0;
  mouthState.overrideShape = false;
  mouthState.talking = false;
  moodState.from = Mood::Calm;
  moodState.to = Mood::Calm;
  moodState.started = now;
  moodState.duration = 1;
  moodState.next = now + 1600;
  scheduleNextIdleBeat(now, true);
  gazeState.next = now;
}

void handleApiLine(char *line) {
  const uint32_t now = millis();
  char *cmd = strtok(line, " \t,");
  if (cmd == nullptr || cmd[0] == '#') return;

  if (equalsIgnoreCase(cmd, "help") || equalsIgnoreCase(cmd, "?")) {
    printApiHelp();
    return;
  }

  if (equalsIgnoreCase(cmd, "ping")) {
    Serial.println("OK pong");
    return;
  }

  if (equalsIgnoreCase(cmd, "status")) {
    printApiStatus(now);
    return;
  }

  if (equalsIgnoreCase(cmd, "release")) {
    releaseApiOverrides(now);
    Serial.println("OK release");
    return;
  }

  if (equalsIgnoreCase(cmd, "flip") || equalsIgnoreCase(cmd, "rotate")) {
    char *arg = strtok(nullptr, " \t,");
    if (arg == nullptr || equalsIgnoreCase(arg, "toggle")) {
      setEyesFlipped(!apiState.eyesFlipped);
    } else if (equalsIgnoreCase(arg, "on") || equalsIgnoreCase(arg, "1") || equalsIgnoreCase(arg, "true")) {
      setEyesFlipped(true);
    } else if (equalsIgnoreCase(arg, "off") || equalsIgnoreCase(arg, "0") || equalsIgnoreCase(arg, "false")) {
      setEyesFlipped(false);
    } else {
      Serial.println("ERR flip expected on/off/toggle");
      return;
    }
    saveFacePreferences();
    Serial.printf("OK flip %s\n", apiState.eyesFlipped ? "on" : "off");
    return;
  }

  if (equalsIgnoreCase(cmd, "style") || equalsIgnoreCase(cmd, "eye_style")) {
    char *name = strtok(nullptr, " \t,");
    if (name == nullptr) {
      Serial.printf("OK style %s\n", eyeStyleName(eyeRenderStyle));
      return;
    }
    EyeRenderStyle style;
    if (!parseEyeStyleName(name, style)) {
      Serial.println("ERR unknown style");
      return;
    }
    eyeRenderStyle = style;
    saveFacePreferences();
    Serial.printf("OK style %s\n", eyeStyleName(eyeRenderStyle));
    return;
  }

  if (equalsIgnoreCase(cmd, "mouth")) {
    char *name = strtok(nullptr, " \t,");
    if (name == nullptr) {
      Serial.printf("OK mouth %s style=%s talking=%s\n",
                    mouthShapeName(activeMouthShape(now)),
                    mouthStyleName(mouthState.style),
                    mouthState.talking ? "on" : "off");
      return;
    }
    if (equalsIgnoreCase(name, "auto") || equalsIgnoreCase(name, "idle") || equalsIgnoreCase(name, "release")) {
      mouthState.overrideShape = false;
      mouthState.talking = false;
      Serial.println("OK mouth auto");
      return;
    }
    if (equalsIgnoreCase(name, "talk") || equalsIgnoreCase(name, "talking")) {
      mouthState.shape = MouthShape::Open;
      mouthState.overrideShape = true;
      mouthState.talking = true;
    } else if (equalsIgnoreCase(name, "stop")) {
      mouthState.talking = false;
    } else {
      MouthShape shape;
      if (!parseMouthShapeName(name, shape)) {
        Serial.println("ERR unknown mouth shape");
        return;
      }
      mouthState.shape = shape;
      mouthState.overrideShape = true;
      mouthState.talking = false;
    }

    uint32_t holdMs = API_DEFAULT_MOUTH_MS;
    char *durationToken = strtok(nullptr, " \t,");
    if (durationToken != nullptr && !parseUint32Token(durationToken, holdMs)) {
      Serial.println("ERR mouth duration must be ms");
      return;
    }
    char *energyToken = strtok(nullptr, " \t,");
    if (energyToken != nullptr) {
      float energy = 0.0f;
      if (!parseFloatToken(energyToken, energy)) {
        Serial.println("ERR mouth energy must be 0-1");
        return;
      }
      mouthState.energy = clampf(energy, 0.0f, 1.0f);
    }
    mouthState.overrideUntil = holdMs == 0 ? 0 : now + holdMs;
    Serial.printf("OK mouth %s %lu energy=%.2f talking=%s\n",
                  mouthShapeName(mouthState.shape),
                  (unsigned long)holdMs,
                  mouthState.energy,
                  mouthState.talking ? "on" : "off");
    return;
  }

  if (equalsIgnoreCase(cmd, "sleep")) {
    uint32_t holdMs = API_DEFAULT_MOOD_MS;
    char *durationToken = strtok(nullptr, " \t,");
    if (durationToken != nullptr && !parseUint32Token(durationToken, holdMs)) {
      Serial.println("ERR sleep duration must be ms");
      return;
    }
    beginMood(Mood::Sleep, now, holdMs, true);
    apiState.gazeOverride = false;
    Serial.printf("OK sleep %lu\n", (unsigned long)holdMs);
    return;
  }

  if (equalsIgnoreCase(cmd, "idle") || equalsIgnoreCase(cmd, "auto")) {
    char *arg = strtok(nullptr, " \t,");
    if (arg == nullptr) {
      Serial.printf("OK idle %s\n", apiState.idleEnabled ? "on" : "off");
      return;
    }
    if (equalsIgnoreCase(arg, "on") || equalsIgnoreCase(arg, "1") || equalsIgnoreCase(arg, "true")) {
      apiState.idleEnabled = true;
      scheduleNextIdleBeat(now, true);
      if (!apiState.moodOverride) moodState.next = now;
      if (!apiState.gazeOverride) gazeState.next = now;
      saveFacePreferences();
      Serial.println("OK idle on");
    } else if (equalsIgnoreCase(arg, "off") || equalsIgnoreCase(arg, "0") || equalsIgnoreCase(arg, "false")) {
      apiState.idleEnabled = false;
      scheduleNextIdleBeat(now, true);
      saveFacePreferences();
      Serial.println("OK idle off");
    } else {
      Serial.println("ERR idle expected on/off");
    }
    return;
  }

  if (equalsIgnoreCase(cmd, "expr") || equalsIgnoreCase(cmd, "expression")) {
    char *name = strtok(nullptr, " \t,");
    if (name == nullptr) {
      Serial.println("ERR expr expected name or auto");
      return;
    }
    if (equalsIgnoreCase(name, "auto") || equalsIgnoreCase(name, "idle")) {
      releaseApiOverrides(now);
      Serial.println("OK expr auto");
      return;
    }

    Mood mood;
    if (!parseMoodName(name, mood)) {
      Serial.println("ERR unknown expression");
      return;
    }

    uint32_t holdMs = API_DEFAULT_EXPR_MS;
    char *durationToken = strtok(nullptr, " \t,");
    if (durationToken != nullptr && !parseUint32Token(durationToken, holdMs)) {
      Serial.println("ERR expr duration must be ms");
      return;
    }

    beginExpression(mood, now, holdMs, true);
    Serial.printf("OK expr %s %lu\n", moodName(mood), (unsigned long)holdMs);
    return;
  }

  if (equalsIgnoreCase(cmd, "beat")) {
    char *name = strtok(nullptr, " \t,");
    if (name == nullptr) {
      Serial.println("ERR beat expected name");
      return;
    }

    IdleBeat beat;
    if (!parseIdleBeatName(name, beat)) {
      Serial.println("ERR unknown beat");
      return;
    }

    apiState.idleEnabled = true;
    apiState.moodOverride = false;
    apiState.gazeOverride = false;
    startIdleBeat(now, beat);
    Serial.printf("OK beat %s\n", idleBeatName(beat));
    return;
  }

  if (equalsIgnoreCase(cmd, "mood")) {
    char *name = strtok(nullptr, " \t,");
    if (name == nullptr) {
      Serial.println("ERR mood expected name or auto");
      return;
    }
    if (equalsIgnoreCase(name, "auto") || equalsIgnoreCase(name, "idle")) {
      apiState.moodOverride = false;
      moodState.next = now;
      Serial.println("OK mood auto");
      return;
    }

    Mood mood;
    if (!parseMoodName(name, mood)) {
      Serial.println("ERR unknown mood");
      return;
    }

    uint32_t holdMs = API_DEFAULT_MOOD_MS;
    char *durationToken = strtok(nullptr, " \t,");
    if (durationToken != nullptr && !parseUint32Token(durationToken, holdMs)) {
      Serial.println("ERR mood duration must be ms");
      return;
    }

    beginMood(mood, now, holdMs, true);
    if (mood == Mood::Sleep) apiState.gazeOverride = false;
    Serial.printf("OK mood %s %lu\n", moodName(mood), (unsigned long)holdMs);
    return;
  }

  if (equalsIgnoreCase(cmd, "gaze") || equalsIgnoreCase(cmd, "look")) {
    char *xToken = strtok(nullptr, " \t,");
    if (xToken == nullptr) {
      Serial.println("ERR gaze expected x y z");
      return;
    }
    if (equalsIgnoreCase(xToken, "auto") || equalsIgnoreCase(xToken, "idle")) {
      apiState.gazeOverride = false;
      gazeState.next = now;
      Serial.println("OK gaze auto");
      return;
    }

    char *yToken = strtok(nullptr, " \t,");
    char *zToken = strtok(nullptr, " \t,");
    float x = 0.0f;
    float y = 0.0f;
    float z = 0.0f;
    if (!parseFloatToken(xToken, x) || !parseFloatToken(yToken, y) || !parseFloatToken(zToken, z)) {
      Serial.println("ERR gaze expected numeric x y z");
      return;
    }

    uint32_t holdMs = API_DEFAULT_GAZE_HOLD_MS;
    uint32_t moveMs = API_DEFAULT_GAZE_MOVE_MS;
    char *holdToken = strtok(nullptr, " \t,");
    char *moveToken = strtok(nullptr, " \t,");
    if (holdToken != nullptr && !parseUint32Token(holdToken, holdMs)) {
      Serial.println("ERR gaze hold must be ms");
      return;
    }
    if (moveToken != nullptr && !parseUint32Token(moveToken, moveMs)) {
      Serial.println("ERR gaze move must be ms");
      return;
    }

    beginGaze({x, y, z}, now, holdMs, moveMs, true);
    Serial.printf("OK gaze %.1f %.1f %.1f hold=%lu move=%lu\n",
                  x, y, z, (unsigned long)holdMs, (unsigned long)moveMs);
    return;
  }

  if (equalsIgnoreCase(cmd, "blink")) {
    bool doubleBlink = false;
    uint32_t durationMs = 150;
    char *arg = strtok(nullptr, " \t,");
    if (arg != nullptr) {
      if (equalsIgnoreCase(arg, "double")) {
        doubleBlink = true;
      } else if (equalsIgnoreCase(arg, "single")) {
        doubleBlink = false;
      } else if (!parseUint32Token(arg, durationMs)) {
        Serial.println("ERR blink expected single/double/ms");
        return;
      }
    }
    char *arg2 = strtok(nullptr, " \t,");
    if (arg2 != nullptr && equalsIgnoreCase(arg2, "double")) doubleBlink = true;

    triggerBlink(now, durationMs, doubleBlink);
    Serial.printf("OK blink %s %lu\n", doubleBlink ? "double" : "single", (unsigned long)durationMs);
    return;
  }

  if (equalsIgnoreCase(cmd, "wink")) {
    bool winkLeft = random(0, 2) == 0;
    char *arg = strtok(nullptr, " \t,");
    if (arg != nullptr) {
      if (equalsIgnoreCase(arg, "left") || equalsIgnoreCase(arg, "l")) winkLeft = true;
      else if (equalsIgnoreCase(arg, "right") || equalsIgnoreCase(arg, "r")) winkLeft = false;
      else {
        Serial.println("ERR wink expected left/right");
        return;
      }
    }
    triggerWink(now, winkLeft);
    Serial.printf("OK wink %s\n", winkLeft ? "left" : "right");
    return;
  }

  Serial.println("ERR unknown command");
}

void sendCors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Cache-Control", "no-store, max-age=0");
}

void sendJson(JsonDocument &doc, int status = 200) {
  String body;
  serializeJson(doc, body);
  sendCors();
  server.send(status, "application/json", body);
}

void sendOk(const char *message = nullptr) {
  JsonDocument doc;
  doc["ok"] = true;
  if (message != nullptr) doc["message"] = message;
  sendJson(doc);
}

void sendError(const char *message, int status = 400) {
  JsonDocument doc;
  doc["ok"] = false;
  doc["error"] = message;
  sendJson(doc, status);
}

bool parseBody(JsonDocument &doc) {
  DeserializationError error = deserializeJson(doc, server.arg("plain"));
  if (error) {
    sendError("invalid json", 400);
    return false;
  }
  return true;
}

uint32_t jsonMs(JsonVariantConst value, uint32_t defaultMs) {
  if (value.isNull()) return defaultMs;
  if (value.is<float>()) {
    const float number = value.as<float>();
    if (number <= 0.0f) return 0;
    if (number <= 120.0f) return uint32_t(number * 1000.0f);
    return uint32_t(number);
  }
  return defaultMs;
}

uint32_t jsonMilliseconds(JsonVariantConst value, uint32_t defaultMs) {
  if (value.isNull()) return defaultMs;
  if (value.is<float>()) {
    const float number = value.as<float>();
    if (number <= 0.0f) return 0;
    return uint32_t(number);
  }
  return defaultMs;
}

bool jsonBool(JsonVariantConst value, bool defaultValue) {
  if (value.isNull()) return defaultValue;
  if (value.is<bool>()) return value.as<bool>();
  if (value.is<const char *>()) {
    const char *text = value.as<const char *>();
    if (equalsIgnoreCase(text, "on") || equalsIgnoreCase(text, "true") || equalsIgnoreCase(text, "1")) return true;
    if (equalsIgnoreCase(text, "off") || equalsIgnoreCase(text, "false") || equalsIgnoreCase(text, "0")) return false;
  }
  return defaultValue;
}

void loadSavedWifi(String &ssid, String &password) {
  Preferences preferences;
  if (!preferences.begin("reachy-wifi", false)) return;
  if (preferences.isKey("ssid")) ssid = preferences.getString("ssid", "");
  if (preferences.isKey("password")) password = preferences.getString("password", "");
  preferences.end();
}

bool hasSavedWifi() {
  String ssid;
  String password;
  loadSavedWifi(ssid, password);
  return ssid.length() > 0;
}

bool saveWifiCredentials(const String &ssid, const String &password) {
  Preferences preferences;
  if (!preferences.begin("reachy-wifi", false)) return false;
  preferences.putString("ssid", ssid);
  preferences.putString("password", password);
  preferences.end();
  return true;
}

bool clearSavedWifiCredentials() {
  Preferences preferences;
  if (!preferences.begin("reachy-wifi", false)) return false;
  preferences.remove("ssid");
  preferences.remove("password");
  preferences.end();
  return true;
}

bool releaseToken(const char *text) {
  return equalsIgnoreCase(text, "auto") || equalsIgnoreCase(text, "idle") ||
         equalsIgnoreCase(text, "random") || equalsIgnoreCase(text, "neutral");
}

void addState(JsonDocument &doc, uint32_t now) {
  doc["ok"] = true;
  doc["running"] = true;
  doc["idle"] = apiState.idleEnabled;
  doc["autonomous"] = apiState.idleEnabled && !apiState.moodOverride && !apiState.gazeOverride;
  doc["mood"] = moodName(currentMood(now));
  doc["style"] = eyeStyleName(eyeRenderStyle);
  doc["mood_override"] = apiState.moodOverride;
  doc["gaze_override"] = apiState.gazeOverride;
  doc["flipped"] = apiState.eyesFlipped;
  doc["flip"] = apiState.eyesFlipped;
  doc["sleeping"] = currentMood(now) == Mood::Sleep;
  doc["director"] = idleBeatName(idleDirector.beat);

  JsonObject wifi = doc["wifi"].to<JsonObject>();
  const bool stationConnected = WiFi.status() == WL_CONNECTED;
  const wifi_mode_t mode = WiFi.getMode();
  const bool accessPointEnabled = mode == WIFI_AP || mode == WIFI_AP_STA;
  wifi["mode"] = stationConnected && accessPointEnabled ? "ap+station"
                 : stationConnected                  ? "station"
                 : accessPointEnabled                ? "ap"
                 : mode == WIFI_OFF                  ? "off"
                                                      : "connecting";
  wifi["connected"] = stationConnected;
  wifi["ssid"] = stationConnected ? WiFi.SSID() : REACHY_AP_SSID;
  wifi["ip"] = stationConnected ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
  wifi["ap_ssid"] = REACHY_AP_SSID;
  wifi["ap_ip"] = WiFi.softAPIP().toString();
  wifi["hostname"] = REACHY_HOSTNAME;
  wifi["mdns_url"] = String("http://") + REACHY_HOSTNAME + ".local/";
  wifi["saved_credentials"] = hasSavedWifi();

  JsonObject mouth = doc["mouth"].to<JsonObject>();
  mouth["present"] = bool(REACHY_HAS_MOUTH);
  mouth["style"] = mouthStyleName(mouthState.style);
  mouth["shape"] = mouthShapeName(activeMouthShape(now));
  mouth["manual"] = mouthState.overrideShape;
  mouth["talking"] = mouthState.talking;
  mouth["energy"] = mouthState.energy;
#if REACHY_MOUTH_STATUS_DISPLAY
  mouth["display_role"] = "status";
#elif REACHY_HAS_MOUTH
  mouth["display_role"] = "mouth";
#endif

#if REACHY_HAS_AUX_DISPLAY
  JsonObject aux = doc["aux_display"].to<JsonObject>();
  aux["present"] = true;
  aux["driver"] = "ili9341";
  aux["cs"] = PIN_AUX_CS;
  aux["rotation"] = apiState.eyesFlipped ? flippedRotation(AUX_ROTATION) : AUX_ROTATION;
  aux["role"] = auxRoleName();
#else
  JsonObject aux = doc["aux_display"].to<JsonObject>();
  aux["present"] = false;
#ifdef REACHY_AUX_CS
  aux["cs"] = REACHY_AUX_CS;
  aux["held_high"] = true;
  aux["isolation"] = true;
#endif
#endif

  JsonObject gaze = doc["gaze"].to<JsonObject>();
  gaze["manual"] = apiState.gazeOverride;
  gaze["now"]["x"] = gazeState.now.x;
  gaze["now"]["y"] = gazeState.now.y;
  gaze["now"]["z"] = gazeState.now.z;
  gaze["target"]["x"] = gazeState.to.x;
  gaze["target"]["y"] = gazeState.to.y;
  gaze["target"]["z"] = gazeState.to.z;

  JsonObject blink = doc["blink"].to<JsonObject>();
  const uint32_t blinkUntil = blinkState.started + blinkState.duration + blinkState.leadMs;
  blink["active"] = blinkState.active;
  blink["wink"] = blinkState.active && blinkState.winkOnly;
  blink["eye"] = blinkState.winkOnly ? (blinkState.winkLeft ? "left" : "right") : "both";
  blink["duration_ms"] = blinkState.duration;
  blink["remaining_ms"] = blinkState.active && !deadlineReached(now, blinkUntil) ? blinkUntil - now : 0;
}

void handleHttpState() {
  JsonDocument doc;
  addState(doc, millis());
  sendJson(doc);
}

void handleHttpWifi() {
  JsonDocument doc;
  if (server.method() == HTTP_GET) {
    addState(doc, millis());
    sendJson(doc);
    return;
  }
  if (!parseBody(doc)) return;

  if (jsonBool(doc["clear"], false)) {
    if (!clearSavedWifiCredentials()) {
      sendError("failed to clear wifi credentials", 500);
      return;
    }
    doc.clear();
    addState(doc, millis());
    doc["message"] = "saved wifi credentials cleared; rebooting";
    doc["restart_scheduled"] = true;
    restartAt = millis() + 900;
    sendJson(doc);
    return;
  }

  const char *ssid = doc["ssid"] | "";
  const char *password = doc["password"] | "";
  if (ssid == nullptr || ssid[0] == '\0') {
    sendError("wifi ssid required");
    return;
  }
  if (!saveWifiCredentials(String(ssid), String(password == nullptr ? "" : password))) {
    sendError("failed to save wifi credentials", 500);
    return;
  }

  doc.clear();
  addState(doc, millis());
  doc["message"] = "wifi credentials saved; rebooting";
  doc["restart_scheduled"] = true;
  restartAt = millis() + 900;
  sendJson(doc);
}

void handleHttpOtaUpload() {
  HTTPUpload &upload = server.upload();
  if (upload.status == UPLOAD_FILE_START) {
    otaActive = Update.begin(UPDATE_SIZE_UNKNOWN);
    otaSucceeded = false;
    otaBytes = 0;
    snprintf(otaMessage, sizeof(otaMessage), "starting ota upload");
    Serial.printf("OTA upload start: %s\n", upload.filename.c_str());
    if (!otaActive) {
      snprintf(otaMessage, sizeof(otaMessage), "ota update could not start");
      Update.printError(Serial);
    }
    return;
  }

  if (upload.status == UPLOAD_FILE_WRITE) {
    if (!otaActive) return;
    const size_t written = Update.write(upload.buf, upload.currentSize);
    otaBytes += written;
    if (written != upload.currentSize) {
      otaActive = false;
      snprintf(otaMessage, sizeof(otaMessage), "ota write failed after %u bytes", unsigned(otaBytes));
      Update.printError(Serial);
      Update.abort();
    }
    return;
  }

  if (upload.status == UPLOAD_FILE_END) {
    if (otaActive && Update.end(true)) {
      otaActive = false;
      otaSucceeded = true;
      snprintf(otaMessage, sizeof(otaMessage), "ota update complete; rebooting");
      Serial.printf("OTA upload complete: %u bytes\n", unsigned(otaBytes));
      restartAt = millis() + 900;
      return;
    }
    if (otaActive) {
      Update.printError(Serial);
      Update.abort();
    }
    otaActive = false;
    snprintf(otaMessage, sizeof(otaMessage), "ota update failed");
    return;
  }

  if (upload.status == UPLOAD_FILE_ABORTED) {
    if (otaActive) Update.abort();
    otaActive = false;
    otaSucceeded = false;
    snprintf(otaMessage, sizeof(otaMessage), "ota upload aborted");
    Serial.println("OTA upload aborted");
  }
}

void handleHttpOtaDone() {
  JsonDocument doc;
  addState(doc, millis());
  JsonObject ota = doc["ota"].to<JsonObject>();
  ota["bytes"] = otaBytes;
  ota["message"] = otaMessage;
  ota["rebooting"] = otaSucceeded;
  if (otaSucceeded) {
    doc["message"] = otaMessage;
    doc["restart_scheduled"] = true;
    sendJson(doc);
    return;
  }

  doc["ok"] = false;
  doc["error"] = otaMessage;
  sendJson(doc, 500);
}

void listValues(const char *key, const char *const *values, size_t count) {
  JsonDocument doc;
  doc["ok"] = true;
  JsonArray array = doc[key].to<JsonArray>();
  for (size_t index = 0; index < count; ++index) array.add(values[index]);
  sendJson(doc);
}

void handleHttpRelease() {
  releaseApiOverrides(millis());
  sendOk("release");
}

void handleHttpIdle(JsonDocument &doc, uint32_t now) {
  const bool enabled = jsonBool(doc["idle"], jsonBool(doc["autonomous"], true));
  apiState.idleEnabled = enabled;
  saveFacePreferences();
  scheduleNextIdleBeat(now, true);
  if (enabled) {
    if (!apiState.moodOverride) moodState.next = now;
    if (!apiState.gazeOverride) gazeState.next = now;
  }
}

bool handleHttpMoodName(const char *name, uint32_t holdMs, bool expressionMode, uint32_t now) {
  if (name == nullptr || name[0] == '\0') {
    sendError(expressionMode ? "expression expected name" : "mood expected name");
    return false;
  }
  if (releaseToken(name)) {
    releaseApiOverrides(now);
    return true;
  }

  Mood mood;
  if (!parseMoodName(name, mood)) {
    sendError(expressionMode ? "unknown expression" : "unknown mood");
    return false;
  }

  if (expressionMode) {
    beginExpression(mood, now, holdMs, true);
  } else {
    beginMood(mood, now, holdMs, true);
    if (mood == Mood::Sleep) apiState.gazeOverride = false;
  }
  return true;
}

bool handleHttpBeatName(const char *name, uint32_t now) {
  IdleBeat beat;
  if (name == nullptr || !parseIdleBeatName(name, beat)) {
    sendError("unknown beat");
    return false;
  }
  apiState.idleEnabled = true;
  apiState.moodOverride = false;
  apiState.gazeOverride = false;
  startIdleBeat(now, beat);
  return true;
}

bool handleHttpStyleName(const char *name) {
  EyeRenderStyle style;
  if (name == nullptr || !parseEyeStyleName(name, style)) {
    sendError("unknown style");
    return false;
  }
  eyeRenderStyle = style;
  saveFacePreferences();
  return true;
}

bool handleHttpMouth(JsonVariantConst value, JsonVariantConst durationValue, uint32_t now) {
  if (value.is<const char *>()) {
    const char *text = value.as<const char *>();
    if (releaseToken(text)) {
      mouthState.overrideShape = false;
      mouthState.talking = false;
      return true;
    }
    MouthShape shape;
    if (!parseMouthShapeName(text, shape)) {
      sendError("unknown mouth shape");
      return false;
    }
    mouthState.shape = shape;
    mouthState.overrideShape = true;
    const uint32_t holdMs = jsonMs(durationValue, API_DEFAULT_MOUTH_MS);
    mouthState.overrideUntil = holdMs == 0 ? 0 : now + holdMs;
    return true;
  }
  if (!value.is<JsonObjectConst>()) return true;

  JsonObjectConst mouth = value.as<JsonObjectConst>();
  if (jsonBool(mouth["release"], false) || jsonBool(mouth["auto"], false)) {
    mouthState.overrideShape = false;
    mouthState.talking = false;
  }
  if (mouth["style"].is<const char *>()) {
    MouthStyle style;
    if (!parseMouthStyleName(mouth["style"].as<const char *>(), style)) {
      sendError("unknown mouth style");
      return false;
    }
    mouthState.style = style;
    saveFacePreferences();
  }
  if (mouth["shape"].is<const char *>()) {
    MouthShape shape;
    if (!parseMouthShapeName(mouth["shape"].as<const char *>(), shape)) {
      sendError("unknown mouth shape");
      return false;
    }
    mouthState.shape = shape;
    mouthState.overrideShape = true;
  }
  if (!mouth["energy"].isNull()) {
    mouthState.energy = clampf(mouth["energy"].as<float>(), 0.0f, 1.0f);
  }
  if (!mouth["talking"].isNull()) {
    mouthState.talking = jsonBool(mouth["talking"], false);
    if (mouthState.talking && !mouthState.overrideShape) {
      mouthState.shape = MouthShape::Open;
      mouthState.overrideShape = true;
    }
  }
  if (mouthState.overrideShape || mouthState.talking) {
    const uint32_t holdMs = jsonMilliseconds(
      mouth["duration_ms"],
      jsonMs(mouth["duration"], jsonMs(durationValue, API_DEFAULT_MOUTH_MS))
    );
    mouthState.overrideUntil = holdMs == 0 ? 0 : now + holdMs;
  }
  return true;
}

void handleHttpGaze(JsonVariantConst gazeValue, JsonVariantConst durationValue, uint32_t now) {
  if (gazeValue.is<const char *>()) {
    const char *text = gazeValue.as<const char *>();
    if (releaseToken(text)) {
      apiState.gazeOverride = false;
      gazeState.next = now;
    }
    return;
  }
  if (!gazeValue.is<JsonObjectConst>()) return;

  JsonObjectConst gaze = gazeValue.as<JsonObjectConst>();
  const float rawX = gaze["x"] | 0.0f;
  const float rawY = gaze["y"] | 0.0f;
  const bool hasZ = !gaze["z"].isNull();
  const float x = hasZ ? rawX : clampf(rawX, -1.0f, 1.0f) * API_NORMALIZED_GAZE_X_MM * API_NORMALIZED_GAZE_X_SIGN;
  const float y = hasZ ? rawY : clampf(rawY, -1.0f, 1.0f) * API_NORMALIZED_GAZE_Y_MM * API_NORMALIZED_GAZE_Y_SIGN;
  const float z = hasZ ? float(gaze["z"]) : API_NORMALIZED_GAZE_Z_MM;
  const uint32_t holdMs = jsonMilliseconds(
    gaze["hold_ms"],
    jsonMs(gaze["duration"], jsonMs(durationValue, API_DEFAULT_GAZE_HOLD_MS))
  );
  const uint32_t moveMs = jsonMilliseconds(gaze["move_ms"], API_DEFAULT_GAZE_MOVE_MS);
  beginGaze({x, y, z}, now, holdMs, moveMs, true);
}

void handleHttpBlink(JsonDocument &doc, uint32_t now) {
  if (currentMood(now) == Mood::Sleep) releaseApiOverrides(now);
  bool doubleBlink = jsonBool(doc["double"], false);
  uint32_t durationMs = jsonMilliseconds(doc["duration_ms"], jsonMs(doc["duration"], 150));
  if (doc["type"].is<const char *>()) {
    const char *type = doc["type"].as<const char *>();
    doubleBlink = equalsIgnoreCase(type, "double");
  }
  triggerBlink(now, durationMs, doubleBlink);
}

void handleHttpWink(JsonDocument &doc, uint32_t now) {
  if (currentMood(now) == Mood::Sleep) releaseApiOverrides(now);
  bool left = random(0, 2) == 0;
  if (doc["eye"].is<const char *>()) {
    const char *eye = doc["eye"].as<const char *>();
    if (equalsIgnoreCase(eye, "left") || equalsIgnoreCase(eye, "l")) left = true;
    else if (equalsIgnoreCase(eye, "right") || equalsIgnoreCase(eye, "r")) left = false;
  }
  triggerWink(now, left, jsonMilliseconds(doc["duration_ms"], jsonMs(doc["duration"], 280)));
}

void handleHttpFlip(JsonVariantConst value) {
  if (value.isNull()) return;
  if (value.is<const char *>() && equalsIgnoreCase(value.as<const char *>(), "toggle")) {
    setEyesFlipped(!apiState.eyesFlipped);
    saveFacePreferences();
    return;
  }
  setEyesFlipped(jsonBool(value, apiState.eyesFlipped));
  saveFacePreferences();
}

void handleHttpControl() {
  JsonDocument doc;
  if (!parseBody(doc)) return;
  const uint32_t now = millis();

  if (jsonBool(doc["release"], false)) releaseApiOverrides(now);
  if (!doc["idle"].isNull() || !doc["autonomous"].isNull()) handleHttpIdle(doc, now);
  if (!doc["sleep"].isNull() && jsonBool(doc["sleep"], true)) {
    beginMood(Mood::Sleep, now, jsonMilliseconds(doc["sleep_ms"], jsonMs(doc["duration"], API_DEFAULT_MOOD_MS)), true);
    apiState.gazeOverride = false;
  }
  if (doc["mood"].is<const char *>()) {
    if (!handleHttpMoodName(
      doc["mood"].as<const char *>(),
      jsonMilliseconds(doc["duration_ms"], jsonMs(doc["duration"], API_DEFAULT_MOOD_MS)),
      false,
      now
    )) return;
  }
  if (doc["emotion"].is<const char *>()) {
    if (!handleHttpMoodName(
      doc["emotion"].as<const char *>(),
      jsonMilliseconds(doc["duration_ms"], jsonMs(doc["duration"], API_DEFAULT_MOOD_MS)),
      false,
      now
    )) return;
  }
  if (doc["expression"].is<const char *>()) {
    if (!handleHttpMoodName(
      doc["expression"].as<const char *>(),
      jsonMilliseconds(doc["duration_ms"], jsonMs(doc["duration"], API_DEFAULT_EXPR_MS)),
      true,
      now
    )) return;
  }
  if (doc["beat"].is<const char *>()) {
    if (!handleHttpBeatName(doc["beat"].as<const char *>(), now)) return;
  }
  if (doc["style"].is<const char *>()) {
    if (!handleHttpStyleName(doc["style"].as<const char *>())) return;
  }
  if (!doc["mouth"].isNull()) {
    if (!handleHttpMouth(doc["mouth"], doc["duration"], now)) return;
  }
  if (!doc["gaze"].isNull()) handleHttpGaze(doc["gaze"], doc["duration"], now);
  if (!doc["flip"].isNull()) handleHttpFlip(doc["flip"]);
  if (jsonBool(doc["blink"], false)) handleHttpBlink(doc, now);
  if (jsonBool(doc["wink"], false)) handleHttpWink(doc, now);

  handleHttpState();
}

void handleHttpMoodEndpoint(bool expressionMode) {
  JsonDocument doc;
  if (!parseBody(doc)) return;
  const uint32_t now = millis();
  const char *name = doc["name"] | (expressionMode ? "auto" : "calm");
  const uint32_t defaultMs = expressionMode ? API_DEFAULT_EXPR_MS : API_DEFAULT_MOOD_MS;
  if (!handleHttpMoodName(
    name,
    jsonMilliseconds(doc["duration_ms"], jsonMs(doc["duration"], defaultMs)),
    expressionMode,
    now
  )) return;
  handleHttpState();
}

void handleHttpBeatEndpoint() {
  JsonDocument doc;
  if (!parseBody(doc)) return;
  if (!handleHttpBeatName(doc["name"] | "", millis())) return;
  handleHttpState();
}

void handleHttpStyleEndpoint() {
  JsonDocument doc;
  if (!parseBody(doc)) return;
  if (!handleHttpStyleName(doc["name"] | "")) return;
  handleHttpState();
}

void handleHttpMouthEndpoint() {
  JsonDocument doc;
  if (!parseBody(doc)) return;
  if (!handleHttpMouth(doc.as<JsonVariantConst>(), doc["duration"], millis())) return;
  handleHttpState();
}

void handleHttpGazeEndpoint() {
  JsonDocument doc;
  if (!parseBody(doc)) return;
  handleHttpGaze(doc["gaze"].isNull() ? JsonVariantConst(doc.as<JsonVariant>()) : JsonVariantConst(doc["gaze"]), doc["duration"], millis());
  handleHttpState();
}

void handleHttpBlinkEndpoint() {
  JsonDocument doc;
  if (server.hasArg("plain") && server.arg("plain").length() > 0 && !parseBody(doc)) return;
  handleHttpBlink(doc, millis());
  handleHttpState();
}

void handleHttpWinkEndpoint() {
  JsonDocument doc;
  if (server.hasArg("plain") && server.arg("plain").length() > 0 && !parseBody(doc)) return;
  handleHttpWink(doc, millis());
  handleHttpState();
}

void handleHttpSleepEndpoint() {
  JsonDocument doc;
  if (server.hasArg("plain") && server.arg("plain").length() > 0 && !parseBody(doc)) return;
  beginMood(Mood::Sleep, millis(), jsonMilliseconds(doc["duration_ms"], jsonMs(doc["duration"], API_DEFAULT_MOOD_MS)), true);
  apiState.gazeOverride = false;
  handleHttpState();
}

void setupHttpRoutes() {
  server.on("/", HTTP_GET, [] {
    sendCors();
    server.send_P(200, "text/html", FACE_UI_HTML);
  });
  server.on("/health", HTTP_GET, [] { sendOk("healthy"); });
  server.on("/state", HTTP_GET, handleHttpState);
  server.on("/wifi", HTTP_GET, handleHttpWifi);

  server.on("/moods", HTTP_GET, [] {
    static const char *const values[] = {
      "calm", "curious", "surprised", "suspicious", "afraid", "angry", "sleepy", "sleep", "goofy",
      "robotic", "wonder", "glitchy", "happy", "delighted", "bashful", "bored", "focused",
      "confused", "proud", "mischief", "affection"
    };
    listValues("moods", values, sizeof(values) / sizeof(values[0]));
  });
  server.on("/emotions", HTTP_GET, [] {
    static const char *const values[] = {
      "random", "neutral", "calm", "curious", "surprised", "suspicious", "afraid", "angry", "sleepy",
      "sleep", "goofy", "robotic", "wonder", "glitchy", "happy", "delighted", "bashful", "bored",
      "focused", "confused", "proud", "mischief", "affection"
    };
    listValues("emotions", values, sizeof(values) / sizeof(values[0]));
  });
  server.on("/beats", HTTP_GET, [] {
    static const char *const values[] = {
      "slow_smile", "affection", "inspect", "thoughtful", "daydream", "mischief", "confused",
      "focus_lock", "double_take", "goofy", "drowsy", "robot_scan", "wary", "startle"
    };
    listValues("beats", values, sizeof(values) / sizeof(values[0]));
  });
  server.on("/styles", HTTP_GET, [] {
    static const char *const values[] = {"friendly", "classic", "cartoony", "robot", "sinister", "sleepy"};
    listValues("styles", values, sizeof(values) / sizeof(values[0]));
  });
  server.on("/mouth_shapes", HTTP_GET, [] {
    static const char *const values[] = {
      "neutral", "smile", "smirk_left", "smirk_right", "open", "wide", "frown", "grimace", "sneer", "sleep"
    };
    listValues("mouth_shapes", values, sizeof(values) / sizeof(values[0]));
  });
  server.on("/mouth_styles", HTTP_GET, [] {
    static const char *const values[] = {"human", "robot"};
    listValues("mouth_styles", values, sizeof(values) / sizeof(values[0]));
  });

  server.on("/control", HTTP_POST, handleHttpControl);
  server.on("/release", HTTP_POST, handleHttpRelease);
  server.on("/mood", HTTP_POST, [] { handleHttpMoodEndpoint(false); });
  server.on("/emotion", HTTP_POST, [] { handleHttpMoodEndpoint(false); });
  server.on("/expression", HTTP_POST, [] { handleHttpMoodEndpoint(true); });
  server.on("/beat", HTTP_POST, handleHttpBeatEndpoint);
  server.on("/style", HTTP_POST, handleHttpStyleEndpoint);
  server.on("/mouth", HTTP_POST, handleHttpMouthEndpoint);
  server.on("/gaze", HTTP_POST, handleHttpGazeEndpoint);
  server.on("/blink", HTTP_POST, handleHttpBlinkEndpoint);
  server.on("/wink", HTTP_POST, handleHttpWinkEndpoint);
  server.on("/sleep", HTTP_POST, handleHttpSleepEndpoint);
  server.on("/wifi", HTTP_POST, handleHttpWifi);
  server.on("/ota", HTTP_POST, handleHttpOtaDone, handleHttpOtaUpload);

  server.onNotFound([] {
    if (server.method() == HTTP_OPTIONS) {
      sendCors();
      server.send(204);
      return;
    }
    sendError("not found", 404);
  });
}

void startConfigAccessPoint() {
  const bool started = WiFi.softAP(REACHY_AP_SSID, REACHY_AP_PASSWORD);
  WiFi.setTxPower(WIFI_POWER_8_5dBm);
  WiFi.setSleep(false);
  Serial.printf("WiFi AP %s: %s\n", started ? "started" : "FAILED", REACHY_AP_SSID);
  Serial.print("WiFi AP IP: ");
  Serial.println(WiFi.softAPIP());
  Serial.print("Face UI AP URL: http://");
  Serial.print(WiFi.softAPIP());
  Serial.println("/");
}

void setupWiFi() {
#if REACHY_WIFI_ENABLED
  Serial.println("WiFi setup starting.");
  String savedSsid;
  String savedPassword;
  loadSavedWifi(savedSsid, savedPassword);
  const char *stationSsid = savedSsid.length() > 0 ? savedSsid.c_str() : REACHY_WIFI_SSID;
  const char *stationPassword = savedSsid.length() > 0 ? savedPassword.c_str() : REACHY_WIFI_PASSWORD;
  bool accessPointStarted = false;
  Serial.printf("WiFi station credentials: %s\n", strlen(stationSsid) > 0 ? "configured" : "not configured");

  if (strlen(stationSsid) > 0) {
#if REACHY_AP_ALWAYS_ON
    Serial.println("Starting AP+station mode.");
    WiFi.mode(WIFI_AP_STA);
    WiFi.setSleep(false);
    startConfigAccessPoint();
    accessPointStarted = true;
#else
    Serial.println("Starting station mode.");
    WiFi.mode(WIFI_STA);
#endif
    WiFi.setHostname(REACHY_HOSTNAME);
    WiFi.begin(stationSsid, stationPassword);
    Serial.printf("Connecting to WiFi SSID %s", stationSsid);
    const uint32_t start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 12000) {
      delay(250);
      Serial.print(".");
    }
    Serial.println();
    if (WiFi.status() == WL_CONNECTED) {
#if REACHY_AP_ALWAYS_ON
      WiFi.setSleep(false);
#else
      WiFi.setSleep(true);
#endif
      WiFi.setTxPower(WIFI_POWER_8_5dBm);
      Serial.print("WiFi IP: ");
      Serial.println(WiFi.localIP());
      Serial.print("Face UI URL: http://");
      Serial.print(WiFi.localIP());
      Serial.println("/");
      if (MDNS.begin(REACHY_HOSTNAME)) {
        MDNS.addService("http", "tcp", 80);
        Serial.printf("mDNS URL: http://%s.local/\n", REACHY_HOSTNAME);
      } else {
        Serial.println("mDNS start failed");
      }
      return;
    }
  }

  if (!accessPointStarted) {
    WiFi.mode(WIFI_AP);
    startConfigAccessPoint();
  } else {
    Serial.println("LAN WiFi not connected; setup AP remains available.");
  }
#else
  WiFi.mode(WIFI_OFF);
  Serial.println("WiFi disabled (REACHY_WIFI_ENABLED=0)");
#endif
}

void pollSerialApi() {
  while (Serial.available() > 0) {
    const char c = char(Serial.read());
    if (c == '\r') continue;

    if (c == '\n') {
      apiState.line[apiState.lineLen] = '\0';
      handleApiLine(apiState.line);
      apiState.lineLen = 0;
      apiState.line[0] = '\0';
      continue;
    }

    if (c == '\b' || c == 127) {
      if (apiState.lineLen > 0) --apiState.lineLen;
      continue;
    }

    if (apiState.lineLen < API_LINE_MAX - 1) {
      apiState.line[apiState.lineLen++] = c;
    } else {
      apiState.lineLen = 0;
      apiState.line[0] = '\0';
      Serial.println("ERR line too long");
    }
  }
}

void updateBehavior(uint32_t now) {
  const float dt = lastUpdate == 0 ? 16.0f : float(now - lastUpdate);
  lastUpdate = now;
  updateMood(now);
  updateMouth(now);
  if (currentMood(now) == Mood::Sleep) return;
  updateIdleDirector(now);
  updateGaze(now);
  updateBlink(now);
  updatePupil(dt, now);
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(150);
  randomSeed(esp_random());

  if (frame.getBuffer() == nullptr) {
    Serial.println("Frame buffer allocation failed.");
    while (true) delay(1000);
  }

  pinMode(PIN_FLIP_BUTTON, INPUT_PULLUP);
  deselectDisplayBus();

#if !USE_SOFTWARE_SPI
  leftSpi.begin(PIN_L_SCLK, -1, PIN_L_MOSI, PIN_L_CS);
#if !REACHY_SHARE_EYE_SPI
  rightSpi.begin(PIN_R_SCLK, -1, PIN_R_MOSI, PIN_R_CS);
#endif
#endif

  resetSharedDisplaysIfNeeded();
  loadFacePreferences();
  initDisplay(leftTft, LEFT_ROTATION);
  initDisplay(rightTft, RIGHT_ROTATION);
#if REACHY_HAS_MOUTH
  initDisplay(mouthTft, MOUTH_ROTATION);
#endif
#if REACHY_HAS_AUX_DISPLAY
  initAuxDisplay(auxTft, AUX_ROTATION);
#endif
  applyDisplayOrientation();
  setupWiFi();
  setupHttpRoutes();
  server.begin();

  const uint32_t now = millis();
  moodState.started = now;
  moodState.next = now + moodHoldMs(moodState.to);
  gazeState.next = now + 350;
  blinkState.next = now + uint32_t(randf(900.0f, 2200.0f));
  scheduleNextIdleBeat(now, true);

  Serial.println("Reachy ESP32 eyes online. Type 'help' for API commands.");
  Serial.println("HTTP API online. Open /health or /state on the printed IP address.");
}

void loop() {
  const uint32_t now = millis();
  pollFlipButton(now);
  pollSerialApi();
  server.handleClient();
  if (restartAt != 0 && deadlineReached(now, restartAt)) {
    Serial.println("Restarting to apply WiFi settings.");
    delay(50);
    ESP.restart();
  }
  updateBehavior(now);

  if (now - lastFrame < 33) {
    delay(1);
    return;
  }
  lastFrame = now;

  const bool rightFirst = blinkState.active && !blinkState.leftLeads;
  if (apiState.eyesFlipped) {
    if (rightFirst) {
      renderEye(false, now);
      pushFrame(leftTft);

      renderEye(true, now);
      pushFrame(rightTft);
    } else {
      renderEye(true, now);
      pushFrame(rightTft);

      renderEye(false, now);
      pushFrame(leftTft);
    }
  } else if (rightFirst) {
    renderEye(false, now);
    pushFrame(rightTft);

    renderEye(true, now);
    pushFrame(leftTft);
  } else {
    renderEye(true, now);
    pushFrame(leftTft);

    renderEye(false, now);
    pushFrame(rightTft);
  }
#if REACHY_HAS_MOUTH && !(REACHY_HAS_AUX_DISPLAY && (REACHY_AUX_ROLE == REACHY_AUX_ROLE_MOUTH_ONLY))
  renderMouth(now);
  pushFrame(mouthTft);
#endif
#if REACHY_HAS_AUX_DISPLAY
  renderAuxDisplay(now);
#endif
#if REACHY_MOUTH_STATUS_DISPLAY
  renderMouthStatusDisplay(now);
#endif
}

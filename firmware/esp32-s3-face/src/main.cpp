#include <Arduino.h>
#include <ArduinoJson.h>
#include <Arduino_GFX_Library.h>
#include <ArduinoOTA.h>
#include <ESPmDNS.h>
#include <SD.h>
#include <SPI.h>
#include <WebServer.h>
#include <WiFi.h>
#include <Wire.h>
#include <ctype.h>
#include <esp_system.h>
#include <math.h>
#include "esp_camera.h"
#include "face_brain_config.h"

namespace {

Arduino_DataBus *displayBus = new Arduino_ESP32SPI(
    FACE_LCD_DC, FACE_LCD_CS, FACE_LCD_SCLK, FACE_LCD_MOSI, FACE_LCD_MISO);
Arduino_GFX *display = new Arduino_ST7789(
    displayBus, FACE_LCD_RST, FACE_LCD_ROTATION, true, FACE_LCD_WIDTH, FACE_LCD_HEIGHT);
Arduino_Canvas *mouthFrame = new Arduino_Canvas(
    FACE_LCD_WIDTH, FACE_LCD_HEIGHT, display);
Arduino_Canvas *eyeFrame = new Arduino_Canvas(
    FACE_EYE_WIDTH, FACE_EYE_HEIGHT, display);

#if FACE_EXTERNAL_EYES_ENABLED
Arduino_DataBus *leftEyeBus = new Arduino_ESP32SPI(
    FACE_EYE_DC, FACE_EYE_LEFT_CS, FACE_EYE_SCLK, FACE_EYE_MOSI, FACE_EYE_MISO, HSPI);
Arduino_DataBus *rightEyeBus = new Arduino_ESP32SPI(
    FACE_EYE_DC, FACE_EYE_RIGHT_CS, FACE_EYE_SCLK, FACE_EYE_MOSI, FACE_EYE_MISO, HSPI);
Arduino_GFX *leftEye = new Arduino_GC9A01(
    leftEyeBus, GFX_NOT_DEFINED, FACE_EYE_ROTATION, true);
Arduino_GFX *rightEye = new Arduino_GC9A01(
    rightEyeBus, GFX_NOT_DEFINED, FACE_EYE_ROTATION, true);
#endif

SPIClass sdSpi(FSPI);
WebServer server(80);

bool displayOk = false;
bool mouthFrameOk = false;
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

constexpr int16_t EYE_CX = FACE_EYE_WIDTH / 2;
constexpr int16_t EYE_CY = FACE_EYE_HEIGHT / 2;
constexpr int16_t EYE_SCLERA_RX = FACE_EYE_WIDTH / 2 - 5;
constexpr int16_t EYE_SCLERA_RY = FACE_EYE_HEIGHT / 2 - 12;
constexpr float EYE_SCALE = float(FACE_EYE_WIDTH) / 240.0f;
constexpr float APERTURE_HALF_W = float(EYE_SCLERA_RX);
constexpr float PI_F = 3.14159265358979323846f;
constexpr float EYE_BASELINE_MM = 64.0f;
constexpr float MAX_YAW = 24.0f * PI_F / 180.0f;
constexpr float MAX_PITCH = 18.0f * PI_F / 180.0f;
constexpr float MAX_GAZE_X_PX = float(FACE_EYE_WIDTH) * 0.23f;
constexpr float MAX_GAZE_Y_PX = float(FACE_EYE_HEIGHT) * 0.18f;
constexpr float API_NORMALIZED_GAZE_X_MM = 190.0f;
constexpr float API_NORMALIZED_GAZE_Y_MM = 110.0f;
constexpr float API_NORMALIZED_GAZE_Z_MM = 360.0f;
constexpr float API_NORMALIZED_GAZE_X_SIGN = -1.0f;
constexpr float API_NORMALIZED_GAZE_Y_SIGN = -1.0f;
constexpr uint32_t API_DEFAULT_MOOD_MS = 3500;
constexpr uint32_t API_DEFAULT_EXPR_MS = 8000;
constexpr uint32_t API_DEFAULT_GAZE_HOLD_MS = 1200;
constexpr uint32_t API_DEFAULT_GAZE_MOVE_MS = 160;
constexpr uint32_t API_DEFAULT_MOUTH_MS = 2500;
constexpr uint32_t MOUTH_TRANSITION_MS = 220;
constexpr uint32_t MOUTH_TALK_ATTACK_MS = 90;
constexpr uint32_t MOUTH_TALK_RELEASE_MS = 160;
constexpr uint32_t MOUTH_FRAME_MS = 80;
constexpr uint32_t EYE_FRAME_MS = 50;

uint16_t rgb(uint8_t r, uint8_t g, uint8_t b)
{
  return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
}

uint8_t chanR(uint16_t c) { return (c >> 8) & 0xF8; }
uint8_t chanG(uint16_t c) { return (c >> 3) & 0xFC; }
uint8_t chanB(uint16_t c) { return (c << 3) & 0xF8; }

float clampf(float v, float low, float high)
{
  if (v < low) return low;
  if (v > high) return high;
  return v;
}

int16_t scaledEye(float pixels)
{
  const int16_t scaled = int16_t(pixels * EYE_SCALE);
  return scaled < 1 ? 1 : scaled;
}

uint16_t mixColor(uint16_t a, uint16_t b, float t)
{
  t = clampf(t, 0.0f, 1.0f);
  const float u = 1.0f - t;
  return rgb(uint8_t(chanR(a) * u + chanR(b) * t),
             uint8_t(chanG(a) * u + chanG(b) * t),
             uint8_t(chanB(a) * u + chanB(b) * t));
}

float randf(float low, float high)
{
  return low + (high - low) * (float(random(0, 10001)) / 10000.0f);
}

float smoothstep(float t)
{
  t = clampf(t, 0.0f, 1.0f);
  return t * t * (3.0f - 2.0f * t);
}

float easeOutCubic(float t)
{
  t = clampf(t, 0.0f, 1.0f);
  const float u = 1.0f - t;
  return 1.0f - u * u * u;
}

bool deadlineReached(uint32_t now, uint32_t deadline)
{
  return deadline != 0 && int32_t(now - deadline) >= 0;
}

bool equalsIgnoreCase(const char *a, const char *b)
{
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

Vec3 lerpVec3(const Vec3 &a, const Vec3 &b, float t)
{
  return {a.x + (b.x - a.x) * t,
          a.y + (b.y - a.y) * t,
          a.z + (b.z - a.z) * t};
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

enum class EyeRenderStyle : uint8_t {
  Friendly,
  Classic,
  Cartoony,
  Robot,
  Sinister,
  Sleepy
};

enum class MouthStyle : uint8_t {
  Human,
  Robot
};

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
};

struct MouthPose {
  MouthPose() = default;
  MouthPose(float openValue, float widthValue, float curveValue, float skewValue,
            float teethValue, float tensionValue, float slantValue = 0.0f, float upperLiftValue = 0.0f)
    : open(openValue),
      width(widthValue),
      curve(curveValue),
      skew(skewValue),
      teeth(teethValue),
      tension(tensionValue),
      slant(slantValue),
      upperLift(upperLiftValue) {}

  float open = 0.0f;
  float width = 0.0f;
  float curve = 0.0f;
  float skew = 0.0f;
  float teeth = 0.0f;
  float tension = 0.0f;
  float slant = 0.0f;
  float upperLift = 0.0f;
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

struct IdleDirector {
  bool active = false;
  IdleBeat beat = IdleBeat::None;
  uint8_t step = 0;
  uint32_t nextStep = 0;
  uint32_t nextBeat = 0;
  float side = 1.0f;
  Vec3 anchor = {0.0f, 0.0f, 520.0f};
};

MoodState moodState;
GazeState gazeState;
BlinkState blinkState;
ApiState apiState;
MouthState mouthState;
IdleDirector idleDirector;
EyeRenderStyle eyeRenderStyle = EyeRenderStyle::Robot;
float pupilRadius = 15.5f;
uint32_t lastUpdate = 0;
uint32_t lastEyeFrame = 0;
uint32_t lastMouthFrame = 0;

const char FACE_UI_HTML[] PROGMEM = R"FACEUI(
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Robot 790 ESP32-S3 Face</title>
<style>
:root{color-scheme:dark;--bg:#08090d;--panel:#141720;--panel2:#10131a;--line:#2a3140;--text:#eef2f6;--muted:#9aa6b2;--accent:#55c7ff;--ok:#68d391;--warn:#f6ad55;--bad:#fc8181}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.35 system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:1100px;margin:0 auto;padding:16px}
header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}h1{font-size:20px;margin:0 0 4px}p{margin:0;color:var(--muted)}button,select,input{font:inherit}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(255px,1fr));gap:12px}.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px}.card h2{font-size:15px;margin:0 0 10px}
.row{display:grid;grid-template-columns:95px 1fr;align-items:center;gap:8px;margin:8px 0}.row label{color:var(--muted)}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
button{border:1px solid var(--line);background:#202633;color:var(--text);border-radius:7px;padding:7px 10px;cursor:pointer}button:hover{border-color:var(--accent)}button.primary{background:#0f3f5b;border-color:#217aa8}button.warn{background:#46301a;border-color:#8a5c24}
select,input{width:100%;min-width:0;border:1px solid var(--line);background:var(--panel2);color:var(--text);border-radius:7px;padding:7px}input[type=range]{padding:0}.status{white-space:pre-wrap;background:#07080b;border:1px solid var(--line);border-radius:8px;padding:10px;min-height:180px;color:#cbd5df;font:12px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace;overflow:auto}
.pill{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:5px 9px;color:var(--muted)}.dot{width:8px;height:8px;border-radius:50%;background:var(--warn)}.dot.ok{background:var(--ok)}.dot.bad{background:var(--bad)}
</style>
</head>
<body>
<main>
<header>
<div><h1>Robot 790 ESP32-S3 Face</h1><p>Direct ESP32-S3 test panel for portrait face, gaze, mouth, sensors, and idle beats.</p></div>
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
<h2>Status</h2>
<div id="status" class="status">loading...</div>
<div class="actions"><button id="refresh">Refresh</button></div>
</div>
</section>
</main>
<script>
const fallback={style:["friendly","classic","cartoony","robot","sinister","sleepy"],mood:["calm","curious","surprised","suspicious","afraid","angry","sleepy","sleep","goofy","robotic","wonder","glitchy","happy","delighted","bashful","bored","focused","confused","proud","mischief","affection"],beat:["slow_smile","affection","inspect","thoughtful","daydream","mischief","confused","focus_lock","double_take","goofy","drowsy","robot_scan","wary","startle"],mouthStyle:["human","robot"],mouthShape:["neutral","smile","smirk_left","smirk_right","open","wide","frown","grimace","sneer","sleep"]};
const $=id=>document.getElementById(id);
function fill(id,values){$(id).innerHTML=values.map(v=>'<option value="'+v+'">'+v+'</option>').join("")}
async function values(path,key,id){try{const r=await fetch(path);const j=await r.json();fill(id,j[key]||fallback[id])}catch(e){fill(id,fallback[id])}}
async function post(path,payload={}){const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const j=await r.json().catch(()=>({ok:false,error:"bad json"}));if(!r.ok||j.ok===false)throw new Error(j.error||r.statusText);render(j);return j}
function number(id){return Number($(id).value)}
function render(j){if(!j||!j.ok)return;const mouth=j.mouth||{};$("dot").className="dot ok";$("summary").textContent=(j.mood||"?")+" / "+(j.style||"?")+" / "+(mouth.shape||"?");$("status").textContent=JSON.stringify(j,null,2)}
async function refresh(){try{const r=await fetch("/state");render(await r.json())}catch(e){$("dot").className="dot bad";$("summary").textContent=e.message;$("status").textContent=e.stack||e.message}}
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
else if(b.id==="refresh")await refresh();
}catch(err){$("dot").className="dot bad";$("summary").textContent=err.message;$("status").textContent=err.stack||err.message}});
async function init(){await Promise.all([values("/styles","styles","style"),values("/moods","moods","mood"),values("/beats","beats","beat"),values("/mouth_styles","mouth_styles","mouthStyle"),values("/mouth_shapes","mouth_shapes","mouthShape")]);await refresh();setInterval(refresh,2500)}
init();
</script>
</body>
</html>
)FACEUI";

const char *moodName(Mood mood)
{
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

bool parseMoodName(const char *text, Mood &mood)
{
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

const char *eyeStyleName(EyeRenderStyle style)
{
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

bool parseEyeStyleName(const char *text, EyeRenderStyle &style)
{
  if (equalsIgnoreCase(text, "friendly") || equalsIgnoreCase(text, "default")) style = EyeRenderStyle::Friendly;
  else if (equalsIgnoreCase(text, "classic")) style = EyeRenderStyle::Classic;
  else if (equalsIgnoreCase(text, "cartoony") || equalsIgnoreCase(text, "cartoon")) style = EyeRenderStyle::Cartoony;
  else if (equalsIgnoreCase(text, "robot") || equalsIgnoreCase(text, "dot") || equalsIgnoreCase(text, "big_dot")) style = EyeRenderStyle::Robot;
  else if (equalsIgnoreCase(text, "sinister") || equalsIgnoreCase(text, "red")) style = EyeRenderStyle::Sinister;
  else if (equalsIgnoreCase(text, "sleepy") || equalsIgnoreCase(text, "steel")) style = EyeRenderStyle::Sleepy;
  else return false;
  return true;
}

const char *mouthStyleName(MouthStyle style)
{
  switch (style) {
    case MouthStyle::Robot: return "robot";
    case MouthStyle::Human:
    default: return "human";
  }
}

bool parseMouthStyleName(const char *text, MouthStyle &style)
{
  if (equalsIgnoreCase(text, "human") || equalsIgnoreCase(text, "humanistic") || equalsIgnoreCase(text, "790")) {
    style = MouthStyle::Human;
  } else if (equalsIgnoreCase(text, "robot") || equalsIgnoreCase(text, "simple")) {
    style = MouthStyle::Robot;
  } else {
    return false;
  }
  return true;
}

const char *mouthShapeName(MouthShape shape)
{
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

bool parseMouthShapeName(const char *text, MouthShape &shape)
{
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

MouthPose mouthPoseFor(MouthShape shape)
{
  switch (shape) {
    case MouthShape::Smile: return {0.16f, 0.82f, 0.86f, 0.05f, 0.0f, 0.10f, 0.07f, 0.0f};
    case MouthShape::SmirkLeft: return {0.14f, 0.66f, 0.82f, -0.98f, 0.05f, 0.52f, -0.70f, -0.28f};
    case MouthShape::SmirkRight: return {0.14f, 0.66f, 0.82f, 0.98f, 0.05f, 0.52f, 0.70f, 0.28f};
    case MouthShape::Open: return {0.62f, 0.48f, -0.04f, -0.04f, 0.0f, 0.14f, -0.05f, 0.0f};
    case MouthShape::Wide: return {0.92f, 0.58f, 0.08f, 0.04f, 0.16f, 0.24f, 0.06f, 0.0f};
    case MouthShape::Frown: return {0.10f, 0.56f, -0.88f, -0.04f, 0.0f, 0.36f, -0.08f, 0.0f};
    case MouthShape::Grimace: return {0.24f, 0.84f, -0.18f, 0.03f, 1.0f, 0.98f, 0.03f, 0.0f};
    case MouthShape::Sneer: return {0.18f, 0.62f, -0.30f, 0.66f, 0.72f, 0.78f, 0.72f, 0.92f};
    case MouthShape::Sleep: return {0.03f, 0.42f, -0.12f, 0.0f, 0.0f, 0.08f, 0.0f, 0.0f};
    case MouthShape::Neutral:
    default: return {0.07f, 0.54f, 0.02f, -0.03f, 0.0f, 0.16f, 0.02f, 0.0f};
  }
}

MouthPose mixMouthPose(const MouthPose &a, const MouthPose &b, float t)
{
  return {
    a.open + (b.open - a.open) * t,
    a.width + (b.width - a.width) * t,
    a.curve + (b.curve - a.curve) * t,
    a.skew + (b.skew - a.skew) * t,
    a.teeth + (b.teeth - a.teeth) * t,
    a.tension + (b.tension - a.tension) * t,
    a.slant + (b.slant - a.slant) * t,
    a.upperLift + (b.upperLift - a.upperLift) * t
  };
}

MouthShape mouthShapeForMood(Mood mood)
{
  switch (mood) {
    case Mood::Happy:
    case Mood::Delighted:
    case Mood::Affection:
    case Mood::Proud:
    case Mood::Bashful:
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
    case Mood::Glitchy:
      return MouthShape::Wide;
    case Mood::Bored:
    case Mood::Curious:
    case Mood::Calm:
    default:
      return MouthShape::Neutral;
  }
}

LidPose poseFor(Mood mood, bool leftEye)
{
  const float inward = leftEye ? 1.0f : -1.0f;
  switch (mood) {
    case Mood::Curious: return {53.0f, 201.0f, 25.0f, 17.0f, -5.0f * inward, 2.0f * inward, 16.5f, 0.8f};
    case Mood::Surprised: return {31.0f, 217.0f, 18.0f, 12.0f, 0.0f, 0.0f, 18.5f, 1.2f};
    case Mood::Suspicious: return {88.0f, 179.0f, 20.0f, 14.0f, -12.0f * inward, 4.0f * inward, 13.5f, 0.35f};
    case Mood::Afraid: return {35.0f, 214.0f, 21.0f, 12.0f, 4.0f * inward, 0.0f, 18.5f, 1.8f};
    case Mood::Angry: return {82.0f, 184.0f, 18.0f, 15.0f, 23.0f * inward, -2.0f * inward, 14.5f, 0.45f};
    case Mood::Sleepy: return {103.0f, 169.0f, 13.0f, 10.0f, -3.0f * inward, 0.0f, 13.0f, 0.12f};
    case Mood::Sleep: return {126.0f, 126.0f, 0.0f, 0.0f, 0.0f, 0.0f, 13.0f, 0.0f};
    case Mood::Goofy: return {52.0f, 204.0f, 31.0f, 18.0f, 12.0f * inward, -8.0f * inward, 16.0f, 1.15f};
    case Mood::Robotic: return {58.0f, 198.0f, 9.0f, 8.0f, 0.0f, 0.0f, 14.5f, 0.0f};
    case Mood::Wonder: return {37.0f, 212.0f, 27.0f, 15.0f, -2.0f * inward, 1.0f * inward, 17.5f, 0.55f};
    case Mood::Glitchy: return {63.0f, 190.0f, 8.0f, 8.0f, 18.0f * inward, -16.0f * inward, 15.0f, 2.2f};
    case Mood::Happy: return {82.0f, 187.0f, 36.0f, 25.0f, -4.0f * inward, -3.0f * inward, 16.8f, 0.25f};
    case Mood::Delighted: return {42.0f, 214.0f, 35.0f, 19.0f, -7.0f * inward, 4.0f * inward, 18.8f, 1.05f};
    case Mood::Bashful: return {76.0f, 188.0f, 32.0f, 24.0f, -10.0f * inward, 7.0f * inward, 16.0f, 0.18f};
    case Mood::Bored: return {101.0f, 171.0f, 19.0f, 11.0f, -1.0f * inward, 0.0f, 12.4f, 0.05f};
    case Mood::Focused: return {72.0f, 190.0f, 15.0f, 11.0f, 4.0f * inward, -2.0f * inward, 13.2f, 0.08f};
    case Mood::Confused: return leftEye ? LidPose{50.0f, 201.0f, 25.0f, 17.0f, -12.0f, 4.0f, 16.4f, 0.65f}
                                        : LidPose{82.0f, 184.0f, 21.0f, 14.0f, -6.0f, 2.0f, 15.2f, 0.45f};
    case Mood::Proud: return {86.0f, 184.0f, 28.0f, 18.0f, 7.0f * inward, -4.0f * inward, 15.2f, 0.12f};
    case Mood::Mischief: return {89.0f, 181.0f, 22.0f, 15.0f, -18.0f * inward, 8.0f * inward, 14.1f, 0.22f};
    case Mood::Affection: return {70.0f, 195.0f, 42.0f, 26.0f, -3.0f * inward, 2.0f * inward, 17.9f, 0.16f};
    case Mood::Calm:
    default: return {64.0f, 194.0f, 27.0f, 18.0f, 0.0f, 0.0f, 15.5f, 0.45f};
  }
}

LidPose mixPose(const LidPose &a, const LidPose &b, float t)
{
  return {a.topY + (b.topY - a.topY) * t,
          a.bottomY + (b.bottomY - a.bottomY) * t,
          a.topCurve + (b.topCurve - a.topCurve) * t,
          a.bottomCurve + (b.bottomCurve - a.bottomCurve) * t,
          a.topSlant + (b.topSlant - a.topSlant) * t,
          a.bottomSlant + (b.bottomSlant - a.bottomSlant) * t,
          a.pupilRadius + (b.pupilRadius - a.pupilRadius) * t,
          a.jitter + (b.jitter - a.jitter) * t};
}

Mood chooseMood()
{
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

uint32_t moodHoldMs(Mood mood)
{
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

Vec3 pickGazeTarget(Mood mood)
{
  switch (mood) {
    case Mood::Curious: return {randf(-145.0f, 145.0f), randf(-65.0f, 80.0f), randf(220.0f, 620.0f)};
    case Mood::Surprised: return {randf(-22.0f, 22.0f), randf(-8.0f, 28.0f), randf(210.0f, 330.0f)};
    case Mood::Suspicious: return {randf(-85.0f, 85.0f), randf(-35.0f, 20.0f), randf(390.0f, 820.0f)};
    case Mood::Afraid: return {randf(-36.0f, 36.0f), randf(5.0f, 55.0f), randf(170.0f, 300.0f)};
    case Mood::Angry: return {randf(-45.0f, 45.0f), randf(-30.0f, 18.0f), randf(280.0f, 560.0f)};
    case Mood::Sleepy: return {randf(-32.0f, 32.0f), randf(-70.0f, -24.0f), randf(650.0f, 1200.0f)};
    case Mood::Goofy: return {randf(-155.0f, 155.0f), randf(-88.0f, 86.0f), randf(170.0f, 460.0f)};
    case Mood::Robotic: return {float((random(0, 5) - 2) * 60), float((random(0, 3) - 1) * 48), randf(360.0f, 780.0f)};
    case Mood::Wonder: return {randf(-72.0f, 72.0f), randf(18.0f, 92.0f), randf(210.0f, 480.0f)};
    case Mood::Glitchy: return {randf(-150.0f, 150.0f), randf(-80.0f, 80.0f), randf(150.0f, 900.0f)};
    case Mood::Happy: return {randf(-54.0f, 54.0f), randf(-4.0f, 54.0f), randf(360.0f, 760.0f)};
    case Mood::Delighted: return {randf(-76.0f, 76.0f), randf(12.0f, 78.0f), randf(190.0f, 430.0f)};
    case Mood::Bashful: return {randf(-96.0f, 96.0f), randf(-82.0f, -24.0f), randf(420.0f, 820.0f)};
    case Mood::Bored: return {randf(-34.0f, 34.0f), randf(-76.0f, -36.0f), randf(780.0f, 1300.0f)};
    case Mood::Focused: return {randf(-18.0f, 18.0f), randf(-8.0f, 20.0f), randf(230.0f, 420.0f)};
    case Mood::Confused: return {randf(-118.0f, 118.0f), randf(-38.0f, 64.0f), randf(260.0f, 680.0f)};
    case Mood::Proud: return {randf(-42.0f, 42.0f), randf(36.0f, 88.0f), randf(540.0f, 980.0f)};
    case Mood::Mischief: return {randf(-138.0f, 138.0f), randf(-24.0f, 32.0f), randf(320.0f, 700.0f)};
    case Mood::Affection: return {randf(-26.0f, 26.0f), randf(8.0f, 52.0f), randf(260.0f, 520.0f)};
    case Mood::Calm:
    default:
      return random(0, 100) < 45
        ? Vec3{randf(-42.0f, 42.0f), randf(-24.0f, 42.0f), randf(560.0f, 1100.0f)}
        : Vec3{randf(-118.0f, 118.0f), randf(-50.0f, 66.0f), randf(360.0f, 920.0f)};
  }
}

uint32_t gazeHoldFor(Mood mood)
{
  switch (mood) {
    case Mood::Curious: return uint32_t(randf(260.0f, 1300.0f));
    case Mood::Surprised: return uint32_t(randf(110.0f, 420.0f));
    case Mood::Afraid: return uint32_t(randf(120.0f, 520.0f));
    case Mood::Sleepy: return uint32_t(randf(1300.0f, 4200.0f));
    case Mood::Robotic: return uint32_t(randf(360.0f, 980.0f));
    case Mood::Glitchy: return uint32_t(randf(70.0f, 260.0f));
    case Mood::Bored: return uint32_t(randf(2600.0f, 6200.0f));
    case Mood::Focused: return uint32_t(randf(1800.0f, 5200.0f));
    case Mood::Affection: return uint32_t(randf(2600.0f, 6200.0f));
    default: return uint32_t(randf(650.0f, 2600.0f));
  }
}

uint32_t gazeMoveFor(Mood mood)
{
  switch (mood) {
    case Mood::Robotic: return uint32_t(randf(35.0f, 80.0f));
    case Mood::Glitchy: return uint32_t(randf(24.0f, 80.0f));
    case Mood::Surprised:
    case Mood::Afraid: return uint32_t(randf(80.0f, 160.0f));
    case Mood::Sleepy: return uint32_t(randf(450.0f, 950.0f));
    case Mood::Bored:
    case Mood::Bashful: return uint32_t(randf(520.0f, 1200.0f));
    default: return uint32_t(randf(130.0f, 360.0f));
  }
}

float currentMoodBlend(uint32_t now)
{
  return smoothstep(float(now - moodState.started) / float(moodState.duration));
}

Mood currentMood(uint32_t now)
{
  return currentMoodBlend(now) >= 1.0f ? moodState.to : moodState.from;
}

LidPose blendedPose(bool leftEye, uint32_t now)
{
  return mixPose(poseFor(moodState.from, leftEye), poseFor(moodState.to, leftEye), currentMoodBlend(now));
}

void scheduleNextIdleBeat(uint32_t now, bool soon = false);

void beginMood(Mood mood, uint32_t now, uint32_t holdMs, bool apiOverride)
{
  moodState.from = mood == Mood::Sleep ? Mood::Sleep : currentMood(now);
  moodState.to = mood;
  moodState.started = now;
  moodState.duration = mood == Mood::Sleep ? 1 : (apiOverride ? 320 : uint32_t(randf(500.0f, 1150.0f)));
  moodState.next = now + moodState.duration + (holdMs == 0 ? 600000UL : holdMs);
  apiState.moodOverride = apiOverride;
  apiState.moodUntil = (apiOverride && holdMs != 0) ? now + moodState.duration + holdMs : 0;
  if (mood == Mood::Surprised || mood == Mood::Afraid || mood == Mood::Sleepy ||
      mood == Mood::Glitchy || mood == Mood::Delighted || mood == Mood::Confused ||
      mood == Mood::Mischief) {
    blinkState.next = min(blinkState.next, now + uint32_t(randf(150.0f, 520.0f)));
  }
}

void beginGaze(const Vec3 &target, uint32_t now, uint32_t holdMs, uint32_t moveMs, bool apiOverride)
{
  gazeState.from = gazeState.now;
  gazeState.to = target;
  gazeState.started = now;
  gazeState.duration = moveMs == 0 ? 1 : moveMs;
  gazeState.next = now + gazeState.duration + (holdMs == 0 ? 600000UL : holdMs);
  apiState.gazeOverride = apiOverride;
  apiState.gazeUntil = (apiOverride && holdMs != 0) ? now + gazeState.duration + holdMs : 0;
}

void beginExpression(Mood mood, uint32_t now, uint32_t holdMs, bool apiOverride)
{
  if (idleDirector.active) scheduleNextIdleBeat(now, true);
  beginMood(mood, now, holdMs, apiOverride);
  if (mood != Mood::Sleep) beginGaze(pickGazeTarget(mood), now, holdMs, gazeMoveFor(mood), apiOverride);
  else apiState.gazeOverride = false;
}

void updateMood(uint32_t now)
{
  if (apiState.moodOverride && deadlineReached(now, apiState.moodUntil)) {
    apiState.moodOverride = false;
    moodState.next = now;
  }
  if (apiState.moodOverride || !apiState.idleEnabled || idleDirector.active || now < moodState.next) return;
  const Mood nextMood = chooseMood();
  beginMood(nextMood, now, moodHoldMs(nextMood), false);
}

void startNewGaze(uint32_t now, Mood mood)
{
  beginGaze(pickGazeTarget(mood), now, gazeHoldFor(mood), gazeMoveFor(mood), false);
}

void updateGaze(uint32_t now)
{
  if (apiState.gazeOverride && deadlineReached(now, apiState.gazeUntil)) {
    apiState.gazeOverride = false;
    gazeState.next = now;
  }
  float t = float(now - gazeState.started) / float(gazeState.duration);
  gazeState.now = lerpVec3(gazeState.from, gazeState.to, easeOutCubic(t));
  if (!apiState.gazeOverride && apiState.idleEnabled && !idleDirector.active && now >= gazeState.next) {
    startNewGaze(now, currentMood(now));
  }
  if (now >= gazeState.nextMicro) {
    const LidPose p = blendedPose(true, now);
    gazeState.microX = randf(-p.jitter, p.jitter);
    gazeState.microY = randf(-p.jitter * 0.65f, p.jitter * 0.65f);
    gazeState.nextMicro = now + uint32_t(randf(70.0f, 260.0f));
  }
}

void triggerBlink(uint32_t now, uint32_t durationMs, bool doubleBlink)
{
  const Mood mood = currentMood(now);
  blinkState.active = true;
  blinkState.requestedDouble = doubleBlink;
  blinkState.winkOnly = false;
  blinkState.leftLeads = random(0, 2) == 0;
  blinkState.leadMs = mood == Mood::Robotic ? uint16_t(randf(4.0f, 14.0f))
                    : mood == Mood::Goofy ? uint16_t(randf(45.0f, 115.0f))
                    : uint16_t(randf(10.0f, 46.0f));
  blinkState.started = now;
  blinkState.duration = durationMs < 40 ? 40 : durationMs;
  blinkState.next = now + blinkState.duration + 100;
}

void triggerWink(uint32_t now, bool leftEye, uint32_t durationMs = 280)
{
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

void updateBlink(uint32_t now)
{
  if (!blinkState.active && now >= blinkState.next) {
    const Mood mood = currentMood(now);
    const uint32_t dur = mood == Mood::Sleepy ? uint32_t(randf(260.0f, 520.0f))
                       : mood == Mood::Robotic || mood == Mood::Glitchy ? uint32_t(randf(55.0f, 125.0f))
                       : uint32_t(randf(120.0f, 190.0f));
    triggerBlink(now, dur, false);
  }
  if (!blinkState.active) return;
  if (now - blinkState.started <= blinkState.duration + blinkState.leadMs) return;
  blinkState.active = false;
  if (blinkState.requestedDouble) {
    blinkState.requestedDouble = false;
    blinkState.next = now + uint32_t(randf(85.0f, 150.0f));
    return;
  }
  blinkState.winkOnly = false;
  const Mood mood = currentMood(now);
  blinkState.next = now + (mood == Mood::Sleepy ? uint32_t(randf(700.0f, 1900.0f))
                           : mood == Mood::Bored ? uint32_t(randf(2600.0f, 7600.0f))
                           : uint32_t(randf(1800.0f, 5600.0f)));
}

float blinkClosedForEye(uint32_t now, bool leftEye)
{
  if (!blinkState.active) return 0.0f;
  if (blinkState.winkOnly && leftEye != blinkState.winkLeft) return 0.0f;
  const uint32_t elapsed = now - blinkState.started;
  const uint16_t delayMs = blinkState.winkOnly || leftEye == blinkState.leftLeads ? 0 : blinkState.leadMs;
  if (elapsed < delayMs || elapsed > blinkState.duration + delayMs) return 0.0f;
  const float t = clampf(float(elapsed - delayMs) / float(blinkState.duration), 0.0f, 1.0f);
  if (t < 0.36f) return smoothstep(t / 0.36f);
  if (t < 0.52f) return 1.0f;
  return 1.0f - smoothstep((t - 0.52f) / 0.48f);
}

void updatePupil(float dt, uint32_t now)
{
  const float targetPosePupil = (blendedPose(true, now).pupilRadius + blendedPose(false, now).pupilRadius) * 0.5f;
  const float nearBoost = clampf((420.0f - gazeState.now.z) / 250.0f, 0.0f, 1.0f) * 0.35f;
  const float target = clampf(targetPosePupil + nearBoost, 0.0f, 19.0f);
  pupilRadius += (target - pupilRadius) * clampf(dt * 0.006f, 0.0f, 1.0f);
}

const char *idleBeatName(IdleBeat beat)
{
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

bool parseIdleBeatName(const char *text, IdleBeat &beat)
{
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

void scheduleNextIdleBeat(uint32_t now, bool soon)
{
  idleDirector.active = false;
  idleDirector.beat = IdleBeat::None;
  idleDirector.step = 0;
  idleDirector.nextStep = 0;
  idleDirector.nextBeat = now + (soon ? uint32_t(randf(1400.0f, 3800.0f))
                                      : uint32_t(randf(7200.0f, 19000.0f)));
}

IdleBeat chooseIdleBeat(uint32_t now)
{
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

void startIdleBeat(uint32_t now, IdleBeat beat)
{
  idleDirector.active = true;
  idleDirector.beat = beat;
  idleDirector.step = 0;
  idleDirector.nextStep = now;
  idleDirector.side = random(0, 2) == 0 ? -1.0f : 1.0f;
  idleDirector.anchor = {idleDirector.side * randf(48.0f, 138.0f), randf(-42.0f, 70.0f), randf(280.0f, 680.0f)};
}

void finishIdleBeat(uint32_t now)
{
  gazeState.next = now + uint32_t(randf(350.0f, 1200.0f));
  moodState.next = now + uint32_t(randf(700.0f, 2600.0f));
  scheduleNextIdleBeat(now, false);
}

void directorGaze(const Vec3 &target, uint32_t now, uint32_t holdMs, uint32_t moveMs)
{
  beginGaze(target, now, holdMs, moveMs, false);
}

void updateIdleDirector(uint32_t now)
{
  if (!apiState.idleEnabled || apiState.moodOverride || apiState.gazeOverride || currentMood(now) == Mood::Sleep) {
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
      if (idleDirector.step == 0) { beginMood(Mood::Curious, now, 3300, false); directorGaze(idleDirector.anchor, now, 260, 170); idleDirector.nextStep = now + 330; }
      else if (idleDirector.step == 1) { directorGaze({idleDirector.anchor.x + idleDirector.side * 18.0f, idleDirector.anchor.y + randf(-14.0f, 12.0f), idleDirector.anchor.z}, now, 230, 95); idleDirector.nextStep = now + 300; }
      else if (idleDirector.step == 2) { directorGaze({idleDirector.anchor.x - idleDirector.side * 14.0f, idleDirector.anchor.y + randf(8.0f, 22.0f), idleDirector.anchor.z}, now, 390, 110); if (random(0, 100) < 42) triggerBlink(now, 135, false); idleDirector.nextStep = now + 470; }
      else if (idleDirector.step == 3) { beginMood(Mood::Wonder, now, 1200, false); directorGaze({idleDirector.side * randf(18.0f, 56.0f), randf(32.0f, 84.0f), randf(360.0f, 620.0f)}, now, 600, 230); idleDirector.nextStep = now + 820; }
      else finishIdleBeat(now);
      break;
    case IdleBeat::DoubleTake:
      if (idleDirector.step == 0) { beginMood(Mood::Calm, now, 800, false); directorGaze({-idleDirector.side * 112.0f, randf(-26.0f, 38.0f), randf(470.0f, 820.0f)}, now, 210, 130); idleDirector.nextStep = now + 290; }
      else if (idleDirector.step == 1) { beginMood(Mood::Surprised, now, 850, false); directorGaze({idleDirector.side * 130.0f, randf(-10.0f, 52.0f), randf(210.0f, 360.0f)}, now, 180, 70); idleDirector.nextStep = now + 260; }
      else if (idleDirector.step == 2) { triggerBlink(now, 95, true); directorGaze({idleDirector.side * 100.0f, randf(-20.0f, 44.0f), randf(260.0f, 480.0f)}, now, 440, 95); idleDirector.nextStep = now + 620; }
      else finishIdleBeat(now);
      break;
    case IdleBeat::RobotScan:
      beginMood(Mood::Robotic, now, 2600, false);
      if (idleDirector.step == 0) directorGaze({-125.0f, -42.0f, 620.0f}, now, 120, 45);
      else if (idleDirector.step == 1) directorGaze({0.0f, -42.0f, 620.0f}, now, 120, 42);
      else if (idleDirector.step == 2) directorGaze({125.0f, -42.0f, 620.0f}, now, 150, 42);
      else if (idleDirector.step == 3) directorGaze({125.0f, 38.0f, 620.0f}, now, 120, 42);
      else if (idleDirector.step == 4) directorGaze({0.0f, 38.0f, 620.0f}, now, 120, 42);
      else if (idleDirector.step == 5) directorGaze({-125.0f, 38.0f, 620.0f}, now, 240, 42);
      else { beginMood(Mood::Calm, now, 1200, false); directorGaze({0.0f, 0.0f, 780.0f}, now, 520, 180); finishIdleBeat(now); break; }
      idleDirector.nextStep = now + 180;
      break;
    case IdleBeat::Mischief:
      if (idleDirector.step == 0) { beginMood(Mood::Mischief, now, 5200, false); directorGaze({idleDirector.side * 116.0f, randf(-20.0f, 24.0f), randf(360.0f, 680.0f)}, now, 1300, 360); idleDirector.nextStep = now + 1350; }
      else if (idleDirector.step == 1) { triggerWink(now, idleDirector.side < 0.0f, uint32_t(randf(260.0f, 380.0f))); directorGaze({idleDirector.side * 80.0f, randf(-12.0f, 32.0f), randf(320.0f, 600.0f)}, now, 1200, 240); idleDirector.nextStep = now + 1450; }
      else finishIdleBeat(now);
      break;
    case IdleBeat::Drowsy:
    case IdleBeat::Thoughtful:
    case IdleBeat::Daydream:
      if (idleDirector.step == 0) { beginMood(idleDirector.beat == IdleBeat::Drowsy ? Mood::Sleepy : Mood::Wonder, now, 3600, false); directorGaze({idleDirector.side * 48.0f, randf(-82.0f, 76.0f), randf(620.0f, 1200.0f)}, now, 1500, 620); idleDirector.nextStep = now + 1600; }
      else if (idleDirector.step == 1) { triggerBlink(now, uint32_t(randf(220.0f, 620.0f)), false); idleDirector.nextStep = now + 700; }
      else finishIdleBeat(now);
      break;
    case IdleBeat::FocusLock:
      if (idleDirector.step == 0) { beginMood(Mood::Focused, now, 6200, false); directorGaze({0.0f, 4.0f, 310.0f}, now, 2200, 260); idleDirector.nextStep = now + 2300; }
      else if (idleDirector.step == 1) { triggerBlink(now, 105, false); beginMood(Mood::Proud, now, 2600, false); directorGaze({0.0f, 56.0f, 680.0f}, now, 1200, 360); idleDirector.nextStep = now + 1400; }
      else finishIdleBeat(now);
      break;
    case IdleBeat::SlowSmile:
    case IdleBeat::Affection:
      if (idleDirector.step == 0) { beginMood(idleDirector.beat == IdleBeat::Affection ? Mood::Affection : Mood::Happy, now, 7200, false); directorGaze({idleDirector.side * 22.0f, randf(4.0f, 48.0f), randf(360.0f, 820.0f)}, now, 1900, 680); idleDirector.nextStep = now + 1900; }
      else if (idleDirector.step == 1) { triggerBlink(now, uint32_t(randf(220.0f, 420.0f)), false); directorGaze({-idleDirector.side * 18.0f, randf(0.0f, 42.0f), randf(420.0f, 900.0f)}, now, 2100, 720); idleDirector.nextStep = now + 2200; }
      else finishIdleBeat(now);
      break;
    case IdleBeat::ConfusedLook:
    case IdleBeat::Goofy:
    case IdleBeat::Startle:
    case IdleBeat::Wary:
      beginExpression(idleDirector.beat == IdleBeat::Goofy ? Mood::Goofy : idleDirector.beat == IdleBeat::Startle ? Mood::Surprised : idleDirector.beat == IdleBeat::Wary ? Mood::Suspicious : Mood::Confused, now, 2200, false);
      idleDirector.nextStep = now + 1100;
      if (idleDirector.step > 1) finishIdleBeat(now);
      break;
    case IdleBeat::None:
    default:
      finishIdleBeat(now);
      break;
  }
  ++idleDirector.step;
}

void releaseApiOverrides(uint32_t now)
{
  apiState.idleEnabled = true;
  apiState.moodOverride = false;
  apiState.moodUntil = 0;
  apiState.gazeOverride = false;
  apiState.gazeUntil = 0;
  moodState.from = Mood::Calm;
  moodState.to = Mood::Calm;
  moodState.started = now;
  moodState.duration = 1;
  moodState.next = now + 1600;
  scheduleNextIdleBeat(now, true);
  gazeState.next = now;
}

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

void fillEllipse(Arduino_GFX &g, int16_t cx, int16_t cy, int16_t rx, int16_t ry, uint16_t color)
{
  for (int16_t y = -ry; y <= ry; ++y) {
    const float yn = float(y) / float(ry);
    const int16_t half = int16_t(float(rx) * sqrtf(max(0.0f, 1.0f - yn * yn)));
    g.drawFastHLine(cx - half, cy + y, half * 2 + 1, color);
  }
}

float apertureN(int16_t x)
{
  return (float(x) - float(EYE_CX)) / APERTURE_HALF_W;
}

float topLidYAt(const LidPose &pose, int16_t x)
{
  const float n = clampf(apertureN(x), -1.0f, 1.0f);
  const float h = sqrtf(max(0.0f, 1.0f - n * n));
  const float curve = powf(h, 0.62f + pose.topCurve * 0.0035f);
  return float(EYE_CY) - (float(EYE_CY) - pose.topY) * curve + pose.topSlant * n * h;
}

float bottomLidYAt(const LidPose &pose, int16_t x)
{
  const float n = clampf(apertureN(x), -1.0f, 1.0f);
  const float h = sqrtf(max(0.0f, 1.0f - n * n));
  const float curve = powf(h, 0.70f + pose.bottomCurve * 0.003f);
  return float(EYE_CY) + (pose.bottomY - float(EYE_CY)) * curve + pose.bottomSlant * n * h;
}

Vec2 projectTargetForEye(const Vec3 &target, bool leftEye)
{
  const float eyeX = leftEye ? -EYE_BASELINE_MM * 0.5f : EYE_BASELINE_MM * 0.5f;
  const float dx = target.x - eyeX;
  const float dy = target.y;
  const float dz = max(target.z, 40.0f);
  const float yaw = atan2f(dx, dz);
  const float pitch = atan2f(dy, sqrtf(dx * dx + dz * dz));
  return {clampf(yaw / MAX_YAW, -1.0f, 1.0f) * MAX_GAZE_X_PX + gazeState.microX,
          clampf(-pitch / MAX_PITCH, -1.0f, 1.0f) * MAX_GAZE_Y_PX + gazeState.microY};
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
  bool verticalPupil;
  bool widePupil;
};

EyePalette paletteFor(EyeRenderStyle style)
{
  switch (style) {
    case EyeRenderStyle::Classic:
      return {50, 1.32f, rgb(70, 82, 120), rgb(100, 150, 200), rgb(50, 104, 170),
              rgb(28, 58, 110), rgb(4, 18, 44), rgb(184, 212, 222), rgb(8, 9, 18), false, false, false};
    case EyeRenderStyle::Cartoony:
      return {64, 2.05f, rgb(68, 196, 240), rgb(114, 224, 255), rgb(42, 162, 245),
              rgb(18, 78, 180), rgb(3, 20, 64), rgb(230, 248, 255), rgb(3, 4, 12), false, false, false};
    case EyeRenderStyle::Robot:
      return {0, 3.95f, rgb(18, 45, 50), rgb(40, 92, 98), rgb(25, 120, 130),
              rgb(8, 58, 66), rgb(0, 12, 16), rgb(124, 232, 224), rgb(18, 12, 12), true, false, true};
    case EyeRenderStyle::Sinister:
      return {48, 1.05f, rgb(120, 30, 36), rgb(180, 64, 62), rgb(118, 28, 42),
              rgb(62, 12, 22), rgb(22, 0, 6), rgb(230, 112, 92), BLACK, false, true, false};
    case EyeRenderStyle::Sleepy:
      return {49, 1.18f, rgb(72, 84, 106), rgb(128, 152, 180), rgb(82, 118, 158),
              rgb(42, 62, 98), rgb(8, 18, 36), rgb(202, 224, 230), rgb(14, 16, 24), false, false, true};
    case EyeRenderStyle::Friendly:
    default:
      return {44, 1.0f, rgb(111, 93, 55), rgb(116, 170, 188), rgb(58, 128, 165),
              rgb(20, 66, 105), rgb(4, 22, 44), rgb(169, 124, 65), rgb(1, 1, 2), false, false, false};
  }
}

void drawSparkle(Arduino_GFX &g, int16_t x, int16_t y, uint8_t r, uint16_t color)
{
  g.drawFastHLine(x - r, y, r * 2 + 1, color);
  g.drawFastVLine(x, y - r, r * 2 + 1, color);
  g.drawPixel(x - r - 1, y - r - 1, color);
  g.drawPixel(x + r + 1, y - r - 1, color);
  g.drawPixel(x - r - 1, y + r + 1, color);
  g.drawPixel(x + r + 1, y + r + 1, color);
}

void drawIris(Arduino_GFX &g, int16_t ix, int16_t iy, float pupil, bool leftEye)
{
  const EyePalette palette = paletteFor(eyeRenderStyle);
  const float styledPupil = max(4.0f, pupil * EYE_SCALE * palette.pupilScale);
  if (palette.robot) {
    const int16_t dotR = int16_t(clampf(styledPupil, float(scaledEye(42.0f)), float(scaledEye(78.0f))));
    fillEllipse(g, ix, iy, dotR, int16_t(float(dotR) * 0.78f), palette.pupil);
    g.drawEllipse(ix, iy, dotR + scaledEye(2.0f), int16_t(float(dotR) * 0.78f) + scaledEye(2.0f), palette.accent);
    fillEllipse(g, ix - dotR / 4, iy - dotR / 3, scaledEye(9.0f), scaledEye(6.0f), rgb(220, 250, 245));
    return;
  }

  const int16_t irisR = scaledEye(palette.irisR);
  g.fillCircle(ix, iy, irisR + scaledEye(3.0f), palette.limbal);
  for (int16_t r = irisR; r >= 1; --r) {
    const float t = float(irisR - r) / float(irisR);
    const uint16_t c = t < 0.22f ? mixColor(palette.inner, palette.pale, t / 0.22f)
                     : t < 0.60f ? mixColor(palette.pale, palette.clear, (t - 0.22f) / 0.38f)
                                  : mixColor(palette.clear, palette.deep, (t - 0.60f) / 0.40f);
    g.fillCircle(ix, iy, r, c);
  }
  for (uint8_t i = 0; i < 32; ++i) {
    const float angle = (2.0f * PI_F * float(i) / 32.0f) + (leftEye ? 0.03f : -0.04f);
    const float ca = cosf(angle);
    const float sa = sinf(angle);
    g.drawLine(ix + int16_t(ca * (styledPupil + 2.0f * EYE_SCALE)), iy + int16_t(sa * (styledPupil + 2.0f * EYE_SCALE)),
               ix + int16_t(ca * (irisR - 3.0f * EYE_SCALE)), iy + int16_t(sa * (irisR - 3.0f * EYE_SCALE)),
               mixColor(palette.accent, palette.deep, 0.48f));
  }
  g.drawCircle(ix, iy, irisR + scaledEye(1.0f), palette.limbal);
  if (palette.verticalPupil) {
    fillEllipse(g, ix, iy, int16_t(styledPupil * 0.44f), int16_t(styledPupil * 1.42f), palette.pupil);
  } else if (palette.widePupil) {
    fillEllipse(g, ix, iy, int16_t(styledPupil * 1.22f), int16_t(styledPupil * 0.58f), palette.pupil);
  } else {
    g.fillCircle(ix, iy, int16_t(styledPupil) + scaledEye(3.0f), rgb(4, 14, 25));
    g.fillCircle(ix, iy, int16_t(styledPupil), palette.pupil);
  }
  fillEllipse(g, ix - scaledEye(13.0f), iy - scaledEye(18.0f), scaledEye(6.0f), scaledEye(4.0f), rgb(245, 250, 246));
  fillEllipse(g, ix + scaledEye(12.0f), iy - scaledEye(8.0f), scaledEye(3.0f), scaledEye(2.0f), rgb(218, 235, 229));
}

void drawLids(Arduino_GFX &g, LidPose pose, float closed)
{
  pose.topY = pose.topY + (EYE_CY - 2.0f - pose.topY) * closed;
  pose.bottomY = pose.bottomY + (EYE_CY + 2.0f - pose.bottomY) * closed;
  pose.topCurve = pose.topCurve + (8.0f - pose.topCurve) * closed;
  pose.bottomCurve = pose.bottomCurve + (8.0f - pose.bottomCurve) * closed;

  for (int16_t x = 0; x < FACE_EYE_WIDTH; ++x) {
    const int16_t ty = int16_t(topLidYAt(pose, x));
    const int16_t by = int16_t(bottomLidYAt(pose, x));
    if (ty > 0) g.drawFastVLine(x, 0, min(ty, int16_t(FACE_EYE_HEIGHT)), BLACK);
    if (by < FACE_EYE_HEIGHT) g.drawFastVLine(x, max(by, int16_t(0)), FACE_EYE_HEIGHT - max(by, int16_t(0)), BLACK);
    if (closed > 0.82f && ty >= by - 2) {
      const int16_t seamY = max(int16_t(by - 1), int16_t(0));
      const int16_t seamH = min(int16_t(4), int16_t(FACE_EYE_HEIGHT - by + 1));
      g.drawFastVLine(x, seamY, seamH, rgb(8, 8, 8));
    }
  }
}

LidPose eyeViewportPose(LidPose pose)
{
  pose.topY *= EYE_SCALE;
  pose.bottomY *= EYE_SCALE;
  pose.topCurve *= EYE_SCALE;
  pose.bottomCurve *= EYE_SCALE;
  pose.topSlant *= EYE_SCALE;
  pose.bottomSlant *= EYE_SCALE;
  return pose;
}

void renderEyeFrame(bool leftEye, uint32_t now)
{
  Arduino_GFX &g = *eyeFrame;
  g.fillScreen(BLACK);
  const Mood mood = currentMood(now);
  if (mood == Mood::Sleep) return;

  Vec2 gaze = projectTargetForEye(gazeState.now, leftEye);
  if (mood == Mood::Afraid) {
    gaze.x += sinf(float(now) * 0.032f + (leftEye ? 0.0f : 1.4f)) * 1.4f * EYE_SCALE;
    gaze.y += sinf(float(now) * 0.027f + 2.1f) * 0.8f * EYE_SCALE;
  } else if (mood == Mood::Goofy) {
    gaze.x += (leftEye ? 5.5f : -5.5f) * EYE_SCALE;
    gaze.y += (leftEye ? -4.5f : 4.5f) * EYE_SCALE;
  } else if (mood == Mood::Robotic) {
    gaze.x = roundf(gaze.x / (8.0f * EYE_SCALE)) * (8.0f * EYE_SCALE);
    gaze.y = roundf(gaze.y / (6.0f * EYE_SCALE)) * (6.0f * EYE_SCALE);
  } else if (mood == Mood::Sleepy || mood == Mood::Bored) {
    gaze.y += 8.0f * EYE_SCALE;
  } else if (mood == Mood::Glitchy) {
    const int32_t tick = int32_t(now / 75 + (leftEye ? 0 : 3));
    gaze.x += float((tick % 5) - 2) * 1.8f * EYE_SCALE;
    gaze.y += float(((tick / 2) % 3) - 1) * 1.6f * EYE_SCALE;
  } else if (mood == Mood::Proud) {
    gaze.y -= 8.0f * EYE_SCALE;
  }

  if (eyeRenderStyle == EyeRenderStyle::Robot) {
    fillEllipse(g, EYE_CX, EYE_CY, EYE_SCLERA_RX, EYE_SCLERA_RY, WHITE);
  } else {
    fillEllipse(g, EYE_CX, EYE_CY, EYE_SCLERA_RX, EYE_SCLERA_RY, rgb(240, 238, 228));
    fillEllipse(g, EYE_CX, EYE_CY + scaledEye(3.0f), max(int16_t(1), int16_t(EYE_SCLERA_RX - scaledEye(9.0f))),
                max(int16_t(1), int16_t(EYE_SCLERA_RY - scaledEye(12.0f))), WHITE);
  }
  drawIris(g, EYE_CX + int16_t(gaze.x), EYE_CY + int16_t(gaze.y), pupilRadius, leftEye);
  if (mood == Mood::Delighted || mood == Mood::Affection) {
    drawSparkle(g, leftEye ? FACE_EYE_WIDTH - scaledEye(54.0f) : scaledEye(52.0f),
                scaledEye(68.0f), scaledEye(4.0f), rgb(246, 248, 221));
  }
  drawLids(g, eyeViewportPose(blendedPose(leftEye, now)), blinkClosedForEye(now, leftEye));
}

void drawEyeTestPattern(Arduino_GFX *gfx, const char *label, uint16_t color)
{
  constexpr int cx = FACE_EYE_WIDTH / 2;
  constexpr int cy = FACE_EYE_HEIGHT / 2;
  gfx->fillScreen(BLACK);
  gfx->fillCircle(cx, cy, min(cx, cy) - 1, color);
  gfx->fillCircle(cx, cy, max(1, min(cx, cy) - scaledEye(16.0f)), BLACK);
  gfx->drawCircle(cx, cy, min(cx, cy) - 1, WHITE);
  gfx->drawCircle(cx, cy, max(1, min(cx, cy) - scaledEye(32.0f)), WHITE);
  gfx->setTextColor(WHITE);
  gfx->setTextSize(FACE_EYE_WIDTH >= 200 ? 4 : 2);
  gfx->setCursor(cx - scaledEye(22.0f), cy - scaledEye(15.0f));
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
  const uint32_t now = millis();
  digitalWrite(FACE_EYE_LEFT_CS, HIGH);
  digitalWrite(FACE_EYE_RIGHT_CS, HIGH);
  if (target == "both" || target == "left") {
    renderEyeFrame(true, now);
    leftEye->draw16bitRGBBitmap(0, 0, eyeFrame->getFramebuffer(), FACE_EYE_WIDTH, FACE_EYE_HEIGHT);
    digitalWrite(FACE_EYE_LEFT_CS, HIGH);
    digitalWrite(FACE_EYE_RIGHT_CS, HIGH);
  }
  if (target == "both" || target == "right") {
    renderEyeFrame(false, now);
    rightEye->draw16bitRGBBitmap(0, 0, eyeFrame->getFramebuffer(), FACE_EYE_WIDTH, FACE_EYE_HEIGHT);
  }
  digitalWrite(FACE_EYE_LEFT_CS, HIGH);
  digitalWrite(FACE_EYE_RIGHT_CS, HIGH);
#endif
}

void updateMouth(uint32_t now)
{
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

MouthShape activeMouthShape(uint32_t now)
{
  if (mouthState.overrideShape) return mouthState.shape;
  return mouthShapeForMood(currentMood(now));
}

MouthPose easedMouthPose(MouthShape shape, uint32_t now)
{
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

void drawMouthTeeth(Arduino_GFX &g, int16_t x, int16_t y, int16_t w, int16_t h, float amount)
{
  if (amount <= 0.01f || h < 12 || w < 36) return;
  const int16_t teethH = int16_t(clampf(float(h) * (0.24f + amount * 0.18f), 5.0f, 22.0f));
  const uint16_t enamel = rgb(238, 228, 198);
  const uint16_t line = rgb(126, 104, 98);
  g.fillRoundRect(x, y, w, teethH, 5, enamel);
  g.drawFastHLine(x + 4, y + teethH - 1, w - 8, line);
  for (int16_t tx = x + 28; tx < x + w - 14; tx += 36) {
    g.drawFastVLine(tx, y + 2, teethH - 4, line);
  }
}

void drawMouthTongue(Arduino_GFX &g, int16_t cx, int16_t y, int16_t rx, int16_t ry)
{
  if (rx < 14 || ry < 4) return;
  const uint16_t tongue = rgb(162, 54, 72);
  const uint16_t tongueHi = rgb(218, 94, 106);
  fillEllipse(g, cx, y, rx, ry, tongue);
  fillEllipse(g, cx - rx / 5, y - ry / 4, max(int16_t(4), int16_t(rx / 3)), max(int16_t(2), int16_t(ry / 4)), tongueHi);
}

void renderHumanMouth(MouthShape shape, MouthPose pose, uint32_t now)
{
  if (!displayOk) return;
  Arduino_GFX &g = mouthFrameOk ? static_cast<Arduino_GFX &>(*mouthFrame) : *display;
  const int16_t screenW = g.width();
  const int16_t screenH = g.height();
  const int16_t cx0 = screenW / 2;
  const int16_t cy0 = screenH / 2;

  if (mouthState.talkLevel > 0.01f) {
    const float pulse = clampf(0.58f + 0.32f * sinf(float(now) * 0.037f) +
                                0.18f * sinf(float(now) * 0.071f + 1.7f), 0.0f, 1.0f);
    pose.open = max(pose.open, 0.18f + mouthState.energy * 0.70f * pulse * mouthState.talkLevel);
    pose.width = max(pose.width, 0.56f + mouthState.energy * 0.20f * mouthState.talkLevel);
  }

  g.fillScreen(BLACK);

  if (shape == MouthShape::Sleep && mouthState.talkLevel <= 0.01f &&
      uint32_t(now - mouthState.poseStarted) >= MOUTH_TRANSITION_MS) {
    const int16_t sleepW = screenW - 84;
    const int16_t sleepX = (screenW - sleepW) / 2;
    const int16_t sleepY = cy0 - 8;
    g.fillRoundRect(sleepX, sleepY, sleepW, 16, 8, rgb(118, 28, 44));
    g.drawFastHLine(sleepX + 24, sleepY + 3, sleepW - 58, rgb(218, 92, 102));
    g.drawFastHLine(sleepX + 30, sleepY + 13, sleepW - 70, rgb(58, 8, 22));
    if (mouthFrameOk) mouthFrame->flush();
    return;
  }

  const int16_t mouthW = int16_t(clampf(124.0f + pose.width * 210.0f, 120.0f, float(screenW - 26)));
  const int16_t openH = int16_t(clampf(7.0f + pose.open * 88.0f, 5.0f, float(screenH - 92)));
  const int16_t lipH = int16_t(clampf(26.0f + pose.open * 28.0f + pose.tension * 7.0f, 24.0f, 58.0f));
  const int16_t driftX = mouthState.talkLevel > 0.01f
    ? int16_t(5.0f * sinf(float(now) * 0.0031f) + 2.0f * sinf(float(now) * 0.0071f + 1.4f))
    : 0;
  const int16_t driftY = mouthState.talkLevel > 0.01f
    ? int16_t(2.0f * sinf(float(now) * 0.0027f + 0.6f))
    : 0;
  const bool isSmirk = shape == MouthShape::SmirkLeft || shape == MouthShape::SmirkRight;
  const int16_t cx = cx0 + int16_t(pose.skew * (isSmirk ? 38.0f : 20.0f)) + driftX;
  const int16_t cy = cy0 + int16_t(pose.tension * 4.0f) + driftY;
  const int16_t curve = int16_t(pose.curve * 18.0f);
  const int16_t asym = (mouthState.talkLevel > 0.01f
                          ? int16_t(5.0f * mouthState.talkLevel *
                                    sinf(float(now) * 0.0041f + pose.width * 3.1f))
                          : 0) +
                       int16_t(pose.skew * (isSmirk ? 22.0f : 12.0f));
  const int16_t slant = int16_t(pose.slant * 24.0f) + int16_t(pose.skew * 6.0f);
  const int16_t upperLift = int16_t(pose.upperLift * 26.0f);
  const int16_t leftUpperLift = upperLift < 0 ? int16_t(-upperLift) : 0;
  const int16_t rightUpperLift = upperLift > 0 ? upperLift : 0;
  const int16_t cavityW = int16_t(float(mouthW) * (0.86f - pose.tension * 0.05f));
  const int16_t cavityH = max(int16_t(5), openH);
  const int16_t topCy = cy - cavityH / 2 - lipH / 3 - curve / 3;
  const int16_t bottomCy = cy + cavityH / 2 + lipH / 3 - curve / 5;
  const int16_t leftTopCy = topCy + slant / 2 - leftUpperLift + asym / 10;
  const int16_t rightTopCy = topCy - slant / 2 - rightUpperLift - asym / 12;
  const int16_t centerTopCy = topCy - (leftUpperLift + rightUpperLift) / 6 + asym / 18;
  const int16_t leftBottomCy = bottomCy - slant / 4 + leftUpperLift / 7;
  const int16_t rightBottomCy = bottomCy + slant / 4 + rightUpperLift / 7;
  const int16_t lowerCenterCy = bottomCy + asym / 18;
  int16_t leftCornerY = cy - curve + int16_t(pose.tension * 2.0f) + asym / 3 + slant / 2 - leftUpperLift / 2;
  int16_t rightCornerY = cy - curve + int16_t(pose.tension * 2.0f) - asym / 4 - slant / 2 - rightUpperLift / 2;
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
  const uint16_t enamel = rgb(238, 228, 198);

  fillEllipse(g, cx + asym / 4, cy, mouthW / 2 + 20, cavityH / 2 + lipH + 16, shadow);
  fillEllipse(g, cx + asym / 5, lowerCenterCy + 2, mouthW / 2 + 16, max(int16_t(18), int16_t(lipH / 2 + 10)), lipLo);
  fillEllipse(g, cx - mouthW / 5 + asym / 4, leftBottomCy, mouthW / 3 + 12, max(int16_t(15), int16_t(lipH / 2 + 4)), lip);
  fillEllipse(g, cx + mouthW / 5 + asym / 3, rightBottomCy, mouthW / 3 + 8, max(int16_t(15), int16_t(lipH / 2 + 4)), lip);
  fillEllipse(g, cx - mouthW / 5 + asym / 2, leftTopCy, mouthW / 3 + 14, max(int16_t(13), int16_t(lipH / 2 + 1)), lipLo);
  fillEllipse(g, cx + mouthW / 5 + asym / 3, rightTopCy, mouthW / 3 + 5, max(int16_t(12), int16_t(lipH / 2 - 1)), lipLo);
  fillEllipse(g, cx - mouthW / 5 + asym / 2, leftTopCy - 3, mouthW / 3 + 6, max(int16_t(11), int16_t(lipH / 2 - 2)), lip);
  fillEllipse(g, cx + mouthW / 5 + asym / 3, rightTopCy - 4, max(int16_t(8), int16_t(mouthW / 3 - 1)), max(int16_t(10), int16_t(lipH / 2 - 4)), lip);
  fillEllipse(g, cx + asym / 3, centerTopCy + lipH / 7, mouthW / 5 + 3, max(int16_t(8), int16_t(lipH / 3)), mixColor(lipLo, lip, 0.36f));
  g.fillTriangle(cx - 24 + asym / 4, centerTopCy - lipH / 2 + 6, cx + 18 + asym / 4, centerTopCy - lipH / 2 + 4,
                 cx - 3 + asym / 3, centerTopCy - lipH / 7, lipLo);
  fillEllipse(g, cx - mouthW / 5 + asym / 2, leftTopCy - lipH / 5, mouthW / 5, max(int16_t(4), int16_t(lipH / 8)), lipHi);
  fillEllipse(g, cx + mouthW / 6 + asym / 3, rightTopCy - lipH / 6, mouthW / 6, max(int16_t(3), int16_t(lipH / 9)), mixColor(lip, lipHi, 0.50f));
  fillEllipse(g, cx + mouthW / 10 + asym / 4, lowerCenterCy - lipH / 5, mouthW / 3 + 6, max(int16_t(5), int16_t(lipH / 7)), mixColor(lip, lipHi, 0.50f));

  fillEllipse(g, cx + asym / 3, cy + asym / 12, cavityW / 2, max(int16_t(3), int16_t(cavityH / 2)), cavity);
  if (cavityH > 16) {
    drawMouthTongue(g, cx + asym / 4, cy + cavityH / 3 + asym / 12, cavityW / 4, max(int16_t(5), int16_t(cavityH / 5)));
  } else {
    g.drawFastHLine(cx + asym / 3 - cavityW / 2 + 10, cy + asym / 12, cavityW - 20, rgb(28, 2, 12));
  }

  const float teethAmount = max(pose.teeth, pose.open > 0.34f ? clampf((pose.open - 0.30f) * 1.2f, 0.0f, 0.42f) : 0.0f);
  drawMouthTeeth(g, cx + asym / 3 - cavityW / 2 + 18, cy + asym / 12 - cavityH / 2 + 2, cavityW - 36, cavityH, teethAmount);
  if (shape == MouthShape::Grimace && cavityW > 92) {
    const int16_t gumY = cy + asym / 12 + max(int16_t(4), int16_t(cavityH / 7));
    g.drawFastHLine(cx + asym / 3 - cavityW / 2 + 24, gumY, cavityW - 48, rgb(204, 190, 170));
    for (int16_t tx = cx + asym / 3 - cavityW / 2 + 40; tx < cx + asym / 3 + cavityW / 2 - 36; tx += 30) {
      g.drawFastVLine(tx, gumY - 7, 14, rgb(126, 104, 98));
    }
  }
  if (fabsf(pose.upperLift) > 0.35f && cavityW > 84) {
    const bool rightLift = pose.upperLift > 0.0f;
    const int16_t fangX = rightLift ? cx + cavityW / 6 + asym / 3 : cx - cavityW / 6 + asym / 3;
    const int16_t fangY = cy + asym / 12 - cavityH / 2 + 3 - (rightLift ? rightUpperLift : leftUpperLift) / 3;
    g.fillTriangle(fangX - 12, fangY, fangX + 12, fangY, fangX + (rightLift ? 5 : -5),
                   fangY + max(int16_t(10), int16_t(cavityH / 3)), enamel);
  }

  const int16_t leftX = cx - mouthW / 2;
  const int16_t rightX = cx + mouthW / 2;
  g.fillCircle(leftX + asym / 3, leftCornerY + int16_t(pose.skew * 10.0f), max(int16_t(9), int16_t(lipH / 3)), mixColor(lipLo, lip, 0.42f));
  g.fillCircle(rightX + asym / 4, rightCornerY - int16_t(pose.skew * 10.0f), max(int16_t(11), int16_t(lipH / 3)), mixColor(lipLo, lip, 0.48f));
  if (isSmirk || shape == MouthShape::Sneer) {
    const bool liftRight = pose.skew > 0.0f;
    const int16_t creaseX = liftRight ? rightX - 36 + asym / 3 : leftX + 36 + asym / 2;
    const int16_t creaseY = liftRight ? rightCornerY - 8 : leftCornerY - 8;
    const int16_t creaseDir = liftRight ? -1 : 1;
    const int16_t creaseLen = isSmirk ? 42 : 34;
    g.drawLine(creaseX, creaseY, creaseX + creaseDir * creaseLen, creaseY - 15, lipHi);
    g.drawLine(creaseX - creaseDir * 2, creaseY + 7, creaseX + creaseDir * (creaseLen - 4), creaseY, lipLo);
  }
  if (shape == MouthShape::Smile) {
    g.drawLine(leftX + 20, leftCornerY - 6, leftX + 48, leftCornerY - 18, lipHi);
    g.drawLine(rightX - 20, rightCornerY - 6, rightX - 48, rightCornerY - 18, lipHi);
  } else if (shape == MouthShape::Frown) {
    g.drawLine(leftX + 26, leftCornerY + 4, leftX + 58, leftCornerY + 22, lipLo);
    g.drawLine(rightX - 26, rightCornerY + 4, rightX - 58, rightCornerY + 22, lipLo);
  } else if (shape == MouthShape::Grimace) {
    g.drawLine(leftX + 18, leftCornerY - 3, leftX + 34, leftCornerY + 18, lipLo);
    g.drawLine(rightX - 18, rightCornerY - 3, rightX - 34, rightCornerY + 18, lipLo);
  }
  if (mouthFrameOk) mouthFrame->flush();
}

void renderRobotMouth(MouthShape shape, MouthPose pose, uint32_t now)
{
  if (!displayOk) return;
  Arduino_GFX &g = mouthFrameOk ? static_cast<Arduino_GFX &>(*mouthFrame) : *display;
  const int16_t screenW = g.width();
  const int16_t screenH = g.height();
  const int16_t panelX = 12;
  const int16_t panelY = 34;
  const int16_t panelW = screenW - panelX * 2;
  const int16_t panelH = screenH - panelY * 2;
  const float talkMix = clampf(mouthState.talkLevel * 0.85f, 0.0f, 1.0f);

  g.fillScreen(BLACK);
  g.fillRoundRect(panelX, panelY, panelW, panelH, 24, rgb(0, 8, 16));
  g.drawRoundRect(panelX + 1, panelY + 1, panelW - 2, panelH - 2, 23, rgb(30, 118, 132));
  g.drawRoundRect(panelX + 8, panelY + 8, panelW - 16, panelH - 16, 18, rgb(12, 58, 78));

  constexpr uint8_t barCount = 13;
  const int16_t gap = max(int16_t(4), int16_t(screenW / 60));
  const int16_t barW = max(int16_t(8), int16_t((panelW - 54 - gap * (barCount - 1)) / barCount));
  const int16_t barsW = barCount * barW + (barCount - 1) * gap;
  const int16_t barsX = screenW / 2 - barsW / 2;
  const int16_t barsCy = screenH / 2;
  for (uint8_t i = 0; i < barCount; ++i) {
    const int16_t x = barsX + int16_t(i) * (barW + gap);
    const float center = float(barCount - 1) * 0.5f;
    const float pos = center <= 0.0f ? 0.0f : (float(i) - center) / center;
    const float side = 0.5f + 0.5f * pos;
    float shapeLevel = clampf(0.12f + pose.open * 0.62f, 0.06f, 0.98f);
    switch (shape) {
      case MouthShape::Smile:
        shapeLevel = 0.20f + 0.34f * fabsf(pos);
        break;
      case MouthShape::SmirkLeft:
        shapeLevel = 0.18f + 0.46f * (1.0f - side);
        break;
      case MouthShape::SmirkRight:
        shapeLevel = 0.18f + 0.46f * side;
        break;
      case MouthShape::Open:
        shapeLevel = 0.18f + 0.64f * (1.0f - fabsf(pos));
        break;
      case MouthShape::Wide:
        shapeLevel = 0.52f + 0.26f * (1.0f - fabsf(pos) * 0.35f);
        break;
      case MouthShape::Frown:
        shapeLevel = 0.34f - 0.18f * fabsf(pos);
        break;
      case MouthShape::Grimace:
        shapeLevel = 0.34f + 0.04f * ((i % 2) ? 1.0f : -1.0f);
        break;
      case MouthShape::Sneer:
        shapeLevel = 0.16f + 0.50f * side + 0.10f * ((i % 2) ? 1.0f : 0.0f);
        break;
      case MouthShape::Sleep:
        shapeLevel = 0.07f;
        break;
      case MouthShape::Neutral:
      default:
        shapeLevel = 0.16f + 0.08f * (1.0f - fabsf(pos));
        break;
    }
    const float wave = 0.35f + 0.65f * fabsf(sinf(float(now) * 0.009f + float(i) * 0.8f));
    const float level = clampf(shapeLevel * (1.0f - talkMix) + max(shapeLevel, wave) * talkMix, 0.03f, 1.0f);
    const int16_t barH = int16_t(10.0f + float(panelH - 42) * level);
    const int16_t ySkew = int16_t((pose.slant * 9.0f + pose.skew * 5.0f) * pos);
    const uint16_t bar = shape == MouthShape::Sneer ? rgb(236, 102, 80)
                         : shape == MouthShape::Grimace ? rgb(236, 220, 150)
                         : shape == MouthShape::Frown ? rgb(82, 180, 236)
                         : rgb(44, 220, 232);
    const uint16_t hi = mixColor(bar, rgb(210, 255, 255), 0.56f);
    g.fillRoundRect(x, barsCy - barH / 2 + ySkew, barW, barH, barW / 2, bar);
    g.drawFastVLine(x + barW / 3, barsCy - barH / 2 + 5 + ySkew, max(int16_t(1), int16_t(barH - 10)), hi);
  }
  if (shape == MouthShape::Sleep) {
    g.drawFastHLine(panelX + 44, barsCy, panelW - 88, rgb(44, 220, 232));
    g.drawFastHLine(panelX + 66, barsCy + 6, panelW - 132, rgb(12, 58, 78));
  }
  if (mouthFrameOk) mouthFrame->flush();
}

void renderMouth(uint32_t now)
{
  const MouthShape shape = activeMouthShape(now);
  const MouthPose pose = easedMouthPose(shape, now);
  if (mouthState.style == MouthStyle::Robot) {
    renderRobotMouth(shape, pose, now);
  } else {
    renderHumanMouth(shape, pose, now);
  }
}

void drawIntegratedEye(bool leftEye, int16_t x, int16_t y, uint32_t now)
{
  if (!displayOk || !eyesOk) return;
  renderEyeFrame(leftEye, now);
  display->draw16bitRGBBitmap(x, y, eyeFrame->getFramebuffer(), FACE_EYE_WIDTH, FACE_EYE_HEIGHT);
}

void renderIntegratedFace(uint32_t now)
{
  if (!displayOk) return;
  renderMouth(now);
  constexpr int16_t eyePadX = 6;
  constexpr int16_t eyePadY = 8;
  constexpr int16_t eyeBandH = FACE_EYE_HEIGHT + eyePadY * 2 + 4;
  display->fillRect(0, 0, FACE_LCD_WIDTH, eyeBandH, BLACK);
  drawIntegratedEye(true, eyePadX, eyePadY, now);
  drawIntegratedEye(false, FACE_LCD_WIDTH - FACE_EYE_WIDTH - eyePadX, eyePadY, now);
  display->drawFastHLine(14, eyeBandH - 2, FACE_LCD_WIDTH - 28, rgb(24, 42, 54));
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

  const bool leftOk = leftEye->begin(40000000);
  digitalWrite(FACE_EYE_LEFT_CS, HIGH);
  digitalWrite(FACE_EYE_RIGHT_CS, HIGH);
  delay(20);
  const bool rightOk = rightEye->begin(40000000);
  digitalWrite(FACE_EYE_LEFT_CS, HIGH);
  digitalWrite(FACE_EYE_RIGHT_CS, HIGH);
  const bool canvasOk = eyeFrame->begin();
  eyesOk = leftOk && rightOk && canvasOk;
  Serial.printf("external_eyes=%s left=%d right=%d\n", eyesOk ? "ok" : "missing", leftOk, rightOk);
  if (eyesOk) {
    drawEyesFrame();
  }
#else
  const bool canvasOk = eyeFrame->begin(GFX_SKIP_OUTPUT_BEGIN);
  eyesOk = canvasOk;
  if (eyesOk) {
    eyeFrame->fillScreen(BLACK);
    eyeFrame->setTextWrap(false);
  }
  Serial.printf("integrated_eyes=%s external_eyes=disabled\n", eyesOk ? "ok" : "fail");
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
    mouthFrameOk = mouthFrame->begin(GFX_SKIP_OUTPUT_BEGIN);
    if (mouthFrameOk) {
      mouthFrame->fillScreen(BLACK);
      mouthFrame->setTextWrap(false);
      mouthFrame->flush();
    }
  }
  Serial.printf("display=%s mouth_frame=%s\n", displayOk ? "ok" : "fail", mouthFrameOk ? "ok" : "direct");
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

  imuOk = i2cAddressResponds(FACE_QMI8658_ADDR);
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

void sendCors()
{
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Cache-Control", "no-store, max-age=0");
}

void sendJson(JsonDocument &doc, int status = 200)
{
  String body;
  serializeJson(doc, body);
  sendCors();
  server.send(status, "application/json", body);
}

void sendError(const char *message, int status = 400)
{
  JsonDocument doc;
  doc["ok"] = false;
  doc["error"] = message;
  sendJson(doc, status);
}

bool parseBody(JsonDocument &doc)
{
  DeserializationError error = deserializeJson(doc, server.arg("plain"));
  if (error) {
    sendError("invalid json", 400);
    return false;
  }
  return true;
}

uint32_t jsonMs(JsonVariantConst value, uint32_t defaultMs)
{
  if (value.isNull()) return defaultMs;
  if (value.is<float>()) {
    const float number = value.as<float>();
    if (number <= 0.0f) return 0;
    if (number <= 120.0f) return uint32_t(number * 1000.0f);
    return uint32_t(number);
  }
  return defaultMs;
}

uint32_t jsonMilliseconds(JsonVariantConst value, uint32_t defaultMs)
{
  if (value.isNull()) return defaultMs;
  if (value.is<float>()) {
    const float number = value.as<float>();
    if (number <= 0.0f) return 0;
    return uint32_t(number);
  }
  return defaultMs;
}

bool jsonBool(JsonVariantConst value, bool defaultValue)
{
  if (value.isNull()) return defaultValue;
  if (value.is<bool>()) return value.as<bool>();
  if (value.is<const char *>()) {
    const char *text = value.as<const char *>();
    if (equalsIgnoreCase(text, "on") || equalsIgnoreCase(text, "true") || equalsIgnoreCase(text, "1")) return true;
    if (equalsIgnoreCase(text, "off") || equalsIgnoreCase(text, "false") || equalsIgnoreCase(text, "0")) return false;
  }
  return defaultValue;
}

bool releaseToken(const char *text)
{
  return equalsIgnoreCase(text, "auto") || equalsIgnoreCase(text, "idle") ||
         equalsIgnoreCase(text, "random") || equalsIgnoreCase(text, "neutral");
}

void addState(JsonDocument &doc, uint32_t now)
{
  doc["ok"] = true;
  doc["running"] = true;
  doc["name"] = "Robot 790 ESP32-S3 Face";
  doc["hostname"] = FACE_HOSTNAME;
  doc["mdns_url"] = "http://" FACE_HOSTNAME ".local/";
  doc["ip"] = ipString();
  doc["wifi_mode"] = wifiStation ? "station" : "ap";
  doc["uptime_ms"] = now - bootMs;
  doc["free_heap"] = ESP.getFreeHeap();
  doc["psram"] = psramFound();
  doc["display"] = displayOk;
  doc["eyes"] = eyesOk;
  doc["external_eyes"] = bool(FACE_EXTERNAL_EYES_ENABLED) && eyesOk;
  doc["integrated_viewports"] = bool(FACE_INTEGRATED_VIEWPORTS);
  doc["idle"] = apiState.idleEnabled;
  doc["eyes_animate"] = apiState.idleEnabled;
  doc["autonomous"] = apiState.idleEnabled && !apiState.moodOverride && !apiState.gazeOverride;
  doc["mood"] = moodName(currentMood(now));
  doc["eye_mood"] = moodName(currentMood(now));
  doc["style"] = eyeStyleName(eyeRenderStyle);
  doc["mood_override"] = apiState.moodOverride;
  doc["gaze_override"] = apiState.gazeOverride;
  doc["sleeping"] = currentMood(now) == Mood::Sleep;
  doc["director"] = idleBeatName(idleDirector.beat);
  doc["touch"] = touchSeen;
  doc["touch_id"] = cst816Id;
  doc["imu"] = imuOk;
  doc["imu_probe"] = "i2c_presence";
  doc["sd"] = sdOk;
  doc["camera"] = cameraOk;
  doc["backlight"] = backlight;
  doc["message"] = lastMessage;

  JsonObject mouth = doc["mouth"].to<JsonObject>();
  mouth["present"] = displayOk;
  mouth["buffered"] = mouthFrameOk;
  mouth["display_role"] = FACE_INTEGRATED_VIEWPORTS ? "integrated_face" : "mouth";
  mouth["style"] = mouthStyleName(mouthState.style);
  mouth["shape"] = mouthShapeName(activeMouthShape(now));
  mouth["manual"] = mouthState.overrideShape;
  mouth["talking"] = mouthState.talking;
  mouth["energy"] = mouthState.energy;
  mouth["talk_level"] = mouthState.talkLevel;

  JsonObject wifi = doc["wifi"].to<JsonObject>();
  wifi["mode"] = wifiStation ? "station" : "ap";
  wifi["connected"] = wifiStation;
  wifi["ip"] = ipString();
  wifi["hostname"] = FACE_HOSTNAME;
  wifi["mdns_url"] = "http://" FACE_HOSTNAME ".local/";

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

void writeStatusJson()
{
  requests++;
  JsonDocument doc;
  addState(doc, millis());
  sendJson(doc);
}

void handleRoot()
{
  requests++;
  server.send_P(200, "text/html", FACE_UI_HTML);
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
  const uint32_t now = millis();
  if (server.hasArg("mood")) {
    Mood mood;
    if (parseMoodName(server.arg("mood").c_str(), mood)) beginMood(mood, now, API_DEFAULT_MOOD_MS, true);
  }
  if (server.hasArg("style")) {
    EyeRenderStyle style;
    if (parseEyeStyleName(server.arg("style").c_str(), style)) eyeRenderStyle = style;
  }
  if (server.hasArg("animate")) {
    apiState.idleEnabled = server.arg("animate") == "1" || server.arg("animate") == "true";
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

void handleHttpState()
{
  requests++;
  JsonDocument doc;
  addState(doc, millis());
  sendJson(doc);
}

void listValues(const char *key, const char *const *values, size_t count)
{
  JsonDocument doc;
  doc["ok"] = true;
  JsonArray array = doc[key].to<JsonArray>();
  for (size_t index = 0; index < count; ++index) array.add(values[index]);
  sendJson(doc);
}

void handleHttpRelease()
{
  requests++;
  releaseApiOverrides(millis());
  handleHttpState();
}

void handleHttpIdle(JsonDocument &doc, uint32_t now)
{
  const bool enabled = jsonBool(doc["idle"], jsonBool(doc["autonomous"], true));
  apiState.idleEnabled = enabled;
  scheduleNextIdleBeat(now, true);
  if (enabled) {
    if (!apiState.moodOverride) moodState.next = now;
    if (!apiState.gazeOverride) gazeState.next = now;
  }
}

bool handleHttpMoodName(const char *name, uint32_t holdMs, bool expressionMode, uint32_t now)
{
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
  if (expressionMode) beginExpression(mood, now, holdMs, true);
  else {
    beginMood(mood, now, holdMs, true);
    if (mood == Mood::Sleep) apiState.gazeOverride = false;
  }
  return true;
}

bool handleHttpBeatName(const char *name, uint32_t now)
{
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

bool handleHttpStyleName(const char *name)
{
  EyeRenderStyle style;
  if (name == nullptr || !parseEyeStyleName(name, style)) {
    sendError("unknown style");
    return false;
  }
  eyeRenderStyle = style;
  return true;
}

bool handleHttpMouth(JsonVariantConst value, JsonVariantConst durationValue, uint32_t now)
{
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
        jsonMs(mouth["duration"], jsonMs(durationValue, API_DEFAULT_MOUTH_MS)));
    mouthState.overrideUntil = holdMs == 0 ? 0 : now + holdMs;
  }
  return true;
}

void handleHttpGaze(JsonVariantConst gazeValue, JsonVariantConst durationValue, uint32_t now)
{
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
      jsonMs(gaze["duration"], jsonMs(durationValue, API_DEFAULT_GAZE_HOLD_MS)));
  const uint32_t moveMs = jsonMilliseconds(gaze["move_ms"], API_DEFAULT_GAZE_MOVE_MS);
  beginGaze({x, y, z}, now, holdMs, moveMs, true);
}

void handleHttpBlink(JsonDocument &doc, uint32_t now)
{
  if (currentMood(now) == Mood::Sleep) releaseApiOverrides(now);
  bool doubleBlink = jsonBool(doc["double"], false);
  if (doc["type"].is<const char *>()) doubleBlink = equalsIgnoreCase(doc["type"].as<const char *>(), "double");
  triggerBlink(now, jsonMilliseconds(doc["duration_ms"], jsonMs(doc["duration"], 150)), doubleBlink);
}

void handleHttpWink(JsonDocument &doc, uint32_t now)
{
  if (currentMood(now) == Mood::Sleep) releaseApiOverrides(now);
  bool left = random(0, 2) == 0;
  if (doc["eye"].is<const char *>()) {
    const char *eye = doc["eye"].as<const char *>();
    if (equalsIgnoreCase(eye, "left") || equalsIgnoreCase(eye, "l")) left = true;
    else if (equalsIgnoreCase(eye, "right") || equalsIgnoreCase(eye, "r")) left = false;
  }
  triggerWink(now, left, jsonMilliseconds(doc["duration_ms"], jsonMs(doc["duration"], 280)));
}

void handleHttpControl()
{
  requests++;
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
    if (!handleHttpMoodName(doc["mood"].as<const char *>(), jsonMilliseconds(doc["duration_ms"], jsonMs(doc["duration"], API_DEFAULT_MOOD_MS)), false, now)) return;
  }
  if (doc["emotion"].is<const char *>()) {
    if (!handleHttpMoodName(doc["emotion"].as<const char *>(), jsonMilliseconds(doc["duration_ms"], jsonMs(doc["duration"], API_DEFAULT_MOOD_MS)), false, now)) return;
  }
  if (doc["expression"].is<const char *>()) {
    if (!handleHttpMoodName(doc["expression"].as<const char *>(), jsonMilliseconds(doc["duration_ms"], jsonMs(doc["duration"], API_DEFAULT_EXPR_MS)), true, now)) return;
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
  if (jsonBool(doc["blink"], false)) handleHttpBlink(doc, now);
  if (jsonBool(doc["wink"], false)) handleHttpWink(doc, now);

  handleHttpState();
}

void handleHttpMoodEndpoint(bool expressionMode)
{
  requests++;
  JsonDocument doc;
  if (!parseBody(doc)) return;
  const uint32_t now = millis();
  const char *name = doc["name"] | (expressionMode ? "auto" : "calm");
  const uint32_t defaultMs = expressionMode ? API_DEFAULT_EXPR_MS : API_DEFAULT_MOOD_MS;
  if (!handleHttpMoodName(name, jsonMilliseconds(doc["duration_ms"], jsonMs(doc["duration"], defaultMs)), expressionMode, now)) return;
  handleHttpState();
}

void handleHttpBeatEndpoint()
{
  requests++;
  JsonDocument doc;
  if (!parseBody(doc)) return;
  if (!handleHttpBeatName(doc["name"] | "", millis())) return;
  handleHttpState();
}

void handleHttpStyleEndpoint()
{
  requests++;
  JsonDocument doc;
  if (!parseBody(doc)) return;
  if (!handleHttpStyleName(doc["name"] | "")) return;
  handleHttpState();
}

void handleHttpMouthEndpoint()
{
  requests++;
  JsonDocument doc;
  if (!parseBody(doc)) return;
  if (!handleHttpMouth(doc.as<JsonVariantConst>(), doc["duration"], millis())) return;
  handleHttpState();
}

void handleHttpGazeEndpoint()
{
  requests++;
  JsonDocument doc;
  if (!parseBody(doc)) return;
  handleHttpGaze(doc["gaze"].isNull() ? JsonVariantConst(doc.as<JsonVariant>()) : JsonVariantConst(doc["gaze"]), doc["duration"], millis());
  handleHttpState();
}

void handleHttpBlinkEndpoint()
{
  requests++;
  JsonDocument doc;
  if (server.hasArg("plain") && server.arg("plain").length() > 0 && !parseBody(doc)) return;
  handleHttpBlink(doc, millis());
  handleHttpState();
}

void handleHttpWinkEndpoint()
{
  requests++;
  JsonDocument doc;
  if (server.hasArg("plain") && server.arg("plain").length() > 0 && !parseBody(doc)) return;
  handleHttpWink(doc, millis());
  handleHttpState();
}

void handleHttpSleepEndpoint()
{
  requests++;
  JsonDocument doc;
  if (server.hasArg("plain") && server.arg("plain").length() > 0 && !parseBody(doc)) return;
  beginMood(Mood::Sleep, millis(), jsonMilliseconds(doc["duration_ms"], jsonMs(doc["duration"], API_DEFAULT_MOOD_MS)), true);
  apiState.gazeOverride = false;
  handleHttpState();
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
  server.on("/health", HTTP_GET, [] {
    JsonDocument doc;
    doc["ok"] = true;
    doc["message"] = "healthy";
    sendJson(doc);
  });
  server.on("/state", HTTP_GET, handleHttpState);
  server.on("/status", HTTP_GET, writeStatusJson);
  server.on("/api/status", HTTP_GET, writeStatusJson);
  server.on("/api/display", HTTP_GET, handleDisplay);
  server.on("/api/eyes", HTTP_GET, handleEyes);
  server.on("/api/backlight", HTTP_GET, handleBacklight);
  server.on("/moods", HTTP_GET, [] {
    static const char *const values[] = {
        "calm", "curious", "surprised", "suspicious", "afraid", "angry", "sleepy", "sleep", "goofy",
        "robotic", "wonder", "glitchy", "happy", "delighted", "bashful", "bored", "focused",
        "confused", "proud", "mischief", "affection"};
    listValues("moods", values, sizeof(values) / sizeof(values[0]));
  });
  server.on("/emotions", HTTP_GET, [] {
    static const char *const values[] = {
        "random", "neutral", "calm", "curious", "surprised", "suspicious", "afraid", "angry", "sleepy",
        "sleep", "goofy", "robotic", "wonder", "glitchy", "happy", "delighted", "bashful", "bored",
        "focused", "confused", "proud", "mischief", "affection"};
    listValues("emotions", values, sizeof(values) / sizeof(values[0]));
  });
  server.on("/styles", HTTP_GET, [] {
    static const char *const values[] = {"friendly", "classic", "cartoony", "robot", "sinister", "sleepy"};
    listValues("styles", values, sizeof(values) / sizeof(values[0]));
  });
  server.on("/mouth_styles", HTTP_GET, [] {
    static const char *const values[] = {"human", "robot"};
    listValues("mouth_styles", values, sizeof(values) / sizeof(values[0]));
  });
  server.on("/mouth_shapes", HTTP_GET, [] {
    static const char *const values[] = {
        "neutral", "smile", "smirk_left", "smirk_right", "open", "wide", "frown", "grimace", "sneer", "sleep"};
    listValues("mouth_shapes", values, sizeof(values) / sizeof(values[0]));
  });
  server.on("/beats", HTTP_GET, [] {
    static const char *const values[] = {
        "slow_smile", "affection", "inspect", "thoughtful", "daydream", "mischief", "confused",
        "focus_lock", "double_take", "goofy", "drowsy", "robot_scan", "wary", "startle"};
    listValues("beats", values, sizeof(values) / sizeof(values[0]));
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
  server.onNotFound([]() {
    requests++;
    if (server.method() == HTTP_OPTIONS) {
      sendCors();
      server.send(204);
      return;
    }
    server.send(404, "text/plain", "not found\n");
  });
  server.begin();
}

void updateBehavior(uint32_t now)
{
  const float dt = lastUpdate == 0 ? 16.0f : float(now - lastUpdate);
  lastUpdate = now;
  updateMood(now);
  updateMouth(now);
  if (currentMood(now) != Mood::Sleep) {
    updateIdleDirector(now);
    updateGaze(now);
    updateBlink(now);
    updatePupil(dt, now);
  }
}

} // namespace

void setup()
{
  bootMs = millis();
  Serial.begin(115200);
  delay(500);
  randomSeed(esp_random());
  Serial.println();
  Serial.println("Robot 790 ESP32-S3 face starting");
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
  const uint32_t now = millis();
  moodState.started = now;
  moodState.next = now + moodHoldMs(moodState.to);
  gazeState.next = now + 350;
  blinkState.next = now + uint32_t(randf(900.0f, 2200.0f));
  scheduleNextIdleBeat(now, true);
  drawBootCard("ready");
#if FACE_INTEGRATED_VIEWPORTS
  renderIntegratedFace(now);
#else
  renderMouth(now);
#endif
}

void loop()
{
  const uint32_t now = millis();
  ArduinoOTA.handle();
  server.handleClient();
  updateBehavior(now);
  static uint32_t lastDraw = 0;
#if FACE_INTEGRATED_VIEWPORTS
  if (displayOk && now - lastMouthFrame > (mouthState.talking || mouthState.talkLevel > 0.01f ? MOUTH_FRAME_MS : 120)) {
    lastMouthFrame = now;
    renderIntegratedFace(now);
  }
#else
  if (eyesOk && now - lastEyeFrame > EYE_FRAME_MS) {
    lastEyeFrame = now;
    drawEyesFrame();
  }
  if (displayOk && now - lastMouthFrame > (mouthState.talking || mouthState.talkLevel > 0.01f ? MOUTH_FRAME_MS : 160)) {
    lastMouthFrame = now;
    renderMouth(now);
  }
#endif
  if (millis() - lastDraw > 5000) {
    lastDraw = now;
    Serial.printf("heartbeat uptime=%lu ip=%s display=%d eyes=%d touch=%d imu=%d sd=%d camera=%d requests=%lu\n",
                  static_cast<unsigned long>(now - bootMs),
                  ipString().c_str(),
                  displayOk,
                  eyesOk,
                  touchSeen,
                  imuOk,
                  sdOk,
                  cameraOk,
                  static_cast<unsigned long>(requests));
  }
}

#include <Arduino.h>
#include <ArduinoOTA.h>
#include <WiFi.h>
#include <WiFiUdp.h>
#include <WebServer.h>
#include "chassis_config.h"

struct TrackChannel {
  const char* name;
  int rpwmPin;
  int lpwmPin;
  int rpwmChannel;
  int lpwmChannel;
  bool inverted;
  float target;
  float current;
};

static TrackChannel leftTrack = {
  "left",
  PIN_LEFT_RPWM,
  PIN_LEFT_LPWM,
  CH_LEFT_RPWM,
  CH_LEFT_LPWM,
  LEFT_INVERTED,
  0.0f,
  0.0f,
};

static TrackChannel rightTrack = {
  "right",
  PIN_RIGHT_RPWM,
  PIN_RIGHT_LPWM,
  CH_RIGHT_RPWM,
  CH_RIGHT_LPWM,
  RIGHT_INVERTED,
  0.0f,
  0.0f,
};

static WiFiUDP udp;
static WebServer httpServer(HTTP_PORT);
static char udpBuffer[96];
static String usbSerialLine;
static String uartSerialLine;
static bool estop = false;
static bool udpActive = false;
static bool httpActive = false;
static bool otaActive = false;
static unsigned long lastCommandMs = 0;
static unsigned long commandExpiresMs = 0;
static unsigned long lastTickMs = 0;

static void printBoth(const __FlashStringHelper* text);

static const char INDEX_HTML[] PROGMEM = R"rawliteral(
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Robot 790 Chassis Control</title>
<style>
  :root { color-scheme: dark; font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; background: #111318; color: #f4f7fb; display: grid; place-items: center; }
  main { width: min(720px, 100%); min-height: 100vh; padding: 18px; display: grid; gap: 14px; align-content: start; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  h1 { margin: 0; font-size: 24px; font-weight: 720; }
  .status { color: #9aa7b6; font-size: 14px; text-align: right; }
  .cameraControls { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center; }
  .cameraInput { min-width: 0; border: 1px solid #364253; background: #181d25; color: #f4f7fb; border-radius: 8px; padding: 11px; font-size: 14px; }
  .cameraFrame { display: none; position: absolute; inset: 0; background: #000; overflow: hidden; pointer-events: none; z-index: 0; }
  .cameraFrame.on { display: block; }
  .cameraFrame img { position: absolute; left: 50%; top: 50%; width: 133.333%; max-width: none; height: auto; transform: translate(-50%, -50%) rotate(-90deg); transform-origin: center; }
  .pad { display: grid; place-items: center; min-height: 54vh; border: 1px solid #2a3340; border-radius: 8px; background: #181d25; touch-action: none; user-select: none; position: relative; overflow: hidden; }
  .cross, .cross::after { position: absolute; content: ""; background: #d7f2ff66; z-index: 1; }
  .cross { width: 1px; height: 100%; }
  .cross::after { width: 100vw; height: 1px; left: -50vw; top: 50%; }
  .knob { width: 74px; height: 74px; border-radius: 50%; background: #48b8d0; box-shadow: 0 10px 30px #0008; transform: translate(0, 0); position: relative; z-index: 2; }
  .readout { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .metric { background: #181d25; border: 1px solid #2a3340; border-radius: 8px; padding: 12px; }
  .metric b { display: block; font-size: 12px; color: #9aa7b6; font-weight: 600; margin-bottom: 6px; }
  .metric span { font-variant-numeric: tabular-nums; font-size: 20px; }
  .controls { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; align-items: center; }
  label { display: grid; gap: 6px; color: #c7d0dc; font-size: 13px; }
  input[type="range"] { width: 100%; }
  .buttons { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .timedMoves { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .routines { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  button { border: 1px solid #364253; background: #232b36; color: #f4f7fb; border-radius: 8px; padding: 12px; font-size: 15px; }
  button.danger { background: #7b1d2a; border-color: #a52a3a; }
  button.good { background: #1e5f48; border-color: #2b8062; }
  .routineStatus { color: #9aa7b6; font-size: 13px; min-height: 18px; }
  @media (max-width: 560px) {
    main { padding: 12px; }
    header, .cameraControls, .controls, .readout, .buttons, .timedMoves, .routines { grid-template-columns: 1fr; display: grid; text-align: left; }
    .status { text-align: left; }
    .pad { min-height: 48vh; }
  }
</style>
</head>
<body>
<main>
  <header>
    <h1>Robot 790 Chassis Control</h1>
    <div class="status" id="status">connecting</div>
  </header>
  <section class="cameraControls">
    <input class="cameraInput" id="cameraHost" value="esp32-cam.local" aria-label="camera host">
    <button id="cameraToggle">Camera</button>
    <a id="cameraOpen" href="http://esp32-cam.local/" target="_blank" rel="noreferrer">Open</a>
  </section>
  <section class="pad" id="pad" aria-label="drive pad">
    <div class="cameraFrame" id="cameraFrame">
      <img id="cameraView" alt="Robot 790 camera stream">
    </div>
    <div class="cross"></div>
    <div class="knob" id="knob"></div>
  </section>
  <section class="readout">
    <div class="metric"><b>Left</b><span id="left">0.00</span></div>
    <div class="metric"><b>Right</b><span id="right">0.00</span></div>
    <div class="metric"><b>E-Stop</b><span id="estop">clear</span></div>
    <div class="metric"><b>Gamepad</b><span id="gamepad">off</span></div>
  </section>
  <section class="controls">
    <label>Max speed <span id="speedValue">0.55</span><input id="speed" type="range" min="0.45" max="1.00" value="0.55" step="0.05"></label>
    <label>Duration <span id="durationValue">1.0s</span><input id="duration" type="range" min="0.25" max="5.00" value="1.00" step="0.25"></label>
    <label>Turn scale <span id="turnValue">1.25</span><input id="turn" type="range" min="0.25" max="2.50" value="1.25" step="0.05"></label>
  </section>
  <section class="timedMoves">
    <button data-timed="forward">Forward</button>
    <button data-timed="reverse">Reverse</button>
    <button data-timed="left">Spin Left</button>
    <button data-timed="right">Spin Right</button>
  </section>
  <section class="buttons">
    <button id="stop">Stop</button>
    <button class="danger" id="estopButton">E-Stop</button>
    <button class="good" id="clearButton">Clear</button>
  </section>
  <section class="routines">
    <button data-routine="circle">Circle</button>
    <button data-routine="triangle">Triangle</button>
    <button data-routine="backforth">Back/Forth</button>
    <button data-routine="dance">Dance</button>
    <button data-routine="orbit">Orbit</button>
  </section>
  <div class="routineStatus" id="routineStatus"></div>
</main>
<script>
const pad = document.getElementById("pad");
const knob = document.getElementById("knob");
const statusEl = document.getElementById("status");
const leftEl = document.getElementById("left");
const rightEl = document.getElementById("right");
const estopEl = document.getElementById("estop");
const cameraHostEl = document.getElementById("cameraHost");
const cameraToggleEl = document.getElementById("cameraToggle");
const cameraOpenEl = document.getElementById("cameraOpen");
const cameraFrameEl = document.getElementById("cameraFrame");
const cameraViewEl = document.getElementById("cameraView");
const gamepadEl = document.getElementById("gamepad");
const speedEl = document.getElementById("speed");
const speedValueEl = document.getElementById("speedValue");
const durationEl = document.getElementById("duration");
const durationValueEl = document.getElementById("durationValue");
const turnEl = document.getElementById("turn");
const turnValueEl = document.getElementById("turnValue");
const routineStatusEl = document.getElementById("routineStatus");
let active = false;
let routineActive = false;
let gamepadActive = false;
let gamepadWasMoving = false;
let lastGamepadSend = 0;
let vx = 0;
let vy = 0;
let timer = null;
let cameraOn = false;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function fmt(v) { return Number(v).toFixed(2); }
function deadzone(v, z = 0.12) {
  const a = Math.abs(v);
  if (a < z) return 0;
  return Math.sign(v) * ((a - z) / (1 - z));
}
async function post(path) { try { await fetch(path, { method: "POST", cache: "no-store" }); } catch (_) {} }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function cleanHost(value) {
  return value.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
}

function cameraBase() {
  return `http://${cleanHost(cameraHostEl.value)}`;
}

function syncCameraLinks() {
  const base = cameraBase();
  cameraOpenEl.href = `${base}/`;
  if (cameraOn) {
    cameraViewEl.src = `${base}:81/stream?${Date.now()}`;
  }
}

function setCamera(on) {
  cameraOn = on;
  cameraFrameEl.classList.toggle("on", cameraOn);
  cameraToggleEl.textContent = cameraOn ? "Hide" : "Camera";
  if (cameraOn) {
    syncCameraLinks();
  } else {
    cameraViewEl.removeAttribute("src");
  }
}

function updateKnob(clientX, clientY) {
  const r = pad.getBoundingClientRect();
  const max = Math.min(r.width, r.height) * 0.42;
  const dx = clamp(clientX - (r.left + r.width / 2), -max, max);
  const dy = clamp(clientY - (r.top + r.height / 2), -max, max);
  vx = dx / max;
  vy = -dy / max;
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
}

function tankFromAxes(x, y) {
  const speed = Number(speedEl.value);
  const turn = Number(turnEl.value);
  let left = y + x * turn;
  let right = y - x * turn;
  const mag = Math.max(1, Math.abs(left), Math.abs(right));
  return [left / mag * speed, right / mag * speed];
}

function tankFromPad() { return tankFromAxes(vx, vy); }

async function sendTank(left, right, durationMs = 0) {
  leftEl.textContent = fmt(left);
  rightEl.textContent = fmt(right);
  const durationQuery = durationMs > 0 ? `&duration_ms=${Math.round(durationMs)}` : "";
  await post(`/api/tank?left=${left.toFixed(3)}&right=${right.toFixed(3)}${durationQuery}`);
}

async function sendDrive() {
  if (!active) return;
  const [left, right] = tankFromPad();
  await sendTank(left, right);
}

function start(e) {
  routineActive = false;
  routineStatusEl.textContent = "";
  active = true;
  pad.setPointerCapture(e.pointerId);
  updateKnob(e.clientX, e.clientY);
  sendDrive();
  timer = setInterval(sendDrive, 66);
}

async function end() {
  active = false;
  routineActive = false;
  routineStatusEl.textContent = "";
  clearInterval(timer);
  timer = null;
  vx = 0; vy = 0;
  knob.style.transform = "translate(0, 0)";
  leftEl.textContent = "0.00";
  rightEl.textContent = "0.00";
  await post("/api/stop");
}

function firstGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const pad of pads) {
    if (pad && pad.connected) return pad;
  }
  return null;
}

async function pollGamepad(now) {
  const pad = firstGamepad();
  gamepadActive = !!pad;
  gamepadEl.textContent = pad ? "on" : "off";

  if (!pad || active || routineActive) {
    requestAnimationFrame(pollGamepad);
    return;
  }

  const x = deadzone(pad.axes[0] || 0);
  const y = -deadzone(pad.axes[1] || 0);
  const moving = Math.abs(x) > 0 || Math.abs(y) > 0;

  if (moving && now - lastGamepadSend > 66) {
    const [left, right] = tankFromAxes(x, y);
    await sendTank(left, right);
    lastGamepadSend = now;
    gamepadWasMoving = true;
  } else if (!moving && gamepadWasMoving) {
    gamepadWasMoving = false;
    leftEl.textContent = "0.00";
    rightEl.textContent = "0.00";
    await post("/api/stop");
  }

  requestAnimationFrame(pollGamepad);
}

function routineSpeed() {
  return Number(speedEl.value);
}

function timedDurationMs() {
  return Number(durationEl.value) * 1000;
}

function timedPlan(name) {
  const speed = routineSpeed();
  const plans = {
    forward: [speed, speed],
    reverse: [-speed, -speed],
    left: [-speed, speed],
    right: [speed, -speed],
  };
  return plans[name] || [0, 0];
}

async function runTimedMove(name) {
  routineActive = false;
  active = false;
  clearInterval(timer);
  timer = null;
  const ms = timedDurationMs();
  const [left, right] = timedPlan(name);
  routineStatusEl.textContent = `${name} ${Number(durationEl.value).toFixed(2)}s @ ${Number(speedEl.value).toFixed(2)}`;
  await sendTank(left, right, ms);
  await sleep(ms);
  leftEl.textContent = "0.00";
  rightEl.textContent = "0.00";
  routineStatusEl.textContent = "";
  await post("/api/stop");
}

function routinePlan(name) {
  const s = routineSpeed();
  const spin = s;
  const turnOuter = s;
  const turnInner = Math.max(0.45, turnOuter * 0.45);
  const plans = {
    circle: [
      [turnInner, turnOuter, 4200],
    ],
    orbit: [
      [turnOuter, turnInner, 4200],
    ],
    triangle: [
      [s, s, 1150],
      [spin, -spin, 520],
      [s, s, 1150],
      [spin, -spin, 520],
      [s, s, 1150],
      [spin, -spin, 520],
    ],
    backforth: [
      [s, s, 1150],
      [0, 0, 250],
      [-s, -s, 900],
      [0, 0, 250],
      [s, -s, 450],
      [-s, s, 450],
    ],
    dance: [
      [spin, -spin, 420],
      [-spin, spin, 420],
      [s, s, 650],
      [-s, -s, 520],
      [turnInner, turnOuter, 700],
      [turnOuter, turnInner, 700],
      [0, 0, 180],
      [spin, -spin, 360],
      [-spin, spin, 360],
    ],
  };
  return plans[name] || [];
}

async function holdTank(left, right, ms) {
  const startMs = performance.now();
  while (routineActive && performance.now() - startMs < ms) {
    await sendTank(left, right);
    await sleep(66);
  }
}

async function runRoutine(name) {
  routineActive = false;
  await post("/api/stop");
  await sleep(120);
  routineActive = true;
  active = false;
  gamepadWasMoving = false;
  routineStatusEl.textContent = `running ${name}`;
  const plan = routinePlan(name);

  for (const [left, right, ms] of plan) {
    if (!routineActive) break;
    await holdTank(left, right, ms);
    await holdTank(0, 0, 160);
  }

  routineActive = false;
  leftEl.textContent = "0.00";
  rightEl.textContent = "0.00";
  routineStatusEl.textContent = "";
  await post("/api/stop");
}

pad.addEventListener("pointerdown", start);
pad.addEventListener("pointermove", e => { if (active) updateKnob(e.clientX, e.clientY); });
pad.addEventListener("pointerup", end);
pad.addEventListener("pointercancel", end);
document.getElementById("stop").onclick = end;
document.getElementById("estopButton").onclick = async () => { await post("/api/estop"); await refresh(); };
document.getElementById("clearButton").onclick = async () => { await post("/api/clear"); await refresh(); };
cameraToggleEl.onclick = () => setCamera(!cameraOn);
cameraHostEl.addEventListener("change", syncCameraLinks);
speedEl.addEventListener("input", () => { speedValueEl.textContent = Number(speedEl.value).toFixed(2); });
durationEl.addEventListener("input", () => { durationValueEl.textContent = `${Number(durationEl.value).toFixed(2)}s`; });
turnEl.addEventListener("input", () => { turnValueEl.textContent = Number(turnEl.value).toFixed(2); });
document.querySelectorAll("[data-timed]").forEach(button => {
  button.addEventListener("click", () => runTimedMove(button.dataset.timed));
});
document.querySelectorAll("[data-routine]").forEach(button => {
  button.addEventListener("click", () => runRoutine(button.dataset.routine));
});

async function refresh() {
  try {
    const res = await fetch("/api/status", { cache: "no-store" });
    const s = await res.json();
    const hold = s.command_expires_in_ms > 0 ? ` | hold ${(s.command_expires_in_ms / 1000).toFixed(1)}s` : "";
    statusEl.textContent = `${s.ip} | ${s.left_now.toFixed(2)}, ${s.right_now.toFixed(2)}${hold}`;
    estopEl.textContent = s.estop;
  } catch (_) {
    statusEl.textContent = "offline";
  }
}

setInterval(refresh, 500);
window.addEventListener("gamepadconnected", e => { gamepadEl.textContent = "on"; });
window.addEventListener("gamepaddisconnected", async e => {
  gamepadEl.textContent = "off";
  gamepadWasMoving = false;
  await post("/api/stop");
});
requestAnimationFrame(pollGamepad);
refresh();
</script>
</body>
</html>
)rawliteral";

static bool wifiConfigured() {
  return strlen(WIFI_SSID) > 0 && strcmp(WIFI_SSID, "YOUR_SSID") != 0;
}

static void forceMotorPinsLow() {
  pinMode(PIN_LEFT_RPWM, OUTPUT);
  pinMode(PIN_LEFT_LPWM, OUTPUT);
  pinMode(PIN_RIGHT_RPWM, OUTPUT);
  pinMode(PIN_RIGHT_LPWM, OUTPUT);
  digitalWrite(PIN_LEFT_RPWM, LOW);
  digitalWrite(PIN_LEFT_LPWM, LOW);
  digitalWrite(PIN_RIGHT_RPWM, LOW);
  digitalWrite(PIN_RIGHT_LPWM, LOW);
}

static float clampUnit(float value) {
  if (value > 1.0f) return 1.0f;
  if (value < -1.0f) return -1.0f;
  return value;
}

static void configureTrack(TrackChannel& track) {
  ledcSetup(track.rpwmChannel, PWM_FREQ, PWM_RES_BITS);
  ledcAttachPin(track.rpwmPin, track.rpwmChannel);
  ledcSetup(track.lpwmChannel, PWM_FREQ, PWM_RES_BITS);
  ledcAttachPin(track.lpwmPin, track.lpwmChannel);
  ledcWrite(track.rpwmChannel, 0);
  ledcWrite(track.lpwmChannel, 0);
}

static void writeTrackOutput(TrackChannel& track, float speed) {
  speed = clampUnit(speed);
  if (track.inverted) speed = -speed;

  const float capped = speed * DUTY_CAP;
  const int duty = int(fabs(capped) * PWM_MAX);

  if (capped >= 0.0f) {
    ledcWrite(track.rpwmChannel, duty);
    ledcWrite(track.lpwmChannel, 0);
  } else {
    ledcWrite(track.rpwmChannel, 0);
    ledcWrite(track.lpwmChannel, duty);
  }
}

static void stopTracks() {
  leftTrack.target = 0.0f;
  rightTrack.target = 0.0f;
}

static void forceOutputsOff() {
  stopTracks();
  leftTrack.current = 0.0f;
  rightTrack.current = 0.0f;
  writeTrackOutput(leftTrack, 0.0f);
  writeTrackOutput(rightTrack, 0.0f);
}

static unsigned long boundedHoldMs(unsigned long holdMs) {
  if (holdMs == 0) return COMMAND_TIMEOUT_MS;
  if (holdMs > MAX_TIMED_DRIVE_MS) return MAX_TIMED_DRIVE_MS;
  return holdMs;
}

static bool hasExpired(unsigned long now, unsigned long deadline) {
  return static_cast<long>(now - deadline) >= 0;
}

static void setDriveTargets(float left, float right, unsigned long holdMs = COMMAND_TIMEOUT_MS) {
  if (estop) return;

  const unsigned long now = millis();
  leftTrack.target = clampUnit(left);
  rightTrack.target = clampUnit(right);
  lastCommandMs = now;
  commandExpiresMs = now + boundedHoldMs(holdMs);
}

static float slew(float current, float target) {
  const float delta = target - current;
  if (delta > SLEW_PER_TICK) return current + SLEW_PER_TICK;
  if (delta < -SLEW_PER_TICK) return current - SLEW_PER_TICK;
  return target;
}

static void stepTowardTarget(TrackChannel& track) {
  track.current = slew(track.current, track.target);
  writeTrackOutput(track, track.current);
}

static void handleDriveCommand(float left, float right, unsigned long holdMs = COMMAND_TIMEOUT_MS) {
  setDriveTargets(left, right, holdMs);
}

static void handleTwistCommand(float velocity, float turn, unsigned long holdMs = COMMAND_TIMEOUT_MS) {
  const float left = velocity + turn * TURN_SCALE;
  const float right = velocity - turn * TURN_SCALE;
  setDriveTargets(left, right, holdMs);
}

static void handleTextCommand(char* text, Print* out) {
  while (*text == ' ' || *text == '\t') ++text;
  if (*text == '\0') return;

  const char command = *text;

  if (command == 'T' || command == 't') {
    float left = 0.0f;
    float right = 0.0f;
    if (sscanf(text + 1, "%f %f", &left, &right) == 2) {
      handleDriveCommand(left, right);
      if (out) out->println(estop ? F("ERR estop latched") : F("OK tank"));
    } else if (out) {
      out->println(F("ERR T expected left right"));
    }
    return;
  }

  if (command == 'D' || command == 'd') {
    float velocity = 0.0f;
    float turn = 0.0f;
    if (sscanf(text + 1, "%f %f", &velocity, &turn) == 2) {
      handleTwistCommand(velocity, turn);
      if (out) out->println(estop ? F("ERR estop latched") : F("OK drive"));
    } else if (out) {
      out->println(F("ERR D expected velocity turn"));
    }
    return;
  }

  if (command == 'S' || command == 's') {
    stopTracks();
    const unsigned long now = millis();
    lastCommandMs = now;
    commandExpiresMs = now;
    if (out) out->println(F("OK stop"));
    return;
  }

  if (command == 'E' || command == 'e') {
    estop = true;
    forceOutputsOff();
    if (out) out->println(F("OK estop"));
    return;
  }

  if (command == 'C' || command == 'c') {
    estop = false;
    const unsigned long now = millis();
    lastCommandMs = now;
    commandExpiresMs = now + COMMAND_TIMEOUT_MS;
    if (out) out->println(F("OK clear"));
    return;
  }

  if (out) out->println(F("ERR unknown command"));
}

static void printHelp(Print& out) {
  out.println(F("ESP32 chassis drive"));
  out.println(F("UDP text commands on port 4210:"));
  out.println(F("  T <left> <right>     tank drive, -1.0..1.0"));
  out.println(F("  D <velocity> <turn>  twist drive, -1.0..1.0"));
  out.println(F("  S                    stop"));
  out.println(F("  E                    latch e-stop"));
  out.println(F("  C                    clear e-stop"));
  out.println(F("Serial commands:"));
  out.println(F("  help"));
  out.println(F("  status"));
  out.println(F("  T/D/S/E/C commands also work over serial"));
}

static void printStatus(Print& out) {
  out.print(F("ip="));
  out.print(WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : String("not-connected"));
  out.print(F(" port="));
  out.print(UDP_PORT);
  out.print(F(" estop="));
  out.print(estop ? F("latched") : F("clear"));
  out.print(F(" left_target="));
  out.print(leftTrack.target, 3);
  out.print(F(" left_now="));
  out.print(leftTrack.current, 3);
  out.print(F(" right_target="));
  out.print(rightTrack.target, 3);
  out.print(F(" right_now="));
  out.print(rightTrack.current, 3);
  out.print(F(" duty_cap="));
  out.print(DUTY_CAP, 2);
  out.print(F(" timeout_ms="));
  out.print(COMMAND_TIMEOUT_MS);
  out.print(F(" pins L_RPWM="));
  out.print(PIN_LEFT_RPWM);
  out.print(F(" L_LPWM="));
  out.print(PIN_LEFT_LPWM);
  out.print(F(" R_RPWM="));
  out.print(PIN_RIGHT_RPWM);
  out.print(F(" R_LPWM="));
  out.println(PIN_RIGHT_LPWM);
}

static void handleSerialLine(String line, Print& out) {
  line.trim();
  if (line.length() == 0) return;

  String lower = line;
  lower.toLowerCase();
  if (lower == "help") {
    printHelp(out);
    return;
  }

  if (lower == "status") {
    printStatus(out);
    return;
  }

  char buffer[96];
  line.toCharArray(buffer, sizeof(buffer));
  handleTextCommand(buffer, &out);
}

static void pollConsole(Stream& stream, Print& out, String& line) {
  while (stream.available() > 0) {
    const char c = (char)stream.read();

    if (c == '\r') {
      continue;
    }

    if (c == '\n') {
      handleSerialLine(line, out);
      line = "";
    } else if (line.length() < 120) {
      line += c;
    } else {
      line = "";
      out.println(F("ERR line too long"));
    }
  }
}

static void pollSerialConsoles() {
  pollConsole(Serial, Serial, usbSerialLine);
  pollConsole(Serial0, Serial0, uartSerialLine);
}

static void pollUdp() {
  if (!udpActive) return;

  int packetSize = 0;
  while ((packetSize = udp.parsePacket()) > 0) {
    const int len = udp.read(udpBuffer, sizeof(udpBuffer) - 1);
    if (len > 0) {
      udpBuffer[len] = '\0';
      handleTextCommand(udpBuffer, nullptr);
    }
  }
}

static void sendCorsHeaders() {
  httpServer.sendHeader(F("Access-Control-Allow-Origin"), F("*"));
  httpServer.sendHeader(F("Access-Control-Allow-Methods"), F("GET,POST,OPTIONS"));
  httpServer.sendHeader(F("Access-Control-Allow-Headers"), F("Content-Type"));
  httpServer.sendHeader(F("Cache-Control"), F("no-store"));
}

static void sendJsonStatus() {
  const unsigned long now = millis();
  const unsigned long remainingMs = (!estop && !hasExpired(now, commandExpiresMs)) ? commandExpiresMs - now : 0;
  String body;
  body.reserve(430);
  body += F("{\"ip\":\"");
  body += WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : String("not-connected");
  body += F("\",\"udp_port\":");
  body += UDP_PORT;
  body += F(",\"http_port\":");
  body += HTTP_PORT;
  body += F(",\"estop\":\"");
  body += estop ? F("latched") : F("clear");
  body += F("\",\"left_target\":");
  body += String(leftTrack.target, 3);
  body += F(",\"left_now\":");
  body += String(leftTrack.current, 3);
  body += F(",\"right_target\":");
  body += String(rightTrack.target, 3);
  body += F(",\"right_now\":");
  body += String(rightTrack.current, 3);
  body += F(",\"duty_cap\":");
  body += String(DUTY_CAP, 2);
  body += F(",\"timeout_ms\":");
  body += COMMAND_TIMEOUT_MS;
  body += F(",\"timed_drive_max_ms\":");
  body += MAX_TIMED_DRIVE_MS;
  body += F(",\"command_expires_in_ms\":");
  body += remainingMs;
  body += F(",\"pins\":{\"left_rpwm\":");
  body += PIN_LEFT_RPWM;
  body += F(",\"left_lpwm\":");
  body += PIN_LEFT_LPWM;
  body += F(",\"right_rpwm\":");
  body += PIN_RIGHT_RPWM;
  body += F(",\"right_lpwm\":");
  body += PIN_RIGHT_LPWM;
  body += F("}}");

  sendCorsHeaders();
  httpServer.send(200, F("application/json"), body);
}

static bool readFloatArg(const char* name, float& value) {
  if (!httpServer.hasArg(name)) return false;
  value = httpServer.arg(name).toFloat();
  return true;
}

static unsigned long readDurationMsArg() {
  if (!httpServer.hasArg("duration_ms")) return COMMAND_TIMEOUT_MS;

  const float requestedMs = httpServer.arg("duration_ms").toFloat();
  if (requestedMs <= 0.0f) return COMMAND_TIMEOUT_MS;
  if (requestedMs > static_cast<float>(MAX_TIMED_DRIVE_MS)) return MAX_TIMED_DRIVE_MS;
  return static_cast<unsigned long>(requestedMs);
}

static void sendApiOk(const __FlashStringHelper* action, unsigned long durationMs = 0) {
  sendCorsHeaders();
  String body = F("{\"ok\":true,\"action\":\"");
  body += action;
  if (durationMs > 0) {
    body += F("\",\"duration_ms\":");
    body += durationMs;
    body += F("}");
  } else {
    body += F("\"}");
  }
  httpServer.send(200, F("application/json"), body);
}

static void sendApiError(const __FlashStringHelper* message) {
  sendCorsHeaders();
  String body = F("{\"ok\":false,\"error\":\"");
  body += message;
  body += F("\"}");
  httpServer.send(400, F("application/json"), body);
}

static void handleOptions() {
  sendCorsHeaders();
  httpServer.send(204);
}

static void handleIndex() {
  sendCorsHeaders();
  httpServer.send_P(200, PSTR("text/html"), INDEX_HTML);
}

static void handleStatusApi() {
  sendJsonStatus();
}

static void handleTankApi() {
  float left = 0.0f;
  float right = 0.0f;
  if (!readFloatArg("left", left) || !readFloatArg("right", right)) {
    sendApiError(F("tank needs left and right"));
    return;
  }

  const unsigned long durationMs = readDurationMsArg();
  setDriveTargets(left, right, durationMs);
  sendApiOk(estop ? F("estop") : F("tank"), durationMs);
}

static void handleTwistApi() {
  float velocity = 0.0f;
  float turn = 0.0f;
  if (!readFloatArg("v", velocity) || !readFloatArg("w", turn)) {
    sendApiError(F("twist needs v and w"));
    return;
  }

  const unsigned long durationMs = readDurationMsArg();
  handleTwistCommand(velocity, turn, durationMs);
  sendApiOk(estop ? F("estop") : F("twist"), durationMs);
}

static void handleStopApi() {
  stopTracks();
  const unsigned long now = millis();
  lastCommandMs = now;
  commandExpiresMs = now;
  sendApiOk(F("stop"));
}

static void handleEstopApi() {
  estop = true;
  forceOutputsOff();
  sendApiOk(F("estop"));
}

static void handleClearApi() {
  estop = false;
  const unsigned long now = millis();
  lastCommandMs = now;
  commandExpiresMs = now + COMMAND_TIMEOUT_MS;
  sendApiOk(F("clear"));
}

static void handleNotFound() {
  if (httpServer.method() == HTTP_OPTIONS) {
    handleOptions();
    return;
  }

  sendCorsHeaders();
  httpServer.send(404, F("application/json"), F("{\"ok\":false,\"error\":\"not found\"}"));
}

static void startHttpApi() {
  httpServer.on(F("/"), HTTP_GET, handleIndex);
  httpServer.on(F("/api/status"), HTTP_GET, handleStatusApi);
  httpServer.on(F("/api/tank"), HTTP_POST, handleTankApi);
  httpServer.on(F("/api/twist"), HTTP_POST, handleTwistApi);
  httpServer.on(F("/api/stop"), HTTP_POST, handleStopApi);
  httpServer.on(F("/api/estop"), HTTP_POST, handleEstopApi);
  httpServer.on(F("/api/clear"), HTTP_POST, handleClearApi);
  httpServer.onNotFound(handleNotFound);
  httpServer.begin();
  httpActive = true;
}

static void pollHttp() {
  if (httpActive) httpServer.handleClient();
}

static void startOta() {
  ArduinoOTA.setHostname(OTA_HOSTNAME);
  if (strlen(OTA_PASSWORD) > 0) {
    ArduinoOTA.setPassword(OTA_PASSWORD);
  }

  ArduinoOTA.onStart([]() {
    forceOutputsOff();
    printBoth(F("OTA update starting; motor outputs forced off"));
  });
  ArduinoOTA.onEnd([]() {
    forceOutputsOff();
    printBoth(F("OTA update complete"));
  });
  ArduinoOTA.onError([](ota_error_t error) {
    forceOutputsOff();
    Serial.print(F("OTA error "));
    Serial.println((int)error);
    Serial0.print(F("OTA error "));
    Serial0.println((int)error);
  });

  ArduinoOTA.begin();
  otaActive = true;
}

static void pollOta() {
  if (otaActive) ArduinoOTA.handle();
}

static void printBoth(const __FlashStringHelper* text) {
  Serial.println(text);
  Serial0.println(text);
}

static void connectWifi() {
  if (!wifiConfigured()) {
    printBoth(F("WiFi not configured; serial drive commands are active"));
    return;
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print(F("WiFi connecting"));
  Serial0.print(F("WiFi connecting"));
  for (int tries = 0; WiFi.status() != WL_CONNECTED && tries < 40; ++tries) {
    delay(300);
    Serial.print('.');
    Serial0.print('.');
  }

  Serial.println();
  Serial0.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print(F("robot ip: "));
    Serial.print(WiFi.localIP());
    Serial.print(F(" port: "));
    Serial.println(UDP_PORT);
    Serial0.print(F("robot ip: "));
    Serial0.print(WiFi.localIP());
    Serial0.print(F(" port: "));
    Serial0.println(UDP_PORT);
  } else {
    printBoth(F("WiFi connection failed; serial drive commands are active"));
  }
}

void setup() {
  forceMotorPinsLow();

  Serial.begin(115200);
  Serial0.begin(115200);
  delay(1500);

  forceMotorPinsLow();
  configureTrack(leftTrack);
  configureTrack(rightTrack);
  forceOutputsOff();
  lastCommandMs = millis();
  commandExpiresMs = lastCommandMs + COMMAND_TIMEOUT_MS;

  Serial.println();
  Serial0.println();
  printBoth(F("ESP32 chassis drive starting"));
  connectWifi();
  if (WiFi.status() == WL_CONNECTED) {
    udpActive = udp.begin(UDP_PORT) == 1;
    printBoth(udpActive ? F("UDP drive active") : F("UDP start failed"));
    startHttpApi();
    printBoth(F("HTTP API active"));
    startOta();
    printBoth(F("OTA update active"));
  }
  printBoth(F("ESP32 chassis drive ready. Type help."));
}

void loop() {
  pollSerialConsoles();
  pollUdp();
  pollHttp();
  pollOta();

  const unsigned long now = millis();
  if (now - lastTickMs < CONTROL_TICK_MS) {
    return;
  }
  lastTickMs = now;

  if (!estop && hasExpired(now, commandExpiresMs)) {
    stopTracks();
  }

  stepTowardTarget(leftTrack);
  stepTowardTarget(rightTrack);
}

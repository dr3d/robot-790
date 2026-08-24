// chassis_drive.ino
// Minimal tank-drive firmware for ESP32-S3 + 2x BTS7960 + 2x GM25-370 (9V).
// No framework. Listens for UDP text commands over WiFi, drives the tracks,
// stops itself if commands stop arriving.
//
// Commands (UDP text, port 4210):
//   T <left> <right>   tank drive, each -1.0..1.0   e.g. "T 1 1", "T -1 1", "T 0 0"
//   D <v> <w>          twist: forward + turn, -1..1  (mixed to tank)
//   S                  stop now
//   E                  e-stop (latches off)
//   C                  clear e-stop latch
//
// Safety baked in (invisible to sender):
//   - DUTY_CAP scales -1..1 to a safe max PWM (9V motors on ~12.8V battery)
//   - watchdog stops motors if no command for CMD_TIMEOUT_MS
//   - slew limits how fast commanded speed can change
//
// Send from anything that does UDP, e.g. Python:
//   import socket
//   s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
//   s.sendto(b"T 1 1", ("192.168.1.50", 4210))

#include <WiFi.h>
#include <WiFiUdp.h>

// ---------------- user config ----------------
const char* WIFI_SSID = "YOUR_SSID";
const char* WIFI_PASS = "YOUR_PASS";
const uint16_t UDP_PORT = 4210;

// Pin map (matches the wiring diagram; see notes below).
const int RPWM_A = 4;   // motor A forward PWM
const int LPWM_A = 5;   // motor A reverse PWM
const int RPWM_B = 6;   // motor B forward PWM
const int LPWM_B = 7;   // motor B reverse PWM
// R_EN / L_EN on both drivers are tied to 3.3V in hardware (not GPIO).

// Safety / tuning.
const float DUTY_CAP      = 0.62f;  // 9V / ~12.8V. caps top speed so motors never overvolt.
const uint32_t CMD_TIMEOUT_MS = 400; // no command for this long -> stop.
const float SLEW_PER_TICK = 0.04f;   // max change in normalized speed per control tick.
const float TURN_SCALE    = 1.0f;    // how aggressive D-command turning is.

// PWM setup (LEDC).
const int PWM_FREQ = 20000;          // 20 kHz, above audible.
const int PWM_RES  = 10;             // 10-bit: 0..1023.
const int PWM_MAX  = (1 << PWM_RES) - 1;
const int CH_RPWM_A = 0, CH_LPWM_A = 1, CH_RPWM_B = 2, CH_LPWM_B = 3;

const uint32_t TICK_MS = 20;         // control loop period (50 Hz).
// ---------------------------------------------

WiFiUDP udp;
char rxbuf[64];

float tgtL = 0, tgtR = 0;            // target normalized speeds, -1..1
float curL = 0, curR = 0;            // slewed actual speeds
bool  estop = false;
uint32_t lastCmdMs = 0;
uint32_t lastTickMs = 0;

float clampf(float v, float lo, float hi) { return v < lo ? lo : (v > hi ? hi : v); }

float slew(float cur, float tgt) {
  float d = tgt - cur;
  if (d >  SLEW_PER_TICK) d =  SLEW_PER_TICK;
  if (d < -SLEW_PER_TICK) d = -SLEW_PER_TICK;
  return cur + d;
}

// Drive one motor channel from a signed normalized speed.
void driveMotor(int chFwd, int chRev, float speed) {
  speed = clampf(speed, -1.0f, 1.0f) * DUTY_CAP;
  int duty = (int)(fabs(speed) * PWM_MAX);
  if (speed >= 0) { ledcWrite(chFwd, duty); ledcWrite(chRev, 0); }
  else            { ledcWrite(chFwd, 0);    ledcWrite(chRev, duty); }
}

void setTargets(float l, float r) {
  tgtL = clampf(l, -1.0f, 1.0f);
  tgtR = clampf(r, -1.0f, 1.0f);
  lastCmdMs = millis();
}

void handleCommand(char* s) {
  // Trim leading spaces.
  while (*s == ' ') s++;
  char c = *s;

  if (c == 'T' || c == 't') {
    float l = 0, r = 0;
    if (sscanf(s + 1, "%f %f", &l, &r) == 2 && !estop) setTargets(l, r);
  }
  else if (c == 'D' || c == 'd') {
    float v = 0, w = 0;
    if (sscanf(s + 1, "%f %f", &v, &w) == 2 && !estop) {
      float l = v + w * TURN_SCALE;
      float r = v - w * TURN_SCALE;
      setTargets(l, r);
    }
  }
  else if (c == 'S' || c == 's') { setTargets(0, 0); }
  else if (c == 'E' || c == 'e') { estop = true;  setTargets(0, 0); }
  else if (c == 'C' || c == 'c') { estop = false; lastCmdMs = millis(); }
}

void setup() {
  Serial.begin(115200);

  ledcSetup(CH_RPWM_A, PWM_FREQ, PWM_RES); ledcAttachPin(RPWM_A, CH_RPWM_A);
  ledcSetup(CH_LPWM_A, PWM_FREQ, PWM_RES); ledcAttachPin(LPWM_A, CH_LPWM_A);
  ledcSetup(CH_RPWM_B, PWM_FREQ, PWM_RES); ledcAttachPin(RPWM_B, CH_RPWM_B);
  ledcSetup(CH_LPWM_B, PWM_FREQ, PWM_RES); ledcAttachPin(LPWM_B, CH_LPWM_B);
  driveMotor(CH_RPWM_A, CH_LPWM_A, 0);
  driveMotor(CH_RPWM_B, CH_LPWM_B, 0);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("connecting");
  while (WiFi.status() != WL_CONNECTED) { delay(300); Serial.print("."); }
  Serial.printf("\nrobot ip: %s  port: %u\n", WiFi.localIP().toString().c_str(), UDP_PORT);

  udp.begin(UDP_PORT);
  lastCmdMs = millis();
}

void loop() {
  // 1. Drain any waiting UDP packets (latest wins naturally — we process all,
  //    last one sets the target).
  int n;
  while ((n = udp.parsePacket()) > 0) {
    int len = udp.read(rxbuf, sizeof(rxbuf) - 1);
    if (len > 0) { rxbuf[len] = '\0'; handleCommand(rxbuf); }
  }

  uint32_t now = millis();
  if (now - lastTickMs < TICK_MS) return;
  lastTickMs = now;

  // 2. Watchdog: no command recently -> force stop targets.
  if (now - lastCmdMs > CMD_TIMEOUT_MS) { tgtL = 0; tgtR = 0; }

  // 3. Slew toward targets and drive.
  curL = slew(curL, tgtL);
  curR = slew(curR, tgtR);
  driveMotor(CH_RPWM_A, CH_LPWM_A, curL);
  driveMotor(CH_RPWM_B, CH_LPWM_B, curR);
}

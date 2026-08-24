# Tank Chassis Build Reference

Drive base for the house-pet robot. ESP32-S3 controls two tracked motors over WiFi.
Open-loop v1: joystick/UDP teleop, no encoders wired yet.

---

## 1. What this is and why it's built this way

The chassis is a **self-contained peer**, not a subsystem of anything else. It has its own
battery, its own microcontroller, and its own command API on a network port. The rest of the
robot (brain, eyes) talks to it over WiFi and doesn't know or care what's inside.

The controller is an ESP32-S3 rather than a Raspberry Pi for two reasons that matter:

- **Real-time.** A hard real-time motor loop can't be guaranteed on non-RT Linux. The S3 pins
  the motor loop to a core and nothing preempts it.
- **ADC.** No Pi has an analog input. The BTS7960's current-sense (IS) pins need one. Even
  though v1 doesn't use current sensing, the option stays open on the S3 and never would on a Pi.

The S3 is also the same chip used for other appendages, so every limb is the same kind of thing:
3.3V domain, WiFi, one real-time job, listening on a port.

### Command / safety split

The sender (joystick, brain, script) proposes intent. The firmware enforces limits:

| Concern | Enforced where | How |
|---|---|---|
| Motor overvoltage | firmware | duty cap — commanded 1.0 maps to 62% PWM, never more |
| Runaway on comms loss | firmware | watchdog — no command for 400 ms → stop |
| Jerk / gear shock | firmware | slew limit on speed change |
| Wiring fault | hardware | 10 A inline fuse |
| Stall current | hardware | driver headroom (43 A part on a 4.5 A stall motor) |

The sender never knows about any of it. It says "full speed"; the firmware makes that safe.

---

## 2. Components

| Part | Spec | Role |
|---|---|---|
| XiaoR Geek tracked chassis | 300×230×124 mm, aluminum, 1.2 kg | base, tracks, motor mounts |
| 2× GM25-370 gearmotor | 9 V, ~150 RPM, encoder onboard | drive |
| 2× IBT-2 (BTS7960) | 43 A H-bridge, one per motor | motor drivers |
| ESP32-S3 | N16R8 (16 MB flash / 8 MB PSRAM), dual-core 240 MHz | controller |
| LiFePO4 battery | 12.8 V 6 Ah, 33 A peak, 0.75 kg, F2 terminals | power |
| DC-DC buck | 12/24 V → 5 V 5 A, USB-C out | 5 V for the ESP32 |
| Inline fuse holder | ATC/ATO blade, **10 A** | main-line protection |
| SAE→F2 cable | 14 AWG, fused | battery connection + quick-disconnect |
| Charger | 14.6 V 2 A **LiFePO4** profile, alligator clips | charging (off-robot) |
| Wire | 16 AWG power, thinner for logic | interconnect |

### Motor numbers that drive the design

- Winding resistance ≈ **2 Ω** (9 V ÷ 4.5 A stall)
- Running load: ~200 mA typical, ~1.2 A max
- Stall: **4.5 A at rated 9 V**, and stall current scales with applied voltage —
  at 12.8 V battery that's ~6.4 A per motor, **~14 A if both stall at once**

The 33 A peak battery gives ~2.3× margin over that worst case, so a stall can't sag the rail
and brown out logic. The 10 A fuse rides above normal draw but under a sustained fault.

### Why 62% duty cap

Motors are 9 V. Battery is 12.8 V nominal, ~14.6 V straight off the charger.
9 ÷ 14.6 ≈ **0.62**. Capping duty there means the motors never see more than their rating
even at full charge, at the cost of top speed you don't want on a slow indoor pet.

---

## 3. Pinout — ESP32-S3 to the two drivers

Each IBT-2 has an **8-pin logic header** (separate from the big screw terminal block).

### Driver A — left track

| IBT-2 pin | Connects to |
|---|---|
| RPWM | **GPIO 4** |
| LPWM | **GPIO 5** |
| R_EN | 3.3 V |
| L_EN | 3.3 V |
| VCC | 3.3 V |
| GND | ESP32 GND |
| R_IS | not connected (v1) |
| L_IS | not connected (v1) |

### Driver B — right track

| IBT-2 pin | Connects to |
|---|---|
| RPWM | **GPIO 6** |
| LPWM | **GPIO 7** |
| R_EN | 3.3 V |
| L_EN | 3.3 V |
| VCC | 3.3 V |
| GND | ESP32 GND |
| R_IS | not connected (v1) |
| L_IS | not connected (v1) |

Only RPWM/LPWM differ between boards. Everything else is shared rails.

### Reserved GPIO — do not use on the N16R8

| Pins | Why |
|---|---|
| 35, 36, 37 | octal PSRAM (this is the R8 part — these are taken) |
| 19, 20 | native USB D−/D+ |
| 26–32 | SPI flash |
| 0, 45, 46 | strapping pins |
| 43, 44 | UART0 console |

Safe working range is roughly **GPIO 1–14 and 38–42**. Motor pins 4–7 sit inside it.
If encoders get wired later: GPIO 9/10 (motor A, A/B) and 11/12 (motor B), with
**IS sense on ADC1 = GPIO 1–10**.

---

## 4. Motor wiring

Each motor has **6 wires**. Only two go to the driver.

| Wire | Function | v1 |
|---|---|---|
| **Red** | Motor + | → IBT-2 motor output screw terminal |
| **Black** | Motor − | → IBT-2 motor output screw terminal |
| Green | encoder GND | tape off |
| Blue | encoder Vcc (**3.3 V**, not 5 V) | tape off |
| Yellow | encoder A | tape off |
| White | encoder B | tape off |

Colors vary by batch — **trust the meter, not the chart**. The two wires reading ~2 Ω between
them are the motor pair. Everything else is encoder.

Leave the four encoder wires long and insulated. They cost nothing to keep and are the only
path to closed-loop control later.

Motor polarity doesn't matter electrically. If a track runs backward, swap red/black or fix it
in firmware.

---

## 5. Power chain

```
Battery (+) ──> [10 A fuse] ──> distribution ──┬──> buck 12→5 V ──USB-C──> ESP32-S3
                                                ├──> Driver A  B+ (screw terminal)
                                                └──> Driver B  B+ (screw terminal)

Battery (−) ──> star ground ───────────────────┬──> buck (−)
                                                ├──> Driver A  B− (screw terminal)
                                                ├──> Driver B  B− (screw terminal)
                                                └──> ESP32 GND + both driver GND header pins
```

### Grounding rules

- **Star topology.** All grounds meet at one point. Don't daisy-chain.
- **Frame is NOT ground.** The chassis is anodized aluminum — anodizing is an insulator, so
  frame paths are unreliable and variable. Run real wire. Keep the star point isolated from the
  frame (nylon washers / plastic-bodied terminal block).
- **Mount the IBT-2 on standoffs.** Keep the PCB underside and heatsinks off the frame.
- **Logic ground and power ground meet at the star**, but motor return current should not run
  through thin logic-ground wiring.

### Two rails you'll need to bus

Six connections want 3.3 V (R_EN, L_EN, VCC × 2 boards), several want GND. On the bench, a
breadboard's power rails handle this with zero building. For the final wiring, a small screw
terminal strip: one row bussed 3.3 V, one row GND.

### Polarity cautions

- The buck's input is **not** reverse-protected — its own label warns that reversing it destroys
  it. Meter before connecting.
- **SAE connectors are not polarity-keyed.** Verify with a meter after mating, and mark it.
- Header **VCC is 3.3 V logic supply**, never battery voltage. Battery goes to screw terminals only.

---

## 6. How the driver control works

Per motor: two PWM lines plus enable.

- **RPWM** — PWM here drives forward. Duty = speed.
- **LPWM** — PWM here drives reverse. Duty = speed.
- **Never both nonzero at once** (shoot-through).
- **R_EN / L_EN** — tied high (3.3 V), bridge always live.

So a signed speed maps to:

```
speed >= 0:  RPWM = duty,  LPWM = 0      (forward)
speed <  0:  RPWM = 0,     LPWM = duty   (reverse)
```

### Enable vs. zero rate — not the same thing

| Enable | PWM | Behavior |
|---|---|---|
| HIGH | > 0 | driving |
| HIGH | 0 | **stopped, actively braked, holds position** |
| LOW | anything | **coasts / freewheels**, PWM ignored |

Enable stays high always. "Stop" = PWM zero, which brakes and holds — the right behavior for a
pet that should stop where you let go rather than drift.

---

## 7. Command API

UDP text lines on port **4210**. Latest packet wins; dropped packets don't matter because the
sender streams.

| Send | Meaning |
|---|---|
| `T <left> <right>` | tank drive, each −1.0..1.0. `T 1 1` full ahead, `T -1 1` spin, `T 0 0` stop |
| `D <v> <w>` | twist: forward + turn, −1..1, mixed to tank |
| `S` | stop |
| `E` | e-stop, latches off |
| `C` | clear e-stop latch |

Mixing for `D`: `left = v + w`, `right = v - w`, clamped.

**Stream at ~15 Hz while driving.** The watchdog stops the robot after 400 ms of silence, so
continuous sending is both how you drive and how safety works — silence *is* the stop signal.

Test from any machine on the network:

```python
import socket, time
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
ip = ("192.168.1.50", 4210)      # the IP the board prints on boot
for _ in range(15):
    s.sendto(b"T 0.4 0.4", ip)   # creep forward ~1 s
    time.sleep(0.066)
s.sendto(b"S", ip)
```

---

## 8. PlatformIO setup

Project layout:

```
chassis/
├── platformio.ini
└── src/
    └── main.cpp        (the firmware — rename the .ino contents into this)
```

`platformio.ini`:

```ini
[env:esp32-s3-devkitc-1]
platform = espressif32
board = esp32-s3-devkitc-1
framework = arduino

; N16R8: 16 MB flash, 8 MB octal PSRAM
board_build.flash_mode = qio
board_build.arduino.memory_type = qio_opi
board_upload.flash_size = 16MB
board_build.partitions = default_16MB.csv

; USB CDC serial — required or you get no serial output on the S3
build_flags =
    -DARDUINO_USB_MODE=1
    -DARDUINO_USB_CDC_ON_BOOT=1

monitor_speed = 115200
upload_speed = 921600
```

Commands:

```bash
pio run                 # build
pio run -t upload       # flash
pio device monitor      # serial
```

If the port doesn't appear: hold **BOOT**, tap **RESET**, release BOOT — forces download mode.

WiFi must be **2.4 GHz**. The S3 cannot see 5 GHz networks.

---

## 9. Bring-up procedure

Never connect motor power to an unflashed board. Floating GPIOs on a live driver is how you get
an unexpected lurch.

**Stage 1 — flash alone.** USB only, nothing else wired. Flash the first-boot sketch (forces
motor pins low, prints chip info, connects WiFi, prints IP). Confirm serial output. Write down
the IP.

**Stage 2 — logic only, no battery.** Power down. Wire both driver logic headers (RPWM, LPWM,
EN, VCC, GND). Leave the screw terminals empty. Power the ESP32 on USB, flash the drive
firmware, send UDP commands, confirm they're received. Nothing can move — the drivers have no
motor supply.

**Stage 3 — tracks in the air.** Prop the chassis so both tracks spin free. This is the
important physical step. Have the SAE disconnect within reach as a kill switch. Meter polarity
everywhere. Then connect the battery.

**Stage 4 — smallest command.** `T 0.2 0` → left track creeps forward. Then `T 0 0.2` for the
right. Verify direction on each before increasing speed or putting it on the floor.

Watch for heat or smell in the first 30 seconds. Disconnect immediately if either.

---

## 10. Known open items

1. **BTS7960 logic threshold at 3.3 V.** The IBT-2 was designed around 5 V logic. Most trigger
   fine on the S3's 3.3 V, but if a motor runs weak or won't start despite correct wiring, that's
   the symptom. Fix: power header VCC at 5 V from the buck while keeping PWM signals at 3.3 V, or
   add a level shifter on the four PWM lines. Test at 3.3 V first.

2. **IS current-sense calibration** (only when adding current limiting). The IS output is load
   current ÷ ~8500 across an onboard resistor whose value varies by module. Stall one motor
   against a known current, measure the IS voltage, derive volts-per-amp, and set the trip from
   the measured curve. Don't assume the resistor value.

3. **Encoder connector pinout.** Confirm which of the 6 wires is which with a meter before
   wiring encoders. The 2 Ω pair is the motor; the rest is encoder.

4. **Battery mounting.** Cavity under the top platform is ~76×102×127 mm; the battery is
   90×70×101 mm, so it fits with room. Zip-tie through the frame slots, keep ties off the
   terminals, foam underneath, and leave one tie releasable — the pack comes off to charge.

---

## 11. Later additions (not in v1)

- **Encoders** → GPIO 9/10 and 11/12, encoder Vcc at **3.3 V** so the A/B outputs swing 0–3.3 V
  into the ESP32. Enables closed-loop velocity, straight-line driving, and odometry.
- **Current-sense trip** → IS pins to ADC1 (GPIO 1–10), cut PWM above ~4.5 A per motor.
- **BLE gamepad** → a second command source. Both a BLE callback and the UDP handler call the
  same `setTargets(l, r)`, so the drive core doesn't change. Add source arbitration (human
  overrides machine) only when there are two active commanders.

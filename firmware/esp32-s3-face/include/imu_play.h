#pragma once
#include <stdint.h>
#include <math.h>

// A gravity reference, not an absolute world pose. No compass or position estimate.
struct ImuPlay {
  float a[3] = {}, g[3] = {}, upright[3] = {};
  bool sampled = false, calibrated = false, moving = true;
  uint32_t sampleAt = 0, quietSince = 0, poseSince = 0, candidateSince = 0;
  uint32_t joltAt = 0, jolts = 0, seq = 0, reference = 0;
  int pose = 0, candidate = 0; // unknown, upright, tilted, upside_down, on_side
  bool fresh(uint32_t now) const { return sampled && uint32_t(now - sampleAt) < 500; }
  const char *poseName(uint32_t now) const {
    if (!fresh(now) || !calibrated || moving) return "unknown";
    return pose == 1 ? "upright" : pose == 2 ? "tilted" : pose == 3 ? "upside_down" : pose == 4 ? "on_side" : "unknown";
  }
  const char *motionName(uint32_t now) const {
    return !fresh(now) ? "unknown" : moving ? "moving" : "settled";
  }
  float magnitude() const { return sqrtf(a[0]*a[0] + a[1]*a[1] + a[2]*a[2]); }
  float tiltDegrees() const {
    const float n = magnitude();
    if (!calibrated || n < .01f) return NAN;
    const float dot = (a[0]*upright[0]+a[1]*upright[1]+a[2]*upright[2])/n;
    return acosf(fmaxf(-1.f, fminf(1.f, dot))) * 57.2957795f;
  }
  bool restoreUpright(const float *saved) {
    float n2 = 0;
    for (int i=0; i<3; ++i) {
      if (!isfinite(saved[i])) return false;
      n2 += saved[i]*saved[i];
    }
    if (n2 < .9f || n2 > 1.1f) return false;
    const float n = sqrtf(n2);
    for (int i=0; i<3; ++i) upright[i] = saved[i]/n;
    calibrated = true;
    pose = candidate = 0; // Saved reference is not a current sensor reading.
    ++reference; ++seq;
    return true;
  }
  bool setUpright(uint32_t now) {
    if (!fresh(now) || moving || uint32_t(now - quietSince) < 1000) return false;
    const float n = magnitude();
    if (n < .85f || n > 1.15f) return false;
    for (int i=0; i<3; ++i) upright[i] = a[i]/n;
    calibrated = true; pose = candidate = 1; poseSince = candidateSince = now;
    ++reference; ++seq;
    return true;
  }
  void update(uint32_t now, const float *accel, const float *gyro) {
    const bool gap = !fresh(now);
    float delta2=0, spin2=0;
    for (int i=0; i<3; ++i) {
      const float d = accel[i]-a[i]; delta2 += d*d;
      a[i]=accel[i]; g[i]=gyro[i]; spin2 += g[i]*g[i];
    }
    sampled=true; sampleAt=now;
    const float n=magnitude();
    const bool active = gap || fabsf(n-1.f) > .14f || spin2 > 144.f || delta2 > .0144f;
    if (active) {
      quietSince=now;
      if (!moving) { moving=true; ++seq; }
      pose=candidate=0; candidateSince=now;
    } else if (moving && uint32_t(now-quietSince) >= 650) {
      moving=false; ++seq;
    }
    if (fabsf(n-1.f) > .65f && (!jolts || uint32_t(now-joltAt) > 1500)) {
      joltAt=now; ++jolts; ++seq;
    }
    if (!calibrated || moving || n < .85f || n > 1.15f) return;
    const float dot=(a[0]*upright[0]+a[1]*upright[1]+a[2]*upright[2])/n;
    // A naturally held/phone-like lean is normal: enter within 45 degrees,
    // leave beyond 55. Debounce orientation separately.
    // Board Z is normal to the display. Its cross product with the upright
    // reference gives the screen's sideways axis, independent of resting lean.
    // Face-flat is not on-side; a near-flat calibration has no reliable axis.
    const float sideNorm = sqrtf(upright[0]*upright[0]+upright[1]*upright[1]);
    const float side = sideNorm > .35f
      ? fabsf((-a[0]*upright[1]+a[1]*upright[0])/(n*sideNorm)) : 0.f;
    const int next = dot > (pose==1 ? .574f : .707f) ? 1
      : dot < (pose==3 ? -.574f : -.707f) ? 3
      : side > (pose==4 ? .643f : .819f) ? 4 : 2;
    if (next != candidate) { candidate=next; candidateSince=now; }
    if (pose != candidate && uint32_t(now-candidateSince) >= 300) {
      pose=candidate; poseSince=now; ++seq;
    }
  }
};

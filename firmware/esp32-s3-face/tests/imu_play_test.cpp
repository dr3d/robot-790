#include "../include/imu_play.h"
#include <assert.h>
#include <string.h>
#include <stdio.h>
int main() {
  ImuPlay s; uint32_t now=100;
  auto feed = [&](float x, float y, float z, float spin, int count) {
    float a[]={x,y,z}, g[]={spin,0,0};
    for (int i=0;i<count;++i) { s.update(now,a,g); now+=20; }
  };
  assert(!s.setUpright(now));
  feed(0,1,0,0,70); assert(s.setUpright(now));
  assert(!strcmp(s.poseName(now),"upright"));
  feed(0,-1,0,60,20); assert(!strcmp(s.motionName(now),"moving"));
  assert(!s.setUpright(now));
  feed(0,-1,0,0,60); assert(!strcmp(s.poseName(now),"upside_down"));
  feed(1,0,0,0,60); assert(!strcmp(s.poseName(now),"on_side"));
  assert(fabsf(s.tiltDegrees()-90.f)<.1f);
  feed(-1,0,0,0,60); assert(!strcmp(s.poseName(now),"on_side"));
  feed(0,0,1,0,60); assert(!strcmp(s.poseName(now),"tilted")); // face-flat
  feed(0,1,0,0,60); assert(!strcmp(s.poseName(now),"upright"));
  feed(.6f,.8f,0,0,60); assert(!strcmp(s.poseName(now),"upright"));
  feed(.6f,-.8f,0,0,60); assert(!strcmp(s.poseName(now),"upside_down"));
  feed(0,1,0,0,60); assert(!strcmp(s.poseName(now),"upright"));
  const auto seq=s.seq; feed(.01f,1,.01f,1,100); assert(s.seq==seq);
  feed(0,2,0,0,1); assert(s.jolts==1);
  feed(0,2,0,0,10); assert(s.jolts==1);
  now+=1000; assert(!s.fresh(now)); assert(!strcmp(s.poseName(now),"unknown"));
  assert(!s.setUpright(now));
  feed(0,1,0,0,1); assert(s.moving); // no stale settled state across a gap
  feed(0,1,0,0,70); assert(s.setUpright(now));
  assert(s.reference==2);
  ImuPlay rebooted;
  assert(rebooted.restoreUpright(s.upright));
  assert(rebooted.calibrated && !rebooted.fresh(now));
  assert(!strcmp(rebooted.poseName(now),"unknown"));
  float inverted[]={0,-1,0}, still[]={0,0,0};
  for(int i=0;i<70;++i) { rebooted.update(now,inverted,still); now+=20; }
  assert(!strcmp(rebooted.poseName(now),"upside_down")); // boot pose never becomes new upright
  float invalid[]={NAN,0,1}, zero[]={0,0,0}, tooLong[]={0,2,0};
  assert(!rebooted.restoreUpright(invalid));
  assert(!rebooted.restoreUpright(zero));
  assert(!rebooted.restoreUpright(tooLong));
  assert(rebooted.upright[1] == 1.f); // rejected data leaves reference intact
  // Replay actual resting, inverted and sideways vectors from the first game.
  ImuPlay physical;
  float ref[]={-.889f,0,-.458f}; assert(physical.restoreUpright(ref));
  auto replay = [&](float x, float y, float z, const char *expected) {
    float a[]={x,y,z}, g[]={5,0,0};
    for(int i=0;i<70;++i) { physical.update(now,a,g); now+=20; }
    assert(!strcmp(physical.poseName(now),expected));
  };
  replay(-.95874f,-.006592f,-.499512f,"upright");
  replay(.946289f,.012939f,-.300049f,"upside_down");
  replay(-.002441f,.943115f,.211914f,"on_side");
  replay(0,-1,0,"on_side");
  replay(0,0,1,"tilted");
  puts("IMU classifier: orientation, motion, noise, jolts, stale reads and calibration passed");
}

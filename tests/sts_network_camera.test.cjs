const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const camera = require('../web/sts/network-camera.js');
const html = fs.readFileSync(require('node:path').join(__dirname, '../web/sts/index.html'), 'utf8').replace(/\r\n/g, '\n');
const tick = () => new Promise(setImmediate);
const defer = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
function source(name) {
  const start = html.search(new RegExp(`    (?:async )?function ${name}\\(`));
  const end = html.indexOf('\n    }', start);
  assert.ok(start >= 0 && end > start, name);
  return html.slice(start, end + 6);
}
function setup(request) {
  const frames=[], states=[], timers = new Map(); let sequence=0;
  const client = camera.create({request, onFrame: f=>frames.push(f), onState:s=>states.push(s),
    setTimer: fn=> {timers.set(++sequence, fn); return sequence;}, clearTimer: id=>timers.delete(id)});
  return {client,frames,states,timers};
}
test('snapshot is one-shot, coalesces concurrent requests, and never polls by default', async()=> {
  let calls=0; const gate=defer(), s=setup(()=>{calls++; return gate.promise;});
  const a=s.client.snapshot(), b=s.client.snapshot();
  await tick(); assert.equal(calls,1); assert.equal(a,b);
  gate.resolve('jpeg'); assert.equal(await a,'jpeg');
  assert.deepEqual(s.frames,['jpeg']); assert.equal(s.timers.size,0); assert.equal(s.client.state().active,false);
});
test('preview fetches sequentially; stop aborts and drops late frames', async()=> {
  const gate=defer(); let signal;
  const s=setup(sig=>{signal=sig;return gate.promise;}); s.client.start();
  await tick(); assert.equal(s.timers.size,0); s.client.stop(); assert.ok(signal.aborted);
  gate.resolve('late'); await tick(); assert.deepEqual(s.frames,[]); assert.equal(s.timers.size,0);
});
test('preview schedules only after completion and failures stop polling', async()=> {
  let calls=0; const s=setup(async()=>{if(++calls>1) throw new Error('offline'); return 'jpeg';});
  s.client.start(); await tick(); assert.equal(s.timers.size,1);
  const [key,fn]=[...s.timers][0]; s.timers.delete(key); await fn();
  assert.equal(s.client.state().active,false); assert.equal(s.client.state().error,'offline');
  assert.equal(s.timers.size,0);
});
test('an old request cannot overwrite a restarted preview or clear its pending request', async()=> {
  const old=defer(), current=defer(); let n=0;
  const s=setup(()=>++n===1?old.promise:current.promise); s.client.start(); await tick();
  s.client.stop(); s.client.start(); await tick(); old.resolve('old'); await tick();
  assert.ok(s.client.state().busy); assert.deepEqual(s.frames,[]);
  current.resolve('new'); await tick(); assert.deepEqual(s.frames,['new']);
});
function captureContext(snapshot=async()=>({width:240,height:320})) {
  let generation=0;
  const client={snapshot, generation:()=>generation, state:()=>({busy:false})};
  const elements = new Map();
  const c=vm.createContext({esp32Camera:()=>client, esp32CameraCapturePromise:null,
    sensingEyeGeneration:3, realtimeSessionGeneration:4, visionImageStaged:true,
    document:{querySelector:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);}},
    log(){},events:{}, writes:0,
    setVisionImageFromDrawable:async(_,name,options)=>{
      assert.ok(options.isCurrent()); assert.equal(options.eyeGeneration,c.sensingEyeGeneration);
      c.writes++; c.options=options; return {savedFilename:name,openUrl:'/saved.jpg'};
    }});
  require('./helpers/sts_connection_harness.cjs').installRealtimeConnection(c);
  require('./helpers/sts_eye_content_owner.cjs').installEyeContent(c, html);
  vm.runInContext(source('captureEsp32Camera'),c);
  return {c,stop:()=>generation++,elements};
}
test('capture uses the normal eye/save/stage path without requiring preview',async()=>{
  const {c}=captureContext(); const result=await c.captureEsp32Camera({reason:'look'});
  assert.equal(result.status,'ok'); assert.equal(result.staged,true); assert.equal(c.writes,1);
  assert.equal(c.options.source,'ESP32 camera'); assert.equal(c.options.reason,'look');
});
test('unavailable camera never overwrites the eye and can be retried',async()=>{
  let n=0;const {c}=captureContext(async()=>{if(++n===1)throw new Error('offline'); return {};});
  assert.equal((await c.captureEsp32Camera()).status,'error'); assert.equal(c.writes,0);
  assert.equal((await c.captureEsp32Camera()).status,'ok'); assert.equal(c.writes,1);
});
test('disconnect, cleared eye, or superseded tool cannot stage a late capture',async()=>{
  for(const action of ['stop','clear','session','tool']) {
    const gate=defer(),{c,stop}=captureContext(()=>gate.promise);let current=true;
    const pending=c.captureEsp32Camera({_isCurrent:()=>current});
    if(action==='stop')stop(); if(action==='clear')c.sensingEyeGeneration++;
    if(action==='session')c.realtimeSessionGeneration++;if(action==='tool')current=false;
    gate.resolve({});assert.equal((await pending).status,'error');assert.equal(c.writes,0);
  }
});
test('tool wired separately from browser camera and disconnect stops both',()=>{
  assert.match(source('executeTool'),/capture_esp32_camera.*captureEsp32Camera/);
  assert.match(source('executeTool'),/set_esp32_camera.*setEsp32Camera/);
  assert.match(source('handleFunctionCall'),/capture_esp32_camera.*includes\(event.name\)/);
  assert.match(source('saveAndDisconnectRealtime'),/stopEsp32Camera\(\)/);
  assert.ok(html.indexOf('id="esp32CameraExpando"')>html.indexOf('id="browserCameraExpando"'));
});

function controlContext(request = async () => ({width:240,height:320})) {
  const {c}=captureContext(); let requests=0;
  const client=camera.create({request:signal=>{requests++;return request(signal);},
    onFrame(){},onState(){},setTimer:()=>1,clearTimer(){}});
  c.esp32Camera=()=>client;
  c.stopEsp32Camera=()=>client.stop();
  c.recordUiEvent=()=>{};
  vm.runInContext(source('setEsp32Camera'),c);
  return {c,client,requests:()=>requests};
}
test('TimerCam on/off mirrors browser controls without capturing or touching the webcam',async()=>{
  const {c,client,requests}=controlContext();
  const on=await c.setEsp32Camera({enabled:true});
  assert.equal(on.status,'ok');assert.equal(on.enabled,true);assert.equal(c.writes,0);
  assert.equal(requests(),1);
  const off=await c.setEsp32Camera({enabled:false});
  assert.equal(off.status,'ok');assert.equal(off.enabled,false);assert.equal(client.state().active,false);
});
test('TimerCam start-and-look shares one frame and preserves capture receipt',async()=>{
  const {c,requests}=controlContext();
  const result=await c.setEsp32Camera({enabled:true,capture_frame:true,reason:'look'});
  assert.equal(result.status,'ok');assert.equal(result.capture.staged,true);
  assert.equal(c.writes,1);assert.equal(requests(),1);assert.equal(c.options.reason,'look');
});
test('invalid TimerCam controls do not start requests; unavailable camera returns failure',async()=>{
  const {c,requests}=controlContext(async()=>{throw new Error('offline');});
  for(const args of [{},{enabled:'true'},{enabled:false,capture_frame:true},{enabled:true,capture_frame:'true'}]) {
    assert.equal((await c.setEsp32Camera(args)).status,'error');
  }
  assert.equal(requests(),0);
  const result=await c.setEsp32Camera({enabled:true});
  assert.equal(result.status,'error');assert.equal(result.enabled,false);assert.equal(c.writes,0);
});
test('turning TimerCam off during start-and-look cancels capture and cannot report enabled',async()=>{
  const gate=defer(),{c}=controlContext(()=>gate.promise);
  const pending=c.setEsp32Camera({enabled:true,capture_frame:true}); await tick();
  await c.setEsp32Camera({enabled:false});gate.resolve({});
  const result=await pending;
  assert.equal(result.status,'error');assert.equal(result.enabled,false);assert.equal(c.writes,0);
});

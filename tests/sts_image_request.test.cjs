const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const {test}=require('node:test');
const {characterize}=require('./helpers/sts_image_request_harness.cjs');
const baseline=require('./fixtures/sts-image-request.json');
const page=fs.readFileSync(`${__dirname}/../web/sts/index.html`,'utf8').replace(/\r\n/g,'\n');

test('image request boundary preserves complete baseline results and ordered effects',async()=>{
  assert.deepEqual(await characterize(page),baseline.cases);
});
test('frozen image request baseline reproduces from committed code',async()=>{
  const original=cp.execFileSync('git',['show',`${baseline.baseline}:web/sts/index.html`],{encoding:'utf8'}).replace(/\r\n/g,'\n');
  assert.deepEqual(await characterize(original),baseline.cases);
});

test('surrounding eye, idle, prompt and tool policies remain byte-for-byte unchanged',()=>{
  const {extract}=require('./helpers/sts_completion_harness.cjs');
  const original=cp.execFileSync('git',['show',`${baseline.baseline}:web/sts/index.html`],{encoding:'utf8'}).replace(/\r\n/g,'\n');
  for(const name of ['createGeneratedPreviewOwner','moveGeneratedImageToSensingEye','stageVisionImage',
    'setVisionImageFromDrawable','idleBlockedReason','idleEnabledToolList','enabledToolList',
    'buildSessionInstructions','handleFunctionCall']) {
    assert.equal(extract(page,name),extract(original,name),name);
  }
  for(const name of ['generated-preview.js','idle-art.js']) {
    const before=cp.execFileSync('git',['show',`${baseline.baseline}:web/sts/${name}`],{encoding:'utf8'}).replace(/\r\n/g,'\n');
    assert.equal(fs.readFileSync(`${__dirname}/../web/sts/${name}`,'utf8').replace(/\r\n/g,'\n'),before,name);
  }
  assert.match(page,/function generateImage\(args = \{\}\) \{\s+return imageRequest\.generate\(args\);\s+\}/);
});

test('request instances share the injected preview lock, not a second module busy flag',async()=>{
  const {create}=require('../web/sts/image-request.js');
  const preview=()=>require('../web/sts/generated-preview.js').create({
    captureCover:()=>null,resolveUrl:value=>value,show(){},changed(){},rollover(){},clear(){},begin(){},failed(){},retained(){},
  });
  const firstPreview=preview(), otherPreview=preview();
  let finish,calls=0;
  const adapters=p=>({preview:p,idle:()=>undefined,enabled:()=>true,model:()=> 'test',quality:()=> 'low',
    settingLabel:()=> 'test / low',url:value=>new URL(value,'http://test/'),show:value=>p.show(value),log(){},
    fetch:async()=>{calls++;return {ok:true,json:async()=>({status:'ok',url:'/other.png',filename:'other.png'})};},
  });
  const first=create({...adapters(firstPreview),fetch:()=>{calls++;return new Promise(resolve=>{finish=resolve;});}});
  const sibling=create(adapters(firstPreview)),other=create(adapters(otherPreview));
  const pending=first.generate({prompt:'First'});
  await assert.rejects(sibling.generate({prompt:'Duplicate'}),error=>error.generationSubmitted===false);
  await other.generate({prompt:'Other'});
  finish({ok:true,json:async()=>({status:'ok',url:'/first.png',filename:'first.png'})});
  await pending;
  assert.equal(calls,2);
  assert.equal(firstPreview.name,'first.png');assert.equal(otherPreview.name,'other.png');
});

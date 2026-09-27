const vm = require('node:vm');
const { extract } = require('./sts_completion_harness.cjs');

function fixture(page, install) {
  const trace = [], elements = {}, requests = [];
  const element = name => {
    const state = elements[name] = { classes: [], attributes: {}, hidden: false };
    const target = {
      dataset: new Proxy({}, { set(o,k,v) { o[k]=v; trace.push([name,'dataset',k,v]); return true; } }),
      classList: {
        add(k) { if (!state.classes.includes(k)) state.classes.push(k); trace.push([name,'add',k]); },
        remove(k) { state.classes=state.classes.filter(x=>x!==k); trace.push([name,'remove',k]); }
      },
      setAttribute(k,v) { state.attributes[k]=v; trace.push([name,'attribute',k,v]); },
      removeAttribute(k) { delete state[k]; delete state.attributes[k]; trace.push([name,'removeAttribute',k]); }
    };
    return new Proxy(target, {
      get(o,k) { return k in o ? o[k] : state[k]; },
      set(o,k,v) { state[k]=v; trace.push([name,'set',k,v]); return true; }
    });
  };
  const c = vm.createContext({ URL, location:{href:'http://example.test/'}, events:{},
    log:(_,line)=>trace.push(['log',line]),
    generatedImageUrl:'',generatedImageName:'',generatedImageStatusState:'empty',
    generatedImageStatusLabel:'',generatedImageRequestGeneration:0,
    visionImageUrl:'', recording:false, audioRecordingActive:()=>c.recording,
    audioRecordingCurrentVisualCover:options=>{trace.push(['cover',options,c.generatedImageRequestGeneration]);return {name:'previous'};},
    rolloverAudioRecordingForVisualChange:(...args)=>trace.push(['rollover',...args]),
    currentImageModel:()=> 'test-model',currentImageQuality:()=> 'low',imageSettingLabel:()=> 'test-model / low',
    llmImageTools:{checked:true},
    idleArt:{busy:false,assertCanRender:options=>trace.push(['admit',options])},
  });
  for (const n of ['generatedImagePreview','generatedImageCard','generatedImageHint','generatedImageOpenButton',
    'generatedImageToEyeButton','generatedImageClearButton','topImageStatus','topImageLabel','topImagePreview']) c[n]=element(n);
  c.fetch = async (url,options)=> {requests.push({url:String(url),body:JSON.parse(options.body)});
    return {ok:true,json:async()=>({status:'ok',filename:'draw.png',url:'/draw.png',provider:'test',model:'model'})};};
  install?.(c,page);
  require('./sts_image_request_owner.cjs').installImageRequest(c,page);
  for (const n of ['updateGeneratedImageButtons','updateTopGeneratedImageStatus','showGeneratedImage','clearGeneratedImage','generateImage'])
    vm.runInContext(extract(page,n),c);
  const snapshots=[];
  const snap = label => snapshots.push(JSON.parse(JSON.stringify({label,
    state:[c.generatedImageUrl,c.generatedImageName,c.generatedImageStatusState,c.generatedImageStatusLabel,c.generatedImageRequestGeneration],
    elements,trace,requests})));
  return {c,trace,snap,snapshots};
}

async function characterize(page, install) {
  const cases=[];
  async function run(name, action) {const f=fixture(page,install);await action(f);f.snap('end');cases.push({name,snapshots:f.snapshots});}
  await run('empty status normalization',async f=>{f.c.updateTopGeneratedImageStatus({state:'ready',label:'  a\n b  '});f.snap('ready without URL');f.c.updateTopGeneratedImageStatus({state:'unknown'});});
  for(const recording of [false,true]) for(const eye of ['', '/eye.jpg'])
    await run(`show recording=${recording} eye=${!!eye}`,async f=>{f.c.recording=recording;f.c.visionImageUrl=eye;f.c.showGeneratedImage({url:'/old.png',filename:'old.png'});f.snap('old');f.c.clearGeneratedImage();f.snap('clear');f.c.showGeneratedImage({url:'/new.png',title:'new',provider:'test',model:'model'});});
  await run('normal success',async f=>{await f.c.generateImage({prompt:'  a\n picture ',title:' a\n title '});});
  for(const failure of ['HTTP','JSON','network']) await run(failure+' failure',async f=>{
    f.c.fetch=async()=>{if(failure==='network')throw Error('network');return {ok:false,status:429,statusText:'Limited',json:async()=>{if(failure==='JSON')throw Error('json');return {status:'error',error:'credits'};}};};
    try{await f.c.generateImage({prompt:'picture'});}catch(e){f.trace.push(['error',e.message]);}
  });
  for(const mutation of ['voice','session','clear','replace']) for(const fails of [false,true])
    await run(`${mutation} then ${fails?'failure':'success'}`,async f=>{
      let current=true,preview=true,release;
      f.c.fetch=()=>new Promise((resolve,reject)=>{release=()=>fails?reject(Error('late')):resolve({ok:true,json:async()=>({status:'ok',filename:'late.png',url:'/late.png'})});});
      const pending=f.c.generateImage({prompt:'picture',_isCurrent:()=>current,_isPreviewCurrent:()=>preview});f.snap('pending');
      if(mutation==='voice')current=false;
      if(mutation==='session')current=preview=false;
      if(mutation==='clear')f.c.clearGeneratedImage();
      if(mutation==='replace')f.c.showGeneratedImage({url:'/new.png',filename:'new.png'});
      release();try{f.trace.push(['result',await pending]);}catch(e){f.trace.push(['error',e.message]);}
    });
  await run('retained idle result',async f=>{f.c.idleArt.renderRequested=async()=>({status:'ok',filename:'idle.png',url:'/idle.png',retained:true});f.trace.push(['result',await f.c.generateImage({prompt:'picture',_idleArt:true})]);});
  return cases;
}
module.exports={characterize,fixture};

if(require.main===module) {
  const fs=require('node:fs'),cp=require('node:child_process');
  const source=cp.execFileSync('git',['show','a793cbc:web/sts/index.html'],{encoding:'utf8'}).replace(/\r\n/g,'\n');
  characterize(source).then(cases=>{
    fs.writeFileSync('tests/fixtures/sts-generated-preview.json',JSON.stringify({baseline:'a793cbc',cases},null,2)+'\n');
    console.log(`Captured ${cases.length} cases from a793cbc`);
  });
}

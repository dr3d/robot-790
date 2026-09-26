const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.ROBOT_790_PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..'), out=path.join(root,'logs/maintenance/music-browser');
const score=process.env.ROBOT_790_MUSIC_SCORE ? JSON.parse(fs.readFileSync(process.env.ROBOT_790_MUSIC_SCORE,'utf8')) : {version:1,title:'Piano study',tempo:120,tracks:[
  {name:'Melody',instrument:'piano',events:[{beat:0,duration:1,notes:[64],velocity:0.8},{beat:1,duration:1,notes:[67],velocity:0.7},{beat:2,duration:2,notes:[72],velocity:0.6}]},
  {name:'Accompaniment',instrument:'piano',events:[{beat:0,duration:4,notes:[48,55,60],velocity:0.45}]},
]};
async function main() {
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
  const results={}, errors=[], files=new Map();
  const previewFilename='music/library-preview.txt';
  const previewScore={version:1,title:'Library preview',tempo:72,tracks:[
    {name:'Melody',instrument:'piano',events:[{beat:0,duration:8,notes:[48,60,67],velocity:0.7}]},
  ]};
  files.set(previewFilename,JSON.stringify(previewScore));
  let writes=0;
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',message=>{if(message.type()==='error') console.error('browser:',message.text());});
    await page.route('**/api/**', async route=>{
      const r=route.request(), url=new URL(r.url());
      if(url.pathname==='/api/music/files') return route.fulfill({json:{status:'ok',files:[...files.keys()].map((filename,index)=>({filename,created_at_ms:1700000000000+index*1000}))}});
      if(url.pathname==='/api/notes/write') {
        const p=r.postDataJSON(); files.set(p.filename,p.content); writes++;
        return route.fulfill({json:{status:'ok',filename:p.filename,characters:p.content.length}});
      }
      if(url.pathname==='/api/notes/read' && url.searchParams.get('filename')?.startsWith('music/')) {
        const name=url.searchParams.get('filename');
        return route.fulfill({json:{status:'ok',filename:name,content:files.get(name)}});
      }
      if(r.method()!=='GET') return route.fulfill({json:{status:'ok'}});
      return route.continue();
    });
    await page.addInitScript(({filename,title})=>{
      if(!localStorage.getItem('robot790.music.v1')) localStorage.setItem('robot790.music.v1',JSON.stringify({library:[{filename,title}]}));
    },
      {filename:previewFilename,title:previewScore.title});
    await page.goto('http://127.0.0.1:8790/');
    await page.waitForFunction(()=>typeof Robot790Music!=='undefined');
    await page.evaluate(()=>{
      for(let el=document.querySelector('#musicPanel');el;el=el.parentElement) if(el.tagName==='DETAILS') el.open=true;
    });
    await page.locator('[data-music="scores"]').selectOption(previewFilename);
    await page.waitForFunction(()=>document.querySelector('[data-music="roll"]').getAttribute('aria-label')==='Piano roll: Library preview');
    assert.equal(await page.evaluate(()=>music.snapshot().state),'empty');
    assert.equal(writes,0);
    await page.locator('#musicPanel').screenshot({path:path.join(out,'selection-preview.png')});
    results.selectionWithoutPlayback=true;
    results.receipt=await page.evaluate(async score=>{
      document.querySelector('#llmNoteFileTools').checked=true;
      const panel=document.querySelector('#musicPanel');
      for(let el=panel;el;el=el.parentElement) if(el.tagName==='DETAILS') el.open=true;
      await ensurePlayback();
      window.musicAnalyser=audioContext.createAnalyser();
      recordingDestination=window.musicAnalyser;
      return music.play({score},{manual:true});
    },score);
    assert.equal(results.receipt.playback,'started');
    results.playbackEvidence=await page.evaluate(()=>({
      b1:JSON.parse(buildRuntimeContextSections().music), b2:brain2EvidenceSnapshot().runtime.music,
    }));
    assert.deepEqual(results.playbackEvidence.b1,results.playbackEvidence.b2);
    assert.equal(results.playbackEvidence.b1.latest_performance.playback,'playing');
    assert.equal(results.playbackEvidence.b1.latest_performance.source,'operator');
    await page.waitForFunction(()=>{
      const data=new Float32Array(musicAnalyser.fftSize); musicAnalyser.getFloatTimeDomainData(data);
      return data.some(v=>Math.abs(v)>0.0001);
    });
    results.sampledSignal=true;
    await page.locator('#musicPanel').screenshot({path:path.join(out,'desktop.png')});
    await page.locator('[data-music="scores"]').selectOption(previewFilename);
    await page.waitForFunction(()=>document.querySelector('[data-music="roll"]').getAttribute('aria-label')==='Piano roll: Library preview');
    assert.equal(await page.evaluate(()=>music.snapshot().filename),results.receipt.filename);
    await page.waitForFunction(()=>music.snapshot().state==='completed');
    assert.equal(await page.locator('[data-music="scores"]').inputValue(),previewFilename);
    assert.equal(await page.locator('[data-music="roll"]').getAttribute('aria-label'),'Piano roll: Library preview');
    results.previewSurvivesCompletion=true;
    results.completed=true;
    assert.equal(await page.evaluate(()=>brain2EvidenceSnapshot().runtime.music.latest_performance.playback),'completed');
    await page.evaluate(()=>music.play({filename:music.snapshot().filename},{manual:true}));
    await page.waitForTimeout(250);
    await page.getByRole('button',{name:'Pause music',exact:true}).click();
    assert.equal(await page.evaluate(()=>music.snapshot().state),'paused');
    assert.equal(await page.evaluate(()=>JSON.parse(buildRuntimeContextSections().music).latest_performance.playback),'paused');
    const at=await page.evaluate(()=>music.snapshot().position);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(()=>music.snapshot().position),at);
    await page.getByRole('button',{name:'Resume music',exact:true}).click();
    assert.equal(await page.evaluate(()=>music.snapshot().state),'playing');
    await page.evaluate(()=>haltRealtimeActivity('music browser test'));
    assert.equal(await page.evaluate(()=>music.snapshot().state),'stopped');
    await page.waitForTimeout(200);
    results.stopPeak=await page.evaluate(()=>{
      const data=new Float32Array(musicAnalyser.fftSize); musicAnalyser.getFloatTimeDomainData(data);
      return Math.max(...data.map(Math.abs));
    });
    assert(results.stopPeak<0.00001);
    results.pauseResumeAndHalt=true;
    const dl=page.waitForEvent('download');
    await page.getByRole('button',{name:'Download score',exact:true}).click();
    const download=await dl; await download.saveAs(path.join(out,'score.json'));
    assert.equal(JSON.parse(fs.readFileSync(path.join(out,'score.json'))).title,score.title);
    await page.setViewportSize({width:430,height:932});
    await page.locator('#musicPanel').scrollIntoViewIfNeeded();
    await page.locator('#musicPanel').screenshot({path:path.join(out,'mobile.png')});
    results.layout=await page.locator('#musicPanel').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
    assert(results.layout.scroll<=results.layout.client+2);
    results.canvas=await page.locator('[data-music="roll"]').evaluate(c=>{
      const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      let colored=0; for(let i=0;i<pixels.length;i+=4) if(pixels[i+1]>120 && pixels[i]<pixels[i+1]) colored++;
      return colored;
    });
    assert(results.canvas>100);
    results.errors=errors; assert.deepEqual(errors,[]);
    results.noExternalAssets=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/Tone|piano\//.test(r.name)).every(r=>new URL(r.name).origin===location.origin));
    assert(results.noExternalAssets); assert.equal(files.size,2); assert.equal(writes,1);
    const expectedOrder=[results.receipt.filename,previewFilename];
    const order=()=>page.locator('[data-music="scores"]').evaluate(el=>Array.from(el.options,o=>o.value).filter(Boolean));
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('robot790.music.v1')).library.every(item=>item.created_at_ms>0));
    assert.deepEqual(await order(),expectedOrder);
    await page.locator('[data-music="scores"]').selectOption(previewFilename);
    await page.getByRole('button',{name:'Replay composition',exact:true}).click();
    await page.waitForFunction(filename=>music.snapshot().filename===filename && music.isPlaying(),previewFilename);
    assert.deepEqual(await order(),expectedOrder);
    await page.evaluate(()=>music.stop('browser sort test'));
    await page.reload();
    await page.waitForFunction(()=>typeof Robot790Music!=='undefined');
    assert.deepEqual(await order(),expectedOrder);
    assert.equal(writes,1);
    results.creationOrderSurvivesReplayAndReload=true;
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
    console.log(JSON.stringify(results,null,2));
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});

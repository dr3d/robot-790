const {fixture}=require('./sts_preview_harness.cjs');
const {installGeneratedPreview}=require('./sts_preview_owner.cjs');

const success=()=>({status:'ok',filename:'request.png',url:'/generated-images/request.png',model:'model',cost:0.1});
async function characterize(page) {
  const cases=[];
  async function run(name, action) {
    const f=fixture(page,installGeneratedPreview);
    f.reply=async()=>({ok:true,json:async()=>success()});
    f.c.fetch=async(url,options)=>{
      f.trace.push(['http',String(url),options]);
      const response=await f.reply();
      return {...response,json:async()=>{f.trace.push(['json']);return response.json();}};
    };
    f.timers=[];
    f.c.setTimeout=(callback,ms)=>{f.trace.push(['wait',ms]);f.timers.push(callback);};
    f.invoke=async(args)=>{
      try { const value=await f.c.generateImage(args);f.trace.push(['result',value]);return value; }
      catch(error) {f.trace.push(['error',error.message,...('generationSubmitted' in error?[error.generationSubmitted]:[])]);}
    };
    await action(f); f.snap('end'); cases.push({name,snapshots:f.snapshots});
  }
  await run('missing prompt rejects before admission',f=>f.invoke({prompt:' \n '}));
  await run('superseded input rejects before admission',f=>f.invoke({prompt:'Picture',_isCurrent:()=>false}));
  await run('normal foreground without idle owner',f=>{delete f.c.idleArt;return f.invoke({prompt:'Harbor'});});
  await run('foreground payload, Unicode, whitespace and title normalization',f=>f.invoke({
    prompt:'  Caf\u00e9\n\u6708  on water ',title:' A\n river ',size:'1536x1024',
  }));
  await run('empty size falls back to existing default',f=>f.invoke({prompt:'Harbor',size:''}));
  await run('title truncation belongs to existing preview owner',f=>f.invoke({prompt:'Harbor',title:'x'.repeat(180)}));
  await run('active foreground blocks another submission',f=>{
    f.c.generatedPreview.begin('Existing');return f.invoke({prompt:'New'});
  });
  await run('busy idle request does not submit or wait',f=>{
    f.c.idleArt.busy=true;return f.invoke({prompt:'New',_idleArt:true});
  });
  for(const idle of [false,true]) await run(`admission rejection idle=${idle}`,f=>{
    f.c.idleArt.assertCanRender=options=>{f.trace.push(['admit',options]);throw Error('permission or prior unknown outcome');};
    return f.invoke({prompt:'Picture',_idleArt:idle});
  });
  for(const retained of [false,true]) await run(`idle route retained=${retained}`,f=>{
    const guard=()=>true;
    f.c.idleArt.renderRequested=async(proposal,options)=>{
      f.trace.push(['idle render',proposal,{size:options.size,sameGuard:options.isCurrent===guard}]);
      return {...success(),retained};
    };
    return f.invoke({prompt:' Picture ',title:'Night',size:'1536x1024',_idleArt:true,_isCurrent:guard});
  });
  for(const failure of ['network','HTTP','provider','malformed error JSON','malformed success JSON']) {
    await run(failure,f=>{
      f.reply=async()=>{
        if(failure==='network')throw Error('network lost after submission');
        return {ok:failure==='provider'||failure==='malformed success JSON',status:503,statusText:'Unavailable',
          json:async()=>{if(failure.startsWith('malformed'))throw Error('bad JSON');return {status:'error',error:'provider refused'};}};
      };
      return f.invoke({prompt:'Picture'});
    });
  }
  await run('retained foreground success keeps exact retrieval receipt',f=>{
    f.reply=async()=>({ok:true,json:async()=>({...success(),retained:true,provider:'provider'})});
    return f.invoke({prompt:'Picture'});
  });
  await run('absolute result URL remains absolute',f=>{
    f.reply=async()=>({ok:true,json:async()=>({...success(),url:'https://images.example.test/result.png'})});
    return f.invoke({prompt:'Picture'});
  });
  for(const change of ['released','turn','clear','disabled','second wait']) {
    await run(`waiting foreground ${change}`,async f=>{
      let current=true;f.c.idleArt.busy=true;
      const pending=f.invoke({prompt:'Original prompt',title:'Original title',size:'1536x1024',_isCurrent:()=>current});
      f.snap('waiting');
      if(change==='turn')current=false;
      if(change==='clear')f.c.clearGeneratedImage();
      if(change==='disabled')f.c.llmImageTools.checked=false;
      if(change==='second wait') {
        f.timers.shift()();
        // Drain the resumed wait before taking its state/effect snapshot.
        for(let i=0;i<20 && !f.timers.length;i++)await Promise.resolve();
        if(!f.timers.length)throw Error('Second wait was not scheduled');
        f.snap('still waiting');
      }
      f.c.idleArt.busy=false;
      // These controls have always been sampled after waiting, not at entry.
      f.c.currentImageModel=()=> 'new-model';f.c.currentImageQuality=()=> 'high';
      f.c.imageSettingLabel=()=> 'new-model / high';
      f.timers.shift()();await pending;
    });
  }
  await run('competing waiters submit only one foreground request',async f=>{
    f.c.idleArt.busy=true;
    const first=f.invoke({prompt:'First'}),second=f.invoke({prompt:'Second'});
    f.c.idleArt.busy=false;
    f.timers.shift()();f.timers.shift()();await Promise.all([first,second]);
  });
  for(const separatePreview of [false,true]) await run(`superseded during JSON preview=${separatePreview}`,async f=>{
    let current=true,finish;
    f.reply=async()=>({ok:true,json:()=>new Promise(resolve=>{finish=resolve;})});
    const pending=f.invoke({prompt:'Picture',_isCurrent:()=>current,...(separatePreview?{_isPreviewCurrent:()=>true}:{})});
    for(let i=0;i<20 && !finish;i++)await Promise.resolve();
    if(!finish)throw Error('JSON phase was not reached');
    current=false;f.snap('JSON pending');finish(success());await pending;
  });
  return cases;
}
module.exports={characterize};

if(require.main===module) {
  const fs=require('node:fs'),cp=require('node:child_process');
  const baseline='c25d67b';
  const page=cp.execFileSync('git',['show',`${baseline}:web/sts/index.html`],{encoding:'utf8'}).replace(/\r\n/g,'\n');
  characterize(page).then(cases=>{
    fs.writeFileSync('tests/fixtures/sts-image-request.json',JSON.stringify({baseline,cases},null,2)+'\n');
    console.log(`Captured ${cases.length} image-request cases from ${baseline}`);
  }).catch(error=>{console.error(error);process.exitCode=1;});
}

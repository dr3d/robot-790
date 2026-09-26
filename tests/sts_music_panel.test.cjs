const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const music = require('../web/sts/music.js');

const score = (title, tempo = 90) => ({version:1,title,tempo,tracks:[
  {name:'Melody',instrument:'piano',events:[{beat:0,duration:4,notes:[60,64,67],velocity:0.7}]},
]});
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes,no) => { resolve=yes; reject=no; });
  return {promise,resolve,reject};
}
function fixture(read = async filename => JSON.stringify(score(filename, 120)), options = {}) {
  const elements = {}, texts = [], calls = [], reads = [];
  const context = {scale(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText:text=>texts.push(text)};
  for (const name of ['enabled','volume','scores','play','pause','stop','download','status','roll']) {
    elements[name] = {value:'',checked:true,attributes:{},listeners:{},clientWidth:350,
      addEventListener(kind, fn) { this.listeners[kind]=fn; },
      setAttribute(key,value) { this.attributes[key]=value; },
      replaceChildren(...items){this.value='';this.options=items;},add(item){this.options.push(item);},querySelector(){return {};},getContext(){return context;}};
  }
  const element = {open:true,querySelector:selector=>elements[selector.match(/"([^"]+)"/)[1]],addEventListener(){}};
  const storage = new Map([['robot790.music.v1', JSON.stringify({library:options.library || []})]]);
  const sandbox = {Robot790Music:music,localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
    Option:class {constructor(text,value){this.text=text;this.value=value;}},
    ResizeObserver:class {observe(){}},setInterval(){},devicePixelRatio:1};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../web/sts/music-panel.js'),'utf8'),sandbox);
  const panel = sandbox.Robot790MusicPanel.create({element,toolsChanged(){},dates:options.dates,
    read:filename=>{reads.push(filename);return read(filename);}});
  let snapshot = {state:'empty',score:null,filename:'',seconds:0,position:0};
  panel.attach({snapshot:()=>snapshot,play:()=>calls.push('play'),pause:()=>calls.push('pause'),stop:()=>calls.push('stop')});
  const select = filename => { elements.scores.value=filename; return elements.scores.listeners.change(); };
  const render = (title, state = 'playing') => {
    const parsed = music.validate(score(title));
    snapshot = {...parsed,state,filename:`music/${title}.txt`,position:1};
    panel.changed(snapshot);
  };
  return {elements,texts,calls,reads,select,render,panel,storage,
    order:()=>Array.from(elements.scores.options,option=>option.value).filter(Boolean)};
}

test('selecting a saved score previews it without playback or saving', async () => {
  const f=fixture();
  await f.select('music/river.txt');
  assert.deepEqual(f.reads,['music/river.txt']);
  assert.deepEqual(f.calls,[]);
  assert.equal(f.elements.roll.attributes['aria-label'],'Piano roll: music/river.txt');
  assert.match(f.texts.at(-1),/120 BPM \/ 1 parts \/ 0s of 2s/);
  assert.match(f.elements.status.textContent,/Preview:/);
  assert.equal(f.elements.pause.disabled,true);
});

test('browsing during playback survives pause and completion without stealing the playhead', async () => {
  const f=fixture(); f.render('current');
  await f.select('music/other.txt');
  assert.equal(f.elements.pause.disabled,false);
  assert.match(f.elements.status.textContent,/Preview:.*; Playing: current/);
  assert.match(f.texts.at(-1),/0s of/);
  f.render('current','paused');
  f.render('current','completed');
  assert.equal(f.elements.scores.value,'music/other.txt');
  assert.equal(f.elements.roll.attributes['aria-label'],'Piano roll: music/other.txt');
  assert.deepEqual(f.calls,[]);
});

test('late selection reads and failures cannot replace a newer preview', async () => {
  for (const fails of [false,true]) {
    const old=deferred(), f=fixture(filename=>filename==='music/old.txt' ? old.promise : Promise.resolve(JSON.stringify(score('New'))));
    const pending=f.select('music/old.txt');
    await f.select('music/new.txt');
    if (fails) old.reject(Error('late failure')); else old.resolve(JSON.stringify(score('Old')));
    await pending;
    assert.equal(f.elements.roll.attributes['aria-label'],'Piano roll: New');
    assert.equal(f.elements.status.textContent,'Preview: New');
  }
});

test('new performance invalidates an in-flight preview read', async () => {
  const old=deferred(), f=fixture(()=>old.promise);
  const pending=f.select('music/old.txt');
  f.render('new-performance');
  old.resolve(JSON.stringify(score('Old'))); await pending;
  assert.equal(f.elements.roll.attributes['aria-label'],'Piano roll: new-performance');
  assert.equal(f.elements.scores.value,'music/new-performance.txt');
});

test('clearing selection invalidates pending reads and clears the old roll', async () => {
  const old=deferred(), f=fixture(()=>old.promise);
  const pending=f.select('music/old.txt'); await f.select('');
  old.resolve(JSON.stringify(score('Old'))); await pending;
  assert.equal(f.elements.roll.attributes['aria-label'],'Composition piano roll');
  assert.equal(f.texts.at(-1),'Piano');
  assert.equal(f.elements.play.disabled,true);
});

test('invalid scores clear the previous preview and report failure without stopping music', async () => {
  const f=fixture(async()=>'{"version":99}'); f.render('current');
  await f.select('music/broken.txt');
  assert.equal(f.elements.roll.attributes['aria-label'],'Composition piano roll');
  assert.equal(f.texts.at(-1),'Score unavailable');
  assert.match(f.elements.status.textContent,/Score unavailable:.*; Playing: current/);
  assert.equal(f.elements.pause.disabled,false);
  assert.deepEqual(f.calls,[]);
});

test('music disabled still permits browsing saved scores', async () => {
  const f=fixture(); f.elements.enabled.checked=false;
  await f.select('music/river.txt');
  assert.equal(f.elements.play.disabled,true);
  assert.equal(f.elements.roll.attributes['aria-label'],'Piano roll: music/river.txt');
});

const older={filename:'music/older.txt',title:'Older',created_at_ms:1000};
const newer={filename:'music/newer.txt',title:'Newer',created_at_ms:2000};
const settle=()=>new Promise(setImmediate);

test('library is newest-created first and replay never promotes an older score', async () => {
  const f=fixture(undefined,{library:[older,newer]});
  assert.deepEqual(f.order(),[newer.filename,older.filename]);
  await f.select(older.filename);
  f.panel.retained({filename:older.filename,title:older.title});
  f.render('older'); f.render('older','completed');
  assert.deepEqual(f.order(),[newer.filename,older.filename]);
  assert.equal(f.elements.scores.value,older.filename);
  const saved=JSON.parse(f.storage.get('robot790.music.v1'));
  assert.equal(saved.library.find(item=>item.filename===older.filename).created_at_ms,1000);
  assert.deepEqual(fixture(undefined,saved).order(),[newer.filename,older.filename]);
});

test('undated old library is backfilled without playback or changing selection', async () => {
  const pending=deferred();
  const f=fixture(undefined,{library:[{filename:older.filename,title:older.title},{filename:newer.filename,title:newer.title}],dates:()=>pending.promise});
  await f.select(older.filename);
  pending.resolve([older,newer]); await settle();
  assert.deepEqual(f.order(),[newer.filename,older.filename]);
  assert.equal(f.elements.scores.value,older.filename);
  assert.equal(f.elements.roll.attributes['aria-label'],'Piano roll: music/older.txt');
  assert.deepEqual(f.calls,[]);
  assert.deepEqual(f.reads,[older.filename]);
  assert.equal(JSON.parse(f.storage.get('robot790.music.v1')).library.every(item=>item.created_at_ms>0),true);
});

test('date recovery keeps new arrivals and does not reorder based on request completion', async () => {
  const first=deferred(), second=deferred(); let requests=0;
  const f=fixture(undefined,{library:[{filename:older.filename,title:older.title}],dates:()=>++requests===1?first.promise:second.promise});
  f.panel.retained({filename:newer.filename,title:newer.title});
  second.resolve([older,newer]); await settle();
  first.resolve([older]); await settle();
  assert.deepEqual(f.order(),[newer.filename,older.filename]);
  assert.equal(f.elements.scores.value,newer.filename);
  f.panel.retained({filename:older.filename,title:older.title});
  assert.equal(requests,2,'dated replays need no extra metadata fetch');
  assert.deepEqual(f.order(),[newer.filename,older.filename]);
});

test('missing metadata does not invent dates or disrupt playback and cached dates stay authoritative', async () => {
  const f=fixture(undefined,{library:[newer,{filename:older.filename,title:older.title}],dates:async()=>{throw Error('offline');}});
  f.render('newer'); await settle();
  assert.deepEqual(f.order(),[newer.filename,older.filename]);
  assert.deepEqual(f.calls,[]);
  assert.match(f.elements.status.textContent,/Playing: newer/);
  const pending=deferred(), g=fixture(undefined,{library:[newer,{filename:older.filename,title:older.title}],dates:()=>pending.promise});
  pending.resolve([{...newer,created_at_ms:9999},{...older,created_at_ms:'invalid'}]); await settle();
  const items=JSON.parse(g.storage.get('robot790.music.v1')).library;
  assert.equal(items.find(item=>item.filename===newer.filename).created_at_ms,2000);
  assert.equal(items.find(item=>item.filename===older.filename).created_at_ms,undefined);
});

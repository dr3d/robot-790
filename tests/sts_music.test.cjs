const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate, create, tools } = require('../web/sts/music.js');
const score = () => ({ version: 1, title: 'A small waltz', tempo: 90, tracks: [
  { name: 'Melody', instrument: 'piano', events: [
    { beat: 0, duration: 1, notes: [64], velocity: 0.8 },
    { beat: 1, duration: 0.5, notes: [67] },
    { beat: 2, duration: 1, notes: [] },
  ] },
  { name: 'Left hand', instrument: 'piano', events: [{ beat: 0, duration: 3, notes: [48, 55, 60], velocity: 0.4 }] },
] });
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; }
function fixture(overrides = {}) {
  const calls = [], stored = new Map(), state = { connected: true, enabled: true, generation: 1 };
  let done;
  const engine = { load: async () => {}, start: (parsed, cb) => { calls.push(['start',parsed]); done=cb; },
    stop: () => calls.push(['stop']), pause() {}, resume() {}, position: () => 0 };
  const owner = create({ engine, connected: () => state.connected, enabled: () => state.enabled,
    generation: () => state.generation, now: () => new Date(2026, 9, 1, 9, 30, 25, 417).getTime(),
    save: async (f,c) => { stored.set(f,c); }, read: async f => stored.get(f),
    ...overrides, changed: s => calls.push(['changed',s]), retained: s => calls.push(['retained',s]),
  });
  return { owner, calls, stored, state, engine, done: () => done() };
}
test('score preserves parts, chords, dynamics and rests without adding notes', () => {
  const original = score(), result = validate(original);
  assert.equal(result.seconds, 2); assert.equal(result.notes, 5);
  assert.deepEqual(result.score.tracks[1].events[0].notes, [48,55,60]);
  assert.equal(original.tracks[0].events[1].velocity, undefined);
  assert.equal(result.score.tracks[0].events[1].velocity, 0.7);
});
test('long compositions are not clipped to a few seconds', () => {
  const s=score(); s.tracks[0].events.push({beat:600,duration:4,notes:[60]});
  assert.equal(validate(s).seconds, 604 * 60 / 90);
});
for (const [label, edit] of [
  ['tempo', s=>{s.tempo=NaN;}], ['pitch', s=>{s.tracks[0].events[0].notes=[200];}],
  ['fractional pitch', s=>{s.tracks[0].events[0].notes=[60.5];}],
  ['negative time', s=>{s.tracks[0].events[0].beat=-1;}],
  ['zero duration', s=>{s.tracks[0].events[0].duration=0;}],
  ['infinite duration', s=>{s.tracks[0].events[0].duration=Infinity;}],
  ['duplicate chord pitch', s=>{s.tracks[0].events[0].notes=[60,60];}],
  ['unknown instrument', s=>{s.tracks[0].instrument='boop';}],
  ['empty score', s=>{s.tracks=[];}],
]) test(`invalid ${label} is rejected, not silently repaired`, () => { const s=score(); edit(s); assert.throws(()=>validate(s)); });
test('play saves an unpinned versioned score and returns compact factual receipt', async () => {
  const f=fixture(), receipt=await f.owner.play({score:score()});
  assert.equal(receipt.playback,'started'); assert.equal(receipt.saved,true);
  assert.equal(receipt.filename,'music/A-small-waltz-20261001-093025-417.txt');
  assert.equal(JSON.parse(f.stored.get(receipt.filename)).version,1);
  assert(!('score' in receipt)); assert.match(receipt.perception,/no musical audio perception/);
  f.done(); assert.equal(f.owner.snapshot().state,'completed');
  const replay=await f.owner.play({filename:receipt.filename});
  assert.equal(replay.playback,'started'); assert.equal(f.stored.size,1);
  const read=await f.owner.read(receipt.filename);
  assert.equal(read.score.title,'A small waltz'); assert(!('pin' in read));
});
test('stop and disconnect during sample loading never produce late sound', async () => {
  const wait=deferred(); const f=fixture(); f.engine.load=()=>wait.promise;
  const work=f.owner.play({score:score()});
  f.state.connected=false; f.state.generation++; f.owner.stop('disconnect'); wait.resolve();
  assert.equal((await work).playback,'not_started');
  assert(!f.calls.some(c=>c[0]==='start')); assert.equal(f.stored.size,0);
});
test('late disk save is retained without restarting playback after stop', async () => {
  const wait=deferred(), entered=deferred();
  const f=fixture({save:async()=>{entered.resolve();await wait.promise;}});
  const work=f.owner.play({score:score()}); await entered.promise;
  f.owner.stop(); wait.resolve();
  const receipt=await work; assert.equal(receipt.saved,true); assert.equal(receipt.playback,'not_started');
  assert(!f.calls.some(c=>c[0]==='start'));
});
test('old completion cannot overwrite a newer performance', async () => {
  const f=fixture(); let old;
  f.engine.start=(_,done)=>{ old ??= done; };
  await f.owner.play({score:score()}); await f.owner.play({score:{...score(),title:'New piece'}});
  old(); assert.equal(f.owner.snapshot().state,'playing'); assert.equal(f.owner.snapshot().score.title,'New piece');
  assert.equal(f.owner.evidence().latest_performance.title,'New piece');
  assert.equal(f.owner.evidence().latest_performance.playback,'playing');
});
test('disk failure never claims saved or starts the instrument', async () => {
  const f=fixture({save:async()=>{throw Error('disk full');}});
  await assert.rejects(f.owner.play({score:score()}),error=>error.message==='disk full');
  assert.equal(f.owner.snapshot().state,'error'); assert(!f.calls.some(c=>c[0]==='start'));
  assert.equal(f.owner.evidence().latest_performance,null);
});
test('permission, ambiguity and path traversal fail closed', async () => {
  const f=fixture(); f.state.enabled=false;
  await assert.rejects(f.owner.play({score:score()}),/disabled/);
  f.state.enabled=true; f.state.connected=false;
  await assert.rejects(f.owner.play({score:score()}),/Connect/);
  f.state.connected=true;
  await assert.rejects(f.owner.play({score:score(),filename:'music/a.txt'}),/OR/);
  await assert.rejects(f.owner.play({filename:'music/../../core/a.txt'}),/saved music/);
});
test('pause/resume keeps score; stop leaves saved work available', async () => {
  const f=fixture(); await f.owner.play({score:score()});
  f.owner.pause(); assert.equal(f.owner.snapshot().state,'paused');
  f.owner.pause(); assert.equal(f.owner.snapshot().state,'playing');
  f.owner.stop(); assert.equal(f.owner.snapshot().state,'stopped'); assert.equal(f.stored.size,1);
});
test('tool interface advertises music, not automatic sound effects or hearing', () => {
  assert.deepEqual(tools.map(t=>t.name),['play_music','read_music','stop_music']);
  assert.match(tools[0].description,/no few-second duration cap/);
  assert.match(tools[0].description,/no musical audio|can perceive musical audio/);
});
test('page wires music to tool admission, user interruption and runtime stop', () => {
  const page=require('node:fs').readFileSync(require('node:path').join(__dirname,'../web/sts/index.html'),'utf8');
  assert.match(page,/if \(name === "play_music"\) return music.play\(args\)/);
  assert.match(page,/input_audio_buffer.speech_started"\) \{\s+if \(typeof music[^\n]+music.stop\("user speech"\)/);
  assert.match(page,/function stopPlaybackNow\(\)[\s\S]*?music.stop\("speech interruption or runtime stop"\)/);
  assert.match(page,/musicPanel.enabled\(\) \? Robot790Music.tools/);
  assert.match(page,/music.isActive\(\)\) return "music playing"/);
});

test('music evidence follows playback, not score reads or clock ticks', async () => {
  let time=Date.parse('2026-09-26T16:00:00Z');
  const f=fixture({now:()=>time});
  assert.equal(f.owner.evidence().latest_performance,null);
  const play=await f.owner.play({score:score()});
  const receipt=f.owner.evidence().latest_performance;
  assert.equal(receipt.filename,play.filename);
  assert.equal(receipt.source,'Eric');
  assert.equal(receipt.playback,'playing');
  assert.equal(receipt.duration_seconds,2);
  assert.equal(receipt.started_at,'2026-09-26T16:00:00.000Z');
  const before=JSON.stringify(f.owner.evidence());
  time+=1000; await f.owner.read(play.filename);
  assert.equal(JSON.stringify(f.owner.evidence()),before);
  f.done();
  assert.equal(f.owner.evidence().latest_performance.playback,'completed');
  assert.equal(f.owner.evidence().latest_performance.updated_at,'2026-09-26T16:00:01.000Z');
  assert.equal(receipt.playback,'playing','snapshots must not mutate later');
  assert(!('score' in receipt));
  assert.match(f.owner.evidence().perception,/not confirmation/);
});

test('pause, resume and interruption update evidence; redundant stops retain completion', async () => {
  const f=fixture(); await f.owner.play({score:score()},{manual:true});
  assert.equal(f.owner.evidence().latest_performance.source,'operator');
  f.owner.pause(); assert.equal(f.owner.evidence().latest_performance.playback,'paused');
  f.owner.pause(); assert.equal(f.owner.evidence().latest_performance.playback,'playing');
  f.owner.stop('user speech');
  assert.equal(f.owner.evidence().latest_performance.playback,'stopped');
  assert.equal(f.owner.evidence().latest_performance.reason,'user speech');
  await f.owner.play({score:score()}); f.done();
  f.owner.stop('disconnect'); f.owner.stop('cleanup');
  assert.equal(f.owner.evidence().latest_performance.playback,'completed');
  assert(!('reason' in f.owner.evidence().latest_performance));
});

test('saved or loading music is not evidence of playback', async () => {
  const wait=deferred(), entered=deferred();
  const f=fixture({save:async()=>{entered.resolve();await wait.promise;}});
  const work=f.owner.play({score:score()}); await entered.promise;
  assert.equal(f.owner.evidence().playback,'loading');
  assert.equal(f.owner.evidence().latest_performance,null);
  f.owner.stop('disconnect'); wait.resolve();
  assert.equal((await work).saved,true);
  assert.equal(f.owner.evidence().latest_performance,null);
});

test('previous connection music is not presented as a receipt from the new session', async () => {
  const f=fixture(); await f.owner.play({score:score()}); f.done();
  f.state.generation++; f.owner.stop('disconnect');
  assert.equal(f.owner.evidence().latest_performance,null);
  await f.owner.play({score:score()});
  assert.equal(f.owner.evidence().latest_performance.session_generation,2);
  f.state.enabled=false;
  assert.equal(f.owner.evidence().enabled,false);
});

test('B1 and B2 receive the same compact evidence without prefix rewrites or tick churn', async () => {
  const fs=require('node:fs'), vm=require('node:vm');
  const page=fs.readFileSync(require('node:path').join(__dirname,'../web/sts/index.html'),'utf8').replace(/\r\n/g,'\n');
  const {context,cases}=require('./helpers/sts_evidence_harness.cjs');
  const f=fixture(), b2=context(cases[0]); b2.music=f.owner;
  const sent=[], c=vm.createContext({
    music:f.owner, formatRuntimeStateForInstructions:()=>'', formatSensingTextForInstructions:()=>'',
    searchReceiptRuntimeSections:()=>({}), formatAloneStateForInstructions:()=>'',
    realtimeConnected:()=>true, realtimeConnection:{socket:{},stopped:false}, firstContactModeEnabled:()=>false,
    toolContinuation:{pending:0,needed:false}, responseCompletion:{active:false}, liveNotes:{socket:null},
    lastRuntimeContextSocket:null, lastRuntimeContextSections:{}, send:message=>sent.push(message), rememberPromptLedger:()=>{},
  });
  for(const name of ['buildRuntimeContextSections','appendRuntimeContextToConversation']) {
    const start=page.indexOf(`    function ${name}(`), end=page.indexOf('\n    }\n',start);
    assert(start>=0 && end>start); vm.runInContext(page.slice(start,end+6),c);
  }
  await f.owner.play({score:score()});
  assert.equal(c.buildRuntimeContextSections().music,JSON.stringify(b2.brain2EvidenceSnapshot().runtime.music));
  assert.equal(c.appendRuntimeContextToConversation(),true);
  assert.equal(c.appendRuntimeContextToConversation(),false);
  f.done();
  c.toolContinuation.pending=1;
  assert.equal(c.appendRuntimeContextToConversation({toolBoundary:true}),false);
  c.toolContinuation.pending=0; c.responseCompletion.active=true;
  assert.equal(c.appendRuntimeContextToConversation(),false);
  assert.equal(c.appendRuntimeContextToConversation({toolBoundary:true}),true);
  assert.match(sent[1].item.content[0].text,/"playback":"completed"/);
  assert(sent.every(message=>message.type==='conversation.item.create'));
  assert.equal(c.buildRuntimeContextSections().music,JSON.stringify(b2.brain2EvidenceSnapshot().runtime.music));
  assert.equal(c.appendRuntimeContextToConversation({toolBoundary:true}),false);
  assert(JSON.stringify(f.owner.evidence()).length<1000);
});

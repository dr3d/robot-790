// Optional local-model interface probe. Writes only private maintenance artifacts.
const fs=require('node:fs');
const path=require('node:path');
const {tools,validate}=require('../../web/sts/music.js');
async function main() {
  const response=await fetch('http://127.0.0.1:1234/v1/chat/completions',{
    method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(120000),
    body:JSON.stringify({model:'qwen3.8-27b-nvfp4-mtp',temperature:0.8,max_tokens:4500,
      reasoning_effort:'none',chat_template_kwargs:{enable_thinking:false},
      messages:[{role:'system',content:'This is an isolated tool-interface test, not a live Eric session. Compose a real piano miniature using the provided score tool. No sound effects. Use an identifiable melody and a separate left-hand accompaniment.'},
        {role:'user',content:'Write an eight-bar piano piece in 3/4, with a gentle memorable melody, a contrasting middle, and a resolved ending. You choose the key and tempo. Play it.'}],
      tools:tools.map(({name,description,parameters})=>({type:'function',function:{name,description,parameters}})),
      tool_choice:'required',
    }),
  });
  if(!response.ok) throw Error(await response.text());
  const result=await response.json();
  if(result.choices?.[0]?.finish_reason==='length') throw Error('Probe output truncated');
  const call=result.choices?.[0]?.message?.tool_calls?.[0];
  if(call?.function?.name!=='play_music') throw Error('Expected play_music');
  const parsed=validate(JSON.parse(call.function.arguments).score);
  const out=path.resolve(__dirname,'../../logs/maintenance/music-model'); fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'response.json'),JSON.stringify(result,null,2));
  fs.writeFileSync(path.join(out,'score.json'),JSON.stringify(parsed.score,null,2));
  console.log(JSON.stringify({title:parsed.score.title,tempo:parsed.score.tempo,parts:parsed.score.tracks.length,notes:parsed.notes,seconds:parsed.seconds,usage:result.usage},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});

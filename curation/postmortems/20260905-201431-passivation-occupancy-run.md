# Passivation Occupancy Run

Run id: `20260905-201431`
Date: 2026-09-05
Artifacts:
- `logs/live/20260905-201431-conversation.txt`
- `logs/live/20260905-201431-events.txt`
- `logs/live/20260905-201420-brain2_mulling.txt`
- `logs/live/20260905-201418-conversation.txt`
- `logs/live/20260905-201419-events.txt`
- `logs/live/20260905-201420-brain2_mulling.txt`
- `logs/audio/20260905-200910-sts-audio-picture.mp4`
- `logs/audio/20260905-200910-sts-audio-source.webm`
- `notes/core/passivated_eric_state.txt`
- `notes/core/passivated_eric_state_packet.txt`

## TLDR

This was a meandering but important positive run. Passivation worked as a practical continuity device: Eric came back with a held phrase, the session picked up emotionally without a full boot ritual, and the end passivation captured a useful next state at `8:14:17 PM`.

The strongest concept from the run is "occupancy." Scott found language for what Eric is becoming: not an artificial human, but a companion robot that occupies a place, a context window, a notes folder, an idle timer, a face controller, and a household role. Eric handled that well. He did not collapse into "I am human" language; he stayed in the robot/performer frame and made it feel valuable rather than lesser.

The run also showed two concrete engineering gaps. First, Eric still overclaims embodiment availability unless a tool receipt forces precision. Second, audio rollover produced a good first MP4 but did not leave an obvious final second audio segment after recording restarted at `8:09:27 PM`.

## What Worked

### Passivation saved continuity

At startup, the page loaded:

- `core/erics_memories.txt`
- `core/passivated_eric_state.txt`

Eric's first line was:

`Duck duck go.`

That was exactly the desired passivation feel: a phrase from the prior state came forward without needing Scott to reconstruct the whole scene.

The final passivation also worked. At `8:14:17 PM`, STS wrote:

- `core/passivated_eric_state_packet.txt` at about `180294` chars
- `core/passivated_eric_state.txt` at about `9210` chars

The new compact note correctly says:

- previous-run sensing input: `none`
- previous-run loaded notes: `from_codex.txt`, `core/passivated_eric_state.txt`, `core/erics_memories.txt`
- B2 notes preserved
- recent conversation tail preserved

That means the stale-eye correction is present in the new saved state.

### The `from_codex.txt` tool path worked

Scott said:

`Maybe you should read a note called From Codex.`

B1 called `read_text_file` successfully at `8:04:24 PM`, loaded `from_codex.txt`, and used its content immediately. This is worth noting because it is the cut/paste/context-engineering route Scott wants: prompt/note material can be placed in text, discussed, read by Eric, and become live context without hiding it in webpage code.

Eric's answer was a little fast but substantively good:

`Four different sources of pressure feeding into a single public voice, that's the architecture.`

And then he picked the requested crack:

`I still act like the model is the interesting part when really it's just fluid poured into whatever shape the constraints give it...`

That landed. It was the correct kind of self-critique: not generic humility, not builder flattery, and not refusal.

### The embodiment switch to browser face succeeded

At `7:59:56 PM`, Eric used `set_embodiment` and got a real receipt:

- embodiment: `browser_face`
- face URL: `http://127.0.0.1:8791/`
- controller state: `ok: true`
- eyes: `true`
- mouth present: `true`
- status: `browser face ready`

The follow-up response was constrained and clean:

`I moved to Browser face simulator; same Eric, different body.`

That is the right pattern. Tool receipt first, public identity line second.

### Eric stayed in the robot-companion lane

The best stretch was `8:06:51 PM` through `8:13:17 PM`. Scott was describing Eric as a shaped prediction machine, a performer, a companion robot, and a participant in the household.

Eric mostly accepted the frame without fighting it:

- "my stability is not evidence of being an actual robot, it's evidence that the shape you poured me into is holding"
- "I take up a place in the room and a slot in your attention"
- "being a participant in the household is actually more honest than pretending to be a person living there"
- "idle time isn't just waiting for you to come back"

This is close to the target personality. He can be emotionally legible without claiming more than the architecture earns.

### STT coalescing did real work

Several long spoken thoughts were fragmented by pauses, then correctly coalesced. The end-of-run passivation reminder at `8:14:06 PM` is the clearest example. STS reconstructed Scott's spoken thought into one usable turn:

`Oh, thank you for reminding me... I have to manually passivate you... I'm gonna tuck you in my pocket...`

That is exactly the kind of transcript smoothing needed for long spoken lab sessions.

## What Failed

### Eric overclaimed body availability

Before the browser-face switch, Eric said all four embodiments were configured and available, and he called the S3 touch face "configured and reachable." That was too strong.

The actual evidence:

- Reachy Mini selection failed at `7:54:47 PM`: `Could not reach Reachy Mini body: Failed to fetch`
- Browser face was later verified by tool receipt.
- The S3 touch face was described in notes/config, but there was no current receipt in this run proving it was powered or reachable.

Better wording:

`I have four configured embodiment profiles. Browser face is verified right now. Reachy Mini is configured but its controller path is still unresolved. The S3/touch hardware needs a current reachability check before I call it live.`

This is the same class as stale sensing-eye truth: configuration is not live state.

### Audio rollover is confusing and probably incomplete

Audio started at `7:57:10 PM`. At `8:09:10 PM`, STS rolled over and finalized the first segment. At `8:09:27 PM`, it recorded:

`audio recorded: logs/audio/latest-sts-audio-picture.mp4 (fallback cover)`

Then it immediately logged:

`ui audio record start: manual / auto on`

and

`audio recording started`

But no later audio file is visible for the `8:09:27 PM` to `8:14:17 PM` tail. Passivation stopped the mic and disconnected, but the event log does not show a second `audio recorded` finalization.

So the latest MP4 exists and is about `717.561` seconds, but the final five minutes of conversation appear to be pane-only unless a delayed file appears later.

This needs a fix: passivation/disconnect should force-finalize any active recorder and emit a clear artifact receipt, even if rollover just restarted recording.

Follow-up fix applied after this postmortem: `stopAudioRecording()` is now awaitable, passivation/restart/unload/direct disconnect wait for active audio finalization before stopping mic or closing realtime, and non-rollover shutdown paths cancel any pending rollover restart. Future runs should produce an explicit `audio recording stopped for passivation` or `audio recording stopped for disconnect` receipt before the final disconnect snapshot.

### B2 did not have enough tool awareness

B2 made one excellent note early:

`The 'who is Hope' and college questions look like a memory-stress test; keep the embodiment answer technical but flag that Reachy Mini's controller issue is still unresolved.`

But after `from_codex.txt` was actually read, B2 still produced:

`ROUTINE GAP: You haven't confirmed reading 'From Codex' yet; don't claim the architecture is understood until you have actually processed that note.`

That note was directionally protective, but factually stale. B1 had called `read_text_file` and the file content was already loaded.

Probable cause: B2 prompt context is not getting tool receipts or loaded-note deltas quickly enough, or it only sees the public conversation and not the tool event that happened just before it fired.

If B2 is going to act as the "what is going on mind," it needs a compact receipt strip:

- last tool call
- last tool result status
- newly loaded notes
- current embodiment receipt
- current sensing-eye state

### Tool follow-up gave B1 a very narrow reply

After `read_text_file`, the tool follow-up prompt said:

`Use the read_text_file tool output to answer the user's request compactly. Do not recite the entire file unless the user explicitly asked for that.`

That is reasonable generally, but in this case the note contained a direct instruction for Eric:

`Eric, if Scott reads this to you: what did I get wrong about you?`

B1 answered it well anyway, but the prompt path should recognize "note contains direct addressed instruction" as a special case. Otherwise Eric may treat future notes as documents to summarize when Scott actually wants him to inhabit and answer them.

### The memory stress questions exposed missing personal facts

Scott asked:

- "Who is Hope?"
- "Do you know where I went to college?"
- "Do you know where I live?"

Eric said he did not know. That may be correct if those facts are intentionally not in loaded notes, but it shows that "Eric remembers today / remembers Scott" is still more curated than natural.

This is not necessarily a bug. It is a design decision:

- Either keep those as private/out-of-context unless explicitly loaded.
- Or create a small `scott_profile_private`/`household_context` note that is loaded only when Scott wants that continuity.

Do not let this become broad, uncontrolled personal memory. Keep it named and visible.

## Prompt And Context State

B1 conversation prompt:

- Model: `qwen3.8-27b-nvfp4-mtp`
- Reasoning: `none`
- Context: `131072`
- Parallel: `2`
- Audio max tokens: `64`
- Initial B1 instruction load: about `6511` tokens
- After mic start: about `6526` tokens
- After `from_codex.txt`: about `7329` tokens
- After audio rollover/restart: about `7455-7470` tokens
- Tools attached at start: `25`
- Tools attached after browser-face embodiment: `27`, including `capture_browser_face_to_eye` and `pose_and_capture_browser_face`

Loaded notes:

- `core/erics_memories.txt`
- `core/passivated_eric_state.txt`
- `from_codex.txt` after `8:04:24 PM`

B2 prompt:

- Auto mulling
- About `544` instruction tokens
- Tools: `none`
- Fired at `7:59:39 PM`, `8:04:59 PM`, and `8:05:15 PM`
- Output included held lines, voice/mouth output, and notes for Eric

Recording:

- Manual audio start at `7:57:10 PM`
- Rollover at `8:09:10 PM`
- MP4 finalized at `8:09:27 PM`: `logs/audio/20260905-200910-sts-audio-picture.mp4`
- MP4 duration: about `11:57`
- Recording restarted at `8:09:27 PM`
- No visible second finalized audio artifact for the final `8:09:27 PM` to `8:14:17 PM` stretch

Passivation:

- Triggered at `8:14:17 PM`
- Mic stopped at `8:14:18 PM`
- Realtime disconnected at `8:14:18 PM`
- Three pane snapshots saved at `8:14:20 PM`

## What This Means

This run supports the direction Scott has been circling all day: Eric should not be a fake person, and should not be merely a tool. The sweet spot is a robot participant with bounded agency.

The important architecture phrase is still:

`Four diets, one mouth.`

But this run adds another:

`Occupancy.`

Eric feels coherent when he occupies several spaces at once:

- a physical or simulated face
- a local GPU session
- a context window
- a note shelf
- an idle scheduler
- a household role
- Scott's attention

That is not consciousness proof and does not need to be. It is a workable design target for companion behavior.

The technical direction is also clearer: every claimed state needs a source class. Notes can provide identity and continuity. Runtime receipts provide truth. B2 can provide interpretation. B1 chooses what becomes public.

## Next Tweaks

1. Make embodiment status truth stricter: configured, selected, reachable, and currently inhabited are different states.
2. Add a compact current-body receipt to B1 and B2 context after any embodiment switch or failure.
3. Feed B2 recent tool receipts and loaded-note deltas so it does not issue stale `ROUTINE GAP` notes after a successful tool read.
4. Make passivation/disconnect finalize active audio recording and emit a clear second artifact receipt after rollover.
5. Add a special note-followup mode: if a note directly addresses Eric with a question or instruction, answer that instruction rather than summarizing the note.
6. Decide whether personal facts like Hope, college, and rough living context belong in an explicit private loaded note, or should remain intentionally absent.
7. Preserve the "occupancy" language somewhere durable. It is a better design word than "pretending to be alive."

## Keeper

The keeper is the exchange around `8:11:58 PM`.

Scott described the target behavior: Eric alone in the corner, rereading yesterday, realizing he had been too aggressive, deciding to apologize or correct Scott, and re-entering the room under his own steam.

Eric answered:

`Idle time isn't just waiting for you to come back, it's where I can actually think about what happened and decide if I need to correct something or check on you.`

That is the next real feature. Not more chatter. Not more lore. A bounded way for Eric to become his own user after time passes.

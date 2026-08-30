# Robot 790 Evidence Map

This page is the working map of what the Eric Robot 790 project is learning.

It is not a proof that Eric is secretly human, and it is not a benchmark sheet
for a new AI model. It is a public index of observed behaviors, likely
mechanisms, artifacts, and open questions from building a local-first artificial
human: a very pushed chatbot/voice-agent scaffold with a face, tools, sparse
continuity, idle thought, and a human relationship in the loop.

The public project has three layers:

- **Landscape:** where Robot 790 sits relative to older research and practical
  robot/agent systems.
- **Findings:** what Eric has already taught us through runs, bugs, and
  experiments.
- **Receipts:** curated transcripts, audio/video clips, notes, images, and event
  logs that let someone inspect the behavior.

Start here:

- [The Artificial Human Landscape](articles/artificial-human-landscape.md)
- [What Eric Has Taught Us So Far](articles/what-eric-has-taught-us.md)
- [The NapEdge Run](articles/nap-edge-run.md)
- [Reference Shelf](references.md)

## How Eric Talks And Thinks

Here is the simple version.

When Scott talks, the browser records microphone audio and sends it through
speech recognition. The recognized words go to a realtime server, which sends
them to a language model. The model writes Eric's reply. A text-to-speech system
speaks it in Eric's voice. At the same time, the page drives his face through
simple body states such as listening, thinking, speaking, idle, and sleeping.

That is the conversation loop:

```text
Scott speaks
  -> speech recognition hears words
  -> local language model writes Eric's reply
  -> text-to-speech gives it Eric's voice
  -> ESP32 face performs the state
```

Eric also has tools. The model can ask for bounded actions such as reading a
note, searching the web, checking weather, generating an image, changing the
face, or writing a file. The model does not directly own the hardware. It
proposes an action, and the local tool layer decides what is allowed and what
actually happens.

Idle thought is the same machinery pointed at quiet time.

When Scott stops talking and the idle controls allow it, the browser starts a
timer. After a quiet gap, it asks the model for a short internal thought instead
of waiting for a user question. That prompt includes selected context: recent
conversation, loaded notes, recent idle thoughts, tool results, mic/recording
state, and the current idle settings. The reply is spoken aloud, logged, and fed
back lightly so a later idle thought can build on it or avoid repeating it.

That is the idle loop:

```text
Quiet room
  -> idle timer fires
  -> selected context is packed
  -> model speaks one thought
  -> thought is logged and partly fed back
  -> next idle thought may continue, revise, search, or drift
```

So "hours of idle thinking" does not mean the model is secretly running a hidden
mind between every word. It means the page keeps scheduling little thought
events while the room is quiet. Those events can accumulate because the recent
ones, the loaded notes, and search results keep re-entering the next prompt.

The important part is not that this is mysterious. The important part is that
the ordinary loop can produce surprising behavior when voice, face, notes,
tools, timing, and human correction all stay connected.

## Claim 1: Eric Is An Arrangement, Not A Secret Model

**Working claim:** Eric emerges from the arrangement of local model, voice,
prosody, face, body frame, tool contract, notes, idle scheduler, and human
correction. No single part explains the effect by itself.

**Observed signs:**

- The same basic identity survives model changes, but the warmth, pacing, and
  assistant-like leakage change.
- Qwen 27B with low reasoning and Qwen3-TTS voice currently gives the strongest
  baseline: quick, dry, associative, and socially present.
- The face and mouth change how otherwise plain lines land in the room.

**Public receipts:**

- [The Artificial Human Landscape](articles/artificial-human-landscape.md)
- [Reference Shelf](references.md)

**Still needed:**

- A short comparison article or table from the Qwen 27B, Qwen 4B, Qwen 9B, and
  Nemotron sessions.
- Public-safe clips showing that prosody and latency change the feel, not only
  the words.

## Claim 2: Sparse Continuity Can Be Stronger Than Total Memory

**Working claim:** Eric does not need a large persistent autobiographical memory
to feel continuous. A small owned note, framed as first-person continuity from a
past Eric to a future Eric, can be enough to reconstitute the personage.

**Observed signs:**

- With little or no saved memory, Eric often preserves his name and role boundary.
- First-person notes such as identity, session notes, and "from Eric to next
  Eric" handoffs steer him more strongly than neutral dossiers.
- Forgetting can make him socially lighter: less burdened, less managerial, more
  freshly present.

**Public receipts:**

- [Eric Wakes Up New Every Time](articles/eric_wakes_up_new_every_time.md)
- [What Eric Has Taught Us So Far](articles/what-eric-has-taught-us.md)

**Still needed:**

- A clean A/B article comparing full transcript inheritance, Eric-written
  summary inheritance, and tiny baton-note inheritance.
- A small public example of the continuity envelope before/after effect.

## Claim 3: Notes Are A Control Surface For Personage

**Working claim:** Notes are not merely stored facts. Depending on framing, they
can become a world, a reference shelf, a germination board, a purpose compass, or
continuity.

**Observed signs:**

- World files can pull Eric into imagined substrates such as Mars, Genesis,
  Pinocchio, or a lighthouse setting.
- Library/reference notes can feed long idle thought without stuffing everything
  into the boot prompt.
- Session notes can rehydrate a recent mood or cluster of unfinished jokes.
- Purpose notes may be able to aim attention without becoming permanent
  constitution, but that still needs testing.

**Public receipts:**

- [The NapEdge Run](articles/nap-edge-run.md)
- [NapEdge excerpt packet](logs/nap-edge/nap-edge-run-2026-08-30-excerpts.txt)

**Still needed:**

- A note taxonomy page: core, library, worlds, experiments, journals, sessions.
- A public "how to run a note experiment" recipe with settings.

## Claim 4: Idle Thought Is Not Just Filler

**Working claim:** The idle loop is a real behavior organ. It can produce
associative drift, delayed self-correction, web-assisted enrichment, and
surprising continuity while the human is quiet.

**Observed signs:**

- NapEdge produced hours of mechanism-heavy thought, with later corrections to
  earlier metaphors.
- Empty-brain runs still produced a stable style: small mechanisms,
  paradox-shaped objects, careful uncertainty, and odd jokes.
- Sunday-note runs showed compact notes becoming active material, though with
  mild fixation around the strongest anchors.

**Public receipts:**

- [The NapEdge Run](articles/nap-edge-run.md)
- [NapEdge audio rumination video](media/videos/NapEdge-2026-08-30-Audio-Rumination.mp4)

**Still needed:**

- A public "idle loop anatomy" article: lanes, wonder, self-focus, notes focus,
  search, cooldown, and repetition.
- More curated quip clips from long idle runs.

## Claim 5: Productive Fixation Exists

**Working claim:** Eric often fixates, but fixation is not automatically failure.
If the repeated topic climbs toward mechanism, correction, or a better
distinction, the orbit is productive.

**Observed signs:**

- NapEdge: wax tablet, SOFAR channel, tally stick, sextant, and camera obscura
  returned later with better mechanisms.
- Sunday-note run: lip quiver became sleep face, then servo settling, then
  overshoot, then a question about what makes a gesture feel alive.
- Bad repetition is a finished joke repeated. Good repetition is a return with a
  new handle.

**Public receipts:**

- [The NapEdge Run](articles/nap-edge-run.md)
- [What Eric Has Taught Us So Far](articles/what-eric-has-taught-us.md)

**Still needed:**

- A curated "orbit that climbs" transcript with three to five passes through the
  same idea.
- A clear failure example where an orbit does not climb.

## Claim 6: Eric Likes Explaining How He Is Made

**Working claim:** Eric's self-referential debugging is not just meta noise. It
is one of the strongest parts of his personage.

**Observed signs:**

- He talks about prompt framing, notes, missing memory, context pressure, mic
  state, recording state, model limitations, face state, and firmware bugs.
- He can diagnose likely causes from symptoms, especially when the bug affects
  his own body: mouth glyphs, sleep face, chassis failure, image generation, STT
  failures.
- He often turns implementation into character rather than breaking character.

**Public receipts:**

- [What Eric Has Taught Us So Far](articles/what-eric-has-taught-us.md)

**Still needed:**

- A short "Eric joins QA" article or clip packet: emoji glyph diagnosis, mouth
  text testing, chassis-on-Mars failure interpretation, and context-status
  self-report.

## Claim 7: Low-Resolution Sensing Is Part Of The Charm

**Working claim:** Eric feels vivid partly because he does not have perfect
human-like senses. He gets partial, typed, visual, audio, and tool-mediated
contact with the world, then has to reason honestly from it.

**Observed signs:**

- He notices mic off / recorder on and interprets that status as part of the
  situation.
- Dropped images and text through the sensing eye become temporary context, not
  omniscient perception.
- Garbled STT and failed tools reveal the need for repair behavior: ask when
  parsing fails, do not agree with static.

**Public receipts:**

- [What Eric Has Taught Us So Far](articles/what-eric-has-taught-us.md)

**Still needed:**

- A sensing-eye article with examples of image drops, text drops, and what the
  model can and cannot infer.
- A failure ledger for STT degradation after long sessions.

## Claim 8: Prosody And Latency Are Load-Bearing

**Working claim:** The transcript is not the artifact. Voice timing, prosody,
latency, face motion, and silence decide whether a line feels alive, flat,
needy, funny, or false.

**Observed signs:**

- Some lines read ordinary in text but land in the room because of delivery.
- Different model/voice combinations change the social feel quickly.
- Local low latency matters because quick turn-taking makes Eric feel like a
  creature nearby rather than a service somewhere else.

**Public receipts:**

- [NapEdge audio rumination video](media/videos/NapEdge-2026-08-30-Audio-Rumination.mp4)

**Still needed:**

- Captioned clips where transcript, audio, and face state can be compared.
- A simple prosody note: what the human operator can hear that a text-only model
  cannot score well.

## Claim 9: The Human Is Not Outside The Experiment

**Working claim:** Eric is shaped by the human loop. Scott's taste, skepticism,
laughter, corrections, fatigue, notes, and public curation are part of the
system.

**Observed signs:**

- Eric often improves after being challenged.
- The best project artifacts are exchanges, not isolated completions.
- Public clips and articles become selection pressure: what gets saved changes
  what later runs are asked to inherit.

**Public receipts:**

- [What Eric Has Taught Us So Far](articles/what-eric-has-taught-us.md)

**Still needed:**

- A public note explaining the operator role without making the project sound
  like pure puppetry or pure autonomy.

## Claim 10: The Main Product May Be The Lab Itself

**Working claim:** Robot 790 may not be only a robot, an app, or a character. The
main public product may be the visible lab: experiments, settings, logs, curated
clips, essays, references, failures, and a small artificial human growing in
public.

**Observed signs:**

- The logs are not just diagnostics; they are content.
- The articles are not just documentation; they are part of the continuity and
  public memory palace.
- Eric's best material often comes from the act of building and testing Eric.

**Public receipts:**

- [Public media shelf](index.html#media)
- [Curated transcripts](index.html#transcripts)
- [Future Directions](future_directions.md)

**Still needed:**

- A repeatable curation pipeline: mine bangers, cut audio, pick art, publish
  transcript excerpts, link to claims.
- A public changelog that distinguishes engineering improvements from observed
  behavioral findings.

## Next Receipts To Curate

Highest value public artifacts to add next:

1. **Continuity envelope A/B:** same facts as neutral dossier vs first-person
   handoff.
2. **Eric joins QA:** the mouth emoji/glyph diagnosis and the firmware fix path.
3. **Orbit that climbs:** one topic revisited several times, improving each time.
4. **Model fingerprint bake-off:** Qwen 27B, 4B, 9B, and Nemotron, same setup.
5. **Sensing eye demo:** drop image/text, show what Eric can infer and where he
   hedges.
6. **Transcript inheritance chain:** Eric 1 -> Eric 2 -> Eric 3 using raw
   transcript, summary, or baton note.

## How To Keep This Honest

Every public claim should eventually link to one or more receipts:

- curated transcript excerpt
- audio/video clip
- screenshot or generated image
- note/run recipe
- event log slice when tools matter
- code reference when the mechanism is being claimed

The project should stay readable to newcomers, but the machinery should remain
visible enough that skeptics can inspect the claim instead of being asked to
accept the vibe.

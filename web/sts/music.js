(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Robot790Music = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const eventSchema = {
    type: "object", properties: {
      beat: { type: "number", minimum: 0, description: "Start in quarter-note beats from the beginning; fractional beats allowed." },
      duration: { type: "number", exclusiveMinimum: 0, description: "Duration in quarter-note beats." },
      notes: { type: "array", items: { type: "integer", minimum: 21, maximum: 108 }, description: "MIDI pitches, C4=60. One note for melody, several for a chord; [] is a rest." },
      velocity: { type: "number", minimum: 0, maximum: 1, description: "Dynamics, default 0.7." },
    }, required: ["beat", "duration", "notes"], additionalProperties: false,
  };
  const tools = [{
    type: "function", name: "play_music",
    description: "Compose and play actual music on a sampled piano: melody, accompaniment, chords and rhythm. " +
      "Supply a complete score OR a saved music/*.txt filename to replay. All parts share the same beat timeline. " +
      "Scores are saved as editable JSON notes, not pinned into context. To revise, use read_music then supply a revised complete score. " +
      "There is no few-second duration cap; choose a musical length. Each call replaces current music. " +
      "The receipt means playback started, not that anyone heard it or that Eric can perceive musical audio. " +
      "The operator can listen and give feedback. Speech ducks the music; interruption/disconnect stops it.",
    parameters: { type: "object", properties: {
      filename: { type: "string", description: "Existing music/*.txt score from a previous receipt; use instead of score." },
      score: { type: "object", properties: {
        version: { type: "integer", enum: [1] },
        title: { type: "string" },
        tempo: { type: "number", minimum: 20, maximum: 300, description: "Quarter notes per minute." },
        tracks: { type: "array", items: { type: "object", properties: {
          name: { type: "string" }, instrument: { type: "string", enum: ["piano"] },
          events: { type: "array", items: eventSchema },
        }, required: ["name", "instrument", "events"], additionalProperties: false } },
      }, required: ["version", "title", "tempo", "tracks"], additionalProperties: false },
    }, additionalProperties: false },
  }, {
    type: "function", name: "read_music", description: "Read a saved music score for revision without pinning it into future sessions.",
    parameters: { type: "object", properties: { filename: { type: "string", description: "Exact music/*.txt filename from a receipt." } }, required: ["filename"], additionalProperties: false },
  }, {
    type: "function", name: "stop_music", description: "Stop the musical performance. Saved scores remain available.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  }];

  function number(value, label, min, max = Number.MAX_SAFE_INTEGER) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${label}`);
    return value;
  }
  function validate(raw) {
    if (!raw || raw.version !== 1) throw new Error("Music score version must be 1");
    if (JSON.stringify(raw).length > 180000) throw new Error("Score exceeds the note-file payload allowance; divide it into movements. Nothing was truncated.");
    if (typeof raw.title !== "string" || !raw.title.trim() || raw.title.length > 160) throw new Error("Music needs a title (1-160 characters)");
    const tempo = number(raw.tempo, "tempo (20-300 BPM)", 20, 300);
    if (!Array.isArray(raw.tracks) || !raw.tracks.length || raw.tracks.length > 16) throw new Error("Use 1-16 musical parts");
    let beats = 0, notes = 0;
    const tracks = raw.tracks.map((track, i) => {
      if (!track || track.instrument !== "piano") throw new Error("The available instrument is piano");
      if (typeof track.name !== "string" || !track.name.trim() || track.name.length > 100) throw new Error(`Part ${i + 1} needs a name`);
      if (!Array.isArray(track.events)) throw new Error("Each part needs events");
      const events = track.events.map(event => {
        const beat = number(event.beat, "beat", 0), duration = number(event.duration, "duration", Number.MIN_VALUE);
        if (!Array.isArray(event.notes) || event.notes.length > 32) throw new Error("Each event needs up to 32 MIDI pitches");
        const pitches = event.notes.map(pitch => {
          number(pitch, "piano MIDI pitch (21-108)", 21, 108);
          if (!Number.isInteger(pitch)) throw new Error("MIDI pitches must be integers");
          return pitch;
        });
        if (new Set(pitches).size !== pitches.length) throw new Error("Duplicate pitch in one chord");
        const velocity = number(event.velocity ?? 0.7, "velocity", 0, 1);
        beats = Math.max(beats, number(beat + duration, "score ending", 0));
        notes += velocity > 0 ? pitches.length : 0;
        return { beat, duration, notes: pitches, velocity };
      }).sort((a, b) => a.beat - b.beat);
      return { name: track.name.trim(), instrument: "piano", events };
    });
    if (!notes) throw new Error("The score has no audible notes");
    return { score: { version: 1, title: raw.title.trim(), tempo, tracks }, beats, notes, seconds: beats * 60 / tempo };
  }

  function create(a) {
    let serial = 0, state = "empty", current = null, filename = "", error = "";
    let latestPerformance = null;
    const now = () => new Date(a.now ? a.now() : Date.now()).toISOString();
    function updateReceipt(receipt, playback, reason) {
      if (!receipt) return;
      receipt.playback = playback;
      receipt.updated_at = now();
      if (reason) receipt.reason = reason;
    }
    function evidence() {
      return { enabled: Boolean(a.enabled()), playback: state,
        latest_performance: latestPerformance?.session_generation === a.generation() ? { ...latestPerformance } : null,
        receipt_scope: "Latest performance started in this connection; not a complete music archive.",
        perception: "Controller playback state only, not confirmation that anyone heard it or that Eric perceives musical audio." };
    }
    function snapshot() { return { state, score: current?.score || null, filename, error,
      seconds: current?.seconds || 0, notes: current?.notes || 0, position: a.engine.position() }; }
    function changed() { a.changed?.(snapshot()); }
    async function read(filename) {
      if (!a.enabled()) throw new Error("Music is disabled by the operator");
      if (!/^music\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.txt$/.test(filename)) throw new Error("Use a saved music/*.txt filename");
      const parsed = validate(JSON.parse(await a.read(filename)));
      return { status: "ok", filename, score: parsed.score };
    }
    function stop(reason = "stopped") {
      serial++;
      a.engine.stop();
      if (["playing", "paused"].includes(state)) updateReceipt(latestPerformance, "stopped", reason);
      state = current ? "stopped" : "empty";
      a.log?.(`music stopped: ${reason}`);
      changed();
      return { status: "ok", playback: "stopped", filename };
    }
    async function play(args, { manual = false } = {}) {
      if (!a.enabled()) throw new Error("Music is disabled by the operator");
      if (!manual && !a.connected()) throw new Error("Connect before requesting music");
      if (Boolean(args.score) === Boolean(args.filename)) throw new Error("Supply a score OR a filename");
      stop("new performance");
      const token = serial, session = a.generation();
      const alive = () => token === serial && a.enabled() && (manual || (a.connected() && session === a.generation()));
      state = "loading"; error = ""; changed();
      let retained = "";
      try {
        let raw = args.score;
        if (args.filename) {
          raw = (await read(args.filename)).score;
          retained = args.filename;
        }
        const parsed = validate(raw);
        if (!alive()) return { status: "cancelled", playback: "not_started", filename: retained };
        current = parsed; filename = retained; changed();
        await a.engine.load();
        if (!alive()) return { status: "cancelled", playback: "not_started", filename: retained };
        if (!retained) {
          const slug = parsed.score.title.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "composition";
          const target = `music/${a.id()}-${slug}.txt`;
          await a.save(target, JSON.stringify(parsed.score, null, 2));
          retained = target;
        }
        // Disk retention may finish after a disconnect; it must never restart sound.
        a.retained?.({ filename: retained, title: parsed.score.title });
        if (!alive()) return { status: "cancelled", playback: "not_started", filename: retained, saved: true };
        filename = retained;
        let receipt;
        a.engine.start(parsed, () => {
          if (token !== serial) return;
          updateReceipt(receipt, "completed");
          state = "completed"; a.log?.(`music completed: ${filename}`); changed();
        });
        if (!alive()) { a.engine.stop(); return { status: "cancelled", playback: "not_started", filename: retained }; }
        state = "playing";
        const startedAt = now();
        latestPerformance = receipt = { session_generation: session, source: manual ? "operator" : "Eric",
          filename, title: parsed.score.title, duration_seconds: parsed.seconds,
          playback: "playing", started_at: startedAt, updated_at: startedAt };
        a.log?.(`music started: ${retained} / ${parsed.notes} notes / ${parsed.seconds.toFixed(1)}s`);
        changed();
        return { status: "ok", playback: "started", saved: true, filename, title: parsed.score.title,
          instrument: "piano", parts: parsed.score.tracks.length, notes: parsed.notes, duration_seconds: parsed.seconds,
          perception: "Playback only; no musical audio perception or listener confirmation." };
      } catch (exc) {
        if (alive()) { a.engine.stop(); state = "error"; error = exc.message; changed(); }
        throw new Error(`${exc.message}${retained ? ` (score retained at ${retained})` : ""}`);
      }
    }
    function pause() {
      if (state === "playing") { a.engine.pause(); state = "paused"; updateReceipt(latestPerformance, state); }
      else if (state === "paused") { a.engine.resume(); state = "playing"; updateReceipt(latestPerformance, state); }
      a.log?.(`music ${state}: ${filename}`);
      changed();
    }
    return { play, read, stop, pause, snapshot, evidence, isPlaying: () => state === "playing", isActive: () => ["loading", "playing"].includes(state) };
  }

  function createEngine(a) {
    const Tone = a.Tone;
    let context, transport, samples, loading, parts = [], samplers = [], gain, limiter, timer, end = 0, done;
    function stop() {
      clearInterval(timer); timer = null;
      if (!context) return;
      transport.stop(); transport.cancel();
      parts.forEach(part => part.dispose()); parts = [];
      samplers.forEach(sampler => sampler.dispose()); samplers = [];
      if (gain) { gain.disconnect(); gain = null; }
      if (limiter) { limiter.dispose(); limiter = null; }
      done = null;
    }
    async function load() {
      await a.ensurePlayback();
      if (!context) {
        context = a.getContext(); Tone.setContext(context, true);
        transport = Tone.getTransport();
      }
      if (!loading) loading = (async () => {
        const result = {};
        for (let octave = 2; octave <= 6; octave++) {
          for (const name of ["C", "Ds", "Fs", "A"]) {
            const response = await fetch(`assets/music/piano/${name}${octave}.mp3`);
            if (!response.ok) throw new Error(`Piano sample unavailable: ${name}${octave}`);
            result[`${name.replace("s", "#")}${octave}`] = await context.decodeAudioData(await response.arrayBuffer());
          }
        }
        const response = await fetch("assets/music/piano/C7.mp3");
        if (!response.ok) throw new Error("Piano sample unavailable: C7");
        result.C7 = await context.decodeAudioData(await response.arrayBuffer());
        samples = result;
      })().catch(exc => { loading = null; throw exc; });
      await loading;
    }
    function start(parsed, onDone) {
      stop(); done = onDone; end = parsed.seconds;
      gain = context.createGain();
      limiter = new Tone.Limiter(-3);
      Tone.connect(gain, limiter);
      limiter.connect(a.destination());
      let recording = a.recording();
      if (recording) limiter.connect(recording);
      transport.bpm.value = parsed.score.tempo;
      transport.seconds = 0;
      const secondsPerBeat = 60 / parsed.score.tempo;
      // Tone owns the audio-clock scheduling and sampled, polyphonic instrument.
      for (const track of parsed.score.tracks) {
        const sampler = new Tone.Sampler({ urls: samples, release: 0.7, volume: -10 });
        sampler.connect(gain); samplers.push(sampler);
        const events = track.events.filter(e => e.notes.length && e.velocity > 0).map(e => [e.beat * secondsPerBeat, e]);
        const part = new Tone.Part((time, event) => {
          sampler.triggerAttackRelease(event.notes.map(n => Tone.Frequency(n, "midi").toNote()),
            event.duration * secondsPerBeat, time, event.velocity);
        }, events).start(0);
        parts.push(part);
      }
      function tick() {
        if (!gain) return;
        const nextRecording = a.recording();
        if (recording !== nextRecording) {
          if (recording) { try { limiter.disconnect(recording); } catch {} }
          recording = nextRecording;
          if (recording) limiter.connect(recording);
        }
        const volume = a.volume() * (a.speechBusy() ? 0.2 : 1);
        gain.gain.setTargetAtTime(volume, context.currentTime, 0.035);
        if (transport.state === "started" && transport.seconds >= end + 0.8) {
          const callback = done; stop(); callback?.();
        }
      }
      gain.gain.value = a.volume() * (a.speechBusy() ? 0.2 : 1);
      transport.start("+0.08");
      timer = setInterval(tick, 80);
    }
    return { load, start, stop, position: () => context ? Math.min(end, transport.seconds) : 0,
      pause: () => { transport.pause(); samplers.forEach(s => s.releaseAll()); },
      resume: () => transport.start("+0.05") };
  }

  return { tools, validate, create, createEngine };
});

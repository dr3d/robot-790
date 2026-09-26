(function (root) {
  "use strict";
  function create(a) {
    const element = a.element, find = id => element.querySelector(`[data-music="${id}"]`);
    const enabled = find("enabled"), volume = find("volume"), scores = find("scores");
    const play = find("play"), pause = find("pause"), stop = find("stop"), download = find("download");
    const status = find("status"), canvas = find("roll");
    let owner, library = [], last = null, preview = null, previewRevision = 0, previewMessage = "";
    const key = "robot790.music.v1";
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "{}");
      enabled.checked = saved.enabled !== false;
      volume.value = Number.isFinite(saved.volume) ? Math.max(0, Math.min(100, saved.volume)) : 65;
      library = Array.isArray(saved.library) ? saved.library.filter(s => typeof s?.filename === "string" && typeof s.title === "string") : [];
    } catch { /* Defaults survive unavailable or damaged browser storage. */ }
    function persist() {
      try { localStorage.setItem(key, JSON.stringify({ enabled: enabled.checked, volume: +volume.value, library })); }
      catch { status.textContent = "Browser settings could not be saved; scores remain on disk."; }
    }
    function refreshList(selected = scores.value) {
      library.sort((left, right) => createdAt(right) - createdAt(left) || left.filename.localeCompare(right.filename));
      scores.replaceChildren(new Option("Choose a composition", ""));
      for (const item of library) scores.add(new Option(item.title, item.filename));
      scores.value = selected;
      play.disabled = !scores.value || !enabled.checked;
      download.disabled = !scores.value;
    }
    function createdAt(item) {
      return Number.isFinite(item.created_at_ms) && item.created_at_ms > 0 ? item.created_at_ms : 0;
    }
    async function recoverDates() {
      if (!a.dates || !library.some(item => !createdAt(item))) return;
      try {
        const dates = new Map((await a.dates()).filter(item => createdAt(item)).map(item => [item.filename, item.created_at_ms]));
        // Keep the latest library and selection if a new score arrived during the request.
        library = library.map(item => createdAt(item) || !dates.has(item.filename)
          ? item : { ...item, created_at_ms: dates.get(item.filename) });
        persist(); refreshList();
      } catch { /* Cached order survives unavailable metadata; a later addition can retry. */ }
    }
    function retained(item) {
      const existing = library.find(s => s.filename === item.filename);
      library = [...library.filter(s => s.filename !== item.filename), { ...existing, ...item }];
      persist(); refreshList(item.filename);
      recoverDates();
    }
    function updateStatus() {
      const runtime = last?.error || `${!last || last.state === "empty" ? "Ready" : last.state[0].toUpperCase() + last.state.slice(1)}${last?.score ? `: ${last.score.title}` : ""}`;
      const active = ["loading", "playing", "paused"].includes(last?.state);
      const selection = previewMessage || (preview && preview.filename !== last?.filename ? `Preview: ${preview.score.title}` : "");
      status.textContent = selection ? `${selection}${active ? `; ${runtime}` : ""}` : runtime;
    }
    async function previewSelection() {
      const filename = scores.value, revision = ++previewRevision;
      preview = null;
      previewMessage = filename ? "Loading score" : "";
      updateStatus(); draw();
      if (!filename) return;
      try {
        const parsed = Robot790Music.validate(JSON.parse(await a.read(filename)));
        if (revision !== previewRevision || filename !== scores.value) return;
        preview = { ...parsed, filename }; previewMessage = "";
      } catch (error) {
        if (revision !== previewRevision || filename !== scores.value) return;
        previewMessage = `Score unavailable: ${error.message}`;
      }
      updateStatus(); draw();
    }
    function render(snapshot) {
      const previous = last;
      last = snapshot;
      const playing = snapshot.state === "playing", paused = snapshot.state === "paused";
      pause.disabled = !playing && !paused;
      pause.title = paused ? "Resume music" : "Pause music";
      pause.setAttribute("aria-label", pause.title);
      pause.setAttribute("aria-pressed", String(paused));
      pause.querySelector("img").src = `assets/music/${paused ? "play" : "pause"}.svg`;
      stop.disabled = !["loading", "playing", "paused"].includes(snapshot.state);
      // A new performance follows its score; pause/completion must not undo browsing.
      if (snapshot.score && snapshot.filename && (snapshot.filename !== previous?.filename
        || (playing && previous?.state === "loading"))) {
        previewRevision++; previewMessage = "";
        preview = { score: snapshot.score, seconds: snapshot.seconds, filename: snapshot.filename };
        refreshList(snapshot.filename);
      }
      updateStatus();
      draw();
    }
    function draw() {
      const width = Math.max(240, canvas.clientWidth), height = 130, ratio = devicePixelRatio || 1;
      canvas.width = width * ratio; canvas.height = height * ratio;
      const ctx = canvas.getContext("2d"); ctx.scale(ratio, ratio);
      ctx.fillStyle = "#111a20"; ctx.fillRect(0, 0, width, height);
      canvas.setAttribute("aria-label", preview ? `Piano roll: ${preview.score.title}` : "Composition piano roll");
      if (!preview?.score) {
        ctx.fillStyle = "#a7b7c3"; ctx.font = "12px system-ui";
        const label = previewMessage === "Loading score" ? previewMessage : (previewMessage ? "Score unavailable" : "Piano");
        ctx.fillText(label, 12, 24); return;
      }
      const events = preview.score.tracks.flatMap(t => t.events).filter(e => e.notes.length);
      const pitches = events.flatMap(e => e.notes);
      const low = Math.min(...pitches) - 2, high = Math.max(...pitches) + 2;
      const beats = preview.seconds * preview.score.tempo / 60;
      const x = beat => 8 + beat / beats * (width - 16);
      ctx.strokeStyle = "#293940"; ctx.lineWidth = 1;
      const step = Math.max(1, Math.ceil(beats / 16));
      for (let beat = 0; beat <= beats; beat += step) {
        ctx.beginPath(); ctx.moveTo(x(beat), 25); ctx.lineTo(x(beat), 125); ctx.stroke();
      }
      const colors = ["#79cfb0", "#e6bb73", "#ab9ade", "#78bdda"];
      preview.score.tracks.forEach((track, i) => {
        ctx.fillStyle = colors[i % colors.length];
        for (const event of track.events) for (const pitch of event.notes) {
          ctx.globalAlpha = Math.max(0.3, event.velocity);
          ctx.fillRect(x(event.beat), 28 + (high - pitch) / (high - low) * 85,
            Math.max(2, event.duration / beats * (width - 16)), 4);
        }
      });
      ctx.globalAlpha = 1; ctx.font = "12px system-ui"; ctx.fillStyle = "#d5dfe5";
      const playback = owner?.snapshot();
      const following = preview.filename === playback?.filename && ["playing", "paused"].includes(playback?.state);
      const pos = following ? playback.position : 0;
      ctx.fillText(`${preview.score.tempo} BPM / ${preview.score.tracks.length} parts / ${Math.floor(pos)}s of ${Math.ceil(preview.seconds)}s`, 10, 17);
      if (following) {
        ctx.strokeStyle = "#ffffff"; ctx.beginPath();
        const px = x(pos * preview.score.tempo / 60); ctx.moveTo(px, 24); ctx.lineTo(px, 127); ctx.stroke();
      }
    }
    async function command(fn) { try { await fn(); } catch (error) { status.textContent = error.message; } }
    enabled.addEventListener("change", () => {
      if (!enabled.checked) owner.stop("music disabled");
      persist(); refreshList(); a.toolsChanged();
    });
    volume.addEventListener("input", persist);
    scores.addEventListener("change", () => { refreshList(); return previewSelection(); });
    play.addEventListener("click", () => command(() => owner.play({ filename: scores.value }, { manual: true })));
    pause.addEventListener("click", () => owner.pause());
    stop.addEventListener("click", () => owner.stop("operator stop"));
    download.addEventListener("click", () => command(async () => {
      const content = await a.read(scores.value);
      const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url;
      link.download = scores.value.split("/").pop().replace(/\.txt$/, ".json");
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }));
    element.addEventListener("toggle", draw);
    new ResizeObserver(draw).observe(canvas);
    setInterval(() => { if (last?.state === "playing" && element.open) draw(); }, 120);
    refreshList();
    recoverDates();
    return { enabled: () => enabled.checked, volume: () => +volume.value / 100, retained,
      changed: render, attach(value) { owner = value; render(owner.snapshot()); } };
  }
  root.Robot790MusicPanel = { create };
})(globalThis);

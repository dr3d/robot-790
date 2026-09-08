'use strict';

(() => {
  const rig = window.MouthRig;
  const get = id => document.getElementById(id);
  const canvas = get('mouth');
  const ctx = canvas.getContext('2d');
  const audio = get('audio');
  const settings = { ...rig.defaults };
  let track = rig.studies.contacts;
  let position = 0;
  let playing = false;
  let frame = 0;
  let lastTick = 0;
  let held = '';
  let audioUrl = '';
  let audioName = '';
  let cueName = '';
  let audioReady = false;
  let imported = false;
  let cueReadGeneration = 0;
  let playGeneration = 0;

  function error(message = '') { get('error').textContent = message; }
  function playButton() {
    get('play').title = playing ? 'Pause' : 'Play';
    get('play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
    get('play').querySelector('img').src = playing ? 'icons/pause.svg' : 'icons/play.svg';
  }
  function pause() {
    playGeneration += 1;
    playing = false;
    audio.pause();
    cancelAnimationFrame(frame);
    frame = 0;
    playButton();
  }
  function clearAudio() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = '';
    audioName = '';
    audioReady = false;
  }
  function status() {
    get('sourceState').textContent = imported
      ? (audioReady && cueName ? 'Audio + timed cues' : 'Awaiting audio and cues')
      : 'Silent rig study';
    get('fileNames').textContent = [audioName, cueName].filter(Boolean).join(' | ');
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#101314';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#303937';
    ctx.beginPath();
    ctx.moveTo(500, 70);
    ctx.lineTo(500, 310);
    ctx.stroke();
    for (const [index, articulated] of [false, true].entries()) {
      const pose = held ? rig.poses[held] : rig.poseAt(track, position, settings, articulated);
      ctx.save();
      ctx.translate(250 + index * 500, 165);
      ctx.scale(.89, .89);
      rig.draw(ctx, pose, settings);
      ctx.restore();
    }
    const cue = track.mouthCues[rig.cueIndex(track, position)];
    get('shapeName').textContent = rig.labels[held || cue?.value || 'X'];
    get('position').value = position;
    get('time').textContent = `${position.toFixed(2)} / ${track.metadata.duration.toFixed(2)}`;
    for (const button of get('poses').children) button.setAttribute('aria-pressed', String(button.dataset.shape === held));
  }
  function renderTrack() {
    get('position').max = track.metadata.duration;
    const fragment = document.createDocumentFragment();
    // The timeline is an overview. Avoid thousands of DOM nodes for dense imports.
    if (track.mouthCues.length <= 600) {
      for (const cue of track.mouthCues) {
        const block = document.createElement('span');
        block.style.flex = `${cue.end - cue.start} 1 0%`;
        block.textContent = cue.value;
        block.dataset.shape = cue.value;
        block.title = `${rig.labels[cue.value]}: ${cue.start.toFixed(2)} - ${cue.end.toFixed(2)} s`;
        fragment.append(block);
      }
    } else {
      const block = document.createElement('span');
      block.style.flex = '1';
      block.textContent = `${track.mouthCues.length} timed cues`;
      fragment.append(block);
    }
    get('cueTrack').replaceChildren(fragment);
    draw();
  }
  function tick(now) {
    frame = 0;
    if (!playing) return;
    if (imported) position = Math.min(audio.currentTime, track.metadata.duration);
    else position += (now - lastTick) / 1000 * Number(get('speed').value);
    lastTick = now;
    if (position >= track.metadata.duration) {
      if (get('loop').checked) {
        position = 0;
        if (imported) audio.currentTime = 0;
      } else {
        position = track.metadata.duration;
        pause();
      }
    }
    draw();
    if (playing) frame = requestAnimationFrame(tick);
  }
  async function play() {
    if (playing) { pause(); return; }
    error();
    if (imported && (!audioReady || !cueName)) { error('Choose an audio file and its Rhubarb JSON cues.'); return; }
    if (imported && Math.abs(audio.duration - track.metadata.duration) > .15) {
      error('Audio and cue durations differ by more than 150 ms. Choose the matching pair.'); return;
    }
    held = '';
    if (position >= track.metadata.duration) position = 0;
    const generation = ++playGeneration;
    if (imported) {
      audio.currentTime = position;
      audio.playbackRate = Number(get('speed').value);
      try { await audio.play(); }
      catch (cause) { if (generation === playGeneration) error(`Audio could not play: ${cause.message}`); return; }
      if (generation !== playGeneration) return;
    }
    playing = true;
    lastTick = performance.now();
    playButton();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  }

  get('play').addEventListener('click', play);
  get('stop').addEventListener('click', () => { pause(); position = 0; held = ''; if (audioReady) audio.currentTime = 0; draw(); });
  get('position').addEventListener('input', () => {
    pause(); held = ''; position = Number(get('position').value);
    if (audioReady) audio.currentTime = position;
    draw();
  });
  get('speed').addEventListener('change', () => { audio.playbackRate = Number(get('speed').value); });
  audio.addEventListener('ended', () => {
    if (!playing) return;
    pause();
    position = track.metadata.duration;
    if (get('loop').checked) { position = 0; play(); }
    else draw();
  });
  audio.addEventListener('loadedmetadata', () => {
    if (!audioUrl) return;
    audioReady = Number.isFinite(audio.duration) && audio.duration > 0 && audio.duration <= 120;
    if (!audioReady) error('Use an audio clip up to 120 seconds long.');
    status();
  });
  audio.addEventListener('error', () => { if (audioUrl) { pause(); audioReady = false; error('This audio file could not be decoded.'); status(); } });
  get('study').addEventListener('change', () => {
    cueReadGeneration += 1;
    pause(); clearAudio(); cueName = ''; imported = false; held = ''; position = 0;
    track = rig.studies[get('study').value]; error(); status(); renderTrack();
  });
  get('importAudio').addEventListener('click', () => get('audioFile').click());
  get('importCues').addEventListener('click', () => get('cueFile').click());
  get('audioFile').addEventListener('change', () => {
    const file = get('audioFile').files[0];
    get('audioFile').value = '';
    if (!file) return;
    if (file.size > 32 * 1024 * 1024) { error('Audio file is larger than 32 MB.'); return; }
    pause(); clearAudio(); error(); held = ''; position = 0; imported = true;
    audioUrl = URL.createObjectURL(file); audioName = file.name;
    audio.src = audioUrl; audio.load(); status(); draw();
  });
  get('cueFile').addEventListener('change', async () => {
    const file = get('cueFile').files[0];
    get('cueFile').value = '';
    if (!file) return;
    const generation = ++cueReadGeneration;
    if (file.size > 2 * 1024 * 1024) { error('Cue file is larger than 2 MB.'); return; }
    try {
      const candidate = rig.validateTrack(JSON.parse(await file.text()));
      if (generation !== cueReadGeneration) return;
      pause(); error(); track = candidate; cueName = file.name; imported = true; held = ''; position = 0;
      status(); renderTrack();
    } catch (cause) { if (generation === cueReadGeneration) error(`Cues not loaded: ${cause.message}`); }
  });
  for (const [shape, label] of Object.entries(rig.labels)) {
    const button = document.createElement('button');
    button.textContent = shape; button.dataset.shape = shape; button.title = label;
    button.setAttribute('aria-label', label); button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => { pause(); held = held === shape ? '' : shape; draw(); });
    get('poses').append(button);
  }
  function settingsUi() {
    for (const [key, value] of Object.entries(settings)) {
      get(key).value = value;
      get(`${key}Value`).textContent = ['transition', 'anticipation'].includes(key) ? `${value} ms` : value.toFixed(2);
    }
    draw();
  }
  for (const key of Object.keys(settings)) get(key).addEventListener('input', () => { settings[key] = Number(get(key).value); settingsUi(); });
  get('reset').addEventListener('click', () => { Object.assign(settings, rig.defaults); settingsUi(); });
  get('export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ schema: 'robot790-mouth-study-v1', ...settings }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'mouth-study-settings.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('pagehide', () => { pause(); clearAudio(); });
  settingsUi(); renderTrack(); status();
})();

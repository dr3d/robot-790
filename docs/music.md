# Eric's Piano

The first music tool is a sampled grand piano, not automatic beeps or mood
effects. Eric supplies notes, chords, rests, timing and dynamics. STS plays
the score without composing, correcting harmony or adding random timing.

## First Trial

Refresh STS while disconnected, then resume normally. The **Music** section in
the right-side Realtime Server controls contains the enable checkbox, saved
compositions, piano roll, replay, pause/resume, stop, score download and volume.
Music and local note-file tools must be enabled to save a new composition.
Selecting a saved composition loads its piano-roll preview without playing it.
Compositions stay newest-created first; replay never promotes an older tune.
Existing browser entries recover dates from score-file metadata, not last-open
time. Dates are cached locally; systems without file birth times use the saved
version's modification time as the fallback. No score bodies enter model context
for this UI sorting.
Browsing other scores does not stop the current performance; pause/stop still
control that performance, and the playhead only appears on its own score.

Try: "You have a piano now. Write me a little piece with a melody I can remember
and a left-hand accompaniment. Give it a beginning, a contrasting middle and an
ending. Play it, then let me tell you what I think."

Then ask for one audible revision, such as a quieter ending or a change of key.
Eric can read the saved score and submit a new version. Both remain on disk.
Replay does not require another model call. Talking interrupts an active
performance or pending load; the square Stop button is also available. Pause
holds the score position and releases sounding notes; resume continues from
that position rather than reconstructing already-held notes.

## Contract

- `play_music`: a complete score OR an existing `music/*.txt` filename.
- `read_music`: read a score for revision without creating a pinned note.
- `stop_music`: stop playback without deleting work.
- Scores are versioned JSON under `notes/music/`. New filenames use the title
  followed by local date, time and milliseconds, for example
  `Flat-Shore-Room-20261001-093025-417.txt`. Existing filenames remain valid.
  Scores are not automatically pinned or inserted into context.
- A receipt reports the saved filename, title, parts, note count, duration and
  playback starting, not that anyone heard it or liked it.
- B1 runtime updates and B2 evidence share the controller state and latest
  performance started in this connection, including pause, completion or stop.
  This compact receipt is not the whole music archive. It has no score body or
  constantly changing playhead, and does not trigger speech or change scheduling.
- The UI library remembers scores created/replayed in that browser. Clearing
  browser storage does not delete disk files; Eric can find them and replay by
  filename. Download exports `.json`, not rendered audio.
- No few-second duration cap. Invalid data is rejected, not silently clipped.
  Payload allowance, 16 parts, 32 pitches per chord, piano MIDI range 21-108
  and tempo 20-300 are explicit format/resource bounds, not brevity rules.

```json
{
  "version": 1,
  "title": "First phrase",
  "tempo": 96,
  "tracks": [
    {
      "name": "Melody",
      "instrument": "piano",
      "events": [
        {"beat": 0, "duration": 1, "notes": [64], "velocity": 0.7},
        {"beat": 1, "duration": 1, "notes": [67], "velocity": 0.6},
        {"beat": 2, "duration": 2, "notes": [72], "velocity": 0.5}
      ]
    },
    {
      "name": "Accompaniment",
      "instrument": "piano",
      "events": [{"beat": 0, "duration": 4, "notes": [48, 55, 60], "velocity": 0.4}]
    }
  ]
}
```

All parts use absolute quarter-note beats from the same beginning. Fractional
beats support subdivisions and deliberate timing offsets. Simultaneous pitches
form a chord; an empty pitch array is a rest. Velocity scales amplitude, not
full acoustic-piano velocity layers. Length includes explicit ending rests.

## Ownership And Growth

`web/sts/music.js` owns score validation, receipts, cancellation generations,
sample loading and playback. `music-panel.js` owns controls/library view;
`music.css` holds styling. The page supplies audio destinations, session identity
and existing note-file I/O. No server restart or extra service is needed.

Pinned local Tone.js 14.8.49 supplies the sampler and audio-clock scheduler;
the Salamander piano MP3 subset is local too. No runtime CDN, paid generation
or second GPU model. Attribution: `web/sts/assets/music/README.md`. Named parts
and instrument selection leave room for more sampled instruments, MIDI export,
notation and editing. Those extensions are not implemented yet.

Music uses the existing audio context/output and is included in STS recording
when active. It has its own volume plus the existing Eric output gain; a limiter
protects against summed chord peaks. It ducks under speech. Automatic B1 idle
turns wait while music plays so they do not replace the performance; B2 is not
globally stopped. User speech and runtime shutdown invalidate pending loads
as well as stopping active notes. A late disk save can retain a score but cannot
restart sound in an ended session.

This is composition/playback, not musical hearing. Parakeet-to-text does not
supply Eric a reliable perception of harmony or timbre. Scott's listening and
feedback are the first evaluation loop.

An operator can also give Eric a screenshot of the piano roll through the
existing sensing eye. The first manual probe (September 26) showed broad visual
recognition but an incorrect note/bar count: displayed seconds were treated as
notes. No score read or revision was attempted in that run, so an improvement
over JSON-only reasoning is not established. Use `read_music` for exact pitches
and timing; a screenshot is an additional view, not musical hearing. Automatic
score-to-eye rendering is not implemented or required by this experiment.

The September 27 follow-up did read the saved score and extend only the final
melody note and accompaniment chord, preserving all earlier events. That is a
verified narrow revision, not proof that the screenshot improved musical taste.
Silent playback took several attempts; the final tool-only start and zero-audio
follow-up worked, confirmed by the operator. Narration remains permitted; no
automatic music mute or new speech/music coordination policy was added.

## Verification

- `node --test tests/sts_music.test.cjs`: validation, long scores, receipts,
  replay, failure, permission, stale-work ownership and shared B1/B2 evidence.
- `node --test tests/sts_music_panel.test.cjs`: selection without playback,
  stale preview reads, errors and browsing during a performance.
- `tests/sts_music.browser.cjs`: real Edge audio signal, completion, pause/resume,
  zero output after runtime halt, download, desktop/mobile piano roll checks.
  Note writes are stubbed; test compositions do not enter Eric's notes.
  Set `ROBOT_790_PLAYWRIGHT_MODULE` to an installed Playwright module.
- Optional `node tests/helpers/music_model_probe.cjs`: local isolated Qwen
  interface probe, not a live Eric conversation. Artifacts go under
  `logs/maintenance/music-model`, not notes. The initial trial produced a valid
  two-part, 89-note, 16.875-second score and passed browser playback. This is
  interface acceptance, not an assessment of musical quality.

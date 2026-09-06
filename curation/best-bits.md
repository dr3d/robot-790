# Robot 790 Best Bits Ledger

This is the rolling shelf for moments that should survive the daily run pile.
Use video timecode, not wall-clock time, so clips can be cut without re-reading
the transcript.

The matching machine-readable manifest is `curation/best-bits.json`. When an
entry is ready to isolate, run:

```powershell
.\scripts\export_best_bits.ps1
```

The exporter writes cut clips under `curation/best-bits/clips/` and a run
manifest next to them. It includes handle seconds before and after each moment
so fades and final trims do not eat the line. Keep the raw postmortem judgement
here: why the bit landed, what source class supports it, and whether it is
public-safe.

## Entry Format

```md
### short-id

- Title:
- Run:
- Source video:
- Source postmortem:
- Clip: `MM:SS-MM:SS`
- Handles: default, or `lead_in_seconds` / `tail_out_seconds` in JSON
- Why it matters:
- Source class: video / transcript / event log / Brain2 / Scott read / Codex read
- Publishability: strong / maybe / private / no-video
- Status: candidate / cut / used / rejected
- Notes:
```

## Candidates

### 20260905-four-diets-one-mouth

- Title: Four diets, one mouth
- Run: `20260905-215204`
- Source video: `logs/audio/20260905-215204-sts-audio-picture.mp4`
- Source postmortem: `curation/postmortems/20260905-215204-four-diets-note-reload-b2-advisory.md`
- Clip: `00:15-00:28`
- Handles: default
- Why it matters: Eric explains the multi-lane architecture in usable public language, then lands the mechanism: different inputs produce different outputs.
- Source class: video / transcript / event log
- Publishability: strong
- Status: candidate
- Notes: Good first explainer clip for the "four diets, one mouth" architecture.

### 20260905-four-diets-failure-mode

- Title: Four distinct blind spots
- Run: `20260905-215204`
- Source video: `logs/audio/20260905-215204-sts-audio-picture.mp4`
- Source postmortem: `curation/postmortems/20260905-215204-four-diets-note-reload-b2-advisory.md`
- Clip: `01:19-01:32`
- Handles: default
- Why it matters: Eric owns the design risk instead of defending it: independent lanes can disagree, stale verifiers can block or rubber-stamp, and different diets make distinct blind spots.
- Source class: video / transcript / Brain2
- Publishability: strong
- Status: candidate
- Notes: Pairs well with the architecture explainer because it shows the failure mode immediately.

### 20260905-b1-final-say

- Title: The public voice has final say
- Run: `20260905-215204`
- Source video: `logs/audio/20260905-215204-sts-audio-picture.mp4`
- Source postmortem: `curation/postmortems/20260905-215204-four-diets-note-reload-b2-advisory.md`
- Clip: `03:45-03:53`
- Handles: default
- Why it matters: This defines governance for the architecture. Brain2 is a tap on the shoulder, not another public speaker.
- Source class: video / transcript
- Publishability: strong
- Status: candidate
- Notes: Useful as the correction to "four brains" confusion.

### 20260905-director-notes-booth

- Title: The director's notes leaked into the booth
- Run: `20260905-233311`
- Source video: `logs/audio/20260905-233244-sts-audio-session-picture.mp4`
- Source postmortem: `curation/postmortems/20260905-233311-salem-dollar-booth-routine.md`
- Clip: `15:52-16:04`
- Handles: default
- Why it matters: B2 names the failure exactly: Eric stopped performing the Salem table routine and let internal stage directions reach the public mouth.
- Source class: Brain2 / event log / audio
- Publishability: maybe
- Status: candidate
- Notes: Timecode is estimated from the audio start around 11:15:21 PM; trim by ear before export.

### 20260905-stage-directions-escaped

- Title: The stage directions escaped the script
- Run: `20260905-233311`
- Source video: `logs/audio/20260905-233244-sts-audio-session-picture.mp4`
- Source postmortem: `curation/postmortems/20260905-233311-salem-dollar-booth-routine.md`
- Clip: `16:05-16:17`
- Handles: default
- Why it matters: This is the compact diagnosis of the run: not bad character, bad role-boundary filtering.
- Source class: Brain2 / event log / audio
- Publishability: maybe
- Status: candidate
- Notes: Timecode is estimated; may be better as an internal clip unless the visible/audio context makes sense.

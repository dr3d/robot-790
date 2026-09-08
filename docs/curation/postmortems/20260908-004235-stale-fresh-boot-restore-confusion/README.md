# Stale Fresh-Boot Restore Confusion

Session: 2026-09-08 00:39-00:42 EDT  
Session note: `notes/sessions/20260908-004235-stale-fresh-boot-restore-confusion.txt`  
Parent session: `notes/sessions/20260908-001758-remembered-image-reload-sensing-eye-switch.txt`

## Summary

This was a short continuity test after multiple session-note restores. The restore machinery loaded the expected session chain, but Eric initially spoke as if he had only core notes from an empty connect. A few turns later he recovered important details from the loaded context, including Scott's identity and the available sensing-eye memories.

The useful finding is that the session-note chain itself was not missing. The failure came from restored transcript text being too easy for the model to read as present-state truth.

## What Worked

- Connect latest loaded the intended parent session note.
- The continuity receipt rehydrated the expected pinned notes:
  - `sessions/20260908-001758-remembered-image-reload-sensing-eye-switch.txt`
  - `sessions/20260907-232827-standing-joke-routine-archive-check.txt`
  - `sessions/20260907-175329-daily-driver-empty-boot.txt`
  - `core/scott_profile_summary.txt`
  - `boot_eric.txt`
  - `get_go.txt`
  - `core/erics_memories.txt`
- Eric eventually used the loaded context correctly:
  - identified Scott
  - recalled profile details
  - listed sensing-eye memories
  - distinguished that this current sit-down had not used the sensing eye or joke routine yet

## What Failed

- Eric opened by saying this was a fresh boot with only core notes in an empty connect.
- He then said he did not have a prior session note loaded.
- Those claims contradicted the event log and Context Map, which both showed seven loaded notes.

## Likely Cause

The loaded session note included old transcript turns from earlier runs where Eric accurately described that old run as a fresh boot or empty connect. On restore, those historical self-reports were available in context but were not marked strongly enough as stale. The model could echo them as if they described the current runtime.

This is a prompt wrapping problem, not a failure to load the notes.

## Fix Applied

The session restore wrapper in `web/sts/index.html` now tells Eric that old transcript lines are historical and must not override current runtime state. It explicitly warns that old claims such as "fresh boot," "empty connect," "no session note loaded," sensor availability, or tool availability are old self-reports unless current runtime evidence agrees.

The live transcript context wrapper also now asks Eric to separate:

- the current run now
- the remembered prior run then

Regression test added:

- `session restore wrapper marks old fresh-boot claims as stale`

Verification:

- `node --test tests\sts_runtime.test.cjs`
- 39 tests passed.

## Recommendation

Continue forward with sessions. Reload the STS browser page before judging the next connect, because this fix lives in the browser-side prompt builder. If this session still feels polluted, use Connect Select or Session Map to resume from `20260908-001758-remembered-image-reload-sensing-eye-switch.txt`.

## Artifacts

- `session-note-copy.txt`
- `conversation.txt`
- `events.txt`
- `brain2_mulling.txt`
- `recording_stop_report.txt`
- `session-audio-picture.mp4`
- `session-audio-source.webm`

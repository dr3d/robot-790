# Context Transport Repair

September 16, 2026, following the first trial of agency removal (`4273e16`).
Evidence: `logs/runs/20260916-220001-agency-context-growth/postmortem.md`.
Keep interpretation, choices and words with the models. These repairs concern
payloads, capability grants and history stability.

## Changes

- B2 advice sent to B1 contains only text, timestamp, B1 output identity and
  structured steering. The full shared/B2 card fingerprint remains local for
  freshness checks. It no longer leaks card text into every advisory packet.
- `list_text_files` returns 20 names by default, 50 maximum, with partial-name
  search, directory scope and pagination. It returns total and next offset.
  Matching is case-insensitive and normalizes spaces/hyphens/underscores, not
  English intent interpretation. The operator shelf/map still get all entries.
- B1 keeps original image tool results, not another cumulative result bundle
  at every boundary. Eye runtime status gives the current item and history count,
  not all historical names. B2 retains its bounded receipt snapshot.
- Consumed pictures stay once at their original position in live history.
  Shared idle does not reattach an already staged image. Clearing the eye changes
  the current-eye state, not past evidence. Session reset still clears history.
  Tradeoff: real image tokens remain until reset/explicit history removal; this
  avoids prefix mutation but is not a promise of zero visual-context growth.
- B1's idle generation/staging calls use the existing Idle art grant and durable
  service. B2 is optional. There is no picture quota. B1 chooses whether to move
  its result; only the existing B2 proposal route auto-stages. See [idle art](idle-art.md).
- In-flight, revoked or superseded image work cannot overwrite a newer preview
  or eye. Late results remain on disk; the generating indicator is released.
  A local preflight rejection is not falsely recorded as an unknown paid result.
  Genuine unknown submissions still block automatic retry in that turn.

## Prompt Disclosure

The note-list tool schema/description changed. Runtime payloads are smaller and
the allowed idle-tool list reflects the active grant. The clear-eye receipt now
distinguishes current state from historical visual evidence. The local
`setup-cards/willing-artist.txt` capability paragraph and shelf README no longer
say B1 idle is talk-only. Its artistic instructions, B2 card guidance, base
personality, model, temperature and other sampling values are unchanged.

## Measured Cache Probe

No active STS connection, model reload, paid render or voice generation. Five
sequential local requests used the already-loaded `qwen3.8-27b-nvfp4-mtp`, two
slots, 131,072 context, llama.cpp runtime 2.39.0. Each response was `OK` (two
tokens). A historical image was placed before roughly 12K tokens of fixture
history. Output was capped at eight tokens. This is a controlled transport probe,
not Eric's actual conversation or a B1/B2 contention test.

| Request | Prompt tokens | Evaluated tokens | Prefill |
| --- | ---: | ---: | ---: |
| Initial image/history | 12,212 | 12,212 | 3.368 s |
| Retained-image return | 12,234 | 26 | 0.301 s |
| Retained-image idle | 12,258 | 28 | 0.301 s |
| Return after temporary idle tail | 12,259 | 29 | 0.304 s |
| Old path: remove historical image | 11,706 | 11,706 | 3.198 s |

Warm turns selected by prefix similarity. Removing the early image selected LRU
and reevaluated the whole request. The fixture confirms that image removal can
destroy reuse. It does not prove every 40-55 second stall in the preceding run
had this cause; that run had no usable engine capture.

Reproduction and numeric receipts: `logs/runs/20260916-agency-repair/`.
The temporary metric collector was stopped after the probe.

## Retest

Verification: 423 JavaScript tests and 636 Python tests, including real SDK
history serialization, bounded note lookup, B2 field projection, idle grant
revocation, in-flight jobs and stale-image display. The Python suite reports one
existing Starlette/httpx deprecation warning. Paid rendering, hardware and a long
connected conversation were not exercised by these tests.

Deploy the page server and realtime backend together, then refresh disconnected
STS. Connect Empty is the cleanest comparison; continuing a healthy older branch
is also possible. Already-saved text is not retroactively rewritten by these
changes. Enable image tools and Idle art for unattended drawings.

Try a named note lookup, a draw/show conversation, then idle and return. Eric
should choose actions himself; failure receipts must distinguish capability,
provider, transport and staging failures. These changes do not tune away B2's
habit of advising a wait or guarantee it will decide to make another picture.

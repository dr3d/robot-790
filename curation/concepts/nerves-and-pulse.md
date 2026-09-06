# Nerves And Pulse

Status: pinned concept, not settled terminology.

Scott's working frame:

> Eric lives in his own quantized universe. Every tick he samples his situation
> and generates something that changes the situation.

This is the mechanism hiding under the word "idle." Idle is a poor name because
the useful behavior is not dead time. It is a repeating cycle of sampling,
generation, action, and trace.

## Working Terms

`Nerves` is the medium: the visible system-wide signal that Eric is electrically
and cognitively active.

`Pulse` may be the beat: one discrete nervous-system cycle where Eric samples
the current state, does something, and leaves a change behind.

Possible wording:

```text
Nerves are the medium; pulse is the beat.
```

## What A Pulse Does

Each pulse should be able to:

- sample current state: conversation, mic, tools, face, notes, status, recent
  history, B2 cues, search receipts, body sensors
- choose one small move: speak, stay silent, search, read, write, pose, label,
  ask, wait, revise, or remember
- leave a trace: event log, mouth text, face pose, note, receipt, unresolved
  question, changed expectation, or deliberate silence

The key is not that Eric thinks continuously between pulses. The key is that
each pulse changes the next pulse.

## Why This Matters

The companion feeling depends on rhythm as much as content. A system that only
wakes when Scott talks feels like a tool. A system with visible internal
rhythms begins to feel like an occupant, even when the rhythms are simple.

This connects directly to the public `Time And Space, Both Live` frame:

- live time is made from pulses
- inhabited space is what the pulses sample and alter
- memory and notes are how pulse traces survive restart
- passivation is the cartridge form of a stopped pulse stream

## Design Direction

Do not rush the name into the UI everywhere yet.

Near-term useful UI language:

- keep `NERVES` as the system-wide top graph
- consider `PULSE` for the next/last idle beat
- avoid "idle" in public writing when the behavior is actually active sampling
- in postmortems, describe idle events as pulses when they sample and leave a
  trace

## Open Questions

- Is `pulse` too clean or too biological?
- Should B1 and B2 have separate pulse indicators?
- Is a pulse always an LM turn, or can a tool/status sample count?
- Should face frames be considered sub-pulses of the visible body?
- Can the system show useful dips as well as peaks, making absence of action a
  readable state instead of dead air?

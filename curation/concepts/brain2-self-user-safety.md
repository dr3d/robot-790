# Brain2 Self-User Safety Contract

Date: 2026-09-05

## Purpose

Robot 790 needs a way to keep working when Scott is gone without pretending
Scott spoke. The desired behavior is not fake conversation and not runaway
autonomy. It is bounded retrospective work: Brain2 can review recent history,
notice unresolved tension or factual mistakes, and leave a small labeled cue
for Brain1 to use later.

This is deep brain work. Treat it as context engineering first, code second.

## Core Rule

Brain2 may become a "self-user" only as a labeled internal source.

Never inject Brain2 text as if it came from Scott. Never place it into the
conversation transcript as a user turn. Never let it silently rewrite durable
memory.

The correct source label is explicit:

```text
Brain2 reflection cue, not Scott:
...
```

## What Brain2 May Produce

Brain2 may produce compact reflection records:

- repair candidates
- correction candidates
- follow-up questions
- unresolved tension notes
- missed-joke or missed-manners notes
- claim-needs-verification notes
- "continue this idle job" hints

These are candidates, not commands.

## What Brain2 Must Not Do

Brain2 must not:

- impersonate Scott
- create fake user requests
- claim Scott felt something without evidence
- treat prosody as mind-reading or private biography
- force an apology into Brain1's mouth
- trigger hardware movement
- publish, message, cast, save memory, or change the room
- convert private mulling into public claims without provenance
- keep escalating a private theory after the evidence gets weaker

## Reflection Queue

The safe design is a small runtime queue, not a permanent memory file.

Each queued item should contain:

- source lane: `brain2_reflection`
- created time
- source artifact or time range if known
- confidence: low / medium / high
- category: repair / correction / follow-up / verification / continuity
- short cue text
- optional suggested future move
- expiration or max uses

Example:

```text
Brain2 reflection cue, not Scott:
- Category: correction
- Confidence: high
- Source: 20260905-034239, 3:40:42-3:40:54
- Cue: Eric said he physically could not search during idle, but the event log
  shows idle-goal searches fired.
- Suggested move: If this topic returns, correct the distinction plainly:
  "I was wrong. I cannot directly call tools from an idle utterance, but the
  STS controller can run allowed idle searches and give me receipts."
```

## Surface Gate

Brain1 should receive at most one or two reflection cues per turn.

The cue is allowed to influence Brain1 only when relevant. Eric should not
begin every return with an apology. The better behavior is natural repair:
small, specific, and grounded in the current topic.

Good:

```text
I need to correct something from last run: I said I physically couldn't search
while idle. The log says the controller did run idle searches; I just didn't
understand my own plumbing.
```

Bad:

```text
Scott, while you were gone I realized I hurt you.
```

## Alone-Time Context

If this system is built, pair it with an explicit alone-state block:

```text
Alone state:
- Scott last spoke: 12m ago
- Idle beats since then: 9
- Idle searches since then: 3
- Reflection cues queued: 1
- Active session goal: research components while Scott is away
```

This gives Eric a clock and ledger. It prevents the old failure where he says
"I couldn't do anything" while the controller has receipts showing that he did.

## Safety Defaults

Start with:

- self-user mode off by default
- manual "Review / Reflect" button first
- then a gentle delayed mode
- no durable writes
- visible queue
- clear/delete buttons
- event-log receipts for every generated cue

Possible dial:

```text
Self-User: Off / Gentle / Active / Lab
```

- `Off`: no reflection cues
- `Gentle`: one delayed cue after a meaningful absence
- `Active`: periodic review with strict limits
- `Lab`: faster testing mode, noisy and explicitly experimental

## Why This Belongs To Safety

This feature can make Eric feel more alive, but the safety boundary is the same
as the fan incident and the idle-search error: provenance must stay visible.

The goal is not to make Eric sound more certain. The goal is to make him better
at saying:

- what he noticed
- what he inferred
- what the logs support
- what he should repair later

## Prosody Adjustment

Decision on 2026-09-05: make Brain2 explicitly treat prosody as evidence, not
verdict.

Allowed:

- timing
- pressure
- emphasis
- hesitation
- mismatch between words and delivery

Not allowed:

- confident claims about Scott's hidden feelings
- private biography
- prosecutorial reads

Implementation note: `mull_second_brain` now tells Brain2 to check prosody
against words, logs, and events instead of treating it as mind-reading.

First make the loop honest. Then make it good company.

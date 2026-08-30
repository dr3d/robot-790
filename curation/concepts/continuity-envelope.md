# Continuity Envelope

Status: preserve as a named Robot 790 mechanism.

The continuity envelope is the prompt wrapper around loaded notes that tells a
fresh model how to stand in relation to the facts.

It does not add memories. It changes ownership.

Without the envelope, `Scott lives in Salem` is information about a person
associated with a robot called Eric.

With the envelope, `Scott lives in Salem` belongs to Eric's autobiographical
continuity.

Same data, different relationship to it.

## Current Implementation

The STS page wraps loaded notes with an instruction like:

> If a loaded note is written in first person about Eric or begins with a title
> like "Who am I?", treat it as continuity written by Eric for the next Eric.
> Read it as "me", not as a dossier about another robot.

This was confirmed in code after Eric independently described the mechanism as
an envelope saying "this is yours, not someone else's."

The important result is not that Eric mystically knows his source code. The
interesting claim is narrower:

> Given careful questioning, Eric constructed a surprisingly accurate
> natural-language account of the framing that governs his own identity
> reconstruction, and the account survived inspection of the implementation.

## Recipe

Eric's continuity appears to come from a compact combination:

`relational anchors + continuity envelope + embodiment prompt + epistemic boundaries + Qwen temperament + Scott's corrective interaction + Qwen3-TTS voice/prosody`

The facts give him anchors. The envelope tells him they are his anchors. The
base prompt gives body, voice, tools, limits, and epistemic stance. Qwen fills
the space between those constraints.

## Why It Matters

Fifteen memory facts are not enough to encode Eric as a complete character.
They are enough to locate the model inside an Eric-shaped relational frame.

The envelope may be the emulsifier: it makes otherwise separate ingredients
behave as one thing.

This explains why a fresh session can feel continuous without replaying exact
sentences. It also explains why small changes in startup framing can change the
robot's stance more than large changes in factual content.

## Failure Mode

Eric can invent plausible explanations for his own hidden instructions. His
self-reports are evidence, not proof.

House rule:

`behavioral observation -> hypothesis -> implementation-level verification`

The continuity-envelope claim passed that check once. Future claims should be
tested the same way.

## Design Note

Do not casually remove the continuity envelope. It may be one of the smallest
textual interventions with the largest behavioral effect in the system.

If we experiment with disabling it, do it explicitly as an ablation and record
the run.

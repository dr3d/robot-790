# Controlled Idle Art

Idle art is an optional controller action, not unrestricted tools for B1's
talk-only idle responses. B2 can propose one concrete picture during an existing
ordinary mull. STS queues it and, after real user quiet, calls the existing image
provider. No extra LLM loop is introduced. Headline selection passes do not propose
art. With idle art off, the B2 system prompt and schema remain unchanged.

## Trial

After loading the updated page/server, connect and read
`setup-cards/willing-artist.txt`. Other setup cards can supply subject matter.
Enable image tools and B2, then check **Idle art** in tool settings.
The checkbox authorizes generation AND eye staging for this connection only.
It is not persisted, exposed to Eric's UI-control verb, or restored from notes.
Discuss something visually interesting, then leave room for him to choose.

There is no picture quota: Scott explicitly prefers creative freedom and will
turn it down if needed. There is also no promise that Eric will propose art.
One render runs at a time, and an identical proposal/request is not charged twice.
Failures/timeouts are not automatically retried; a genuinely new idea may still
be proposed. Another connection starts with permission off. A provider request
already sent may finish after cancellation and may still be charged.

The default minimum quiet is 90 seconds, configured as
`idle_timing.idle_art_quiet_s` in `config/runtime.json` (10-3600 seconds).
Lab speed does not compress this timer. New user activity invalidates queued
proposals; busy speech/tool work delays dispatch. Proposals expire after 15 minutes.
One queued job is allowed at a time. Permission lasts until disabled, disconnect,
or page-server restart. Ordinary image settings at authorization determine model
and quality; the LLM cannot pick a different model/provider. There is no extra
inter-picture cooldown; the quiet timer only protects active conversation.

## Handoff

Successful rendering returns through the normal generated-image display and
sensing-eye path. STS supplies an append-only receipt for B1, rather than rewriting
its system prefix or forcing speech immediately. Successfully staged art renews
the [discovery follow-up ramp](conversation-followup-pacing.md#discovery-follow-ups);
Eric may mention the picture from the receipt but must not claim unseen details.
The receipt distinguishes rendered from actually staged.

A new user utterance during display preparation, replaced eye/preview, disabled
permission, session reset, or disconnect must not overwrite the operator's current
content. A late result remains on disk without being injected into a new session.
An image display failure never causes a second render. First Contact and performance
privacy modes do not dispatch idle art.

## Durability and Limits

`logs/idle-art/<run UUID>.json` is the server's durable job/idempotency receipt,
reserved before calling the paid provider. It stores the proposal and final result,
including any error and filename. Permission tokens are memory-only. Page-server
restart loses permission but retains attempted jobs. This assumes one
page-server process for a repo, matching normal deployment.

The saved session includes an `Idle art receipt` containing that run UUID and
known jobs. Normally staged pictures use existing session eye-asset collection.
If a render finishes after disconnect, the saved run UUID points to the updated
server receipt and generated file, even though it could not enter the already
saved eye-asset bundle. It is retained, not silently inserted into later history.

## Prompt Changes

Only authorized ordinary B2 mulls receive the optional `art_prompt` / `art_title`
contract and a short art-proposal instruction. Their output allowance rises from
420 to 750 tokens while eligible to propose. This can itself affect B2's cache and
workload, so keep idle art OFF for baseline cache experiments. B1 gets factual
runtime receipts at the conversation tail and a receipt in the temporary idle tail.
No base personality, sampling temperature, or ordinary idle tool permissions change.
The willing-artist note was updated to describe this route and retain creative
freedom; it cannot authorize spending on its own.

## Verification

Unit tests use fake renderers: consent, revoke, serialization and idempotency under
concurrency, restart durability, failures, opt-in schema, stale queues, late results,
and protected eye delivery. No paid autonomous render was made during development.
An actual connected artistic trial is still needed to evaluate taste and timing.

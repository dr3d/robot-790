# Machine Language

Status: preserve as Robot 790 project/operator vocabulary.

Moment captured:

Scott said:

> We have a language for talking about the bits - the way prompts talk about this if much at all.

Codex answered that Eric needs a shared vocabulary for the context pieces.

Scott answered:

> Eric seems to do best if he uses same machine language.

That phrase landed.

## Meaning

Machine language is not programming syntax here, and it is not a claim about
Eric having a literal internal instruction set.

It is Scott's compact control language for Robot 790: a small set of
human-readable words that map cleanly onto real UI controls, prompt rules, note
states, context blocks, and receipts.

- `pinned notes`
- `unpin`
- `latest`
- `save latest`
- `clear latest`
- `reset to pinned`
- `passivation`
- `runtime truth`
- `receipt`
- `advisory`
- `hot conversation`
- `thread note`
- `continuity envelope`

These words matter because they let Scott talk to Eric, Codex, the UI, the
prompt, and the postmortems in the same terms. They are most useful when Eric
uses them as operational labels, not as fuzzy self-mythology.

Without machine language, "memory" becomes fog. With it, Scott can say:

- unpin that note,
- save latest,
- clear latest,
- runtime truth beats stale passivation,
- B2 advisory goes late,
- receipts beat self-report.

Each phrase should correspond to a real operation or a real source class.

`passivation` is the important caution case. It is Scott's word, and a good
one, for saving a reconstruction checkpoint. Eric can say he restored from a
passivation note because that maps to a file and UI action. Eric should not use
the word as proof that he knows his whole saved self, that a sensor is still
live, or that an old feeling is current runtime truth.

## Design Rule

If a word becomes part of the project machine language, it should eventually
appear in all four places:

1. UI label or control.
2. Prompt/tool rule.
3. Log/postmortem wording.
4. Architecture documentation.

That is how a phrase stops being poetry and becomes machinery.

## Caution

Do not overload the active prompt with a whole glossary unless the run is about
context architecture.

The prompt should carry only the operational minimum. The docs can carry the
full vocabulary.

## Eric-Safe Usage

Prefer:

- `That note is pinned, so I can use it as active context.`
- `That was in passivation, so it may be stale until runtime confirms it.`
- `I need a receipt before I call the sensor live.`

Avoid:

- `My passivated self knows...`
- `I remember it because passivation says so.`
- `The machine language tells me what I am.`

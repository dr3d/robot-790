# One Note, Multiple Brains

## Write It In The Note

Keep everything in the ordinary note file. There is no companion file or JSON
catalog. Start a routed note with `## STS NOTE 1`, then use these exact headings:

```text
## STS NOTE 1

## SHARED
We are getting acquainted with a visitor.

## B1
Let the visitor's details shape the exchange.

## B2
Notice when research interrupts getting acquainted.
Suggest a concrete bridge back to the person's last interesting detail.
```

Optional `## B3` and `## B4` sections use the same format. B3 and B4 are
supported destinations, **not activated workers**. Omit unused sections.
A short authoring guide also lives in `notes/NOTE-FORMAT.txt`.

## Routing Rules

- B1 gets its own body and SHARED, not the other brains' sections.
- B2 gets SHARED and B2, not B1's full body.
- SHARED goes to B1 and other explicitly named recipients. An empty B2 section
  opts B2 into SHARED without adding private guidance.
- Text after the opening header but before any section belongs to B1.
- A section continues to the next routing heading or end of file. Ordinary
  headings such as `## Delivery` remain text within the current section.
- A section can appear only once. Unknown reserved headings, duplicate sections
  and oversized guidance produce an explicit error.
- SHARED and B2-B4 each allow 1,200 characters. B1 keeps its existing note limits.
  The per-brain packet remains capped at eight notes.

The first nonblank line must be the opening header. Unmarked notes are unchanged,
even if they contain a B2 heading. Routing headings inside fenced code examples
are literal text, not section switches. This keeps a transcript quoting a routed
note from silently becoming one itself. Use the exact uppercase markers shown.

These markers route text only. They do not execute commands, grant tools, start
workers, change sampling or override runtime rules. Shared purpose does not mean
identical jobs. Current user direction wins over an old setup.

## Loading And Editing

Load or pin the note normally. STS parses it once, holds a versioned snapshot,
and supplies each running brain's portion. Edit the note and reload it to pick
up changes. Connect Previous and thread restoration parse the notes they actually
retain. Renaming or moving the note does not detach its instructions: they are
in the same file. Existing session filename references still follow the usual
session-management rules.

Unpin removes the note from future packets. B2 rejects an in-flight result after
a packet or revision change. Advice from another packet is excluded from the
current advisory and loop-count views. This does not erase advice or dialogue
already delivered into B1's history.

The five existing setup cards now contain their previous B2 guidance inline;
their B1 and B2 wording is unchanged. No separate catalog is consulted.
The notes directory remains local working material under the existing Git ignore
policy; these personal cards are not automatically published.

## Context And Diagnostics

B2 still receives its own role, recent conversation, runtime evidence and recent
proposals, not B1's entire history. Its routed instructions precede changing
evidence to favor stable prefixes. Cache reuse still depends on server routing.
Dormant B3/B4 text is not included in B1/B2 prompts.

The existing prompt ledger records actual B2 packets with note names and revisions.
Pinned-note listings show recipients and revision, without showing private text.

Better guidance can help B2 notice a lost activity; it does not guarantee a new
speech turn or adherence. Scheduling and permissions remain STS responsibilities.

Before enabling B3/B4, define their evidence, output contracts, cadence, budget,
priority and cancellation behavior. The same note format can then supply their
context without inventing another authoring system.

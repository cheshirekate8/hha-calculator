# IDEAS.md — the idea inbox

Somewhere to put *"that's probably a good idea"* the moment you have it, so it survives
without being thought about yet.

This is deliberately the cheapest document in the repo. An entry here makes **no** claim
that the idea is good, sized, wanted, or ever going to happen. It is not a design, not a
spec, not a backlog, and never a Beads issue: issues are commitments that show up in
`bd ready`, and the ready queue is what the pipeline drains unattended.

## The promotion path

```
IDEAS.md  ->  DESIGN.md section (+ change-log row)  ->  spec + frozen tests  ->  Beads issue  ->  a run
  parked        decided, with a reason                    machine-checkable      committed
```

Nothing is ever implemented straight from this file. Planning sessions read it for
candidates (the pipeline's PLANNING.md, step 0); that is its only process obligation.

## How to write an entry

A title, a sentence or two on **why you'd want it** (not how you'd build it), and the
date. Optional, only when true: `Blocked on:` (a change-log row or issue id) and
`Related:` (a design section it would touch). One flat list; no taxonomy.

```markdown
- **Short imperative title** — why this would be worth having, in a sentence or two.
  2026-11-13
```

## Inbox

- **Grid room editor** — drawing the room would let the app work out walls, the two-square
  feng shui distance and facing direction itself, instead of trusting the player's tags.
  2026-11-13. Related: DESIGN.md §1, §5.
- **Directional-item data for the facing-wall penalty** — only items flagged
  `ItemHHADirection = 1` in the original spreadsheet can incur −300; with that flag the
  app could stop over-counting when a player tags a non-directional item. 2026-11-13.
  Related: DESIGN.md §4.3, §8.
- **Exterior scoring** — worth modelling only if real evidence shows ACNH scores the
  house exterior; the thresholds found so far are from *New Leaf*. 2026-11-13. Related:
  DESIGN.md §1.
- **Season from date and hemisphere** — picking a date instead of a season would be one
  less thing for the player to know, but needs the exact season boundaries per hemisphere.
  2026-11-13. Related: DESIGN.md §5, §6.11.
- **Item images in the room editor** — recognising items by picture is faster than by
  name, but images add a lot of weight and a licensing question. 2026-11-13. Related:
  DESIGN.md §10.
- **"What should I add?" suggestions** — the breakdown already knows which bonuses are one
  item away (a series at 3 unique, a set missing one piece); surfacing those is the most
  useful next step for a player. 2026-11-13. Related: DESIGN.md §10.3.

## Promoted

Ideas that made it out, and what they became.

| Date | Idea | Became |
|---|---|---|

## Dropped

Ideas considered and consciously declined, with the reason. It is what stops the same
idea being re-raised every few months.

| Date | Idea | Why not |
|---|---|---|

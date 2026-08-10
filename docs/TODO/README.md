# TODO — active plans

Only executable, unfinished plans live at this level. `QUEUE.json` is their
execution order; the human index below must agree with it.

GitHub is the public inbox and is not mirrored here. When an issue becomes an
accepted plan, the plan links back to it. Historical detail stays out of the
active context:

- [completed/](completed/README.md) — landed work;
- [research/](research/README.md) — optional neural-training research;
- [retired/](retired/README.md) — superseded, rejected or consolidated plans.

## Execution queue

Empty — 93 landed: the four colours have one home in `src/palette.ts`, every
stylesheet imports a `palette.css` generated from it, and `npm run
palette:check` fails on the fifteenth copy. The encyclopaedia keeps a second
palette on purpose and now says so. `QUEUE.json` agrees. The backlog below is
in priority order; promoting its head is what makes the next execution item.

## Backlog

- [ ] 88 — [The flight readout still quotes two stale words](88-the-readout-still-quotes-two-stale-words.md)
- [ ] 96 — [The character label drives nothing in the world yet](96-the-character-label-drives-nothing-yet.md)
      — deferred by Chris 2026-08-09 ("drop for now"); phase 1 shipped, the
      label stays cosmetic until this is picked back up
- [ ] 118 — The bloom and the pixel-ratio clamp are still written out twice
      — `(0.55, 0.5, 0.15)` and `min(devicePixelRatio, 2)` are byte-identical
      in `engine/render-stack.ts` and `viewer/stage.ts` (the clamp again in
      `encyclopaedia/chart.ts`). docs/TODO/93 tried to take these and backed
      out: their home is `src/constants/`, and putting them there makes the
      catalogue's duplicate-value policy demand `@rule` ids on nineteen
      unrelated constants across ten modules, because 0.5 and 2 are popular
      numbers. That policy call is the actual work and it is not a colour
      question. Needs a plan doc before it is executable.

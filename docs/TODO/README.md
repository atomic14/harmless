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

1. [ ] 96 — [The character label drives nothing in the world yet](96-the-character-label-drives-nothing-yet.md)
       — phase 2 of Character, un-deferred by Chris 2026-08-10 and re-planned
       with his three decisions in it. **M1–M3 have landed**: one home for what
       a sale does to your name, the `Mark` carries your disrepute (a worse
       reception, and occasionally being waved off), and the hermit gives mates'
       rates up to the Dodgy rung and shuts the door at it. **M4's campaign is
       read** — a bounty hunter's 200-commander row is identical to the
       baseline, a privateer's gangs go 12%→19% — and what is left is the
       FLIGHT: nobody has met a Dodgy pilot's pirates yet, and
       `DISREPUTE_HEAT`, `COURTESY_RATE` and `HERMIT_FAVOUR` should not be
       re-tuned on the strength of a table. `QUEUE.json` agrees.

## Backlog

- [ ] 118 — The bloom and the pixel-ratio clamp are still written out twice
      — `(0.55, 0.5, 0.15)` and `min(devicePixelRatio, 2)` are byte-identical
      in `engine/render-stack.ts` and `viewer/stage.ts` (the clamp again in
      `encyclopaedia/chart.ts`). docs/TODO/93 tried to take these and backed
      out: their home is `src/constants/`, and putting them there makes the
      catalogue's duplicate-value policy demand `@rule` ids on nineteen
      unrelated constants across ten modules, because 0.5 and 2 are popular
      numbers. That policy call is the actual work and it is not a colour
      question. Needs a plan doc before it is executable.

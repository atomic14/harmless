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
       with his three decisions in it: the outlaw path gets its carrots,
       disrepute folds into the pirates' "how you're seen" channel, and the
       hermit refusal is binary. Four milestones; **M1 has landed** (one home
       for what a sale does to your name, and the campaign now prints the
       character it was blind to). M2 is the `Mark`, M3 the hermit's door,
       M4 the balance re-read. `QUEUE.json` agrees.

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

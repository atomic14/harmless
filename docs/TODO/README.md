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

Empty — 96 landed: the Character label drives the world now. A pirate reads
your disrepute as one more thing they can see, folded into the reputation model
already there, so a Dodgy pilot meets a worse reception and a Notorious one is
occasionally waved off by somebody who recognised the name. The rock hermit
gives mates' rates up to the Dodgy rung and shuts the door at it, which is what
cracking a hermit costs you. Closed on the campaign rather than a flight, at
Chris's call: the bounty hunter's 200-commander row is identical to the
baseline and the privateer's gangs go 12%→19%, but nobody has met those pirates
in a cockpit yet. `DISREPUTE_HEAT`, `COURTESY_RATE` and `HERMIT_FAVOUR` are
unflown starting values, and what plays wrong becomes a GitHub issue.
`QUEUE.json` agrees. The backlog below is in priority order; promoting its head
is what makes the next execution item.

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

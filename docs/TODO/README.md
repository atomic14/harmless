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

Four plans, triaged from the GitHub inbox on 2026-08-10 with Chris's decisions
in them. In order; `QUEUE.json` agrees.

1. [ ] [120 — the port marker says LINED UP when you are rolled
   wrong](120-the-port-marker-says-lined-up-when-you-are-rolled-wrong.md) ·
   **#19** · bug, small. The marker goes green off `inSlot`, the lateral test
   alone, so it promises a dock the roll check is about to refuse. `rollOk` is
   computed beside it in `hud-model.ts` and nobody reads it. Three states, and
   the choice moves into the model where a test can reach it.
2. [ ] [121 — the test mode that has no door](121-the-test-mode-that-has-no-door.md)
   · **#18** · tooling, medium. `GameState.cheat` is saved, validated, wired
   into the outfitters and covered by a passing test — and nothing in the
   shipped game can set it, because the globals purge deleted `window.__cheat`
   without building a replacement. M1 is the door and the mark it leaves on the
   career; M2 the commander levers (fuel, credits, legal status, Character);
   M3 the flight levers. Ahead of the law work because it is what lets somebody
   fly it.
3. [ ] [122 — the police scan arrives with no warning](122-the-scan-arrives-with-no-warning.md)
   · **#20** · balance, small. Proximity is already required (`SCAN_RANGE`
   2,600); the telegraph is not there, so the scan is a silent verdict rather
   than a decision. Warning only, no new flying, at Chris's call. M2 is the
   player's half of that window: `dumpCargo` takes the most valuable thing
   first, which puts Slaves 14th of 17 — the dump key throws the profit
   overboard while the evidence stays aboard.
4. [ ] [123 — you cannot buy off the law](123-you-cannot-buy-off-the-law.md) ·
   **#21** · feature, medium. `satisfied` already ends a ship's interest in you
   for every role; only the offer is missing. M1 buys off the inspection inside
   122's window, M2 calls off the vipers already on you, M3 is the cop who says
   no, weighted by Character. A bribe never clears a record and always costs
   your name.

96 landed before this: the Character label drives the world now, but
`DISREPUTE_HEAT`, `COURTESY_RATE` and `HERMIT_FAVOUR` are unflown starting
values. 121 M2's Character lever is what settles them.

## Backlog

Not executable yet. In priority order; promoting the head is what makes the
next execution item, once it has a plan doc.

- [ ] 118 — The bloom and the pixel-ratio clamp are still written out twice
      — `(0.55, 0.5, 0.15)` and `min(devicePixelRatio, 2)` are byte-identical
      in `engine/render-stack.ts` and `viewer/stage.ts` (the clamp again in
      `encyclopaedia/chart.ts`). docs/TODO/93 tried to take these and backed
      out: their home is `src/constants/`, and putting them there makes the
      catalogue's duplicate-value policy demand `@rule` ids on nineteen
      unrelated constants across ten modules, because 0.5 and 2 are popular
      numbers. That policy call is the actual work and it is not a colour
      question. Needs a plan doc before it is executable.

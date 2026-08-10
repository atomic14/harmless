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

Two plans left of the three triaged from the GitHub inbox on 2026-08-10 with
Chris's decisions in them. In order; `QUEUE.json` agrees. 121 landed: ⇧T at the
station is the door onto `GameState.cheat`, and twenty levers are behind it —
fuel, missiles, credits, legal status, Character, and the fit-out, which is the
half the outfitter never had. It only ever FITS: `cheat` already made everything
free at any tech level, but an owned item is refused and the gun ladder only
climbs, so nothing could take a piece of kit back OFF. These rows write
`Equipment` directly, both ways. In flight, the jump stops asking about fuel.
A career that switches any of it on carries `commander.tested` for good and says
so on its status screen.

M3's SPAWN key was built and then removed at Chris's word — *"we don't need to
spawn anything. But we do need to be able to select whatever equipment we
want."* The plan doc records what went and what replaced it.

**Nobody has flown it.** Every claim in 121 is a headless test; what plays
wrong in a cockpit becomes a GitHub issue.

1. [ ] [122 — the police scan arrives with no warning](122-the-scan-arrives-with-no-warning.md)
   · **#20** · balance, small. Proximity is already required (`SCAN_RANGE`
   2,600); the telegraph is not there, so the scan is a silent verdict rather
   than a decision. Warning only, no new flying, at Chris's call. M2 is the
   player's half of that window: `dumpCargo` takes the most valuable thing
   first, which puts Slaves 14th of 17 — the dump key throws the profit
   overboard while the evidence stays aboard.
2. [ ] [123 — you cannot buy off the law](123-you-cannot-buy-off-the-law.md) ·
   **#21** · feature, medium. `satisfied` already ends a ship's interest in you
   for every role; only the offer is missing. M1 buys off the inspection inside
   122's window, M2 calls off the vipers already on you, M3 is the cop who says
   no, weighted by Character. A bribe never clears a record and always costs
   your name.

96 landed before these: the Character label drives the world now, but
`DISREPUTE_HEAT`, `COURTESY_RATE` and `HERMIT_FAVOUR` are unflown starting
values. 121's CHARACTER lever is the cockpit that settles them — it exists now,
and the flying is still to do.

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

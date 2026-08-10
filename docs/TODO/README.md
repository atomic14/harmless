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

Four plans. In order; `QUEUE.json` agrees. The first two came out of the GitHub
inbox on 2026-08-10; the last two came out of the first real flight the same
day, once 121's test mode and 124's quit key made one possible.

121 landed before them: ⇧T at the station is the door onto `GameState.cheat`,
twenty levers are behind it — fuel, missiles, credits, legal status, Character
and a fit-out that takes equipment OFF, which no shop in the game can — and the
jump stops asking about fuel. 124 gave the cockpit a way out: P then Q gives up
a flight and puts you back at the station autosave you launched from.

**That flight found six things.** Two were bugs and are fixed (`1067e87`):
jettisoned cargo landed inside your own scoop reach, so pressing Y dumped a
tonne and collected it again one frame later; and every note of the docking
waltz decayed to silence across its own length, so the theme played as blips.
One was already planned (bribing a Viper is 123). One is a finding recorded on
122 rather than a plan of its own — being scanned makes you an Offender, and
police hunt Fugitives, so the Viper that scanned you carries on patrolling.
The remaining two are 126 and 127 below.

1. [ ] [122 — the police scan arrives with no warning](122-the-scan-arrives-with-no-warning.md)
   · **#20** · balance, small. Proximity is already required (`SCAN_RANGE`
   2,600); the telegraph is not there, so the scan is a silent verdict rather
   than a decision. Warning only, no new flying, at Chris's call. M2 is the
   player's half of that window: `dumpCargo` takes the most valuable thing
   first, which puts Slaves 14th of 17 — the dump key throws the profit
   overboard while the evidence stays aboard. **Carries the flight's finding**,
   and it wants a decision before M1: is the consequence made legible, or do
   police start engaging Offenders?
2. [ ] [123 — you cannot buy off the law](123-you-cannot-buy-off-the-law.md) ·
   **#21** · feature, medium. `satisfied` already ends a ship's interest in you
   for every role; only the offer is missing. M1 buys off the inspection inside
   122's window, M2 calls off the vipers already on you, M3 is the cop who says
   no, weighted by Character. A bribe never clears a record and always costs
   your name.
3. [ ] [127 — the survivor is handed over without asking](127-the-survivor-is-handed-over-without-asking.md)
   · feature, medium. You scoop someone out of a capsule and docking files them
   with station medical in the same breath as resetting your shields — no
   choice, no payment, no consequence. Chris: force the choice, and let it be a
   dirty one. M1 is the prompt and the decent answer; M2 sells them at the
   station's own Slaves price or takes a bribe to let them go, priced against
   the Character ladder 96 built; M3 is the law's half. Ahead of 126 because it
   is the one that gives that ladder something to say.
4. [ ] [126 — the docking computer turns the ship without flying it](126-the-docking-computer-flies-by-fiat.md)
   · bug, medium. It writes `player.quaternion` through a shortest-arc slerp
   instead of producing a `FlightDemand`, so it pivots about an axis no stick
   can produce, never writes the rates the HUD reads, and obeys its own turn
   limit rather than the hull's. Two file headers already claim otherwise.
   `pitch-roll-steer.ts` is the vocabulary it never used. Last because docking
   is the hardest thing in the game and this aid must still thread the
   letterbox — the fix has to be measured, not asserted.

96 landed before all of these: the Character label drives the world now, but
`DISREPUTE_HEAT`, `COURTESY_RATE` and `HERMIT_FAVOUR` are unflown starting
values. 121's CHARACTER lever is the cockpit that settles them, and 127 is the
first deed worth spending it on.

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

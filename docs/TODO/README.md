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

**One plan, and it is half-finished on purpose.** 127 and 126 landed on
2026-08-10 alongside 129's first milestone; what is left of 129 is a number
nobody has flown, and flying it is Chris's.

The GitHub inbox is empty: **#22** closed with 127, as #18 did with 121, #20
with 122 and #21 with 123. Nothing below has an issue.

1. [ ] [129 — your name changes and nothing says so](129-your-name-changes-in-silence.md)
   · no issue — asked by Chris · feature, small. **M1 landed** (`8153086`):
   eight deeds and the decay now say `CHARACTER: DUBIOUS` when a rung is
   crossed, assembled from `characterName` so it cannot promise a rung the
   status screen does not show, and queued behind the line that caused it.
   Making that work replaced `scanVerdictTimer` with a real queue — a scan owes
   the console two lines, the record and the name, and one slot silently ate the
   second. **M2 is the `DISREPUTE_BRIBE` value and it stays open**: the whole
   shape of the plan is *make it visible before retuning it*, and the input M2
   needs is a flight.

## What the playtest is now carrying

**A playtest is coming** (Chris, 2026-08-10) and it is the blocking input for
every number below. Nothing in the character system should be retuned before
somebody has seen it work — which is what 129 M1 was for, and what 128's priced
prompts before it were for.

- **`DISREPUTE_BRIBE` (12)** — 129 M2. One bribe takes an Honest commander to
  Dubious. Too much, or the point?
- **`DISREPUTE_HEAT` (0.5), `COURTESY_RATE` (0.15), `HERMIT_FAVOUR` (0.2)** —
  96's three unflown starting values. Is a Dodgy pilot's reception too hard, does
  being waved off read as a mechanic or as a bug, is the discount worth the
  detour?
- **What a person fetches** — 127's finding. A tonne of Slaves is 6 Cr at Lave
  and 16 at the dearest system in galaxy 1, so selling a rescued pilot pays
  6–16 Cr against 40 disrepute. As shipped, the dirty answer is not a
  temptation, and the price being the market's is the decision that makes it
  interesting elsewhere — so the lever is a multiplier on top of the quote.

121's CHARACTER lever (⇧T at the station) is the cockpit that settles all of
them: twenty levers behind one door, including the Character score itself.

## What landed on 2026-08-10

Eight plans in a day, and they are one argument in sequence: a consequence that
is invisible is indistinguishable from nothing happening.

- **122** gave the police scan a window and a verdict; **123** gave you a way to
  buy it off; **128** put both on the console at the moment they matter, priced,
  with the key read off the binding table — and turned that rule on the rest of
  the game, so `test/key-prose.test.ts` fails on any message in `src/game/` that
  spells a bound key.
- **129 M1** finished the thought for the Character ladder: seven deeds moved a
  score nobody was shown.
- **127** made the one genuinely moral act in the game cost something. Docking
  used to file a rescued pilot with station medical in the same breath as
  resetting your shields; it is a forced choice now — hand them over, sell them,
  or take money to let them go — and selling one is an offence the Government
  notices.
- **126** made the docking computer fly. It wrote `player.quaternion` directly,
  so it turned about an axis no stick can produce and no instrument saw it move;
  `npm run dock-probe` is the 320-approach measurement that says the fix still
  threads the letterbox.
- **121** and **124** came first: the test-mode door, and a way out of a flight.

## Backlog

Empty. Promoting the head is what makes the next execution item, once it has a
plan doc; 118 was the last entry and landed on 2026-08-10.

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

**One plan, and it is half-finished on purpose.** 130 emptied the backlog on
2026-08-11; 127 and 126 landed the day before, alongside 129's first milestone.
What is left of 129 is a number nobody has flown, and flying it is Chris's.

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
- ~~**What a person fetches**~~ — **answered by measurement, 131.** It was not a
  matter of taste: a sale paid 2–16 Cr and filed a record costing 25 Cr to
  clear, so it was never correct at any market in any galaxy.
  `SURVIVOR_SALE_TONNES` (4) is the multiplier 127 asked for, bracketed by two
  measured rules — the deed must cover its own cleanup at a median market, and
  must NOT at the cheapest, or where you dock stops deciding. It sits at the
  bottom of that bracket, 4–12, so the playtest can raise it on evidence.

121's CHARACTER lever (⇧T at the station) is the cockpit that settles all of
them: twenty levers behind one door, including the Character score itself.

**The two above cannot be simulated, and this is measured rather than assumed.**
`test/campaign.ts` abstracts flight entirely — no bribe, scan, hermit or murder
ever runs in it — so a 60-commander bounty-hunter cohort over 80 legs ends with
a median career peak disrepute of **0.0**. The harness can only see the trade
half of the ladder. What is missing is not a number the machine can find; it is
how often a person chooses to press the key, and only a person can say.

## What landed on 2026-08-11

**131** — 127's own finding, and it turned out to be arithmetic rather than
feel, so it did not have to wait. Selling a rescued pilot paid 2–16 Cr and filed
a record costing 25 Cr to clear: strictly dominated, so the forced choice 127
built had three branches and two answers. `SURVIVOR_SALE_TONNES` is what a
person is worth on the Slaves row, and its value is bracketed from both sides by
measured rules rather than chosen.

**130** — the third sighting of one defect, and the last one the console had
left. `raiseLegal` said `LEGAL STATUS: FUGITIVE` and `callStationDefence` took
the console away three lines later, so becoming a Fugitive was never read by
anybody. It is `recordVerdict`, queued, behind a launch that queues too: **what
you did → what the sky did about it → where you now stand**. The string is
deleted rather than moved, and so are the two copies of the verdict the scan and
the survivor sale had written out for themselves — one home now, spent by five
deeds.

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

Not executable yet. In priority order; promoting the head is what makes the
next execution item, once it has a plan doc.

**Empty.** 130 was the only entry and it landed on 2026-08-11 (see below).

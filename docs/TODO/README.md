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

1. [137 — the roll rings around any bank it holds](137-the-roll-rings-around-any-bank-it-holds.md)
   · the residue of #23, and the last thing in the docking computer that still
   moves when nothing asks it to. `dockingSticks` overshoots any roll it is asked
   to HOLD and hunts around it at about a reversal a second, ±1.0–1.5 rad/s
   against a hull cap of 2.5 — measured identically before and after 136, and on
   a dead-straight run down the axis, so it is the hand and not the approach.
   134 fixed the case where the turn's axis is meaningless; this is the case
   where the demand is real. A proportional ask behind a rate ramp with no
   damping term.

The GitHub inbox is empty: **#23** closed with 134, as #22 did with 127, #18 with
121, #20 with 122 and #21 with 123.

**One question is open and it is Chris's, not the queue's:** whether the docking
computer should avoid traffic at all. `npm run dock-traffic` answers what it
costs, and the answer got cheaper: it was one non-fatal collision in eighty
approaches, and since 136 gave every ship the same path it is **none in eighty**.
docs/TODO/135 argues against building avoidance for that, with the design bias
recorded (wait, do not swerve) if the answer is yes anyway. 136 M4 is where it
would go if it is ever wanted — the curve takes a plane as a parameter, so a path
pushed off the traffic is still a path of the same shape.

## What the playtest is now for

**It reports; it no longer blocks** (Chris, 2026-08-11: *"do not block things on
my playtest, use sensible default values"*). Every number below is settled and
gated. docs/TODO/132 has the reasoning: three of the four were never matters of
feel, and the fourth stopped being a value at all.

What a flight is still worth is the part no measurement reaches — whether being
waved off by a hermit reads as a mechanic or as a bug, and whether a bribe FEELS
like it costs something. Those become GitHub issues, not blockers.

- **`DISREPUTE_BRIBE` (12)** — settled by arithmetic, not feel. Over all 1,686
  jumps galaxy 1 allows inside a full tank, a median jump forgives 6 disrepute;
  the bribe is exactly twice that, so one bad afternoon washes off in two quiet
  jumps and a bribe every system reaches Dodgy by the fourth. Unchanged, gated.
- **`DISREPUTE_HEAT`** — no longer a number. Its own doc said it meant "as
  interesting as a fat sale", which names `SALE_NOTORIETY_MAX`; it is that
  constant now and cannot drift from the sentence that justifies it.
- **`COURTESY_RATE` (0.15), `HERMIT_FAVOUR` (0.2)** — unchanged, and gated on
  the design rather than the mechanism: the stick must outweigh the carrot, and
  the hermit's welcome must stay a perk rather than a wholesale channel.
- ~~**What a person fetches**~~ — **answered by measurement, 131.** It was not a
  matter of taste: a sale paid 2–16 Cr and filed a record costing 25 Cr to
  clear, so it was never correct at any market in any galaxy.
  `SURVIVOR_SALE_TONNES` (4) is the multiplier 127 asked for, bracketed by two
  measured rules — the deed must cover its own cleanup at a median market, and
  must NOT at the cheapest, or where you dock stops deciding. It sits at the
  bottom of that bracket, 4–12, so the playtest can raise it on evidence.

121's CHARACTER lever (⇧T at the station) is the cockpit that settles all of
them: twenty levers behind one door, including the Character score itself.

**Do not reach for `npm run campaign` to re-open any of these.** It abstracts
flight entirely — no bribe, scan, hermit or murder ever runs in it — so a
60-commander bounty-hunter cohort over 80 legs ends with a median career peak
disrepute of **0.0**. Measured, not assumed. The harness sees only the trade half
of the ladder, which is why 132 anchored these against the decay, the sale
channel and each other instead.

## What landed on 2026-08-11

**136** — the approach is a PATH now, and the defect Chris reported by parking on
the far side of the station is gone: **no approach in 504 has a plan that jumps
more than 20 degrees, against 223 of them, and the worst went from a full 180 to
3.4.** His own case took 28 seconds and ten full-authority pitch reversals; it
takes 16 seconds and one. The shape is the whole of it — a fixed stand-off funnel
holding the gate distance from a quarter turn round to astern, maximum'd with the
ship's own way in through where it actually is, and an aim one lookahead along
it, so the stand-off, the way round the hull and the run in stopped being three
answers with thresholds between them. Everything else came with it: median 19.4s
→ 15.6s, 1 scrape → 0, pitch reversals 5 → 2, and traffic collisions 1 in 80 → 0.
Three things the measurements decided against what looked right are recorded in
the plan; the one thing it did NOT fix is 137, at the head of the queue.

**134** — #23, and the one thing `dock-probe` was never asked to measure. The
autopilot rolled hard over and back every 0.45s while its nose was dead on the
gate heading, chasing the direction of a vector whose length had gone to zero:
`nose × heading` is degenerate exactly when the controller succeeds. It got past
126 because the probe scored docked, seconds and scrapes and all three were fine
— **docking well and flying well are different claims, and only the first had a
number**. The fix is two gates rather than the one the plan predicted, because
the obvious one alone only changes what the ship chases. Median approach: 17 roll
reversals → 8; 320/320 docked either way.

**132** — the four numbers that were holding the queue open, closed without the
flight they were waiting for. Each already had an anchor in the codebase that
nobody had gone and looked for. Nothing moved on taste: `DISREPUTE_HEAT` became
`SALE_NOTORIETY_MAX` (its own doc named that constant in words), and the other
three kept their values and gained gates.

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

**Empty.** The fall-back entry docs/TODO/134 left here was retired by 135
without being worked: runs were giving up because the aim point teleported when
they committed, so the count went to zero on the shipped grid the moment that was
fixed. It was a symptom, not a defect.

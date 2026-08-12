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

1. **140** — [The day is the one cost nothing
   shows](140-the-day-is-the-one-cost-nothing-shows.md), **GitHub #24**, and the
   current item by Chris's call on 2026-08-12. **M1 landed 2026-08-12; M2, M3
   and M4 are what is left.** A jump spends fuel, money and days; the chart
   prices two of them and never names the third. `commander.day` moves on a jump
   and on a mis-jump tow, and on nothing else — not a trade, not a fight, not a
   dock — and it was on screen only where nobody consults it: a saves column,
   the bulletin-board keyline, and the docked menu's first contract. **M1 put it
   where the pilot already looks** — `Elapsed: N days` on the COMMANDER screen
   between fuel and cash, `· DAY N` on the docked menu, and a fourth topbar span
   so it ticks in flight, which is where a jump happens. No arithmetic moved:
   `commander.day` was always right and four painters now read it. It also cost
   a defect that was waiting: `test/ui.test.ts` left a half-built `document`
   global behind, and M1's first real `Game` in a later test file died on it and
   took the suite with it. **M2** adds the jump's cost in days to both chart info
   lines, from `daysForJump`, which already exists. **M3** is the part with no
   code anywhere today: no route search exists, so a destination beyond one tank
   has no honest estimate. Dijkstra over full-tank edges answers it in days and
   hops — a number, never a drawn path, so the pilot still chooses every jump.
   **M4** marks a system you owe a contract to and prints the verdict beside it.
   One trap is recorded and is the reason to read the plan before the code:
   `ChartOverlays.day` is the LIVING galaxy's day, which catches up by at most
   60 days a load, so a deadline computed from it is right for months and then
   silently wrong on an old save. M1 stages that trap rather than describing it
   — the two clocks are driven 500 days apart and the topbar still reads the
   commander's.

2. **139** — [Nothing the galaxy sends can get through the
   shield](139-nothing-the-galaxy-sends-gets-through-the-shield.md), **M1, M2 and
   half of M4 landed 2026-08-11; M3 is what is left**. Chris, flying it: *"is our
   shield and energy recharging too fast — the laser hits from pirates don't seem
   to do much damage — or they aren't very accurate at shooting..."* All three
   guesses were live. **Fourteen of the seventeen pirate builds could never strip
   a shield face** — not slowly, ever — because their BEST case, point blank and
   never out of the gate, was under `SHIELD_REGEN`'s 8.925 points a second.
   `npm run aim-probe` (M1) then measured what a gun is really worth: **7–27% of
   that best case**, so no gang of four in any fight the probe can stage landed
   more laser than one face put back. **M2 cut `SHIELD_REGEN_FRACTION` 0.035 →
   0.012** — a face in 83 seconds instead of 28.6 — on a sweep confirmed at two
   sample sizes on two seed grids, and the value is the highest one that clears
   the rule `test/role-variants.test.ts` now pins: no build the galaxy sends may
   be one a face simply outruns. A tier-2 gang of three now reaches ENERGY LOW in
   **49.5% of fights against 34.0%** and takes her down in **35.5% against 15.0%**;
   `npm run survivability`'s destroyed column leaves zero for the first time.
   Nothing else moved — not the bank, not a damage number, and not how anybody
   flies. **What M3 has left** is the aim, and M1 already split it in two: chasing
   a commander who runs, the nose is 1.4° off her and the ship is out of RANGE;
   standing and fighting, it is 85.6° off — six times the gate — so widening
   `NPC_FIRE_GATE` is not the fix and the flight model is the term. Whether that
   is worth changing now the regen has moved is the open question.

3. **138** — [Every system in every galaxy flies the same
   roster](138-every-system-flies-the-same-roster.md). The 23 released blueprint
   sets `S.A`–`S.W` are all imported and the set dimension is then collapsed:
   `SPECS` resolves its builds at import time, so a Krait is the same Krait in
   all eight galaxies. The released rule is recovered and cited (tech level,
   government, two random bits, plus Elite-A's galaxy addition), and bit 0 turns
   out to be the rule that already picks the Dodo over the Coriolis — one home,
   not two. Behind 139 because its M1 roster probe must not be baselined against
   a fight that one-sided, and because a set-faithful build choice would have
   weakened an opposition that already cannot bite — which is why 138 keeps
   `role-variants.ts` ranking inside the set it chooses.

The GitHub inbox holds one open issue, **#24**, and 140 above is its plan.
Everything else is closed: **#23** with 134, as #22 did with 127, #18 with 121,
#20 with 122 and #21 with 123.

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

**137** — the last thing in the docking computer that still moved when nothing
asked it to. The roll overshot every bank it was given and rang round it at about
a reversal a second: a proportional ask driving a rate ramp is a second-order
loop with **no damping term**, sitting at a damping ratio of 0.38. `DC_ROLL_LEAD`
asks for where the error WILL be a tenth of a second ahead, and the median
approach goes from 18 roll reversals and 1.9 turns swept to **12 and 0.9**, on
two independent grids. The second half is what the ring had been hiding: damping
it alone took the wings at the letterbox from 7.5 degrees off the slot to 8.8,
and that was the fix working — 7.5 was a ±40-degree swing sampled wherever the
letterbox caught it, not a ship sitting 7.5 degrees off, and a ship that sits
where it is asked sits at whatever `DC_SLOT_MARGIN` allows. So the margin became
measurable for the first time and moved with it, 0.5 → 0.30, chosen at the knee
rather than the floor. **The wings arrive 4.4 degrees off the slot in a median
approach and 13.8 at worst, from 7.5 and 30.0**, with docked, scrapes, seconds
and the plan's jump column unmoved and traffic still clean. It cost the NOSE 0.9
degrees in the median — the same bank spending itself twice. **Flown by Chris on
2026-08-11 and confirmed good**, which closes the docking-computer sequence that
ran from 126 through 134, 135 and 136 to here.

**136** — the approach is a PATH now, and the defect Chris reported by parking on
the far side of the station is gone: **no approach in 504 has a plan that jumps
more than 20 degrees, against 223 of them, and the worst went from a full 180 to
1.1.** His own case took 28 seconds and ten full-authority pitch reversals; it
takes 16 seconds and one. The shape is the whole of it — a fixed stand-off funnel
holding the gate distance from a quarter turn round to astern, maximum'd with the
ship's own way in through where it actually is, a straight run in from three
fifths of the gate, and an aim one lookahead along, so the stand-off, the way
round the hull and the run in stopped being three answers with thresholds between
them. Everything else came with it: median 19.4s → 16.4s, 1 scrape → 0, pitch
reversals 5 → 4, and traffic collisions 1 in 80 → 0. Two rounds of Chris flying
it are in the plan and in two new columns of the probe — how far off the slot the
ship is still POINTING as it goes through (13.6° → 5.4°) and how far its WINGS
are off the letterbox (20.4° → 7.5°, against 37° of tolerance and the old
approach's 1.7°). That last gap was the roll ring, which is 137 above.

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

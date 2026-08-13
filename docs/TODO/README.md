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

1. **138** — [Every system in every galaxy flies the same
   roster](138-every-system-flies-the-same-roster.md). **M1, M2 and M3 landed on
   2026-08-13; M4 is the two overrides and is all that is left.** The 23 released
   blueprint sets `S.A`–`S.W` were all imported and the set dimension was then
   collapsed, so a Krait was the same Krait in all eight galaxies. It is not any
   more: a system draws two random bits on arrival, and the set it lands on says
   which designs turn up. The released rule is recovered and cited (tech level,
   government, two random bits, plus Elite-A's galaxy addition), and bit 0 turns
   out to be the rule that already picks the Dodo over the Coriolis — one home,
   not two. It waited behind 139, because its M1 roster probe must not be
   baselined against a fight that one-sided, and because a set-faithful build
   choice would have weakened an opposition that already could not bite — which
   is why 138 keeps `role-variants.ts` choosing the build inside the pool of
   designs the set narrows to. M4 is left: the Constrictor's system always flies
   G, and the plans or witch-space fly C or D by tech level. The chooser already
   takes both overrides and is already tested on them; what is missing is the
   caller.

The GitHub inbox is empty. **#24** closed on 2026-08-12 with
[140](completed/140-the-day-is-the-one-cost-nothing-shows.md), after Chris flew
it: *"display is good"*. **#23** closed with 134, as #22 did with 127, #18 with
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

## What landed on 2026-08-13

**138 M3** — every system does NOT fly the same roster now. A commander who jumps
draws two random bits from the seeded stream, the four inputs pick one of the 23
released blueprint files, and that file says which designs turn up. The set is
saved state, so a reload comes back to the reception the save was taken in.

**Three of the four things it found were not in the plan, and the first one
inverts the plan's own headline.** M1 measured variety as distinct designs over a
career, got 17, and told M3 to raise it. It could not rise: 17 is every pirate
design Harmless files, every one is filed by some set, and the census is a union
— so 17 was already the ceiling. What the choice buys is the opposite shape. **A
band of 4.4 designs per arrival where there were 17, over 23 distinct pirate
rosters.** The probe reads both now, because they answer different questions.

The second is where the damage guard had to be read. **No pirate in the game
comes through the band uniformly** — `spawnPopulation` picks a threat tier from
how attractive a target the commander looks — so narrowing the band alone would
have left the one band this item is about untouched. On the path the game
actually spawns on, tier 1 rose, **tier 2 fell 2.9% and tier 0 fell 7.3%**, and
every minimum and maximum is unchanged. Tier 0 is the opportunist a poor
commander draws, and it is the tier meant to be beatable.

The third answers the question M1 said M3 had to answer. M1 warned that a set
filling its pirate band with light designs only would breach the regeneration
floor. **It cannot, and the reason is structural rather than lucky:** M3 narrows
which designs turn up and never touches a build, so the softest pirate any tier
can send is the same ship it always was.

**Twelve of the 23 sets empty a threat tier and four bands are empty somewhere** —
21 sets file no Thargoid, set J no trader Harmless flies, sets L, O and U no
bounty hunter. One rule covers all of it: where a set files nothing for a job,
the full roster answers. A set does not get to downgrade the threat rule, and the
measurement says what letting it would cost — 9.5% off a tier-2 hit.

**139** — the item Chris found by flying it, and it closes on a decision NOT to
change anything. M1 and M2 landed on 2026-08-11: the probe that measured time on
aim, and the regen cut that made a shield face reachable. **M3 was the aim, and
the answer is no.** The figure that made the aim look broken was 85.6° off her
in a knife fight, which is six times the firing gate. `npm run aim-probe` prints
a fourth table now, and it takes that figure apart by the leg the ship was
flying:

| leg | share of the fight | mean aim error |
| --- | --- | --- |
| `closing` | 42.6% | 64.1° |
| `on your six` | 32.1% | 37.0° |
| `extending` | 13.7% | 142.0° |
| `passing` | 11.6% | 102.3° |

**A quarter of the fight points the nose away by design.** `passing` and
`extending` carry a ship past her and open the range again, so 102 and 142
degrees is the attack run working. Neither of the two legs that DO want the nose
on her is a pilot that cannot point: `on your six` is pure pursuit, which takes
no lead against a commander who out-turns it, and `closing` aims beside her on
purpose so that the run clears the hull. So "widen `NPC_FIRE_GATE`" and "fix the
aim" both mean "delete a designed behaviour". Confirmed at 600 episodes, at 200,
and on a second seed grid, with every share inside 0.5 points.

**Four reasons it stays where it is**, and they are in the plan doc. The regen
already bought both decisions the item recorded — a lone pirate still loses and
bills her about 19% of her pools, and a tier-2 gang of three reaches ENERGY LOW
in 49.5% of fights and kills her in 35.5%. A perfect gun is a further factor of
four to thirteen, and the plan forbids a move to regen and aim in one
measurement. `pursuit.ts` is shared with the player's own bought combat computer,
so a lead term is two balance changes on one edit. And invariant 5 makes the
flight model the world every pilot was fitted in, which a constant was not.

**The lever is recorded so that nobody has to find it twice**: the missing lead
in `pursuitAim`, which returns the target's own position where the attack run
leads with `leadTime`. It is not a defect, it is not urgent, and it needs its own
item. **No game rule moved in M3**, and the pairing proves it — the M2 tables came
back byte-identical beside the new one.

## What landed on 2026-08-12

**141** — the house style, and the reader it is for. ASD-STE100 Simplified
Technical English is a controlled language built for somebody who must act on a
written instruction and cannot ask the author what it meant. That reader is the
one this repository has. All four milestones landed in a day, over **four rule
docs, six reference docs and all 61 files of `src/constants/`**.

The four rule docs came first, because they are read at the top of every session
and the code cites them **107 times by invariant number**. All 15 invariants keep
their numbers and their claims, all 107 citations still resolve, and the seven
doc paths that `src/`, `test/` and `tools/` name are unchanged at the same
counts. The convention was written second on purpose, as a `## Prose` section in
`CLAUDE.md`: M1 is where it becomes clear which rules bite here. The half that
matters more is the list of what it never touches — code, an exact command or
error string, anything quoted from a person, a record of what was decided or
measured, `README.md`'s opening, the player-facing pages, and `CATALOG.md` by
hand. `DAMAGE-PATHS.md` went last, and its 25-row inventory was not edited at
all, because `test/damage-paths.test.ts` reads that table. The constants were
edited at their source and regenerated: **374 exports and 54 rule ids**, both
unchanged, which is what says the pass changed prose and not rules.

Four things came out of it that the plan did not have, and all four are in the
plan doc. A dated report pins its own text, so `JAMESON-TRIALS.md`'s "left as
written" note now says what is true instead. `TACTICS` had no JSDoc, because
`constants:check` is diff-scoped and an export can sit undocumented until
somebody edits its file. **Two quotations attributed to `CLAUDE.md` are no longer
in it** — the commit that slimmed the agent context took them out — and they are
left verbatim, because a quotation rewritten is falsified. And `docs/PROCESS.md`
still cites a "step 3" that went with the cycle orchestrator on 2026-08-09.

The plan's own open question is answered by `CLAUDE.md`: its `## Style` line
already covered "TODO items", so the convention keeps them, and the "a record of
what was decided or measured" exclusion is what holds the plan archive and the
logs out. Commit messages are still unnamed either way.

**Both of the last two closed on 2026-08-13**, on Chris's call — remove the stale
quotes, and fix up the process. There were four attribution sites, not two, and a
quotation of a rule that no longer exists cannot be repaired by a rewrite: each
claim is now the host document's own, and `BROWSER-TRIALS.md` says in its opening
that it is the rule's home. `DEVLOG.md` and `TRAINING-LOG.md` name `CLAUDE.md`
six more times and are deliberately untouched, because they are a record.
`docs/PROCESS.md` has its four steps back, written around the loop that runs now
rather than the cycle orchestrator that was deleted, so "see step 3" resolves for
the first time since 2026-08-09. Step 3 is the tiers: `npm run check` always, and
a table of what runs beyond it. One row of that table is the case M4 met — **a
doc comment in `src/constants/` is the `Purpose` column of `CATALOG.md`**, so a
prose-only edit still leaves the catalogue stale.

**140** — GitHub #24, and the one cost a jump spends that no screen named. All
four milestones landed in a day. The day itself now sits between fuel and cash
on the COMMANDER screen, on the docked menu, and in a fourth topbar span, so it
ticks in flight where a jump moves it. Both charts price the jump under the
cursor in days. Beyond the tank they estimate the whole journey, over a Dijkstra
across full-tank edges in `src/galaxy/route.ts` — a full tank because fuel costs
money and no days. And a world you owe a contract to carries an amber diamond
and a verdict: `DUE IN 6 DAYS · 3 DAYS AWAY`, or `TOO FAR` in red.

Four things the plan did not have came out of it, and all four are in the plan
doc. The map is far sparser than the estimate, at 6.6 neighbours a system. Some
destinations have no route at all, and shipped galaxies hold them. The plan's
red rule was one day out, because settlement pays a delivery that arrives ON the
deadline day. And the marker needed a recording canvas that did not exist:
`inert-dom.ts` gives a painter a context that returns undefined, so a mark drawn
nowhere and a mark never drawn looked the same from every test.

**Flown by Chris on 2026-08-12 and confirmed good** — *"display is good"* — which
was the last item of the plan's Verification. Two things needed a pilot rather
than a probe: whether a fourth topbar span reads well in flight, and whether the
contract marker crowds a chart that already draws eight things.

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

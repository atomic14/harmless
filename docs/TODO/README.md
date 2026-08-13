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

1. [146 — A click cannot press a shifted key](146-a-click-cannot-press-a-shifted-key.md)
   · Chris, 2026-08-13 · defect · small.

**146 is Chris's reading of 144 M6, and he is right.** The keyboard was never
broken — ⇧I resolved correctly through the binding table. The CLICK is the
broken half, and it dispatches a bare letter: `dockedMenuHtml` writes `data-key`
without the modifier, `ScreenHost.click` injects that code, and the matcher asks
a frame-global "is shift held" that only a real keydown answers. His requirement,
in his words: *"If a click is on a row that has a capital letter then the capital
letter should be sent."*

**The obvious fix is wrong, and the harm is silent.** An injected tap that set
the frame's shift flag would change the answer for every binding tested in the
same frame — a plain `Y` would satisfy `⇧Y`, and one click on a menu would dump
five tonnes instead of one. So shift becomes a property of the TAP. That false
fire is the item's main gate.

144 M6's rule — a docked menu row takes a plain letter — stays until this lands,
and its gate survives afterwards with its wording changed and its claim intact.
`R` stays the missions key either way.

**145 landed the same day.** Chris asked whether contracts belonged on the
missions screen; they do not, and the two are split by kind now.

**Three issues closed on one pattern in three days.** Chris flew the game, and
each time the rule was correct and the cockpit did not carry the consequence.
142 closed #25, 143 closed #26, and 144 closed #27.

The GitHub inbox holds no open work. **#27** closed on 2026-08-13 with
[144](completed/144-a-standing-order-with-nowhere-to-live.md). **#26** closed on
2026-08-13 with
[143](completed/143-the-counter-never-says-which-tonnes-are-spoken-for.md).
**#25** closed the same day with
[142](completed/142-every-explosion-is-in-the-cockpit.md), after Chris flew it on
headphones. **#24** closed on 2026-08-12 with
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

**145** — Chris's call on reading 144: a contract and a mission are two kinds of
thing, and one screen holding both left the bulletin board saying the same thing
twice. **MISSIONS is the Navy's alone.** **CONTRACTS opens in flight, on ⇧C**,
with the ACCEPTED half travelling and the board staying at the station — the
offers in state are the LAST station's work, so drawing them would show a pilot
jobs she cannot take. The accept key is refused rather than hidden. Both screens
got one name each; the headings and the rows had disagreed.

**Five things came out of it that the plan did not have, and the largest is the
plan's own fault.** It called the board *"a second, independent rendering"* that
could word a job differently. It could not — both halves call
`describeContract`. What was genuinely written twice is the days-left
subtraction. Also: the accept-key refusal had no gate at all until proving the
gates could fail caught it; `controls.ts` crossed the size ceiling three times
because the click-path rule was written at every binding that obeys it, and it
has one home now beside the function it is about; and `ordersSummary` had lost
its doc comment to `orderDestinations` back in 144 M4.

**Flown at Leesti.** R gives NAVY MISSIONS with no contract on it, C gives the
board plus the accepted jobs, and ⇧C in flight gives the accepted half alone.
The session found two things that are correct behaviour rather than defects: a
background tab has `document.hidden`, so no frame runs and no key does anything,
and the docking tunnel holds input for as long as it runs.

**144** — GitHub #27, and the Navy's briefing had nowhere to live. A **standing
order** is an obligation that outlives the moment it is announced. The game has
two kinds, a signed contract and the Navy mission, and they shared one amber line
under the station header. The contract won it. So a commander who took any job
before the Navy briefed her was never told where the Constrictor was, and the
transmission she did get lasted five seconds and named no system.

**The Navy mission was the only standing order in the game with no screen.** A
contract has a durable home in the bulletin board's ACCEPTED table. That home is
a station, so in flight neither kind was readable at all — and the pilot who met
the Constrictor was forty light years from the station that briefed her.

All five milestones landed in a day. `game/orders.ts` asks the two kinds the
same question and restates no rule. **R opens the standing orders at the station
and in the cockpit**, and the screen exists when it is empty. The menu line is
one entry per KIND now, so nothing can hide a kind again. A console line may
carry a `Command`, rendered at the edge, so the transmission ends
`— R MISSIONS` and no sentence in `src/game/` spells a letter. **Both charts
mark the Navy target** in the diamond 140 built, with a contract answering first
where one world carries both.

**Invariant 16 is the rule that came out of it**, and it is wider than the Navy
mission: a standing order has a screen, a console line never holds the only copy
of one, and a surface that carries orders never drops one kind for another. Two
gates hold it as behaviour — a walk of the mission machine end to end, and a
matrix over both mission states and four contract counts that asserts the number
of kinds HELD equals the number of kinds NAMED.

**Six things came out of it that the plan did not have**, and all six are in the
plan doc. The largest is a second defect the test found: **the gun warning
deleted the transmission it explains.** Both lines were pushed with `say` in the
same frame, and `showMessage` takes the console — so a commander with the wrong
gun never saw that the Navy had called. It is queued now, which is the rule
`session.ts` already states. `test/key-prose.test.ts` could not see it, because
neither line spells a key.

**The flight found a defect every gate had missed, and it was in the key.** The
screen shipped on ⇧I, and **clicking its own menu row opened the COMMANDER
STATUS screen**. A menu row is a click target, `data-key` carries the key and
not the modifier, so a shifted ROW cannot keep invariant 13's promise that a
click becomes the same keystroke as a key press. ⇧T only ever dodged it by being
a keyline caption rather than a row. The key is **R** now — the only plain letter
free in both tables — and the rule is a gate: `test/key-help.test.ts` presses
every docked row through the click path. Nothing could see this before, because
the binding table was never the broken part and no test joined a binding to the
HTML its row renders to.

**Flown at Leesti on 2026-08-13**, with 16 kills, a beam laser and two contracts
held. All five surfaces read correctly, and no save was put at risk: the browser
held three real careers, the page was switched to the harness namespace before
any docking, and all seven player keys were byte-identical afterwards.

`npm run check` passes, and every gate added was shown to fail. **One question is
still Chris's:** the station line wraps to two lines when it carries three
things, and whether that reads well is his call.

**143** — GitHub #26, and the rule the issue questions is correct. The triage
answered it by measurement: over 138 freight jobs from 86 home systems of galaxy
1, selling the consignment at the DEAREST price the galaxy can roll and letting
the job expire never beat delivering it. The closest it came was delivering
paying 2.24 times the sale. So the sale stays legal everywhere, a hermit's
included, and the SCREEN is what changed.

**The market screen says which tonnes are spoken for.** `consignedTonnes` is a
derived reader beside `berthTonnes`, and the `IN HOLD` cell reads
`10t · 5 CONSIGNED` in the amber an illicit job already uses. It reports the JOB
and not a share of the hold, because goods are fungible: 15t against a 5t
consignment says 5, and the other ten are hers. A `smuggle` run is freight and
marks its row too. A berth, a bounty and a courier run carry no goods and mark
nothing.

**The sale asks once.** The first sell key on a marked row says
`5T CONSIGNED — PRESS V AGAIN TO SELL`, and the second sells. `SELL ALL` arms the
same way, so the fastest way to void a contract is not one keystroke. It is a
warning rather than a refusal, and there is no hermit-only door: a rule with two
homes is what `CLAUDE.md` forbids.

**Four things came out of it that the plan did not have**, and all four are in
the plan doc. The largest is where the arming had to live. The plan warned that
`test/playtest.js` calls `sell` — it does not, it empties the hold itself and
only ever calls `g.buyCargo` — but `Game.sellCargo` does, so the arming sits in
the input handler and `sell` stays the plain action a scripted caller needs. A
row already sold down to nothing still carries the mark, and that is the last
warning there is before the door. `test/consigned-hold.test.ts` is 38
assertions, and all three gates were shown to fail. `npm run check` passes at
4,413 assertions.

**One asymmetry is recorded rather than scheduled.** A shortfall is billed at the
destination and free everywhere else. The same missing tonnes arriving LATE cost
nothing, and settlement cannot see whether the hold is short because it was sold
or because it was robbed.

**142** — GitHub #25, and the sky stopped being mixed in the cockpit. All three
milestones landed in a day, and Chris flew it on headphones the same day. A
`SoundEvent` carries where it happened now, `AUDIBLE_RANGE` is the scanner's
reach written as an expression over `SCANNER_RANGE`, and a bang falls off as the
square of what is left. A wreck beyond the scanner builds no voice at all.

**The stereo place is Chris's own addition, and it is M3.** `viewRight` sits
beside `viewDirection`, and the ear turns with the VIEW rather than with the
hull — so a ship on the left of the screen is on the left in rear view too. The
docking waltz had already built every hard part: the panner, the straight-through
fallback for a browser without one, and the fixture that records both.

**His question about the NPC laser changed the design, and the code answered it.**
He asked whether a bolt should be judged by where it was fired from or by how
close it passes. Neither: `heard('enemyLaser')` is pushed only where the shot is
at the PLAYER — an NPC shooting another NPC draws a tracer and says nothing — so
the beam always ends on the hull. That sound is **placed and never attenuated**.
You always hear that you are under fire, and the ear says where from. Three
categories, not two.

**Eight things came out of it that the plan did not have**, and all eight are in
the plan doc. The largest: **no test had ever played a noise.** The fake
`AudioContext` had no `createBuffer`, so `explosion`, `hit`, `damage`, `ecm`,
`bomb`, `hyperspace` and `tunnel` all threw on the first call under it — every
sound `test/audio.test.ts` names is built from `tone`. The envelope's floor turned
out to decide two things at once, so a voice under it is skipped rather than
built backwards. The zero-distance guard is defensive rather than live, and the
plan said otherwise. Two unrelated constants needed `@rule` ids, because a third
constant arrived on the value 0.7. And two comments were already wrong before
this item touched them.

`test/sound-place.test.ts` is 30 assertions, and all five gates were shown to
fail. `npm run check` passes at 4,374 assertions with zero constants warnings.

**138 M4 closes the item.** The two released overrides have a caller.
`missionBlueprintOverride` in `game/missions.ts` owns both mission facts — the
hunting leg AT the target system flies set G, and the courier run flies a
Thargoid set — and `enterWitchspace` chooses a set at all, which it did not
before. **Limbo is asked first**, because a mis-jump on the hunting leg is still
limbo, and the Constrictor waits in a system rather than between two.

**Four things it found were not in the plan.** An override must not draw, and the
Thargoid ambush is what says so: the number is not consulted behind an override,
and a draw made to fill it moves the ambush from **three Thargoids to two**,
because the ambush rolls off the next values of the same stream. An override
raised at a dock takes effect at the NEXT arrival, which is the arrival-only rule
working rather than a hole in it — the sky you launch into is the sky you docked
out of. Witch-space picks its tech branch from the system you jumped FROM,
because a mis-jump does not move `commander.systemIndex`. And **21 of the 23 sets
file no Thargoid**, so until now limbo had been flying M3's empty-band fallback:
the ambush is by a ship the set in force did not file.

`test/blueprint-override.test.ts` is 21 assertions, and all four gates were shown
to fail. `npm run check` passes at 4,344 assertions, and `npm run roster-probe`
is unchanged — the probe walks the number, and no override fires on that path.

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

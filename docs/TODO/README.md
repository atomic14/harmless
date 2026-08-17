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

The queue is empty.

**THE DECOMPOSITION PROGRAMME IS DONE.** docs/TODO/181, 182, 183 and 184 all
landed on 2026-08-17. `src/game/npc.ts` went 1,468 lines to 856, into eight
files, and `NpcShip.update` went 157 lines to 37.

**CHRIS NAMED THE CAUSE, AND THAT IS WHY IT WORKED.** He read `npc.ts` on
2026-08-17 and said: *"we have not used a good OO approach in this project."*
Every cut before it fought a wide seam, because each one asked what narrow
interface a free FUNCTION would need. Behaviour about a whole ship has no narrow
interface, and a collaborator that HAS the ship needs one handle.

**HE ALSO ASKED WHETHER THE PATTERN HELPS ELSEWHERE**, and that question is open.
It needs a measurement rather than a count.

**THE DEBT LIST IS EMPTY.** `npm run sizes` reads 0 known debts. No earlier run
of it read zero.

**181 came from Chris on 2026-08-17.** He asked to work on `src/game/npc.ts`,
the tree's one recorded debt. Four candidates were measured, and not one of them
has a reader behind it. He chose to take the size cut anyway. It landed the same
day, and it is below.

**180 came from Chris on 2026-08-17.** He read 179's outcome and asked whether
the magic values should be constants. A measurement answered that for one of
three kinds, and he chose the scope: the thirteen rule thresholds, plus a gate.
It landed the same day, and it is below.

**179 came from Chris on 2026-08-17**, when he asked for the next job. It is
docs/TODO/176 M2's own debt. That move repaired the file it emptied. It repaired
none of the five files that point at the code it moved. It landed the same day,
and it is below.

**178 came from Chris on 2026-08-17**, when he asked for the next fix. It came
out of a reading of `test/campaign.ts`. docs/TODO/176 M3 named that file on a
line count, and the line count was not the defect. It landed the same day, and
it is below.

**177 came from Chris on 2026-08-17**, when he asked for the next smell.
docs/TODO/176's own conclusion rested on a bad count, and he found it. It was a
reading of one test file rather than a sweep, and he declined the sweep. It
landed the same day, and it is below.

**All three items before it came from Chris on 2026-08-17**, after 173 landed and left the
queue empty. The order was by value over cost, and not by severity. **174, 176
and 175 all landed the same day**, and each is below.

**175 went last because half of it waited on Chris.** Its M3 held two open
questions that only he could answer. He answered one and a measurement answered
the other, so M3 landed no code at all.

**173 came out of the GitHub inbox, and the queue was empty when it arrived.**
The sweep of 2026-08-16 put five items in the queue. Chris asked for an
architectural and bug sweep against a tree where `npm run check` passed. The
order was by value over cost, and not by severity. All five landed, and 169 was
the last of them on 2026-08-17.

**172, 170, 171 and 168 led this queue and all four landed the same day.** They
are below.

**171 and 168 were adjacent and were not the same item.** 171 was the player's
vocabulary on the player's pages. 168 is the house prose style over `docs/`.
Neither one answers the other.

**THE GITHUB INBOX IS EMPTY.** **#35** closed on 2026-08-17 with
[173](completed/173-the-burst-carries-on-from-the-pirate-into-the-police-ship.md).

**#36 closed on 2026-08-16, and A STALE PERMALINK IS THE WHOLE STORY.** Chris
read `const NAME_COST = ... ' AND YOUR NAME'` at `src/game/prompts.ts:90`. That
link pins commit `bff0018` of 2026-08-15, and docs/TODO/162 M1 landed the next
day. On `main` the line is `REPUTATION_COST`. A permalink names a commit, so it
never moves.

**The first close of #36 was wrong for a different reason, and the record keeps
it.** The triage answered the shipped game rather than the report, and closed on
that reading instead of asking which one Chris meant.

**The stale link still found a real gap**, and it is docs/TODO/171, which landed
the same day. Looking for the reported line is what showed that
`test/ladder-words.test.ts` stripped every comment before it read.

**164, 163, 167 and 165 landed on 2026-08-16 and are below.** They were the
first four items of the sweep's queue. Each of the four was one thing written
down once and never checked again: a path, a lookup, a paragraph, and a number.
**165 also landed docs/TODO/81**, which it found deleted rather than archived.

**154 landed on 2026-08-16 and is below.** It was the last item in the queue,
and the largest of the four that came out of the 2026-08-14 review. Its own
M3 sweep ran to twenty-nine passes.

**162 landed on 2026-08-16 and is below.** It came out of the triage of GitHub
#33 the same day, and Chris re-cut it twice while it ran.

**161 landed on 2026-08-16 and is below.** It came out of 160, on Chris's call:
*"We should migrate snapshot v2 to v3."*

**154 waited twice, and the precedent was Chris's.** It was parked on
2026-08-15, and five items went in front of it (Chris): *"I want to park that
for a while and pick up the GitHub issues."* All five landed the same day and
are below. A sweep waits. 154 then ran to the end on 2026-08-16.

**158, 159 and 160 came out of the triage of GitHub #30, #31 and #32 on
2026-08-15.** Two of the three share one root, and the triage found it rather
than the reports: **the idle waypoint is anchored to the station.** The last
branch of `NpcShip.update` draws a waypoint 800 to 3,300 units from the station,
for every role except the trader. So a system's ships converge on the port. That
is why a bounty hunter is on the doorstep (#30) and why deep space holds nobody
(#31). **All three landed the same day** and are below. **160 is independent**
of the other two, and adds the second way a legal record can come down.

**151 to 154 came out of one review, on Chris's question of 2026-08-14:** *"Are
they in ASD-STE100 and are they useful — we don't need comments that contain the
whole history of the project. Comments should help explain the code."* The
review measured `game.ts`, and then the tree. **The comments are not
restatement** — one bare restatement exists in 2,020 lines — so none of the four
items cuts prose to make a file shorter. Each answers a different fault. **151, 152
and 153 landed on 2026-08-14** and are below.

**153 landed first, and 154 is what is left of the review.** 153 blocked it so a
paragraph would be moved once and rewritten once. In the event nothing moved:
the nine rule paragraphs it examined were duplicates of what the rules module
already said, and each became a pointer. So 154 rewrites prose that is now in
its final home.

**154 was the largest, and the incremental rule is what made it necessary.**
`CLAUDE.md` asked each edit to convert the comment it touches. Measured, that
did not happen. `src/constants/`, which 141 swept in one pass, had 3% of its
sentences over the cap. The rest of `src/` had 13%, and the three files
150 wrote that month reached 14%. A sweep converts a surface; an intention does
not. **`npm run ste:check` now holds it**, so the rule has a measurement and a
gate rather than an intention.

**The decomposition programme is finished, and `src/game/game.ts` states one
responsibility:** *the orchestrator — which mode the game is in, and who gets
the frame.* It went 2,528 → 1,233 lines across 150 and 155, into nine children.
`tools/sizes.mjs` no longer records it as a debt, and no longer states a line
target — that was Chris's call on 2026-08-14: *"we should not obsess over the
300 lines. What we are looking for is a clean architecture."*

The GitHub inbox holds no open item, and the queue section above says so.
**#34** closed on 2026-08-16 with
[170](completed/170-the-rocks-are-all-at-the-station.md). **#37** closed the
same day with
[172](completed/172-an-empty-console-line-still-draws-its-box.md). **#33**
closed on
2026-08-16 with
[162](completed/162-one-word-that-means-five-things.md). **#32**, **#31** and
**#30** closed on
2026-08-15 with [160](completed/160-a-record-you-cannot-work-off.md),
[159](completed/159-the-lane-that-only-exists-at-the-station.md) and
[158](completed/158-the-safe-zone-that-only-the-spawner-obeys.md). **#29** and
**#28** closed on 2026-08-15
with [157](completed/157-the-console-line-runs-off-both-edges.md) and
[156](completed/156-the-escape-capsule-nobody-chose-to-shoot.md). **#27** closed
on 2026-08-13 with
[144](completed/144-a-standing-order-has-nowhere-to-live.md). **#26** closed on
2026-08-13 with
[143](completed/143-the-counter-never-says-which-tonnes-a-contract-claims.md).
**#25** closed the same day with
[142](completed/142-every-explosion-is-in-the-cockpit.md), after Chris flew it on
headphones. **#24** closed on 2026-08-12 with
[140](completed/140-the-day-is-the-one-cost-nothing-shows.md), after Chris flew
it: *"display is good"*. **#23** closed with 134, as #22 did with 127, #18 with
121, #20 with 122 and #21 with 123.

## Closed decisions — do not reopen these

**This section is the one home of a question that Chris answered and shut.** A
closed decision is not a queue item, and it is not a record of what landed
either. Read it before you re-derive one of them.

**The docking computer stays as it is. Chris, 2026-08-17:** *"Docking computer -
leave it as is - it works."* The open question was whether it should avoid
traffic at all. `npm run dock-traffic` measured what that costs, and the answer
got cheaper. It was one non-fatal collision in eighty approaches. Since 136 gave
every ship the same path it is **none in eighty**. docs/TODO/135 argued against
building avoidance for that, and this closes it. 136 M4 names the place the work
belongs. **Do not re-open it on a line count or a tidy-up.**

**A ship you shot at never forgets. Chris, 2026-08-17.** He read
docs/TODO/175 M1's numbers and chose to leave the rule as it is, over a
break-off timer and over a plain one. `provokedByPlayer` is a latch with no way
down. **Three exits already work**: she outruns the ship, she bribes one ship
out of one fight, or she docks. **docs/TODO/175 M2 landed the console line that
says so**, and that line is the whole fix. **Do not re-open it on the grounds
that a consequence needs a way out.**

**A paid fine will never call a ship off, and the reason is a measurement.**
`payFine` is bound in the DOCKED table alone. `Station.dock` clears every NPC
with no condition on it. So the exit would be dead code, and docs/TODO/175 built
its case around a key it never checked was reachable.

**A version 1 save stays refused. Chris, 2026-08-17:** *"Version 1 save/load -
not important."* docs/TODO/161 raised a version 2 snapshot to version 3 and left
version 1 refused, and it held the argument both ways. The step would be one
entry in the same `MIGRATIONS` table. **It is not worth writing, and a future
reader should not read that table's shape as an invitation.**

## What landed on 2026-08-17

**184 — the roles that fight get their own behaviour.** The last cut of the
programme. `game/npc-fighter.ts` holds the pirate, the police, the bounty
hunter, the Thargoid and its drone, which ask three questions in one order.
`game/npc-trader.ts` holds the trader's two lives.

**`update` IS 37 LINES, AND IT DECIDES NO FLIGHT.** It went 146 to 37. It reads
no distance, and it spends `approach` zero times, from eight before 183.

**M2 FOUND A DEFECT THAT M1 SHIPPED, AND THAT IS THE ITEM'S REAL RESULT.**
M1 gave every fighting role a behaviour, and it left the dispatch ahead of the
`inert` check. A drone whose mothership died then flew the fighter's amble
rather than tumbling. Measured at 2.89 units of drift in one frame.

**NINE PROBES AND THE CAMPAIGN STAYED BYTE-IDENTICAL THROUGH M1**, because no
probe kills a Thargoid mothership. The evidence the plan chose could not see it.
Only a fixture that drives a real ship says so, and one does now.

**183 — a pilot flies a ship.** The gate on the rest of docs/TODO/182's
programme. Three of `update`'s branches call a flight model, so nothing else
could leave until the flight models were objects.

**The union of the three pilots is 13 context members.** That is one interface
for 286 lines, against the eighteen handles a free function per model would
want.

**`npc.ts` went 1,292 lines to 945** across two milestones.

**THE `Pilot` INTERFACE IS NEVER DECLARED, AND M2 ANSWERS WHY WITH ALL THREE IN
VIEW.** A common `fly(ship, dt, target)` needs one target object that every
pilot then reads fields of that mean nothing to it. **The context is the seam,
and not a common method.**

**One pilot is an object anyway, and not for polymorphism.** `PursuitPilot`
holds two fields that are not in `NpcState`.

**M3 REFUSED.** `chooseWeapon` is the ship arbitrating between its own pilots,
and a fourth pilot file would make it a peer of the two it arbitrates between.

**Six probes and the campaign byte-identical at both sizes, at every
milestone.** 4,895 assertions.

**182 — a ship holds the behaviour its role flies.** Chris read `npc.ts`, named
three responsibilities, and then named the cause: the project never used a good
OO approach.

**THAT EXPLAINS WHY EVERY EARLIER CUT FOUGHT A WIDE SEAM.** Each one asked what
narrow interface a free FUNCTION would need. Behaviour about a whole ship has
none. A collaborator that HAS the ship needs one handle.

**The vocabulary was already in the tree.** `brain-names.ts` opens *"Which named
pilot flies"*. So the end state is a ship, a behaviour per role, and a pilot per
flight model.

**124 of `update`'s 157 lines are per-role behaviour**, and 33 are the
orchestration.

**AN EARLIER ORDERING WAS WRONG AND THE PLAN SAYS SO.** It put the armed
trader's defence first, and 36 of its 57 lines call a pilot.

**M1 landed the seam and the roles that never fight.** The file did not shrink,
and that is the right result: this milestone buys the architecture rather than
the lines.

**THE CONSTANTS GATE FIRED AND IT WAS RIGHT TO.** Four tumble rates were bare
literals inside `update` and invisible to every scan. Naming them made them
visible. 4,873 assertions.

**181 — the saved shape of a ship leaves the ship.** Chris asked to work on
`src/game/npc.ts`, the tree's one recorded debt.

**Four candidates were measured, and not one has a reader behind it.** `update`
IS the file's stated responsibility. `brainFly`, `attack` and `pursue` are
decision loops behind a 69-call seam. The constructor writes 17 members.
`NpcState` had exactly one importer outside the file.

**Chris read that and chose the size cut anyway.** `game/npc-state.ts` is 262
lines, and `npc.ts` went 1,468 to 1,270.

**`FireEvent` and `WorldView` stayed.** Each names `NpcShip`, so moving either
would make a child import its parent.

**THE SEEDED STREAM DID NOT MOVE, AND THAT WAS THE RISK.** Four probes are
byte-identical, and the campaign is byte-identical at both sizes.

**THE FACTORY DRAWS THREE VALUES, NOT TWO.** The first draft of that claim said
two and failed. `randomDirection` spends two draws inside one call.

**A second claim was dropped for being a weaker copy.** `test/snapshot.test.ts`
already drives a real flown ship through the whole walk.

**M2 RETIRED THE DEBT PREFIX, AND THE DEBT LIST IS EMPTY.** The row states the
four refusals with their numbers, and what would re-open it: a new measurement,
and never a line count. 4,858 assertions.

**180 — thirteen game rules have no name.** Chris asked whether the magic values
should be constants. A measurement answered it for one of three kinds.

**`src/` holds 769 non-trivial bare literals, and almost none should move.**
About 200 are tuning coefficients inside one fitted curve, where a name lies
about how independent the number is. About 400 are data tables and cosmetics.

**24 are comparison thresholds, and 13 of those are game rules with no name.**
Two values meant two things each, so each pair took a distinct `@rule` id.

**The existing programme could not see any of it.** `test/constants.test.ts`
scans for a declaration, and says so on purpose.

**No value moved.** Three probes are byte-identical, and the campaign is
byte-identical at both sizes.

**THE CHECKER ASKED FOR SEVENTEEN MORE `@rule` IDS.** Every one of the thirteen
collided with a value already in the tree. The tree went 87 rule ids to 114.

**A NAME WAS WRONG AND READING THE CODE FIXED IT.** The 4,500 was `MARKER_RANGE`
in the plan, and its site writes the ship-ID line. It is `SHIP_ID_RANGE`.

**The hermit's line said SLOW TO 20 beside a rule of 40.** It interpolates its
own rule now, and a player can check neither number, because `hud.ts` paints
speed as a bar.

**THE GATE'S FIRST DRAFT WENT GREEN BY READING NOTHING, AND THE CONTROL CAUGHT
IT.** A trailing comment holding one backtick unbalanced a regular expression,
which swallowed the `i < 256` the gate exists to see. It walks characters now.
4,849 assertions.

**179 — a move repairs one file and leaves its neighbours stale.** It is
docs/TODO/176 M2's own debt. That move repaired the file it emptied and the map,
which is what `CLAUDE.md` asks for.

**It repaired none of the files that point at the code it moved.** Five comments
still named `game/npc.ts`, and one of them named `updateTrader`, which the move
deleted.

**`npm run claims:check` cannot see any of it.** It reads one comment form, and
every site is prose.

**A departure distance also had two homes.** `DEEP_TRADER_RUN` is 30,000, and
`game/trader-flight.ts` wrote the same rule as a bare literal. Both feed the same
phase and the same despawn.

**THE MEASUREMENT IS THE OTHER RESULT, AND IT SAYS DO NOT BUILD THE GATE.** 92
of 132 distinct constant values appear as a bare literal somewhere in `src/`,
almost all by coincidence. A checker at that precision reports 92 findings and
gets switched off.

**The signal was one hit in the noise**, found by reading each candidate's
meaning rather than its value. Nothing moved: 4,845 assertions, and the campaign
is byte-identical.

**178 — the campaign simulator keeps its own copy of a purchase.** An equipment
purchase had two homes. `screens/trade.ts` applied one in eighteen cases, and
`test/campaign.ts` applied one in sixteen.

**Invariant 10 forbids exactly that.** An economic rule lives in a module the
headless campaign shares, and a purchase moves credits.

**The copy hardcoded three constants the real game reads.** The missile cap, and
both laser refunds. All three agreed on the day, so it was latent rather than
live.

**NOTHING GUARDED IT.** `test/constants.test.ts` is the gate for a constant with
a second home, and its scan root is `../src/`.

**`applyPurchase` is `shop.ts`'s now**, beside the `equipmentOwned` that reads
the same flags back. The campaign prints exactly what it printed before, at both
sizes.

**THE SCREEN NOW IMPORTS NO ECONOMIC CONSTANT AT ALL, AND THE PLAN DID NOT HAVE
THAT.** Four went with the rule, and `tsc` found them unused. A screen that held
a price list was the shape of the defect.

**The gate the plan asked for already existed**, and it could never reach the
campaign. So the fix's real value is that an existing gate now guards a second
caller.

**THE PLAN'S SECOND BREAK-IT COULD NOT FAIL, AND THAT IS A FINDING.** The
literal it asked for is 4,000, and the constant is 4,000. Nothing in the tree
catches an inline literal that happens to be right today. 4,845 assertions.

**177 — a test compares the player's gun against a copy of itself.**
`test/world-step.test.ts` held 116 lines that never stepped the world. Six of
its seven sections did.

**Four assertions compared `game/combat-player.ts` against a line-for-line
transcription of it**, written in the test file.

**The second party no longer existed.** Measured, the only caller of
`Combat.fire` and `Combat.hitPlayer` in `src/` is `combat-player.ts` itself. So
the check could never report that anything was wrong. It could only demand that
two copies agree.

**A neighbour already stated the critique.** `test/fire-resolution.test.ts`'s
header says a test that drove the shared function twice would agree with itself.
That file holds no overlapping claim.

**Chris chose to delete the four copies and keep the four behaviour claims.**
`test/combat-player.test.ts` is 5 assertions in two blocks.

**THE COUNT FELL BY THREE RATHER THAN FOUR, AND THE PLAN DID NOT HAVE THE
REASON.** The fifth assertion is a control the plan never listed. Without it a
resolver that always picked the aft face would pass the astern claim.

**The plan predicted two reds for one break and got one.** The no-mount refusal
reads the view argument rather than the direction.

**A SECOND STALE CLAIM CAME OUT OF IT, AND IT WAS docs/TODO/176 M3's.** That
milestone named the save block as the one section that could leave. It read the
section headings and inferred, which is the method that broke M4's reader count
at the same site. 4,842 assertions.

**175 — the law reads your record and never reads the grudge.** Two ships attack
a commander for two different reasons, and the game only ever explained one of
them. The record is `lawTakesInterest`. The grudge is `provokedByPlayer`, and it
is personal to one ship.

**M1 flew the real game under node and measured four things.** The flag never
ends. It still holds after 300 seconds, and the ship is alive and still in the
fleet. A record forced back to Clean does not clear it either.

**But she outruns it.** At full throttle the range opens from 767 units to
112,065 over those same 300 seconds.

**The truce does not cover a provoked ship**, which is docs/TODO/158's decision
at work. The measurement uses hunters, because `truceHolds` covers pirates and
hunters alone. The unprovoked control flips at exactly `STATION_TRUCE`.

**THE PLAN'S SHARP EDGE IS FALSE, AND THE PLAN CONTRADICTED ITSELF.** It listed
the dock as an exit four paragraphs before it built a case around `payFine`.
`Station.dock` calls `world.clearNpcs()` with no condition on it.

**One stray shot near the station buys two to three enemies.** Over 40 seeds the
launch adds 1.48 Vipers on average, and 2.48 ships carry the grudge.

**M2 is a second line, and `recordVerdict` is untouched.** `grudgeRolesNear`
sweeps `isHostileToPlayer` rather than the flag, and it drops every role the
record already explains.

**THE CLAUSE TOOK THREE TRIES, AND A GATE COULD ONLY CATCH THE FIRST.** It read
`YOUR RECORD WILL NOT CALL THEM OFF`, and `test/ladder-words.test.ts` failed the
word `record` (docs/TODO/162). The second try passed every gate and still told a
player nothing. Chris, 2026-08-17: *"this is just gibberish for a player - they
won't understand what you are talking about"*. The shipped clause states the
motive rather than the mechanic: `— THIS IS PERSONAL`.

**A Fugitive hears nothing, and the break-it showed why that matters.** With the
drop removed, two assertions in `test/record-line.test.ts` went red as well. A
fourth line in one burst pushed the reputation line out of the window.

**M3 landed nothing, on Chris's call.** He took the plan's third answer. The
first open question never reached him, because a measurement answered it. 4,845
assertions.

**176 — the largest files need a measurement before a cut.** Chris named the
programme: *"we should pick up the large files and start breaking them down."*
`npm run sizes` read 30 files over 400 lines. One was a recorded debt, and the
other nine each argue they are one file.

**M1 measured the two members docs/TODO/169 M4 named, and they answer
differently.** `update` is 154 lines and reaches `this.*` 81 times over 21
members. It is also the file's stated responsibility, so a caller needs the
whole ship. `updateTrader` is 73 lines and 44 reaches over 7 members, and four
handles answer all of them.

**THE PLAN DID NOT HAVE THE STRONGEST ARGUMENT.** `tmpMat` and `tmpQ` are read
at three lines of the whole file, and all three are inside that one member. The
header claims nine scratch vectors for the allocation rule. The seam is 0.60
reaches per line of subject, against the 3.3 that 169 M3 refused.

**M2 took it, and `game/trader-flight.ts` is 176 lines against 1,468 left
behind.** `stepTrader` takes two narrow interfaces rather than the class, so
`NpcShip` and `WorldView` satisfy them with no cast.

**Two private fields became public, and the plan did not have that.** A
TypeScript class with a `private` member cannot satisfy a structural interface
that names it. So `maxSpeed` and `turnRate` join `accel` and `radius`.

**`approach` moved to `game/flight-maths.ts`**, because four of its eight call
sites went with the trader. **docs/TODO/174 M2 took that export off, under a
rule that now points the other way.** A reader exists now.

**A SECOND STALE CLAIM CAME OUT OF IT.** `flight-maths.ts` named the five files
that keep their own `ZERO`, and `player.ts` holds none.

**All seven probes are byte-identical to the M1 commit.** `dock-traffic` and
`dock-probe` joined the set, because none of 169's five flies a trader.

**M3 rechecked the nine stated reasons, and one is false.**
`test/world-step.test.ts`'s row said it holds the step's five phases in the order
they run. `world-step.ts` does hold five. The test file holds six sections by
SUBJECT, and the last of them is the save.

**`game/combat-sim.ts` carried a number beside the sentence that retired it.** It
claimed 42% safety prose, next to a clause saying the argument moved out.
Measured, 356 of 934 lines are a comment of any kind, and 9 name safety.

**THE ROW LENGTH PREDICTS THE ROW QUALITY.** The nine ran 68 to 1,861
characters. Not one of the four shortest is clean. Every one of the five longest
states a reason that holds.

**M4 gave the combat trainer a section in `docs/ARCHITECTURE.md`**, and
`npm run map:report` went 28 of 56 modules unnamed to 21 of 56. **The plan
counted seven modules and there are ten**, because the three it missed are each
under 200 lines.

**The item stops there, on 150 M6's and 169 M4's precedent.** Three candidates
are named and none is taken. `combat-sim-report.ts`'s report shape is the
strongest: 30 files import it, 13 reach for a type alone, and 8 of the 13 are in
`src/`.

> **Correction, 2026-08-17.** That count is wrong and the candidate is
> withdrawn. Chris asked why everyone would need something from a training
> report. **They do not.** There are 23 real importers, because three of the
> thirty were the file name in a comment. Ten are in `src/`, and **seven of the
> ten are the trainer itself**. The other three hand the report between the
> exercise and the screen. **A count of files is not a measurement of
> coupling**, and M4 never asked what one importer takes. 4,818 assertions.

**174 — the record holds five defects that nothing schedules.** Five landed
items each reported a defect and each declined to fix it. Every one of the five
was the right call at the time. Nothing scheduled the second pass, so Chris
asked for all five.

**Four were real. The fifth does not exist, and the measurement is written
down.**

**The novella line moved, and the plan's number is stale.** It is line 315
rather than 313. The paragraph opens *"Commanders of established reputation"*
and then said *"attempts on your name"*, so it contradicted itself across one
clause. One word changed, and the page keeps Chris's voice.

**`HERMIT_SCATTER`'s comment claimed 2.5x and the measure is 2.8.** It also
names `ASTEROID_SCATTER` now, which the plan did not ask for. docs/TODO/170 gave
an arrival a second rock anchor, so *"the asteroid field"* had two readings. The
hermit and `ASTEROID_SCATTER` both anchor to the station.

**docs/TODO/81's UNMEASURED CLAIM HOLDS, AND THE MEASUREMENT IS THE MILESTONE.**
No live caller of `brainName` can pass a sentinel. `screens-trainer.ts` prints a
field that `defenceBrainNameFor` sets. `combat-sim-setup.ts` prints a row that
walks `PIRATE_CHOICES`. Each of those yields a `BrainName`, and the draft that
holds the second is never saved.

**So the three members are gone and `brainName` is one lookup.** `approach` lost
its `export` and gained the doc comment it never had.

**A THIRD STALE CLAIM CAME OUT OF IT, AND THE PLAN DID NOT HAVE IT.** `BRAINS`'s
doc comment said the two pickers offer one sentinel each, and that their lines
live in `screens/combat-sim-notes.ts`. Both halves are false. `brainNote` reads
`brainCharacter` alone, so a sentinel had no line there at all.

**`test/deleted-members.test.ts` is 10 assertions in two scans, and each scan
carries a control.** Proved able to fail twice, and each one alone. The
allowlist scan went 233 constants outside the home to 230, which is exactly the
number deleted.

**THE HINT DOES NOT OVERFLOW, AND THE RULE STAYS.** `#screen .hints span` was
measured in Chrome at viewports of 1289, 760 and 500 pixels. `#screen` sets
`min-width: 640px`, so the container is 578 pixels at a floor rather than at a
reading. The longest hint in the tree is 319 pixels, which is 55% of it.

**#29's geometry is absent.** `#message` held one whole sentence in one `nowrap`
element, centred on `left: 50%`, with no width floor. A hint is a short item,
and `.hints` wraps normally between items.

**At 500 pixels the PANEL hangs off both edges, and every row goes with it.**
That is `min-width: 640px`. It is reported and not scheduled.

**THE MEASUREMENT FOUND THE OPPOSITE DEFECT.** The station menu's own key line
is a bare `.keyline` with no spans and no `nowrap`. It breaks
`S COMMANDER FILE` across two lines, which is the ugliness this rule prevents.
**It is reported rather than fixed**, because a sixth defect inside a milestone
is how the first five got lost.

**Two of the four fixes have no gate, and the outcome says so.** The novella has
none. The `style.css` comment has none, because `tools/ste.mjs` walks `.ts`,
`.js` and `.mjs` alone. 4,799 assertions.

**173 — the burst carries on from the pirate into the police ship.** Chris flew
it and reported two sentences: *"I was attacked by a pirate and a police ship
was there. I destroyed the pirate and the police started attacking me."*

**THE INVESTIGATION RAN BEFORE THE PLAN.** GitHub #35 was `needs
investigation`, and the triage of 2026-08-16 named two candidate routes and
measured neither. A throwaway probe flew the real game under node.

**Route 1 is the live route, and the burst is what walks it.** A pirate 500
units off the nose died at frame 525 of a held burst. The beam reached the Viper
1,400 units directly behind it at frame 540. Fifteen frames is 0.25 seconds,
which is one pulse-laser cooldown.

**Nothing stands between the beam and what was behind the target.** `traceShot`
skips a dead ship at once, and `Combat.wreck` despawns the hull in the frame it
dies. **Route 2 needs no work.** Route 1 moves the record first, and only then does
the station fleet launch. It also announces itself.

**The console could say NOTHING AT ALL.** `raiseLegal` speaks only when the
record MOVES, and `callStationDefence` latches after the first launch. So an
Offender near a station whose fleet was already out read nothing. The one line
that did appear named the wrong pursuer.

**M1 gave the console the line it never had.** `harmVerdict` is the rule and
`HARM_LINES` is the vocabulary. The covered role set comes from `offenceFor`,
which is `recordVerdict`'s own shape. The trigger is the `provokedByPlayer`
latch, so the line is said once per ship and needed no new state.

**A hit that DESTROYS the ship says nothing, and the plan did not have that.** A
dead ship comes for nobody.

**M2 gives the fireball the rest of the burst.** For `WRECK_BURST_GRACE` seconds
after her own kill, the commander's beam registers nothing on a bystander.
`inTheFireball` turns the hit into a MISS before anything reads it.

**THE NUMBER IS DERIVED, AND THE PLAN'S PREDICTION WAS WRONG.** Over 593 seeded
kills with the grace off, 12 melees turned a Viper hostile. Eleven came AFTER
the kill, every one between 0.25 and 1.00 seconds of it. The twelfth came before
it. The span leaves 1 of 593, 1 of 200 and 1 of 40, and that one is the twelfth.
The plan promised 0 of 200. **A span cannot do better than the trigger release
it bets on.**

**THE STATION TRUCE WIDENS THE COVER, AND THE PLAN DID NOT HAVE IT.** Inside
`STATION_TRUCE` an unprovoked pirate is not hostile, so it is a bystander too.
Out at the witchpoint a queue of pirates costs nothing at all. The second of two
died 4.38 seconds after the first, with the span off and on alike.

**A shipped fixture caught it.** `test/snapshot-migrate.test.ts` kills five
pirates half a second apart, and two were absorbed. Its fixture paces past the
grace now. The rule that block pins is that five kills take a rung.

**`combat.ts` crossed 400 lines, and an exemption was the dishonest answer.**
`destroy` and `wreck` are `combat-wreck.ts` now, at 155 lines against 343 left
behind. Ten unrelated constants also gained `@rule` ids, which is
docs/TODO/160's situation again.

**THE BREAK-IT STEP FOUND A VACUOUS CLAIM.** The held-burst loop first took its
length from the span, so at a span of zero it fired no shots and passed. It
holds half a second by hand now.

**`survivability` and `aim-probe` are byte-identical.** **`defence-probe` is NOT
evidence, and the plan was wrong to name it.** It loads no trained weights and
cannot fly the shipped defence. 4,790 assertions.

**169 — npc.ts holds behaviour and brain flight in one file.** The head of the
decomposition programme, and the backlog's own number 1. The file was 1,632
lines over 99 commits. It was also the one file of 259 in `src/` with no module
header at all.

**THE DEBT ROW WAS WRONG ABOUT THE SPLIT, AND SO WAS THE PLAN.**
`tools/sizes.mjs` named the flight half for months. The plan measured four
candidates and predicted that the row was wrong. It was right about that, and
wrong about its own favourite twice over.

**M1 wrote the header first and landed it alone.** The backlog's argument is
that the act of stating the one responsibility is what exposes the second. A
header written after a split is a header written to fit a decision already made.

**M2 took the fleet queries, which the debt row never named.**
`isHostileToPlayer`, `hostilesNear`, `nearestEngaging` and `nearestNpc` are
`game/hostility.ts` now, at 169 lines. The rule that six surfaces read
(docs/TODO/158) sat inside a class file until this item.

**They take a narrow interface rather than the class.** `FleetShip` is a
position and `alive`. `HostileShip` adds a role and three flags. A generic type
parameter is what the plan did not have. The two sweeps return the caller's own
type, so no call site needed a cast.

**`test/hostility.test.ts` is 13 assertions in two parts.** A source scan holds
that the file names no ship class. A control proves the scan can see one. Then a
fixture of one object literal drives all four functions, because a scan cannot
say whether a type is honestly narrow.

**M3 REFUSED THE SPLIT THE ROW NAMED, ON A MEASUREMENT.** The flight half is 158
lines of body, and `brainFly` is 101 of them. `brainFly`, `attack` and `pursue`
each steer, throttle, advance and pull a trigger. Each returns a `FireEvent`. So
they are decision loops rather than steering primitives, and the plan files two
of the three under behaviour.

**The true primitives are 21 lines, and the seam would be 69 calls wide.** The
behaviour half reaches the transform, the flight stats and the nine scratch
vectors 69 times. Both of the plan's shapes fail on that one fact, so M2's
interface answer decided nothing here.

**What did leave is the shared maths.** `steerQuatToward` and `velocityOf` are
`game/flight-maths.ts`. Five files outside the ships read them, and three of
those imported a class file of 1,566 lines to reach a helper of four.

**`test/constants.test.ts` caught that move in both directions**, and
docs/TODO/90's recorded rule chose the fix. A `THREE.Vector3` is mutable, so
each file keeps its own `ZERO`. The first draft shared one.

**M4 measured again and stopped**, on docs/TODO/150 M6's precedent. `NpcState`
is the one candidate left, and the recommendation is to leave it. Most of its
184 lines are the doc comment beside each field.

**The two biggest members left are on no candidate list.** `update` is 154 lines
of body and `updateTrader` is 73. Each needs a measurement before it gets a plan.

**Two stale claims came out of the work.** `law.ts` named `npc.ts` twice for a
rule that moved. And `approach` is exported with no reader outside its own file,
which is reported rather than changed.

**All five probes are byte-identical to the M1 baseline, at every milestone.**
The item had no licence to move a rule, and it moved none. 4,752 assertions.

## What landed on 2026-08-16

**168 — the style checker never reads the documents.** `npm run ste:check` read
every comment in `src/` and no document at all. The house style also covers ten
markdown documents and each TODO item, and a markdown file holds no comment.

**The number came after the reader, and the plan was right to insist.** The
trial reader's figure is not in this record, because it counted a whole list as
one 43-word breach. **The real measurement is 174 sentences over the cap and 35
in a compound tense, of 2,559. It is 0 and 0 now, of 2,905.**

**The ten documents held 48 of those breaches, and the index held 150.** 144 of
the index's 150 were in the dated sections, which report what landed.

**CHRIS ANSWERED TWO SCOPE QUESTIONS, AND THE MEASUREMENT IS WHAT ASKED THEM.**
A section heading keeps the caps and loses the title rules. 73 of the 88
headings in the ten documents carry no verb, and `docs/PROCESS.md` mandates a
plan shape whose own section names are noun phrases. And the gate reads the
whole index, so 144 record sentences were rewritten.

**`tools/titles.mjs` landed before this item ran**, and it is what the plan's
title count and title rules asked for. It reads 315 plan titles and index
labels. So M3 added no second home for that rule.

**A BLOCK QUOTATION IS READ, AND THE PLAN SAID TO DROP IT.** Its reason was that
this repository quotes a person in a block. Measured, that is false:
`docs/PROCESS.md` holds no block quotation at all, and its four quotations of
Chris are inline. The 95 block lines are house prose, and a dropped block would
take all of them out of the gate's reach.

**Two reader defects came out of the measurement.** A hash opens a sentence, so
one paragraph of this index read as one sentence of 112 words rather than
sixteen. And a quotation of a whole sentence carries its full stop INSIDE the
quotation marks. So the mask took the terminator away, and joined the sentence
after it.

**One false claim came out of the sweep**, which is 154's finding again.
`docs/COMBAT-SIM.md` said the machinery for a live career selection exists in
`brain-names.ts`, and it named `liveBrainSelection` and `liveBrainId`.
docs/TODO/81 deleted all four members the same day.

**Proved able to fail five ways, and each one alone.** A long instruction and a
compound tense each redden the gate. The same long sentence stays GREEN inside a
fenced code block, and green in a table row. A document named in `DOCUMENTS`
that is not there reports the name and exits 1.

**171 — the briefing says reputation when it means rating.** GitHub #36 reported
a string that docs/TODO/162 fixed a day earlier, and a commit permalink is why it
looked live. The triage then measured the tree and found something else.

**docs/TODO/162's gate read about a third of what a player reads.** It read a
shouted string, in TypeScript, under two directories. It stripped every comment
before it read, and it saw no mixed-case page at all.

**There are three rules over three surfaces now, and each one fails on its
own.** The shouted rule is unchanged. The second reads every mixed-case sentence
a player reads. The third reads every comment in `src/`.

**The prose rule is two tests, and neither one bans the word.** `reputation` is
the right word for the disrepute ladder. So the tests are what is true of that
ladder: it is never negated, because Honest is its BEST rung, and it is never
plural. The novella's *"Commanders of established reputation"* passes, and it is
correct.

**The comment rule reads the ladder word beside `name`, and a paragraph is the
unit.** The word and the ladder are often two sentences apart. `name` is wrong
only where the comment never says WHAT is named, and the failure message asks
for exactly that.

**THE GATE FOUND TWENTY SITES, AND THE PLAN NAMED SIX.** Seven of the extra
fourteen are the same defect at another site, and one of those is the second
PUBLISHED one. **`game/commander.ts` is the mirror fault, and no rule in the
plan covered it.** It called `combatScore` a *"Combat reputation"*. Since
docs/TODO/162 that is the other ladder's word.

**Six sites were correct and are still repaired.** Each said `name` without ever
saying what is named, in a paragraph about a ladder. `the name rules` is `the
save name rules`. Each repair is one word, and each sentence says more than it
did. A file exemption was the other remedy. It blinds the gate to a whole file,
so the repair is the better answer.

**Chris chose all three sentences on the pages.** The briefing says *"a rating
of Harmless"*, and the manual says *"no rating whatsoever"* and *"danger builds
along lawless routes"*. He also read the credits figure in the proposal: the
briefing renders `STARTING_CREDITS / 10`, which is 100, and nothing there is
wrong.

**`tools/ste-read.d.mts` is what the plan did not have.** `tools/` is plain
JavaScript and `tsconfig.json` sets no `allowJs`, so a TypeScript file could not
import the reader at all. The declaration file is why the comment axis reuses
`tools/ste-read.mjs` rather than writing a second character walker.

**The milestones landed in the order M3, M2, M1, and that is a deviation.** M1
first is right, and it was written first: it found the full list before any
commit. The COMMIT order is chosen so that every commit passes `npm run check`,
because a gate cannot land red.

**Each rule reports what it read**: 815 shouted strings, 703 player sentences
over 7 pages, and 7,179 comment paragraphs. **Proved able to fail six ways, each
alone.** The page walk pointed at a directory with no pages leaves the rule
green and reddens its control, which is the reason the control exists.

**One thing is reported and not fixed.** `novella.html:313` says *"attempts on
your name"* and means the disrepute ladder. No rule reads `name` on a page,
because the plan scoped the prose axis to `reputation`.

**170 — the rocks are all at the station.** Chris flew it and reported one
thing: *"There always seem to be some asteroids near the space station. I think
they should be spread along the path."*

**The report was exact, and the placement was by construction.** The rock loop
anchored every rock to the station, on an arrival and on a launch alike. So the
run in from the witchpoint held no scenery at all.

**The file already held the answer.** `corridorPos` sat ten lines above the
loop, and the traders, the police and the pirates all used it. The rocks were
the one thing that never asked. They read the situation now, in the same
two-branch shape the police already had. A launch keeps the station anchor,
because a commander who starts at the slot has no lane to string a field along.

**The count and the seed expression are untouched**, so a system shows the same
rocks on every visit.

**`ASTEROID_LANE_SCATTER` IS DERIVED RATHER THAN CHOSEN, AND THE PLAN DID NOT
HAVE THAT.** `scatter()` places a rock at up to 1.5 times the nominal. So
`SCANNER_RANGE / 1.5` puts the outermost rock at exactly scanner range, and the
whole field is on the scanner as the commander passes it. The measured furthest
rock is 5,961 against a range of 6,000. `DEEP_TRADER_CONE` measured the same
derivation and rejected it, because a trader moves off the scanner. A rock does
not move.

**The derivation is also what answers `constants:check`.** The plan expected an
`@rule` id. Written as the literal 4,000, the constant repeats five others, and
the checker's own message offers a derivation as the other remedy.

**Measured over 40 systems at the real witchpoint distance, of 117 rocks: an
arrival went from 64 inside `MASS_LOCK_STATION` to 0.** The mean nearest rock
went 3,652 → 27,477 units from the station. A launch is unchanged at 57. The
rock count is 117 on both sides.

**`test/spawning.test.ts` sweeps both situations now.** One arrival sweep could
not read a launch band at all, and neither branch is evidence for the other. Six
assertions: the lane band, the launch band, the mass lock on each side, the
scanner derivation, and the police launch spread. **The last of those had no
measurement before either**, and `POLICE_PATROL_RANGE` is the same two-branch
answer this item copied.

**Proved able to fail twice, and separately.** The station anchor put back for
an arrival reddens the three arrival claims alone. The corridor used on a launch
reddens the launch claim alone.

**Both probes are byte-identical, and neither one measured the change.**
`roster-probe` reads `roster-census.ts`, and `dock-traffic` builds its own
approach. Neither calls `spawnPopulation`, whose only caller in the tree is
`world-build.ts`. So they prove that nothing else moved, and the rock count is
the evidence for the change itself. `dock-traffic` reports 80 of 80 docked and
0 rams.

**One thing is reported and not fixed.** `HERMIT_SCATTER`'s doc comment claims
2.5x the asteroid field's nominal radius. 14,000 against 5,000 is 2.8x. Neither
number moved in this item.

**172 — an empty console line still draws its box.** Chris flew it and
photographed it. A screen is 92% opaque, so `body.screen-open #message` gives
the console line a background and a border. Nothing asked whether the line holds
any words.

**`#message` is `position: absolute`, so it is a block box.** An empty one still
paints 12px of vertical padding and a 1px border. That is the rectangle.

**THE OPEN QUESTION IS ANSWERED, AND THE CODE WAS THE AUTHORITY.** The report
said the box only appears after the console shows some text. Measured in Chrome at
the first frame of a docked career, the empty element painted **34 by 14
pixels**. Those two numbers are its padding and its border, and nothing else. So
the box is there before any message, and there is one cause. A pilot notices it
after a line fades, because that is the moment the words leave.

**The fix is `#message:empty { display: none; }`**, and `hud.ts` is untouched.
The painter owns one fact already, which is whether the timer still runs. A
class it also toggled would give one rule two homes.

**Measured after the change**: an empty line reads `display: none` and 0 by 0. A
line put back reads `display: block`, 527 by 37, and keeps both the plate and
the amber border.

**`test/console-plate.test.ts` holds three claims rather than two.** The
stylesheet pair is the first two. The third is behaviour that no stylesheet can
state: `:empty` needs an element with no child node at all, so the painter must
leave none. It drives the real `Hud` through `test/screen-capture.ts`.

**THE PAIR IS ASSERTED DIRECTLY, AND THAT DEVIATES FROM THE PLAN.** The plan
asked for a gate that goes green when the plate is deleted as well. The plate is
a decision the plan records, and a decision with no measurement is a preference.
Each failure message names the other half.

**Proved able to fail three ways, and each one alone.** The `:empty` rule
deleted. The plate deleted as well. And `hud.ts` writing `' '` in place of `''`,
which is the risk the plan expected to escape the gate.

**166 — the map was not repaired with the headers.** The decomposition
programme moved nine responsibilities out of `game.ts`, and four more splits
followed it. Every module header was repaired. `docs/ARCHITECTURE.md` was not.

**docs/TODO/152 wrote that rule for a FILE.** The map is not a file's header, so
the rule never reached it. `CLAUDE.md` carries one more clause now, beside 152's
sentence.

**THE PLAN NAMED THREE FALSE CLAIMS, AND THE REPAIR FOUND FIVE.** The two extra
are the same defect at another site. `missionBlueprintOverride` has one caller,
and it is `world-build.ts` rather than `game.ts`. The chart painters left
`ui/screens.ts` in docs/TODO/149, so `ui/chart-galactic.ts`,
`ui/chart-local.ts` and `ui/chart-overlays.ts` paint them now.

**A sixth line was stale prose rather than a wrong path.** The console bullet
said *"what a deed cost your name"*, which docs/TODO/162 retired. It says
*"what a deed cost your reputation"* now.

**The fourteen modules are named**, in a section shaped like `game.ts`'s own
header: the two halves over their children, then the seven subjects. The roster
block lost four sentences to the three headers that already state them.

**`npm run map:report` is the check, and no build turns red on it.** A gate that
demanded a line per file would turn the map into an index. It went **42 of 56
unnamed to 28 of 56**. It is proved able to detect: one name taken out of the
map moves the count by one.

**Seven of the 28 that are left are one subject the map never describes.** That
is the combat trainer, at 4,274 lines. What to do about it is a reader's call
rather than a queue item.

**165 — a citation that names nothing.** The tree cites a plan document more
often than it cites an invariant. Three of those numbers resolved to nothing,
and one of the three was cited from `src/`.

**The index and the archive agreed with each other**, which is why nobody saw
it. A number that reached neither one is invisible to both.

**`npm run plans:check` is the gate, and it is in `npm run check`.** It reports
1,177 citations naming 106 plans of 151, and 0 unresolved. It matches the NUMBER
rather than the slug, because a plan document is renamed by its own milestones.

**THE GATE FOUND MORE THAN THE PLAN DID, AND THAT IS WHY IT WAS WRITTEN FIRST.**
An extra check reads a citation that carries a whole file name, and checks that
file. `completed/90-every-constant-gets-one-home.md` cited
`90-the-survey-counts-every-constant-outside-the-constants-directory.md` under `docs/TODO/`: the number resolves, and the path does not.
That document moved into `completed/` and the citation beside it did not follow.

**The gate also failed on its own plan document.** Verification step 1 said to
cite a number that no file carries, and watch the gate go red. The gate reads `docs/`, so that
sentence WAS a broken citation. A gate over prose is read by itself.

**68 landed, and went to `completed/`.** `tactic-choice.ts` rolls a tactic per
ship, and the readout reads two words.

**81 carried TWO plans, and the plan did not know that.** One is superseded and
is in `retired/`: its subject was a roster row that no longer exists. The other
was never actioned, and **Chris chose to fix it inside this item**. It is
`completed/81-live-picker-cannot-name-attack-run.md` now.

**147 is allowlisted in the gate, on Chris's call.** The plan recommended a
reconstructed record. He chose to name the number in the tool instead. So
nothing is written from memory, and 162's two citations stay as they were.

**The allowlist guards itself in both directions**, because an exception is the
same defect this item is about. A number that gains a document fails. A number
that nothing cites fails too.

**Proved able to fail four ways, and the third is the one that matters.** A
citation split across two lines of one comment is still found. That is the
failure docs/TODO/151 records, where a line-at-a-time reader dropped six paths
of 28 in silence.

**81 — the live-brain picker is dead code.** Written on 2026-08-09, deleted
rather than archived, and landed inside 165 seven days later.

**Everything it reported was still true.** `LIVE_BRAIN_IDS`,
`liveBrainSelection` and `liveBrainId` had no caller in `src/` at all. Only
tests kept them alive. The four members are gone.

**ONE TEST PINNED THE DEFECT RATHER THAN CAUGHT IT.** It asserted that exactly
one id failed to round-trip, and named `attack-run` as that one. So the
collision the plan is about had a check holding it steady. That is what a
deleted feature leaves behind.

**`selectionForBrain` stays, and the plan is wrong to list it.**
`combat-sim.ts:923` calls it.

**The live rule that survives the six deleted checks** is *every selection the
game can be put in flies the policy the report names*. It builds its list from
`selectionForBrain` now, in one place two blocks share.

**Two sentinels and their table are the same defect, and they are REPORTED
rather than deleted.** `AS_SHIPPED`, `AS_THE_GAME_FLIES` and `SENTINEL_NAMES`
are read by `brainName`'s fallback alone, which every live caller misses. That
is `internal-claims.mjs`'s own rule: report a member with no caller, and do not
delete it in the same pass.

**167 — the ledger that pays a rung for one kill.** The comment that justifies
docs/TODO/161's version 2 migration stated the opposite of what the code does.
It said an absent `atonement` leaves a commander who can never work a record off
again, and that nothing says so.

**Measured, both halves of that are false.** `undefined + 1` is `NaN`, and
`NaN < KILLS_PER_RUNG` is false. So the rule skips the "part paid" branch and
takes a whole rung on the FIRST pirate kill. It then writes `atonement: 0`, so
the ledger heals itself. `LawActions.lowerLegal` queues `recordVerdict`, so the
console announces the rung.

**The comment named a silent loss. The behaviour is a loud gift of four kills.**

**A third claim was false too.** `git log -S` shows that `atonement` and
`SNAPSHOT_VERSION = 3` arrived in one commit, which is docs/TODO/160 M1. So no
version 2 save can hold a part-paid rung, and the raise costs a pilot nothing.

**THE ITEM'S REAL FINDING IS THE COUNT.** One wrong sentence had six homes, and
the plan named two of them. The other four are 161's own plan doc, the completed
index, `test/snapshot-migrate.test.ts` and `test/atonement.test.ts`.

**A record is corrected rather than rewritten.** The three archive sites keep
their words and carry a dated correction note. The house style does not rewrite
a record of what somebody decided. A record that states a false FACT is a
different case.

**M2's answer is no guard.** `recordWorkedOff` stays three lines and trusts its
two numbers. The cause is a save with no field, and two layers already answer
it. A third would be a rule with two homes.

**Both gates were proved able to fail, and separately.** With the version 2 entry
out of `MIGRATIONS`, the migration checks go red. With the rejected guard put
into the rule, exactly the two new assertions go red and nothing else moves.
**The second proof is also M2's evidence**: a guard is a behaviour change rather
than a tidy-up.

**The shelf layer is read from the code and is NOT measured.**
`repairCommander` opens with `{ ...newCommander(), ...stored }`, and
`newCommander()` sets 0. It is private, and `readSave` needs a store that node
lacks.

**163 — the chart key that needs a browser.** `src/engine/shell.ts` promises a
headless game. `src/ui/screen-shell.ts` holds the seam that keeps the promise:
`maybeById` answers `null` where there is no page. `screens/chart.ts` reached
for `document.getElementById` instead.

**The screen and its painters disagreed about one lookup.** The two chart
painters read the same two element ids through the seam. The screen did not. The
line runs under a guard that the `F` key turns on, so type-to-find threw under
node.

**No player could see this, and that is the shape of the defect.** The browser
was never affected. The cost was the seam. No headless test, replay or harness
could drive type-to-find at all.

**The fix is one line**, and the remedy was the seam rather than a new one. The
`if (info)` guard below it already handled `null`, so nothing else moved.

**The gate is a new file, and that is a deviation from the plan.** The plan
asked for a block in `test/chart-days.test.ts`. That file paints both charts
through `test/screen-capture.ts`, which INSTALLS a recording document for the
length of one paint. This gate needs no document at all. A no-document block
inside a file that installs one could pass for the wrong reason, and nothing
would say so.

**`test/chart-headless.test.ts` is 11 assertions, and it drives both charts.**
The defect line branches on `this.local` and reads a different id on each side,
so one chart is not evidence for the other. Its first assertion is the control:
there is no document.

**The cursor check is what proves the path is reachable.** `L` moves the cursor
to Leleer, and `A` then narrows it to Lave. Six of the twelve checks go red with
the old line put back.

**`screens/chart.ts` went from 89.3% to 91.8%**, measured with 164's repaired
tool. It is no longer the worst-covered screen in the tree.

**Three other direct callers of `document` stay, and the plan predicted all
three.** `save-transfer.ts` builds an anchor and a file input.
`screens/combat-sim.ts` builds an anchor. Each is a platform ACTION rather than
a paint, and a file download has no headless meaning. Do not re-open them.

**One thing came out of it that the plan did not have.** `maybeById`'s doc
comment said *"These four callers"*, and this item made a fifth. It is the same
defect 164 fixed in a path: written down one time, and never checked again.

**164 — the tool that reports every file as untested.** `npm run coverage`
printed a false report, and it printed it with confidence. It said that 259 of
260 files never ran. The list held `constants/law.ts` and `world-step.ts`, which
the suite drives thousands of times.

**One line caused all of it.** The tool split every script URL on
`/elite-web/`, and the checkout is `harmless`. So the split missed, every path
became `undefined`, and the map collapsed to one key. **The tool's own header
says which half matters:** the list at the bottom, of files no test touches at
all. That list was 100% false.

**The fix asks the process rather than a name.** `process.cwd()` is the root
now. A script from outside the checkout is dropped, rather than collected under
one `undefined` key. The real picture is **247 of 259 files touched, and 12
never executed**. Two of the twelve export types only, so do not file them as
gaps.

**The self-check is the gate, and it is why the item is not just a one-line
fix.** The tool exits 1 when the touched count is under half of the files
found. A wrong root does that. So does a run from a subdirectory, which is the
other way `process.cwd()` can be wrong. Proved able to fail by putting
`/elite-web/` back.

**Nothing was renamed.** `elite-web-` is the live save namespace, and
`elite-web-harness-` is the harness one. A rename orphans every save on every
player's shelf. Chris pinned that on 2026-07-28.

**The second half shares one root with the first.** `tmp-jump.ts` sat in the
repository root and git tracked it, from commit 46828fb on 2026-08-11.
`tsconfig.json` includes `src`, `train`, `test` and `tools`, so `npm run lint`
never read it. It no longer compiled: `Expected 5 arguments, but got 6`. It
was added to the include list for one step, to prove the hole was real, and then
deleted. `tmp-*.ts` is in `.gitignore` now, and the root stayed off the include
list.

**The tool stays outside `npm run check`.** It runs the whole suite a second
time under `NODE_V8_COVERAGE`, at about 20 seconds. The self-check answers the
same worry for nothing.

**The least covered file in the tree is `src/engine/render-stack.ts`, at 66.2%**,
and it needs a browser. The least covered file that does not is
`src/engine/keymap.ts`, at 80.5%. `src/game/screens/chart.ts` at 89.3% is
docs/TODO/163, which is now the head of the queue.

**154 — the comments in src/ are not in Simplified Technical English.** Chris
asked one question on 2026-08-14: *"Are they in ASD-STE100?"* They were not.
`CLAUDE.md` set the style and stated that no gate checked it, and a rule with no
measurement is a preference.

**The measurement is the whole item.** `tools/ste.mjs` counts three rules that a
machine can count: the sentence caps, the `-ing` words and the tense. It found
1,988 long sentences, at 20% of every sentence in `src/`. It also found the
proof that the incremental rule fails. `src/constants/`, swept in one pass by
141, read at 7%. The rest of the tree, left to convert as each file was
edited, read at 24%.

**The harder half of the checker is `tools/ste-read.mjs`, which decides what is
measured.** The style never touches code, an exact command, an API name, an
error string, or anything quoted from a person. **A quotation rewritten is
falsified**, so a checker that cannot see a quotation mark asks for exactly
that. It walks characters rather than lines, because a line-at-a-time reader
cannot tell a comment from a string that holds `//`.

**M3 was the sweep, and it took twenty-nine passes** over about 130 files. The
tree went 1,988 → 0 long sentences of 14,582, and 309 → 0 compound tenses.
**The tail reads worse than the head, by share.** A file low in `--work` order
starts at about 30% over cap, exactly like a file at the top. It merely clears
in fewer edits. **A last breach is nearly always a header that states three or
four things in one sentence.** The remedy is the style's own vertical list.

**A converted file drifted back while the sweep was still running**, and that is
the evidence the gate rests on. `game/npc.ts` reached 0% on 2026-08-14.
docs/TODO/158 put five long sentences into it on 2026-08-15, and nothing said
so. The twenty-fifth pass repaired it.

**One real defect came out of the sweep.** `ships/elite-a-hulls.ts` claimed the
pack's gun-vertex byte is 0 for "thirty of the designs" and that "only five
ships" name a later vertex, then listed six names. It is thirty-two of 38, and
six ships. A rewrite that has to re-read a sentence is a rewrite that checks it.

**M4 is the gate: `npm run ste:check`, whole-tree, inside `npm run check`.** The
plan expected diff-scoped. Whole-tree costs the same on a tree at zero, lets
less through, and needs no diff base. **It holds two rules of the three.** The
`-ing` count never gates. It is 788, and a technical noun is the honest answer
for most of them. The allowlist rather than the prose decides what the number
means. **Proved able to fail** by a 30-word sentence and by a compound tense,
both removed. It is proved lastingly by four assertions that run the real
command line against a fixture. 4,708 assertions, 387 exports and 76 rule ids unchanged.

**162 — one word that means five things (GitHub #33).** Chris read one line and
said what was wrong with it: *"'Cost you name' doesn't mean anything. We use it
in a lot of places and 'name' is a bit confusing - what are we saying."*

**The report was exact, and the cause was wider than the line.** `name` carried
five meanings: what a thing is CALLED, the disrepute ladder, the legal record,
the combat rating, and a value's own label. **The first is the one the game
teaches.** Three screens ask for a name and each means the word the player
types, so `COST YOUR NAME` read against that lesson.

**The worst case was one paragraph in `src/game/law.ts`.** It held two of the
meanings four lines apart, in a paragraph whose whole point was that the two
ladders are separate. The same sentence carried a second defect. It claimed
`recordCleared` was the only thing that clears a record, and docs/TODO/160 made
that false.

**THE ITEM WAS RE-CUT MID-FLIGHT, AND THAT IS THE RECORD'S MAIN POINT.** M1
landed saying `CHARACTER`, which swapped one internal word for another. Chris
set the direction the rest of it ran on, in three messages: *"a user does not
have the context we have and they don't understand all our internal ways of
naming things"*, then *"2-3 lines maximum on the console. More text as needed in
the main UI"*, then *"this does not mean we write essays - just think - if this
was the first time I saw this string - would I know what it meant."*

**So the player's word is REPUTATION**, and the scope became every consequence
line rather than the five strings the screenshot found. Each line says what
happened rather than naming it: `REPUTATION: DODGY — WORD IS GETTING ROUND`,
`LEGAL STATUS: FUGITIVE — POLICE AND BOUNTY HUNTERS WILL ATTACK YOU`,
`FINE PAID: 100.0 Cr — YOUR LEGAL STATUS IS CLEAN AGAIN`.

**The verdict says which WAY the ladder moved**, because a rung name carries no
sign and the decay crosses rungs downward. **The clause is about talk rather
than about a rule**, and that is forced. What a rung COSTS differs by rung, so a
named consequence would be false at some of the six.

**Five identifiers followed the prose**, because a comment written beside
`markName` reaches for the word in the identifier. `characterName` was the
sharpest case in the item and the plan never named it: `ui/screens.ts` printed
`COMMANDER ${c.name}` and `characterName(c.disrepute)` six lines apart on ONE
screen.

**`test/ladder-words.test.ts` is 17 assertions in three parts** — a scan of 815
shouted strings, the two verdict functions, and the COMMANDER screen through
`screen-capture.ts`. No one scan sees all three surfaces. **All four protected
rules were proved able to fail.** **`NAME` is deliberately not banned**: it is
the word's one correct meaning, and the reason the other four were wrong.

**Three things are recorded and not scheduled.** The briefing tells a new
commander she has *"no reputation at all"* and means the RATING. That now reads
as the best rung of the other ladder. It is Chris's writing on an excluded
page. `#screen .hints span` is still `nowrap`, which is GitHub #29's defect in a
second element. And Chris's wider point — *"we've been trying to keep text
overly short in the UI"* — is bigger than this item, which swept only the
consequence lines he scoped.

**161 — a save that is refused rather than raised.** Chris's call: *"We should
migrate snapshot v2 to v3."*

**`SNAPSHOT_VERSION` moved twice on 2026-08-15**, to 2 for the escape capsule
and to 3 for the atonement ledger. `parseSnapshot` refused anything that was not
the current number, and 160 recorded that refusal as deliberate. This overrules
it.

**The refusal was silent in the worst way.** `SAVE_RECORD_VERSION` did not move,
so a version 2 record IS on the shelf and IS listed. The snapshot's version is
not read until the world is restored. So the save appears, the player picks it,
and it throws.

**`MIGRATIONS` sits under `SNAPSHOT_VERSION`**, because that constant's doc says
what each version ADDED and this says how to add it. Written apart, one of them
would rot. `migrateSnapshot` climbs on a COPY, and only when it has a step to
run. A current snapshot is not cloned. One it cannot raise leaves the caller's
bytes as they were.

**The v2 step WRITES the field rather than permitting its absence.**
`Persistence.restore` clones the commander straight in. So an absent
`atonement` reaches `recordWorkedOff` as `undefined`, and the ledger runs at
NaN. It says nothing for the rest of that career. The cost of the raise is
bounded at four pirate kills, once.

> **Correction, 2026-08-16 (docs/TODO/167).** The two sentences above state the
> fault wrongly, and the same words were in the code. Measured, `NaN < 5` is
> false, so the rule takes a whole rung on the first pirate kill and then writes
> `atonement: 0`. The ledger heals itself, and `recordVerdict` announces the
> rung. It is a gift of four kills rather than a silent loss. The raise costs
> nothing at all. docs/TODO/160 added the field and raised the version in one
> commit, so no version 2 save holds a part-paid rung. **The migration is still
> right, and only this reason was wrong.**

**Two things the work found.** `parseSnapshot` returned `raw` rather than the
object it validated. The two were the same object until a migration copied one,
so nothing ever noticed. With the migration in, the door validated the copy and
handed back the version 2 original. And **the first gate died rather than
failing**. The break-it step found a bare `parseSnapshot` call that ended the
run, and that call reported nothing and counted nothing. A gate that cannot
report its own failure is not a gate, and only the break-it step finds that.

**`snapshot.ts` crossed 400 lines, and the seam was already a banner in the
file.** The door is `snapshot-parse.ts` now, 157 lines against 311 left behind.
One file says what a snapshot IS: the shape, the version, the table that climbs
it, and the codec. The other says what makes one trustworthy.

**Version 1 is still refused, and that was a decision waiting on Chris.** The
step is one entry in the same table, and the plan holds the argument both ways.

> **Closed, 2026-08-17.** Chris: *"Version 1 save/load - not important."* The
> "Closed decisions" section above holds it now.

## What landed on 2026-08-15

**160 — a record you cannot work off (GitHub #32).** Chris asked for one thing:
*"Killing pirates should decrease your criminal status."*

**A legal record only ever went up.** `raiseLegal` raised it, and
`recordCleared` — the fine paid at a station, by choice — was the only rule that
took it down. Its own doc comment said so in as many words, and that sentence
changed with the code.

**`KILLS_PER_RUNG` is five, on arithmetic rather than taste.** A pirate's bounty
runs 4 to 22 credits across the roster, and most of the band sits near 10. So
five kills earn about 50 credits. A rung costs 25 credits as an Offender and 75
as a Fugitive. The fine is the fast way and needs a station; the fight is the
slow way and needs none. Ten kills take a Fugitive to Clean.

**The record moves and the NAME does not, and that is what makes it safe.**
Disrepute is untouched. Otherwise a commander could murder a trader, shoot five
pirates, and end Clean and Honest at a profit. It is docs/TODO/156's split read
from the other side.

**Pirates only.** A mothership replaces a Thargon every five seconds, so
counting drones would make a record free. A Clean commander banks nothing, so a
crime cannot be paid for in advance, and a fresh offence clears a part-paid
ledger.

**The atonement is a `CombatEvent`**, because an NPC reports and an orchestrator
resolves (invariant 15). It goes straight to `LawActions` rather than out
through the host. The asymmetry with the offence beside it is the reason. A
raised record launches the station's Vipers, and that is the orchestrator's act.
A record worked off queues one console line and nothing else.

**`SNAPSHOT_VERSION` went to 3**, because a version 2 save cannot say how far
through a rung its pilot was. A default of 0 would silently take four
pirates back off them. **Seven unrelated constants gained `@rule` ids**, because
the value 5 is shared nine ways and only two of them carried one.

**159 — the lane that only exists at the station (GitHub #31).** Chris flew to
the sun and reported: *"I don't think I encountered any NPC ships. We should
come across some people."*

**Measured, the report is exact.** The sun sits 320,000 units from the system
origin, and the station about 12,000. So the run to the fuel-scoop band is
roughly 220,000 units, at about 70 seconds under the torus drive. Every ship a
system holds is within 22,000 units of the station. So more than nine tenths of
that run was empty by construction.

**One spawn is anchored to the commander, and it is gated shut.** A pirate wave
needs a government of 3 or below. In a system of government 4 or higher nothing
was ever placed near the commander at all.

**The fix moves an anchor and nothing else.** `stepEncounters` keeps its clock
and its cap. It now says WHERE the trader it already ordered should warp in. It
is near the station for a commander near the station, and ahead of the commander
out in deep space. Same traffic, somewhere a pilot can see it.

**The cone is derived from `MASS_LOCK_SHIP`, and that is the design rather than
a number.** It is the widest angle at which the arrival still mass-locks a
commander who holds course. So the meeting is a meeting: the drive lets go, and
you fly past a ship rather than a dot. **The first derivation used
`SCANNER_RANGE` and was measured and rejected.** That guarantee is static and a
`departing` trader is not, so about one run in ten met nobody.

**The ship leaves.** A trader pointed at the station from out there would fly for
sixteen minutes. It would hold one of the four trader slots for all of them.

**`spawning.ts` crossed 400 lines on the way, and the seam was already in its own
header.** For months it said that the combat-training arena is the same job
with a different plan. That half is `spawning-arena.ts` now, 202 lines against
260 left behind. The two neighbouring headers that named the old home were
repaired in the same commit.

**Measured, 20 sun runs of 20 meet somebody, and 60 of 60 do**, with exactly one
ship inside scanner range in every flight. The same flight before the change met
nobody, over 200 seeds. `npm run roster-probe` is byte-identical.

**158 — the safe zone that only the spawner obeys (GitHub #30).** Chris flew it
and reported: *"I was attacked by a bounty hunter when I was in range of a space
station."* **The behaviour was correct under the rules that ran**, so the fault
was in the rules.

**The safe zone was already written down, and one rule read it.**
`AMBUSH_STANDOFF`'s own doc comment called 7,000 units *"the one place where a
player can catch their breath"*. The spawner spent it, and refused to warp a
pirate wave in near the station. `isHostileToPlayer` — the single home of *"does
this ship attack the player?"* — took a ship and a legal status, so it could not
answer a question about the station at all.

**The triage found the cause the report did not, and it is shared with #31.**
The last branch of `NpcShip.update` draws an idle waypoint 800 to 3,300 units
from the STATION, for every role except the trader. So a system's ships converge
on the port whatever they were spawned at. A refusal to SPAWN a wave there
does nothing about the ships that walked.

**The constant is `STATION_TRUCE` in `constants/law.ts` now**, because the rule
it states is a law rule with two readers. `truceHolds` is asked inside
`isHostileToPlayer`. So six surfaces give one answer: the ship, the scanner
blip, the threat arrow, the condition light, the bought combat computer and the
bribe key.
A promise kept by three surfaces out of six is not a promise.

**The police are deliberately not covered.** A station that hid a Fugitive from
the law would be the one place in the galaxy a record stopped costing anything.
**A commander who shoots first ends the truce**, on `provokedByPlayer`, so the
port is not a free firing position either.

**Four existing fixtures were parked on the slot, and all four were fights.**
Each stands off now and each says why; no assertion was weakened. Both gates
were shown to fail separately — 13 assertions for the rule, 2 for the waypoint —
and `defence-probe`, `survivability` and `dock-traffic` are byte-identical.

**156 — the escape capsule nobody chose to shoot (GitHub #28).** Chris flew it
and reported two things at once: *"Escape pods seem to be too easy to destroy.
And destroying a pirate's escape pod should not make me a criminal."* They have
different causes.

**A capsule launched AT the wreck**, which is the one place the gun is certainly
already pointed. A beam laser fires ten times a second. The burst that
killed the ship killed the pilot, and the commander never chose it.
`POD_LAUNCH_GRACE` is 1.5 seconds, and `shot.ts` spends it in BOTH passes, so a
graced capsule can be neither struck squarely nor grazed. Chris chose the grace
over a bigger bank, and the reason is the one the fault has. The fault is where
the capsule appears, not how tough it is.

**Every capsule was a Fugitive offence whoever was inside**, so shooting a
raider's pod outranked shooting the raider. The capsule could not answer the
question, because `Combat.wreck` despawns the ship in the frame that launches
it. It carries the role now, and the record comes off `offenceFor` — the same
rule that prices the hull.

**Triage found a third fault the report did not.** The Character ladder was
never charged for this at all. So a commander could shoot a lawful pilot in his
capsule, and buy the name back with the fine. It costs a murder now, and it costs
one for a raider's capsule too: Chris's call, *"Character only"*. Not a crime,
and still a deed. That is the clearest case in the game of the two ladders
moving apart.

**`combat.ts` crossed 400 on the way, and the seam was already in its header.**
The two functions that assemble the player's trigger out of a GameState are
`combat-player.ts` now, which takes `GameState` and `viewDirection` out of the
pure rule. That is the architectural argument; the line count is only what made
somebody look.

**157 — the console line runs off both edges (GitHub #29).** `#message`
declared `white-space: nowrap` and no width at all, centred on `left: 50%`. So a
line wider than the window hung off BOTH edges, and the commander read the
middle of the sentence.

**The measurement is the item.** The Constrictor gun warning is 91 characters,
which at 15px Menlo with 3px of tracking is 1095 pixels. One row of an ordinary
1024px window is 942. It never fitted, on any window a player is likely to
use. The two numbers that make the sentence useful sit at the two ends.

**The queue was never at fault**, and that is worth a record, because a reader
looks there first. `later` and `tickMessage` deliver the line
whole. It is then painted off the screen.

**The words are untouched.** docs/TODO/144 M1 cut that sentence once already on
a length argument, then put it back when length stopped being the constraint.
Writing a rule to a width is the mistake this item exists to stop repeating.

## What landed on 2026-08-14

**155 — the orchestrator split in two, on Chris's answer to 150 M6:** *"It makes
sense to split docked from flight - they are very different things. Why would you
want to couple them together?"* **The code already agreed with the question.**
The command table sectioned itself by mode in its own comments. `controls.ts`
had a binding table per mode. Only eleven lines in 1,810 tested the mode at
all. **game.ts 1,810 → 1,222**, into `docked.ts` (324) and `flight.ts` (395).
`flight.ts` is itself a parent over `flight-weapons.ts` (295) and
`flight-instruments.ts` (169).

**Neither half reaches into the other, and that is the architecture rather than
a side effect.** Five of flight's seventeen host methods are ways OUT of flight:
a dock, a completed jump, a tow, a death. The parent decides what the
game becomes. **The split found three things at once:**

1. the docked menu drawn from three places with one expression;
2. a construction cycle between the gun and the exercise, which fires the
   career's own `Combat` and credits its own kills;
3. the hermit, which went to the docked half on ONE HOME rather than on the
   mode machine, because `tradeContext` already held `leaveHermit`.

**The size gate caught a design fault.** M2's first draft was one file of 648
lines with five section headers, and `sizes.mjs` failed it. That gate calls its
ceiling a detector rather than a rule, and it was right. An exemption was
available, and it was the dishonest answer. The `ALLOWED` list's own bar is that
a reason must say why a file cannot be a parent plus children.

**153** — *a rule explained where the rule does not live*, and **the premise
inverted under measurement**. The plan's own test walked every rule paragraph in
`game.ts` and its nine children. Delete the code in your head, and ask whether
the sentence is still true. That gave **0 homeless paragraphs and 9
duplicates**. Every rule beside a handler was a second copy of what the rules
module already said. Two of them were word for word, and one of those was mine
from 150 M4. **So the defect is one rule with two homes**, not homelessness, and
each copy became a pointer. The plan's own central example was wrong on the
facts. **M2 asked whether to sweep the tree and the answer is no.** `src/` holds
175 near-duplicate pairs. 32 are a constant beside the module that spends it,
which `CLAUDE.md` explicitly requires. 69 are generated headers.
Nothing was cut; the ten files went from 1,653 comment lines to 1,655.

**152** — the header's three wrong claims, and 155 M3 removed all three as a
side effect of stating the parent's one responsibility. The mode list is GONE
rather than replaced, so **M2 correctly produced no gate**, which the plan named
as the better outcome. **The audit then found two more, and one was mine.** The
header I wrote an hour earlier said `stepHost()` lives in `game.ts`, and 155 M2
moved it to `flight.ts` an hour before that. That is the defect this item is
about, reintroduced by the commit that fixed it. **The rule that came out of it
is in `CLAUDE.md`**, beside the module-header line. It reads: *the milestone that
takes a responsibility out of a file repairs that file's header in the same
commit.*

**150 — the orchestrator and its children. Six milestones, and game.ts is 1,810
lines.** M1 took the law to `game/law-actions.ts`, and M2 the sky to
`game/world-build.ts`. M3 took the cockpit to `game/cockpit-view.ts`, M4 the
jump to `game/hyperspace-actions.ts` and M5 the career to `game/career.ts`. Each
child is one subject, each under 310 lines, each readable alone. **No milestone after M1 names its own successor**, and that is
the programme's sharpest lesson rather than an omission. 149 planned one chart
file, measured 719 lines and found four subjects. M2 then measured the trainer
that the plan NAMED, and found the worst area in the file: 39 lines behind a
twelve-method interface. M3, M4 and M5 each measured again. Each time the
winner was an area that no table named: the cockpit, then the jump, then a PAIR
that beats both of its halves.

**M6 measured and stopped, and that is the finding.** No sixth area clears the
bar, and not because the good ones are taken: **75% of what is left cannot
leave.** An `apply*` method IS the orchestrator, by this project's own rule that
a module decides and an orchestrator applies. The six host literals travel with
the modules they are handed to. The 81-line command table is deliberately the
whole surface a replay, an AI or a test drives the game through. Only **448 of
the 1,810 lines** sit in members that could still move. So a move of all 44
lands the file near 1,362. That is a real shrink, and then it stops, nowhere
near ~300. What changed is the price rather than the shrink. `game.ts` fell by a
steady 98 to 138 lines a milestone since M1. The lines written per line removed
went **1.09 → 1.90 → 1.87 → 1.92 → 2.61**. M6 corrects the stated target in
`tools/sizes.mjs`. A target known to be unreachable is the same false
claim in a gate's own review surface that 151 was about.

**M6 also got a claim wrong, and the correction is in the record.** It first
said every milestone moved less as well as costing more. The shrink is flat
rather than smaller each time. The wording invited a worse reading, which is
that a move out of the file does not shrink `game.ts` at all. It does, every
time. **The item closed on Chris's
answer**, which is 155 at the head of the queue.

**151** — thirty-one members of `src/` said *"@internal — driven by
test/playtest.js"*, and that file calls **eleven** of them. The claim was true
once. The harness shrank away from it, and no gate joined the two files, so it
could not fail. Both milestones landed in a day.

**The split is the result, and the plan's third category came back empty.** The
plan expected a screen or a context to justify three of the members. It does
not: `commands` is `private readonly`, so the command table's calls are inside
the class.

| the reason the member is public | count |
| --- | ---: |
| the orchestrator reaches it | 5 |
| a test drives it | 10 |
| a screen or a context reaches it | 0 |
| nothing outside the class reaches it | 6 |

**The six are a second defect, and they are two kinds.** `Game.sellCargo` and
`Game.generateContractOffers` have no caller at all. `raiseLegal`,
`openHermitTrade`, `toggleCombatComputer` and `openSystemData` are reached by
`stepHost` or by the command table, and both of those are private. A seventh
finding sits inside the last one: `openSystemData` keeps a parameter it does not
read, for a caller that does not exist. **Nothing is deleted.** `game.ts` is
under active decomposition, so what to do about six members is 150's decision.

**Three more of the same defect were in plain prose**, which neither the plan's
list nor a gate of that form can see. `update` named `test/gang-trial.js`, and
that file does not exist. `screens/trade.ts` said `test/playtest.js` drives
`sellCargo`, and said it sets `selected` directly where it sets it through
`g.marketSelected`.

`tools/internal-claims.mjs` is in `npm run check`, and it reports **23 claims
naming 28 files, 0 stale**. **It reads a comment RUN whole**, because a claim
wraps. The line-at-a-time first draft found 22 of the 28 paths and dropped six
in silence. That is precisely the failure the gate exists to end. A call must
arrive as `.name(`, or the `law-actions.ts` claim would answer itself against
`game.ts`'s own declaration of the same name. All three failure modes were
proved. `npm run check` passes at 4,530 assertions.

## What the playtest is now for

**It reports; it no longer blocks** (Chris, 2026-08-11: *"do not block things on
my playtest, use sensible default values"*). Every number below is settled and
gated. docs/TODO/132 has the reasoning: three of the four were never matters of
feel, and the fourth stopped being a value at all.

What a flight is still worth is the part no measurement reaches. Two questions
are in it. Does a hermit's refusal read as a mechanic or as a bug? Does a bribe
FEEL like it costs something? Those become GitHub issues, not blockers.

- **`DISREPUTE_BRIBE` (12)** — settled by arithmetic, not feel. Over all 1,686
  jumps galaxy 1 allows inside a full tank, a median jump forgives 6 disrepute.
  The bribe is exactly twice that. So one bad afternoon washes off in two quiet
  jumps, and a bribe every system reaches Dodgy by the fourth. Unchanged, gated.
- **`DISREPUTE_HEAT`** — no longer a number. Its own doc said it meant "as
  interesting as a fat sale", which names `SALE_NOTORIETY_MAX`; it is that
  constant now and cannot drift from the sentence that justifies it.
- **`COURTESY_RATE` (0.15), `HERMIT_FAVOUR` (0.2)** — unchanged, and gated on
  the design rather than the mechanism. The stick must outweigh the carrot, and
  the hermit's welcome must stay a perk rather than a wholesale channel.
- ~~**What a person fetches**~~ — **answered by measurement, 131.** It was not a
  matter of taste. A sale paid 2–16 Cr and filed a record costing 25 Cr to
  clear, so it was never correct at any market in any galaxy.
  `SURVIVOR_SALE_TONNES` (4) is the multiplier 127 asked for, and two measured
  rules bracket it. The deed must cover its own cleanup at a median market. It
  must NOT at the cheapest, or where you dock stops deciding. It sits at the
  bottom of that bracket, 4–12, so the playtest can raise it on evidence.

121's CHARACTER lever (⇧T at the station) is the cockpit that settles all of
them: twenty levers behind one door, including the Character score itself.

**Do not reach for `npm run campaign` to re-open any of these.** It abstracts
flight entirely, and no bribe, scan, hermit or murder ever runs in it. So a
60-commander bounty-hunter cohort over 80 legs ends with a median career peak
disrepute of **0.0**. Measured, not assumed. The harness sees only the trade half
of the ladder. That is why 132 anchored these against the decay, the sale
channel and each other instead.

## What landed on 2026-08-13

**146** — Chris's diagnosis of 144 M6, and it was exact: the keyboard was never
broken, and *"it sounds like it's the mouse click that is not working properly?
It dispatches just a letter press?"* It did. `data-key` carried the key alone,
`ScreenHost.click` injected a bare tap, and the plain entry answered.

**Shift is a property of the TAP now, not of the frame**, and that is the whole
design. `commandsFor` tests every binding in one pass. So an injected tap that
set a frame-wide "shift is down" would let a plain Y satisfy ⇧Y. That is five
tonnes over the side instead of one, from a click on a menu. A real keydown still
carries `null` and defers to `held`, so the path that was never broken is
untouched by construction rather than by care.

**Three of the six gates were vacuous when first written**, and proving each
could fail is the only reason that is known. No shipped row is shifted, so the
row loop could only exercise the unshifted branch. **Nothing drove
`ScreenHost.click` or `runMenuCursor` at all** — the two lines that were broken.
And the carry test could not tell `slice(0, N)` from `slice(-N)`.

**`controls.ts` went into ALLOWED rather than a fourth trim.** 144,
145 and 146 each added a command and each cut prose to stay under 400 lines.
That is the ceiling measuring the comments rather than the file.

**147** — the station header takes as many lines as it has orders, on Chris's
call: *"we don't need to keep it one line"*. The joined string it replaced still
wrapped, and broke wherever the column ran out. **The gun warning is back**, and
the one-line budget was the only reason 144 ever cut it.

**145** — Chris's call on reading 144. A contract and a mission are two kinds of
thing. One screen that held both left the bulletin board saying the same thing
twice. **MISSIONS is the Navy's alone.** **CONTRACTS opens in flight, on ⇧C.**
The ACCEPTED half travels, and the board stays at the station. The offers in
state are the LAST station's work, so a painter of them would show a pilot
jobs she cannot take. The accept key is refused rather than hidden. Both screens
got one name each, because the headings and the rows disagreed.

**Five things came out of it that the plan did not have, and the largest is the
plan's own fault.** It called the board *"a second, independent rendering"* that
could word a job differently. It could not — both halves call
`describeContract`. What was genuinely written twice is the days-left
subtraction. Three more sit under that. The accept-key refusal had no gate at
all, and the break-it step caught it. `controls.ts` crossed the size ceiling
three times, because the click-path rule was written at every binding that obeys
it. That rule has one home now, beside the function it is about. And `ordersSummary`
lost its doc comment to `orderDestinations` back in 144 M4.

**Flown at Leesti.** R gives NAVY MISSIONS with no contract on it. C gives the
board plus the accepted jobs, and ⇧C in flight gives the accepted half alone.
The session found two things that are correct behaviour rather than defects. A
background tab has `document.hidden`, so no frame runs and no key does anything.
The docking tunnel holds input for as long as it runs.

**144** — GitHub #27, and the Navy's briefing had nowhere to live. A **standing
order** is an obligation that outlives the moment it is announced. The game has
two kinds, a signed contract and the Navy mission, and they shared one amber line
under the station header. The contract won it. So a commander who took any job
before the Navy briefed her was never told where the Constrictor was. The
transmission she did get lasted five seconds and named no system.

**The Navy mission was the only standing order in the game with no screen.** A
contract has a durable home in the bulletin board's ACCEPTED table. That home is
a station, so in flight neither kind was readable at all. The pilot who met
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
mission. It states three things:

1. a standing order has a screen;
2. a console line never holds the only copy of one;
3. a surface that carries orders never drops one kind for another.

Two gates hold it as behaviour. The first is a walk of the mission machine end
to end. The second is a matrix over both mission states and four contract
counts. It asserts that the number of kinds HELD equals the number NAMED.

**Six things came out of it that the plan did not have**, and all six are in the
plan doc. The largest is a second defect the test found: **the gun warning
deleted the transmission it explains.** Both lines were pushed with `say` in the
same frame, and `showMessage` takes the console. So a commander with the wrong
gun never saw the Navy's call. It is queued now, which is the rule
`session.ts` already states. `test/key-prose.test.ts` could not see it, because
neither line spells a key.

**The flight found a defect that every gate missed, and it was in the key.** The
screen shipped on ⇧I, and **clicking its own menu row opened the COMMANDER
STATUS screen**. A menu row is a click target, and `data-key` carries the key
and not the modifier. So a shifted ROW cannot keep invariant 13's promise. That
promise is that a click becomes the same keystroke as a key press. ⇧T dodged it
as a keyline caption rather than a row. The key is **R** now, and it is the only
plain letter free in both tables. The rule is a gate: `test/key-help.test.ts`
presses every docked row through the click path. Nothing could see this before.
The binding table was never the broken part, and no test joined a binding to the
HTML its row renders to.

**Flown at Leesti on 2026-08-13**, with 16 kills, a beam laser and two contracts
held. All five surfaces read correctly, and no save was put at risk. The browser
held three real careers. The page was switched to the harness namespace before
any docking, and all seven player keys were byte-identical afterwards.

`npm run check` passes, and every gate added was shown to fail. **The last
question closed on Chris's call the same day.** The station line wraps to two
lines when it carries a Navy mission and a contract, and he read it and settled
it: *"that's fine - we have space"*. So the summary keeps every kind it holds at
full length, and nothing is shortened to fit one line. **Nothing is open on 144.**

**143** — GitHub #26, and the rule the issue questions is correct. The triage
answered it by measurement, over 138 freight jobs from 86 home systems of galaxy
1. A sale of the consignment at the DEAREST price the galaxy can roll, plus an
expired job, never beat a delivery. The closest it came was a delivery that paid
2.24 times the sale. So the sale stays legal everywhere, a hermit's
included, and the SCREEN is what changed.

**The market screen says which tonnes are spoken for.** `consignedTonnes` is a
derived reader beside `berthTonnes`, and the `IN HOLD` cell reads
`10t · 5 CONSIGNED` in the amber an illicit job already uses. It reports the JOB
and not a share of the hold, because goods are fungible. 15t against a 5t
consignment says 5, and the other ten are hers. A `smuggle` run is freight and
marks its row too. A berth, a bounty and a courier run carry no goods and mark
nothing.

**The sale asks once.** The first sell key on a marked row says
`5T CONSIGNED — PRESS V AGAIN TO SELL`, and the second sells. `SELL ALL` arms the
same way, so the fastest way to void a contract is not one keystroke. It is a
warning rather than a refusal, and there is no hermit-only door. A rule with two
homes is what `CLAUDE.md` forbids.

**Four things came out of it that the plan did not have**, and all four are in
the plan doc. The largest is where the arming had to live. The plan warned that
`test/playtest.js` calls `sell`. It does not: it empties the hold itself, and it
only ever calls `g.buyCargo`. `Game.sellCargo` does call it. So the arming sits
in the input handler, and `sell` stays the plain action a scripted caller needs. A
row already sold down to nothing still carries the mark, and that is the last
warning there is before the door. `test/consigned-hold.test.ts` is 38
assertions, and all three gates were shown to fail. `npm run check` passes at
4,413 assertions.

**One asymmetry is recorded rather than scheduled.** A shortfall is billed at the
destination and free everywhere else. The same missing tonnes cost nothing when
they arrive LATE. Settlement cannot see whether the hold is short because it was
sold or because it was robbed.

**142** — GitHub #25, and the sky stopped being mixed in the cockpit. All three
milestones landed in a day, and Chris flew it on headphones the same day. A
`SoundEvent` carries where it happened now. `AUDIBLE_RANGE` is the scanner's
reach written as an expression over `SCANNER_RANGE`. A bang falls off as the
square of what is left. A wreck beyond the scanner builds no voice at all.

**The stereo place is Chris's own addition, and it is M3.** `viewRight` sits
beside `viewDirection`, and the ear turns with the VIEW rather than with the
hull. So a ship on the left of the screen is on the left in rear view too. The
docking waltz built every hard part before this item. That is the panner, the
straight-through fallback for a browser without one, and the fixture that
records both.

**His question about the NPC laser changed the design, and the code answered it.**
He asked whether a bolt should be judged by where it was fired from or by how
close it passes. Neither answer is right. `heard('enemyLaser')` is pushed only
where the shot is at the PLAYER, and an NPC that shoots another NPC draws a
tracer and says nothing. So the beam always ends on the hull. That sound is **placed and never attenuated**.
You always hear that you are under fire, and the ear says where from. Three
categories, not two.

**Eight things came out of it that the plan did not have**, and all eight are in
the plan doc. The largest: **no test had ever played a noise.** The fake
`AudioContext` had no `createBuffer`. So `explosion`, `hit`, `damage`, `ecm`,
`bomb`, `hyperspace` and `tunnel` all threw on the first call under it. Every
sound `test/audio.test.ts` names is built from `tone`. The envelope's floor turned
out to decide two things at once, so a voice under it is skipped rather than
built backwards. The zero-distance guard is defensive rather than live, and the
plan said otherwise. Two unrelated constants needed `@rule` ids, because a third
constant arrived on the value 0.7. And two comments were already wrong before
this item touched them.

`test/sound-place.test.ts` is 30 assertions, and all five gates were shown to
fail. `npm run check` passes at 4,374 assertions with zero constants warnings.

**138 M4 closes the item.** The two released overrides have a caller.
`missionBlueprintOverride` in `game/missions.ts` owns both mission facts. The
hunting leg AT the target system flies set G, and the courier run flies a
Thargoid set. `enterWitchspace` now chooses a set at all, which it did not do
before. **Limbo is asked first**, because a mis-jump on the hunting leg is still
limbo, and the Constrictor waits in a system rather than between two.

**Four things it found were not in the plan.** An override must not draw, and the
Thargoid ambush is what says so. The number is not consulted behind an override.
A draw made to fill it moves the ambush from **three Thargoids to two**. The
ambush rolls off the next values of the same stream. An override
raised at a dock takes effect at the NEXT arrival. That is the arrival-only rule
working rather than a hole in it: the sky you launch into is the sky you docked
out of. Witch-space picks its tech branch from the system you jumped FROM,
because a mis-jump does not move `commander.systemIndex`. And **21 of the 23 sets
file no Thargoid**, so limbo flew M3's empty-band fallback until now. The ambush
is by a ship the set in force did not file.

`test/blueprint-override.test.ts` is 21 assertions, and all four gates were shown
to fail. `npm run check` passes at 4,344 assertions, and `npm run roster-probe`
is unchanged — the probe walks the number, and no override fires on that path.

**138 M3** — every system does NOT fly the same roster now. A commander who jumps
draws two random bits from the seeded stream. The four inputs pick one of the 23
released blueprint files, and that file says which designs turn up. The set is
saved state, so a reload comes back to the reception the save was taken in.

**Three of the four things it found were not in the plan, and the first one
inverts the plan's own headline.** M1 measured variety as distinct designs over a
career, got 17, and told M3 to raise it. It could not rise. 17 is every pirate
design Harmless files, every one is filed by some set, and the census is a
union. So 17 was already the ceiling. What the choice buys is the opposite shape. **A
band of 4.4 designs per arrival where there were 17, over 23 distinct pirate
rosters.** The probe reads both now, because they answer different questions.

The second is where the damage guard had to be read. **No pirate in the game
comes through the band uniformly.** `spawnPopulation` picks a threat tier from
how attractive a target the commander looks. So a narrower band alone leaves the
one band this item is about untouched. On the path the game
actually spawns on, tier 1 rose. **Tier 2 fell 2.9% and tier 0 fell 7.3%.**
Every minimum and maximum is unchanged. Tier 0 is the opportunist a poor
commander draws, and it is the tier meant to be beatable.

The third answers the question M1 said M3 had to answer. M1 warned that a set
filling its pirate band with light designs only would breach the regeneration
floor. **It cannot, and the reason is structural rather than lucky.** M3 narrows
which designs turn up and never touches a build. So the softest pirate any tier
can send is the same ship it always was.

**Twelve of the 23 sets empty a threat tier, and four bands are empty
somewhere.** 21 sets file no Thargoid. Set J files no trader Harmless flies.
Sets L, O and U file no bounty hunter. One rule covers all of it: where a set
files nothing for a job,
the full roster answers. A set does not get to downgrade the threat rule, and the
measurement says what letting it would cost — 9.5% off a tier-2 hit.

**139** — the item Chris found by flying it, and it closes on a decision NOT to
change anything. M1 and M2 landed on 2026-08-11: the probe that measured time on
aim, and the regen cut that made a shield face reachable. **M3 was the aim, and
the answer is no.** The figure that made the aim look broken was 85.6° off her
in a knife fight. That is six times the firing gate. `npm run aim-probe` prints
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
on her is a pilot that cannot point. `on your six` is pure pursuit, which takes
no lead against a commander who out-turns it. `closing` aims beside her on
purpose, so that the run clears the hull. So "widen `NPC_FIRE_GATE`" and "fix the
aim" both mean "delete a designed behaviour". Confirmed at 600 episodes, at 200,
and on a second seed grid, with every share inside 0.5 points.

**Four reasons it stays where it is**, and they are in the plan doc. The regen
already bought both decisions the item recorded. A lone pirate still loses, and
bills her about 19% of her pools. A tier-2 gang of three reaches ENERGY LOW
in 49.5% of fights and kills her in 35.5%. A perfect gun is a further factor of
four to thirteen, and the plan forbids a move to regen and aim in one
measurement. `pursuit.ts` is shared with the player's own bought combat computer,
so a lead term is two balance changes on one edit. And invariant 5 makes the
flight model the world every pilot was fitted in, which a constant was not.

**The lever is recorded so that nobody has to find it twice.** It is the missing
lead in `pursuitAim`, which returns the target's own position where the attack
run leads with `leadTime`. It is not a defect, it is not urgent, and it needs its own
item. **No game rule moved in M3**, and the pairing proves it — the M2 tables came
back byte-identical beside the new one.

## What landed on 2026-08-12

**141** — the house style, and the reader it is for. ASD-STE100 Simplified
Technical English is a controlled language for one reader. That reader must act
on a written instruction, and cannot ask the author what it meant. That reader is the
one this repository has. All four milestones landed in a day, over **four rule
docs, six reference docs and all 61 files of `src/constants/`**.

The four rule docs came first. They are read at the top of every session, and
the code cites them **107 times by invariant number**. All 15 invariants keep
their numbers and their claims. All 107 citations still resolve, and the seven
doc paths that `src/`, `test/` and `tools/` name are unchanged at the same
counts. The convention was written second on purpose, as a `## Prose` section in
`CLAUDE.md`: M1 is where it becomes clear which rules bite here. The half that
matters more is the list of what it never touches:

- code, and an exact command or error string;
- anything quoted from a person;
- a record of what was decided or measured;
- `README.md`'s opening, and the player-facing pages;
- `CATALOG.md` by hand.

`DAMAGE-PATHS.md` went last, and its 25-row inventory was not edited at
all, because `test/damage-paths.test.ts` reads that table. The constants were
edited at their source and regenerated. **374 exports and 54 rule ids** are both
unchanged, and that is what says the pass changed prose and not rules.

Four things came out of it that the plan did not have, and all four are in the
plan doc. A dated report pins its own text, so `JAMESON-TRIALS.md`'s "left as
written" note now says what is true instead. `TACTICS` had no JSDoc, because
`constants:check` is diff-scoped and an export can sit undocumented until
somebody edits its file. **Two quotations attributed to `CLAUDE.md` are no longer
in it.** The commit that slimmed the agent context took them out. They are
left verbatim, because a quotation rewritten is falsified. And `docs/PROCESS.md`
still cites a "step 3" that went with the cycle orchestrator on 2026-08-09.

The plan's own open question is answered by `CLAUDE.md`. Its `## Style` line
already covered "TODO items", so the convention keeps them. The "a record of
what was decided or measured" exclusion is what holds the plan archive and the
logs out. Commit messages are still unnamed either way.

**Both of the last two closed on 2026-08-13**, on Chris's call — remove the stale
quotes, and fix up the process. There were four attribution sites, not two. A
quotation of a rule that no longer exists cannot be repaired by a rewrite. So
each claim is now the host document's own, and `BROWSER-TRIALS.md` says in its
opening that it is the rule's home. `DEVLOG.md` and `TRAINING-LOG.md` name
`CLAUDE.md` six more times and are deliberately untouched, because they are a
record. `docs/PROCESS.md` has its four steps back. They are written around the
loop that runs now, rather than the cycle orchestrator that was deleted. So
"see step 3" resolves for the first time since 2026-08-09. Step 3 is the tiers:
`npm run check` always, and a table of what runs beyond it. One row of that
table is the case M4 met. **A doc comment in `src/constants/` is the `Purpose`
column of `CATALOG.md`**, so a prose-only edit still leaves the catalogue stale.

**140** — GitHub #24, and the one cost a jump spends that no screen named. All
four milestones landed in a day. The day itself now sits in three places. They
are the COMMANDER screen between fuel and cash, the docked menu, and a fourth
topbar span. So it ticks in flight where a jump moves it. Both charts price the
jump under the cursor in days. Beyond the tank they estimate the whole journey,
over a Dijkstra across full-tank edges in `src/galaxy/route.ts`. It is a full
tank because fuel costs money and no days. And a world you owe a contract to carries an amber diamond
and a verdict: `DUE IN 6 DAYS · 3 DAYS AWAY`, or `TOO FAR` in red.

Four things the plan did not have came out of it, and all four are in the plan
doc. The map is far sparser than the estimate, at 6.6 neighbours a system. Some
destinations have no route at all, and shipped galaxies hold them. The plan's
red rule was one day out, because settlement pays a delivery that arrives ON the
deadline day. And the marker needed a recording canvas that did not exist.
`inert-dom.ts` gives a painter a context that returns undefined. So a mark drawn
nowhere and a mark never drawn looked the same from every test.

**Flown by Chris on 2026-08-12 and confirmed good** — *"display is good"* — which
was the last item of the plan's Verification. Two things needed a pilot rather
than a probe. Does a fourth topbar span read well in flight? Does the
contract marker crowd a chart that already draws eight things?

## What landed on 2026-08-11

**137** — the last thing in the docking computer that still moved when nothing
asked it to. The roll overshot every bank it was given, and rang round it at
about a reversal a second. A proportional ask driving a rate ramp is a
second-order loop with **no damping term**, at a damping ratio of 0.38.
`DC_ROLL_LEAD` asks for where the error WILL be a tenth of a second ahead. The
median approach goes from 18 roll reversals and 1.9 turns swept to **12 and
0.9**, on two independent grids. The second half is what the ring hid. Damping
it alone took the wings at the letterbox from 7.5 degrees off the slot to 8.8,
and that was the fix working. 7.5 was a ±40-degree swing sampled wherever the
letterbox caught it, rather than a ship sitting 7.5 degrees off. A ship that sits
where it is asked sits at whatever `DC_SLOT_MARGIN` allows. So the margin became
measurable for the first time and moved with it, 0.5 → 0.30, chosen at the knee
rather than the floor. **The wings arrive 4.4 degrees off the slot in a median
approach and 13.8 at worst, from 7.5 and 30.0.** Docked, scrapes, seconds
and the plan's jump column are unmoved, and traffic is still clean. It cost the NOSE 0.9
degrees in the median — the same bank spending itself twice. **Flown by Chris on
2026-08-11 and confirmed good**, which closes the docking-computer sequence that
ran from 126 through 134, 135 and 136 to here.

**136** — the approach is a PATH now, and the defect Chris reported by parking on
the far side of the station is gone. **No approach in 504 has a plan that jumps
more than 20 degrees, against 223 of them.** The worst went from a full 180 to
1.1. His own case took 28 seconds and ten full-authority pitch reversals; it
takes 16 seconds and one. The shape is the whole of it, and it is four things:

1. a fixed stand-off funnel that holds the gate distance from a quarter turn
   round to astern;
2. a maximum against the ship's own way in through where it actually is;
3. a straight run in from three fifths of the gate;
4. an aim one lookahead along.

So the stand-off, the way round the hull and the run in stopped being three
answers with thresholds between them. Everything else came with it: median 19.4s
→ 16.4s, 1 scrape → 0, pitch reversals 5 → 4, and traffic collisions 1 in 80 →
0. Two rounds of Chris flying it are in the plan, and in two new columns of the
probe. The first is how far off the slot the ship is still POINTING as it goes
through (13.6° → 5.4°). The second is how far its WINGS are off the letterbox
(20.4° → 7.5°, against 37° of tolerance and the old approach's 1.7°). That last
gap was the roll ring, which is 137 above.

**134** — #23, and the one thing `dock-probe` was never asked to measure. The
autopilot rolled hard over and back every 0.45s while its nose was dead on the
gate heading. It chased the direction of a vector whose length went to zero.
`nose × heading` is degenerate exactly when the controller succeeds. It got past
126 because the probe scored docked, seconds and scrapes, and all three were
fine. **Docking well and flying well are different claims, and only the first had
a number.** The fix is two gates rather than the one the plan predicted, because
the obvious one alone only changes what the ship chases. Median approach: 17 roll
reversals → 8; 320/320 docked either way.

**132** — the four numbers that were holding the queue open, closed without the
flight they were waiting for. Each already had an anchor in the codebase, and
nobody looked for it. Nothing moved on taste: `DISREPUTE_HEAT` became
`SALE_NOTORIETY_MAX` (its own doc named that constant in words), and the other
three kept their values and gained gates.

**131** — 127's own finding, and it turned out to be arithmetic rather than
feel, so it did not have to wait. A sale of a rescued pilot paid 2–16 Cr, and
filed a record costing 25 Cr to clear. That is strictly dominated, so the forced
choice 127 built had three branches and two answers. `SURVIVOR_SALE_TONNES` is what a
person is worth on the Slaves row, and its value is bracketed from both sides by
measured rules rather than chosen.

**130** — the third sighting of one defect, and the last one left on the
console. `raiseLegal` said `LEGAL STATUS: FUGITIVE` and `callStationDefence` took
the console away three lines later, so becoming a Fugitive was never read by
anybody. It is `recordVerdict`, queued, behind a launch that queues too: **what
you did → what the sky did about it → where you now stand**. The string is
deleted rather than moved. So are the two copies of the verdict that the scan and
the survivor sale wrote out for themselves. There is one home now, and five
deeds spend it.

## What landed on 2026-08-10

Eight plans in a day, and they are one argument in sequence: a consequence that
is invisible is indistinguishable from nothing happening.

- **122** gave the police scan a window and a verdict. **123** gave you a way to
  buy it off. **128** put both on the console at the moment they matter, priced,
  with the key read off the binding table. It also turned that rule on the rest
  of the game, so `test/key-prose.test.ts` fails on any message in `src/game/`
  that spells a bound key.
- **129 M1** finished the thought for the Character ladder: seven deeds moved a
  score nobody was shown.
- **127** made the one genuinely moral act in the game cost something. Docking
  used to file a rescued pilot with station medical in the same breath as
  resetting your shields. It is a forced choice now: hand them over, sell them,
  or take money to let them go. A sale is an offence the Government notices.
- **126** made the docking computer fly. It wrote `player.quaternion` directly,
  so it turned about an axis no stick can produce, and no instrument saw it
  move. `npm run dock-probe` is the 320-approach measurement that says the fix
  still threads the letterbox.
- **121** and **124** came first: the test-mode door, and a way out of a flight.

## Backlog

Not executable yet. In priority order; promoting the head is what makes the
next execution item, once it has a plan doc.

**One item now, and it belongs to one programme: decompose the files that hold
more than one responsibility.** Chris set the rule on 2026-08-14, in two parts.

> *"The rules should be single responsibility - files that have multiple
> responsibilities are the problem. And then it's all about decomposing large
> files."*

> *"Single responsibility does not mean put everything in one file. A file can
> import child files. The key is to keep files small so they can be easily
> understood."*

**The second part is what makes these items look different from a size cleanup.**
The target is not a shorter file. It is a small parent beside the children it
composes. "These parts belong together" argues for one DIRECTORY, and never for
one file.

`tools/sizes.mjs` states both rules now. Its 400-line ceiling is framed there
as a DETECTOR rather than as the rule, because a file rarely reaches 400 lines
doing one thing. A 900-line file that does one thing is fine, and a 200-line file that does
three is wrong and this gate will never see it.

**Ranked by cost, which is lines multiplied by commits.** The gate's own header
says the price of a big file is where parallel work collides. So churn belongs in
the ranking, and pure size does not.

**`src/game/game.ts` came off this list on 2026-08-14.** It was the head, at
2,528 lines and about ten responsibilities. docs/TODO/150 took five subjects out,
and docs/TODO/155 split the orchestrator itself. It is 1,233 lines over nine
children, and it states one responsibility: *which mode the game is in, and who
gets the frame*. **The programme's method is written down in 150's plan doc**,
and the item below should use it:

1. measure lines of body against external dependencies;
2. set the appliers and the host literals aside first;
3. count what an area is reached BY as well as what it reaches;
4. read the result before you trust the ratio.

**`src/game/npc.ts` came off this list on 2026-08-16**, and it is
[169](169-npc-ts-holds-behaviour-and-brain-flight-in-one-file.md) in the queue above. The sweep
that promoted it measured the file, and the measurement corrected this entry
twice. The file is 1,632 lines over 99 commits, not 1,568 over 95. The split is
not the two halves this list named. The flight half is 244 lines of the class,
and the smallest of four candidates. The fleet queries are 101 lines, with
the widest readership in the file.

1. **The self-declared pairs.** Each names more than one responsibility in its
   own words, so none needs an investigation to justify. **The line counts below
   were re-measured on 2026-08-16**, and all three drifted:
   - `src/ai-training/scenario.ts` — 1,574 lines, 35 commits: *"one Episode
     **plus** its four fitness functions"*. Running a fight and scoring one.
   - `src/game/combat-sim-report.ts` — 1,167 lines, 23 commits, and its own
     module header says *"it covers **two things** a console harness used to"*.
   - `test/campaign.ts` — 1,026 lines, 32 commits, and the thinnest reason in the
     list at 48 characters. About four: simulate a career, choose trades, resolve
     encounters, report.

**`src/hud/hud.ts` is a second, smaller candidate.** It is 633 lines over 31
commits. **This entry claimed that it had no module header, and that was
wrong.** The sweep of 2026-08-16 found one at lines 12 and 13: *"The classic
console: elliptical 3D scanner (dot + vertical stick per contact), station
compass, gauge bars, and the message line."* That header names four things and
no neighbour. So it states a subject rather than one responsibility. Judge it on
the four things, and not on an absence.

## What is NOT in this programme, and why

**Three exemptions survive the rule**, and they are the only three that cannot be
a parent plus children. `test/playtest.js` is a console paste that literally
cannot import. `elite-a/slots.generated.ts` and `music-danube.ts` are
generated tables where a split loses the diff.

**The other 27 argue cohesion**, which no longer clears the bar. That does not
make 27 files urgent. It makes 27 REASONS untrue as written, and the items above
are where the cost actually is. The rest can be re-argued or decomposed as each
is next touched.

`docs/TODO/149` is the worked example of the whole programme. `ui/screens.ts`
went from 1,954 lines to eight files, none over 340. Its exemption came off
rather than a reword.

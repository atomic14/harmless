# 173 — The burst carries on from the pirate into the police ship

**Kind:** defect · **Severity:** medium · **Size:** medium · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** #35

## What landed, 2026-08-17

Both milestones landed the same day. The investigation ran before the plan, so
every fact in "Where we are" is a measurement. The work then found five things
the plan did not have, and two of them corrected the plan.

**M1 gave the console the line it never had.** `harmVerdict` (game/law.ts) is
the rule and `HARM_LINES` (constants/law.ts) is the vocabulary. The set of
covered roles comes from `offenceFor`, so this file restates none of it. That is
`recordVerdict`'s own shape, which assembles itself from `lawTakesInterest`.

**The trigger is the latch, and it needed no new state.** `combat.ts` reads
`provokedByPlayer` before the hit and again after. A false-to-true move is the
first shot that ship took from the commander. So the line is said once per ship,
however long the fight runs.

**A hit that DESTROYS the ship says nothing, and the plan did not have that.** A
dead ship comes for nobody, and `destroyShip` has its own words for it. Without
the guard the console would promise a fight with a wreck.

**The measured order is now the one docs/TODO/130 asked for**:
`POLICE SHIP HIT — AND NOW HE IS COMING FOR YOU`, then
`STATION DEFENCE LAUNCHED`, then
`LEGAL STATUS: OFFENDER — BOUNTY HUNTERS WILL ATTACK YOU`.

**M2 turns the shot into a MISS before anything reads it.** `inTheFireball` is
the whole rule. The beam, the flash, the offence and the damage therefore all
agree that the shot did not get there. A branch further down leaves the cockpit
beams converging on a ship that took nothing.

**THE NUMBER IS DERIVED, AND THE PLAN'S PREDICTION WAS WRONG.** Over 593 seeded
kills with the grace off, 12 melees turned a Viper hostile. Eleven of the twelve
came AFTER the kill, and every one of those landed between 0.25 and 1.00 seconds
of it. The twelfth came BEFORE the kill, and no grace covers that one.

| melees | strays, grace off | strays, grace on |
| --- | --- | --- |
| 40 | 2 | 1 |
| 200 | 3 | 1 |
| 593 | 12 | 1 |

**The plan promised 0 of 200, and that was the wrong promise.** A span cannot do
better than the trigger release it bets on. With a half-second hold after the
kill, the span leaves only the stray that happened before it. With a full-second
hold it leaves six, and four of those land in the frame the span lapses. That
cluster is the probe's own release time rather than a fact about players.

**THE STATION TRUCE WIDENS THE COVER, AND THE PLAN DID NOT HAVE IT.** Inside
`STATION_TRUCE` an unprovoked pirate is not hostile, so it is a bystander too.
That follows the truce rather than widening this rule. Out at the witchpoint a
queue of pirates costs nothing at all. The second of two died 4.38 seconds after
the first, with the span off and on alike. Near the port the same measurement
reads 4.38 against 5.13.

**A SHIPPED FIXTURE CAUGHT IT, AND THAT IS THE FIND.**
`test/snapshot-migrate.test.ts` kills five pirates half a second apart, near the
station. Two of the five were absorbed. Its fixture paces past the grace now.
The rule that block pins is that five kills take a rung. It is not the cadence
they arrive at.

**`ShipSystems` needed no migration, and the shape of the restore is why.**
`Persistence.restore` assigns a snapshot onto a `freshSystems()`, so a version 3
save that names no `wreckGrace` keeps the 0. That is docs/TODO/167's NaN trap,
answered by a structure rather than by a version bump.

**`combat.ts` crossed 400 lines, and an exemption was the dishonest answer.**
The file CAN be a parent plus children, which is the `ALLOWED` list's own bar.
`destroy` and `wreck` are `combat-wreck.ts` now, at 155 lines against 343 left
behind. One file says what a shot found and what the hit costs. The other says
what a destroyed ship pays and leaves in the sky. Two delegators keep all four
call sites outside the file unchanged.

**Ten unrelated constants gained `@rule` ids.** That is docs/TODO/160's
situation again: the value 1 is shared eleven ways and only three carried one. A
derivation was the other remedy, and it is dishonest here. Nothing this span is
made of belongs to another constant.

**`test/lawful-hit.test.ts` is 37 assertions through the real Game.** Proved
able to fail three ways, each alone. The line suppressed reddens exactly the
five console claims. The span at zero reddens the fireball claims. The role test
widened to any ship reddens the narrowness control by itself.

**THE BREAK-IT STEP FOUND A VACUOUS CLAIM, AND THAT IS WHY IT IS RUN.** The
held-burst loop first took its length from `WRECK_BURST_GRACE`. At a span of
zero it fired no shots at all and passed. The fixture holds half a second by
hand now. The length of a burst is a fact about a pilot rather than about the
span under test.

**`survivability` and `aim-probe` are byte-identical.** **`defence-probe` is NOT
evidence**, and the plan was wrong to name it. It loads no trained weights and
says so: the shipped defence is hand-written code that the tool cannot fly.

**Two things are reported and not fixed.** `recordVerdict` still names the
record's pursuer rather than the ship with the grudge, and M1's line is what
answers a player's question instead. And `provokedByPlayer` still never clears,
so a fine does not call off a Viper. Both are docs/TODO/158's design.

4,790 assertions.

## Where we are

Chris flew it and reported two sentences: *"I was attacked by a pirate and a
police ship was there. I destroyed the pirate and the police started attacking
me."*

The triage of 2026-08-16 accepted the report. It ruled out the pirate kill
itself, and it named two candidate routes. It measured neither. This section
holds the measurement it asked for. A throwaway probe flew the real `Game` under
node, with the real step and the real gun.

### The burst carries through the wreck, and that is the cause

A pirate sat 500 units off the nose. A Viper sat 1,400 units off the nose,
directly behind it. The commander held the trigger.

1. the pirate died at frame 525;
2. the beam reached the Viper at frame 540;
3. the legal record went from Clean to Offender;
4. `provokedByPlayer` latched on that Viper;
5. the station launched its defence fleet.

**Fifteen frames is 0.25 seconds, which is one pulse-laser cooldown.** So the
very next shot of the burst hit the Viper. `traceShot` (`src/game/shot.ts:74`)
skips a dead ship at once, and `Combat.wreck` despawns the hull in the same
frame it dies. Nothing stands between the beam and whatever was behind the
target.

**The report's own order of events is this order.** The pirate dies, and then
the police attack.

### It is a small share of fights, and it is measured at two sizes

A flown melee put a pirate 600 to 1,080 units off the nose, and a Viper 1,100 to
1,700 units off it. The commander tracked the pirate, and held the trigger for
half a second after it died. The aim stayed where the pirate was.

| seeds | pirate killed | Viper provoked | after the pirate died |
| --- | --- | --- | --- |
| 40 | 39 | 2 | 2 |
| 200 | 198 | 3 | 3 |

**Every single occurrence came after the pirate was already dead.** Route 1 of
the triage is the live route, and the burst is what walks it. Route 2, the
station defence fleet, is a CONSEQUENCE of route 1 rather than a second cause.
It also announces itself, so a player is told about it.

### The console can say nothing at all

Three flights, each one a single graze on a Viper:

| the commander | the console |
| --- | --- |
| Clean, near the station | `STATION DEFENCE LAUNCHED` then `LEGAL STATUS: OFFENDER — BOUNTY HUNTERS WILL ATTACK YOU` |
| Offender, out at the witchpoint | `TRADER SIGNATURE DETECTED`, and nothing else |
| Offender, fleet already out | nothing at all |

**No line names the ship that was hit, in any of the three.** `raiseLegal`
speaks only when the record MOVES, and `callStationDefence` latches on
`session.defenceLaunched`. Both rules are correct and both are load-bearing. The
gap is that neither one is about the hit.

**The one line that does appear names the wrong pursuer.** `recordVerdict` is
assembled from `lawTakesInterest`, which reads the RECORD alone. At Offender it
says that bounty hunters will attack. The ship that shoots at the commander is a
police Viper, and it shoots because of a grudge that no line mentions.

### The grudge has no exit a player would find

`provokedByPlayer` never clears. After sixty seconds of flight the flag holds.
With the legal record put back to Clean by hand, `isHostileToPlayer` still
answers true. A bribe and a kill are the two exits, and the fine is not one of
them.

That is docs/TODO/158's design rather than a fault. A station that called off a
provoked Viper would make the port a free firing position. **This item does not
change it.** It is written down here because it is what makes the defect cost a
whole flight rather than a moment.

### How wide the beam is, for the record

The graze pass runs only where the ray struck nothing. Its cone is the
silhouette plus the aim assist. Measured against a lone Viper, with an empty sky
behind it:

| range | widest offset that still hits | angle |
| --- | --- | --- |
| 400 | 30 units | 4.29° |
| 900 | 48 units | 3.05° |
| 1,400 | 48 units | 1.96° |
| 2,000 | 42 units | 1.20° |

**Do not read this table as the defect.** In a melee the ray finds the pirate,
so the graze pass never runs. The table says how much room the beam has once the
pirate is gone.

## What to do

Two milestones, in this order. M1 is a line and changes no rule. M2 changes a
rule of the fight.

### M1 — the console says what the shot hit

Add one line, on the frame a player laser hit turns a lawful ship against the
commander.

**The trigger is the latch, and it fires once per ship by construction.**
`NpcShip.takeLaserHit` sets `provokedByPlayer`. Read the flag before the call
and read it after. A transition from false to true is the first hit that ship
took from the commander. A second hit says nothing, so a fight cannot shout the
line down its own length. That is `raiseLegal`'s "only a MOVE speaks" rule,
applied to the ship rather than to the record.

**The role set is `offenceFor`'s, and it is not restated.** Police, trader and
hunter are the three roles the law protects. A pirate, a Thargoid and a rock get
no line, because no player is confused about shooting one.

**The words name the ship and the consequence**, on Chris's standard of
2026-08-16: *"if this was the first time I saw this string — would I know what it
meant."* Three strings, because the three roles answer differently:

- `POLICE SHIP HIT — AND NOW HE IS COMING FOR YOU`
- `BOUNTY HUNTER HIT — AND NOW HE IS COMING FOR YOU`
- `TRADER HIT — AND THAT IS AN OFFENCE`

The first two reuse the bribe refusal's own clause (`law-actions.ts:289`). One
word, one meaning: a provoked policeman comes for you, and the game already says
it that way. A trader gets the third string because `isHostileToPlayer` excludes
the role. A provoked trader flees, so a line that promised a fight would lie.

**It is said FIRST, ahead of the launch and the record.** docs/TODO/130 fixed
the running order once: what you did, what the sky did about it, where you now
stand. This line is the "what you did" half, which the console never had for
this deed.

### M2 — the fireball takes the rest of the burst

The commander's own shot destroys a ship. For a short span after that, a player
laser hit does not register on a **bystander**. A bystander is a ship that is
not already in the fight with the commander.

**The precedent is `POD_LAUNCH_GRACE`, and its doc comment already argues this
case.** It reads: *"a beam laser fires 10 times a second, and a held trigger
outlives the kill by about a second."* That sentence is about the capsule at the
wreck. It is equally true of the ship behind the wreck, and this milestone is
the second half of the same idea.

**"Already in the fight" is `isHostileToPlayer`, and it is not restated.** A
pirate is hostile by role, so a queue of pirates costs the commander nothing at
all. A police ship the commander already provoked stays shootable. Only a
bystander is covered, and a bystander is exactly what the report is about.

**The span is a new constant**, and it is not a second reader of
`POD_LAUNCH_GRACE`. The two must stay free to move apart. Give it its own
`@rule` id if the value collides. Follow `CLAUDE.md`'s constants procedure:
`npm run constants:find` first, then the doc comment, then
`npm run generate:constants`, then `npm run constants:check`.

**Size the span from the measurement rather than from taste.** 0.25 seconds is
the gap the aligned probe measured, and that is one pulse-laser cooldown. A beam
laser fires every 0.1 seconds. The number must cover a human trigger release,
which is what the pod grace calls "about a second". Measure what each candidate
costs a real melee before you choose. The plan's expectation is 1.0 seconds.

## Decisions already made

- **The offence stays.** A commander who shoots a policeman on purpose is an
  Offender. Nothing here softens that.
- **The grudge stays permanent within a flight.** docs/TODO/158 decided it, and
  the reasoning holds.
- **The fine still does not call off a provoked Viper.** Same reason.
- **Route 2 needs no work.** The station defence fleet announces itself, and it
  only launches because route 1 moved the record.

## Open questions

None. Each question the triage left is answered above by a measurement.

## Watch out for

- **`test/damage-paths.test.ts` and `docs/DAMAGE-PATHS.md`.** M2 adds a case
  where a registered hit does nothing. Check whether the inventory names it.
- **The combat trainer.** `combat-sim-safety.ts` stubs `raiseLegal`, and
  invariant 5 says a simulated kill reaches no career. M2 must not give the
  arena a different fight from the game. Training uses the real rules
  (`CLAUDE.md`).
- **`src/game/combat.ts` is 368 lines.** M2 adds state and a rule. Watch the
  size ceiling, and read the file's own header for the seam it already names.
- **The line's ORDER.** A `say(...)` is immediate and a `later(...)` is queued.
  M1 must not take the console from `STATION DEFENCE LAUNCHED`, which
  docs/TODO/130 put behind the deed on purpose.
- **`test/record-line.test.ts`.** Its blocks count `LEGAL STATUS:` lines in a
  console that M1 adds a line to. Read it before M1 lands.

## Verification

The gates always run: `npm run check`.

The tier table puts M1 at "nothing more". It puts M2 at "a rule that changes how
a fight goes", so M2 also runs `npm run defence-probe` and
`npm run survivability`. Both must be byte-identical, because neither one flies
a player gun at a bystander. A move in either is evidence that the grace reaches
further than the plan says.

**A new test file, `test/bystander-hit.test.ts`.** It drives the real `Game`
under node, as `test/record-line.test.ts` does, because the claim is about what a
pilot reads. It holds these claims:

1. the aligned burst kills the pirate, and the next shot does NOT register on
   the Viper behind it;
2. ...and the Viper is not provoked, and the record does not move;
3. a deliberate shot at the same Viper, outside the grace, DOES provoke it;
4. a second pirate behind the first is still shot, so the grace costs a melee
   nothing;
5. the console names the ship on the first hit, for each of the three roles;
6. ...and says it once, however many hits land;
7. ...and says it AHEAD of `STATION DEFENCE LAUNCHED` and the record line.

**Prove each gate able to fail, and each one alone.** For M1, delete the line and
watch claims 5 to 7 redden alone. For M2, set the span to zero and watch claims 1
and 2 redden alone. Claim 4 is the control that the grace is narrow: put the
role test back to "any ship" and it reddens by itself.

**Report the frequency again after M2**, with the same 200-seed melee this plan
measured. The expectation is 0 of 200 against the 3 of 200 above. Check it at 40
seeds as well, because a sampled number needs two sizes (`CLAUDE.md`).

# Combat training simulator

Built and shipped: `T` at any station. The arguments here — the one rule, the
three enforcement layers, what NOT to do — are the reasons the code is shaped
the way it is. Enforcement lives in `src/game/combat-sim-safety.ts` and the
scenarios in `src/game/combat-sim-scenarios.ts`.

A station facility, reachable from the docked menu, that puts you in a fight
against opposition you choose, in a ship you choose, and hands you a report
afterwards. It is the real game — real flight model, real brains, real guns —
not a replay of a training episode.

Three audiences, and the design has to serve all three:

1. **A pilot** practising, and learning what a Fer-de-Lance does differently
   from a Sidewinder.
2. **Chris** playtesting combat balance without flying to find a fight.
3. **The trainer.** Every exercise exports a record, and those records are what
   tell us whether a brain that wins in `evolve.ts` also wins against a human —
   the check CLAUDE.md's "threat is not fun" exists to make, since a brain
   judged only by other brains and bots can win every measurement and lose the
   only one that counts.

## The one rule

**Nothing that happens in the simulator leaves it.**

The load-bearing case, in Chris's words: **it must not advance you toward
E L I T E — that requires real kills.** Concretely, a simulator kill must not
touch either of:

- `commander.kills` — the body count on the status screen
- `commander.combatScore` — what `rating()` reads, and therefore the whole
  Harmless → E L I T E ladder

Those are two separate fields for a reason (`killValue()` weights a kill by
threat tier, so the rating counts difficulty and not bodies), and a simulator
that credited either would hollow out the only long-term progression the game
has. It is the one thing here that would be unforgivable to get wrong: a player
could grind the ladder in a training room, for free, at a station, with no risk.

Everything else is the same rule applied:

- no save writes — autosave suspended, the world blob untouched
- no credits, no bounty, no contract progress, no legal status
- no cargo or equipment lost to a hull breach
- missiles, fuel and E.C.M. charges restored on exit
- death ends the exercise, not the career: no escape pod, no run over

**This wants a test, not care.** `combat.ts`'s `destroy()` is what increments
both fields, and it is reached from four places. Assert that a full simulated
engagement — kills, deaths, breaches, bounties — leaves `kills`,
`combatScore`, `credits`, `legalStatus` and the save blob bit-identical.

### How it is enforced

Refusing `destroyNpc` is not the mechanism, and it is not the mechanism for the
most common kill in the game. Verified:

- `Combat.fire()` in `combat.ts` calls `this.destroy(commander, shot.ship)`
  **internally**. A laser kill never passes through `StepHost.destroyNpc`.
- the energy bomb calls `Game.destroyNpc` from `Game.runCommand` in `game.ts`,
  not from the step.

A host that refused `destroyNpc` and nothing else would credit the career for
almost every simulated kill. So the layering is:

1. **Primary: swap `state.commander` for an exercise-only clone.** `Combat`
   takes the commander *per call, deliberately* — its own comment says so,
   because a held reference "would quietly start crediting bounties to a
   commander who no longer exists". Passing a different commander is an intended
   capability, and it is the only thing that covers the internal call. It also
   covers what the step writes directly and never asks about: `survivors`,
   `cargo` on scooping, `fuel`, `missiles` via `Ordnance.launch`.
2. **Second layer: the alternative `StepHost`** — 1 pass-through
   (`wreckNpc`), 5 redirects (`inFlight`, `applyPlayerDamage`, `destroyNpc`,
   `fireLaser`, `die`), 6 refusals (`raiseLegal`, `dock`,
   `completeHyperspace`, `completeRescue`, `openHermitTrade`, `autoSave`).
3. **Third layer: the entry snapshot.** `persistence.capture()` on entry,
   `restore()` on exit — which also puts the rng stream back exactly, since
   restore does that last.

**`die()` must never be reached, and this one is data loss rather than a leak.**
`Game.die` drops the career's in-flight autosaves — deliberately, so "death is
not optional if you refresh". A simulated death reaching it would delete real
ones.

## Scenarios

Selectable, named, each a data entry rather than a code path:

| scenario | opposition |
| --- | --- |
| Lone bounty hunter | 1 hunter, drawn from the released bounty-hunter slot band |
| Single pirate | 1 pirate, tier selectable |
| Pirate pair | 2 pirates, same tier |
| Pirate gang | 3-4 organised pirates flying the pack policy |
| Police interdiction | 2 Vipers — what shooting a trader actually buys you |
| Thargoid ambush | 2-3 Thargoids plus Thargons, the witch-space fight |
| As they come | asks `pirateThreat()` (`game/threat.ts`) what the galaxy would send at your real mark right now, and sends that |

"As they come" matters most for balance: it is the only way to sample the fight
the live game would generate for a commander in your exact state, without flying
until one happens.

### Where the fight opens

The approach is the most informative part of a fight, because it is where a
brain shows whether it commits or loiters. So the opening is authored per
scenario in `game/combat-sim-opening.ts`, which also owns `arenaCentre` (where
the fight happens at all):

| | opening |
| --- | --- |
| six of the seven scenarios | **ahead**, ring at **4,500**, cone 8 degrees half-angle |
| Thargoid ambush | **astern**, ring at **2,400**, cone 30 degrees |

4,500 is not a preference. It is outside `NPC_LASER_RANGE` (3,500) even after
the spawner's -15% scatter, so nobody shoots before the approach; inside
`PLAYER_INTEREST_RANGE` (9,000), where an NPC starts caring about you at all, so
it is an approach and not a stare; and far outside `PASS_FAR` (600), which
matters because the attack-run count starts a fight "outside" — a ship that
STARTS inside `PASS_CLOSE` would score a completed run the first time it left,
and one starting in the dead band between the two thresholds would have its
first approach half-measured. The ambush is deliberately inside their gun, which
is what an ambush is, and still clears `PASS_FAR` by four times over.

The cone is 8 degrees because the scatter spreads a ship between 0.55 and 1.45
of it off the axis: 4.4 to 11.6 degrees, comfortably inside a 60-degree
field of view and off-centre enough that a gang is a spread rather than a stack.

The record carries `opening` — the arc, the range and cone asked for, the
nearest and furthest ship as they actually landed, the widest bearing off your
nose, and whether every one of them was in view. That is what makes a fight
reproducible from its seed, and it is how the one scenario that opens behind you
reads as deliberate (`ASTERN … NOT IN VIEW`).
Career spawning is untouched: being jumped on the corridor to the station is the
game working, and `spawning.ts`'s `spawnPopulation` knows nothing about any of
this.

## Opponent selection and fit-out

One lever over the opposition. A pilot picks a scenario and a threat tier, and
picks which brain the pirates fly; nothing else about who turns up. The setup
panel is three groups: **THE FIGHT** (mode, scenario, tier, seed), **WHO YOU
FIGHT** (the one brain row), and **YOUR SHIP** (the fit-out).

**A brain row is named, not filed.** Its value is how the policy FLIES — `GETS
ON YOUR SIX`, `MAKES ATTACK RUNS` — behaviour, never a version or a file stem.
The one such row is **PIRATES FLY**, under **WHO YOU FIGHT**: the two CODE
pilots a commander can meet — the pursuit dogfighter the pirates fly by default
(the combat computer's own pilot, turned on them) and the hand-written attack
run (`PIRATE_CHOICES` in `screens/combat-sim-setup.ts`). There are no weights
files behind these — both are code. The names live in `game/brain-names.ts`
beside the one-line CHARACTER they were compressed from, which is what the panel
prints under the selected row — behaviour with the measured number that shows
it; the file stem sits in that note, for anyone cross-referencing
docs/TRAINING-LOG.md. The figures are the flight probe and the evaluation
tournament, archived under `train/logs/`; a value the picker offers with no name
AND no line fails `npm test`. The row also says where in the list it is — `(1 OF
2)`, since the list is two long — and HOME and END go to either end without
walking there.

Leaving the row on its first value swaps nothing: `GETS ON YOUR SIX` is the
pursuit dogfighter the pirates already fly out there, so it goes in as NO
override, and only `MAKES ATTACK RUNS` — the scripted run — is sent as a real
change. The choice is the fight's alone: `combat-sim.ts` applies it to
`state.brains` for the exercise and restores it when you undock. There is no
career-persisting brain row: the machinery for a live career selection exists in
`brain-names.ts` (`liveBrainSelection`/`liveBrainId`), but no UI drives it, and
everything on the panel dies with the exercise.

Your own ship: **fit-out override only, not hull.** The player's hull is four
hard-coded constants in `player.ts` (`MAX_SPEED`, `ACCEL`, `MAX_PITCH`,
`MAX_ROLL`) with no roster, and `FlightDemand.limits` can cap speed and accel
but not pitch or roll. Parameterising `PlayerShip` is a feature of its own AND
changes the world every pirate brain was fitted in, since `scenario.ts` reads
`PLAYER_FLIGHT` as its target. So v1 overrides your front and rear lasers,
E.C.M., energy unit, energy bomb, missiles and the combat computer — `state.cheat`
made legitimate and scoped — and the GAP-ANALYSIS entry says the hull is not
selectable. The combat computer is a YES/NO fit like the rest: it is the one
pilot the game flies on your behalf rather than at you, so fitting it lets you
watch it (launch, press K).

Picking the opponent's *brain* is what turns this into an A/B rig. Fly the same
scenario against the pursuit dogfighter and against the scripted attack run, and
the report answers which is more fun — the question CLAUDE.md says the numbers
cannot. The picker offers two — the pursuit dogfighter the pirates fly by
default and the scripted run, both code — and a candidate joins it by having its
weights put back and its name added (train/README.md).

## The report, and the export

Per exercise: the seed, the scenario, both loadouts, then —

- your accuracy and theirs; shots fired and hits
- damage both ways, **by source**. The two lists differ, because the two
  directions do: what can hurt YOU is laser / missile / ram / station /
  canister (`DamageSource`), and what you can hurt a SHIP with is laser /
  missile / ram / energy bomb (`DealtSource`, in `game/damage-dealt.ts`).
  Both are measured the same way — the points that actually came off the bank,
  so a warhead into a Sidewinder credits the 73 it had rather than the 250 it
  spent
- time to first kill, time to last
- median and closest engagement range
- share of the fight each side spent lined up on the other
- time you spent on their six versus theirs on yours
- shield and energy low-water marks
- a per-opponent line: hull, brain, how long it lived, what it landed
- and, beside every hull NAME, the ids it resolves to — your `shipId` and each
  opponent's `designId`/`profileId` (`src/game/ship-identity.ts`), so a record
  still says what was flown after a shipyard or a re-hulling exists

- and how the OPPOSITION flew: their speed, the SPREAD of the ranges
  they held — p10, median, p90, because a brain that commits sweeps through the
  band and a turret collapses it onto one number the median alone cannot tell
  apart — and their completed attack runs, a closure inside `PASS_CLOSE` and a
  break back out past `PASS_FAR`. Those two thresholds live in
  `src/constants/combat-record.ts` beside `SIX_CONE`, with the same
  justification, and both `combat-sim-report.ts` and `train/flight-probe.ts`
  read them from there rather than keeping their own.
  There is deliberately NO verdict, score or turret index attached: the report
  presents, the pilot judges

`envelope()` is the only measurement of the PLAYER's flight envelope (speed,
pitch, roll and engagement-range distributions), and `scenario.ts`'s
`playerCobra`/`playerCobraSlow` target hulls are fitted to it — the one input
that makes the trainer's target move like a human.

The human-flown report is the only answer to whether a brain is fun; the defence
brain is a bot, and `npm run survivability` remains the bot answer.

**The JSON is versioned** (`schema`, as `SNAPSHOT_VERSION` is). It is an
interface with an external consumer; a shape change would otherwise silently
break whatever reads `__simLog`. It is at **3**. Records from either side of a
bump cannot be compared, and `combat-sim-compare.ts` refuses to try. The damage
figures behind the current schema: a warhead is 250 pool points, a crossfire hit
is the firing build's own gun, and `you.damageDealt` and its buckets count
ordnance as well as laser (see docs/DAMAGE-PATHS.md).

**Export** as JSON — clipboard and downloadable file — plus an in-memory ring of
recent exercises on `window.__simLog`, so a console session or an agent can read
them without going through the DOM. The JSON is the deliverable: it is what gets
fed back into judging a training run.

**Two records, side by side.** The method above is an A/B — same seed, same
scenario, two brains. `←/→` walks the ring; ENTER holds the record you are on
against another one, as this / that / difference, and `C` / `X` take the PAIR
because the pair is the finding.

It is `combat-sim-compare.ts`, it is derived from two finished records, and it
adds no accumulation and no sampling. The load-bearing half is the REFUSAL: two
records on different seeds, scenarios, modes, waves, player fit-outs, opponent
counts, hulls, builds, tiers or roles — or from either side of a `schema`
change — are not an A/B, so it names exactly which fields differ, with both
values, and paints no difference column at all. Different BRAINS is the point;
different anything else is a confound. Matching brains are not refused but are
called what they are: a repeat of one fight, not a comparison of two. And there
is no verdict, no score and no colour by sign — the same refusal as the turret
index, for the same reason.

## Why it is a good agent test

Deterministic from a seed, ends by itself, emits a structured report, drivable
from `window.__game`.

## What NOT to do

- **Do not reuse `Episode`.** There the player is a target flown by a
  controller; here you are the commander in the real Game. Share the statistics
  layer, never the simulation.
- **Do not add a field beside `GameState`.** Simulator state is state.
- **Do not shift the career's rng stream** — enter on a fresh seed, restore on exit.
- Not a `window.__` handle. **But the exercise itself cannot be a screen.**
  `Game.mode` is derived (`screens.topId ??
  baseMode`) and `updateFlight()` runs only when `mode === 'flight'`, so while
  any screen is on the stack **the world does not step**. The screen is the
  front of house — pick a scenario, launch, read the report — and the fight is
  ordinary `flight` with a different `StepHost` behind it.
- **Teardown must be deferred.** `applyPlayerDamage` is called from inside
  `stepNpcs`/`applyOrdnance`, so restoring the world there would rebuild the
  scene and teleport the player mid-frame while the step is still iterating.
  `finish()` records the outcome and flips a phase; `inFlight()` goes false so
  the frame unwinds; `updateFlight` restores after the step returns.
- **Turn off ambient traffic.** `stepEncounters` keeps spawning traders and
  pirate waves otherwise, so an exercise reports more ships alive than it
  spawned. Push `state.encounterTimers` out on entry; they are already in
  `GameState` and come back with the snapshot, so no new state.

## Settled

1. **Free.** No credit cost — it should never be a reason not to practise.
2. **Every station.** No tech-level or government gate.
3. **`T` — COMBAT TRAINING** on the docked menu. Free there (docked uses
   B C D E G H I L M N Q S X Z). `T` also arms a missile in FLIGHT, which is
   fine and is the established convention: `C` is contracts docked and the
   docking computer in flight, `M` is the market docked and launch-missile in
   flight. The tables are per-mode.

   **The key-bindings invariant applies** (cite it by name, not number: the numbering has moved once already): a command key has ONE home — `BINDINGS` plus `command-help.ts` — and the `?` panel, the manual and the docked menu are painted from it. A key that belongs to a SCREEN rather than to `BINDINGS` is still written down by hand in every place that lists it, and those places must change
   together — `src/engine/keymap.ts`, the binding table in
   `src/game/controls.ts`, the `?` help panel in `play.html`, and the README
   table. An audit found 13 existing disagreements, including `B` for the
   distress beacon, which costs you cargo and is in no help panel. Add `T` to
   all four, and add its screen's own keys to the panel too.
4. **Three modes**, not one:
   - **Scenario** — a named fight, scored, ends by itself. The unit of export.
   - **Sparring** — one opponent, endless, respawning, until you quit. For
     learning a hull's behaviour rather than winning.
   - **Waves** — escalating, endless, until you die. Scored on waves survived,
     and the mode that answers "how many can I actually take?" — which is the
     question `npm run survivability` currently answers with a bot.

     **It escalates twice.** The NUMBERS first — count and tier, to
     six ships in an organised gang, saturating at wave 11 — and then the
     FIGHT, in four stated steps two waves apart: missiles at 12, E.C.M. at
     14, a bounty hunter among them at 16, and a Thargoid with its Thargon at
     18, each taking a pirate's PLACE rather than adding to the count. Past 18
     every wave is identical, which is the property that makes surviving three
     of them mean something. Every step is a pure function of the wave number
     and lives beside the ramp in `combat-sim-scenarios.ts`; the banner names
     each one as it arrives, the cockpit strip carries the standing list, and
     the record carries a `WaveEscalation` with the reason, because an
     escalation the pilot cannot see is indistinguishable from bad luck.

     The furthest wave a run reaches is kept with the commander
     (`commander.furthestWave`) — the ONE exception to "nothing leaves the
     exercise", argued at its field and at the teardown that writes it. It is
     not a rating, a kill or a credit; no career rule reads it, and it is shown
     on the trainer's own panel and nowhere else.

   All three export; waves and sparring emit a record per wave / per kill so a
   long session is still usable data rather than one summary line.

## Deliberate deviation

Not in the original; needs a `docs/GAP-ANALYSIS.md` entry saying so and why. The
original had no way to practise, and a game whose opponents are trained wants
one — so a player can learn the ships, and so the AI can be judged against a
human instead of only against other AI.

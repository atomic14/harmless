# Combat training simulator

Built and shipped: `T` at any station. The arguments here — the one rule, the
three enforcement layers, what NOT to do — are the reasons the code has the shape
it has. `src/game/combat-sim-safety.ts` holds the enforcement, and
`src/game/combat-sim-scenarios.ts` holds the scenarios.

It is a station facility, and the docked menu reaches it. It puts you in a fight
against opposition you choose, in a ship you choose. Then it hands you a report.
It is the real game — the real flight model, the real brains, the real guns. It
is not a replay of a training episode.

There are three audiences, and the design has to serve all three:

1. **A pilot** who practises, and who learns what a Fer-de-Lance does
   differently from a Sidewinder.
2. **Chris**, who playtests the combat balance without a flight to find a fight.
3. **The trainer.** Every exercise exports a record. Those records are what tell
   us whether a brain that wins in `evolve.ts` also wins against a human. Threat
   is not the same thing as fun, and this is the check that catches the
   difference. A brain judged only by other brains and by bots can win every
   measurement, and lose the only one that counts.

## The one rule

**Nothing that happens in the simulator leaves it.**

The load-bearing case, in Chris's words: **it must not advance you toward
E L I T E — that requires real kills.** Concretely, a simulator kill must not
touch either of:

- `commander.kills` — the body count on the status screen
- `commander.combatScore` — what `rating()` reads, and therefore the whole
  Harmless → E L I T E ladder

Those are two separate fields for a reason. `killValue()` weights a kill by
threat tier, so the rating counts difficulty rather than bodies. A simulator that
credited either field would hollow out the only long-term progression that the
game has. It is the one thing here that would be unforgivable to get wrong: a
player could grind the ladder in a training room, for free, at a station, with no
risk.

Everything else is the same rule, applied:

- no save writes — the autosave is suspended, and the world blob is untouched
- no credits, no bounty, no contract progress, no legal status
- no cargo or equipment lost to a hull breach
- missiles, fuel and E.C.M. charges restored on exit
- death ends the exercise, not the career: no escape pod, and no run over

**This wants a test, not care.** `combat.ts`'s `destroy()` is what increments
both fields, and four places reach it. Assert that a full simulated
engagement — kills, deaths, breaches, bounties — leaves `kills`, `combatScore`,
`credits`, `legalStatus` and the save blob bit-identical.

### How it is enforced

A refusal of `destroyNpc` is not the mechanism, and it is not the mechanism for
the most common kill in the game. Verified:

- `Combat.fire()` in `combat.ts` calls `this.destroy(commander, shot.ship)`
  **internally**. A laser kill never passes through `StepHost.destroyNpc`.
- the energy bomb calls `Game.destroyNpc` from `Game.runCommand` in `game.ts`,
  not from the step.

A host that refused `destroyNpc` and nothing else would credit the career for
almost every simulated kill. So the layers are:

1. **Primary: swap `state.commander` for an exercise-only clone.** `Combat`
   takes the commander *per call, deliberately*. Its own comment says so, because
   a held reference "would quietly start crediting bounties to a commander who no
   longer exists". To pass a different commander is an intended capability, and
   it is the only thing that covers the internal call. It also covers what the
   step writes directly and never asks about: `survivors`, `cargo` on a scoop,
   `fuel`, and `missiles` through `Ordnance.launch`.
2. **Second layer: the alternative `StepHost`.** It has 1 pass-through
   (`wreckNpc`), 5 redirects (`inFlight`, `applyPlayerDamage`, `destroyNpc`,
   `fireLaser`, `die`), and 6 refusals (`raiseLegal`, `dock`,
   `completeHyperspace`, `completeRescue`, `openHermitTrade`, `autoSave`).
3. **Third layer: the entry snapshot.** `persistence.capture()` runs on entry,
   and `restore()` runs on exit. Restore also puts the rng stream back exactly,
   because it does that last.

**`die()` must never be reached, and this one is data loss rather than a leak.**
`Game.die` drops the career's in-flight autosaves. That is deliberate, so that
"death is not optional if you refresh". A simulated death that reached it would
delete real ones.

## Scenarios

Each scenario is selectable and named. Each one is a data entry, not a code path:

| scenario | opposition |
| --- | --- |
| Lone bounty hunter | 1 hunter, drawn from the released bounty-hunter slot band |
| Single pirate | 1 pirate, tier selectable |
| Pirate pair | 2 pirates, same tier |
| Pirate gang | 3-4 organised pirates flying the pack policy |
| Police interdiction | 2 Vipers — what shooting a trader actually buys you |
| Thargoid ambush | 2-3 Thargoids plus Thargons, the witch-space fight |
| As they come | asks `pirateThreat()` (`game/threat.ts`) what the galaxy would send at your real mark right now, and sends that |

"As they come" matters most for balance. It is the only way to sample the fight
that the live game would generate for a commander in your exact state, without a
flight until one happens.

### Where the fight opens

The approach is the most informative part of a fight, because it is where a brain
shows whether it commits or loiters. So each scenario authors its own opening in
`game/combat-sim-opening.ts`. That module also owns `arenaCentre`, which is where
the fight happens at all:

| | opening |
| --- | --- |
| six of the seven scenarios | **ahead**, ring at **4,500**, cone 8 degrees half-angle |
| Thargoid ambush | **astern**, ring at **2,400**, cone 30 degrees |

4,500 is not a preference. Three facts fix it. It is outside `NPC_LASER_RANGE`
(3,500) even after the spawner's -15% scatter, so nobody shoots before the
approach. It is inside `PLAYER_INTEREST_RANGE` (9,000), where an NPC starts to
care about you at all, so it is an approach and not a stare. And it is far
outside `PASS_FAR` (600), which matters because the attack-run count starts a
fight "outside". A ship that STARTS inside `PASS_CLOSE` would score a completed
run the first time it left. A ship that starts in the dead band between the two
thresholds would have its first approach half-measured. The ambush is
deliberately inside their gun, which is what an ambush is, and it still clears
`PASS_FAR` four times over.

The cone is 8 degrees because the scatter spreads a ship between 0.55 and 1.45 of
it off the axis. That is 4.4 to 11.6 degrees: comfortably inside a 60-degree
field of view, and off-centre enough that a gang is a spread rather than a stack.

The record carries `opening`. That covers the arc, the range and cone asked for,
the nearest and furthest ship as they actually landed, the widest bearing off
your nose, and whether every one of them was in view. That is what makes a fight
reproducible from its seed. It is also how the one scenario that opens behind you
reads as deliberate (`ASTERN … NOT IN VIEW`). Career spawning is untouched. To be
jumped on the corridor to the station is the game at work, and `spawning.ts`'s
`spawnPopulation` knows nothing about any of this.

## Opponent selection and fit-out

There is one lever over the opposition. A pilot picks a scenario, a threat tier,
and which brain the pirates fly. Nothing else about who turns up is a choice. The
setup panel is three groups: **THE FIGHT** (mode, scenario, tier, seed), **WHO
YOU FIGHT** (the one brain row), and **YOUR SHIP** (the fit-out).

**A brain row is named, not filed.** Its value is how the policy FLIES — `GETS ON
YOUR SIX`, `MAKES ATTACK RUNS`. That is behaviour, never a version or a file
stem. The one such row is **PIRATES FLY**, under **WHO YOU FIGHT**. It offers the
two CODE pilots that a commander can meet: the pursuit dogfighter that the
pirates fly by default, which is the combat computer's own pilot turned on them,
and the hand-written attack run (`PIRATE_CHOICES` in
`screens/combat-sim-setup.ts`). No weights file sits behind these. Both are code.
The names live in `game/brain-names.ts`, beside the one-line CHARACTER that they
were compressed from. That is what the panel prints under the selected row:
behaviour, with the measured number that shows it. The file stem sits in that
note, for anybody who cross-references docs/TRAINING-LOG.md. The figures are the
flight probe and the evaluation tournament, archived under `train/logs/`. A value
that the picker offers with no name AND no line fails `npm test`. The row also
says where in the list it is — `(1 OF 2)`, because the list is two long. HOME and
END go to either end without a walk there.

To leave the row on its first value swaps nothing. `GETS ON YOUR SIX` is the
pursuit dogfighter that the pirates already fly out there, so it goes in as NO
override. Only `MAKES ATTACK RUNS`, the scripted run, goes in as a real change.
The choice belongs to the fight alone: `combat-sim.ts` applies it to
`state.brains` for the exercise, and restores it when you undock. There is no
career-persisting brain row. The machinery for a live career selection exists in
`brain-names.ts` (`liveBrainSelection` and `liveBrainId`), but no UI drives it,
and everything on the panel dies with the exercise.

Your own ship: **fit-out override only, not hull.** The player's hull is four
hard-coded constants in `player.ts` (`MAX_SPEED`, `ACCEL`, `MAX_PITCH`,
`MAX_ROLL`), with no roster. `FlightDemand.limits` can cap the speed and the
accel, but not the pitch or the roll. To parameterise `PlayerShip` is a feature
of its own. It also changes the world that every pirate brain was fitted in,
because `scenario.ts` reads `PLAYER_FLIGHT` as its target. So v1 overrides your
front and rear lasers, the E.C.M., the energy unit, the energy bomb, the missiles
and the combat computer. It is `state.cheat` made legitimate and scoped, and the
hull is not selectable. The combat computer is a YES/NO fit like the rest. It is
the one pilot that the game flies on your behalf rather than at you, so a fit
lets you watch it: launch, then press K.

To pick the opponent's *brain* is what turns this into an A/B rig. Fly the same
scenario against the pursuit dogfighter, then against the scripted attack run.
The report answers which is more fun, which is the one question the numbers
cannot. The picker offers two, both code: the pursuit dogfighter that the
pirates fly by default, and the scripted run. A candidate joins them when
somebody puts its weights back and adds its name (train/README.md).

## The report, and the export

Per exercise: the seed, the scenario, both loadouts, and then —

- your accuracy and theirs; shots fired and hits
- damage both ways, **by source**. The two lists differ, because the two
  directions do. What can hurt YOU is laser, missile, ram, station or canister
  (`DamageSource`). What you can hurt a SHIP with is laser, missile, ram or
  energy bomb (`DealtSource`, in `game/damage-dealt.ts`). The code measures both
  the same way: the points that actually came off the bank. A warhead into a
  Sidewinder therefore credits the 73 it had, rather than the 250 it spent
- time to first kill, time to last
- median and closest engagement range
- share of the fight each side spent lined up on the other
- time you spent on their six, against theirs on yours
- shield and energy low-water marks
- a per-opponent line: hull, brain, how long it lived, what it landed
- and, beside every hull NAME, the ids it resolves to — your `shipId`, and each
  opponent's `designId` and `profileId` (`src/game/ship-identity.ts`). A record
  therefore still says what was flown after a shipyard or a re-hulling exists

- and how the OPPOSITION flew. That is their speed, the SPREAD of the ranges they
  held (p10, median and p90), and their completed attack runs. The spread is
  three numbers because a brain that commits sweeps through the band, and a
  turret collapses it onto one number that the median alone cannot tell apart. A
  completed run is a closure inside `PASS_CLOSE`, then a break back out past
  `PASS_FAR`. Those two thresholds live in `src/constants/combat-record.ts`
  beside `SIX_CONE`, with the same justification. Both `combat-sim-report.ts` and
  `train/flight-probe.ts` read them from there rather than keep their own.
  Deliberately, no verdict, score or turret index is attached: the report
  presents, and the pilot judges

`envelope()` is the only measurement of the PLAYER's flight envelope — the speed,
pitch, roll and engagement-range distributions. `scenario.ts`'s `playerCobra` and
`playerCobraSlow` target hulls are fitted to it. That is the one input that makes
the trainer's target move like a human.

The human-flown report is the only answer to whether a brain is fun. The defence
brain is a bot, and `npm run survivability` is still the bot answer.

**The JSON is versioned** (`schema`, as `SNAPSHOT_VERSION` is). It is an
interface with an external consumer. Without the version, a shape change would
silently break whatever reads `__simLog`. It is at **3**. Records from either
side of a bump cannot be compared, and `combat-sim-compare.ts` refuses to try.
These are the damage figures behind the current schema. A warhead is 250 pool
points. A crossfire hit is the firing build's own gun. `you.damageDealt` and its
buckets count ordnance as well as laser (see docs/DAMAGE-PATHS.md).

**Export** as JSON, to the clipboard and to a file you can download. An in-memory
ring of recent exercises also sits on `window.__simLog`, so a console session or
an agent can read them without the DOM. The JSON is the deliverable: it is what
goes back into the judgement of a training run.

**Two records, side by side.** The method above is an A/B: same seed, same
scenario, two brains. `←/→` walks the ring. ENTER holds the record you are on
against another one, as this / that / difference. `C` and `X` take the PAIR,
because the pair is the finding.

It is `combat-sim-compare.ts`. It derives from two finished records, and it adds
no accumulation and no sampling. The load-bearing half is the REFUSAL. Two
records are not an A/B when they differ in seed, scenario, mode, waves, player
fit-out, opponent count, hull, build, tier or role. Two records from either side
of a `schema` change are not an A/B either. So it names exactly which fields
differ, with both values, and it paints no difference column at all. Different
BRAINS is the point; different anything else is a confound. It does not refuse
matching brains, but it calls them what they are: a repeat of one fight, not a
comparison of two. And there is no verdict, no score and no colour by sign — the
same refusal as the turret index, for the same reason.

## Why it is a good agent test

It is deterministic from a seed. It ends by itself. It emits a structured report.
`window.__game` can drive it.

## What NOT to do

- **Do not reuse `Episode`.** There, the player is a target that a controller
  flies. Here, you are the commander in the real Game. Share the statistics
  layer, never the simulation.
- **Do not add a field beside `GameState`.** Simulator state is state.
- **Do not shift the career's rng stream.** Enter on a fresh seed, and restore on
  exit.
- Not a `window.__` handle. **But the exercise itself cannot be a screen.**
  `Game.mode` is derived (`screens.topId ?? baseMode`), and `updateFlight()` runs
  only when `mode === 'flight'`. So **the world does not step** while any screen
  is on the stack. The screen is the front of house: pick a scenario, launch,
  read the report. The fight is ordinary `flight` with a different `StepHost`
  behind it.
- **Teardown must be deferred.** `applyPlayerDamage` is called from inside
  `stepNpcs` and `applyOrdnance`. A restore of the world there would rebuild the
  scene and teleport the player mid-frame, while the step still iterates.
  `finish()` records the outcome and flips a phase. `inFlight()` then goes false,
  so the frame unwinds. `updateFlight` restores after the step returns.
- **Turn off the ambient traffic.** Otherwise `stepEncounters` keeps spawning
  traders and pirate waves, so an exercise reports more ships alive than it
  spawned. Push `state.encounterTimers` out on entry. They are already in
  `GameState`, and they come back with the snapshot, so this needs no new state.

## Settled

1. **Free.** No credit cost. It must never be a reason not to practise.
2. **Every station.** No tech-level gate, and no government gate.
3. **`T` — COMBAT TRAINING** on the docked menu. `T` is free there, because
   docked uses B C D E G H I L M N Q S X Z. `T` also arms a missile in FLIGHT,
   which is fine and is the established convention: `C` is contracts docked and
   the docking computer in flight, and `M` is the market docked and
   launch-missile in flight. The tables are per-mode.

   **The key-bindings invariant applies.** Cite it by name, not by number,
   because the numbering has moved once already. A command key has ONE home —
   `BINDINGS` plus `command-help.ts` — and the `?` panel, the manual and the
   docked menu are painted from it. A key that belongs to a SCREEN rather than to
   `BINDINGS` is still written down by hand in every place that lists it, and
   those places must change together: `src/engine/keymap.ts`, the binding table
   in `src/game/controls.ts`, the `?` help panel in `play.html`, and the README
   table. An audit found 13 existing disagreements. One is `B` for the distress
   beacon, which costs you cargo and is in no help panel. Add `T` to all four
   places. Add its screen's own keys to the panel too.
4. **Three modes**, not one:
   - **Scenario** — a named fight. It is scored, and it ends by itself. It is the
     unit of export.
   - **Sparring** — one opponent, endless, with a respawn, until you quit. It is
     for learning a hull's behaviour rather than for winning.
   - **Waves** — escalating, endless, until you die. It is scored on the waves
     survived. It is the mode that answers "how many can I actually take?", which
     is the question that `npm run survivability` answers with a bot today.

     **It escalates twice.** The NUMBERS escalate first: the count and the tier,
     up to six ships in an organised gang, saturating at wave 11. The FIGHT
     escalates second, in four stated steps two waves apart. Missiles arrive at
     12, E.C.M. at 14, a bounty hunter among them at 16, and a Thargoid with its
     Thargon at 18. Each of those takes a pirate's PLACE; none of them adds to the
     count. Past 18, every wave is identical, which is the property that makes
     three survived waves mean something. Every step is a pure function of the
     wave number, and it lives beside the ramp in `combat-sim-scenarios.ts`. The
     banner names each step as it arrives, the cockpit strip carries the standing
     list, and the record carries a `WaveEscalation` with the reason. An
     escalation that the pilot cannot see is indistinguishable from bad luck.

     **A wave got harder on 2026-08-11, and the ramp did not change a line.**
     docs/TODO/139 cut `SHIELD_REGEN_FRACTION` from 0.035 to 0.012. A shield face
     that came back in 28.6 seconds now takes 83, so the same wave lands the same
     shots and the points stay off. A furthest-wave figure from before that date
     is not comparable with one from after it. The ramp is deliberately untouched.
     What moved is what a hit is worth over time.

     The furthest wave that a run reaches is kept with the commander
     (`commander.furthestWave`). It is the ONE exception to "nothing leaves the
     exercise", and it is argued at its field and at the teardown that writes it.
     It is not a rating, a kill or a credit. No career rule reads it. The
     trainer's own panel shows it, and nowhere else does.

   All three modes export. Waves and sparring emit a record per wave and per
   kill, so a long session is still usable data rather than one summary line.

## Deliberate deviation

This is not in the original, and this section is where we record that. The
original had no way to practise. A game whose opponents are trained wants one,
for two reasons: so a player can learn the ships, and so a human can judge the AI
instead of only other AI.

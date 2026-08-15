# The damage-path inventory

This file lists every way that anything in HARMLESS can be hurt. For each way it
gives the unit that the damage is spent in, the owner of the number, and whether
the number belongs to the released game or to us.

[ELITE-A.md](ELITE-A.md) says where the released numbers come from, and what the
ids and the save schema look like. This file is the inventory.

It exists because "which numbers are in which units" has to be a question with an
answer. There are two damage scales, and both belong to the released game. The
table below maps every path to its unit. `test/damage-paths.test.ts` asserts the
table against the code rather than trust it.

**Two units, and only two** (`src/game/damage-units.ts`). Both are whole numbers
on the released byte scale. Both are branded, so nobody can spend one as the
other:

| unit | what it comes off | range |
| --- | --- | --- |
| `NpcEnergyPoints` | a ship's or object's released energy bank | 2 (the missile) to 300 — the rock hermit's bank (our own object, row 12a), above the heaviest source-derived build, the 255 Dragon |
| `PlayerPoolPoints` | the commander's 255-point facing shield, then the 255-point bank | 0–510 to strip both |

**There is no normalized scale.** An episode's target is the commander, with
`game/systems.ts`'s three 255-point pools. `applyDamage` hits her for
`npcLaserDamageToPlayer` points, off the firing build's own packed byte.
`TARGET_DAMAGE_LO`, `TARGET_DAMAGE_SPREAD`, `VICTIM_RAM_DAMAGE`,
`targetShotDamage` and `targetHullForPoolPoints` do not exist anywhere.
`test/damage-paths.test.ts` asserts that none of the five comes back. The project
has exactly two damage scales, and both belong to the released game.

## The inventory

| # | source | target | old unit | new unit | owner | backing |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | player laser | NPC / object | source points | `NpcEnergyPoints` | `npc-energy.ts` `playerLaserDamage` → `elite-a/combat-math.ts` | **source** — `(byte & 0x7f) >> 1`, times the target's multiplier, less `maxEnergy & 7` |
| 2 | NPC laser | commander | source points | `PlayerPoolPoints` | `gunnery.ts` `npcLaserDamageToPlayer` → `elite-a/combat-math.ts` | **source** — `laserPower << 2`, less the hull's `perHitShieldArmour` |
| 3 | NPC laser | another NPC | normalized `0.11` flat | `NpcEnergyPoints` | `npc-energy.ts` `npcCrossfireDamage` → `elite-a/combat-math.ts` | **source halves, Harmless composition** — the pack tabulates the two player-facing directions only, so this is the attacker's own `laserPower << 2` less the defender's own `maxEnergy & 7`. No third arithmetic. |
| 4 | player missile warhead | NPC | "certainly fatal" (99 normalized) | `NpcEnergyPoints` 250 | `constants/impact.ts` `IMPACT.warhead` | **Harmless policy** |
| 5 | NPC missile warhead | commander | normalized `1.3` | `PlayerPoolPoints` 250 | `constants/impact.ts` `IMPACT.warhead` | **Harmless policy** |
| 6 | energy bomb | every NPC in range but a Thargoid | "certainly fatal" (99 normalized) | `NpcEnergyPoints` 255 | `constants/impact.ts` `IMPACT.energyBomb` | **Harmless policy** |
| 7 | ship↔ship collision | both ships | normalized `0.45` | `NpcEnergyPoints` 44 | `constants/impact.ts` `IMPACT.ram` | **Harmless policy** |
| 8 | player↔ship collision | commander | normalized `0.45` | `PlayerPoolPoints` 115 | `constants/impact.ts` `IMPACT.ram` | **Harmless policy** |
| 9 | canister on an unscooped hull | commander | normalized `0.06` | `PlayerPoolPoints` 15 | `constants/impact.ts` `IMPACT.canisterOnHull` | **Harmless policy** |
| 10 | Coriolis wall / fluffed slot | commander | normalized `0.9` | `PlayerPoolPoints` 230 | `constants/impact.ts` `IMPACT.stationScrape` | **Harmless policy** |
| 11 | player laser | drifting canister / escape capsule | none — deleted on any hit | `NpcEnergyPoints` off an 8-point bank | `cargo.ts` `takeLaserHit` → same oracle as row 1 | **source** — designs 4 and 2. A capsule takes no hit at all for its first `POD_LAUNCH_GRACE` seconds: `shot.ts` skips a graced object, so the beam passes through to whatever is behind it (GitHub #28) |
| 12 | player laser | genuine station (Coriolis, Dodo) | none — sparks only | none — `laserImmune` | `npc-energy.ts` policy field | **source** — `laserImmune` |
| 12a | player laser | rock hermit | none — deleted on any hit | `NpcEnergyPoints` off a 300-point bank | `npc-energy.ts` policy field → same oracle as row 1 | **Harmless policy** — `{ maxEnergy: 300, laserImmune: false, playerLaserMultiplier: 1, regenPerSecond: 0 }`; a live target, not immune, destructible, spilling contraband when cracked (combat.ts) |
| 13 | ship↔station collision | neither | none | none | `collisions.ts` `npcsVsStation` | Harmless: a bounce only, deliberately — damage here would kill docking traffic at random |
| 14 | docking, successfully | neither | none | none | `docking.ts` / `world-step.ts` `checkStation` | a clean dock costs nothing; a bad one is row 10 |
| 15 | sun proximity (cabin heat) | commander | none | none — **outcome, not damage** | `systems.ts` `updateCabinTemp` | Harmless: the cabin reaching `CABIN_TEMP_FATAL` (constants/sun.ts) ends the run outright; it never touches a pool |
| 16 | flying into the sun | commander | none | none — outcome | `world-step.ts` `SUN_KILL_DIST` | Harmless |
| 17 | flying into the planet | commander | none | none — outcome | `world-step.ts` `checkHazards` | Harmless |
| 18 | E.C.M. discharge | commander's own bank | `1` of 4 | `PlayerPoolPoints`-scale 64 (`ECM_ENERGY_COST`) | `ordnance.ts` (`fireEcm`) | Harmless: a **cost**, not damage — it is spent, never applied through `applyDamage`, and it cannot destroy the ship. The burst is refused at `<=` its cost, so it can never spend the last point, and `destroyed` is a fact about a HIT rather than about the bank. The burst and its price are one call, `fireEcm`, because three things press it — the player's key, the combat computer and a training episode's target |
| 19 | missions (Constrictor) | — | — | — | `missions.ts` | no damage of any kind: it pays a bounty on a kill resolved by rows 1/4/6 |
| 20 | headless campaign | — | — | — | `test/campaign.ts` | flight is abstracted; it never applies damage |
| 21 | combat simulator | commander and opponents | — | rows 1–10, unchanged | `combat-sim.ts` via `exerciseStepHost` | it flies the **real** step; there is no simulator damage model |
| 22 | training episode → pirate | a real `NpcShip` | normalized, converted | `NpcEnergyPoints` (rows 3 and 7) | `ai-training/scenario.ts` → `fire-resolution.ts` | as the live game, through the live resolver |
| 23 | training episode → its target | the episode's `TargetShip` | normalized | `PlayerPoolPoints` (rows 2 and 8) | `ai-training/scenario.ts` → `gunnery.ts`, `impact-damage.ts`, `systems.ts` `applyDamage` | **as the live game**, recovery included. The target holds `freshSystems()`, takes `npcLaserDamageToPlayer` points on the facing shield through `applyDamage`, and gets them back through `systems.ts` `regenerate()` — the whole rule, hull recharge rating and energy unit included. That includes **row 5**: an episode's pirates launch the missiles they carry, through `NpcShip.chooseWeapon` and `ordnance.ts`'s own `Ordnance`, and a warhead reaching her is `IMPACT.warhead`'s 250 points on the facing shield like any other hit. And she can answer it: the target carries an E.C.M. (`EcmFit`), a defence policy has a thirteenth output that presses it, and the burst spends `ECM_ENERGY_COST` off her bank through row 18's own `fireEcm` — the same call the player's key makes. The episode resolves none of it: rows 2 and 3 are spent by `game/fire-resolution.ts`, the one resolver both this file and `world-step.ts` call, and which face takes a hit is `game/shield-face.ts` in both. |
| 24 | debug / console | — | — | — | `console.ts` | the handles are write-only: `__game`, `__policyKit`, `__simLog`. Nothing there applies damage. |
| 25 | in-flight missile as a target | — | — | none | — | Harmless **cannot** damage a missile in flight: `shot.ts` traces ships, cargo and the station only, and the E.C.M. destroys missiles outright. The pack's profile for design 15 (2 energy, 2 defence) is available the day it becomes a target. |

## The one Harmless rule

Rows 4–10 are the paths where the released source says nothing at all. They
share one named rule, and its only home is `src/constants/impact.ts`:

> An impact costs a **fixed whole number of source points**. The rule states that
> number separately for a ship's energy bank and for the commander's pools. The
> impact spends it on whatever it hits, and it never asks what that is.

There are two columns rather than one, because the two banks are not comparable.
A released ship carries 2 to 255 energy. The commander carries a 255-point facing
shield in front of a 255-point bank. The rule uses fixed points rather than a
share of the target, because a hull's size is meant to be worth something. A
44-point scrape is a third of a Sidewinder and a sixth of an Anaconda.

**The anchors** are both the Cobra Mk III. `test/damage-paths.test.ts` re-derives
both from the catalogue, so a re-import cannot leave them stale:

| impact | ship | severity against the 98-point NPC anchor | commander | severity against the 255-point shield face |
| --- | --- | --- | --- | --- |
| `ram` | 44 | 45% | 115 | 45% |
| `canisterOnHull` | — | — | 15 | 6% |
| `stationScrape` | — | — | 230 | 90% |
| `warhead` | 250 | above all but 5 of the 260 released builds (banks 252/253/255) | 250 | flattens a full face exactly |
| `energyBomb` | 255 | above every released bank | — | — |

## The numbers these paths carry

- **NPC-vs-NPC laser** is the firing build's own gun against the target's own
  defence. A Thargoid's crossfire and a Worm's are therefore not identical
  (row 3).
- **A warhead against a ship** is 250 points. The five heaviest released builds
  survive one at full energy, by a sliver: the two Anacondas (252), the two
  Thargoid motherships (253) and the `W:29` Dragon (255). Only an actual kill
  pays a bounty (row 4). The roster's own Dragon is `D:29` at 247, and it dies to
  one.
- **A warhead against the commander** is 250 pool points (row 5).
- **A shot at a canister** resolves through the oracle, against the object's own
  8-point bank. It does not delete the canister unconditionally. Every laser the
  Cobra Mk III can carry breaks one in a single hit (row 11).

## Rules this inventory encodes

- **The Constrictor's halving and a station's immunity are properties of a
  PLAYER LASER**, not of the ship. They live on the target's profile
  (`playerLaserMultiplier`, `laserImmune`), and row 1 alone reads them. Rows 3 to
  10 never see them. `npcCrossfireDamage` deliberately consults neither, and no
  impact function even gets a target to ask.
- **One rule, one home.** No damage number appears at a call site. Every one of
  them is in `elite-a/combat-math.ts` (source arithmetic),
  `elite-a/*.generated.ts` (source data) or `impact-damage.ts` (ours).
- **Only three modules may mint a point.** `gunnery.ts`, `npc-energy.ts` and
  `impact-damage.ts` may call the two point constructors. Nothing else may. The
  test asserts it.
- **Both directions name their cause, and the two lists are not the same list.**
  What can hurt the commander is `DamageSource` in `combat.ts`: the five
  `applyPlayerDamage` sites, which are rows 2, 5, 8, 9 and 10. What the commander
  can hurt a ship with is `DealtSource` in `damage-dealt.ts`: rows 1, 4, 6 and 7.
  A station scrape and a canister have no outbound version, and the energy bomb
  has no inbound one. One list would therefore have to carry members that can
  never occur in one of the directions. The three words that the two lists share
  are the same words by construction (`Extract`).
- **What is REPORTED is what came off the bank.** `dealToNpc` reads the target's
  energy on either side of the hit. The figure in a training record is therefore
  the damage the ship took, and never the points the impact spent. A 250-point
  warhead into a Sidewinder with 73 energy is 73. The laser path makes the same
  measurement (`combat-sim.ts` `pullTrigger`), which is what makes the four
  buckets addable. This does not change the points spent: a warhead still
  destroys everything except the five heaviest builds.

# The Elite-A reference catalogue

This file records what the importer brought in, and what the project uses it for.
It also records which numbers belong to the released game, which numbers are
ours, and what a future shipyard will need.

The companion document is [DAMAGE-PATHS.md](DAMAGE-PATHS.md), the inventory of
every way anything can be hurt. This file is about the DATA and the identities.
Record a deliberate deviation from the 1984 original beside the constant that
makes it. Do not keep a list of its own.

## Source attribution and provenance

A generator builds the catalogue from an analysis pack of the released Elite-A
ship and combat tables. The pack is vendored verbatim at
`reference/elite-a/source/`. It is ten files, and the importer refuses to run
against anything else:

```
sourceHash  85fece5618c1302dac6b2bbc5c6e78629d37fb5ac27769dddf24fb0b38b52ccb
```

That is a SHA-256 over the ten per-file SHA-256s. Every file that the importer
writes carries it in a `source-hash:` header line. `ELITE_A_SOURCE_HASH` in
`provenance.generated.ts` exports it. The three oracle fixtures record it, and
`test/elite-a-catalogue.test.ts` asserts that they all agree. The per-file hashes
live in `reference/elite-a/manifest.json`. A second copy is pinned by hand, in
`PINNED` at the top of `tools/import-elite-a.mjs`. A pack that hashes differently
therefore stops the importer. It does not quietly become the new truth.

Background reading, and the source of the constraints that this phase worked to:

- [Buying and flying ships in Elite-A](https://elite.bbcelite.com/deep_dives/elite-a_buying_and_flying_ships.html)
- [Ship blueprints in Elite-A](https://elite.bbcelite.com/deep_dives/elite-a_ship_blueprints.html)

Nothing in `src/` reads the pack or the fixtures.
`test/elite-a-catalogue.test.ts` asserts that too. It scans every source file for
a path into either one.

## What the importer produces

`npm run generate:elite-a` reads the pack and writes ten files.
`npm run generate:elite-a -- --check` writes nothing. It exits non-zero if any
of the ten drifted. It is part of `npm run check` and of `npm run elite-a`.

| generated file | holds |
| --- | --- |
| `src/game/elite-a/designs.generated.ts` | the 38 designs and the header fields every build of one shares |
| `src/game/elite-a/variants.generated.ts` | the 260 exact S.A-S.W builds — the ten fields that DO vary |
| `src/game/elite-a/geometry.generated.ts` | one hull per design, deduplicated: vertices, edges, faces |
| `src/game/elite-a/slots.generated.ts` | the 713 blueprint-slot assignments (398 populated) and their NEWB bytes |
| `src/game/elite-a/player-hulls.generated.ts` | the 15 flyable hulls: four laser bytes, armour, capacities |
| `src/game/elite-a/provenance.generated.ts` | the source hash, the counts, and the solved NEWB bit layout |
| `reference/elite-a/manifest.json` | the ten input files, their sizes and their hashes |
| `test/fixtures/elite-a/hits-to-destroy.json` | 15,600 player-to-NPC oracle rows |
| `test/fixtures/elite-a/npc-damage-to-player.json` | 3,900 NPC-to-player rows, both encodings |
| `test/fixtures/elite-a/hit-ranges.json` | 570 min/max hits-per-design summaries |

A generated file is **read-only**. To change one, change the pack or
`tools/elite-a/build.mjs`. Then regenerate, and review the diff. Each one opens
with `// GENERATED FILE — DO NOT EDIT.`, and a test asserts that it does.

`src/game/elite-a/types.ts` is the only hand-written file beside them. It is the
contract that the importer emits against. `catalogue.ts` is the only way in. It
is the one file that may know that the generated arrays are arrays.
`test/ship-identity.test.ts` fails if any other module imports a
`.generated.ts`.

## Three stable identities

Each identity is a namespaced string. It is what goes in a save. It never
carries an expanded record (`src/game/ship-identity.ts`).

| id | shape | addresses |
| --- | --- | --- |
| `PlayerHullId` | `elite-a:player:<0-14>` | one of the 15 flyable hulls |
| `ShipDesignId` | `elite-a:design:<0-37>` | one hull's geometry and shared header |
| `NpcCombatProfileId` | `elite-a:variant:<set>:<design>` | one exact released build |

Two `harmless:` overlays join them, and there are exactly two:
`harmless:design:generation-ship` with `harmless:profile:generation-ship`, and
the same pair for `rock-hermit`. Each overlay carries a stated `why`. Nobody can
mistake one for recovered source data. That is why the enumerations are 15 hulls,
**40** designs and **262** profiles: 38 + 2, and 260 + 2.

There are three identities because three things move independently. A future
shipyard changes the player's hull id. A future blueprint-set loader changes
which variant an NPC spawns as. Geometry changes neither of those. Combat reads
the profile, and it does not care which policy chose it.

**There is no migration, and that is deliberate.** The game refuses a save that
does not say what it is flying — Chris: *"an unreadable save is just old junk at
the moment"*. The refusal is the save system's own: `readSave` returns null for
such a record, and `Persistence.resume` boots the commander normally. Nothing
reaches a player as an error. A save that carries an EXACT variant keeps it, even
when that variant is not its design's recommended default. That property is what
makes the saved id worth anything. `test/ship-identity.test.ts` checks it
specifically, because every other test passes when the code re-derives the
variant on restore.

## The geometry registry

```
geometry.generated.ts      source vertices, edges, faces (integers)
  -> ships/elite-a-hulls.ts    one conversion: 1 world unit = 4 source units
  -> ships/elite-a-faces.ts    closed polygons rebuilt from face adjacency
  -> ships/registry.ts         designId -> hull, name, target radius: the only way in
  -> ships/geometry.ts         buildShip(): lines + black fill, turned to face -Z
```

Four facts are worth knowing before you touch any of it:

- **One scale serves every design.** `SOURCE_UNITS_PER_WORLD_UNIT = 4`, anchored
  so the Cobra Mk III keeps the size it always had. There is no per-ship factor,
  and `test/geometry.test.ts` asserts that there is none.
- **The target radius comes from the pack**, through the same conversion. What a
  ray test hits is therefore the released ship, not a hand-tuned guess. `NpcSpec`
  has no `radius` field at all, so a roster row has nowhere to state a size.
  Where the pack stores a whole-number radius, the code uses it directly, which
  covers 30 designs. Where the pack does not (8 designs), the code takes the
  square root of the stored area. `eliteATargetRadius()` is the one home for that
  choice.
- **The source stores no polygons.** A face is a normal, and an edge says which
  two faces it lies between. `elite-a-faces.ts` therefore reconstructs the closed
  loops for the black fill, and it REPORTS what it could not resolve. Tests pin
  those reports. Three faces cannot be wound by their stored normal: the alloy
  plate's normal is `(0,0,0)`, and two of the Splinter's sit more than 60 degrees
  off its own geometry. 177 edges bound no face, and the code draws them anyway.
  Every hull except the alloy plate is closed.
- **`buildShip()` turns a def a half turn about Y.** It negates x AND z, not z
  alone. To mirror z alone gives the same picture for a left/right symmetric
  hull, and a different ship for an asymmetric one. Eight of the 38 are
  asymmetric.

The two stations are the one exception to the single scale, at
`STATION_PRESENTATION_SCALE = 4` on top of it. The hulls are exact. The size is a
presentation choice, and `ships/station-hulls.ts` says why.

## The damage flows

Every laser number in the game comes out of `elite-a/combat-math.ts`. That module
is pure: it imports nothing at all. `test/elite-a-oracle.test.ts` reproduces it
against all 20,070 supplied rows.

```
PLAYER LASER -> NPC
  gunnery.ts   playerLaserHit(shipId, laser)   (byte & 0x7f) >> 1
  npc-energy.ts playerLaserDamage(policy, hit) x multiplier, floor, - (maxEnergy & 7)
  npc.ts       takeLaserHit -> energyAfterDamage, isDestroyed at <= 0

NPC LASER -> COMMANDER
  gunnery.ts   npcWeaponByte(profileId) -> npcLaserStrength   laserPower << 2
  gunnery.ts   npcLaserDamageToPlayer(byte, shipId)           - perHitShieldArmour
  systems.ts   applyDamage: facing 255 shield, then the 255 bank, then dead

NPC LASER -> NPC
  npc-energy.ts npcCrossfireDamage(byte, policy)  the two source halves, composed

EVERYTHING ELSE (ram, canister, station wall, warhead, energy bomb)
  impact-damage.ts  fixed whole points, and OURS — see docs/DAMAGE-PATHS.md
```

The tests check the live paths against the pack row by row, and NOT through the
oracle. `test/elite-a-live-combat.test.ts` drives all 15,600 outgoing rows
through `gunnery.ts`, `npc-energy.ts`, `npc.ts` and `combat.ts`.
`test/elite-a-live-defence.test.ts` drives all 3,900 incoming rows through
`gunnery.ts`, `systems.ts` and `combat.ts`. Neither one calls `combat-math.ts`
for a number that it checks.

## The units

There are two units. Both are whole numbers on the released byte scale. Both are
branded, so nobody can spend one as the other (`game/damage-units.ts`):

| unit | comes off | range |
| --- | --- | --- |
| `NpcEnergyPoints` | a ship's or object's released energy bank | 2 (the missile) to 300 — the rock hermit's bank, our own object above the heaviest source build; 255 (the Dragon) is the heaviest source-derived one |
| `PlayerPoolPoints` | the commander's 255-point facing shield, then the 255-point bank | 0-510 to strip both |

There is no third scale, and there is no adapter between the two. The retired
normalized "fraction of a Cobra" is gone from the project entirely, and that
includes the trainer. `test/damage-paths.test.ts` asserts by name that none of
the bridges can come back.

## The save schema

| where | field | note |
| --- | --- | --- |
| `elite-web-commander:<slot>` | `shipId` | a `PlayerHullId`. Absent or unresolvable is refused — the save reads as old junk and boots a fresh commander (`storage.ts` requires it) |
| `elite-web-world:<slot>` → `npcs[]` | `designId`, `profileId` | optional in the JSON; absent means a legacy save and is re-derived |
| `NpcState` | `energy`, `regenCarry` | whole points, and the sub-second remainder in ticks |
| `ShipSystems` | `energy`, `foreShield`, `aftShield` | 0..255 each, whole numbers |
| `ShipSystems` | `energyCarry`, `foreShieldCarry`, `aftShieldCarry` | one recharge remainder per pool, in ticks |

`SNAPSHOT_VERSION` did not move for any of this. Every added key is optional, so
a reader that ignores an unknown key survives. The combat trainer's exported JSON
carries its own `COMBAT_SIM_SCHEMA`. That one moves when its damage figures
change meaning (docs/COMBAT-SIM.md).

## Exact, recreated, and ours

These are the three columns that this phase has to keep separate. **Exact** means
that the pack states it and the code reproduces it. **Clean recreation** means
that we stayed inside the released model, but made a decision that the source did
not force. **Harmless policy** means that the source is silent and the number is
ours.

| area | exact Elite-A fact | clean-recreation choice | Harmless policy |
| --- | --- | --- | --- |
| player laser | `hit = (fittedLaserByte & 0x7f) >> 1`; the high bit is a continuous flag, not 64 points of power | — | cadence, heat, the hit cone and aim assist |
| NPC defence | `defence = maxEnergy & 7`, subtracted after the multiplier | — | — |
| the Constrictor | halves the player's hit BEFORE defence, and the half is floored | — | it is signposted in the mission text; the source did not tell you |
| stations | the two genuine source stations (Coriolis, Dodo) are immune to player lasers | — | the rock hermit is NOT immune: it is a destructible target of ours with a 300-point energy bank, cracked open with laser fire (`npc-energy.ts`) |
| NPC laser | `laserPower << 2`, less the hull's `perHitShieldArmour` | the `clean` encoding is used; the released `weaponByte >> 1` (which lets missile bits add damage) stays reproducible and test-only | hit chance, cadence and range falloff |
| destruction | — | dead at `energy <= 0`; the released exact-zero survival quirk is deliberately dropped | — |
| regeneration | ordinary AI ships recover one point per elapsed second; stations, missiles, cargo and rocks recover none | — | the 3,600-tick integer clock, so 15, 60 and 144 Hz give the same total |
| player defence | fore 255, aft 255, bank 255 — the pack's own capacities | — | recharge rates, the spill order, the equipment-damage roll |
| geometry | all 38 hulls, exact vertices/edges/faces, and the targetable radius | polygons reconstructed from face adjacency; three faces wound by geometry where the stored normal could not | 1 world unit = 4 source units; stations 4x on top; asteroids generated rather than tabulated |
| NPC roster | which designs a blueprint slot admits, read off the 713-row table | — | which of those the roster actually flies, and the threat tiers |
| exact build | the 260 released variants, byte for byte | the recommended default resolves to a REAL variant with that tuple, ties broken by A-W order | a combat role flies the hardest build the source filed under its own job (`role-variants.ts`) |
| speed | each design's source `maxSpeed` | `sourceSpeedToWorld` = 400/42 world units per source unit | the hulls that predate the import keep the speeds they were tuned and trained at; every turn rate is ours |
| NPC vs NPC | — | composed from the two source rules that each half has | that we compose them at all is the rule — the pack does not tabulate this direction |
| ram, canister, station wall, warhead, energy bomb | — | — | all of it: `impact-damage.ts`, and none of it may be quoted as an Elite-A fact |
| the generation ship and the rock hermit | — | — | both, and they carry `harmless:` ids so they cannot enter a parity matrix |

## Deliberately deferred

The phase's job was damage parity. It was not every Elite-A feature. The items
below are known and named. The generated catalogue already carries the fields
that each one will need, so none of them needs another data extraction or
another combat rewrite.

1. **The shipyard.** To buy, to sell and to part-exchange a player ship. All 15
   flyable hulls resolve today, and live combat already reads the commander's
   `shipId`. There is simply no UI that can change it.
2. **The Adder start.** Elite-A starts a fresh commander in an Adder. Harmless
   starts in the Cobra Mk III. That is what every existing save flies, and what
   the whole balance is measured against.
3. **Per-hull flight profiles.** The pack gives each flyable hull a speed, a
   pitch and roll range, a cargo capacity, a fuel range, a missile rack and a
   count of laser mounts. Live play applies none of it. The player's flight model
   is four constants in `player.ts`, and every trained brain was fitted against
   them. To apply the table is therefore a retrain as well as a feature.
4. **Per-mount laser equipment.** The pack gives every hull a mining-laser byte,
   and `playerLaserHit()` answers for it. But Harmless has no fourth mount to
   select, and every side mount is a pulse laser whatever sits up front. The
   equipment redesign that makes a mount a real choice is its own change.
5. ~~**S.A-S.W selection.**~~ **Done, docs/TODO/138.** The released game picks a
   blueprint set by technology, government, random bits and galaxy number. It
   then fills the set's own role slots. `game/blueprint-set.ts` recovers that
   rule and `game/set-roster.ts` says what the chosen set narrows the roster to.
   The set is drawn once on arrival and saved.

   **THE LINE THAT USED TO BE HERE WAS WRONG,** and this item corrects it: it
   called by-system selection "a swap of that policy and nothing else". It is
   not. Taking whatever build the set filed is measurably a weakening of an
   opposition that already struggled to out-damage a shield face
   (docs/TODO/139). So the set narrows WHICH DESIGNS turn up, and
   `role-variants.ts` still picks the build. Two overrides remain — the
   Constrictor's system and witch-space.
6. **Original AI, accuracy, collision physics and economy.** Explicitly out of
   scope. The supplied matrices describe what a registered hit is worth. They say
   nothing about whether a shot hits, and Harmless keeps its own answers.

## A future shipyard, when it arrives

Combat needs no new formula and no new data for this. The work is state, not
rules:

1. **A purchase sets `commander.shipId`** to another `PlayerHullId`. It is one
   field. The save already carries it, the migration already handles it, and
   `playerHull()` already resolves it.
2. **Validate the loadout against the new hull** before you commit. The pack
   states `maxMissiles`, `cargoHoldCapacity`, `laserMounts` and
   `hyperspaceRangeLightYears` per hull. Refund or refuse a rack or a hold that
   does not fit, at the counter. The pilot must not find it in flight.
3. **Rebuild the flight state and the capacity state** from the new hull:
   `maxSpeed`, `maxPitchRollRate`, `minPitchRollRate`, the hold and the fuel
   range. This is deferred item 3, and it is the real work. The trained brains
   were fitted against one target envelope, so a hull that flies differently
   changes the world they were trained in.
4. **Save atomically.** The commander blob and the world blob are two keys
   (`storage.ts`). A purchase that wrote one and not the other would leave a
   commander who flies a hull that her world does not agree about. Write the
   commander first. Then let the ordinary dock-time save handle the rest.

Three things do NOT change. `perHitShieldArmour` comes off the hull record, so
incoming laser damage re-resolves for free. The three 255-point pools are the
same on every hull the pack lists. Every outgoing laser number is
`playerLaserHit(shipId, laser)`, which already takes the id.

## What it costs

Measured 2026-08-02, at the close of the phase. Measure it again rather than cite
it.

| | before the phase | now |
| --- | --- | --- |
| `/play` shared chunk | 712.64 kB raw · 202.59 kB gzip | **936.47 kB raw · 228.51 kB gzip** |
| snapshot, a live flight with 6 NPCs | — | 9.7 kB, ~1.04 kB per NPC |
| world step, 8 NPCs, headless | — | 0.005 ms/frame (0.03% of a 60 Hz budget) |
| capture + `JSON.stringify` | — | 0.06 ms |

**The chunk grew by 224 kB raw and 26 kB gzip, and the generated catalogue is all
of it.** The six generated modules are 253 kB of source. Minified, they are a
212 kB contiguous region of the built chunk, which is 22.7% of it. Gzip is kind
to them, because they are repetitive object literals with identical keys 260
times over: they are 23.5 kB of the 26 kB gzip growth.

That is the price of the whole thing. It is paid on the shared chunk, because the
viewer draws all 38 designs too. Two ways can bring it down if it ever matters.
Emit the arrays as parallel typed columns, rather than as 260 objects with 13
named keys each. Or split the slot table, which is 68 kB, and which nothing in
live play reads after `ship-roles.ts` builds its bands at module load. Both are
importer changes, not model changes.

**The load is cheap.** As plain JS, the six modules cost **3.0 ms** to parse and
evaluate, one time, at module load. Under node with
`--experimental-strip-types`, the same import measures 26 ms. Most of that is the
type-strip of 253 kB of TypeScript, which the browser never does. A
`recommendedNpcProfile()` lookup is about 60 ns, and nothing in the step calls
one per frame. An `NpcShip` resolves its policy at construction.

## The gate

```sh
npm run elite-a     # under a second
```

It runs the hash-and-drift check first. It then runs the suites that own each
claim: the catalogue, the oracle, both live laser directions, the damage-path
audit, the banks, the identities, the roster, the selection policy and the
geometry. `test/elite-a.ts` maps each bullet of TODO 30's list to the file that
asserts it. It is in CI as its own named step. It is deliberately NOT in
`npm run check`, which already runs every one of those assertions inside
`npm test`.

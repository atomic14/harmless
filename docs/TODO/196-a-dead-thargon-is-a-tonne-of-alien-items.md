# 196 — A dead Thargon is a tonne of alien items

**Kind:** enhancement · **Severity:** low · **Size:** medium · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** #41

## Where we are

**Chris reported it on 2026-09-06 (GitHub #41):** *"You should be able to
collect thargons once the thargoid mothership has been destroyed. Once you've
destroyed the mothership, thargons are collectable just like cargo."*

The original did this. A Thargon is a drone. When the last mothership dies,
the drone stops, and a ship with fuel scoops collects it as Alien Items. That
commodity sells for a high price and is never on sale.

**Today the drones go inert, and inert is a ship state.** `destroyShip` in
`game/combat-wreck.ts` sets `state.inert` on every Thargon when the last
mothership dies, and says `THARGONS DEACTIVATED`. An inert ship tumbles
(`npc-idle.ts`), is not hostile (`hostility.ts`), and is skipped by every
collision loop (`collisions.ts`). So the commander flies through one and
touches nothing.

**The scoop reaches the cargo field only.** `CargoField.update` in
`game/cargo.ts` reports every item inside `SCOOP_RANGE`. The world step then
decides what a reached item is worth. A ship is never in that field, so no
drone can be scooped.

**The data already says what a drone is worth.** The Thargon row in
`elite-a/designs.generated.ts` carries `scoopedMarketItemId: 15`. The source
stores that id one less than the commodity index. The escape pod row says 2,
and a pod is scooped as Slaves at index 3. So 15 is Alien Items at index 16.
`galaxy.ts` holds the commodity. No constant names the index, and no runtime
code reads the field.

## What to do

Three milestones.

### M1 — the drones become cargo

`Canister.kind` gains `drone`. Its look is the Thargon hull in the Thargon's
colour, through `OBJECT_DESIGNS`. Its bank is the Thargon's own profile, so a
shot at a dead drone costs what it cost before. `CargoField.spawnDrone` puts
one adrift at a position, with the drift the wreck scatter uses.

When the last mothership dies, `destroyShip` despawns each drone and spawns a
`drone` item in its place. The line stays `THARGONS DEACTIVATED`. The scoop
branch in `world-step.ts` reads a drone as cargo of commodity `ALIEN_ITEMS`,
and says `SCOOPED 1t ALIEN ITEMS`. Without scoops, the drone breaks on the
hull, and the line names a Thargon.

`ALIEN_ITEMS` lives in `constants/commodities.ts`, beside `SLAVES`. The
snapshot's `CanisterSnapshot.kind` widens, so a save keeps a dead drone.

The gates are `test/combat.test.ts`, rewritten where it pins `inert`, and a
new `test/dead-drone.test.ts` on the world-step rig.

### M2 — `inert` has no writer, so it goes

M1 removes the only writer of `state.inert`. The state, the `inertTumble`
behaviour, the `inert` dispatch in `npc.ts`, the checks in `hostility.ts`,
`collisions.ts` and `npc-attack-run.ts`, and the `activeThargons` filter all
go. `test/npc-idle.test.ts` loses its inert case. Every header that names the
state is repaired in the same commit.

### M3 — the manual says so

The fuel scoops entry in `manual.html` gains one sentence: a Thargon left dead
by its mothership is a tonne of alien items.

## Decisions already made

- **A dead drone is a field item, not a ship.** The field is the one home of
  what the scoop reaches, and it already tumbles, saves and takes a shot. A
  second reach rule over inert ships would be a copy.
- **A shot at a dead drone pays no bounty.** The original paid 50 credits for
  a dead drone. Here the bounty is paid for a live one, and a dead one is
  cargo. A field item's break-up credits nobody, as a canister's does.
- **The scanner shows a dead drone as cargo.** That is the whole point of the
  report: it tells the commander what is collectable.
- **The commodity index is pinned to the data.** A test holds `ALIEN_ITEMS`
  equal to the Thargon row's `scoopedMarketItemId` plus one. It holds `SLAVES`
  to the pod row's plus one. So the convention is stated once.

## Open questions

None.

## Watch out for

- **The kind union is written out in seven files.** `cargo.ts`, `snapshot.ts`,
  `shot.ts`, `gunnery.ts`, `hud-model.ts`, `missions/model.ts` and
  `test/world-step.test.ts`. `missions/model.ts` stays narrow: a mission
  spawns a canister or a pod, never a drone. Export one `CanisterKind` and use
  it where the width is right.
- **`driftingCone` in `gunnery.ts` sizes the aim cone by kind.** A drone is a
  Thargon hull, and it needs its own answer.
- **`destroyShip` loops `world.npcs` while it despawns.** Loop a copy.
- **The save parser may whitelist the kind.** Read `persistence.ts` and
  `save-file.ts` before M1.
- **`constants:check` scores a constant's home from the module header.**
  `constants/commodities.ts` opens on the commodity table's classes, and a
  scooped drone's row belongs there.
- **docs/TODO/184 M2 restored the inert dispatch on purpose**, so the drones
  tumble. The field tumbles them now, and the reason is kept.

## Verification

The gates always run: `npm run check`. `npm run generate:constants` runs
before them, because M1 adds a constant.

The tier: the released ship data is read, not changed, and no fight number
moves. `npm run elite-a` runs once, because the Thargon's profile now backs a
field item.

Gates:

- `test/dead-drone.test.ts`, new. The last mothership's death puts one drone
  item per Thargon in the field, and none in the sky. A second mothership
  alive keeps them in the sky. A drone inside `SCOOP_RANGE` with scoops adds
  one tonne of Alien Items, and says the line. Without scoops the hull takes
  `IMPACT.canisterOnHull`, and the line names a Thargon. A full hold loses it.
  A snapshot round trip keeps a drone. Prove it able to fail: spawn a `cargo`
  item for one run.
- `test/constants.test.ts` or `test/elite-a-catalogue.test.ts`: `ALIEN_ITEMS`
  and `SLAVES` each equal their row's scoop id plus one.

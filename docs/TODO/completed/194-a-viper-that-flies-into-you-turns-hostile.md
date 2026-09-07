# 194 — A Viper that flies into you turns hostile

**Kind:** bug · **Severity:** medium · **Size:** small · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** #42

## Where we are

**Chris reported it on 2026-09-06 (GitHub #42):** *"A viper collided with me
and that turned him hostile."*

**A collision blames the commander, whoever flew into whom.** The geometry is
`playerVsNpcs` in `game/collisions.ts`. It tests overlap only. It reads no
closing vector, so it cannot say who moved. The world step bills each contact
in `world-step.ts`. It damages the commander through the host. Then it calls
`dealToNpc` with the source `ram`.

`dealToNpc` in `game/damage-dealt.ts` passes `byPlayer = true` on every call.
It has three callers: the ram, the warhead and the energy bomb. So a ram takes
the same door as a missile. `NpcShip.takeDamage` then sets
`state.provokedByPlayer`. Nothing clears that flag.

`isHostileToPlayer` in `game/hostility.ts` reads the flag for a police ship
and for a hunter. A clean commander is then a target for the rest of the
flight. The flag also ends the station truce. The console says `COLLISION`
and nothing more, because the ram never asks `harmVerdict`.

**The ledger is not the blame.** `test/combat-sim-dealt.test.ts` credits a
ram to the commander's line as `damageBySource.ram`. That is a measurement,
and it stays. The defect is the grudge.

**The rule already exists for a canister.** The scoop branch in
`world-step.ts` says: *flying into one is not an offence; SHOOTING a capsule
is*. A ship deserves the same reading.

## What to do

One milestone.

### M1 — contact does not provoke

`damage-dealt.ts` decides the blame from the source. A warhead and the bomb
are aimed, so they provoke. A ram is contact, so it does not. The rule lives
beside `DealtSource`, as a record, so a new source must state its answer.

`takeDamage` still flags `provoked` and `underFire` for a ram. A trader still
flees a ram. Only `provokedByPlayer` stays false. A ram that kills still goes
through `destroyNpc`, so a kill by ram still costs what a kill costs.

The gate is a new `test/ram-blame.test.ts`. A clean commander rams a police
Viper, and the Viper is not hostile. A laser hit on the same Viper makes it
hostile, as the control. A rammed pirate is hostile by role. A ram still costs
the ship `IMPACT.ram.ship` points.

## Decisions already made

- **A ram never provokes.** The geometry cannot say who moved, so blame is a
  guess either way. A wrong guess against the commander is the report. A ram
  costs the commander 115 points and the ship 44, so a deliberate ram punishes
  itself already.
- **The ledger keeps the ram.** The combat simulator credits ram damage to the
  commander's line, and that measurement is not blame.
- **The console line stays `COLLISION`.** No harm line, because there is no
  harm verdict for an accident.

## Open questions

None.

## Watch out for

- **`test/combat-sim-career.test.ts` calls `dealToNpc` directly.** Read the
  call before the signature moves.
- **`hostility.ts` says `provokedByPlayer` is set for damage from the
  commander, whatever the role.** That comment moves with the rule.
- **The grudge line of docs/TODO/175** tells a commander about a Viper she
  grazed. Grazed means a stray laser shot there, and this item does not touch
  it.

## Verification

The gates always run: `npm run check`.

The tier: a rule that changes how a fight goes. The probe that owns the
subsystem is `ram-probe`, and it measures NPC-on-NPC contact, which this item
does not touch. So no probe runs. `npm run elite-a` runs, because the change
sits beside the released combat data.

Gates:

- `test/ram-blame.test.ts`: a rammed Viper is not hostile, and a shot one is.
  Prove it able to fail: pass `true` for the ram for one run.
- `test/combat-sim-dealt.test.ts`: the ram still reaches the ledger. It holds
  today, and it must hold after.

## Outcome

### M1 — contact does not provoke

`PROVOKES` says which sources are the commander's own deed. The laser, a
warhead and the bomb are. A ram is not. `dealToNpc` reads the table by the
source, so a ram still costs the ship its 44 points and still reaches the
ledger, and it sets no grudge. A trader still flees the contact.

`test/ram-blame.test.ts` flies a Viper, a pirate and a trader through the real
step, each spawned on the commander's own position. The Viper holds no grudge
and is not hostile. The laser door on the same Viper provokes it, as the
control. The pirate is hostile by role. Twelve assertions. **Proved able to
fail**: the ram set to provoke reddens five of them.

**THE TABLE COULD NOT LIVE IN THE DAMAGE DOOR, AND THE PLAN DID NOT HAVE IT.**
The plan put the rule beside `DealtSource`. `test/constants.test.ts` refuses a
game-rule constant outside `src/constants/`, and the catalogue had no home for
blame. So the table lives in a new `constants/blame.ts`. That layer imports
nothing from `game/`, so the table names its own four keys, and the index in
`dealToNpc` holds the two lists in step: a new source with no row does not
compile.

**THE TEST MUST ASK THE RULE CLEAR OF THE TRUCE.** A launch puts the commander
inside `STATION_TRUCE`, and the truce covers every role a grudge does not. The
first run read a rammed pirate as not hostile for that reason. The test passes
Infinity for the station distance, so only the grudge and the role answer.

`npm run elite-a` passed. 5,503 assertions became 5,515.

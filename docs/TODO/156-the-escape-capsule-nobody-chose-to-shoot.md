# 156 — The escape capsule nobody chose to shoot

**Kind:** defect · **Severity:** high · **Size:** medium · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** #28 — *"Escape pods seem to be too
easy to destroy. And destroying a pirate's escape pod should not make me a
criminal."*

An **escape capsule** is the pod a destroyed ship launches with its pilot in it.
The code calls it a capsule. This plan uses that word, and never "pod", except
in the constant that already carries the released design's own name.

## Where we are

The issue reports two faults. They have different causes. Every claim below is
read off the code that runs.

**A capsule launches where the gun is already pointed.** `Combat.wreck`
(`src/game/combat.ts:304`) calls `spawnCapsule` at the destroyed ship's
position. The commander is aiming at that position, because that is where the
ship was.

**One hit breaks it.** A capsule carries the released escape pod's bank, which
is 8 points with no defence (`src/game/cargo.ts:62`). Every laser a flyable hull
can mount breaks one in a single hit, and `test/damage-paths.test.ts` pins that.

**The graze cone is generous, and it does not shrink.** `driftingCone`
(`src/game/gunnery.ts:89`) gives a capsule a flat `POD_GRAZE` of 16 units at any
range, with no aim assist on top. A capsule within 16 units of the line of fire
is hit by a shot that missed everything else.

**Together those three make the kill shot the capsule shot.** A beam laser fires
ten times a second. The burst that killed the ship is still going when the
capsule appears inside it.

**Every capsule is a Fugitive offence, whoever was in it.**
`src/game/combat.ts:176` pushes `{ kind: 'offence', level: FUGITIVE }` with no
test of the occupant. `offenceFor` (`src/game/law.ts:223`) says a pirate's hull
is Clean to destroy. So shooting a raider's capsule outranked shooting the
raider.

**The capsule cannot answer the question.** `Canister` (`src/game/cargo.ts:38`)
holds a kind, a commodity, a velocity, a spin axis and a bank. It holds nothing
about who is inside. The ship that launched it is despawned in the same frame
(`Combat.wreck`), so nothing downstream can look the role up.

## What the triage found that the issue did not report

**The Character ladder is not charged at all for this.** `Combat.destroy`
applies `DISREPUTE_MURDER` when the crime is Fugitive-grade
(`src/game/combat.ts:259`). The capsule path never reaches that code. So today a
commander can shoot a lawful pilot in a capsule, pay the fine at a station, and
have a spotless name.

**The snapshot cannot carry the answer either.** `CanisterSnapshot`
(`src/game/snapshot.ts:126`) mirrors `Canister` field for field, and every field
is required. Adding one is a `SNAPSHOT_VERSION` bump, not a default.

## What to do

ONE milestone, and therefore one commit. The two halves of the issue share a
data change, so splitting them would write the same field twice. The file split
below is a third part rather than a second milestone, for the reason stated
there: it edits the same file, and a commit without it would land a red gate.

### M1 — who was inside, and when the capsule can be shot

**WHO.** `Canister` gains `occupant: string` — the role of the ship that
launched it, and `''` for a canister, which carries a tonne and nobody.
`spawnCapsule` takes it. `Combat.wreck` passes `npc.role`, because that frame is
the last one that knows it.

A new private `Combat.podKilled` then prices the deed:

- the record is `offenceFor(pod.occupant, true)` — the same rule the hull is
  read through, so the two cannot part company. A Clean answer is already a
  no-op at `raiseLegal` (`src/game/law-actions.ts:94`).
- the name is `DISREPUTE_MURDER`, **whatever the record says**. Somebody in a
  capsule cannot shoot back. This is the clearest case in the game of the two
  ladders moving apart, and it is the answer to the second finding above.

`''` is inert rather than a default: `offenceFor('')` is Clean, so a reader that
forgets to check `kind` gets a harmless answer instead of a quietly wrong one.
That is docs/TODO/108's distinction, and the reason the field is not a role
enumeration.

**WHEN.** A new constant `POD_LAUNCH_GRACE` (`src/constants/wreck.ts`, the file
that already owns whether the pilot got out). `Canister` gains `grace: number`,
counted down by `CargoField.update` on the world clock.

`shot.ts` SPENDS it, in both passes: a graced object is skipped by the solid ray
test and by the graze cone, exactly as a dead ship already is. One home for the
skip, so a graced capsule can be neither struck squarely nor grazed. The beam
passes through to whatever is behind it, which is right — the capsule is inside
the fireball.

**Scooping is NOT gated on the grace.** A capsule you fly to is a capsule you
chose, and a rescue that failed for a second and a half would read as a bug.

**The bank is untouched.** Chris chose the grace over more energy. The capsule
stays a one-hit object once it is a target at all, so nothing in
`test/damage-paths.test.ts` moves.

**The snapshot carries both fields**, and `SNAPSHOT_VERSION` goes to 2. A
version 1 save holds capsules that cannot say who was inside, and guessing would
decide a commander's record for them.

### M1, third part — combat.ts crosses the size ceiling

The rule above adds 29 lines to `src/game/combat.ts`, which was at 395.
`npm run sizes` fails at 424.

**It rides in the same commit**, and that is deliberate. The two changes edit
the same file in the same region, so they cannot be staged apart without an
interactive add. More importantly, a commit that landed the rule alone would
land a failing gate, and `npm run prebuild` runs the gates.

**Do not trim prose.** The seam is in the file's own header: *"The two free
functions at the bottom are the player's own gun and hull, over a GameState."*
`Combat` takes each ingredient separately on purpose — that is what makes it
testable — and those two functions are the assembly step that couples it to one
`GameState`.

They move to `src/game/combat-player.ts`. The split removes `GameState` and
`viewDirection` from the pure module's imports, which is the architectural
argument rather than the line count. Eight files import the two names and gain
one import line each.

## Verification

The gates always run: `npm run check`.

Beyond them, tiered to the change. This touches a rule that decides a fight's
consequence, and it touches the shot trace, so:

1. **`test/escape-pod.test.ts`**, a new file, is the gate. It asserts behaviour
   through the real `Game`, the real `Combat` and the real `CargoField`:
   - a fresh capsule held still in the crosshair survives a shot, and moves
     neither the record nor the name;
   - the CONTROL — the same shot at the same still capsule lands one frame after
     the grace is spent;
   - a held beam trigger across the whole grace lands more than ten shots and
     kills nobody;
   - a raider's capsule destroyed is Clean and costs `DISREPUTE_MURDER`;
   - a lawful pilot's capsule destroyed is Fugitive and costs the same;
   - every role that bails out stamps its own capsule, flown over 200 seeded
     kills each through the real wreck path;
   - both fields survive a snapshot round trip, mid-grace;
   - a capsule can still be scooped the instant it launches.
2. **Prove the gate can fail.** Restore the flat `FUGITIVE` and delete the skip
   in `shot.ts`, and count the failures.
3. **`npm run aim-probe`**, because `shot.ts` is on the player's aim path. The
   change must move nothing: no NPC is a drifting object, so the skip cannot
   reach a fight.
4. `test/record-line.test.ts` owns the ORDER of the three console lines a lawful
   capsule earns. It must clear the grace by hand to get there, and say why.

Not run: `npm run campaign`. No price, no market and no career rate moves.

## Decisions already made

- **The grace, not a bigger bank** (Chris, 2026-08-15). Asked how a capsule
  should become harder to destroy, he chose *"Short immunity after launch"* over
  more energy, both, or a smaller graze cone. The reason is the one the plan
  states: the fault is where the capsule appears, not how tough it is.
- **A raider's capsule costs the name and not the record** (Chris, 2026-08-15).
  Asked what destroying a pirate's capsule should cost, he chose *"Character
  only"* over nothing at all and over an Offender-grade record.

## Watch out for

- `offenceFor` takes a bare string. Do not turn `occupant` into a role
  enumeration to make it prettier — the point of `''` is that an unknown role is
  already Clean.
- The grace is a float subtracted 90 times. It lands on a residue near 1e-16
  rather than on 0, and `grace > 0` reads that residue as grace for one extra
  frame. That is harmless. A test that steps exactly the span will fail, so step
  one frame past it and say why.
- `test/combat.test.ts` already measures `ESCAPE_CHANCE` over 400 kills a role.
  Do not measure it again in the new file.

## Outcome — landed 2026-08-15

M1 landed as planned. `npm run check` passes: **4565 assertions, 0 failed**.

**The gate was proved able to fail.** Restoring the flat `FUGITIVE` and deleting
the skip in `shot.ts` turned six assertions red, across both halves of the fix.

**`npm run aim-probe` is byte-identical before and after.** The skip cannot reach
a fight, because no NPC is a drifting object. The output was diffed rather than
eyeballed.

**`src/game/combat.ts` is 383 lines**, from 395 before the change and 424 after
the rule. `src/game/combat-player.ts` is 53. Eight files import the two moved
names and gained one import line each.

### What the work found that the plan did not have

**The float residue is real and it is one frame long.** `POD_LAUNCH_GRACE`
subtracted 90 times at 1/60 lands on 3.26e-16, not 0, so `grace > 0` holds for
one extra frame. The plan predicted it. What it did not predict is that the
first draft of the test read `pod.grace` AFTER the capsule was destroyed, where
the field never runs down at all because `update` only walks the field. The
reading is only meaningful while the capsule is still adrift.

**`test/world-step.test.ts` carried a comment that the fix falsified.** It said
*"shooting one is the deliberate act and stays FUGITIVE (combat.ts)"*, beside a
check about ramming one with no scoops. The check is still right. The sentence
beside it was not, and a stale comment beside a passing test is the kind that
survives longest.

**One row of docs/DAMAGE-PATHS.md needed the grace.** Row 11 said a capsule is
deleted on any hit. That is still true, and it is no longer the whole truth.

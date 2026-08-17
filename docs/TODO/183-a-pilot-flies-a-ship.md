# 183 — A pilot flies a ship

**Kind:** architecture · **Severity:** medium · **Size:** large · **Depends
on:** docs/TODO/182 · **Blocks:** nothing · **GitHub:** none

## Where we are

docs/TODO/182 landed the seam and the roles that never fight. **It also named
this item as the gate on everything after it.** Three of `update`'s branches
call a flight model, so nothing else leaves until the flight models are objects.

**The vocabulary is the tree's own.** `brain-names.ts` opens *"Which named pilot
flies"*, and `brains.ts` says *"All pilots are code"*. A pilot flies a ship.

### What each pilot is, and what it asks for

Measured on 2026-08-17, after each group's own scratch and internal helpers come
out of the count:

| pilot | lines | context members |
| --- | --- | --- |
| the attack run — `attack`, `updateTactic` | 104 | 11 |
| the pursuit dogfighter — `pursue`, `pursuitFly`, `slashesRatherThanHoldSix` | 57 | 9 |
| the trained brain — `brainFly`, `packmates` | 126 | 9 |
| the weapon choice — `chooseWeapon` | 24 | **3** |

**The union is 13 members**, and that is the `PilotShip` context: `accel`,
`advance`, `facing`, `healthFraction`, `matePositions`, `maxSpeed`, `object`,
`role`, `speedFloor`, `state`, `steerToward`, `tacticHull` and `turnRate`.

**ONE INTERFACE FOR 286 LINES, against eighteen handles per free function.**
That is the trade docs/TODO/182 explains, and it is why docs/TODO/169 M3's
69-call measurement refused a cut that was never the right shape.

### Three fields leave the ship with their pilot

`pursuitBrk` and `pursuitSlashing` are transient, and neither is in `NpcState`.
The file says so at both: they are re-decided every frame. **They belong to the
pursuit pilot**, exactly as a hermit's beacon clock belongs to its behaviour
(docs/TODO/182 M1).

### The weapon choice is not a pilot

`chooseWeapon` reaches three members. It decides what leaves the RAIL, a bolt
or a missile, once a pilot decides to shoot. It is the smallest thing in
this item and the least like the others.

### One pilot falls back to another

`pursuitFly` calls `attack`. A commander who breaks off far enough turns the
dogfighter back into the three-phase run. **So the pursuit pilot holds the
attack pilot**, and the two move together or not at all.

`brainFly` calls neither. It is independent, and it is the largest.

## What to do

Three milestones, and the independent one goes first so the interface is proved
before the coupled pair uses it.

### M1 — `npc-pilot.ts`, and the trained brain

`game/npc-pilot.ts` declares `Pilot` and `PilotShip`. A pilot flies a ship for
one frame and returns a `FireEvent` or null, which is the shape `NpcBehaviour`
already has.

`game/npc-brain-pilot.ts` holds `brainFly` and the `packmates` sweep it spends.
It is 126 lines and it calls no other pilot.

**The context starts at what the trained brain asks for**, and M2 widens it. Say
what M2 added and why, as docs/TODO/182 M1's outcome says.

### M2 — the attack run and the pursuit dogfighter

`game/npc-attack-run.ts` holds `attack` and `updateTactic`.
`game/npc-pursuit.ts` holds `pursue`, `pursuitFly` and
`slashesRatherThanHoldSix`, plus the two transient fields.

**The pursuit pilot is constructed with the attack pilot**, because it falls
back to it. That is composition rather than a call back into the ship.

### M3 — the rail

`chooseWeapon` moves. It reaches three members and it is not a pilot. So it goes
to its own file, and the header says which of the two it is.

**`update` then holds the dispatch and nothing else.** Report what it measures.

## Decisions already made

- **Chris named the cause and chose composition** on 2026-08-17. A behaviour and
  a pilot are both objects the ship holds.
- **The pilots gate the rest**, and docs/TODO/182 records the ordering mistake
  that led to this being stated.
- **No rule and no value changes.** This item moves flight into objects.

## Open questions

None that block M1.

## Watch out for

- **THE SEEDED STREAM IS THE WHOLE RISK.** `attack` and `brainFly` both draw,
  and every seeded outcome in the game follows the ORDER of those draws
  (invariant 11). A probe that moves is a defect rather than a result.
- **The step allocates nothing.** A pilot is built once per ship and never per
  frame. Each keeps its own module scratch, as `trader-flight.ts` and
  `npc-idle.ts` both do.
- **`state.flownBy` is the readout's one honest signal** (docs/TODO/88). Each
  pilot stamps it, and `update` clears it before the dispatch.
- **`brainFly`'s static buffers.** `NpcShip` holds `obsBuf`, `mateView`,
  `matePool`, `scratch` and the observation views as STATIC members, shared by
  every ship. They travel with the trained brain, and they must stay static
  rather than become per-pilot, or a training episode allocates per ship.
- **Invariant 5.** `src/ai-training/scenario.ts` calls `brainFly` directly, so
  the trainer flies the shipped model. Whatever M1 does must keep that reachable
  and must not give the trainer a second copy.

## Verification

The gates always run: `npm run check`.

**The tier table puts this at "a rule that changes how a fight goes"**, and this
is the item that most deserves it. **No value moves**, so the evidence is that
nothing moved:

- `survivability`, `aim-probe`, `gap-probe`, `ram-probe` and `defence-probe`
  byte-identical at every milestone;
- `npm run campaign` byte-identical at two sizes;
- `npm run elite-a`, because the released combat data is what `attack` spends.

Take the baseline before M1.

**A gate per milestone**, in the shape docs/TODO/182 M1 used:

1. a source scan that each pilot file names no ship class, with a control;
2. a fixture that flies each pilot off an object literal and asserts what it did
   to the ship it was given.

**Prove each able to fail, and each one alone.**

## Outcome

### M1 — the pilot seam, and the trained brain

`game/npc-pilot.ts` is 97 lines and `game/npc-brain-pilot.ts` is 198. `npc.ts`
went 1,292 lines to 1,117.

**THE `Pilot` INTERFACE IS NOT DECLARED, AND THAT IS A DEVIATION FROM THE
PLAN.** The plan said M1 declares `Pilot` and `PilotShip`. Written, the three
pilots share no signature: `brainFly` takes nine arguments and `attack` takes a
different seven. A common `fly(ship, dt, target)` needs one target OBJECT, and
the step allocates nothing per frame, so the shape has to be a reused scratch.
**That is a decision worth taking with all three signatures in view.** M1
declares `PilotShip` alone, and the file says so where the interface will go.

**SIX STATIC BUFFERS MOVED WITH THE BRAIN**, and they stay shared rather than
becoming per pilot. `obsBuf`, `mateView`, `matePool`, `scratch`, `meView` and
`targetView` were static members of `NpcShip`, shared by every ship in the sky.
One per pilot would allocate per SHIP, and a training episode builds thousands.

**Four members went public**: `speedFloor`, `healthFraction`, `tacticHull` and
`steerToward`. That is docs/TODO/176 M2's reason again — a collaborator needs
the primitive.

**A dead private alias came off.** `NpcShip` had a `brainControl` setter that
only `brainFly` used, and the pilot writes `ship.state.brainControl` directly.

**The seeded stream did not move.** `survivability`, `aim-probe`, `gap-probe`,
`ram-probe` and `defence-probe` are byte-identical, and `npm run campaign` is
byte-identical at both sizes.

**`npm run elite-a` DIFFERED, AND IT FOUND A REAL COVERAGE GAP.** Its pool-write
count fell from 14 to 13. `test/damage-paths.test.ts` scans a HAND-WRITTEN list
of files for a write to `.energy`, `.foreShield` or `.aftShield`. `brainFly`
carries one line the pattern matches, and moving it out of a listed file took it
out of the scan's reach.

**Nothing failed, because the vacuity floor is `>= 8`.** A hand-written file
list loses reach every time a file splits, and only a count said so.

**The line is not a health pool at all.** `me.energy` is the OBSERVATION view a
brain reads, and the value written into it is already a fraction. The new file
is on both the scan's list and its owner table, and the owner entry says which
of the two it is. The count is 14 again.

**The only difference left in `elite-a` is a file count**: 267 files scanned
became 269. That is the two new files, which is the move rather than a change.

**`test/npc-brain-pilot.test.ts` is 10 assertions in two parts.** The scan holds
three things. The pilot's own parameter is a `PilotShip`. Nothing it flies is
typed `NpcShip`. And **every import from `npc.ts` is `import type`**, which is
what makes the cycle a paper one. A control reads a file that imports a VALUE
from `npc.ts`.

**THE CLAIM IS DELIBERATELY NOT `test/hostility.test.ts`'s.** That file holds
that a fleet RULE names no ship class, which is right for a rule and wrong for a
pilot. A pilot needs the whole ship, and the honest claim is that the ship it
FLIES is narrow.

**Proved able to fail two ways, and each one alone.** A pilot typed to take
`NpcShip` reddens the two scan claims. A pilot that does not stamp
`state.flownBy` reddens the fixture claim, **and two readout tests with it.**
That is docs/TODO/88's defect, caught by three files at once.

4,873 assertions became 4,883.

### M2 — the attack run and the pursuit dogfighter

`game/npc-attack-run.ts` is 159 lines and `game/npc-pursuit.ts` is 129. `npc.ts`
went 1,121 lines to 945.

**THE `Pilot` INTERFACE IS NOT DECLARED, AND M2 ANSWERS WHY WITH ALL THREE IN
VIEW.** `attack` and `pursue` nearly share a signature. `brainFly` does not: it
takes nine arguments to their seven, and four of the nine are its own. A common
`fly(ship, dt, target)` needs one target OBJECT holding a position, an
attitude, a speed, a velocity, a distance, a brain and a threats view. The step
allocates nothing per frame, so that object is reused scratch, and every pilot
then reads fields that mean nothing to it.

**THE CONTEXT IS THE SEAM, AND NOT A COMMON METHOD.** `PilotShip` is what the
programme was for. It is also the house pattern: `game/hostility.ts` and
`game/trader-flight.ts` are free functions over a narrow context, and neither
declares an interface over itself.

**ONE PILOT IS AN OBJECT ANYWAY, AND NOT FOR POLYMORPHISM.** `PursuitPilot`
holds `brk` and `slashing`, and neither is in `NpcState`. The attack run holds
nothing that is not saved, so it stays free functions. That is the beacon clock
of docs/TODO/182 M1 at a second site.

**The context grew by one member**, and M1 said it would say which. `npcTarget`
joined it, because `matePositions` keeps a ship out of its WINGMEN's way and
leaves its target alone. **That target is not the `npcTarget` argument `attack`
takes.** A fleeing armed trader is handed the attacker it turned on, while the
field is still null.

**`pursuitFly` stayed on the ship as a thin delegate.** The pilot is per ship
and private, and the trainer flies that exact entry (invariant 5).

**The seeded stream did not move.** Five probes byte-identical, and
`npm run campaign` byte-identical at both sizes.

**A COUNT IN A GATE WENT RED, AND THE FIX WAS TO MEASURE THE RIGHT THING.**
`test/deleted-members.test.ts` held that `game/npc.ts` spends `approach` at
least four times. Two of those four call sites went to the pilots, which is
correct, and a per-file floor turned red for it. The claim is about ONE
declaration serving every reader, so it counts the total over four files now.

**A REGEX ATE A TYPE, AND ONLY THE COMPILER SAW IT.** A multi-line
`re.sub` written to delete two fields matched from the first doc comment in the
file and swallowed the tail of `WorldView`. `git checkout` and exact-string
edits were the remedy. **A non-greedy multi-line pattern over source is not a
tool worth using**, and the brace-matched spans it was meant to help were right
all along.

**`test/npc-scripted-pilots.test.ts` is 12 assertions in two parts.**

**THE STATE CLAIM'S FIRST DRAFT WAS VACUOUS, AND THE BREAK-IT STEP CAUGHT IT.**
It asserted that two fresh pilots both start out of the break, which is true
whether the field is per pilot or shared. It drives one pilot into a break now,
and demands the other is untouched.

**Proved able to fail two ways, and each one alone.** A shared break-off phase
reddens the state claim. An attack run that does not stamp `state.flownBy`
reddens the fixture claim **and two flight-readout tests with it**.

4,883 assertions became 4,895.

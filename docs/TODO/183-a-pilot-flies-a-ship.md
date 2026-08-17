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

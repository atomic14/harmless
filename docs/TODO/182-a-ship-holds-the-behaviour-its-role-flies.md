# 182 — A ship holds the behaviour its role flies

**Kind:** architecture · **Severity:** medium · **Size:** medium · **Depends
on:** docs/TODO/181 · **Blocks:** nothing · **GitHub:** none

## Where we are

Chris read `npc.ts` on 2026-08-17 and named three responsibilities: the flight
models, the several NPC types, and `update` as an orchestration layer. He then
named the cause: *"we have not used a good OO approach in this project."*

**He is right, and it explains why every cut so far fought a wide seam.**

### The seam was an artefact of the extraction style

docs/TODO/169 M2 pulled `hostility.ts` out as free functions over a narrow
structural interface, and it worked. A fleet RULE genuinely needs a role, four
flags and a position. docs/TODO/176 M2 did the same for the trader, and four
handles were enough.

**docs/TODO/169 M3 then measured a 69-call seam and refused the flight models.**
docs/TODO/176 M1 measured 81 reaches and refused `update`. Both measurements are
correct, and both answer the same question: *what narrow interface would a free
FUNCTION need?*

**Behaviour that is intrinsically about a whole ship has no narrow interface.**
Measured on 2026-08-17, the combat flight models reach `this.*` 129 times over
27 members, and would need about 18 handles. A collaborator that simply HAS the
ship needs one.

### The vocabulary is already in the tree

`brain-names.ts` opens *"Which named pilot flies"*. `brains.ts` says *"All
pilots are code"*. **The domain already names the object the code is missing.**

So the end state is three kinds of thing:

| the object | what it holds | lines today |
| --- | --- | --- |
| the ship | the hull, the state, the transform, the primitives, the clocks | about 400 |
| a behaviour | what this kind of ship does each frame | 124 over 6 branches |
| a pilot | how a ship is flown while it fights | 286 over 3 models |

### What update actually is

`update` is 157 lines. **124 of them are per-role behaviour, and 33 are the
orchestration**: the alive guard, the clocks, the `flownBy` reset and the
dispatch.

Its dispatch interleaves role checks and state checks. **That does not stop a
per-role behaviour**, because each role's own behaviour can hold its own order.
A trader asks whether it is fleeing. A pirate asks whether the commander is in
reach, then whether it has a target, then ambles.

**`alive` and `inert` stay in `update`.** Both are universal, and `inert` is a
Thargon whose mothership died rather than a role.

### What a behaviour needs from a ship

Measured per branch, and the union is 19 members:

| branch | lines | what it reaches |
| --- | --- | --- |
| idle: rock, hermit, generation | 23 | 9 members |
| hostile to the player | 15 | 5 |
| an NPC target | 10 | 4 |
| the armed trader defence | 57 | 13 |
| the trader | 7 | 2 |
| the amble | 21 | 6 |

**Four of the nineteen are pilots** — `attack`, `brainFly`, `pursuitFly` and
`chooseWeapon`. They leave the context when the pilots become objects.

**Three more are scratch**, and `game/trader-flight.ts` already shows the
answer: it keeps its own module scratch rather than borrowing the ship's. A
behaviour does the same, so `tmpDir` and `tmpVel` never reach the interface.

**So the shared context is about ten members**, declared ONCE for every
behaviour rather than once per free function. That is docs/TODO/169 M2's pattern
applied at the right size.

### Three facts make this safe

1. **Nothing does `instanceof NpcShip`**, anywhere in `src/`, `test/` or
   `train/`.
2. **Two sites construct a ship**: `game/world.ts` and
   `ai-training/scenario.ts`. Both go through the one constructor.
3. **`role` is saved**, so a restore re-derives the behaviour through that same
   constructor. No new field enters `NpcState`.

### Chris chose composition

A behaviour object the ship holds, rather than a subclass. He was offered
subclasses and a design-only item, and declined both. `world.spawn` needs no
factory, and a ship whose state changes does not have to change type.

## What to do

**THIS ITEM IS THE HEAD OF A PROGRAMME**, and it lands the seam plus the one
behaviour that needs no pilot. The rest follows in its own items, because
docs/TODO/169 and 176 both changed their own plan after M1 measured.

### M1 — the seam, and the ships that do not fight

`game/npc-behaviour.ts` declares two things. `NpcBehaviour` is one method that
flies a ship for one frame, and it returns a `FireEvent` or null.
`BehaviourShip` is the context every behaviour shares.

**The context is a structural interface, so no behaviour imports `npc.ts`.**
`NpcShip` satisfies it, as it satisfies `TraderShip` and `HostileShip` already.

`game/npc-idle.ts` holds the three roles that never fight: a rock and a hermit
tumble, and a generation ship drifts. It keeps its own scratch.

`update` then reads: the alive guard, the clocks, the `flownBy` reset, the
`inert` check, and a dispatch. Every branch that is not idle stays where it is
until its own item.

### What comes after, and why in this order

1. **the pilots** — `attack`, `pursue` and `brainFly` become objects that fly a
   ship. Three branches of `update` depend on them, so nothing else can move
   first. This is the item that answers the 69-call seam.
2. **the fighting roles** — pirate, police, hunter, thargoid. Free once the
   pilots are objects.
3. **the armed trader's defence** — 57 lines that are the trader's, and
   docs/TODO/176 M2 left them behind. Free once the pilots are objects.

## Decisions already made

- **Chris named the cause on 2026-08-17.** He said the project never used a
  good OO approach.
- **A behaviour object, not a subclass.** He chose it against both alternatives.
- **The pilots are the gate**, and this plan states it. An earlier ordering put
  the trader's defence first, and it was wrong: 36 of its 57 lines call a pilot.
- **No rule and no value changes.** This item moves behaviour into an object.

## Open questions

None that block M1.

## Watch out for

- **The seeded stream.** `update` draws twice, both in the amble, and neither
  moves in M1. A draw reordered changes every seeded outcome (invariant 11).
- **The step allocates nothing.** A behaviour is built once per ship, in the
  constructor, and never per frame. Its scratch is module scratch, exactly as
  `trader-flight.ts` keeps its own.
- **`flownBy` is the readout's one honest signal** (docs/TODO/88). `update`
  clears it, and a behaviour that forgets to stamp reports nothing rather than
  the last word a real flight left behind. Keep that.
- **A behaviour must not enter `NpcState`.** It is derived from `role`, which is
  saved. A field would make it a second home for the role.
- **`test/state.test.ts` scans `npc.ts` for `readonly state: NpcState;`.** It
  still holds after M1, and a later item must not break it silently.

## Verification

The gates always run: `npm run check`.

**The tier table puts this at "a rule that changes how a fight goes"**, because
`npc.ts` decides who shoots. **No value moves**, so the evidence is that nothing
moved:

- `survivability`, `aim-probe`, `gap-probe` and `ram-probe` byte-identical;
- `npm run campaign` byte-identical at two sizes;
- `roster-probe` byte-identical, because the idle roles are what it counts.

Take the baseline before M1.

**M1's gate**, in the shape docs/TODO/169 M2, 176 M2 and 181 all used:

1. a source scan that `game/npc-idle.ts` and `game/npc-behaviour.ts` name no
   ship class, with a control;
2. a fixture that drives each idle behaviour off an object literal, because a
   scan cannot say whether the context is honestly narrow.

**Prove each able to fail, and each one alone.**

## Outcome

### M1 — the seam, and the ships that never fight

`game/npc-behaviour.ts` is 79 lines and `game/npc-idle.ts` is 108. `npc.ts` is
1,292: it took the 23 idle lines out and added the dispatch, the behaviour
field and the header that explains the shape.

**THE FILE DID NOT SHRINK, AND THAT IS THE RIGHT RESULT FOR M1.** This milestone
buys the architecture rather than the lines. The three items after it are the
ones that move 286 and 124 lines, and neither could start until the seam existed.

**Nothing moved.** `survivability`, `aim-probe`, `gap-probe`, `ram-probe` and
`roster-probe` are byte-identical, and `npm run campaign` is byte-identical at
both sizes.

**The context is five members, not the ten the plan estimated.** `object`,
`role`, `maxSpeed`, `state` and `advance`. The idle roles ask for less than the
union did, and a later item widens it and says what it added.

**`advance` went public**, for the reason `maxSpeed` and `turnRate` did in
docs/TODO/176 M2: a collaborator needs the primitive.

**A HERMIT'S BEACON CLOCK IS THE FIRST THING A BEHAVIOUR KEPT FOR ITSELF.** It
was a private field on `NpcShip`, off the save on purpose. It never belonged to
the ship, and a behaviour that is per ship can simply hold it.

**THE CONSTANTS GATE FIRED, AND IT WAS RIGHT TO.** The four tumble rates were
bare literals inside `update` and invisible to every scan. Naming them made them
visible, and `test/constants.test.ts` demanded a home. They are on its OUTSIDE
list under a STAYS heading. No rule reads a roll rate, and docs/TODO/180
measured that whole class and left it alone.

**A bare literal in a class body is worse than a named one a list can see.**
That is the trade this milestone took, and the list records it.

**`test/npc-idle.test.ts` is 15 assertions in two parts.** A source scan over
both new files with a control, then four behaviours flown off one object
literal that constructs no ship at all.

**The inert claim is an ORDERING rather than a number.** A drone rolls slower
than a rock. A change to how a derelict looks is not a failure, and a change to
which of them looks calmer is.

**Proved able to fail three ways, and each one alone.** An `NpcShip` import
reddens the two scan claims. A derelict that sets its speed and never advances
reddens one fixture claim. **A shared beacon clock reddens two**, and that break
is the argument for a hermit being an object rather than a rate.

4,858 assertions became 4,873.

### What the next item has to answer

**The pilots.** `attack`, `pursue` and `brainFly` are 286 lines and three of
`update`'s branches call them. The seam this milestone built is what they become
objects against, and the 69-call measurement is what they have to beat.

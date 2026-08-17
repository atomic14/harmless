# 184 — The roles that fight get their own behaviour

**Kind:** architecture · **Severity:** medium · **Size:** medium · **Depends
on:** docs/TODO/183 · **Blocks:** nothing · **GitHub:** none

## Where we are

**The last cut of docs/TODO/182's programme.** Chris named the cause on
2026-08-17: the project never used a good OO approach. 182 built the seam and
took the roles that never fight. 183 made the three flight models pilots, which
was the gate on everything else.

**The pilots are objects now, so the fighting roles are free.**

### What is left in `update`

It is 146 lines. Measured on 2026-08-17:

| lines | branch |
| --- | --- |
| 17 | the alive guard, the clocks and the `flownBy` reset |
| 2 | the behaviour dispatch and the `inert` check |
| 32 | the fighting roles: the commander, an NPC target, and the fall-through |
| 64 | the trader: the armed defence, then its working life |
| 20 | the amble, which the fighting roles fall through to |

**Two behaviours are left**, and they are two subjects rather than one.

### What each one asks for

The union is 14 members. Two of the fourteen are scratch, and a behaviour keeps
its own as `game/trader-flight.ts` and `game/npc-idle.ts` both do. **So the
context grows from five to twelve**: it gains `armed`, `attackers`,
`chooseWeapon`, `nearestAttacker`, `npcTarget`, `pursuitFly` and `steerToward`.

**Twelve is `PilotShip`'s size**, and one interface over every behaviour is the
trade docs/TODO/182 explains.

**`chooseWeapon` is on that list, and docs/TODO/183 M3 is why.** The rail is the
ship arbitrating between its own pilots. A behaviour asks the ship what leaves
it, which is the same relationship `update` had.

### The interface has to widen too

`NpcBehaviour.fly(ship, dt)` was enough for a rock. **A fighting role needs the
commander and the world view**, so the method becomes
`fly(ship, dt, player, view)`. The idle behaviours ignore both.

## What to do

Two milestones, and the smaller subject goes first.

### M1 — the roles that fight

`game/npc-fighter.ts` holds one behaviour for the pirate, the police, the bounty
hunter, the Thargoid and the Thargon. It asks three questions in order: is the
commander worth attacking, is there an NPC target in reach, and otherwise it
ambles.

**The amble goes with it**, because it is what a fighting role does when nobody
is worth fighting. `constants/amble.ts` already owns its numbers.

**`NpcBehaviour.fly` widens in this milestone**, and `game/npc-idle.ts`'s four
behaviours ignore the two new arguments.

### M2 — the trader

`game/npc-trader.ts` holds the trader's behaviour: turn and fight when fleeing,
and otherwise get on with the working life.

**It calls `stepTrader` rather than absorbing it.** `game/trader-flight.ts` takes
a four-handle `TraderShip` and stays that way. A behaviour that needs twelve
handles must not drag the working life up to twelve with it.

**THE ARMED DEFENCE IS 56 OF ITS 64 LINES**, and docs/TODO/176 M2 left it
behind when it took the working life out. This closes that.

**Then `update` is the dispatch.** Report what it measures.

## Decisions already made

- **Chris named the cause on 2026-08-17**, and chose composition over
  subclasses.
- **`chooseWeapon` stays on the ship** (docs/TODO/183 M3). A behaviour asks it.
- **`stepTrader` keeps its narrow interface** (docs/TODO/176 M2).
- **No rule and no value changes.** This item moves branches into objects.

## Open questions

None that block M1.

## Watch out for

- **THE SEEDED STREAM IS THE WHOLE RISK, AND THIS ITEM MOVES THE DRAWS.** The
  amble draws twice, and both go with it. A draw reordered changes every seeded
  outcome (invariant 11), and only a probe says so.
- **The order of the three questions is load-bearing.** A ship that can attack
  the commander does that BEFORE it looks at an NPC target. Keep the order.
- **`state.flownBy`** (docs/TODO/88). The amble leaves it as `none`, which is
  correct: an ambling ship is not flying a combat model. The fleeing tail sets
  `fleeing`, and that is the only flight allowed to.
- **The step allocates nothing.** A behaviour is built once per ship in the
  constructor.
- **`test/flight-readout.test.ts` reads `flownBy` for every path.** It is the
  gate that catches a branch that forgets to stamp.

## Verification

The gates always run: `npm run check`.

**The tier table puts this at "a rule that changes how a fight goes"**, and this
item moves the branch that decides who a ship attacks. **No value moves**, so
the evidence is that nothing moved:

- `survivability`, `aim-probe`, `gap-probe`, `ram-probe` and `defence-probe`
  byte-identical at every milestone;
- `npm run campaign` byte-identical at two sizes;
- `npm run roster-probe` and `npm run dock-traffic`, because the trader is what
  they fly.

Take the baseline before M1.

**A gate per milestone**, in the shape docs/TODO/182 M1 and 183 both used. That
is a source scan with a control, plus a fixture off an object literal.

**Prove each able to fail, and each one alone.**

## Outcome

### M1 — the roles that fight

`game/npc-fighter.ts` is 116 lines. `npc.ts` went 947 lines to 911, and `update`
went 146 to 102.

**Nine probes and the campaign are byte-identical**, at both sizes. **This
milestone moved the two seeded draws**, and that was the whole risk.

**`BehaviourShip` EXTENDS `PilotShip` NOW, AND THE PLAN DID NOT HAVE THAT.** The
plan said the context grows from five to twelve. Written, a fighting behaviour
decides that the commander is worth attacking. It then hands the ship to a PILOT
to fly, so it needs both types. Saying it once beats every fighting behaviour
taking an intersection. It adds five members over `PilotShip`'s
thirteen.

**The roles that never fight pay for the type and not for the work.**
`game/npc-idle.ts` is four behaviours that touch five members between them.

**ONE MEMBER OF THE CONTEXT NAMES THE CLASS, AND IT IS HONEST TO SAY SO.**
`npcTarget` and `nearestAttacker` return an `NpcShip`. A pilot that shoots at
one reports it in a `FireEvent`, and that event carries the real ship to
`fire-resolution.ts`. Every import is still `import type`, so no file holds a
runtime dependency on `game/npc.ts`.

**SO A GATE'S CLAIM MOVED, AND `test/npc-idle.test.ts` SAYS WHY.** It held that
`game/npc-behaviour.ts` names no ship class. That claim is now false and was
right to become so. The claim that holds is docs/TODO/183's: the ship a
behaviour FLIES is a `BehaviourShip`, and every `npc.ts` import is type-only.

**A count moved for the second time in the programme.** The amble's `approach`
went with the fighter, so `test/deleted-members.test.ts` reads five files rather
than four.

**`test/npc-fighter.test.ts` is 10 assertions in two parts.** The scan is the
programme's usual shape. The fixture records WHICH pilot the behaviour reached
for, because the subject is the ORDER of its three questions and no scan can see
that.

**THE ORDER IS THE ASSERTION THE FILE EXISTS FOR.** With a reachable commander
AND a live NPC target, the commander wins. Swapping the two blocks reddens that
one claim and nothing else.

**Proved able to fail two ways, and each one alone.** The two questions swapped
reddens the order claim. A value import of `NpcShip` reddens the scan.

4,895 assertions became 4,906.

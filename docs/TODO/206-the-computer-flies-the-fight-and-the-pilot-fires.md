# 206 — The computer flies the fight, and the pilot fires

**Kind:** enhancement · **Severity:** high · **Size:** large · **Depends on:**
205 · **Blocks:** 208 · **GitHub:** none

## Where we are

**205 takes the stick away from the pilot for a trip.** A trip meets ships, and
this plan says what happens then. Chris's words in `MOBILE_CONVERSION.md`:
*"Combat mechanism - the computer tries to line you up with the target you have
currently selected. The user can control, lasers, missile arming, misile firing,
ECM system."*

**The bought combat computer already flies a whole fight.** It points the nose
at a threat, in pure pursuit (`scripted-co-pilot.ts`). It pulls the laser
trigger, and it reaches for the E.C.M. It does not launch a missile. It needs
`equipment.combatComputer`, and it hands the ship back on a touch of a flight
key.

**It picks its own threat.** `threat-lock.ts` picks the nearest hostile and then
commits to it. Three places share that rule: the combat computer, an armed
trader under attack, and the training episode. No pilot choice reaches it.

**The ways out of a fight exist as keys.** `prompts.ts` offers two of them
while they are worth something:

- the bribe, which pays a police patrol (`law.ts`, `BRIBE_SHARE`);
- the cargo dump, which buys off pirates with the best goods first
  (`jettison.ts`).

**The player's ship is the fastest ship in the sky, by a small margin.**
Measured from `SPECS` in `ship-specs.ts` on 2026-09-11:

| ship | top speed, u/s |
| --- | --- |
| the player's Cobra | 400 |
| the fastest pirate, and the fastest bounty hunter | 381 |
| the Constrictor | 370 |
| a Thargon | 350 |
| a police Viper | 320 |
| a Thargoid | 300 |

Both sides' lasers reach 3,500 units, and a missile flies at 700 u/s. So a run
from the fastest pirate gains only 19 u/s. A run from a police Viper gains 80.
No ship outruns a missile, and the E.C.M. is the answer to one.

**Fuel scoops decide what a ship can collect.** Without scoops, a canister
breaks on the hull (`world-step.ts`). A scoop takes a canister inside 45 units.

## The words this plan uses

- **The target list** is every ship, rock and derelict inside scanner range,
  with the one that the pilot picked marked. It is derived state.
- **The fight** starts when a hostile enters scanner range, or when the pilot
  picks a target. It ends when no hostile is in range and no target is picked.

## What to do

Six milestones.

### M1 — the target list

A new pure module, `game/targets.ts`, lists what the ship can fight. The
hostiles come first, nearest first. The police, the traders, the rocks and the
derelict come after them. Each row carries a name, a range and a standing.
Each row also says what an attack costs where the law protects the ship. The
words come from `harmVerdict` in `law.ts`, the one home of that rule.

With no pick, the target is the threat that `threat-lock.ts` chose. The pilot's
pick overrides it until that ship dies or leaves. Do not change the rule of
`threat-lock.ts`. The pick sits on top of it, because two other places share
that rule.

### M2 — the computer flies at the pilot's target, for every pilot

The scripted co-pilot flies every ship now, and not only a ship with a combat
computer. It takes the target from M1. It flies the nose onto the target, and
it does NOT pull the trigger. The trigger belongs to the pilot.

A rock does not move, and pure pursuit meets it head-on. A derelict is 340
units across. The standoff must keep the ship outside
`GENERATION_SHIP_RADIUS`.

### M3 — the pilot's hands

Four controls, as buttons on the flight view and as the existing keys. A
button takes a mouse click on a desktop, and a tap on a phone:

1. the laser, which fires while it is held;
2. the missile, which arms on one press and launches on the next. It locks on
   the target that the pilot picked;
3. the E.C.M.;
4. the target list, which opens as rows over the view.

The laser heat stays the pilot's to manage. The trigger goes through the path it
uses today, because a shot has legal consequences, and those are the Game's.

### M4 — the bought combat computer flies all of it, except the missiles

With `equipment.combatComputer`, the computer also pulls the trigger, reaches
for the E.C.M. and picks the targets. The pilot watches. The pilot may still
pick a target, and the computer then fights that one.

**The computer never launches a missile.** A missile costs money, so the
pilot decides when to spend one. The pilot arms it and fires it by hand, at
the picked target, as in M3.

**A key takes the stick back.** During a fight, a flight key hands the ship
to the pilot, as it does to the co-pilot today.

### M5 — the ways out, as courses

During a fight, the course list of 205 carries three more rows:

- **run**, which turns away from the fight and engages the torus when the lock
  clears. The row says the margin, because a run from a fast ship is slow;
- **pay the police**, where `prompts.ts` offers the bribe today;
- **dump cargo**, where `prompts.ts` offers the dump today.

The prompts line then has nothing left to say about these two. Remove it where
it only repeats a row.

When the fight ends, the course of 205 resumes. A ship that met pirates on the
way to the station goes on to the station.

### M6 — collect everything

When the fight ends with canisters or escape pods in scanner range, the course
list offers "collect everything". It needs fuel scoops, and without them the
row says so. The ship flies to each item, nearest first, and scoops it. A pick
of another course stops the collection. The ship collects nothing on its own
without the pick.

## Decisions already made

- **Timing and tactics are the pilot's** (Chris, 2026-09-11). The pilot owns
  the laser, the missiles, the E.C.M. and the choice of target.
- **The bought combat computer takes control of everything but the missiles**
  (Chris, 2026-09-11). The pilot sits back and watches. The pilot targets and
  fires a missile by hand, because *"missiles cost money"*.
- **A flight key takes control during a fight, and a new button takes a mouse
  click** (Chris, 2026-09-11).
- **A trader is on the target list** (Chris, 2026-09-11). No hail or demand
  comes first. The law answers as it does today.
- **Collection needs fuel scoops** (Chris, 2026-09-11). The ship flies round the
  items, and the pilot can stop it.
- **A fight can be left** (Chris, 2026-09-11). The run, the bribe and the cargo
  dump are all options.
- **Rocks and derelicts use the same fight** (Chris, `MOBILE_CONVERSION.md`).
  Mining is a fight with a rock, and the ore is then collected.

## Open questions

None. The balance of a fight with a computer at every stick is a measurement,
and the Verification section names it.

## Watch out for

- **Invariant 5.** Training flies the real modules. A change to the co-pilot
  must not change the NPC side, or the trainer's target ship. The trained
  defence seat in `combat-computer.ts` is dormant, and it stays dormant.
- **The trigger is the Game's** (`autopilot.ts`). The pilot's button presses
  the fire command through the path that the key uses today.
- **`threat-lock.ts` serves three places.** The pilot's pick is a layer above
  it, and never a change to it.
- **The combat trainer is ordinary flight.** It gets the target list and the
  buttons for free. `combat-sim-safety.ts` still holds that nothing leaves an
  exercise.
- **A mission's hunt target is a row like any other.** 208 marks it.
- **The police are on the list.** An attack on a Viper costs what it costs
  today, and the row says so before the pilot fires.

## Verification

The gates always run: `npm run check`. `npm run generate:constants` runs first
when a milestone adds a constant.

The tier: a rule that changes how a fight goes. `survivability`, `aim-probe`,
`defence-probe` and `ambush-probe` run before M2 and after M4. Each sampled
number runs at two sample sizes before it drives a decision.

Evidence:

- `test/targets.test.ts` pins the order of the list and the override of the
  pick.
- A headless fight shows that the co-pilot follows the pilot's pick, and that
  it fires only when the pilot's trigger is down.
- A headless fight with a combat computer shows no missile launch, and a
  missile that the pilot fires locks on the picked target.
- A headless run from a police Viper opens the range, and the torus engages
  when the lock clears.
- A headless collection scoops every canister in range, and it stops on the
  pick of another course.
- Chris flies a fight on his phone. His verdict on whether it is FUN is the one
  measure that no probe reaches.

## What the milestones found

### M1

- **A ship has no stable id, so the pick is a flag on its state.**
  `NpcState.targeted` is saved with each ship, as every field of that state
  is. A pick in the session would hold an index into the ships, and the index
  moves when a ship leaves.
- **The name a player sees is the scene object's name**, as the arrival
  lines use it.
- **The list says what an attack costs in its own words.** `harmVerdict` in
  `law.ts` still decides whom the law protects. Its words are for the moment
  of the hit, so the list writes THE LAW PROTECTS THIS SHIP instead. The
  hermit is not the law's, and the list says what killing him costs.
- **The suite has 5,746 assertions,** from 5,733.

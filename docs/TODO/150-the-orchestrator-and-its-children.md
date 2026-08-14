# 150 — The orchestrator and its children

**Kind:** refactor · **Severity:** low · **Size:** large · **Depends on:** 149 ·
**Blocks:** nothing · **Source:** the backlog's head, promoted 2026-08-14.

## Where we are

`src/game/game.ts` is **2,528 lines and 201 commits** — three times the collision
cost of anything else in the tree — and its own exemption admits what it is:

> DEBT: down from 3,244 and still the orchestrator plus leftovers. Target ~300.

It is eight times over the target it set itself.

**The rule it fails is Chris's, set on 2026-08-14:** one responsibility per file,
and *"single responsibility does not mean put everything in one file. A file can
import child files. The key is to keep files small so they can be easily
understood."* So the target is not a shorter `game.ts`. It is a small
orchestrator beside the children it composes.

## What the triage found

**It is 114 members over about thirteen areas**, none of them enormous:

| lines | area |
| ---: | --- |
| 272 | input, the step and the control mode |
| 236 | the law |
| 132 | the trainer |
| 130 | the world and spawning |
| 126 | saves and persistence |
| 122 | messages |
| 115 | rendering and the HUD |
| 110 | hyperspace |
| 103 | death |
| 88 | contracts and survivors |
| 75 | ordnance |
| 74 | the station |
| 59 | trade |
| 669 | the constructor (163) and a tail of 40 members |

**Most areas already HAVE a rules module.** `law.ts`, `persistence.ts`,
`contracts.ts`, `ordnance.ts`, `station.ts` and `world-step.ts` all exist and all
came out of this file — which is how it fell from 3,244. What is left in
`game.ts` is the ORCHESTRATION: the handler that spends a rule and applies its
consequence.

So the decomposition axis is not "move the rules out" — that is done. It is
**"move the handlers out, beside the rules they spend"**.

**The pattern is already in the codebase.** `station.ts` takes the state and a
narrow `StationHost` of the few things it needs back, and returns events the
Game applies. `Ordnance` and `WorldStep` are the same shape. A new child module
is not a new idea here; it is the sixth of its kind.

**M1's area was measured for coupling before it was chosen.** The six law
handlers touch `state`, three message helpers, the mode, a scratch vector and
each other — and nothing else:

```
bribePolice         41 lines   mode, offerTo, showMessage, state
throwOverboard      38 lines   mode, showMessage, state, tmp
raiseLegal          11 lines   callStationDefence, queueMessage, state
callStationDefence  22 lines   baseMode, queueMessage, state, tmp
offerTo             25 lines   markName, showMessage, state
payFine             11 lines   showMessage, state
```

That is a host interface of four methods.

## What to do

### M1 — the law's consequences leave

`src/game/law-actions.ts` takes the six handlers above. It sits beside
`game/law.ts`, which owns the RULES — what a bribe costs, what a record is worth
— and holds what the Game does with them: offering money to a patrol, throwing
the evidence overboard, raising a status, calling the station's defence, and
buying a name back.

It follows `station.ts`: the state plus a narrow host, returning events where it
can. The host is `showMessage`, `queueMessage`, `markName` and the mode.

**One responsibility: what the law does to a commander, and what she can do about
it.**

### M2 onwards — re-assessed after M1

**Do not fix the order here.** docs/TODO/149 M2 planned one chart file, measured
719 lines and found four subjects; the plan was right because it deferred to the
measurement. The same applies to every area above: the sizes are a map, not a
schedule.

What M1 has to answer, and what the next milestone is chosen on:

1. Does a child module of this shape actually shrink `game.ts`, or does it trade
   150 lines of handler for 100 lines of host wiring?
2. Is the host interface narrow enough to be worth having, or does the child end
   up calling back for everything?
3. Which area is next — the candidates by cost are the law (done), the trainer,
   the world and spawning, and saves.

The constructor is **163 lines** and is deliberately last. It is where every
child is wired, so it can only shrink once the children exist.

## Decisions already made

- **One responsibility per file, and a responsibility may be a parent plus
  children** (Chris, 2026-08-14).
- **No prose is cut to make anything fit** — docs/TODO/148's lesson.
- **Every comment travels with the code it explains** — 148 and 149.
- **The target is a small `game.ts`, not a shorter one.**

## Open questions, and the answers

**1. Why not start with the biggest area?** The biggest is input and the step at
272 lines, and it is the orchestrator's own job — dispatching a command and
running a frame is what a `Game` is FOR. It is the part most likely to stay.

**2. Why not a `game/` directory?** Because `src/game/` already is one, and the
children belong beside the rules they spend: `law-actions.ts` next to `law.ts`.
A `game/game/` would be a directory named after the file rather than the
subject.

**3. Does the DEBT entry come off?** Not at M1. It is honest and it names a
target, so it stays until `game.ts` reaches it — and the entry gets the number
each milestone leaves it at.

## Watch out for

- **`test/playtest.js` drives the Game from a console paste**, and calls its
  methods by name. A method that moves has to keep a caller, or the agent breaks
  silently — nothing type-checks that file.
- **`game.ts` is PLATFORM** in `tools/portability.mjs`. A child that holds rules
  rather than wiring should be PORTABLE, so check which bucket each lands in.
- **The message helpers are the host's, not the child's.** `showMessage` and
  `queueMessage` decide whether a line takes the console or waits for it
  (docs/TODO/144 M3 found what happens when that is got wrong). One home.

## Verification

**The gates always run**, and they are `npm run check`. This moves code between
files and changes no rule, so docs/PROCESS.md's tier table asks for nothing more.
`npm run portability` runs too, because the module graph moves.

**A refactor's gate is that nothing needed a new test.** The law is covered by
`test/bribe.test.ts`, `test/bribe-flight.test.ts`, `test/law.test.ts` and
`test/record-line.test.ts`; all must pass untouched at the same assertion count.

**And the numbers that say it worked:** `game.ts` smaller by roughly the area
moved, the child under 400 with a stated single responsibility, and no new
`ALLOWED` entry.

## What landed

**M1, on 2026-08-14.** `npm run check` passes, `npm run portability` unchanged.

| | |
| --- | --- |
| `game/game.ts` | 2,528 → **2,251** |
| `game/law-actions.ts` | 302 (new) |

All 762 comment lines survive across the two files.

## What M1 found that the plan did not have

**1. The host is seven methods, not four.** The plan measured the handlers'
coupling and counted `showMessage`, `queueMessage`, `markName` and the mode.
The three it missed matter:

- **The mode is read TWICE, and they are different questions.** `mode()`
  includes an open screen, so a bribe is refused while a chart is up.
  `baseMode()` does not, because the defence fleet cares where the SHIP is
  rather than what is on screen. Reading one for the other would either
  scramble Vipers at a commander looking at a map, or refuse a bribe to a pilot
  being shot at. Two host methods, and the interface says why.
- **Two sounds belong to the host** because `audio.ts` is PLATFORM. A child that
  imported it would stop being portable, and the point of moving a handler out
  of `game.ts` is that the child CAN be portable when `game.ts` is not.

**2. Two methods stay on the Game as one-line delegates — and the reason I first
gave for them was wrong.** `raiseLegal` and `bribePolice` carry
`@internal — driven by test/playtest.js`, and I repeated that in the M1 commit
message without checking it. **`test/playtest.js` calls neither.** Both doc
comments are stale.

The delegates are still right, for a plainer reason: both have live callers
INSIDE `game.ts` — `raiseLegal` from the step host and two event appliers,
`bribePolice` from the command table — so the delegate is simply how the
orchestrator reaches its child.

**What `test/playtest.js` actually calls, which is the list the next milestone
needs**, since nothing type-checks that file:

```
acceptContract  buyCargo   buyEquipment  fireLaser
launch          lookAlong  massLocked    priceMultiplier
respawn         sendDistressBeacon       startHyperspace   update
```

Twelve methods. **`respawn` and `launch` are in it**, so the death area and the
station area both need a delegate when their turn comes. The two stale
`@internal` comments are left as found rather than corrected here, because a
sweep for stale `@internal` claims is its own small item and not this one.

**3. The shape works, and the numbers say so.** 277 lines out, 302 in, about 25
lines of wiring. The plan's first open question — does a child of this shape
shrink the parent, or trade handlers for host wiring — is answered yes.

## M2 — chosen on M1's evidence

The plan deliberately left the order open. On M1's result the next candidates by
cost are **the trainer** (132 lines, and `combat-sim.ts` already exists to sit
beside), **the world and spawning** (130) and **saves** (126).

**The trainer is closest to M1's shape**, because `simHost` is already a host
interface — so the work is to move the four handlers behind it rather than to
invent a seam.

**Two things M1 says to check before choosing anything:**

1. **Does the area have an existing rules module to sit beside?** M1 worked
   because `law-actions.ts` had `law.ts` to be next to. An area with no such
   partner needs a name of its own, which is a harder decision than a move.
2. **Does `test/playtest.js` call any of its methods by name?** That file is
   unchecked by the compiler, so grep it BEFORE moving anything, and leave a
   delegate for every hit.

**Still true from the plan:** the 163-line constructor is last, because it is
where every child is wired.

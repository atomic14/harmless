# 155 — The docked half and the flight half

**Kind:** refactor · **Severity:** low · **Size:** large · **Depends on:** 150 ·
**Blocks:** nothing · **Source:** Chris, 2026-08-14, on reading 150 M6: *"It
makes sense to split docked from flight - they are very different things. Why
would you want to couple them together?"*

## Where we are

docs/TODO/150 took five responsibilities out of `src/game/game.ts` and left
1,810 lines. M6 measured what remained and found 75% of it cannot leave by that
axis, so the file's stated target of ~300 is unreachable by taking more areas
out. M6 named three ways forward. **Chris chose the third: split the
orchestrator itself.**

## The code already agrees with the question

Nothing argues for holding the two together. The seam is written down in three
places already:

1. **The command table sections itself by mode**, in its own comments: *"the
   station menu"*, *"shared between the menu and the cockpit"*, *"the cockpit"*.
2. **`controls.ts` has a binding table per mode.** `commandsFor('docked', …)`
   and `commandsFor('flight', …)` never interleave.
3. **Only eleven lines in 1,810 test the mode at all.** The mode machine is
   thin; what hangs off each side of it is not.

## What the split measures

Every member traced from the roots each mode can reach — the command table's own
sections, the frame, and the screens each mode may open:

| half | members | lines |
| --- | ---: | ---: |
| **docked** | 17 | **177** |
| **flight** | 37 | **441** |
| both | 4 | 77 |
| shared — the parent's own | 36 | 384 |

**The two halves are real and they are lopsided.** Flight is two and a half
times docked, because `station.ts` already owns the station's transitions and
the docked screens own themselves, while the cockpit's frame, ordnance, combat
and autopilots all report to the orchestrator.

**The four in BOTH are the interesting ones**, and they are the honest answer to
"what couples them": `enterDocked` and `applyStation` are the transition itself,
`raiseLegal` is a record that moves in either place, and **`openHermitTrade` is
a market reached in FLIGHT** — a station's act, in the cockpit, which is why the
hermit exists.

## What to judge it by

**Not the line count** (Chris, 2026-08-14): *"We should not obsess over the 300
lines. What we are looking for is a clean architecture."* `tools/sizes.mjs`
already says the same thing about its own ceiling — it is a DETECTOR, and the
rule is one responsibility per file. So this item is judged on the boundary it
draws, and three questions answer that:

1. **Can each of the three files state one responsibility in a sentence a reader
   can check by opening it?** Docked and flight can. The parent's sentence is
   the one to watch: if it comes out as a list, the split has produced a
   leftovers file rather than an orchestrator.
2. **Does the seam run where the game's own concepts run?** The command table,
   the binding tables and the mode machine all already cut here. A boundary that
   agrees with three existing ones is a real seam rather than an imposed one.
3. **Does any rule end up with two homes?** That is the failure this codebase is
   organised against, and a mode split is where it would show: a rule that is
   true at a station AND in flight must not be written down twice.

**The sizes are a consequence, and they are recorded rather than aimed at.** The
parent lands near 900 to 1,000, flight near 550 to 600, docked near 250 to 300.
The parent roughly halves.

**What the split does not touch, and this is worth knowing early.** The bulk
that remains in the parent is not the docked/flight coupling. It is the
machinery both halves stand on: the frame, the input routing, the 81-line
command table, the console, the sound, the screen stack and the persistence
host. If the parent's one-sentence responsibility comes out clean, that is
correct and it is what an orchestrator is. If it does not, the next item is
about that machinery rather than about the modes.

**And the delegates get worse before they get better.** Eleven Game methods are
driven by `test/playtest.js` alone, and they fall on both sides of the seam —
`buyCargo`, `buyEquipment` and `acceptContract` are docked; `fireLaser`,
`lookAlong`, `massLocked`, `respawn`, `sendDistressBeacon`, `startHyperspace` and
`update` are flight or shared. Each one leaves a delegate in the parent, at
about nine lines with its comment.

## What to do

### M1 — the docked half

`src/game/docked.ts`. The 17 members above: the station menu's acts, the market
and equipment contexts, the bulletin board's handlers, and the survivors.
**One responsibility: what a commander does while she is docked.**

It goes first because it is the smaller half, and because the host it needs is
the host the flight half will need too. Discover that interface at the cheaper
end.

### M2 — the flight half

`src/game/flight.ts`. The 37 members: the cockpit's keys, the ordnance, the
combat appliers, the autopilots and the exercise. **One responsibility: what a
commander does while she is flying.**

### M3 — the transition, and the target

The four BOTH members. `enterDocked` and `applyStation` are the transition
between the two halves, so they belong to the parent that owns the mode machine.
`raiseLegal` is already a delegate onto `law-actions.ts`. `openHermitTrade` is
the decision: it is a station's act in flight, and M3 chooses whether it travels
with the market or with the cockpit.

Then correct the `tools/sizes.mjs` entry to what the file actually is, which is
the debt 150 M6 left open.

## Decisions already made

- **Docked and flight are two different things and are split** (Chris,
  2026-08-14). *"Why would you want to couple them together?"*
- **The goal is a clean architecture, not a line count** (Chris, 2026-08-14):
  *"We should not obsess over the 300 lines."* So no file is measured against a
  number here. Each is measured against the one responsibility it can state.
  The `~300` that `game.ts` has carried since before docs/TODO/150 is retired
  rather than re-aimed.
- **The five children of 150 stand.** This item divides what is left; it does
  not revisit them.
- **No prose is cut to make anything fit** — 148's lesson, carried through 150.
- **Every comment travels with the code it explains.**

## Open questions, and the answers

**1. Does the parent keep the command table?** Yes. Its arms call about sixty
Game methods and it is deliberately the whole surface a replay, an AI or a test
drives the game through. After M1 and M2 its arms become reaches into the two
halves, which is the same table with different receivers.

**2. Does the frame move to flight?** No. `update` and `step` run in both modes;
only `updateFlight` is flight's, and it moves. The frame skeleton is the
parent's, because a docked screen still needs frames.

**3. Is a mode a class or a module?** A class with a host, like the five children
of 150. The pattern is proven five times and the delegates read the same way.

**4. Should the halves be one directory, `game/modes/`?** Not for two files.
`game/` is already the directory, and `docked.ts` beside `station.ts` reads
correctly.

## Watch out for

- **The eleven methods `test/playtest.js` drives** are listed in
  docs/TODO/151. Nothing type-checks that file. Each one that moves needs a
  delegate, and `claims:check` will hold the comment that says so.
- **`openHermitTrade` is a station act in flight.** It is the one member that
  proves the halves are not a clean partition, and M3 owns it.
- **The mode machine is the parent's.** `baseMode` is assigned in five places;
  a half that sets it would be deciding its own succession.
- **`game.ts` is PLATFORM.** Both halves reach screens, so both will be too.
  That costs the port nothing, for the reason 150 M3 and M5 both recorded.

## Verification

**The gates always run**, and they are `npm run check`. This moves code between
files and changes no rule, so docs/PROCESS.md's tier table asks for nothing
more. `npm run portability` runs too, because the module graph moves.

**A refactor's gate is that nothing needed a new test.** The suite must pass at
the same assertion count, untouched, as it did through all five milestones of
150.

**What says it worked**, in the order that matters:

1. **Three files, three sentences.** Each names one responsibility, and a reader
   can check the claim by opening the file. The parent's sentence is the test of
   the whole item.
2. **No rule with two homes.** Nothing true in both modes is written down twice.
3. **The seam holds under the gates.** The suite passes untouched at the same
   assertion count, and `npm run portability` reports no portable line turned
   platform.
4. **Every comment line accounted for**, moved or reworded, none dropped.

The line counts are recorded in the milestone notes because they are useful
history, and they are not a pass mark.

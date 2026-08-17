# 177 — A test compares the player's gun against a copy of itself

**Kind:** defect · **Severity:** medium · **Size:** small · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none

## Where we are

Chris asked for the next smell on 2026-08-17, after docs/TODO/176's own
conclusion turned out to rest on a bad count.

**`test/world-step.test.ts` holds a section that never steps the world.** It is
116 lines, and it is called *"the player's gun and hull, assembled from a
state"*. Six of the file's seven sections drive the step. This one drives it
zero times.

### Four assertions compare a call against a transcription of that call

The section runs the same shot twice. Once through `firePlayerLaser`, and once
through arguments written out in the test file. It then demands the two agree.

The test's version, at `test/world-step.test.ts:378`:

```ts
byHand.combat.fire(
  byHand.state.commander, byHand.state.sys, byHand.state.player.position,
  viewDirection(byHand.state.player.quaternion, byHand.state.session.view, tmp),
  byHand.state.session.view, byHand.state.session.witchspace, byHand.scratch)
```

The real one, at `src/game/combat-player.ts:38`:

```ts
combat.fire(
  commander, sys, player.position,
  viewDirection(player.quaternion, session.view, scratch.b),
  session.view, session.witchspace, scratch)
```

**It is a line-for-line copy.** The same holds for `hitPlayer` at
`test/world-step.test.ts:420` against `src/game/combat-player.ts:56`.

### The second party to the comparison no longer exists

The section's own comment explains itself: `game.ts` used to build all seven
arguments out of `this`, and the extraction moved that job to
`combat-player.ts`.

**Measured on 2026-08-17, the only caller of `Combat.fire` and
`Combat.hitPlayer` in `src/` is `combat-player.ts` itself.** So nothing spells
the arguments out any more. The comparison has one real party and one copy.

**So the check cannot report that anything is wrong.** It can only demand that
two copies agree. A legitimate change to the assembly reddens it, and the repair
is to update the copy. `CLAUDE.md` names this: *"Assert behaviour. Do not assert
an implementation against itself."*

### A neighbour already states the critique

`test/fire-resolution.test.ts`'s header says it in as many words: *"A test that
drove the shared function twice would agree with itself and would have passed on
the code as it was."* That file drives two REAL paths and compares them, which
is the shape this section only appears to have.

**The two files do not overlap.** `fire-resolution.test.ts` holds the pure
`hitFromAhead` predicate, and the applied consequence on the TRAINER's target.
Nothing there drives `damagePlayer` onto the commander's own shields.

### Four of the eight assertions are real behaviour

The section is not worthless. Four of its assertions say something a copy could
never say:

1. a rear-view shot hits what is behind you;
2. with no rear mount fitted, nothing fires at all;
3. a hit from astern lands on the aft shield and leaves the fore one whole;
4. the shot landed at all, which is the control the other three need.

## What to do

One milestone. It moves four assertions, deletes four, and repairs two claims
about the file they leave.

### M1 — the gun gets its own file, and the fossil goes

**`test/combat-player.test.ts` is the new home.** `src/game/combat-player.ts`
has no test file of its own today, and the suite is organised one file per
subsystem. **`test/combat.test.ts` is not the home.** It is 636 lines behind a
stated reason about the wreck path and the collision ceilings. A player-gun
block would make that reason false.

**The four behaviour assertions move unchanged**, with the fixture they need.

**The four equivalence assertions are deleted**, and this document records why.

**Repair the two claims about `test/world-step.test.ts` in the same commit**
(`CLAUDE.md`, docs/TODO/152):

1. its module header says *"the world step, headless: five phases in the order
   they must run"*, and docs/TODO/176 M3 measured that as false;
2. `tools/sizes.mjs`'s row, which docs/TODO/176 M3 rewrote, names the save block
   as the one section that can leave. **That is wrong too**, and this item found
   it. The save block flies the step four times, and its load-bearing claim is
   that a restored world replays the run byte for byte.

**The honest reason for the file is its own header's second sentence**:
everything that can only be asserted by stepping the real world under node.
After M1, every section left drives the step.

## Decisions already made

- **Chris chose to delete the four equivalence assertions, 2026-08-17.** He was
  offered the option of moving all eight unchanged, and he declined it.
- **No sweep of the rest of the suite.** He was offered that as a third option
  and declined it. A keyword search found only hand-built FIXTURES elsewhere,
  which are a different and correct practice.
- **docs/TODO/176's report-shape candidate is withdrawn**, and its records carry
  the correction. This item does not revisit it.

## Open questions

None. The two decisions above close the only forks this item had.

## Watch out for

- **The deletion must be justified by measurement, not by argument.** The
  Verification section below states how: break the real assembly, and show the
  KEPT assertions go red. A deletion nobody can show is safe is a deletion on
  taste.
- **`test/fire-resolution.test.ts` must not lose anything.** It holds the
  predicate and the trainer's target. This item adds the commander's own
  shields, and it takes nothing away.
- **The rear-view claims need two pieces of state.** They need
  `session.view = 1` and `commander.equipment.rearLaser`. The second is what
  makes the "nothing happens" half a real branch rather than a miss.
- **`test/world-step.test.ts` stays over 400 lines**, so its row stays. Only the
  reason changes.
- **The assertion count falls by four**, and the outcome states that plainly. A
  suite that shrinks is the right result here.

## Verification

The gates always run: `npm run check`.

**The tier table puts this at "nothing more".** No file under `src/` changes at
all, so no probe is owed and no rule moves.

**The new file must be proved able to fail**, and each claim alone:

1. make `firePlayerLaser` pass the nose direction rather than the view
   direction, and the two rear-view claims redden;
2. make `damagePlayer` read the fore shield for a hit from astern, and the
   aft-shield claim reddens.

**THE FIRST PROOF IS ALSO THE DELETION'S EVIDENCE.** The deleted assertions
existed to catch a wrong argument reaching `Combat.fire`. Step 1 sends a wrong
argument. If the kept assertions redden, they cover what the deleted ones
covered, and the deletion loses nothing.

**Report the assertion count before and after**, and say that it fell.

# 151 — Twenty-one comments name a caller that does not exist

**Kind:** defect · **Severity:** medium · **Size:** small · **Depends on:**
nothing · **Blocks:** nothing · **Source:** Chris, 2026-08-14, on reading the
comment review: *"Comments should help explain the code."*

## Where we are

Thirty-one members in `src/` carry a doc comment of this shape:

```
@internal — driven by test/playtest.js
```

**Twenty-one of them are false.** `test/playtest.js` calls eleven methods on the
game object, and no more:

```
acceptContract  buyCargo  buyEquipment  fireLaser  launch  lookAlong
massLocked      respawn   sendDistressBeacon       startHyperspace  update
```

A false claim of this kind is worse than no comment at all. It tells the next
maintainer that a method has a caller outside the type system. That maintainer
will then keep a dead method. That maintainer will also refuse a signature
change that nothing forbids.

**The claim is not decorative. It is the only record of an untyped caller.**
Nothing type-checks `test/playtest.js`, because it is a console paste. So the
ten TRUE claims are load-bearing, and that is exactly why the false ones do
damage.

## The full list

| file | line | member |
| --- | ---: | --- |
| `game/law-actions.ts` | 92 | `raiseLegal` |
| `game/law-actions.ts` | 171 | `bribePolice` |
| `game/world-build.ts` | 65 | `buildWorld` |
| `game/world-build.ts` | 118 | `enterWitchspace` |
| `game/world-build.ts` | 139 | `spawnNpc` |
| `game/game.ts` | 489 | `raiseLegal` |
| `game/game.ts` | 492 | `bribePolice` |
| `game/game.ts` | 817 | `sellCargo` |
| `game/game.ts` | 874 | `enterDocked` |
| `game/game.ts` | 978 | `captureSnapshot` |
| `game/game.ts` | 981 | `restoreSnapshot` |
| `game/game.ts` | 1108 | `generateContractOffers` |
| `game/game.ts` | 1235 | `arriveInSystem` |
| `game/game.ts` | 1283 | `destroyNpc` |
| `game/game.ts` | 1430 | `toggleCombatComputer` |
| `game/game.ts` | 1697 | `openHermitTrade` |
| `game/game.ts` | 1912 | `openChart` |
| `game/game.ts` | 1919 | `openLocalChart` |
| `game/game.ts` | 1950 | `openSystemData` |
| `game/game.ts` | 2000 | `jettisonCargo` |
| `game/game.ts` | 2016 | `jettisonContraband` |

One other claim of the same shape names `test/prewarm.test.ts`, on
`galacticJump`. It is **true**, and it stays.

## Why it happened, and why a sweep alone is not enough

**The claim was correct once, and `test/playtest.js` shrank away from it.** No
gate connects the two files, so the comment could not fail.

**The extraction programme then copied it forward.** Five of the twenty-one now
sit in `law-actions.ts` and `world-build.ts`. docs/TODO/150 M1 and M2 both moved
a stale claim into a new file and both recorded it. **Each further milestone of
150 will copy more.** That is the argument for this item to run first.

## What to do

### M1 — the sweep

Correct all twenty-one. Do not delete the line where the member still needs a
reason to be public. Most of them do, and the reason differs:

1. **A live caller inside its own parent.** `raiseLegal`, `bribePolice`,
   `buildWorld` and `enterWitchspace` are reached by the orchestrator. Say that.
2. **A caller in another test.** Check first. Name the file that really calls it.
3. **A screen or a context reaches it.** `openChart`, `openSystemData` and
   `sellCargo` are on the command table or a screen context.
4. **Nothing reaches it.** Then the member is dead, and the sweep found a second
   defect. Report it. Do not delete it inside this milestone.

**Report what each one turns out to be.** The plan does not predict the four
counts, and the split is the interesting result.

### M2 — the gate

`tools/internal-claims.mjs`, wired into `npm run check`. It does one thing:

1. Read every `driven by <path>` claim in `src/`.
2. Find the member declaration below it.
3. Fail when that name does not appear as a call in the named file.

**Prove that it can fail.** Add the claim to a member that `test/playtest.js`
does not call. Confirm the failure. Remove it again.

The check must name the file, the line and the member. A gate that says only
"one claim is stale" costs the reader the sweep this item just did.

## Decisions already made

- **A comment must explain the code** (Chris, 2026-08-14). A comment that
  states a falsehood explains nothing.
- **The ten true claims stay.** They record a caller no compiler can see.
- **Correct, do not delete.** `CLAUDE.md` forbids the removal of useful content.
  A wrong reason is corrected. It is not dropped.

## Open questions, and the answers

**1. Why not fold this into docs/TODO/154, the STE pass?** Because this is not a
style defect. The sentences are short and plain. They are simply untrue, and a
reader who trusts them writes worse code.

**2. Why a gate for twenty-one lines of prose?** Because the sweep alone repeats
the failure. The claim went stale silently once, and the extraction programme is
live. A gate is about thirty lines and it holds the rule forever.

**3. Should the gate cover every `@internal`, or only `driven by`?** Only
`driven by <path>`. That form names a file, so it is checkable. A bare
`@internal` names no target and cannot be verified.

## Watch out for

- **`test/playtest.js` is a console paste and imports nothing.** Read it as text.
  Do not import it in the gate.
- **A name can appear in that file as a word rather than as a call.** Match a
  call, `name(`, and not the bare token.
- **Two members share a name across files.** `raiseLegal` and `bribePolice` are
  each declared twice, once as the delegate and once as the handler. Both need a
  correct reason, and the two reasons differ.

## Verification

**The gates always run:** `npm run check`. This item changes comments and adds a
check, so docs/PROCESS.md's tier table asks for nothing more.

**The new gate must be proved able to fail.** M2 states how.

**The number that says it worked:** the gate reports zero stale claims, and it
reported twenty-one before the sweep.

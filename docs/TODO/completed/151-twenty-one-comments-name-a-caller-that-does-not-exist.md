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

## What landed, 2026-08-14

Both milestones landed in a day. `npm run check` passes at **4,530 assertions**,
and `claims:check` reports **23 claims naming 28 files, 0 stale**.

### The split, which the plan did not predict

The plan asked for the four counts and said the split was the interesting
result. It is:

| the reason the member is public | count |
| --- | ---: |
| the orchestrator reaches it | 5 |
| a test drives it | 10 |
| a screen or a context reaches it | 0 |
| nothing outside the class reaches it | 6 |

**The plan's third category is empty, and that is the finding.** The plan
expected `openChart`, `openSystemData` and `sellCargo` to sit on the command
table or on a screen context. The command table is `private readonly commands`,
so its calls are inside the class and justify nothing. `openChart` is driven by
two tests. `openSystemData` is reached by the command table alone. `sellCargo`
is reached by nothing.

### The second defect, reported rather than fixed

**Six members have no caller outside `Game`.** The plan's category 4 predicted
one kind. There are two:

1. **No caller at all.** `Game.sellCargo` and `Game.generateContractOffers`. The
   market screen sells through `TradeContext`, and the station and the campaign
   both call the free `generateContractOffers` in `contract-offers.ts`, which
   the method only wraps.
2. **A caller inside the class only.** `raiseLegal`, `openHermitTrade`,
   `toggleCombatComputer` and `openSystemData`. Each is reached by `stepHost` or
   by the command table. Both are private, so each of the four could be private
   too.

**A seventh finding sits inside one of them.** `openSystemData` keeps a
parameter, `from`, that it does not read. Its comment said the parameter stayed
in the signature for `test/playtest.js`. That file does not call the method at
all, so the parameter has no caller either.

Nothing here is deleted. `game.ts` is under active decomposition by
docs/TODO/150, and what to do about six members is that item's decision.

### Three more of the same defect, outside the plan's list

The plan listed the claims in the `@internal — driven by` form. The same
falsehood also lives in plain prose, where neither the list nor the gate sees
it:

1. **`game.ts`'s `update` named `test/gang-trial.js`.** That file does not
   exist. **The gate covers this case**, because a named file that is missing
   now fails.
2. **`screens/trade.ts` said `test/playtest.js` drives `sellCargo`.** It does
   not, and nothing else does either.
3. **`screens/trade.ts` said `test/playtest.js` sets `selected` directly.** It
   sets it through `g.marketSelected`, which is an accessor onto the screen.

One more of this shape is in `test/consigned-hold.test.ts`, and it is left
alone. This item covers `src/`, and that comment's claim about `Game.sellCargo`
calling `sell` is still true.

### What the gate had to do that the plan did not say

**It reads a comment run whole, rather than a line at a time.** A claim wraps: a
corrected comment can end a line on `driven by` and start the next with the path
it names. The first draft read line by line, found 22 of the 28 paths and
dropped six without a word — the same silent failure this gate exists to end.

**A call must arrive through an object, `.name(`.** A bare `name(` in the named
file would match a declaration. `raiseLegal` is declared in `game.ts` as well as
in `law-actions.ts`, so the `law-actions.ts` claim would answer itself. Every
real caller in the tree uses the dot form, so the rule costs nothing.

**A claim may name two files, and both are checked.** Four members are driven by
exactly two tests. Where more than two drive a member — `enterDocked` has nine —
the comment names no path at all, and says "public for the tests, which dock a
commander through it". A claim with no path cannot go stale this way, and the
gate leaves it alone.

**`game.ts` grew by 28 lines**, from 2,021 to 2,049, because a correct reason is
longer than a wrong one. `tools/sizes.mjs` records the new number.

### The gate was proved able to fail, three ways

1. A member the named file does not call. It fails, and names the file, the line
   and the member.
2. A named file that does not exist. It fails.
3. The SECOND path of a two-path claim goes stale. It fails, which is what
   proves the comment run is read whole.

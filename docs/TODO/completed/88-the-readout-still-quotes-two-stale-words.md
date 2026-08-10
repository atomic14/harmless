# 88 — The flight readout still quotes two stale words

> Completed plan. Archived from the active queue.

**Kind:** UI/UX · **Severity:** low · **Size:** small
**Depends on:** none · found while doing 77, and the same defect as 77

## Why

`describeFlight` (`break-off.ts`) exists to say what a ship is DOING, and
`flownBy` was added to it because the first cut said `closing 45s` for a g3
pirate that never ran the closing logic. Its own comment names the failure:
reporting a field the ship's flight path never touches is "quoting a stale
word".

77 found a third field with that defect — `underFire`, latched rather than
decayed — and fixed it. Two more are left, and both are in the same function.

```ts
if (fleeing) return 'fleeing';
if (flownBy === 'brain') return underFire > 0 ? 'evading' : 'own policy';
if (underFire > 0) return `${tactic} evading`;
return `${tactic} ${phase}`;
```

**`fleeing` outranks everything, and an armed trader fights from inside it.**
`takeDamage` sets `state.fleeing = true` for ANY trader that is hit
(`npc.ts:1493-1496`). `update()`'s `fleeing` branch then reads, in its own
comment, "armed traders turn and fight with the trained Jameson defence brain"
— and calls `brainFly` with the defence policy (`npc.ts:695-709`). So the ship
that is flying a trained policy at its attacker, the one docs/TODO/86 is about,
is reported as `fleeing` for the whole engagement. The word is the BRANCH it
took, not what it is doing.

This also means 77's item text was wrong about the trader: it claimed the trader
"read `evading` forever". It never did — `fleeing` returns first. The latched
flag was reaching `nextAttackPhase` and `tacticSwitchReason`, which was the real
damage; the readout was already wrong for a different reason, and still is.

**A ship that flies no attack run still reports a phase.** `attackPhase`
initialises to `'closing'` (`npc.ts:533`) and `flownBy` to `'scripted'`, so a
ship that has never executed the phase machine — a pirate outside interest
range, a trader ambling between planet and station — falls through to
`` `${tactic} ${phase}` `` and reads `slash closing`. `flownBy` does not cover
this case because such a ship is nominally scripted; it simply is not flying.

## What is NOT the problem

- **Not `flownBy`.** It is correct and doing its job. These are the two cases it
  was never asked about.
- **Not `state.fleeing` itself.** A trader that has been shot at IS in the
  fleeing state, and the flag drives real behaviour. What is wrong is the
  readout treating "took the fleeing branch" as "is running away".
- **Not urgent.** Nothing decides anything on this string. It is the trainer's
  SPENT ITS TIME column, the cockpit strip and `flight-probe.ts`'s `doing`
  field — three places a human reads to understand a fight, which is precisely
  why 77 mattered.

## Decisions already made

Both halves have ONE root: `flownBy` is documented as "which flight actually
moved this ship last step" and only three code paths ever write it, so the two
paths that fly a ship without fighting — the runaway steer in the `fleeing`
branch and the trader/amble branches — leave whatever word ran last standing,
and a ship that has never flown at all reads the constructor's `'scripted'`.
`attackPhase`'s `'closing'` is then quoted as though the machine had produced it.
So the fix is to make the existing field tell the truth rather than to add a
fourth one.

- **`flownBy` gains `'fleeing'` and `'none'`, and `update()` resets it to
  `'none'` each step.** Every flight stamps its own name after that, so a branch
  that flies nothing cannot inherit a word. Reset-then-stamp rather than
  stamping every branch: a branch added later that forgets to stamp under-claims
  (`not fighting`) instead of quoting a stale word, which is the failure mode
  this item is about. The constructor's initial value becomes `'none'`.
- **The armed trader gets the word for the flight it is actually flying.** In a
  shipped build that is the scripted attack run (`defenceBrainNameFor` returns
  `attack-run`), so it reads `run closing` / `slash evading` like any other ship
  flying the run, and `own policy` if a defence candidate ever takes the wheel.
  `fleeing` is left to the ship that really is running: the unarmed trader down
  the steer-away path, which is the only path that now stamps it.
- **A ship flying nothing reads `not fighting`.** Two words, like `own policy`
  and `on your six`, and unmistakably not a phase. It is true of every ship that
  reaches it — an ambling pirate, a trader working its lane, an inert Thargon.
- **`attackPhase` keeps `'closing'` as its initial value.** Making it null-ish
  would ripple through `nextAttackPhase`, `attack-run.ts` and the snapshot to fix
  a readout that `flownBy` already answers first. `describeFlight` simply stops
  reaching the phase for a ship that never ran the machine.
- **`describeFlight` stops taking `fleeing`** and takes `flownBy` first. The
  boolean would be a fourth input nothing reads — the same defect one argument
  slot further along. `state.fleeing` itself is untouched: it still drives the
  branch.

## Watch out for

- **`describeFlight`'s output is a fixture in tests.** Changing a word changes
  strings that are asserted; check which and re-baseline deliberately.
- **Do not reach for a new state field.** Both facts are derivable from what the
  ship already carries, and a fourth field with the same failure mode is how this
  item came to have two halves.

## Acceptance

- An armed trader fighting back does not report `fleeing`, asserted through the
  real `update()`; the unarmed one in the same branch still does.
- A ship that has never run the phase machine does not report a phase.
- Both assertions fail if the corresponding branch is reverted.

## Verification

Tier: a new test file, because both claims are about what the LIVE sky reports
and `break-off.test.ts` only calls the pure function (and is 317 lines against a
400 ceiling).

- `test/flight-readout.test.ts` — three ships through `NpcShip.update()` with
  `SHIPPED_BRAINS`: an armed trader that has been hit, an unarmed trader that has
  been hit, and a pirate parked outside `PLAYER_INTEREST_RANGE`. Assert the
  phrase each reports, and that the first two differ.
- `test/break-off.test.ts` — the pure-function baselines re-cut for the new
  signature, including `none` → `not fighting` and `fleeing` coming from
  `flownBy`.
- Prove both gates can fail: restore `if (fleeing) return 'fleeing'` at the top,
  and drop the per-step reset in `update()`, one at a time.
- `npm run check` at the end.

## Verify

Both halves were confirmed by reading, 2026-08-04: `takeDamage` sets `fleeing`
for every damaged trader, `update()`'s fleeing branch calls `brainFly` with
`defenceBrain(brains)` when the trader is armed, and `describeFlight` returns
`'fleeing'` before it tests `flownBy`. `attackPhase` is initialised to
`'closing'` in the same constructor line that sets `flownBy: 'scripted'`.

# 116 — A loaded save jumps on its own

**Kind:** bug · **Severity:** high · **Size:** small
**Depends on:** none. Touches `game/persistence.ts` and `game/world-step.ts`;
no chart or overlay code.
**GitHub:** none — reported by Chris in session, 2026-08-10.

## Why

Load a save and the ship flies into hyperspace on its own, spending fuel and
arriving somewhere the player did not choose. Reported as "I go to /play, I'm
flying and head straight into hyperspace", with no key pressed.

**Reproduced headlessly**, from a clean build, on a seeded world:

```
at Lave -> target Reorte, fuel 70
countdown after H:              5
countdown in the snapshot:      5      <-- the save captured a live countdown
after load: flight, Lave,       5
8s later:   flight, REORTE,    -1, fuel 26
```

The cause: `session.hyperCountdown` is an ordinary field of `SessionState`,
`persistence.ts:145` serialises the whole session generically
(`serialiseState`), and `restoreState` writes every field back. A snapshot
taken while the countdown is running therefore RESUMES it on load, and
`world-step.ts` completes the jump a few seconds later.

It is not rare. The countdown is `COUNTDOWN` (5s) and in-flight autosaves fire
every `AUTOSAVE_INTERVAL` (20s), so about **one jump in four** leaves a save
that re-jumps whenever it is loaded — and it keeps doing so until that
`FLIGHT_RING` slot rotates out, which is why the symptom appears to come and
go.

In-flight autosaving is NOT the bug and must not be removed: `FLIGHT_RING = 3`
at that cadence is documented as "the last minute of flying" and pinned by
`test/saves.test.ts` ("the ring at the autosave cadence is the last minute of
flying", "flying fills the in-flight ring").

## What to do

1. **A loaded save never resumes a countdown.** In `Persistence.restore`,
   after the session is restored, put `hyperCountdown` back to its at-rest
   value (`-1`, as `state.ts` initialises it). A save is a place and a moment;
   a jump you did not press is not part of either, and the player still has
   their target, so pressing `H` costs one keystroke.
   This is the half that also repairs saves ALREADY on the shelf, including
   the one that has been jumping Chris.
2. **And no new save captures one.** In the autosave tick
   (`world-step.ts:507-510`), skip the write while `hyperCountdown >= 0` and
   let the timer come round again. Cheap, and it keeps the shelf clean for
   anything else that reads a snapshot.
   Do NOT reset the timer to a fresh interval when skipping, or a player who
   jumps often could starve the ring.
3. **Check the neighbours while in there.** `session` is walked generically, so
   any other mid-action latch has the same shape of risk. Name what is checked
   in the commit: the docking-computer phase (`dockPlan`) is deliberately
   restored — `snapshot.ts` says the phase latch matters — and the countdowns
   for arrivals and waves are timers the world owns. State which are intended
   and which are not, rather than silently fixing one.

## Open questions — answered here

- **Clear the target too?** No. The target is a decision the player made on
  the chart and it survives a reload by design (`chartTarget` is its own
  snapshot field). Only the countdown is cleared.
- **Or resume the countdown from full instead?** No. Restoring a save into a
  jump nobody asked for is the bug, whatever the number on it.
- **Should the ring skip mid-countdown saves, or should restore clear them?**
  Both, and they are not redundant: the skip stops NEW bad saves, the clear
  fixes the ones already written. Neither alone closes it.

## What is NOT in scope

- Removing or re-timing in-flight autosaves. They are the intended design.
- The snapshot's generic session walk. Enumerating `SessionState`'s fields in
  the save format is explicitly rejected in `snapshot.ts:221-225`.
- Anything about the charts.

## Watch out for

- **`SNAPSHOT_VERSION` does not move.** Nothing about the format changes; a
  field that was always there is now normalised on the way in.
- **The witchspace path.** `enterWitchspace` and the escape jump also read the
  countdown; make sure a save taken in witch-space still loads to a ship the
  player controls, and say which state it lands in.
- **`test/snapshot-parse.test.ts`** deletes and corrupts fields to prove the
  door works; a normalisation on restore must not make a corrupt countdown
  look valid.

## Acceptance

- The reproduction above, as a test: a snapshot captured mid-countdown loads
  to `hyperCountdown === -1`, and eight seconds of flying leaves the commander
  in the SAME system with the SAME fuel. It must go red when the clear is
  removed.
- A second test: the autosave tick writes nothing while a countdown runs, and
  writes again once it has finished — with the ring not starved.
- `test/saves.test.ts` is untouched and still passes: in-flight autosaving
  still works exactly as designed.
- Full gates: `npm test`, `npm run lint`, `npm run constants:check`. No sim
  change, so `npm run campaign` is untouched — say so rather than run it.

## Verify

Reproduced 2026-08-10 with a scratch harness on `seedWorld(20260810)`: capture
after `startHyperspace()`, restore into a fresh Game, step 8 seconds — Lave to
Reorte, fuel 70 to 26. Read: `session: serialiseState(...)`
(`persistence.ts:145`), `hyperCountdown: -1` (`state.ts:127`),
`AUTOSAVE_INTERVAL = 20` / `FLIGHT_RING = 3` (`constants/saves.ts`), the
autosave tick (`world-step.ts:507-510`).
